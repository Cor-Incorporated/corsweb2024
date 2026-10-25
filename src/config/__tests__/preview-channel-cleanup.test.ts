// @vitest-environment node
/**
 * PR を閉じたときにプレビューチャネルを消すワークフロー（.github/workflows/cleanup-preview-channel.yml）の照合。
 *
 * 1. リンク: プロジェクト・サービスアカウント・concurrency のグループは deploy.yml、サイトは firebase.json、
 *    firebase-tools の単体バイナリは deploy-cms.yml が正本。片方だけ変えると、両方の値を出して落ちる。
 *    あわせて、PR を閉じたときだけ動くこと・フォークの PR では動かないこと・権限が無いこと・リポジトリのコードを
 *    動かさないことを照合する。
 * 2. 振る舞い: 削除の run を取り出し、偽物の firebase（呼ばれた引数を記録する）で実際に動かす。消すのは
 *    pr<番号>- で始まるチャネルだけで、live・develop・ほかの PR（pr<番号><数字>- など）は消さない。
 *    偽物も本物と同じく、firebase.json の無いディレクトリでは exit 1 になる（2026-10-24 に firebase-tools で実測）。
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { afterAll, describe, expect, it } from 'vitest';

type Step = { name?: string; uses?: string; run?: string; with?: Record<string, unknown>; env?: Record<string, string> };
type Job = {
  if?: string;
  permissions?: Record<string, string>;
  concurrency?: { group?: string; 'cancel-in-progress'?: boolean };
  steps: Step[];
};
type Workflow = { on?: Record<string, unknown>; permissions?: unknown; concurrency?: { group?: string }; jobs: Record<string, Job> };
type Sources = { deploy: Workflow; deployCms: Workflow; firebase: { hosting?: { site?: string } } };

const ROOT = process.cwd();
const FILE = '.github/workflows/cleanup-preview-channel.yml';
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const sources = (): Sources => ({
  deploy: yaml.load(read('.github/workflows/deploy.yml')) as Workflow,
  deployCms: yaml.load(read('.github/workflows/deploy-cms.yml')) as Workflow,
  firebase: JSON.parse(read('firebase.json')),
});
const steps = (workflow: Workflow) => Object.values(workflow.jobs).flatMap((job) => job.steps ?? []);
const deleteStep = (workflow: Workflow) => steps(workflow).find((step) => step.name === 'Delete the preview channels of this PR');
const pinOf = (workflow: Workflow) => {
  const env = steps(workflow).find((step) => step.env?.FIREBASE_TOOLS_URL)?.env;
  return `${env?.FIREBASE_TOOLS_URL ?? '（なし）'} sha256=${env?.FIREBASE_TOOLS_SHA256 ?? '（なし）'}`;
};

/** deploy.yml の concurrency.group を、PR の番号 n の pull_request で評価した値（読めなければ null） */
function deployGroupForPr(deploy: Workflow, n: number): string | null {
  const m = /^(.*)\$\{\{ github\.event_name == 'pull_request' && format\('([^']*)', github\.event\.pull_request\.number\) \|\|/.exec(
    String(deploy.concurrency?.group ?? '')
  );
  return m ? `${m[1]}${m[2].replace('{0}', String(n))}` : null;
}

