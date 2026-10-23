// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { describe, expect, it } from 'vitest';
import { extractArticleSources, isSourcesHeading, remarkArticleSources, type ArticleCitation } from '../remark-article-sources';

// Astro の Markdown パイプラインと同じく remark-parse + remark-gfm で解析し、プラグインの結果を見る。
function run(markdown: string): { citations: ArticleCitation[]; tree: unknown } {
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkArticleSources);
  const file = { data: { astro: { frontmatter: { title: 'keep' } } } };
  const tree = processor.runSync(processor.parse(markdown), file as never);
  return { citations: (file.data.astro.frontmatter as unknown as { citations: ArticleCitation[] }).citations, tree };
}

const SOURCES = '- [IBM: Cost of a Data Breach Report](https://www.ibm.com/reports/data-breach) - 説明\n- [OWASP](https://owasp.org/) - 説明\n';

describe('isSourcesHeading: 5 言語の見出し', () => {
  it.each([
    ['参考資料', true],
    ['参考リンク', true],
    ['出典', true],
    ['References', true],
    ['Reference links', true],
    ['Sources', true],
    ['参考资料', true],
    ['参考链接', true],
    ['참고 자료', true],
    ['참고자료', true],
    ['출처', true],
    ['Referencias', true],
    ['Fuentes', true],
    ['Enlaces de referencia', true],
    ['よくある質問', false],
    ['参考になった点', false],
    ['Source code', false],
    ['Resources for teams', false],
  ])('%j → %s', (text, expected) => {
    expect(isSourcesHeading(text)).toBe(expected);
  });
});

describe('remarkArticleSources', () => {
  it('collects the links of the sources list and keeps the other frontmatter keys', () => {
    const { citations } = run(`## 本文\n\n本文の[リンク](https://example.com/body)\n\n## 参考資料\n\n${SOURCES}`);
    expect(citations).toEqual([
      { name: 'IBM: Cost of a Data Breach Report', url: 'https://www.ibm.com/reports/data-breach' },
      { name: 'OWASP', url: 'https://owasp.org/' },
    ]);
  });

  it('uses only the last sources heading and stops at the next h2', () => {
    const md = `## 参考資料\n\n- [古い](https://old.example/)\n\n## 本文\n\n## 参考資料\n\n${SOURCES}\n## 付録\n\n- [付録](https://appendix.example/)\n`;
    expect(run(md).citations.map((c) => c.url)).toEqual(['https://www.ibm.com/reports/data-breach', 'https://owasp.org/']);
  });

  it('ignores relative links and h3 headings', () => {
    expect(run(`### 参考資料\n\n${SOURCES}`).citations).toEqual([]);
    expect(run('## 参考資料\n\n- [会社概要](/company/)\n').citations).toEqual([]);
  });

  it('returns an empty list when there is no sources section', () => {
    expect(run('## 本文\n\n[リンク](https://example.com)\n').citations).toEqual([]);
  });

  it('marks the heading and the list with data attributes', () => {
    const tree = { type: 'root', children: [] as unknown[] };
    const parsed = unified().use(remarkParse).parse(`## 参考資料\n\n${SOURCES}`) as unknown as typeof tree;
    extractArticleSources(parsed as never);
    const [heading, list] = parsed.children as { data?: { hProperties?: Record<string, unknown> } }[];
    expect(heading.data?.hProperties).toEqual({ 'data-article-sources': '' });
    expect(list.data?.hProperties).toEqual({ 'data-article-sources-list': '' });
  });
});

describe('ja の記事の参考資料', () => {
  // 参考資料の節を持つ記事は、出典として 1 件以上のリンクが取れること（見出しの書き方の揺れの検知）
  const dir = path.resolve(__dirname, '../../content/blog/ja');
  const files = readdirSync(dir).filter((f) => f.endsWith('.md'));

  it.each(files)('%s', (file) => {
    const body = readFileSync(path.join(dir, file), 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '');
    // 最後の「## 参考資料」から次の h2 までに、外部 URL へのリンクのリスト項目があるか
    const section = body.split(/^## /m).reverse().find((part) => /^(?:参考資料|参考文献|参考リンク|参考情報|出典)/.test(part));
    const hasListedLinks = section !== undefined && /^\s*[-*+] .*\]\(https?:\/\//m.test(section);
    const { citations } = run(body);
    expect(citations.length > 0).toBe(hasListedLinks);
  });
});
