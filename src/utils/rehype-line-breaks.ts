/**
 * Markdown の本文に、文と塊の印（span.lb-sentence / span.lb-clause）を付ける rehype の部品。
 * 決まりは docs/design/layout-rules.md の R1。文字は 1 字も変えない（印と class だけを足す）。
 *
 * 対象: src/content/{blog,news,cases}/<言語>/** の本文の p・li（直下の文）・h1〜h3。
 * 言語は file の path から決める（rehype-contact-links.ts と同じ決め方）。
 * 日本語と中国語は文と塊、ほかの言語は題の塊だけ。
 *
 * 飛ばす物: pre・code（code block）・table・数式（rehype-katex の出力）・link card
 * （remark-link-card-plus の出力）・画像だけの段落・題の後ろの見出しの link（heading-link）・
 * 脚注の一覧。a・strong・em・行の中の code は 1 つの塊の中の割れない部品として扱う。
 * 段落の中の <br> は残し、その位置で印を区切る（CSS の .lb-sentence + br で二重の空行を消す）。
 * 書き手が手で入れた改行（<br>）を持つ題は、そのままにして印を付けない。
 */
import { groupClauses, groupSentences, isCjkLocale, type InlinePart } from './line-breaks';

type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  value?: string;
};
type AstroVFile = { path?: string; history?: string[] };

