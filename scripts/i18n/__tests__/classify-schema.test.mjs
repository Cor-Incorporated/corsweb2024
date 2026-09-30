// @vitest-environment node
/**
 * PR #339 Codex 指摘（P2）の反証テスト: 分類の時点で ja と翻訳の frontmatter を Zod ミラーで検証する。
 *   - ja の frontmatter がスキーマ違反（未知の category 等）→ source-error。API を呼ばない（無駄な課金をしない）
 *   - ハッシュが一致する翻訳でも、必須フィールド欠落などのスキーマ違反 → invalid（--check が通らない）
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseDocument } from '../frontmatter.mjs';
import { computeSourceHash } from '../hash.mjs';
import { classify } from '../plan.mjs';
import { createTempRepo, JA_BLOG, runCli } from './helpers.mjs';

const source = parseDocument(JA_BLOG);
const hash = computeSourceHash('blog', source.data, source.body);

/** ハッシュが一致し、コピー対象も揃った「正しい」翻訳。 */
function tracked(overrides = {}) {
  return {
    data: {
      ...source.data,
      title: 'Test post',
      description: 'Description. See https://example.com/docs',
      image: { url: source.data.image.url, alt: 'Test image' },
      lang: 'en',
      translationSourceHash: hash,
      translatedAt: '2026-09-01T00:00:00.000Z',
      translationModel: 'm',
      ...overrides,
    },
    body: '## Intro\n',
  };
}

const withoutKey = (doc, key) => {
  const { [key]: _removed, ...data } = doc.data;
  return { ...doc, data };
};

describe('classify — frontmatter をスキーマで検証する', () => {
  it('ja の category が未知値なら source-error（理由にフィールド名）', () => {
    const badSource = { ...source, data: { ...source.data, category: 'unknown-category' } };
    const verdict = classify({ collection: 'blog', lang: 'en', source: badSource, target: null });
    expect(verdict.status).toBe('source-error');
    expect(verdict.reason).toMatch(/category/);
  });

  it('ja の必須フィールド（title）欠落も source-error', () => {
    const verdict = classify({
      collection: 'blog',
      lang: 'en',
      source: withoutKey(source, 'title'),
      target: tracked(),
    });
    expect(verdict.status).toBe('source-error');
    expect(verdict.reason).toMatch(/title/);
  });

  it('ハッシュが一致しても、翻訳の必須フィールド（title）が無ければ invalid', () => {
    const verdict = classify({
      collection: 'blog',
      lang: 'en',
      source,
      target: withoutKey(tracked(), 'title'),
    });
    expect(verdict.status).toBe('invalid');
    expect(verdict.reason).toMatch(/title/);
  });

  it('来歴が壊れている（translationModel 欠落）翻訳も invalid', () => {
    const verdict = classify({
      collection: 'blog',
      lang: 'en',
      source,
      target: withoutKey(tracked(), 'translationModel'),
    });
    expect(verdict.status).toBe('invalid');
    expect(verdict.reason).toMatch(/translationModel/);
  });

  it('スキーマを満たす正しい翻訳は ok、来歴の無い正しい旧翻訳は untracked のまま', () => {
    expect(classify({ collection: 'blog', lang: 'en', source, target: tracked() }).status).toBe(
      'ok'
    );
    const legacy = withoutKey(
      withoutKey(withoutKey(tracked(), 'translationSourceHash'), 'translatedAt'),
      'translationModel'
    );
    expect(classify({ collection: 'blog', lang: 'en', source, target: legacy }).status).toBe(
      'untracked'
    );
  });
});

describe('CLI — 分類で弾いたものに API を使わない', () => {
  let repo;
  afterEach(async () => repo?.cleanup());

  it('ja がスキーマ違反なら --write は API クライアントを作らず、何も書かずに失敗する', async () => {
    repo = await createTempRepo({
      'blog/ja/alpha.md': JA_BLOG.replace('category: "lab"', 'category: "unknown-category"'),
    });
    const result = await runCli(repo.root, ['--write', '--langs', 'en']);
    expect(result.code).toBe(1);
    expect(result.created).toBe(0);
    expect(result.client.calls).toHaveLength(0);
    expect(existsSync(path.join(repo.root, 'src/content/blog/en/alpha.md'))).toBe(false);
    expect(result.out.text()).toMatch(/blog\/alpha \[en\]（source-error）/);
  });

  it('ハッシュが一致する翻訳から title を消すと --check が失敗する', async () => {
    repo = await createTempRepo({ 'blog/ja/alpha.md': JA_BLOG });
    expect((await runCli(repo.root, ['--write', '--langs', 'en'])).code).toBe(0);
    const file = path.join(repo.root, 'src/content/blog/en/alpha.md');
    const { readFile, writeFile } = await import('node:fs/promises');
    await writeFile(file, (await readFile(file, 'utf8')).replace(/^title: .*\n/m, ''));
    const check = await runCli(repo.root, ['--check', '--langs', 'en']);
    expect(check.code).toBe(1);
    expect(check.out.text()).toMatch(/\[invalid\] 1 件/);
  });
});
