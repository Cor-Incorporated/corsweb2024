// @vitest-environment node
/**
 * ブログ記事の安全性（ADR-0018・#329 の PoC。CMS などから入る stored XSS の対策）。
 *
 * 記事をサイトと同じ Markdown パイプライン（@astrojs/markdown-remark ＋ astro.config.mjs の markdown 設定。
 * 外部の URL を取りに行く remark-link-card-plus だけ外す）で HTML まで描画し、HTML パーサー（parse5）で
 * 読み直した木（hast）を検査する。書き方（参照リンク・文字参照・複数行のタグ・SVG のアニメーション・
 * CommonMark のコードの規則）に依らず、閲覧者のブラウザでスクリプトが動く形になったものを違反にする。
 *
 * 違反: on〜 属性 / URL を取る属性（href・src・xlink:href・action・formaction・values・from・to・by）で
 * http(s)・mailto・相対のどれでもないもの / srcdoc / script・iframe・object・embed・base・form・meta・link・style
 * などの要素 / svg・math 要素（KaTeX が数式から出力する .katex の中だけは許す。中の属性は検査する）。
 * 範囲外: 見た目だけの改ざん（class・インラインの style 属性）、外部画像の読み込み（https）。
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createMarkdownProcessor, type AstroMarkdownOptions } from '@astrojs/markdown-remark';
import matter from 'gray-matter';
import { fromHtml } from 'hast-util-from-html';
import type { Element, Root, RootContent } from 'hast';
import { beforeAll, describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const BLOG_DIR = path.join(ROOT, 'src/content/blog');
const BLOG_IMAGES_DIR = path.join(ROOT, 'public/images/blog');

const BANNED_ELEMENTS = new Set(
  [
    'script',
    'iframe',
    'frame',
    'frameset',
    'object',
    'embed',
    'applet',
    'portal',
    'base',
    'form',
  ].concat(['meta', 'link', 'style', 'svg', 'math'])
);
const KATEX_ONLY = new Set(['svg', 'math']);
const URL_PROPERTIES = new Set([
  'href',
  'src',
  'xlinkhref',
  'action',
  'formaction',
  'from',
  'to',
  'by',
]);
const SAFE_SCHEMES = new Set(['http', 'https', 'mailto']);

// URL Standard と同じく、前後の空白・制御文字を除き、途中のタブと改行を無視してからスキームを読む。
const schemeOf = (value: string): string | null => {
  const cleaned = value.replace(/^[\u0000- ]+|[\u0000- ]+$/g, '').replace(/[\t\n\r]/g, '');
  return /^([a-z][a-z0-9+.-]*):/i.exec(cleaned)?.[1].toLowerCase() ?? null;
};
const isUnsafeUrl = (value: string) => {
  const scheme = schemeOf(value);
  return scheme !== null && !SAFE_SCHEMES.has(scheme);
};

const classesOf = (element: Element) => [element.properties?.className ?? []].flat().map(String);
const textOf = (value: unknown) => [value].flat().map(String).join(' ');

function checkElement(element: Element, insideKatex: boolean): string[] {
  const tag = element.tagName.toLowerCase();
  const found: string[] = [];
  if (BANNED_ELEMENTS.has(tag) && !(KATEX_ONLY.has(tag) && insideKatex))
    found.push(`<${tag}> 要素`);
  for (const [name, value] of Object.entries(element.properties ?? {})) {
    const key = name.toLowerCase();
    const text = textOf(value);
    if (key.startsWith('on')) found.push(`<${tag}> の ${name} 属性`);
    else if (key === 'srcdoc') found.push(`<${tag}> の srcdoc 属性`);
    else if (URL_PROPERTIES.has(key) && isUnsafeUrl(text)) found.push(`<${tag} ${name}="${text}">`);
    else if (key === 'values' && text.split(';').some(isUnsafeUrl))
      found.push(`<${tag} values="${text}">`);
  }
  return found;
}

/** 描画結果の木を歩いて違反を集める */
function checkTree(tree: Root): string[] {
  const walk = (nodes: RootContent[], insideKatex: boolean): string[] =>
    nodes.flatMap((node) => {
      if (node.type !== 'element') return [];
      const katex = insideKatex || classesOf(node).includes('katex');
      return [...checkElement(node, insideKatex), ...walk(node.children, katex)];
    });
  return walk(tree.children, false);
}

type Render = (markdown: string) => Promise<string[]>;
let render: Render;

beforeAll(async () => {
  const configUrl = pathToFileURL(path.join(ROOT, 'astro.config.mjs')).href;
  const { default: config } = (await import(configUrl)) as {
    default: { markdown: AstroMarkdownOptions };
  };
  const pluginName = (plugin: unknown) => (Array.isArray(plugin) ? plugin[0] : plugin);
  const processor = await createMarkdownProcessor({
    ...config.markdown,
    remarkPlugins: (config.markdown.remarkPlugins ?? []).filter(
      (plugin) => pluginName(plugin) !== 'remark-link-card-plus'
    ),
  });
  render = async (markdown) => {
    const { code } = await processor.render(markdown);
    return checkTree(fromHtml(code, { fragment: true }));
  };
}, 60_000);

const walkFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walkFiles(path.join(dir, entry.name)) : [path.join(dir, entry.name)]
  );