const CONTENT_FILE = /[\\/]src[\\/]content[\\/](blog|news|cases)[\\/](ja|en|zh|ko|es)[\\/].+\.mdx?$/;
const HEADINGS = new Set(['h1', 'h2', 'h3']);
const BLOCKS = new Set(['p', 'div', 'ul', 'ol', 'table', 'pre', 'blockquote', 'figure', 'section', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
// 中に印を付けない入れ物。link card は外側の div、脚注は section、数式の表示は katex-display。
const SKIP_CLASSES = ['remark-link-card-plus', 'katex-display', 'math-display', 'footnotes'];

/** content の file の path から、その記事の言語。対象の外なら null */
export function lineBreakLocaleOf(filePath: string | undefined): string | null {
  const match = filePath?.match(CONTENT_FILE);
  return match ? match[2] : null;
}

function classesOf(node: HastNode): string[] {
  const value = node.properties?.className;
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') return value.split(/\s+/);
  return [];
}

function hasClass(node: HastNode, prefix: string): boolean {
  return classesOf(node).some((name) => name === prefix || name.startsWith(`${prefix}__`) || name.startsWith(`${prefix}-`));
}

function isElement(node: HastNode, tagName?: string): boolean {
  return node.type === 'element' && (tagName === undefined || node.tagName === tagName);
}

function textOf(node: HastNode): string {
  if (node.type === 'text') return node.value ?? '';
  return (node.children ?? []).map(textOf).join('');
}

function isSkippedContainer(node: HastNode): boolean {
  if (!isElement(node)) return false;
  if (node.tagName === 'pre' || node.tagName === 'code' || node.tagName === 'table') return true;
  if (node.tagName === 'math') return true;
  if (SKIP_CLASSES.some((name) => hasClass(node, name))) return true;
  if (node.properties?.dataFootnotes !== undefined) return true;
  return false;
}

function isHeadingLink(node: HastNode): boolean {
  return isElement(node, 'a') && classesOf(node).includes('heading-link');
}

function isImageOnly(children: readonly HastNode[]): boolean {
  let images = 0;
  for (const child of children) {
    if (child.type === 'comment') continue;
    if (child.type === 'text') {
      if ((child.value ?? '').trim() !== '') return false;
      continue;
    }
    if (isElement(child, 'img')) {
      images += 1;
      continue;
    }
    return false;
  }
  return images > 0;
}

function hasBr(children: readonly HastNode[]): boolean {
  return children.some((child) => (isElement(child, 'br') ? true : hasBr(child.children ?? [])));
}

function hasBlockChild(node: HastNode): boolean {
  return (node.children ?? []).some((child) => isElement(child) && BLOCKS.has(child.tagName ?? ''));
}

type Item =
  | { kind: 'text'; text: string }
  | { kind: 'node'; node: HastNode; text: string }
  | { kind: 'raw'; node: HastNode };

const MARK = '\uE000';

function collect(children: readonly HastNode[], items: Item[]): void {
  for (const child of children) {
    if (child.type === 'text') {
      if ((child.value ?? '') !== '') items.push({ kind: 'text', text: child.value ?? '' });
      continue;
    }
    if (!isElement(child)) continue;
    if (child.tagName === 'br') {
      items.push({ kind: 'raw', node: child });
      continue;
    }
    // 文字を持たない部品（画像など）は、その位置で印を区切って素のまま残す。
    const text = textOf(child);
    if (text.length === 0) {
      items.push({ kind: 'raw', node: child });
      continue;
    }
    items.push({ kind: 'node', node: child, text });
  }
}

function spanNode(className: string, children: HastNode[]): HastNode {
  return {
    type: 'element',
    tagName: 'span',
    properties: { className: [className] },
    children,
  };
}

function textNode(value: string): HastNode {
  return { type: 'text', value };
}

/** 印を付ける前の文字（子の text を繋いだ物）と、付けた後の文字が同じかを見るための関数。 */
export function textContent(node: HastNode): string {
  if (node.type === 'text') return node.value ?? '';
  return (node.children ?? []).map(textContent).join('');
}

function renderRun(items: readonly Item[], locale: string, mode: 'sentences' | 'clauses'): HastNode[] {
  const parts: InlinePart[] = [];
  const nodes = new Map<string, HastNode>();
  for (const item of items) {
    if (item.kind === 'text') {
      parts.push({ text: item.text });
    } else if (item.kind === 'node') {
      const marker = `${MARK}${nodes.size}${MARK}`;
      // 文字数だけを合わせた placeholder。区切りの文字を含めないので、この中では切れない。
      parts.push({ text: 'x'.repeat(item.text.length), href: marker });
      nodes.set(marker, item.node);
    }
  }
  if (parts.length === 0) return items.map((item) => (item.kind === 'raw' ? item.node : item.kind === 'text' ? textNode(item.text) : item.node));

  const renderPart = (part: InlinePart): HastNode => {
    if (part.href && nodes.has(part.href)) return nodes.get(part.href) as HastNode;
    return textNode(part.text);
  };

  if (mode === 'sentences') {
    return groupSentences(parts, locale).map((sentence) =>
      spanNode(
        'lb-sentence',
        sentence.map((clause) => spanNode('lb-clause', clause.map(renderPart))),
      ),
    );
  }
  return groupClauses(parts, locale).map((clause) => spanNode('lb-clause', clause.map(renderPart)));
}

function renderChildren(children: readonly HastNode[], locale: string, mode: 'sentences' | 'clauses'): HastNode[] {
  const items: Item[] = [];
  collect(children, items);
  const result: HastNode[] = [];
  let run: Item[] = [];
  const flush = () => {
    if (run.length === 0) return;
    // 空白だけの run は包まない（包むと行の頭の空白の扱いが変わる）。
    const hasText = run.some((item) => item.kind === 'text' && item.text.trim() !== '');
    if (!hasText) {
      result.push(...run.map((item) => (item.kind === 'text' ? textNode(item.text) : item.node)));
    } else {
      result.push(...renderRun(run, locale, mode));
    }
    run = [];
  };
  for (const item of items) {
    if (item.kind === 'raw') {
      flush();
      result.push(item.node);
    } else {
      run.push(item);
    }
  }
  flush();
  return result;
}

function transform(node: HastNode, locale: string): void {
  const children = node.children ?? [];
  const cjk = isCjkLocale(locale);

  if (isElement(node) && HEADINGS.has(node.tagName ?? '')) {
    // 手で入れた <br> を持つ題は、そのまま使う（印を重ねない）。
    if (hasBr(children)) return;
    const keep = children.filter((child) => !isHeadingLink(child));
    const tail = children.filter(isHeadingLink);
    node.children = [...renderChildren(keep, locale, 'clauses'), ...tail];
    return;
  }

  if (isElement(node) && (node.tagName === 'p' || node.tagName === 'li')) {
    if (cjk && !isImageOnly(children)) {
      if (node.tagName === 'li' && hasBlockChild(node)) {
        // 中に p などを含む li は、li 自身を包まず中の p を変換する。
      } else {
        node.children = renderChildren(children, locale, 'sentences');
        return;
      }
    }
  }

  for (const child of children) {
    if (!isElement(child)) continue;
    if (isSkippedContainer(child)) continue;
    transform(child, locale);
  }
}

/** unified の Transformer に代入できるよう引数は unknown で受ける（hast / vfile の型に依存しない） */
export function rehypeLineBreaks() {
  return (tree: unknown, file: unknown): void => {
    const vfile = file as AstroVFile;
    const locale = lineBreakLocaleOf(vfile.path ?? vfile.history?.[0]);
    if (!locale) return;
    transform(tree as HastNode, locale);
  };
}
