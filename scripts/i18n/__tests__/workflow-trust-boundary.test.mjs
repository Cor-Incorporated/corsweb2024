// @vitest-environment node
/**
 * レビュー指摘 H1 の恒久ゲート: .github/workflows/translate-content.yml の信頼境界を機械照合する。
 *
 * 1. 構造: 書き込みトークン（contents: write / actions: write / TRANSLATION_BOT_TOKEN）を持つジョブで、
 *    npm・node・リポジトリのスクリプト・setup-node を実行しない。npm/node を実行するジョブは読み取り権限だけ。
 *    npm ci は --ignore-scripts、checkout は persist-credentials: false、commit / push は hooks 無効。
 * 2. 振る舞い: push ジョブの「Verify and apply the patch」の run スクリプトを実際に bash で実行し、
 *    翻訳ディレクトリ以外・ja・シンボリックリンク・実行権限・巨大パッチを拒否し、正しいパッチだけを適用する。
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, symlink, writeFile, chmod, unlink } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { afterEach, describe, expect, it } from 'vitest';
import { GIT_TEST_CONFIG, removeTempDir } from './helpers.mjs';

const root = path.resolve(import.meta.dirname, '../../..');
const workflow = yaml.load(
  readFileSync(path.join(root, '.github/workflows/translate-content.yml'), 'utf8')
);
const jobs = Object.entries(workflow.jobs);

const CODE_RE = /\b(npm|npx|node|pnpm|yarn)\b|scripts\//;
const runsRepoCode = (job) =>
  job.steps.some(
    (s) => (s.uses ?? '').startsWith('actions/setup-node') || CODE_RE.test(s.run ?? '')
  );
const hasWriteToken = (job) =>
  Object.values(job.permissions ?? {}).includes('write') ||
  JSON.stringify(job).includes('TRANSLATION_BOT_TOKEN');

describe('H1: 書き込みトークンと信頼しないコードを同じジョブに置かない', () => {
  it('ワークフロー全体の既定権限は無し', () => {
    expect(workflow.permissions).toEqual({});
  });

  it.each(jobs)('%s: 権限を明示している', (_name, job) => {
    expect(job.permissions).toBeDefined();
  });

  it.each(jobs)('%s: 書き込みトークンとコード実行を同時に持たない', (name, job) => {
    expect({ job: name, writeToken: hasWriteToken(job), runsCode: runsRepoCode(job) }).not.toEqual({
      job: name,
      writeToken: true,
      runsCode: true,
    });
  });

  it('GEMINI_API_KEY を使うのは translate ジョブだけで、その権限は contents: read だけ', () => {
    const users = jobs.filter(([, job]) => JSON.stringify(job).includes('secrets.GEMINI_API_KEY'));
    expect(users.map(([name]) => name)).toEqual(['translate']);
    expect(workflow.jobs.translate.permissions).toEqual({ contents: 'read' });
  });

  it('npm ci は install script を無効にし、秘密情報のあるジョブは npm キャッシュを使わない', () => {
    const installs = jobs.flatMap(([, job]) =>
      job.steps.filter((s) => /npm (ci|install)/.test(s.run ?? ''))
    );
    expect(installs.length).toBeGreaterThan(0);
    installs.forEach((s) => expect(s.run).toContain('--ignore-scripts'));
    const setupNode = workflow.jobs.translate.steps.find((s) =>
      (s.uses ?? '').startsWith('actions/setup-node')
    );
    expect(setupNode.with.cache).toBeUndefined();
  });

  it('checkout は認証情報を残さない（persist-credentials: false）', () => {
    const checkouts = jobs.flatMap(([, job]) =>
      job.steps.filter((s) => (s.uses ?? '').startsWith('actions/checkout'))
    );
    expect(checkouts.length).toBeGreaterThan(0);
    checkouts.forEach((s) => expect(s.with['persist-credentials']).toBe(false));
  });

  it('push ジョブの commit / push は git hooks を無効にする', () => {
    expect(workflow.jobs.push, 'push ジョブがありません').toBeDefined();
    const runs = workflow.jobs.push.steps.map((s) => s.run ?? '').join('\n');
    const gitWrites = runs.split('\n').filter((l) => /git .*\b(commit|push)\b/.test(l));
    expect(gitWrites.length).toBeGreaterThan(0);
    gitWrites.forEach((l) => expect(l).toContain('core.hooksPath=/dev/null'));
  });

  it('dispatch-check は actions: write だけ、translate-result は権限なし', () => {
    expect(workflow.jobs['dispatch-check']?.permissions).toEqual({ actions: 'write' });
    expect(workflow.jobs['translate-result']?.permissions).toEqual({});
  });
});

// ---- push ジョブのパッチ検査を実際に動かす -------------------------------------------
const verifyScript = workflow.jobs.push?.steps.find(
  (s) => s.name === 'Verify and apply the patch'
)?.run;
const GIT = GIT_TEST_CONFIG;
const IDENTITY = ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid'];

let tmp;
afterEach(async () => tmp && removeTempDir(tmp));

function git(cwd, ...args) {
  return execFileSync('git', [...GIT, ...IDENTITY, ...args], { cwd, encoding: 'utf8' });
}

/** base の状態の一時リポジトリを作り、change() を加えた差分をパッチにして、作業ツリーは base に戻す。 */
async function makePatch(change) {
  tmp = await mkdtemp(path.join(os.tmpdir(), 'i18n-patch-'));
  const repo = path.join(tmp, 'repo');
  const en = path.join(repo, 'src/content/blog/en');
  await mkdir(en, { recursive: true });
  await mkdir(path.join(repo, 'src/content/blog/ja'), { recursive: true });
  await writeFile(path.join(en, 'keep.md'), 'a\n');
  await writeFile(path.join(en, 'gone.md'), 'old\n');
  await writeFile(path.join(repo, 'src/content/blog/ja/keep.md'), 'ja\n');
  git(repo, 'init', '-q', '-b', 'patch-test');
  git(repo, 'add', '--', 'src');
  git(repo, 'commit', '-q', '-m', 'base');
  await change(repo);
  git(repo, 'add', '--', '.');
  const patch = git(repo, 'diff', '--cached', '--binary');
  git(repo, 'reset', '-q', '--hard');
  git(repo, 'clean', '-q', '-fd');
  const runnerTemp = path.join(tmp, 'runner');
  await mkdir(path.join(runnerTemp, 'i18n-patch'), { recursive: true });
  await writeFile(path.join(runnerTemp, 'i18n-patch/translation.patch'), patch);
  return { repo, runnerTemp };
}