const relative = (file: string) => path.relative(ROOT, file).split(path.sep).join('/');

function checkImageFiles(files: string[]): string[] {
  return files
    .filter((file) => /\.svgz?$/i.test(file))
    .map(
      (file) => `${file}: SVG は置かない（スクリプトを含められる。CMS の accept でも外している）`
    );
}

describe('ブログ記事の安全性（描画結果で判定する stored XSS 対策）', () => {
  it('サイトと同じ @astrojs/markdown-remark を使っている（astro が別の版を持っていない）', () => {
    const version = (file: string) =>
      (JSON.parse(readFileSync(path.join(ROOT, file), 'utf8')) as { version: string }).version;
    const astroWants = (
      JSON.parse(readFileSync(path.join(ROOT, 'node_modules/astro/package.json'), 'utf8')) as {
        dependencies: Record<string, string>;
      }
    ).dependencies['@astrojs/markdown-remark'];
    expect(
      `test ${version('node_modules/@astrojs/markdown-remark/package.json')} / astro ${astroWants}`
    ).toBe(`test ${astroWants} / astro ${astroWants}`);
  });

  // 2026-09-28 時点で ja 20 件、en / zh / ko / es 各 10 件の計 60 件。<iframe> は 0 件だった。
  it('全記事（5 言語）の描画結果に、スクリプトを動かせる要素・属性・URL が無い', async () => {
    const posts = walkFiles(BLOG_DIR).filter((file) => /\.mdx?$/.test(file));
    expect(posts.length).toBeGreaterThan(0);
    const violations = await Promise.all(
      posts.map(async (file) =>
        (await render(matter(readFileSync(file, 'utf8')).content)).map(
          (v) => `${relative(file)}: ${v}`
        )
      )
    );
    expect(violations.flat()).toEqual([]);
  }, 60_000);

  it('public/images/blog に SVG が無い', () => {
    expect(checkImageFiles(walkFiles(BLOG_IMAGES_DIR).map(relative))).toEqual([]);
  });
});

describe('F3 変異: 行単位の正規表現をすり抜けた書き方も、描画結果で落ちる', () => {
  // #342 のレビューで、旧版（行単位の正規表現）をすり抜けると確かめられた 8 通り（4 は Markdown と HTML の 2 形）。
  const bypasses: Array<[string, string, RegExp]> = [
    ['1 参照リンクの定義', '[x]\n\n[x]: javascript:alert(1)\n', /<a href="javascript:alert\(1\)">/],
    ['2 リンク先の文字参照', '[x](&#106;avascript:alert(1))\n', /<a href="javascript:/],
    [
      '3 a 要素の href の文字参照',
      '<a href="&#106;avascript:alert(1)">x</a>\n',
      /<a href="javascript:/,
    ],
    ['4a &colon;（Markdown）', '[x](javascript&colon;alert(1))\n', /<a href="javascript:/],
    ['4b &colon;（HTML）', '<a href="javascript&colon;alert(1)">x</a>\n', /<a href="javascript:/],
    [
      // 開きが 1 個・閉じが 2 個なのでコードにならない（旧版は ` から次の ` までをコードとみなして読み飛ばした）
      '5 バッククォートの数が合わないインラインコード',
      '` <img src="x" onerror="alert(1)"> ``\n',
      /onError/,
    ],
    [
      '6 info string にバッククォートを含むフェンス',
      '```js`\n<script>alert(1)</script>\n```\n',
      /<script> 要素/,
    ],
    ['7 複数行の img', '<img\n  src="x"\n  onerror="alert(1)">\n', /onError/],
    [
      '8 SVG の animate',
      '<svg><a><animate attributeName="href" values="javascript:alert(1)" /><text x="20" y="20">X</text></a></svg>\n',
      /values="javascript:alert\(1\)"/,
    ],
  ];

  it.each(bypasses)('%s', async (_name, markdown, expected) => {
    const violations = (await render(markdown)).join('\n');
    expect(violations).toMatch(expected);
  });

  it('KaTeX の外に書いた svg / math は落ち、KaTeX の中の SVG でも危険な属性は落ちる', async () => {
    expect((await render('<math><mi>x</mi></math>\n')).join('\n')).toContain('<math> 要素');
    const disguised =
      '<span class="katex"><svg><set attributeName="href" to="javascript:alert(1)" /></svg></span>\n';
    expect((await render(disguised)).join('\n')).toContain('<set to="javascript:alert(1)">');
  });

  it('コード例の中の <script> と、https・mailto・相対リンク・KaTeX の数式は落ちない', async () => {
    const safe = [
      '```html\n<script>alert(1)</script>\n```\n',
      '`<script>` と ``<img onerror=x>`` は表示されるだけ\n',
      '[a](https://cor-jp.com/) [b](mailto:company@cor-jp.com) [c](/blog/) [d](#top)\n',
      '$$\n\\sqrt{x^2}\n$$\n\n文中の $a+b$ も\n',
    ];
    for (const markdown of safe) expect(await render(markdown)).toEqual([]);
  });

  it('public/images/blog に SVG を置く', () => {
    expect(checkImageFiles(['public/images/blog/x.svg', 'public/images/blog/y.avif'])).toEqual([
      'public/images/blog/x.svg: SVG は置かない（スクリプトを含められる。CMS の accept でも外している）',
    ]);
  });
});
