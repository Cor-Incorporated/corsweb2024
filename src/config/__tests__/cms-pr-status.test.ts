// @vitest-environment node
/**
 * CMS の PR の状態通知（.github/workflows/cms-pr-status.yml）のリンクテスト。
 *
 * workflow_run は、workflows に書いた名前がワークフローの name と 1 文字でも違うと、何も言わずに動かない。
 * 判定で使う名前（見ているワークフロー・必須チェック・翻訳の検査・プレビューのサイト・翻訳の言語）も、別のファイルが正本。
 * 片方だけ変えると、両方の値を出して落ちる。あわせて、PR のコードを動かさない（checkout は既定ブランチだけ・npm を
 * 使わない・run に ${{ }} を埋めない）こと、起動の条件（cms/ のブランチ・このリポジトリ・手動は既定ブランチから）と、
 * 権限が最小であることを照合する。
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import {
  CONTENT_PREFIX,
  PREVIEW_JOB,
  PREVIEW_SITE,
  REQUIRED_CHECKS,
  TRANSLATION_CHECK,
  TRANSLATION_LANGS,
  WATCHED_WORKFLOWS,
} from '../../../scripts/cms/pr-status-core.mjs';
import { TARGET_LANGS } from '../../../scripts/i18n/config.mjs';

type Step = { name?: string; uses?: string; run?: string; with?: Record<string, unknown>; env?: Record<string, unknown> };
type Job = {
  name?: string;
  if?: string;
  permissions?: Record<string, string>;
  concurrency?: { group?: string; 'cancel-in-progress'?: boolean };
  steps?: Step[];
};
type Workflow = { name?: string; on?: Record<string, unknown>; permissions?: unknown; concurrency?: unknown; jobs: Record<string, Job> };
type Firebase = { hosting?: { site?: string } | { site?: string }[] };
type Sources = { workflows: Workflow[]; translate: Workflow; firebase: Firebase };

const ROOT = process.cwd();
const WORKFLOWS_DIR = path.join(ROOT, '.github/workflows');
const FILE = 'cms-pr-status.yml';
const loadText = (file: string) => readFileSync(path.join(WORKFLOWS_DIR, file), 'utf8');
const loadWorkflow = (file: string) => yaml.load(loadText(file)) as Workflow;
const sources = (): Sources => ({
  workflows: readdirSync(WORKFLOWS_DIR)
    .filter((file) => file.endsWith('.yml') && file !== FILE)
    .map(loadWorkflow),
  translate: loadWorkflow('translate-content.yml'),
  firebase: JSON.parse(readFileSync(path.join(ROOT, 'firebase.json'), 'utf8')) as Firebase,
});
const sorted = (values: readonly string[]) => [...values].sort().join(', ');

/** 起動の条件: workflow_run の対象 ↔ WATCHED_WORKFLOWS ↔ 各ワークフローの name、cms/ のブランチだけ、手で知らせ直せる */
function checkTriggers(workflow: Workflow, { workflows }: Sources): string[] {
  const trigger = workflow.on?.workflow_run as { workflows?: string[]; branches?: string[] } | undefined;
  const watched = trigger?.workflows ?? [];
  const names = new Set(workflows.map((w) => w.name ?? ''));
  return [
    ...watched
      .filter((name) => !names.has(name))
      .map((name) => `workflow_run の対象 "${name}" という name のワークフローが無い（あるもの: ${sorted([...names])}）`),
    ...(sorted(watched) === sorted(WATCHED_WORKFLOWS)
      ? []
      : [`workflow_run の対象（${sorted(watched)}）と pr-status-core.mjs の WATCHED_WORKFLOWS（${sorted(WATCHED_WORKFLOWS)}）が違う`]),
    ...(JSON.stringify(trigger?.branches) === '["cms/**"]' ? [] : [`workflow_run の branches が ["cms/**"] ではない: ${JSON.stringify(trigger?.branches)}`]),
    ...(workflow.on && 'workflow_dispatch' in workflow.on ? [] : ['手で知らせ直す workflow_dispatch が無い']),
    ...(workflow.concurrency === undefined ? [] : ['concurrency はジョブに置く（ワークフローに置くと、if で飛ばす run も待ちの列に入る）']),
  ];
}

