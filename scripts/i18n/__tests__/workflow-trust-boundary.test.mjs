// @vitest-environment node
/**
 * レビュー指摘 H1 の恒久ゲート: .github/workflows/translate-content.yml の信頼境界を機械照合する。
 *
 * 1. 構造: 書き込みトークン（contents: write / actions: write / TRANSLATION_BOT_TOKEN）を持つジョブで、
 *    npm・node・リポジトリのスクリプト・setup-node を実行しない。npm/node を実行するジョブは読み取り権限だけ。
 *    npm ci は --ignore-scripts、checkout は persist-credentials: false、commit / push は hooks 無効。
 * 2. 振る舞い: translate ジョブの「Build the translation patch」と push ジョブの「Verify and apply the patch」の
 *    run スクリプトを YAML から取り出して実際に bash で実行する。正しいパッチ（ja の改名に伴う削除＋追加を含む）は
 *    適用し、翻訳ディレクトリ以外・ja・シンボリックリンク・実行権限・巨大パッチは拒否する。
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, symlink, writeFile, chmod, unlink } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
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

// ---- パッチの生成（translate ジョブ）と検査・適用（push ジョブ）を実際に動かす ----------------
const stepScript = (job, name) => workflow.jobs[job]?.steps.find((s) => s.name === name)?.run;
const buildScript = stepScript('translate', 'Build the translation patch');
const verifyScript = stepScript('push', 'Verify and apply the patch');
const GIT = GIT_TEST_CONFIG;
const IDENTITY = ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid'];
// ワークフロー全体の env（ALLOWED_CHANGE_RE・MAX_PATCH_BYTES・削除上限など）をそのまま渡す
const STEP_ENV = {
  ...workflow.env,
  GIT_CONFIG_PARAMETERS: "'core.hooksPath=/dev/null' 'gc.auto=0' 'maintenance.auto=false'",
};

let tmp;
afterEach(async () => tmp && removeTempDir(tmp));

function git(cwd, ...args) {
  return execFileSync('git', [...GIT, ...IDENTITY, ...args], { cwd, encoding: 'utf8' });
}

/** 翻訳記事らしい .md（scripts/i18n の書き出しと同じく 1 行目は `---`）。 */
const article = (title, body = 'Body.') =>
  `---\ntitle: "${title}"\nlang: "en"\ntranslationSourceHash: "${'0'.repeat(
    64
  )}"\n---\n\n${body}\n`;

/** files（パス → 内容。{ symlink: 先 } ならシンボリックリンク）を 1 コミット目にした一時リポジトリ。 */
async function baseRepo(files) {
  tmp = await mkdtemp(path.join(os.tmpdir(), 'i18n-patch-'));
  const repo = path.join(tmp, 'repo');
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(repo, rel);
    await mkdir(path.dirname(file), { recursive: true });
    if (typeof content === 'string') await writeFile(file, content);
    else await symlink(content.symlink, file);
  }
  git(repo, 'init', '-q', '-b', 'patch-test');
  git(repo, 'add', '--', '.');
  git(repo, 'commit', '-q', '-m', 'base');
  const runnerTemp = path.join(tmp, 'runner');
  await mkdir(path.join(runnerTemp, 'i18n-patch'), { recursive: true });
  return { repo, runnerTemp };
}

const DEFAULT_FILES = {
  'src/content/blog/en/keep.md': article('Keep'),
  'src/content/blog/en/gone.md': article('Gone'),
  'src/content/blog/ja/keep.md': '---\ntitle: "ja"\n---\n',
};

/** 作業ツリーを base に戻す（translate ジョブと push ジョブは別々のチェックアウトなので、同じ状態から始める）。 */
function resetToBase(repo) {
  git(repo, 'reset', '-q', '--hard');
  git(repo, 'clean', '-q', '-fd');
}

