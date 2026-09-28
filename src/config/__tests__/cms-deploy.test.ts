// @vitest-environment node
/**
 * CMS の配信ワークフロー（.github/workflows/deploy-cms.yml、ADR-0018・#329）のリンクテスト。
 *
 * 「main からだけ配信する」を GCP（Workload Identity 連携の条件と binding）と GitHub（Environment
 * cms-production）で強制するには、ワークフローと docs/cms-sveltia.md に書いた GCP 側の値が噛み合っている
 * 必要がある。片方だけ変えると、両側の値を出して落ちる。
 *   - 起動するイベント（on のキー）↔ docs の条件の assertion.event_name
 *   - deploy ジョブの environment ↔ docs の条件の assertion.environment と binding の subject
 *   - このワークフローのパス ↔ docs の条件の assertion.job_workflow_ref
 *   - WIF のプロバイダとサービスアカウント ↔ docs に書いた値
 *   - 配信先のプロジェクト ↔ cms/firebase.json の hosting.site（既定サイト）
 *   - 鍵を使わない（secrets. なし・id-token は deploy だけ）、deploy ジョブのコマンドは許可リストだけ
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

type Step = {
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  env?: Record<string, unknown>;
};
type Job = {
  if?: string;
  needs?: string | string[];
  environment?: string | { name?: string };
  permissions?: Record<string, string> | string;
  steps?: Step[];
};
type Workflow = {
  on?: Record<string, unknown>;
  permissions?: Record<string, string> | string;
  jobs: Record<string, Job>;
};
type Inputs = { workflow: string; docs: string; site: string };

const ROOT = process.cwd();
const WORKFLOW_FILE = '.github/workflows/deploy-cms.yml';
const REPOSITORY = 'Cor-Incorporated/corsweb2024';
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const loadInputs = (): Inputs => ({
  workflow: read(WORKFLOW_FILE),
  docs: read('docs/cms-sveltia.md'),
  site: (JSON.parse(read('cms/firebase.json')) as { hosting: { site: string } }).hosting.site,
});

const PROVIDER =
  /projects\/(\d+)\/locations\/global\/workloadIdentityPools\/([\w-]+)\/providers\/[\w-]+/g;
const SERVICE_ACCOUNT = /[a-z][a-z0-9-]*@[a-z0-9-]+\.iam\.gserviceaccount\.com/g;
const CONDITION = /`(assertion\.repository_id==[^`]+)`/g;
const BINDING =
  /principal:\/\/iam\.googleapis\.com\/projects\/(\d+)\/locations\/global\/workloadIdentityPools\/([\w-]+)\/subject\/repo:([\w.-]+\/[\w.-]+):environment:([\w-]+)/g;
const PINNED = /@[0-9a-f]{40}$/;
const list = (values: Iterable<string>) => `[${[...values].sort().join(', ')}]`;
const unique = (text: string, pattern: RegExp) => [...new Set(text.match(pattern) ?? [])];
const idTokenOf = (permissions: Job['permissions']) =>
  typeof permissions === 'string' ? permissions : permissions?.['id-token'];
const environmentOf = (job: Job | undefined) =>
  typeof job?.environment === 'string' ? job.environment : job?.environment?.name;

/** 鍵を使わない・id-token は deploy だけ・起動は push と workflow_dispatch だけ */
function checkKeyless(workflow: Workflow, text: string): string[] {
  const violations: string[] = [];
  const secretLines = text.split('\n').filter((line) => line.includes('secrets.'));
  if (secretLines.length > 0) {
    violations.push(
      `deploy-cms.yml が secrets. を参照している: ${secretLines.map((l) => l.trim()).join(' / ')}`
    );
  }
  const events = list(Object.keys(workflow.on ?? {}));
  if (events !== '[push, workflow_dispatch]') {
    violations.push(`on のキー: 期待 [push, workflow_dispatch] / 実際 ${events}`);
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
  const deploy = workflow.jobs.deploy;
  if (environmentOf(deploy) !== 'cms-production') {
    violations.push(
      `deploy ジョブの environment: 期待 cms-production / 実際 ${
        environmentOf(deploy) ?? '（なし）'
      }`
    );
  }
  if (![deploy?.needs ?? []].flat().includes('build'))
    violations.push('deploy ジョブに needs: build が無い');
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
  return violations;
}

/** docs に書いた GCP 側の条件と binding ↔ ワークフロー（イベント・environment・パス・プロバイダ） */
function checkGcpDocs(workflow: Workflow, { docs }: Inputs): string[] {
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
  const environment = environmentOf(workflow.jobs.deploy) ?? '（なし）';
  const conditions = [...new Set([...docs.matchAll(CONDITION)].map((m) => m[1]))];
  const clauses = new Map(
    (conditions[0] ?? '').split('&&').map((clause) => {
      const [, name = clause.trim(), value = ''] =
        /assertion\.(\w+)\s*(?:==|in)\s*(.+)/.exec(clause.trim()) ?? [];
      return [name, value.trim()];
    })
  );
  const expected: Array<[string, string]> = [
    ['ref', "'refs/heads/main'"],
    ['job_workflow_ref', `'${REPOSITORY}/${WORKFLOW_FILE}@refs/heads/main'`],
    ['environment', `'${environment}'`],
    [
      'event_name',
      `[${Object.keys(workflow.on ?? {})
        .sort()
        .map((e) => `'${e}'`)
        .join(', ')}]`,
    ],
  ];
  if (conditions.length !== 1)
    violations.push(`docs の WIF 条件が 1 つではない: ${conditions.length} 個`);
  for (const [name, value] of expected) {
    if (clauses.get(name) !== value) {
      violations.push(
        `WIF 条件の assertion.${name}: deploy-cms.yml から ${value} / docs ${
          clauses.get(name) ?? '（なし）'
        }`
      );
    }
  }
  for (const name of ['repository_id', 'repository_owner_id']) {
    if (!/^'\d+'$/.test(clauses.get(name) ?? ''))
      violations.push(
        `WIF 条件に assertion.${name}（数値の ID）が無い: docs ${clauses.get(name) ?? '（なし）'}`
      );
  }
  const bindings = [...new Set([...docs.matchAll(BINDING)].map((match) => match[0]))];
  const [, number = '?', pool = '?'] = new RegExp(PROVIDER.source).exec(provider) ?? [];
  const want = `principal://iam.googleapis.com/projects/${number}/locations/global/workloadIdentityPools/${pool}/subject/repo:${REPOSITORY}:environment:${environment}`;
  if (bindings.length !== 1 || bindings[0] !== want) {
    violations.push(
      `workloadIdentityUser の binding: deploy-cms.yml から ${want} / docs [${bindings.join(', ')}]`
    );
  }
  if (docs.includes('principalSet://'))
    violations.push('docs に principalSet://（リポジトリ全体への古い binding）が残っている');
  return violations;
}

const ALLOWED_ACTIONS = ['actions/download-artifact', 'google-github-actions/auth'];
const SHELL = new Set([
  'set',
  'echo',
  'printf',
  'exit',
  'sleep',
  '[',
  'test',
  'true',
  'false',
  'mkdir',
]);
const KEYWORDS = new Set(['if', 'elif', 'while', 'until', '!', '{', '}', 'fi', 'done', 'esac']);

/** run の中のコマンド（語の並び）を取り出す。単一引用符の中は文字列、$( ) の中は別のスクリプトとして読む */
function commandsOf(script: string): string[][] {
  const substitutions: string[] = [];
  const text = script
    .replace(/'[^']*'/g, "''")
    .replace(/\$\(([^()]*)\)/g, (_, inner: string) => {
      substitutions.push(inner);
      return 'SUBSTITUTION';
    })
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/(^|\s)#.*$/gm, '$1');
  const commands = text.split(/\n|;|&&|\|\||\||\bthen\b|\bdo\b|\belse\b/).flatMap((segment) => {
    const words = segment.trim().split(/\s+/).filter(Boolean);
    while (words.length > 0 && (/^[A-Za-z_]\w*=/.test(words[0]) || KEYWORDS.has(words[0])))
      words.shift();
    return words.length === 0 || words[0] === 'for' ? [] : [words];
  });
  return [...commands, ...substitutions.flatMap(commandsOf)];
}

const commandProblem = ([name, ...args]: string[]): string | null => {
  if (SHELL.has(name) || ['jq', 'curl', 'sha256sum', 'chmod'].includes(name)) return null;
  if (name === 'gh') {
    return args[0] === 'api' &&
      !args.some((a) => /^(?:-X|--method|-f|-F|--field|--raw-field|--input)$/.test(a))
      ? null
      : 'gh は api の読み取り（GET）だけ';
  }
  if (name === 'firebase') {
    return ['hosting:channel:deploy', 'hosting:clone'].includes(args[0])
      ? null
      : 'firebase は hosting:channel:deploy と hosting:clone だけ';
  }
  return '許可リストに無いコマンド';
};

/** deploy ジョブは許可したものだけを使う（L1）・main の最新だけを配信（L2）・バイナリを sha256 で照合（L3）・candidate → live（L4） */
function checkDeploySteps(workflow: Workflow, { site }: Inputs): string[] {
  const violations: string[] = [];
  const steps = workflow.jobs.deploy?.steps ?? [];
  for (const step of steps) {
    if (
      step.uses &&
      (!PINNED.test(step.uses) || !ALLOWED_ACTIONS.includes(step.uses.split('@')[0]))
    ) {
      violations.push(
        `deploy ジョブの action が許可リストに無いか、SHA で固定していない: ${
          step.uses
        }（許可: ${ALLOWED_ACTIONS.join(', ')} を SHA で）`
      );
    }
    for (const command of commandsOf(step.run ?? '')) {
      const problem = commandProblem(command);
      if (problem)
        violations.push(`deploy ジョブの「${step.name}」: ${command.join(' ')} — ${problem}`);
    }
  }
  const runs = steps.map((step) => step.run ?? '');
  if (
    !/gh api "repos\/\$\{GITHUB_REPOSITORY\}\/commits\/main"[\s\S]*\$GITHUB_SHA/.test(runs[0] ?? '')
  ) {
    violations.push(
      'deploy ジョブの最初の手順で、main の最新の SHA と GITHUB_SHA を比べていない（古い run の再実行で巻き戻せる）'
    );
  }
  const download = steps.find((step) => /sha256sum -c/.test(step.run ?? ''));
  const url = String(download?.env?.FIREBASE_TOOLS_URL ?? '（なし）');
  const sha = String(download?.env?.FIREBASE_TOOLS_SHA256 ?? '（なし）');
  const release =
    /^https:\/\/github\.com\/firebase\/firebase-tools\/releases\/download\/v\d+\.\d+\.\d+\/firebase-tools-linux$/;
  if (!download || !release.test(url) || !/^[0-9a-f]{64}$/.test(sha)) {
    violations.push(
      `firebase-tools を、版を固定したリリースの単体バイナリにして sha256 で照合していない: URL ${url} / sha256 ${sha}`
    );
  }
  const order = ['hosting:channel:deploy candidate', 'CHECK_URL', 'hosting:clone', 'CHECK_URL'];
  let cursor = -1;
  for (const marker of order) {
    const index = runs.findIndex(
      (run, i) =>
        i > cursor && run.includes(marker) && (marker !== 'CHECK_URL' || run.includes('curl'))
    );
    if (index < 0) {
      violations.push(
        `deploy ジョブの順番が candidate への配信 → ヘッダー照合 → live への複製 → ヘッダー照合 になっていない（${marker} が見つからない）`
      );
      break;
    }
    cursor = index;
  }
  for (const [, project] of runs.join('\n').matchAll(/--project\s+(\S+)/g)) {
    if (project !== site)
      violations.push(
        `配信先: deploy-cms.yml --project ${project} / cms/firebase.json hosting.site ${site}（既定サイト）`
      );
  }
  const clone = /hosting:clone\s+(\S+)\s+(\S+)/.exec(runs.join('\n'));
  if (clone && (clone[1] !== `${site}:candidate` || clone[2] !== `${site}:live`)) {
    violations.push(
      `live への複製: deploy-cms.yml ${clone[1]} → ${clone[2]} / 期待 ${site}:candidate → ${site}:live`
    );
  }
  return violations;
}

const checkAll = (inputs: Inputs): string[] => {
  const workflow = yaml.load(inputs.workflow) as Workflow;
  return [
    ...checkKeyless(workflow, inputs.workflow),
    ...checkGcpDocs(workflow, inputs),
    ...checkDeploySteps(workflow, inputs),
  ];
};

describe('CMS の配信（deploy-cms.yml ↔ docs の GCP 側の値 ↔ cms/firebase.json）', () => {
  it('鍵を使わず、main・Environment・WIF の条件がそろい、deploy ジョブは許可したものだけを使う', () => {
    expect(checkAll(loadInputs())).toEqual([]);
  });

  it('コマンドの取り出しは、引用符の中を無視し、$( ) の中も読む', () => {
    const script = `jq -e '.a | not' f.json\nx=$(gh api "repos/a" --jq .sha)\nif [ "$x" != "y" ]; then echo "a|b"; fi`;
    expect(commandsOf(script).map((words) => words[0])).toEqual(['jq', '[', 'echo', 'gh']);
  });
});

describe('F3 変異: 片側だけを変えると両側の値を出して落ちる', () => {
  const mutate = (change: (inputs: Inputs) => Inputs) => checkAll(change(loadInputs())).join('\n');
  const inWorkflow = (from: string | RegExp, to: string) => (inputs: Inputs) => {
    const workflow = inputs.workflow.replace(from, to);
    expect(workflow).not.toBe(inputs.workflow);
    return { ...inputs, workflow };
  };
  const inDocs = (from: string, to: string) => (inputs: Inputs) => {
    const docs = inputs.docs.replaceAll(from, to);
    expect(docs).not.toBe(inputs.docs);
    return { ...inputs, docs };
  };

  it('secrets. の鍵を使う', () => {
    const message = mutate(
      inWorkflow(
        '          service_account: cms-deployer',
        '          credentials_json: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_COR_JP_WEB }}\n          service_account: cms-deployer'
      )
    );
    expect(message).toContain('deploy-cms.yml が secrets. を参照している');
  });

  it('pull_request_target で起動できるようにする', () => {
    const message = mutate(
      inWorkflow('  workflow_dispatch:\n', '  workflow_dispatch:\n  pull_request_target:\n')
    );
    expect(message).toContain(
      'on のキー: 期待 [push, workflow_dispatch] / 実際 [pull_request_target, push, workflow_dispatch]'
    );
    expect(message).toContain(
      "WIF 条件の assertion.event_name: deploy-cms.yml から ['pull_request_target', 'push', 'workflow_dispatch'] / docs ['push', 'workflow_dispatch']"
    );
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

  it('deploy ジョブの environment だけを変える', () => {
    const message = mutate(
      inWorkflow('    environment: cms-production\n', '    environment: cms-staging\n')
    );
    expect(message).toContain(
      'deploy ジョブの environment: 期待 cms-production / 実際 cms-staging'
    );
    expect(message).toContain(
      "WIF 条件の assertion.environment: deploy-cms.yml から 'cms-staging' / docs 'cms-production'"
    );
    expect(message).toContain(
      ':environment:cms-staging / docs [principal://iam.googleapis.com/projects/60287323048/locations/global/workloadIdentityPools/github/subject/repo:Cor-Incorporated/corsweb2024:environment:cms-production]'
    );
  });

  it('docs の条件の environment だけを変える', () => {
    const message = mutate(
      inDocs("assertion.environment=='cms-production'", "assertion.environment=='cms-staging'")
    );
    expect(message).toContain(
      "WIF 条件の assertion.environment: deploy-cms.yml から 'cms-production' / docs 'cms-staging'"
    );
  });

  it('docs の binding を、リポジトリ全体の principalSet に戻す', () => {
    const message = mutate(
      inDocs(
        'principal://iam.googleapis.com/projects/60287323048/locations/global/workloadIdentityPools/github/subject/repo:Cor-Incorporated/corsweb2024:environment:cms-production',
        'principalSet://iam.googleapis.com/projects/60287323048/locations/global/workloadIdentityPools/github/attribute.repository/Cor-Incorporated/corsweb2024'
      )
    );
    expect(message).toContain('workloadIdentityUser の binding: deploy-cms.yml から principal://');
    expect(message).toContain(
      'docs に principalSet://（リポジトリ全体への古い binding）が残っている'
    );
  });

  it('ワークフローのサービスアカウントだけを変える', () => {
    const message = mutate(inWorkflow('service_account: cms-deployer@', 'service_account: other@'));
    expect(message).toContain(
      'サービスアカウント: deploy-cms.yml "other@cor-jp-cms-admin.iam.gserviceaccount.com" / docs [cms-deployer@cor-jp-cms-admin.iam.gserviceaccount.com]'
    );
  });

  it('deploy ジョブに、許可リストに無い npx・gh の書き込み・action を足す', () => {
    const message = mutate((inputs) =>
      inWorkflow(
        '          chmod +x "$RUNNER_TEMP/bin/firebase"\n',
        '          chmod +x "$RUNNER_TEMP/bin/firebase"\n          npx --yes cowsay hi\n          gh api -X POST repos/x/y/dispatches\n'
      )(
        inWorkflow(
          '      - name: Authenticate to Google Cloud',
          '      - name: Extra\n        uses: some/action@3d3c42e5aac5ba805825da76410c181273ba90b1\n      - name: Authenticate to Google Cloud'
        )(inputs)
      )
    );
    expect(message).toContain('npx --yes cowsay hi — 許可リストに無いコマンド');
    expect(message).toContain(
      'gh api -X POST repos/x/y/dispatches — gh は api の読み取り（GET）だけ'
    );
    expect(message).toContain(
      'deploy ジョブの action が許可リストに無いか、SHA で固定していない: some/action@'
    );
  });

  it('main の最新との比較・sha256 の照合・candidate を外し、配信先を公開サイトにする', () => {
    const message = mutate((inputs) =>
      inWorkflow(
        /sha256sum -c -/,
        'cat'
      )(
        inWorkflow(
          '--project cor-jp-cms-admin --json',
          '--project cor-jp-web --json'
        )(
          inWorkflow(
            'latest=$(gh api "repos/${GITHUB_REPOSITORY}/commits/main" --jq .sha)',
            'latest="$GITHUB_SHA"'
          )(inputs)
        )
      )
    );
    expect(message).toContain('main の最新の SHA と GITHUB_SHA を比べていない');
    expect(message).toContain('sha256 で照合していない');
    expect(message).toContain(
      '配信先: deploy-cms.yml --project cor-jp-web / cms/firebase.json hosting.site cor-jp-cms-admin'
    );
  });
});
