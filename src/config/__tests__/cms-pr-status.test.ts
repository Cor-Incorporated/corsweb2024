// @vitest-environment node
/**
 * CMS の PR の状態通知（.github/workflows/cms-pr-status.yml）のリンクテスト。
 *
 * workflow_run は、workflows に書いた名前がワークフローの name と 1 文字でも違うと、何も言わずに動かない。
 * 必須チェックの名前（REQUIRED_CHECKS）や翻訳の言語も、別のファイルが正本。片方だけ変えると両方の値を出して落ちる。
 * あわせて、PR のコードを動かさない（checkout は既定ブランチだけ・npm を使わない・run に ${{ }} を埋めない）ことと、
 * 権限が最小であることを照合する。
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { REQUIRED_CHECKS, TRANSLATION_LANGS } from '../../../scripts/cms/pr-status-core.mjs';
import { TARGET_LANGS } from '../../../scripts/i18n/config.mjs';

type Step = { name?: string; uses?: string; run?: string; with?: Record<string, unknown>; env?: Record<string, unknown> };
type Job = { name?: string; if?: string; permissions?: Record<string, string>; steps?: Step[] };
type Workflow = { name?: string; on?: Record<string, unknown>; permissions?: unknown; jobs: Record<string, Job> };

const WORKFLOWS_DIR = path.join(process.cwd(), '.github/workflows');
const FILE = 'cms-pr-status.yml';
const loadText = (file: string) => readFileSync(path.join(WORKFLOWS_DIR, file), 'utf8');
const others = () =>
  readdirSync(WORKFLOWS_DIR)
    .filter((file) => file.endsWith('.yml') && file !== FILE)
    .map((file) => yaml.load(loadText(file)) as Workflow);

/** 通知のワークフローの定義が、ほかのワークフローと正本の値に噛み合っているか */
function check(text: string, workflows: Workflow[]): string[] {
  const workflow = yaml.load(text) as Workflow;
  const violations: string[] = [];
  const names = new Set(workflows.map((w) => w.name));
  const watched = ((workflow.on?.workflow_run as { workflows?: string[] })?.workflows ?? []) as string[];
  for (const name of watched) {
    if (!names.has(name)) violations.push(`workflow_run の対象 "${name}" という name のワークフローが無い（あるもの: ${[...names].sort().join(', ')}）`);
  }
  const jobNames = new Set(workflows.flatMap((w) => Object.values(w.jobs ?? {}).map((job) => job.name)));
  for (const name of REQUIRED_CHECKS) {
    if (!jobNames.has(name)) violations.push(`必須チェック "${name}"（pr-status-core.mjs）という name のジョブが無い`);
  }
  const job = workflow.jobs.status;
  const condition = String(job?.if ?? '');
  for (const guard of ["workflow_run.event == 'pull_request'", "startsWith(github.event.workflow_run.head_branch, 'cms/')", 'workflow_run.head_repository.full_name == github.repository']) {
    if (!condition.includes(guard)) violations.push(`status ジョブの if に「${guard}」が無い`);
  }
  if (JSON.stringify(workflow.permissions) !== '{}') violations.push(`最上位の permissions が {} ではない: ${JSON.stringify(workflow.permissions)}`);
  const want = { actions: 'read', checks: 'read', contents: 'read', 'pull-requests': 'write' };
  if (JSON.stringify(job?.permissions) !== JSON.stringify(want)) violations.push(`status ジョブの permissions: ${JSON.stringify(job?.permissions)} / 期待 ${JSON.stringify(want)}`);
  for (const step of job?.steps ?? []) {
    if (step.uses?.startsWith('actions/checkout@')) {
      const extra = Object.keys(step.with ?? {}).filter((key) => key !== 'persist-credentials');
      if (extra.length > 0 || step.with?.['persist-credentials'] !== false) violations.push(`checkout は既定ブランチだけ・persist-credentials: false にする（with: ${JSON.stringify(step.with)}）`);
    } else if (step.uses) {
      violations.push(`checkout 以外の action を使っている: ${step.uses}`);
    }
    if (/\$\{\{/.test(step.run ?? '')) violations.push(`run に \${{ }} を埋めている（環境変数で渡す）: ${step.name}`);
    if (/\b(npm|npx|pnpm|yarn)\b/.test(step.run ?? '')) violations.push(`run で npm 系を使っている: ${step.name}`);
  }
  const runs = (job?.steps ?? []).map((step) => step.run ?? '').join('\n');
  if (!runs.includes('node scripts/cms/pr-status.mjs --branch "$HEAD_BRANCH"')) violations.push('通知のスクリプトを --branch "$HEAD_BRANCH" で動かしていない');
  return violations;
}

describe('CMS の PR の状態通知（cms-pr-status.yml）', () => {
  it('対象のワークフロー・必須チェック・権限・checkout が噛み合っている', () => {
    expect(check(loadText(FILE), others())).toEqual([]);
  });

  it('翻訳の言語は、翻訳 CI（scripts/i18n/config.mjs の TARGET_LANGS）と同じ', () => {
    expect([...TRANSLATION_LANGS]).toEqual([...TARGET_LANGS]);
  });
});

describe('F3 変異: 片側だけ変える・守りを外すと落ちる', () => {
  const mutate = (from: string, to: string) => {
    const text = loadText(FILE);
    const changed = text.replace(from, to);
    expect(changed).not.toBe(text);
    return check(changed, others()).join('\n');
  };

  it('workflow_run の対象の名前を打ち間違える（何も言わずに動かなくなる）', () => {
    expect(mutate('      - Responsive visual text\n', '      - Responsive visual-text\n')).toContain(
      'workflow_run の対象 "Responsive visual-text" という name のワークフローが無い'
    );
  });

  it('ほかのリポジトリ（フォーク）の PR を対象から外す条件を消す', () => {
    expect(
      mutate(" &&\n      github.event.workflow_run.head_repository.full_name == github.repository", '')
    ).toContain('status ジョブの if に「workflow_run.head_repository.full_name == github.repository」が無い');
  });

  it('PR のコミットを checkout する', () => {
    expect(
      mutate('          persist-credentials: false\n', '          persist-credentials: false\n          ref: ${{ github.event.workflow_run.head_sha }}\n')
    ).toContain('checkout は既定ブランチだけ・persist-credentials: false にする');
  });

  it('run にブランチ名を ${{ }} で直接埋める', () => {
    expect(
      mutate('run: node scripts/cms/pr-status.mjs --branch "$HEAD_BRANCH"', 'run: node scripts/cms/pr-status.mjs --branch "${{ github.event.workflow_run.head_branch }}"')
    ).toContain('run に ${{ }} を埋めている');
  });

  it('権限を広げる', () => {
    expect(mutate('      contents: read\n      pull-requests: write\n', '      contents: write\n      pull-requests: write\n')).toContain(
      'status ジョブの permissions'
    );
  });

  it('必須チェックのジョブ名を、ワークフロー側だけ変える', () => {
    const workflows = others().map((w) =>
      w.name === 'CI' ? { ...w, jobs: { verify: { ...w.jobs.verify, name: 'verify-all' } } } : w
    );
    expect(check(loadText(FILE), workflows).join('\n')).toContain('必須チェック "verify"（pr-status-core.mjs）という name のジョブが無い');
  });
});
