/**
 * ブログ記事の安全性（ADR-0018・#329 の PoC。CMS から入る stored XSS の対策）。
 *
 * Astro は Markdown 中の生の HTML をそのまま出力し、リンクの URL も検査しない。記事は cor-jp.com
 * （CMS とは別オリジン）で配信されるが、閲覧者のブラウザでスクリプトが動く書き方は入れさせない。
 * CMS の編集者も、Markdown を直接書く人も、同じ PR の必須チェックでここを通る。
 * コードブロックとインラインコードの中は文字として表示されるだけなので対象外にする。
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const BLOG_DIR = path.join(ROOT, 'src/content/blog');
const BLOG_IMAGES_DIR = path.join(ROOT, 'public/images/blog');

// <iframe> を許すホスト（https のみ）。2026-09-28 に既存の 60 記事（ja 20 × 5 言語）を走査した結果、
// <iframe> は 0 件だったので空にしている。埋め込みを使うときは、ここにホストを足す PR をレビューする。
const IFRAME_HOSTS: readonly string[] = [];

const RULES: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: '<script> 要素', pattern: /<script\b/i },
  { name: 'イベントハンドラー属性（on〜=）', pattern: /<[a-z][^>]*\son[a-z]+\s*=/i },
  {
    name: 'スクリプトを動かす URL（javascript: など）',
    pattern:
      /(?:\]\(\s*<?|\b(?:href|src|action|formaction|xlink:href|data)\s*=\s*["']?\s*|<)(?:javascript:|vbscript:|data:text\/html)/i,
  },
  {
    name: '<object> / <embed> / <base> / <form> / <meta http-equiv>',
    pattern: /<(?:object|embed|base|form)\b|<meta\b[^>]*http-equiv/i,
  },
];

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]
  );

// コードブロック（``` / ~~~）とインラインコードを取り除く。行番号が変わらないよう改行は残す。
const stripCode = (markdown: string): string =>
  markdown
    .replace(
      /^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^ {0,3}\1[`~]*[ \t]*$|(?![\s\S]))/gm,
      (block) => block.replace(/[^\n]/g, '')
    )
    .replace(/(`+)[^`\n][^\n]*?\1/g, (code) => code.replace(/[^\n]/g, ' '));

const iframeProblem = (tag: string): string | null => {
  const src = tag.match(/\bsrc\s*=\s*["']?([^"'\s>]+)/i)?.[1];
  try {
    const url = new URL(src ?? '');
    if (url.protocol === 'https:' && IFRAME_HOSTS.includes(url.hostname)) return null;
    return `<iframe> のホスト ${url.protocol}//${
      url.hostname
    } は許可リストに無い（許可: [${IFRAME_HOSTS.join(', ')}]）`;
  } catch {
    return `<iframe> の src を読めない（${src ?? 'なし'}）`;
  }
};

function checkMarkdown(file: string, markdown: string): string[] {
  const lines = stripCode(markdown).split('\n');
  return lines.flatMap((line, index) => {
    const where = `${file}:${index + 1}`;
    const byRule = RULES.filter(({ pattern }) => pattern.test(line)).map(
      ({ name }) => `${where}: ${name} — ${line.trim().slice(0, 80)}`
    );
    const byIframe = [...line.matchAll(/<iframe\b[^>]*>?/gi)]
      .map(([tag]) => iframeProblem(tag))
      .filter((problem): problem is string => problem !== null)
      .map((problem) => `${where}: ${problem}`);
    return [...byRule, ...byIframe];
  });
}

function checkImageFiles(files: string[]): string[] {
  return files
    .filter((file) => /\.svgz?$/i.test(file))
    .map(
      (file) => `${file}: SVG は置かない（スクリプトを含められる。CMS の accept でも外している）`
    );
}

const relative = (file: string) => path.relative(ROOT, file).split(path.sep).join('/');

describe('ブログ記事の安全性（stored XSS）', () => {
  const posts = walk(BLOG_DIR).filter((file) => /\.mdx?$/.test(file));

  it('全記事（5 言語）に、スクリプトを動かせる HTML・URL と、許可していない <iframe> が無い', () => {
    expect(posts.length).toBeGreaterThan(0);
    const violations = posts.flatMap((file) =>
      checkMarkdown(relative(file), readFileSync(file, 'utf8'))
    );
    expect(violations).toEqual([]);
  });

  it('public/images/blog に SVG が無い', () => {
    expect(checkImageFiles(walk(BLOG_IMAGES_DIR).map(relative))).toEqual([]);
  });
});

describe('F3 変異: 危険な書き方を入れると落ちる（コード中は落ちない）', () => {
  const check = (markdown: string) => checkMarkdown('example.md', markdown).join('\n');

  it('<script> を本文に書く / コードブロックの中なら通す', () => {
    expect(check('本文\n<script>alert(1)</script>\n')).toContain('example.md:2: <script> 要素');
    expect(check('```html\n<script>alert(1)</script>\n```\n')).toBe('');
    expect(check('インラインの `<script>` は表示されるだけ')).toBe('');
  });

  it('イベントハンドラー属性を書く', () => {
    expect(check('<img src="x" onerror="alert(1)">')).toContain('イベントハンドラー属性');
  });

  it('javascript: のリンクを書く / 文章中の「JavaScript:」は通す', () => {
    expect(check('[押す](javascript:alert(1))')).toContain('スクリプトを動かす URL');
    expect(check('<a href="javascript:alert(1)">押す</a>')).toContain('スクリプトを動かす URL');
    expect(check('JavaScript: 動的な処理を書く言語')).toBe('');
  });

  it('許可リストに無いホストの <iframe> を書く', () => {
    expect(check('<iframe src="https://evil.example/x"></iframe>')).toContain(
      '<iframe> のホスト https://evil.example は許可リストに無い（許可: []）'
    );
  });

  it('public/images/blog に SVG を置く', () => {
    expect(checkImageFiles(['public/images/blog/x.svg', 'public/images/blog/y.avif'])).toEqual([
      'public/images/blog/x.svg: SVG は置かない（スクリプトを含められる。CMS の accept でも外している）',
    ]);
  });
});
