import { describe, expect, it } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import { lineBreakLocaleOf, rehypeLineBreaks, textContent } from '../rehype-line-breaks';

type Node = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: Node[];
  value?: string;
};

const h = (tagName: string, children: Node[], properties: Record<string, unknown> = {}): Node => ({
  type: 'element',
  tagName,
  properties,
  children,
});

const t = (value: string): Node => ({ type: 'text', value });

function render(markdown: string, path: string): Node {
  const file = { path };
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeKatex)
    .use(rehypeLineBreaks);
  const tree = processor.runSync(processor.parse(markdown), file) as unknown as Node;
  return tree;
}

/** 手で組んだ hast（<br>・heading-link など、markdown の変換では作れない物）に印を付ける。 */
function runTree(tree: Node, path: string): Node {
  rehypeLineBreaks()(tree, { path });
  return tree;
}

function findAll(node: Node, predicate: (node: Node) => boolean, out: Node[] = []): Node[] {
  if (predicate(node)) out.push(node);
  for (const child of node.children ?? []) findAll(child, predicate, out);
  return out;
}

describe('lineBreakLocaleOf', () => {
  it.each([
    ['/repo/src/content/blog/ja/a.md', 'ja'],
    ['/repo/src/content/news/zh/a.mdx', 'zh'],
    ['/repo/src/content/cases/en/a.md', 'en'],
    ['/repo/src/content/blog/ko/a.md', 'ko'],
    ['/repo/src/content/blog/es/a.md', 'es'],
  ])('%s は %s', (path, locale) => {
    expect(lineBreakLocaleOf(path)).toBe(locale);
  });

  it.each(['/repo/src/pages/ja/blog/a.astro', '/repo/src/content/blog/fr/a.md', '/repo/docs/a.md'])(
    '%s は対象の外',
    (path) => {
      expect(lineBreakLocaleOf(path)).toBeNull();
    },
  );
});

