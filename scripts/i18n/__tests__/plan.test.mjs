// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { parseDocument } from '../frontmatter.mjs';
import { computeSourceHash } from '../hash.mjs';
import { buildPlan, changedTargets, classify, targetsFromPaths } from '../plan.mjs';
import { createTempRepo, JA_BLOG } from './helpers.mjs';

const source = parseDocument(JA_BLOG);
const currentHash = computeSourceHash('blog', source.data, source.body);

/** ja からコピーすべきフィールドを揃えた「正しい」翻訳（hash は引数で変える）。 */
function translation({ hash, drift = false, lang = 'en' } = {}) {
  const data = {
    ...source.data,
    title: 'Test post',
    description: 'Description. See https://example.com/docs',
    image: { url: source.data.image.url, alt: 'Test image' },
    lang,
    ...(drift ? { featured: false } : {}),
    ...(hash === undefined
      ? {}
      : {
          translationSourceHash: hash,
          translatedAt: '2026-09-01T00:00:00.000Z',
          translationModel: 'm',
        }),
  };
  return { data, body: '## Intro\n' };
}

describe('classify — F1 truth table (ja × translation file × hash × copied fields)', () => {
  // ja あり/なし × 翻訳ファイルあり/なし × ハッシュ（なし / 一致 / 不一致）× コピー対象の一致
  const rows = [
    { ja: true, file: false, hash: '-', copied: '-', expected: 'missing' },
    { ja: true, file: true, hash: 'none', copied: '-', expected: 'untracked' },
    { ja: true, file: true, hash: 'match', copied: 'same', expected: 'ok' },
    { ja: true, file: true, hash: 'match', copied: 'drift', expected: 'meta-drift' },
    { ja: true, file: true, hash: 'mismatch', copied: 'same', expected: 'stale' },
    { ja: true, file: true, hash: 'mismatch', copied: 'drift', expected: 'stale' },
    { ja: false, file: true, hash: 'match', copied: '-', expected: 'orphan' },
    { ja: false, file: true, hash: 'none', copied: '-', expected: 'orphan' },
    { ja: false, file: false, hash: '-', copied: '-', expected: null },
  ];
  const hashFor = { none: undefined, match: currentHash, mismatch: 'f'.repeat(64), '-': undefined };

  it.each(rows)(
    'ja=$ja file=$file hash=$hash copied=$copied → $expected',
    ({ ja, file, hash, copied, expected }) => {
      const target = file ? translation({ hash: hashFor[hash], drift: copied === 'drift' }) : null;
      const verdict = classify({
        collection: 'blog',
        lang: 'en',
        source: ja ? source : null,
        target,
      });
      expect(verdict?.status ?? null).toBe(expected);
    }
  );

  it('treats a wrong lang as meta-drift even when the hash matches', () => {
    const target = translation({ hash: currentHash, lang: 'ja' });
    expect(classify({ collection: 'blog', lang: 'en', source, target })).toEqual({
      status: 'meta-drift',
      reason: 'lang=ja',
    });
  });

  it('reports unreadable files as invalid (translation) or source-error (ja)', () => {
    expect(
      classify({ collection: 'blog', lang: 'en', source, target: { error: 'bad yaml' } }).status
    ).toBe('invalid');
    expect(
      classify({ collection: 'blog', lang: 'en', source: { error: 'bad yaml' }, target: null })
        .status
    ).toBe('source-error');
  });

  it('does not count translated fields (title, image.alt) or blog tags as drift', () => {
    const target = translation({ hash: currentHash });
    expect(classify({ collection: 'blog', lang: 'en', source, target }).status).toBe('ok');
  });
});

describe('buildPlan (filesystem)', () => {
  let repo;
  afterEach(async () => repo?.cleanup());

  it('lists missing translations per language and orphans whose ja was deleted', async () => {
    repo = await createTempRepo({
      'blog/ja/alpha.md': JA_BLOG,
      'blog/en/alpha.md': JA_BLOG.replace('lang: "ja"', 'lang: "en"'),
      'blog/en/deleted-in-ja.md': JA_BLOG.replace('lang: "ja"', 'lang: "en"'),
    });
    const { items, sourceCounts } = await buildPlan({
      root: repo.root,
      collections: ['blog'],
      langs: ['en', 'zh'],
      only: null,
    });
    const view = items.map((i) => `${i.slug}:${i.lang}:${i.status}`).sort();
    expect(view).toEqual(['alpha:en:untracked', 'alpha:zh:missing', 'deleted-in-ja:en:orphan']);
    expect(sourceCounts).toEqual({ blog: 1 });
  });

  it('limits the plan with only (slug or collection/slug)', async () => {
    repo = await createTempRepo({ 'blog/ja/alpha.md': JA_BLOG, 'blog/ja/beta.md': JA_BLOG });
    const plan = await buildPlan({
      root: repo.root,
      collections: ['blog'],
      langs: ['en'],
      only: new Set(['blog/beta']),
    });
    expect(plan.items.map((i) => i.slug)).toEqual(['beta']);
  });
});

describe('--since targets', () => {
  it('maps changed content paths (any language) to collection/slug and ignores other files', () => {
    const targets = targetsFromPaths([
      'src/content/blog/ja/alpha.md',
      'src/content/blog/en/alpha.md',
      'src/content/cases/zh/grift.md',
      'src/content/config.ts',
      'src/content/unknown/ja/x.md',
      'README.md',
    ]);
    expect([...targets].sort()).toEqual(['blog/alpha', 'cases/grift']);
  });

  it('rejects file names that are not safe slugs', () => {
    expect(() => targetsFromPaths(['src/content/blog/ja/bad name.md'])).toThrow(
      /扱えないファイル名/
    );
  });

  it('asks git for a merge-base diff without renames (deleted ja files stay visible)', () => {
    const seen = [];
    const runGit = (_cwd, args) => {
      seen.push(args);
      return 'src/content/blog/ja/alpha.md\0src/content/news/ja/old.md\0';
    };
    const targets = changedTargets({ root: '/repo', since: 'abc123', runGit });
    expect(seen[0]).toEqual([
      'diff',
      '--name-only',
      '--no-renames',
      '-z',
      'abc123...HEAD',
      '--',
      'src/content',
    ]);
    expect([...targets]).toEqual(['blog/alpha', 'news/old']);
  });
});
