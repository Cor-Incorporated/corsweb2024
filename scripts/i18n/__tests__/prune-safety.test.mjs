// @vitest-environment node
/**
 * レビュー指摘 M1 の反証テスト（実 git の差分で --since を再現する）。
 *   P1: PR で en だけを追加した記事が --write --since で削除されない
 *   P2: 来歴のない旧翻訳は ja を削除しても --prune-untracked なしでは削除されない
 *   削除件数の比率上限（I18N_MAX_PRUNE_RATIO）
 */
import { existsSync } from 'node:fs';
import { copyFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readRuntimeConfig } from '../config.mjs';
import { pruneAllowance } from '../prune.mjs';
import { commitAll, createTempRepo, initGitRepo, JA_BLOG, runCli } from './helpers.mjs';

let repo;
afterEach(async () => repo?.cleanup());

const file = (rel) => path.join(repo.root, 'src/content', rel);
const legacy = (lang) => JA_BLOG.replace('lang: "ja"', `lang: "${lang}"`);

/** ja を並べ、--write（モック）で来歴つきの翻訳を作ってから基準コミットを作る。 */
async function trackedRepo(slugs, langs = ['en']) {
  repo = await createTempRepo(Object.fromEntries(slugs.map((s) => [`blog/ja/${s}.md`, JA_BLOG])));
  const written = await runCli(repo.root, ['--write', '--langs', langs.join(',')]);
  expect(written.code).toBe(0);
  return initGitRepo(repo.root);
}

// 実 git を何度も起動するため、負荷の高い環境でも既定の 5 秒で切れないよう余裕を持たせる。
describe('M1: orphan を削除してよい条件', { timeout: 30_000 }, () => {
  it('P1: PR で en だけを追加した記事（来歴つき）は --since で削除しない', async () => {
    const base = await trackedRepo(['alpha']);
    await copyFile(file('blog/en/alpha.md'), file('blog/en/en-only.md'));
    commitAll(repo.root, 'add an English-only article');

    const result = await runCli(repo.root, ['--write', '--langs', 'en', '--since', base]);
    expect(result.code).toBe(1);
    expect(existsSync(file('blog/en/en-only.md'))).toBe(true);
    expect(result.out.text()).toMatch(/blog\/en-only \[en\].*ja の削除が差分にありません/);
  });

  it('P1: 来歴のない en だけの記事も削除しない', async () => {
    const base = await trackedRepo(['alpha']);
    await writeFile(file('blog/en/en-only.md'), legacy('en'));
    commitAll(repo.root, 'add an English-only article');

    const result = await runCli(repo.root, ['--write', '--langs', 'en', '--since', base]);
    expect(result.code).toBe(1);
    expect(existsSync(file('blog/en/en-only.md'))).toBe(true);
  });

  it('差分で ja の削除が確認できた来歴つき翻訳は削除する', async () => {
    const base = await trackedRepo(['alpha', 'beta', 'gamma', 'delta']);
    await rm(file('blog/ja/alpha.md'));
    commitAll(repo.root, 'retire alpha');

    const result = await runCli(repo.root, ['--write', '--langs', 'en', '--since', base]);
    expect(result.code).toBe(0);
    expect(existsSync(file('blog/en/alpha.md'))).toBe(false);
    expect(existsSync(file('blog/en/beta.md'))).toBe(true);
  });

  it('P2: 来歴のない旧翻訳は ja を削除しても --prune-untracked なしでは削除しない', async () => {
    repo = await createTempRepo({
      'blog/ja/alpha.md': JA_BLOG,
      'blog/en/alpha.md': legacy('en'),
      'blog/ja/beta.md': JA_BLOG,
      'blog/en/beta.md': legacy('en'),
    });
    const base = initGitRepo(repo.root);
    await rm(file('blog/ja/alpha.md'));
    commitAll(repo.root, 'rename alpha');

    const kept = await runCli(repo.root, ['--write', '--langs', 'en', '--since', base]);
    expect(kept.code).toBe(1);
    expect(existsSync(file('blog/en/alpha.md'))).toBe(true);
    expect(kept.out.text()).toMatch(/blog\/alpha \[en\].*--prune-untracked/);

    const pruned = await runCli(repo.root, [
      '--write',
      '--langs',
      'en',
      '--since',
      base,
      '--prune-untracked',
    ]);
    expect(pruned.code).toBe(0);
    expect(existsSync(file('blog/en/alpha.md'))).toBe(false);
    expect(existsSync(file('blog/en/beta.md'))).toBe(true);
  });

  it('P2: --since なしの全体実行でも、来歴のない orphan は --prune-untracked なしでは削除しない', async () => {
    repo = await createTempRepo({
      'blog/ja/keep.md': JA_BLOG,
      'blog/en/keep.md': legacy('en'),
      'blog/en/legacy-orphan.md': legacy('en'),
    });
    const kept = await runCli(repo.root, ['--write', '--langs', 'en']);
    expect(kept.code).toBe(1);
    expect(existsSync(file('blog/en/legacy-orphan.md'))).toBe(true);
    const pruned = await runCli(repo.root, ['--write', '--langs', 'en', '--prune-untracked']);
    expect(existsSync(file('blog/en/legacy-orphan.md'))).toBe(false);
    expect(pruned.out.text()).toContain('✓ prune blog/legacy-orphan [en]');
  });

  it('削除件数が比率の上限を超えたら 1 件も削除しない（I18N_MAX_PRUNE_RATIO で調整できる）', async () => {
    const base = await trackedRepo(['alpha', 'beta', 'gamma', 'delta']);
    await rm(file('blog/ja/alpha.md'));
    await rm(file('blog/ja/beta.md'));
    commitAll(repo.root, 'retire two articles');

    const capped = await runCli(repo.root, ['--write', '--langs', 'en', '--since', base]);
    expect(capped.code).toBe(1);
    expect(existsSync(file('blog/en/alpha.md'))).toBe(true);
    expect(existsSync(file('blog/en/beta.md'))).toBe(true);
    expect(capped.out.text()).toContain(
      '削除が多すぎるため中止しました（blog: 2 件 / 翻訳 4 件、上限 1 件）'
    );

    const allowed = await runCli(repo.root, ['--write', '--langs', 'en', '--since', base], {
      env: { I18N_MAX_PRUNE_RATIO: '0.5' },
    });
    expect(allowed.code).toBe(0);
    expect(existsSync(file('blog/en/alpha.md'))).toBe(false);
    expect(existsSync(file('blog/en/beta.md'))).toBe(false);
  });
});

describe('M1: I18N_MAX_PRUNE_RATIO の読み取り', () => {
  it('既定は 0.25、0 より大きく 1 以下だけを受け付ける', () => {
    expect(readRuntimeConfig({}).maxPruneRatio).toBe(0.25);
    expect(readRuntimeConfig({ I18N_MAX_PRUNE_RATIO: '1' }).maxPruneRatio).toBe(1);
    expect(() => readRuntimeConfig({ I18N_MAX_PRUNE_RATIO: '0' })).toThrow(/I18N_MAX_PRUNE_RATIO/);
    expect(() => readRuntimeConfig({ I18N_MAX_PRUNE_RATIO: '1.5' })).toThrow(
      /I18N_MAX_PRUNE_RATIO/
    );
  });

  it('上限は「翻訳ファイル数 × 割合」と「記事 1 本分（言語数）」の大きい方', () => {
    expect(pruneAllowance(80, 4, 0.25)).toBe(20);
    expect(pruneAllowance(8, 4, 0.25)).toBe(4);
    expect(pruneAllowance(4, 1, 0.25)).toBe(1);
  });
});
