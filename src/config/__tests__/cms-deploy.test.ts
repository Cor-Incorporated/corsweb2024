// @vitest-environment node
/**
 * CMS の配信ワークフロー（.github/workflows/deploy-cms.yml、ADR-0018・#329）のリンクテスト。
 *
 * 「main からだけ配信する」を GCP（Workload Identity 連携の条件）と GitHub（Environment cms-production）で
 * 強制するには、ワークフローが次の形を保っている必要がある。片方だけ変えると、両側の値を出して落ちる。
 *   - 鍵を使わない: secrets. を参照しない。id-token: write は deploy ジョブだけ
 *   - deploy ジョブは environment: cms-production。checkout も npm も実行しない（artifact だけを配信する）
 *   - WIF のプロバイダとサービスアカウント ↔ docs/cms-sveltia.md に書いた値
 *   - 配信先のプロジェクト ↔ cms/firebase.json の hosting.site（既定サイト）
 *   - docs に書いた WIF の条件（job_workflow_ref）↔ このワークフローのパス
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

type Step = { name?: string; uses?: string; run?: string; with?: Record<string, unknown> };
type Job = {
  if?: string;
  needs?: string | string[];
  environment?: string | { name?: string };
  permissions?: Record<string, string> | string;
  steps?: Step[];
};
type Workflow = { permissions?: Record<string, string> | string; jobs: Record<string, Job> };
type Inputs = { workflow: string; docs: string; site: string };

const ROOT = process.cwd();
const WORKFLOW_FILE = '.github/workflows/deploy-cms.yml';
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const loadInputs = (): Inputs => ({
  workflow: read(WORKFLOW_FILE),
  docs: read('docs/cms-sveltia.md'),
  site: (JSON.parse(read('cms/firebase.json')) as { hosting: { site: string } }).hosting.site,
});

const PROVIDER =
  /projects\/\d+\/locations\/global\/workloadIdentityPools\/[\w-]+\/providers\/[\w-]+/g;
const SERVICE_ACCOUNT = /[a-z][a-z0-9-]*@[a-z0-9-]+\.iam\.gserviceaccount\.com/g;
const PINNED = /@[0-9a-f]{40}$/;
const unique = (text: string, pattern: RegExp) => [...new Set(text.match(pattern) ?? [])];
const idTokenOf = (permissions: Job['permissions']) =>
  typeof permissions === 'string' ? permissions : permissions?.['id-token'];

/** 鍵を使わない・id-token は deploy だけ・deploy は Environment 付き・deploy はコードを実行しない */
function checkKeyless(workflow: Workflow, text: string): string[] {
  const violations: string[] = [];
  const secretLines = text.split('\n').filter((line) => line.includes('secrets.'));
  if (secretLines.length > 0) {
    violations.push(
      `deploy-cms.yml が secrets. を参照している: ${secretLines.map((l) => l.trim()).join(' / ')}`
    );
  }
  const holders = [
    ...(idTokenOf(workflow.permissions) ? ['（ワークフロー全体）'] : []),
    ...Object.entries(workflow.jobs)
      .filter(([, job]) => idTokenOf(job.permissions))
      .map(([name, job]) => `${name}=${idTokenOf(job.permissions)}`),
  ];
  if (holders.join(',') !== 'deploy=write') {
    violations.push(
      `id-token: write は deploy ジョブだけに置く: 期待 [deploy=write] / 実際 [${holders.join(
        ', '
      )}]`
    );
  }
  const deploy = workflow.jobs.deploy ?? {};
  const environment =
    typeof deploy.environment === 'string' ? deploy.environment : deploy.environment?.name;
  if (environment !== 'cms-production') {
    violations.push(
      `deploy ジョブの environment: 期待 cms-production / 実際 ${environment ?? '（なし）'}`
    );
  }
  if (![deploy.needs ?? []].flat().includes('build'))
    violations.push('deploy ジョブに needs: build が無い');
  for (const step of deploy.steps ?? []) {
    if (step.uses?.startsWith('actions/checkout@')) {
      violations.push(`deploy ジョブが checkout している（artifact だけを配信する）: ${step.name}`);
    }
    if (/\b(?:npm|pnpm|yarn)\s+(?:ci|install|run|exec)\b|\bnode\s/.test(step.run ?? '')) {
      violations.push(
        `deploy ジョブがリポジトリのコードを実行している: ${step.name}: ${step.run?.trim()}`
      );
    }
  }
  return violations;
}

