import { describe, expect, it } from 'vitest';
import { rehypeBlogTitle } from '../rehype-blog-title';

type Node = Parameters<ReturnType<typeof rehypeBlogTitle>>[0];

function transform(nodes: Node[], title = "Reader's guide", path = '/site/src/content/blog/en/guide.md') {
  const frontmatter: Record<string, unknown> = { title };
  const children = [...nodes];
  rehypeBlogTitle()({ type: 'root', children }, { path, data: { astro: { frontmatter } } });
  return { children, anchor: frontmatter.articleTitleAnchor };
}
const heading = (text: string, tagName = 'h1'): Node => ({
  type: 'element', tagName, properties: { id: 'published-slug' }, children: [{ type: 'text', value: text }],
});

describe('記事タイトルの固定リンク', () => {
  it('先頭の題をヘッダーに移して元のIDを渡す。引用符の表記はそろえて照合する', () => {
    const whitespace = { type: 'text', value: '\n' };
    const paragraph = { type: 'element', tagName: 'p' };
    const result = transform([whitespace, heading('Reader’s guide'), paragraph]);
    expect(result).toEqual({ anchor: 'published-slug', children: [whitespace, paragraph] });
  });
  const keep: Record<string, Node[]> = {
    '別の題': [heading('A different heading')],
    '第2階層の節': [heading("Reader's guide", 'h2')],
    '本文途中の題': [{ type: 'element', tagName: 'p' }, heading("Reader's guide")],
    '題の中に作者のリンク': [{ ...heading("Reader's guide"), children: [{ type: 'element', tagName: 'a' }] }],
    '既存の別の固定リンク': [heading("Reader's guide"), {type: 'element', tagName: 'p', properties: {id: 'published-slug--text'}}],
  };
  for (const [name, nodes] of Object.entries(keep)) {
    it(name + 'を元の形で残す', () => {
      expect(transform(nodes)).toEqual({ children: nodes, anchor: undefined });
    });
  }
  it('ニュースなど別の文書には適用しない', () => {
    const nodes = [heading("Reader's guide")];
    expect(transform(nodes, "Reader's guide", '/site/src/content/news/en/guide.md')).toEqual({ children: nodes, anchor: undefined });
  });
});