/** 正規の経路: change() のあと translate ジョブの「Build the translation patch」をそのまま実行してパッチを作る。 */
async function buildPatch(change, files = DEFAULT_FILES) {
  const ctx = await baseRepo(files);
  await change(ctx.repo);
  expect(buildScript, 'translate ジョブに「Build the translation patch」がありません').toBeTypeOf(
    'string'
  );
  const result = spawnSync('bash', ['-c', buildScript], {
    cwd: ctx.repo,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...STEP_ENV,
      RUNNER_TEMP: ctx.runnerTemp,
      GITHUB_OUTPUT: path.join(tmp, 'out'),
    },
  });
  expect(result.status, result.stdout + result.stderr).toBe(0);
  resetToBase(ctx.repo);
  return ctx;
}

/** 攻撃者の経路: 信頼しない translate ジョブが任意のパッチを作った想定（git の既定どおり改名も検出する）。 */
async function craftPatch(change, files = DEFAULT_FILES) {
  const ctx = await baseRepo(files);
  await change(ctx.repo);
  git(ctx.repo, 'add', '--', '.');
  const patch = git(ctx.repo, 'diff', '--cached', '--binary');
  resetToBase(ctx.repo);
  await writeFile(path.join(ctx.runnerTemp, 'i18n-patch/translation.patch'), patch);
  return ctx;
}

function runVerify({ repo, runnerTemp }, env = {}) {
  expect(
    verifyScript,
    'push ジョブに「Verify and apply the patch」ステップがありません'
  ).toBeTypeOf('string');
  const result = spawnSync('bash', ['-c', verifyScript], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, ...STEP_ENV, RUNNER_TEMP: runnerTemp, ...env },
  });
  const staged = git(repo, 'diff', '--cached', '--no-renames', '--name-status')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => line.replace('\t', ' '));
  return { code: result.status, output: result.stdout + result.stderr, staged };
}