/** WIF・サービスアカウント・配信先 ↔ docs と cms/firebase.json */
function checkIdentity(workflow: Workflow, { docs, site }: Inputs): string[] {
  const violations: string[] = [];
  const steps = workflow.jobs.deploy?.steps ?? [];
  const auth = steps.find((step) => step.uses?.startsWith('google-github-actions/auth@'));
  const provider = String(auth?.with?.workload_identity_provider ?? '（なし）');
  const account = String(auth?.with?.service_account ?? '（なし）');
  const docsProviders = unique(docs, PROVIDER);
  const docsAccounts = unique(docs, SERVICE_ACCOUNT);
  if (docsProviders.length !== 1 || docsProviders[0] !== provider) {
    violations.push(
      `WIF プロバイダ: deploy-cms.yml "${provider}" / docs [${docsProviders.join(', ')}]`
    );
  }
  if (docsAccounts.length !== 1 || docsAccounts[0] !== account) {
    violations.push(
      `サービスアカウント: deploy-cms.yml "${account}" / docs [${docsAccounts.join(', ')}]`
    );
  }
  const deployRun = steps.find((step) => /firebase-tools@/.test(step.run ?? ''))?.run ?? '';
  const project = deployRun.match(/--project\s+(\S+)/)?.[1] ?? '（なし）';
  if (project !== site) {
    violations.push(
      `配信先: deploy-cms.yml --project ${project} / cms/firebase.json hosting.site ${site}（既定サイト）`
    );
  }
  if (!/firebase-tools@\d+\.\d+\.\d+\s/.test(deployRun) || !/--only hosting/.test(deployRun)) {
    violations.push(
      `firebase-tools の版を x.y.z で固定し、--only hosting で配信する: "${deployRun.trim()}"`
    );
  }
  const condition = `Cor-Incorporated/corsweb2024/${WORKFLOW_FILE}@refs/heads/main`;
  if (!docs.includes(`assertion.job_workflow_ref=='${condition}'`)) {
    violations.push(
      `docs の WIF 条件に job_workflow_ref=='${condition}' が無い（ワークフローの名前を変えたら GCP の条件も変える）`
    );
  }
  return violations;
}

/** main だけで動く・action は SHA で固定・配信後のヘッダー照合と、止めているときの警告がある */
function checkGuards(workflow: Workflow): string[] {
  const violations: string[] = [];
  for (const name of ['build', 'deploy']) {
    const condition = workflow.jobs[name]?.if ?? '';
    if (
      !condition.includes("vars.CMS_DEPLOY_ENABLED == 'true'") ||
      !condition.includes("github.ref == 'refs/heads/main'")
    ) {
      violations.push(
        `${name} ジョブの if に CMS_DEPLOY_ENABLED と main の条件が無い: "${condition}"`
      );
    }
  }
  for (const [name, job] of Object.entries(workflow.jobs)) {
    for (const step of job.steps ?? []) {
      if (step.uses && !PINNED.test(step.uses))
        violations.push(`${name}: action を commit SHA で固定していない: ${step.uses}`);
    }
  }
  const checkRun = (workflow.jobs.deploy?.steps ?? []).map((step) => step.run ?? '').join('\n');
  if (!/curl[\s\S]*Content-Security-Policy[\s\S]*Cross-Origin-Opener-Policy/.test(checkRun)) {
    violations.push(
      'deploy ジョブに、配信後の CSP と COOP を cms/firebase.json と比べる手順が無い'
    );
  }
  const notice = Object.values(workflow.jobs).find((job) =>
    (job.if ?? '').includes("vars.CMS_DEPLOY_ENABLED != 'true'")
  );
  if (!notice?.steps?.some((step) => (step.run ?? '').includes('::warning'))) {
    violations.push('CMS_DEPLOY_ENABLED が true でないときに ::warning を出すジョブが無い');
  }
  return violations;
}

const checkAll = (inputs: Inputs): string[] => {
  const workflow = yaml.load(inputs.workflow) as Workflow;
  return [
    ...checkKeyless(workflow, inputs.workflow),
    ...checkIdentity(workflow, inputs),
    ...checkGuards(workflow),
  ];
};