function check(text: string, { deploy, deployCms, firebase }: Sources): string[] {
  const workflow = yaml.load(text) as Workflow;
  const jobs = Object.values(workflow.jobs);
  const job = jobs[0];
  const preview = steps(deploy).find((step) => step.name === 'Deploy to Firebase Hosting (Preview)');
  const env = deleteStep(workflow)?.env ?? {};
  const auth = steps(workflow).find((step) => step.uses?.startsWith('google-github-actions/auth@'));
  const ownGroup = String(job?.concurrency?.group ?? '').replace('${{ github.event.pull_request.number }}', '123');
  const deployGroup = deployGroupForPr(deploy, 123);
  return [
    ...(JSON.stringify(workflow.on) === '{"pull_request":{"types":["closed"]}}' ? [] : [`起動の条件が PR を閉じたときだけではない: ${JSON.stringify(workflow.on)}`]),
    ...(jobs.length === 1 ? [] : [`ジョブが 1 つではない（${jobs.length} 個）`]),
    ...(String(job?.if ?? '').includes('github.event.pull_request.head.repo.full_name == github.repository') ? [] : [`フォークの PR を外す if が無い: ${job?.if}`]),
    ...(JSON.stringify(workflow.permissions) === '{}' && JSON.stringify(job?.permissions) === '{}'
      ? []
      : [`permissions が {} ではない: ワークフロー ${JSON.stringify(workflow.permissions)} / ジョブ ${JSON.stringify(job?.permissions)}`]),
    ...(workflow.concurrency === undefined ? [] : ['concurrency はジョブに置く（ワークフローに置くと、飛ばすフォークの PR の run も同じ PR のデプロイを取り消す）']),
    ...(deployGroup !== null && ownGroup === deployGroup && job?.concurrency?.['cancel-in-progress'] === true
      ? []
      : [`concurrency が deploy.yml の PR のグループと違う（PR 123 で: 削除 ${ownGroup} / deploy.yml ${deployGroup ?? `読めない ${deploy.concurrency?.group}`}、cancel-in-progress: ${job?.concurrency?.['cancel-in-progress']}）`]),
    ...(env.FIREBASE_PROJECT === preview?.with?.projectId ? [] : [`プロジェクト: 削除 ${env.FIREBASE_PROJECT} / deploy.yml の Preview ${preview?.with?.projectId}`]),
    ...(env.FIREBASE_SITE === firebase.hosting?.site ? [] : [`サイト: 削除 ${env.FIREBASE_SITE} / firebase.json の hosting.site ${firebase.hosting?.site}`]),
    ...(auth?.with?.credentials_json === preview?.with?.firebaseServiceAccount
      ? []
      : [`サービスアカウント: 削除 ${auth?.with?.credentials_json} / deploy.yml の Preview ${preview?.with?.firebaseServiceAccount}`]),
    ...(pinOf(workflow) === pinOf(deployCms) ? [] : [`firebase-tools の単体バイナリ: 削除 ${pinOf(workflow)} / deploy-cms.yml ${pinOf(deployCms)}`]),
    ...steps(workflow).flatMap((step) => [
      ...(step.uses && !step.uses.startsWith('google-github-actions/auth@') ? [`認証のほかに action を使っている（checkout もしない）: ${step.uses}`] : []),
      ...(/\$\{\{/.test(step.run ?? '') ? [`run に \${{ }} を埋めている（環境変数で渡す）: ${step.name}`] : []),
      ...(/\b(npm|npx|node|pnpm|yarn)\b/.test(step.run ?? '') ? [`run で node / npm 系を使っている: ${step.name}`] : []),
    ]),
  ];
}

const dir = mkdtempSync(path.join(tmpdir(), 'preview-channel-cleanup-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const OK_LIST = (names: string[]) =>
  JSON.stringify({ status: 'success', result: { channels: names.map((n) => ({ name: `projects/cor-jp-web/sites/cor-jp-main/channels/${n}` })) } });
const CHANNELS = ['develop', 'pr12-feat-a', 'live', 'pr123-feat-b', 'pr1-feat-c', 'xpr12-feat-d', 'pr12-renamed-branch', 'pr12_feat-e'];

type Case = { prNumber: string; list?: string; listExit?: number; deleteExit?: number; script?: string };

/**
 * 削除の run を GitHub と同じく bash -e で動かす。偽物の firebase は、本物と同じく firebase.json の無いディレクトリでは
 * exit 1 になり、hosting:channel:list には list を返し、hosting:channel:delete は引数を記録する
 */
function runCleanup({ prNumber, list = OK_LIST(CHANNELS), listExit = 0, deleteExit = 0, script }: Case) {
  const work = mkdtempSync(path.join(dir, 'case-'));
  const log = path.join(work, 'firebase.log');
  writeFileSync(path.join(work, 'list.json'), list);
  writeFileSync(
    path.join(work, 'firebase'),
    [
      '#!/usr/bin/env bash',
      `printf '%s\\n' "$*" >> "${log}"`,
      `if [ ! -f firebase.json ]; then echo '{"status":"error","error":"Not in a Firebase app directory (could not locate firebase.json)"}'; exit 1; fi`,
      `if [ "$1" = hosting:channel:list ]; then cat "${work}/list.json"; exit ${listExit}; fi`,
      `if [ "$1" = hosting:channel:delete ]; then exit ${deleteExit}; fi`,
      'exit 9',
      '',
    ].join('\n')
  );
  chmodSync(path.join(work, 'firebase'), 0o755);
  const step = deleteStep(yaml.load(read(FILE)) as Workflow);
  const file = path.join(work, 'run.sh');
  writeFileSync(file, script ?? step?.run ?? '');
  const env = step?.env ?? {};
  const result = spawnSync('bash', ['-e', file], {
    encoding: 'utf8',
    // 同期の子プロセスは vitest の timeout では止まらないので、ここで止める
    timeout: 10_000,
    cwd: work,
    env: { PATH: `${work}:${process.env.PATH}`, RUNNER_TEMP: work, PR_NUMBER: prNumber, FIREBASE_PROJECT: env.FIREBASE_PROJECT, FIREBASE_SITE: env.FIREBASE_SITE },
  });
  const calls = existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : [];
  return {
    status: result.status,
    out: `${result.stdout}${result.stderr}`,
    listed: calls.some((c) => c.startsWith('hosting:channel:list')),
    deleted: calls.filter((c) => c.startsWith('hosting:channel:delete ')).map((c) => c.split(' ')[1]),
    calls,
  };
}

describe('PR のプレビューチャネルを消すワークフロー（cleanup-preview-channel.yml）', () => {
  it('起動の条件・権限・concurrency・値が、deploy.yml・deploy-cms.yml・firebase.json と噛み合っている', () => {
    expect(check(read(FILE), sources())).toEqual([]);
  });

  it('PR 12 では pr12- で始まるチャネルだけを、プロジェクトとサイトを指定して確認なしで消す', () => {
    const { status, deleted, calls } = runCleanup({ prNumber: '12' });
    expect({ status, deleted }).toEqual({ status: 0, deleted: ['pr12-feat-a', 'pr12-renamed-branch'] });
    expect(calls).toContain('hosting:channel:delete pr12-feat-a --project cor-jp-web --site cor-jp-main --force --non-interactive');
    expect(calls[0]).toBe('hosting:channel:list --project cor-jp-web --site cor-jp-main --json --non-interactive');
  });

  it.each([
    ['番号が前方で一致するほかの PR（pr123-）', '123', ['pr123-feat-b']],
    ['番号が 1 桁の PR（pr1- だけで、pr12- や pr123- は消さない）', '1', ['pr1-feat-c']],
  ])('%s', (_, prNumber, expected) => {
    expect(runCleanup({ prNumber }).deleted).toEqual(expected);
  });

  it('チャネルが無い PR は何も消さずに通る（live が一覧にあるので「0 個」を信じてよい）', () => {
    const { status, out, deleted } = runCleanup({ prNumber: '999' });
    expect({ status, deleted }).toEqual({ status: 0, deleted: [] });
    expect(out).toContain('チャネル 8 個のうち、pr999- で始まるもの: 0 個');
  });

  it.each(['', '0', '12 ', '12abc', '-1', '1-2'])('PR の番号が読めない値（"%s"）なら、一覧も取らずに止める', (prNumber) => {
    const { status, out, listed, deleted } = runCleanup({ prNumber });
    expect({ status, listed, deleted }).toEqual({ status: 1, listed: false, deleted: [] });
    expect(out).toContain('::error title=PR の番号が読めない::');
  });

  it.each([
    ['firebase-tools が失敗した', OK_LIST(CHANNELS), 1],
    ['出力が成功の形ではない', JSON.stringify({ status: 'error', error: 'HTTP Error: 403' }), 0],
    ['channels が配列ではない', JSON.stringify({ status: 'success', result: {} }), 0],
  ])('一覧を取れない（%s）なら、何も消さずに止めて出力を見せる', (_, list, listExit) => {
    const { status, out, deleted } = runCleanup({ prNumber: '12', list, listExit });
    expect({ status, deleted }).toEqual({ status: 1, deleted: [] });
    expect(out).toContain(`::error title=チャネルの一覧を取れない（exit ${listExit}）::`);
    expect(out).toContain(list);
  });

  it('一覧に live が無い（別のサイトを見ている）なら、何も消さずに止める', () => {
    const { status, out, deleted } = runCleanup({ prNumber: '12', list: OK_LIST(['develop', 'pr12-feat-a']) });
    expect({ status, deleted }).toEqual({ status: 1, deleted: [] });
    expect(out).toContain('::error title=live チャネルが一覧に無い::cor-jp-web/cor-jp-main のチャネル: develop pr12-feat-a');
  });

  it('削除に失敗したら、ジョブを落とす', () => {
    const { status, deleted } = runCleanup({ prNumber: '12', deleteExit: 1 });
    expect({ status, deleted }).toEqual({ status: 1, deleted: ['pr12-feat-a'] });
  });
});

describe('F3 変異: 片側だけ変える・守りを外すと落ちる', () => {
  const original = read(FILE);
  const mutate = (from: string, to: string) => {
    const changed = original.replace(from, to);
    expect(changed).not.toBe(original);
    return changed;
  };
  const run = deleteStep(yaml.load(original) as Workflow)?.run ?? '';
  const mutateRun = (from: string, to: string) => {
    const changed = run.replace(from, to);
    expect(changed).not.toBe(run);
    return changed;
  };

  it('pr<番号>- の「-」を落とす（PR 12 で pr123- も消す）', () => {
    expect(runCleanup({ prNumber: '12', script: mutateRun('prefix="pr${PR_NUMBER}-"', 'prefix="pr${PR_NUMBER}"') }).deleted).toContain('pr123-feat-b');
  });

  it('空の firebase.json を置かない（本物と同じく、一覧の時点で exit 1）', () => {
    const { status, out } = runCleanup({ prNumber: '12', script: mutateRun(`echo '{}' > "$work/firebase.json"\n`, '') });
    expect(status).toBe(1);
    expect(out).toContain('Not in a Firebase app directory');
  });

  it('live の確認を外す（別のサイトの一覧でも、そのまま消しにいく）', () => {
    const script = mutateRun('if ! grep -qx live names.txt; then', 'if false; then');
    expect(runCleanup({ prNumber: '12', script, list: OK_LIST(['develop', 'pr12-feat-a']) }).status).toBe(0);
  });

  it('concurrency のグループを deploy.yml 側だけ変える', () => {
    const given = sources();
    const deploy = { ...given.deploy, concurrency: { group: String(given.deploy.concurrency?.group).replace("format('pr-{0}'", "format('pull-{0}'") } };
    expect(check(original, { ...given, deploy }).join('\n')).toContain('concurrency が deploy.yml の PR のグループと違う（PR 123 で: 削除 deploy-pr-123 / deploy.yml deploy-pull-123');
  });

  it('サイト名を firebase.json 側だけ変える', () => {
    expect(check(original, { ...sources(), firebase: { hosting: { site: 'cor-jp-next' } } }).join('\n')).toContain(
      'サイト: 削除 cor-jp-main / firebase.json の hosting.site cor-jp-next'
    );
  });

  it('firebase-tools の版を、削除のワークフロー側だけ変える', () => {
    expect(check(mutate('v15.32.1/firebase-tools-linux', 'v15.33.0/firebase-tools-linux'), sources()).join('\n')).toContain(
      'firebase-tools の単体バイナリ: 削除 https://github.com/firebase/firebase-tools/releases/download/v15.33.0/firebase-tools-linux'
    );
  });

  it('フォークの PR を外す if を消す', () => {
    expect(check(mutate('    if: github.event.pull_request.head.repo.full_name == github.repository\n', ''), sources()).join('\n')).toContain(
      'フォークの PR を外す if が無い'
    );
  });

  it('PR を開いたときにも動かす', () => {
    expect(check(mutate('types: [closed]', 'types: [opened, closed]'), sources()).join('\n')).toContain('起動の条件が PR を閉じたときだけではない');
  });

  it('リポジトリを checkout する', () => {
    const changed = mutate(
      '    steps:\n',
      '    steps:\n      - name: Checkout\n        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1\n'
    );
    expect(check(changed, sources()).join('\n')).toContain('認証のほかに action を使っている（checkout もしない）: actions/checkout@');
  });
});
