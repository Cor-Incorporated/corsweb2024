// @vitest-environment node
/**
 * レビュー指摘 M3 の反証テスト: 差分で ja が変わった旧翻訳（untracked）は adopt を拒否し、
 * `--retranslate-untracked --only` を案内する（実 git の差分で --since を再現する）。
 */
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseDocument } from '../frontmatter.mjs';
import { commitAll, createTempRepo, initGitRepo, JA_BLOG, runCli } from './helpers.mjs';

let repo;
afterEach(async () => repo?.cleanup());

const file = (rel) => path.join(repo.root, 'src/content', rel);
const legacy = (lang) => JA_BLOG.replace('lang: "ja"', `lang: "${lang}"`);

// 実 git を何度も起動するため、負荷の高い環境でも既定の 5 秒で切れないよう余裕を持たせる。
describe('M3: 差分で ja が変わった旧翻訳（untracked）', { timeout: 30_000 }, () => {
  async function editedLegacyRepo() {
    repo = await createTempRepo({ 'blog/ja/alpha.md': JA_BLOG, 'blog/en/alpha.md': legacy('en') });
    const base = initGitRepo(repo.root);
    await writeFile(
      file('blog/ja/alpha.md'),
      JA_BLOG.replace('## はじめに', '## はじめに（改訂）')
    );
    commitAll(repo.root, 'edit ja');
    return base;
  }

  it('--check は adopt ではなく --retranslate-untracked --only を案内する', async () => {
    const base = await editedLegacyRepo();
    const result = await runCli(repo.root, ['--check', '--langs', 'en', '--since', base]);
    expect(result.code).toBe(1);
    expect(result.out.text()).toContain(
      'node scripts/i18n/translate-content.mjs --write --retranslate-untracked --only blog/alpha'
    );
  });

  it('--adopt --since は拒否し、古い訳を最新として確定しない', async () => {
    const base = await editedLegacyRepo();
    const before = readFileSync(file('blog/en/alpha.md'), 'utf8');
    const result = await runCli(repo.root, ['--adopt', '--langs', 'en', '--since', base]);
    expect(result.code).toBe(1);
    expect(readFileSync(file('blog/en/alpha.md'), 'utf8')).toBe(before);
    expect(result.out.text()).toMatch(
      /blog\/alpha \[en\].*--retranslate-untracked --only blog\/alpha/
    );
  });

  it('案内どおりの --retranslate-untracked --only で訳し直せる', async () => {
    const base = await editedLegacyRepo();
    const result = await runCli(repo.root, [
      '--write',
      '--langs',
      'en',
      '--since',
      base,
      '--retranslate-untracked',
    ]);
    expect(result.code).toBe(0);
    const data = parseDocument(readFileSync(file('blog/en/alpha.md'), 'utf8')).data;
    expect(data.translationModel).toBe('mock-model');
  });
});

// PR #339 再レビュー MEDIUM-2: --since を付けない --adopt（mode=adopt・docs の移行手順）でも、
// git の履歴で ja が翻訳より後に変わった記事は採用を拒否する。--force-adopt でだけ上書きできる。
describe(
  'MEDIUM-2: --since なしの --adopt も、ja が翻訳より後に変わった記事は拒否する',
  { timeout: 30_000 },
  () => {
    const EDITED = JA_BLOG.replace('## はじめに', '## はじめに（改訂）');

    /** 旧翻訳あり → ja を編集してコミット。 */
    async function jaEditedAfterTranslation() {
      repo = await createTempRepo({
        'blog/ja/alpha.md': JA_BLOG,
        'blog/en/alpha.md': legacy('en'),
      });
      initGitRepo(repo.root);
      await writeFile(file('blog/ja/alpha.md'), EDITED);
      commitAll(repo.root, 'edit ja after the translation');
    }

    it('旧翻訳あり → ja を編集してコミット → --adopt（--since なし）は exit 1 で、何も書かない', async () => {
      await jaEditedAfterTranslation();
      const before = readFileSync(file('blog/en/alpha.md'), 'utf8');
      const result = await runCli(repo.root, ['--adopt', '--langs', 'en']);
      expect(result.code).toBe(1);
      expect(readFileSync(file('blog/en/alpha.md'), 'utf8')).toBe(before);
      expect(result.out.text()).toMatch(/blog\/alpha \[en\].*ja が翻訳より後に変更されています/);
      expect(result.out.text()).toContain('--write --retranslate-untracked --only blog/alpha');
      // 採用されていないので、--check は引き続き untracked を報告する
      expect((await runCli(repo.root, ['--check', '--langs', 'en'])).out.text()).toContain(
        '[untracked] 1 件'
      );
    });

    it('--force-adopt を付けたときだけ採用する', async () => {
      await jaEditedAfterTranslation();
      const result = await runCli(repo.root, ['--adopt', '--force-adopt', '--langs', 'en']);
      expect(result.code).toBe(0);
      expect(
        parseDocument(readFileSync(file('blog/en/alpha.md'), 'utf8')).data.translationModel
      ).toBe('adopted-legacy');
    });

    it('翻訳が ja より後（または同じコミット）なら採用する（通常の移行）', async () => {
      repo = await createTempRepo({ 'blog/ja/alpha.md': JA_BLOG, 'blog/ja/beta.md': JA_BLOG });
      initGitRepo(repo.root);
      await mkdir(path.dirname(file('blog/en/alpha.md')), { recursive: true });
      await writeFile(file('blog/en/alpha.md'), legacy('en'));
      commitAll(repo.root, 'translate alpha later');
      await writeFile(file('blog/en/beta.md'), legacy('en'));
      await writeFile(file('blog/ja/beta.md'), EDITED);
      commitAll(repo.root, 'edit ja and its translation together');
      const result = await runCli(repo.root, ['--adopt', '--langs', 'en']);
      expect(result.code, result.out.text()).toBe(0);
      expect(result.out.text()).toContain('結果: 成功 2 / 失敗 0 / 未処理 0');
    });

    it.each([
      [
        'ja にコミットしていない変更がある',
        async () => {
          repo = await createTempRepo({
            'blog/ja/alpha.md': JA_BLOG,
            'blog/en/alpha.md': legacy('en'),
          });
          initGitRepo(repo.root);
          await writeFile(file('blog/ja/alpha.md'), EDITED);
        },
        /ja にコミットしていない変更がある/,
      ],
      [
        'git の履歴が無い',
        async () => {
          repo = await createTempRepo({
            'blog/ja/alpha.md': JA_BLOG,
            'blog/en/alpha.md': legacy('en'),
          });
        },
        /git の履歴を読めないため/,
      ],
    ])('新旧を確かめられないときも拒否する: %s', async (_name, setup, reason) => {
      await setup();
      const result = await runCli(repo.root, ['--adopt', '--langs', 'en']);
      expect(result.code).toBe(1);
      expect(result.out.text()).toMatch(reason);
    });

    it('--dry-run は拒否する記事を理由つきで表示する', async () => {
      await jaEditedAfterTranslation();
      const result = await runCli(repo.root, ['--adopt', '--dry-run', '--langs', 'en']);
      expect(result.code).toBe(0);
      expect(result.out.text()).toMatch(
        /\(dry-run\) refuse blog\/alpha \[en\]: .*ja が翻訳より後に変更されています/
      );
    });
  }
);