describe('CMS の配信（deploy-cms.yml ↔ docs ↔ cms/firebase.json）', () => {
  it('鍵を使わず、main だけ・Environment 付きの deploy ジョブが WIF で配信する', () => {
    expect(checkAll(loadInputs())).toEqual([]);
  });
});

describe('F3 変異: 配信の片側だけを変えると両側の値を出して落ちる', () => {
  const mutate = (change: (inputs: Inputs) => Inputs) => checkAll(change(loadInputs())).join('\n');
  const inWorkflow = (from: string | RegExp, to: string) => (inputs: Inputs) => {
    const workflow = inputs.workflow.replace(from, to);
    expect(workflow).not.toBe(inputs.workflow);
    return { ...inputs, workflow };
  };

  it('secrets. の鍵を使う', () => {
    const message = mutate(
      inWorkflow(
        'service_account: cms-deployer',
        'credentials_json: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_COR_JP_WEB }}\n          service_account: cms-deployer'
      )
    );
    expect(message).toContain('deploy-cms.yml が secrets. を参照している');
  });

  it('id-token: write をワークフロー全体に置く', () => {
    const message = mutate(
      inWorkflow(
        /^permissions:\n  contents: read\n/m,
        'permissions:\n  contents: read\n  id-token: write\n'
      )
    );
    expect(message).toContain('期待 [deploy=write] / 実際 [（ワークフロー全体）, deploy=write]');
  });

  it('deploy ジョブの environment を外す', () => {
    const message = mutate(inWorkflow('    environment: cms-production\n', ''));
    expect(message).toContain('deploy ジョブの environment: 期待 cms-production / 実際 （なし）');
  });

  it('deploy ジョブで checkout して npm ci する', () => {
    const message = mutate(
      inWorkflow(
        '      - name: Download the CMS build\n',
        '      - name: Checkout\n        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1\n      - name: Install\n        run: npm ci\n      - name: Download the CMS build\n'
      )
    );
    expect(message).toContain('deploy ジョブが checkout している');
    expect(message).toContain('deploy ジョブがリポジトリのコードを実行している: Install: npm ci');
  });

  it('ワークフローのサービスアカウントだけを変える', () => {
    const message = mutate(inWorkflow('service_account: cms-deployer@', 'service_account: other@'));
    expect(message).toContain(
      'サービスアカウント: deploy-cms.yml "other@cor-jp-cms-admin.iam.gserviceaccount.com" / docs [cms-deployer@cor-jp-cms-admin.iam.gserviceaccount.com]'
    );
  });

  it('docs の WIF プロバイダだけを変える', () => {
    const message = mutate((inputs) => ({
      ...inputs,
      docs: inputs.docs.replaceAll('/providers/corsweb2024', '/providers/other'),
    }));
    expect(message).toContain(
      'WIF プロバイダ: deploy-cms.yml "projects/60287323048/locations/global/workloadIdentityPools/github/providers/corsweb2024" / docs [projects/60287323048/locations/global/workloadIdentityPools/github/providers/other]'
    );
  });

  it('配信先のプロジェクトだけを公開サイトのものにする', () => {
    const message = mutate(inWorkflow('--project cor-jp-cms-admin', '--project cor-jp-web'));
    expect(message).toContain(
      '配信先: deploy-cms.yml --project cor-jp-web / cms/firebase.json hosting.site cor-jp-cms-admin'
    );
  });

  it('action をタグで参照する・main の条件を外す', () => {
    const message = mutate((inputs) =>
      inWorkflow(
        /google-github-actions\/auth@[0-9a-f]{40}/,
        'google-github-actions/auth@v3'
      )(
        inWorkflow(
          "    needs: build\n    if: vars.CMS_DEPLOY_ENABLED == 'true' && github.ref == 'refs/heads/main'",
          "    needs: build\n    if: vars.CMS_DEPLOY_ENABLED == 'true'"
        )(inputs)
      )
    );
    expect(message).toContain(
      'action を commit SHA で固定していない: google-github-actions/auth@v3'
    );
    expect(message).toContain(
      `deploy ジョブの if に CMS_DEPLOY_ENABLED と main の条件が無い: "vars.CMS_DEPLOY_ENABLED == 'true'"`
    );
  });
});
