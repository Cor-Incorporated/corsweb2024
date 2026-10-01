// @vitest-environment node
/**
 * ブログの frontmatter スキーマ（src/config/blog-schema.ts）が、空のタイトル・概要・カテゴリを止めること。
 *
 * CMS（Sveltia）は、ワークフローのステータスが「下書き」の間は必須項目が空でも保存でき、そのまま PR を作る。
 * 2026-10-01 の通しの確認（PR #367）では、カテゴリと概要が空の記事が保存され、ビルドが category で落ちた。
 * 概要は空でも通っていたので、空・空白だけを止める。
 */
import { describe, expect, it } from 'vitest';
import { blogFrontmatterSchema } from '../blog-schema';

const valid = {
  title: 'CMS 動作確認',
  description: 'CMS の動作確認用の記事です。',
  pubDate: '2026-10-01',
  category: 'lab',
};

const issuesOf = (frontmatter: Record<string, unknown>) => {
  const result = blogFrontmatterSchema.safeParse(frontmatter);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
};

describe('blog の frontmatter スキーマ', () => {
  it('タイトル・概要・公開日・カテゴリがあれば通る', () => {
    expect(issuesOf(valid)).toEqual([]);
  });

  it('2026-10-01 に CMS の下書きで保存された形（カテゴリと概要が空）は、両方とも止める', () => {
    expect(issuesOf({ ...valid, category: '', description: '' })).toEqual(['description', 'category']);
  });

  it.each([
    ['タイトルが空', { title: '' }, ['title']],
    ['タイトルが空白だけ', { title: '   ' }, ['title']],
    ['概要が空', { description: '' }, ['description']],
    ['概要が全角の空白と改行だけ', { description: '　\n' }, ['description']],
  ])('%s', (_, change, paths) => {
    expect(issuesOf({ ...valid, ...change })).toEqual(paths);
  });

  it('エラーのメッセージに空の欄の名前が出る（独自のメッセージには、Astro が欄の名前を付けないため）', () => {
    const result = blogFrontmatterSchema.safeParse({ ...valid, title: '', description: ' ' });
    expect(result.success ? [] : result.error.issues.map((issue) => issue.message)).toEqual([
      'title（タイトル） が空です（CMS では、レビュー中にする前に入れてください）',
      'description（概要） が空です（CMS では、レビュー中にする前に入れてください）',
    ]);
  });

  it('前後の空白は取り除いて受け付ける', () => {
    const parsed = blogFrontmatterSchema.parse({ ...valid, title: '  CMS 動作確認  ' });
    expect(parsed.title).toBe('CMS 動作確認');
  });
});