// git と bash を何度も起動するため、負荷の高い環境でも既定の 5 秒で切れないよう余裕を持たせる
describe(
  'H1: push ジョブはパッチの変更パスと種別を検査してから適用する',
  { timeout: 30_000 },
  () => {
    it('翻訳ディレクトリの .md の変更・追加・削除は適用して stage する', async () => {
      const ctx = await buildPatch(async (repo) => {
        const en = path.join(repo, 'src/content/blog/en');
        await writeFile(path.join(en, 'keep.md'), article('Keep', 'Changed.'));
        await writeFile(path.join(en, 'new.md'), article('New'));
        await unlink(path.join(en, 'gone.md'));
      });
      const result = runVerify(ctx);
      expect(result.code, result.output).toBe(0);
      expect(result.staged.sort()).toEqual([
        'A src/content/blog/en/new.md',
        'D src/content/blog/en/gone.md',
        'M src/content/blog/en/keep.md',
      ]);
    });

    it('ja の改名（slug 変更）: 旧 slug の翻訳の削除と、ほぼ同じ内容の新 slug の追加を適用する（HIGH-1）', async () => {
      const long = Array.from({ length: 40 }, (_, i) => `Paragraph ${i} of the article.`).join(
        '\n\n'
      );
      const files = { ...DEFAULT_FILES, 'src/content/blog/en/old-slug.md': article('Same', long) };
      const ctx = await buildPatch(async (repo) => {
        const en = path.join(repo, 'src/content/blog/en');
        await unlink(path.join(en, 'old-slug.md'));
        // 新しい翻訳は来歴行（ハッシュ）だけが違う
        await writeFile(
          path.join(en, 'new-slug.md'),
          article('Same', long).replace('0'.repeat(64), 'f'.repeat(64))
        );
      }, files);
      const patch = readFileSync(path.join(ctx.runnerTemp, 'i18n-patch/translation.patch'), 'utf8');
      expect(patch).not.toMatch(/^rename (from|to) /m);
      const result = runVerify(ctx);
      expect(result.code, result.output).toBe(0);
      expect(result.staged.sort()).toEqual([
        'A src/content/blog/en/new-slug.md',
        'D src/content/blog/en/old-slug.md',
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
      const ctx = await craftPatch(change);
      const result = runVerify(ctx);
      expect(result.code, result.output).toBe(1);
      expect(result.output).toContain('::error title=i18n::');
      expect(result.staged).toEqual([]);
    });

    it('上限を超える大きさのパッチは適用しない', async () => {
      const ctx = await craftPatch((repo) =>
        writeFile(path.join(repo, 'src/content/blog/en/keep.md'), article('Keep', 'x'.repeat(2000)))
      );
      const result = runVerify(ctx, { MAX_PATCH_BYTES: '100' });
      expect(result.code).toBe(1);
      expect(result.output).toContain('パッチが大きすぎるため適用しません');
      expect(result.staged).toEqual([]);
    });
  }
);

describe(
  'push ジョブの検査は、stage された内容を行ごとに照合する（MEDIUM-3 / LOW-1 / LOW-2）',
  { timeout: 30_000 },
  () => {
    it('保護パスからの改名（.github/workflows/ci.yml → src/content/blog/en/ci.md）は拒否する', async () => {
      const files = {
        ...DEFAULT_FILES,
        // 1 行目を --- にして、frontmatter の検査 (5) ではなくパス・種別の検査で拒否されることを確かめる
        '.github/workflows/ci.yml': '---\nname: CI\non: push\njobs: {}\n',
      };
      const ctx = await craftPatch((repo) => {
        git(repo, 'mv', '.github/workflows/ci.yml', 'src/content/blog/en/ci.md');
      }, files);
      const result = runVerify(ctx);
      expect(result.code, result.output).toBe(1);
      expect(result.output).toMatch(/::error title=i18n::/);
      expect(result.staged).toEqual([]);
      expect(existsSync(path.join(ctx.repo, '.github/workflows/ci.yml'))).toBe(true);
    });

    it('既存のシンボリックリンクの中身だけの差し替え（120000 のまま）は拒否する', async () => {
      const files = { ...DEFAULT_FILES, 'src/content/blog/en/link.md': { symlink: 'keep.md' } };
      const ctx = await craftPatch(async (repo) => {
        const link = path.join(repo, 'src/content/blog/en/link.md');
        await unlink(link);
        await symlink('/etc/passwd', link);
      }, files);
      const result = runVerify(ctx);
      expect(result.code, result.output).toBe(1);
      expect(result.output).toContain(
        '許可されていない種類の変更が stage されました: :120000 120000'
      );
      expect(result.staged).toEqual([]);
    });

    it.each([
      ['追加', 'src/content/blog/en/js.md'],
      ['変更', 'src/content/blog/en/keep.md'],
    ])(
      '1 行目が --- でない .md（---js は gray-matter が JavaScript として評価する）の%sは拒否する',
      async (_name, file) => {
        const ctx = await craftPatch((repo) =>
          writeFile(path.join(repo, file), '---js\n{ title: (() => "x")() }\n---\n\nBody.\n')
        );
        const result = runVerify(ctx);
        expect(result.code, result.output).toBe(1);
        expect(result.output).toContain(
          `frontmatter の 1 行目が --- ではありません: ${file}（---js）`
        );
        expect(result.staged).toEqual([]);
      }
    );

    const EIGHT = Object.fromEntries(
      Array.from({ length: 8 }, (_, i) => [`src/content/blog/en/p${i}.md`, article(`P${i}`)])
    );

    it('削除は翻訳ファイル数 × 25%（最低 4 件）まで: 8 件中 4 件は適用、5 件は拒否', async () => {
      const remove = (n) => async (repo) => {
        for (let i = 0; i < n; i += 1)
          await unlink(path.join(repo, `src/content/blog/en/p${i}.md`));
      };
      const four = runVerify(await craftPatch(remove(4), EIGHT));
      expect(four.code, four.output).toBe(0);
      expect(four.staged).toHaveLength(4);
      await removeTempDir(tmp);
      const five = runVerify(await craftPatch(remove(5), EIGHT));
      expect(five.code, five.output).toBe(1);
      expect(five.output).toContain(
        '削除が多すぎるため適用しません（5 件 / 翻訳 8 件、上限 4 件）'
      );
      expect(five.staged).toEqual([]);
    });
  }
);
