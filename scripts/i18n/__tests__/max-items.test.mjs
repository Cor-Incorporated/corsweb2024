// @vitest-environment node
/**
 * レビュー指摘 L5 の反証テスト: 1 回の翻訳件数の上限（I18N_MAX_ITEMS、既定 20）。
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readRuntimeConfig } from '../config.mjs';
import { createTempRepo, JA_BLOG, runCli } from './helpers.mjs';

let repo;
afterEach(async () => repo?.cleanup());

const file = (rel) => path.join(repo.root, 'src/content', rel);

describe('L5: 1 回の翻訳件数の上限', () => {
  it('I18N_MAX_ITEMS を超えたら API を呼ばず、何も書かずに失敗する', async () => {
    repo = await createTempRepo({
      'blog/ja/a.md': JA_BLOG,
      'blog/ja/b.md': JA_BLOG,
      'blog/ja/c.md': JA_BLOG,
    });
    const result = await runCli(repo.root, ['--write', '--langs', 'en'], {
      env: { I18N_MAX_ITEMS: '2' },
    });
    expect(result.code).toBe(1);
    expect(result.created).toBe(0);
    expect(existsSync(file('blog/en/a.md'))).toBe(false);
    expect(result.out.text()).toContain(
      '翻訳が必要な件数 3 件が上限 2 件（I18N_MAX_ITEMS）を超えたため'
    );
  });

  it('既定の上限は 20 件', async () => {
    const files = Object.fromEntries(
      Array.from({ length: 6 }, (_, i) => [`blog/ja/p${i}.md`, JA_BLOG])
    );
    repo = await createTempRepo(files);
    const result = await runCli(repo.root, ['--write']);
    expect(result.code).toBe(1);
    expect(result.out.text()).toContain('翻訳が必要な件数 24 件が上限 20 件');
  });
});

describe('L5: I18N_MAX_ITEMS の読み取り', () => {
  it('既定は 20、1〜10000 の整数だけを受け付ける', () => {
    expect(readRuntimeConfig({}).maxItems).toBe(20);
    expect(readRuntimeConfig({ I18N_MAX_ITEMS: '500' }).maxItems).toBe(500);
    expect(() => readRuntimeConfig({ I18N_MAX_ITEMS: '0' })).toThrow(/I18N_MAX_ITEMS/);
    expect(() => readRuntimeConfig({ I18N_MAX_ITEMS: 'many' })).toThrow(/I18N_MAX_ITEMS/);
  });

  it('--dry-run は上限を超える計画でも書き込まずに警告だけ出す', async () => {
    repo = await createTempRepo({ 'blog/ja/a.md': JA_BLOG, 'blog/ja/b.md': JA_BLOG });
    const result = await runCli(repo.root, ['--write', '--dry-run', '--langs', 'en'], {
      env: { I18N_MAX_ITEMS: '1' },
    });
    expect(result.code).toBe(0);
    expect(result.created).toBe(0);
    expect(result.out.text()).toContain('(dry-run) 翻訳が必要な件数 2 件が上限 1 件');
  });
});