/** 判定で使う名前が、ほかのワークフローと firebase.json の値と噛み合っているか */
function checkNames({ workflows, translate, firebase }: Sources): string[] {
  // check run の名前は、ジョブの name（無ければジョブ id）
  const jobNames = new Set(workflows.flatMap((w) => Object.entries(w.jobs ?? {}).map(([id, job]) => job.name ?? id)));
  const translateJobs = Object.values(translate.jobs ?? {}).map((job) => job.name ?? '');
  const paths = (translate.on?.pull_request as { paths?: string[] } | undefined)?.paths ?? [];
  const sites = ([] as { site?: string }[]).concat(firebase.hosting ?? []).map((hosting) => hosting.site ?? '');
  return [
    ...REQUIRED_CHECKS.filter((name) => !jobNames.has(name)).map((name) => `必須チェック "${name}"（pr-status-core.mjs）という name のジョブが無い`),
    ...(jobNames.has(PREVIEW_JOB) ? [] : [`プレビューを作るジョブ "${PREVIEW_JOB}"（pr-status-core.mjs）という name・id のジョブが無い`]),
    ...(translateJobs.includes(TRANSLATION_CHECK)
      ? []
      : [`翻訳の検査 "${TRANSLATION_CHECK}"（pr-status-core.mjs）という name のジョブが translate-content.yml に無い（あるもの: ${sorted(translateJobs)}）`]),
    ...(paths.includes(`${CONTENT_PREFIX}**`)
      ? []
      : [`translate-content.yml の pull_request.paths に "${CONTENT_PREFIX}**"（pr-status-core.mjs の CONTENT_PREFIX）が無い（あるもの: ${sorted(paths)}）`]),
    ...(sites.includes(PREVIEW_SITE)
      ? []
      : [`プレビューのサイト "${PREVIEW_SITE}"（pr-status-core.mjs）が firebase.json の hosting.site に無い（あるもの: ${sorted(sites)}）`]),
  ];
}

const GUARDS = [
  "github.event_name == 'workflow_dispatch'",
  'github.ref_name == github.event.repository.default_branch',
  "github.event.workflow_run.event == 'pull_request'",
  "startsWith(github.event.workflow_run.head_branch, 'cms/')",
  'github.event.workflow_run.head_repository.full_name == github.repository',
];
const PERMISSIONS = { actions: 'read', checks: 'read', contents: 'read', 'pull-requests': 'write' };

/** ジョブ: if の守り・権限・concurrency */
function checkJob(workflow: Workflow): string[] {
  const job = workflow.jobs.status;
  const condition = String(job?.if ?? '');
  const group = String(job?.concurrency?.group ?? '');
  return [
    ...GUARDS.filter((guard) => !condition.includes(guard)).map((guard) => `status ジョブの if に「${guard}」が無い`),
    ...(JSON.stringify(workflow.permissions) === '{}' ? [] : [`最上位の permissions が {} ではない: ${JSON.stringify(workflow.permissions)}`]),
    ...(JSON.stringify(job?.permissions) === JSON.stringify(PERMISSIONS)
      ? []
      : [`status ジョブの permissions: ${JSON.stringify(job?.permissions)} / 期待 ${JSON.stringify(PERMISSIONS)}`]),
    ...(['github.event.workflow_run.pull_requests[0].number', 'inputs.pr'].every((key) => group.includes(key)) &&
    job?.concurrency?.['cancel-in-progress'] === false
      ? []
      : [`status ジョブの concurrency が、自動と手動で同じ PR の番号ごと・cancel-in-progress: false ではない: ${JSON.stringify(job?.concurrency)}`]),
  ];
}