describe('rehypeLineBreaks', () => {
  it('日本語の段落を文と塊の span に分け、文字を変えない', () => {
    const markdown = '必要な情報は電子カルテにある。いつも使っている書式もある。';
    const tree = render(markdown, '/repo/src/content/blog/ja/a.md');
    const before = textContent(tree);
    const sentences = findAll(tree, (node) => node.properties?.className?.toString().includes('lb-sentence'));
    expect(sentences).toHaveLength(2);
    expect(textContent(tree)).toBe(before);
    expect(before).toBe(markdown);
  });

  it('link・強調・行の中の code・脚注の印の途中で切らず、文字を変えない', () => {
    const markdown =
      'これは[長い、名前のリンク](/x/)と**強調、の文**と`inline、code`と脚注[^1]です。次の文です。\n\n[^1]: 脚注の文。';
    const tree = render(markdown, '/repo/src/content/blog/ja/a.md');
    const before = textContent(tree);
    expect(textContent(tree)).toBe(before);
    const clauses = findAll(tree, (node) => node.properties?.className?.toString().includes('lb-clause'));
    const linkClause = clauses.find((clause) => findAll(clause, (node) => node.tagName === 'a').length > 0);
    expect(linkClause).toBeDefined();
    expect(findAll(linkClause as Node, (node) => node.tagName === 'a')[0].children?.[0].value).toBe('長い、名前のリンク');
    // 脚注の一覧には印を付けない
    const footnotes = findAll(tree, (node) => node.tagName === 'section' && node.properties?.dataFootnotes !== undefined);
    expect(footnotes).toHaveLength(1);
    expect(findAll(footnotes[0], (node) => node.properties?.className?.toString().includes('lb-sentence'))).toHaveLength(0);
  });

  it('段落の中の <br> を残し、<br> の前で文を終える', () => {
    const tree = runTree(
      h('div', [h('p', [t('一文目です。'), h('br', []), t('二文目です。')])]),
      '/repo/src/content/blog/ja/a.md',
    );
    const br = findAll(tree, (node) => node.tagName === 'br');
    expect(br).toHaveLength(1);
    expect(textContent(tree)).toBe('一文目です。二文目です。');
    // <br> の直前の文は、<br> の手前で閉じている（CSS の .lb-sentence + br が効く形）
    expect(br[0]).toBe(tree.children?.[0].children?.[1]);
  });

  it('表・code block・数式・link card・画像だけの段落には印を付けない', () => {
    const markdown = [
      '| a | b |',
      '| - | - |',
      '| 表の文。 | セル。 |',
      '',
      '```ts',
      'const x = "code。";',
      '```',
      '',
      '$$',
      'a = b。',
      '$$',
      '',
      '![画像](/a.png)',
      '',
      '通常の文です。',
    ].join('\n');
    const tree = render(markdown, '/repo/src/content/blog/ja/a.md');
    const table = findAll(tree, (node) => node.tagName === 'table');
    const pre = findAll(tree, (node) => node.tagName === 'pre');
    const math = findAll(tree, (node) => node.properties?.className?.toString().includes('katex-display'));
    const paragraph = findAll(tree, (node) => node.tagName === 'p' && node.children?.length === 1 && node.children[0].tagName === 'img');
    for (const scope of [...table, ...pre, ...math, ...paragraph]) {
      expect(findAll(scope, (node) => /lb-(sentence|clause)/.test(node.properties?.className?.toString() ?? ''))).toHaveLength(0);
    }
    expect(textContent(tree).replace(/[“”\s]/g, '')).toContain('通常の文です。');
  });

  it('題の後ろの heading-link は残し、題を塊に分ける', () => {
    const tree = runTree(
      h('div', [
        h('h2', [
          t('医療機関のAI導入を、記録の整理と書類づくりから。'),
          h('a', [t('#')], { className: ['heading-link'], href: '#x' }),
        ]),
      ]),
      '/repo/src/content/blog/ja/a.md',
    );
    const heading = findAll(tree, (node) => node.tagName === 'h2')[0];
    const clauses = findAll(heading, (node) => node.properties?.className?.toString().includes('lb-clause'));
    expect(clauses.length).toBeGreaterThanOrEqual(2);
    expect(findAll(clauses[0], (node) => node.properties?.className?.toString().includes('heading-link'))).toHaveLength(0);
    expect(findAll(tree, (node) => node.properties?.className?.toString().includes('heading-link'))).toHaveLength(1);
    expect(textContent(heading)).toBe('医療機関のAI導入を、記録の整理と書類づくりから。#');
  });

  it('手で <br> を入れた題は、そのままにする', () => {
    const tree = runTree(
      h('div', [h('h2', [t('見出しの'), h('br', []), t('途中の改行')])]),
      '/repo/src/content/blog/ja/a.md',
    );
    const heading = findAll(tree, (node) => node.tagName === 'h2')[0];
    expect(findAll(heading, (node) => /lb-(sentence|clause)/.test(node.properties?.className?.toString() ?? ''))).toHaveLength(0);
    expect(findAll(heading, (node) => node.tagName === 'br')).toHaveLength(1);
  });

  it('英語は本文を分けず、題だけ塊に分ける', () => {
    const tree = render('## Reliable AI, from records to documents.\n\nHello. World.', '/repo/src/content/blog/en/a.md');
    const heading = findAll(tree, (node) => node.tagName === 'h2')[0];
    expect(findAll(heading, (node) => node.properties?.className?.toString().includes('lb-clause')).length).toBe(2);
    expect(findAll(tree, (node) => node.properties?.className?.toString().includes('lb-sentence'))).toHaveLength(0);
  });

  it('中国語も文と塊に分ける', () => {
    const tree = render('必要な情報は電子カルテにある。書式もある。', '/repo/src/content/blog/zh/a.md');
    expect(findAll(tree, (node) => node.properties?.className?.toString().includes('lb-sentence')).length).toBeGreaterThanOrEqual(2);
    expect(textContent(tree)).toBe('必要な情報は電子カルテにある。書式もある。');
  });

  // li は、直下の文だけを持つ時は li 自身を包み、中に p や入れ子の list を持つ時は li を包まず
  // 中の p・li を変換する（印を二重にしない）。
  it('li の直下の文・中の p・入れ子の list に、二重にせず印を付ける', () => {
    const isSentence = (node: Node): boolean => node.properties?.className?.toString().includes('lb-sentence') ?? false;
    const directTextList = h('ul', [h('li', [t('直下の文です。次の文です。')])]);
    runTree(directTextList, '/repo/src/content/blog/ja/a.md');
    expect(findAll(directTextList, isSentence)).toHaveLength(2);
    expect(textContent(directTextList)).toBe('直下の文です。次の文です。');

    const paragraphList = h('ul', [h('li', [h('p', [t('段落の文です。')])])]);
    runTree(paragraphList, '/repo/src/content/blog/ja/a.md');
    expect(findAll(paragraphList, isSentence)).toHaveLength(1);
    expect(findAll(paragraphList, (node) => node.tagName === 'p' && findAll(node, isSentence).length === 1)).toHaveLength(1);
    expect(textContent(paragraphList)).toBe('段落の文です。');

    const nestedList = h('ul', [
      h('li', [h('p', [t('外の文です。')]), h('ul', [h('li', [t('入れ子の文です。')])])]),
    ]);
    runTree(nestedList, '/repo/src/content/blog/ja/a.md');
    const sentences = findAll(nestedList, isSentence);
    expect(sentences).toHaveLength(2);
    expect(textContent(sentences[0])).toBe('外の文です。');
    expect(textContent(sentences[1])).toBe('入れ子の文です。');
    // 印の中に印（二重）が無い
    expect(findAll(nestedList, (node) => isSentence(node) && findAll(node, isSentence).length > 1)).toHaveLength(0);
    expect(textContent(nestedList)).toBe('外の文です。入れ子の文です。');
  });
});