function runVerify({ repo, runnerTemp }, env = {}) {
  expect(
    verifyScript,
    'push ジョブに「Verify and apply the patch」ステップがありません'
  ).toBeTypeOf('string');
  const result = spawnSync('bash', ['-c', verifyScript], {
    cwd: repo,
    encoding: 'utf8',
    env: {
      ...process.env,
      RUNNER_TEMP: runnerTemp,
      ALLOWED_CHANGE_RE: workflow.env.ALLOWED_CHANGE_RE,
      MAX_PATCH_BYTES: workflow.env.MAX_PATCH_BYTES,
      GIT_CONFIG_PARAMETERS: "'core.hooksPath=/dev/null' 'gc.auto=0' 'maintenance.auto=false'",
      ...env,
    },
  });
  const staged = git(repo, 'diff', '--cached', '--name-only').trim().split('\n').filter(Boolean);
  return { code: result.status, output: result.stdout + result.stderr, staged };
}

describe('H1: push ジョブはパッチの変更パスと種別を検査してから適用する', () => {
  it('翻訳ディレクトリの .md の変更・追加・削除は適用して stage する', async () => {
    const ctx = await makePatch(async (repo) => {
      const en = path.join(repo, 'src/content/blog/en');
      await writeFile(path.join(en, 'keep.md'), 'a\nb\n');
      await writeFile(path.join(en, 'new.md'), 'new\n');
      await unlink(path.join(en, 'gone.md'));
    });
    const result = runVerify(ctx);
    expect(result.code, result.output).toBe(0);
    expect(result.staged.sort()).toEqual([
      'src/content/blog/en/gone.md',
      'src/content/blog/en/keep.md',
      'src/content/blog/en/new.md',
    ]);
  });

  it.each([
    [
      'ja（正本）の変更',
      (repo) => writeFile(path.join(repo, 'src/content/blog/ja/keep.md'), 'changed\n'),
    ],
    [
      '翻訳ディレクトリ以外（ワークフロー）',
      async (repo) => {
        await mkdir(path.join(repo, '.github/workflows'), { recursive: true });
        await writeFile(path.join(repo, '.github/workflows/evil.yml'), 'on: push\n');
      },
    ],
    [
      'シンボリックリンクの作成',
      (repo) => symlink('/etc/passwd', path.join(repo, 'src/content/blog/en/link.md')),
    ],
    ['実行権限の付与', (repo) => chmod(path.join(repo, 'src/content/blog/en/keep.md'), 0o755)],
    [
      '.md 以外のファイル',
      (repo) => writeFile(path.join(repo, 'src/content/blog/en/keep.mjs'), 'x\n'),
    ],
  ])('拒否して何も stage しない: %s', async (_name, change) => {
    const ctx = await makePatch(change);
    const result = runVerify(ctx);
    expect(result.code, result.output).toBe(1);
    expect(result.output).toContain('::error title=i18n::');
    expect(result.staged).toEqual([]);
  });

  it('上限を超える大きさのパッチは適用しない', async () => {
    const ctx = await makePatch((repo) =>
      writeFile(path.join(repo, 'src/content/blog/en/keep.md'), 'x'.repeat(2000))
    );
    const result = runVerify(ctx, { MAX_PATCH_BYTES: '100' });
    expect(result.code).toBe(1);
    expect(result.output).toContain('パッチが大きすぎるため適用しません');
    expect(result.staged).toEqual([]);
  });
});