/** ステップ: checkout は既定ブランチだけ・ほかの action を使わない・npm を使わない・${{ }} を run に埋めない・スクリプトの呼び方 */
function checkSteps(workflow: Workflow): string[] {
  const steps = workflow.jobs.status?.steps ?? [];
  const perStep = steps.flatMap((step) => [
    ...(step.uses?.startsWith('actions/checkout@') &&
    (Object.keys(step.with ?? {}).some((key) => key !== 'persist-credentials') || step.with?.['persist-credentials'] !== false)
      ? [`checkout は既定ブランチだけ・persist-credentials: false にする（with: ${JSON.stringify(step.with)}）`]
      : []),
    ...(step.uses && !step.uses.startsWith('actions/checkout@') ? [`checkout 以外の action を使っている: ${step.uses}`] : []),
    ...(/\$\{\{/.test(step.run ?? '') ? [`run に \${{ }} を埋めている（環境変数で渡す）: ${step.name}`] : []),
    ...(/\b(npm|npx|pnpm|yarn)\b/.test(step.run ?? '') ? [`run で npm 系を使っている: ${step.name}`] : []),
  ]);
  const runs = steps.map((step) => step.run ?? '').join('\n');
  const envKeys = steps.flatMap((step) => Object.keys(step.env ?? {}));
  return [
    ...perStep,
    ...['node scripts/cms/pr-status.mjs --branch "$HEAD_BRANCH"', 'node scripts/cms/pr-status.mjs --pr "$PR_NUMBER"']
      .filter((command) => !runs.includes(command))
      .map((command) => `通知のスクリプトを「${command}」で動かしていない`),
    ...(envKeys.includes('GH_REPO') ? [] : ['GH_REPO を渡していない（gh が {owner}/{repo} を決める）']),
  ];
}

function check(text: string, given: Sources): string[] {
  const workflow = yaml.load(text) as Workflow;
  return [...checkTriggers(workflow, given), ...checkNames(given), ...checkJob(workflow), ...checkSteps(workflow)];
}

describe('CMS の PR の状態通知（cms-pr-status.yml）', () => {
  it('起動の条件・判定で使う名前・権限・checkout が、ほかのワークフローと正本の値に噛み合っている', () => {
    expect(check(loadText(FILE), sources())).toEqual([]);
  });

  it('翻訳の言語は、翻訳 CI（scripts/i18n/config.mjs の TARGET_LANGS）と同じ', () => {
    expect([...TRANSLATION_LANGS]).toEqual([...TARGET_LANGS]);
  });
});

describe('F3 変異: 片側だけ変える・守りを外すと落ちる', () => {
  const mutate = (from: string, to: string, given: Sources = sources()) => {
    const text = loadText(FILE);
    const changed = text.replace(from, to);
    expect(changed).not.toBe(text);
    return check(changed, given).join('\n');
  };
  const withTranslate = (change: (translate: Workflow) => Workflow) => {
    const given = sources();
    return check(loadText(FILE), { ...given, translate: change(given.translate) }).join('\n');
  };

  it('workflow_run の対象の名前を打ち間違える（何も言わずに動かなくなる）', () => {
    const violations = mutate('      - Responsive visual text\n', '      - Responsive visual-text\n');
    expect(violations).toContain('workflow_run の対象 "Responsive visual-text" という name のワークフローが無い');
    expect(violations).toContain('と pr-status-core.mjs の WATCHED_WORKFLOWS（');
  });

  it('見ているワークフローを、YAML 側だけ 1 つ減らす（その終わりで状態を見直さなくなる）', () => {
    expect(mutate('      - H5 Admission\n', '')).toContain(
      `workflow_run の対象（${sorted(WATCHED_WORKFLOWS.filter((name) => name !== 'H5 Admission'))}）と pr-status-core.mjs の WATCHED_WORKFLOWS（${sorted(WATCHED_WORKFLOWS)}）が違う`
    );
  });

  it('cms/ のブランチへの絞り込みを外す', () => {
    expect(mutate("    branches: ['cms/**']\n", '')).toContain('workflow_run の branches が ["cms/**"] ではない: undefined');
  });

  it('ほかのリポジトリ（フォーク）の PR を対象から外す条件を消す', () => {
    expect(mutate(' &&\n      github.event.workflow_run.head_repository.full_name == github.repository', '')).toContain(
      'status ジョブの if に「github.event.workflow_run.head_repository.full_name == github.repository」が無い'
    );
  });

  it('手で知らせ直すのを、既定ブランチ以外からも許す（そのブランチのスクリプトが動く）', () => {
    expect(mutate(' &&\n      github.ref_name == github.event.repository.default_branch', '')).toContain(
      'status ジョブの if に「github.ref_name == github.event.repository.default_branch」が無い'
    );
  });

  it('PR のコミットを checkout する', () => {
    expect(
      mutate('          persist-credentials: false\n', '          persist-credentials: false\n          ref: ${{ github.event.workflow_run.head_sha }}\n')
    ).toContain('checkout は既定ブランチだけ・persist-credentials: false にする');
  });

  it('run にブランチ名を ${{ }} で直接埋める', () => {
    expect(
      mutate('node scripts/cms/pr-status.mjs --branch "$HEAD_BRANCH"', 'node scripts/cms/pr-status.mjs --branch "${{ github.event.workflow_run.head_branch }}"')
    ).toContain('run に ${{ }} を埋めている');
  });

  it('権限を広げる', () => {
    expect(mutate('      contents: read\n      pull-requests: write\n', '      contents: write\n      pull-requests: write\n')).toContain(
      'status ジョブの permissions'
    );
  });

  it('必須チェックのジョブ名を、ワークフロー側だけ変える', () => {
    const given = sources();
    const workflows = given.workflows.map((w) => (w.name === 'CI' ? { ...w, jobs: { verify: { ...w.jobs.verify, name: 'verify-all' } } } : w));
    expect(check(loadText(FILE), { ...given, workflows }).join('\n')).toContain('必須チェック "verify"（pr-status-core.mjs）という name のジョブが無い');
  });

  it('プレビューを作るジョブの id を、deploy.yml 側だけ変える', () => {
    const given = sources();
    const workflows = given.workflows.map((w) =>
      w.name === 'Deploy to Firebase Hosting' ? { ...w, jobs: { deploy: w.jobs.build_and_deploy } } : w
    );
    expect(check(loadText(FILE), { ...given, workflows }).join('\n')).toContain(
      'プレビューを作るジョブ "build_and_deploy"（pr-status-core.mjs）という name・id のジョブが無い'
    );
  });

  it('翻訳の検査のジョブ名を、translate-content.yml 側だけ変える', () => {
    const renamed = withTranslate((translate) => ({
      ...translate,
      jobs: Object.fromEntries(
        Object.entries(translate.jobs).map(([id, job]) => [id, job.name === 'i18n-check' ? { ...job, name: 'i18n-verify' } : job])
      ),
    }));
    expect(renamed).toContain('翻訳の検査 "i18n-check"（pr-status-core.mjs）という name のジョブが translate-content.yml に無い');
    expect(renamed).toContain('i18n-verify');
  });

  it('翻訳 CI の起動の条件から src/content/** を外す（i18n-check を待ち続けることになる）', () => {
    const narrowed = withTranslate((translate) => ({
      ...translate,
      on: { ...translate.on, pull_request: { paths: ['scripts/i18n/**'] } },
    }));
    expect(narrowed).toContain('translate-content.yml の pull_request.paths に "src/content/**"（pr-status-core.mjs の CONTENT_PREFIX）が無い（あるもの: scripts/i18n/**）');
  });

  it('firebase.json のサイト名だけ変える（プレビューの URL を載せなくなる）', () => {
    const given = sources();
    expect(check(loadText(FILE), { ...given, firebase: { hosting: { site: 'cor-jp-next' } } }).join('\n')).toContain(
      'プレビューのサイト "cor-jp-main"（pr-status-core.mjs）が firebase.json の hosting.site に無い（あるもの: cor-jp-next）'
    );
  });

  it('自動の通知のグループをブランチ名にする（手動の知らせ直しと同じ PR でも並んで走り、同じコメントを 2 回書く）', () => {
    expect(
      mutate('github.event.workflow_run.pull_requests[0].number || inputs.pr || github.event.workflow_run.head_branch', 'github.event.workflow_run.head_branch || inputs.pr')
    ).toContain('status ジョブの concurrency が、自動と手動で同じ PR の番号ごと');
  });

  it('concurrency をワークフロー全体に置く', () => {
    expect(mutate('permissions: {}\n', 'permissions: {}\n\nconcurrency:\n  group: cms-pr-status\n')).toContain('concurrency はジョブに置く');
  });
});
