/**
 * Markdown の「訳してはいけない部分」をプレースホルダで保護し、翻訳後に完全復元する。
 *
 * 保護するもの（ブロック = 1 行の ⟦Bn⟧、インライン = ⟦Pn⟧）:
 *   ブロック: フェンスコード（``` / ~~~）、$$ 数式、HTML ブロック・コメント、
 *             URL だけの行（remark-link-card-plus のリンクカード）、参照リンク定義
 *   インライン: インラインコード、$ 数式、<autolink>、インライン HTML、
 *             リンク・画像の宛先（テキスト / alt は訳す）、参照ラベル、脚注、{#id}、裸 URL
 *
 * analyze() は同じ走査で構造メトリクス（見出し数・コードブロック・リンク・画像…）を数える。
 * 翻訳の前後を同じ関数で数えるので、保護と検証の判定がずれない。
 */
import { normalizeNewlines } from './util.mjs';

export const TOKEN_RE = /⟦([PB])(\d+)⟧/g;
const TOKEN_ANY_RE = /⟦[PB]\d+⟧/g;
const BLOCK_LINE_RE = /^((?:[ \t]*>)*[ \t]*)⟦B(\d+)⟧[ \t]*$/;
const QUOTE_PREFIX_RE = /^((?:[ \t]*>)*[ \t]*)/;

// ---- ブロック検出 -------------------------------------------------------------
const FENCE_OPEN_RE = /^((?:[ \t]*>)*[ \t]*)(`{3,}|~{3,})(.*)$/;
const MATH_OPEN_RE = /^[ \t]*\$\$[^$]*$/;
const MATH_CLOSE_RE = /^(?:[ \t]*>)*[ \t]*\$\$[ \t]*$/;
const HTML_COMMENT_OPEN_RE = /^ {0,3}<!--/;
const HTML_RAW_OPEN_RE = /^ {0,3}<(script|pre|style|textarea)(?=[\s>]|$)/i;
const HTML_BLOCK_TAGS =
  'address|article|aside|audio|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|' +
  'dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|' +
  'legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|picture|search|section|source|' +
  'summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul|video';
const HTML_BLOCK_OPEN_RE = new RegExp(`^ {0,3}</?(?:${HTML_BLOCK_TAGS})(?=[\\s/>]|$)`, 'i');
const HTML_LONE_TAG_RE =
  /^ {0,3}(?:<[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?\/?>|<\/[A-Za-z][A-Za-z0-9-]*\s*>)\s*$/;
const LINK_CARD_RE = /^[ \t]*<?https?:\/\/[^\s<>]+>?[ \t]*$/;
const REF_DEF_RE = /^ {0,3}\[(?!\^)[^\]\n]+\]:[ \t]*\S/;

function indexWhere(lines, from, predicate) {
  for (let j = from; j < lines.length; j += 1) if (predicate(lines[j])) return j;
  return -1;
}

/** 閉じが無ければ文書末尾まで（CommonMark と同じく「開いたまま」扱い）。 */
function untilInclusive(lines, from, predicate) {
  const j = indexWhere(lines, from, predicate);
  return j === -1 ? lines.length : j + 1;
}

function matchFence(lines, i) {
  const m = lines[i].match(FENCE_OPEN_RE);
  if (!m) return null;
  const [, , fence, info] = m;
  if (fence[0] === '`' && info.includes('`')) return null;
  const close = new RegExp(
    `^(?:[ \\t]*>)*[ \\t]*${fence[0] === '`' ? '`' : '~'}{${fence.length},}[ \\t]*$`
  );
  return { kind: 'code-block', end: untilInclusive(lines, i + 1, (l) => close.test(l)) };
}

function matchMath(lines, i) {
  if (!MATH_OPEN_RE.test(lines[i])) return null;
  return { kind: 'math-block', end: untilInclusive(lines, i + 1, (l) => MATH_CLOSE_RE.test(l)) };
}

function matchHtml(lines, i) {
  const line = lines[i];
  if (HTML_COMMENT_OPEN_RE.test(line)) {
    return { kind: 'html-block', end: untilInclusive(lines, i, (l) => l.includes('-->')) };
  }
  const raw = line.match(HTML_RAW_OPEN_RE);
  if (raw) {
    const close = new RegExp(`</${raw[1]}>`, 'i');
    return { kind: 'html-block', end: untilInclusive(lines, i, (l) => close.test(l)) };
  }
  if (HTML_BLOCK_OPEN_RE.test(line) || HTML_LONE_TAG_RE.test(line)) {
    const blank = indexWhere(lines, i + 1, (l) => l.trim() === '');
    return { kind: 'html-block', end: blank === -1 ? lines.length : blank };
  }
  return null;
}

function matchSingleLine(lines, i) {
  if (LINK_CARD_RE.test(lines[i])) return { kind: 'link-card', end: i + 1 };
  if (REF_DEF_RE.test(lines[i])) return { kind: 'ref-def', end: i + 1 };
  return null;
}

/** 本文を「ブロック」と「テキスト行」の列に分ける。 */
export function segment(markdown) {
  const lines = normalizeNewlines(markdown).split('\n');
  const segments = [];
  let i = 0;
  while (i < lines.length) {
    const block =
      matchFence(lines, i) ??
      matchMath(lines, i) ??
      matchHtml(lines, i) ??
      matchSingleLine(lines, i);
    if (block) {
      segments.push({ kind: block.kind, text: lines.slice(i, block.end).join('\n') });
      i = block.end;
    } else {
      segments.push({ kind: 'text', text: lines[i] });
      i += 1;
    }
  }
  return segments;
}

// ---- インライン保護 -----------------------------------------------------------
const LINK_TEXT = String.raw`(?:[^\[\]\\\n]|\\.|\[(?:[^\[\]\\\n]|\\.)*\])*`;
const LINK_DEST = String.raw`(?:<[^<>\n]*>|(?:[^()\s\\]|\\.|\((?:[^()\s\\]|\\.)*\))*)`;
const LINK_TITLE = String.raw`(?:\s+(?:"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|\((?:[^()\\\n]|\\.)*\)))?`;
const INLINE_LINK_RE = new RegExp(
  String.raw`(!?\[${LINK_TEXT}\])(\([ \t]*${LINK_DEST}${LINK_TITLE}[ \t]*\))`,
  'g'
);
const DISPLAY_MATH_INLINE_RE = /\$\$[^$\n]+?\$\$/g;
const INLINE_MATH_RE = /(?<![\\$])\$(?=[^\s$])(?:\\\$|[^$\n])*?[^\s\\$]\$(?![$\d])/g;
const AUTOLINK_RE = /<(?:https?|mailto|ftp):[^<>\s]+>/gi;
const HTML_INLINE_COMMENT_RE = /<!--[\s\S]*?-->/g;
const HTML_INLINE_TAG_RE = /<\/?[A-Za-z][A-Za-z0-9-]*(?:\s+[^<>]*?)?\s*\/?>/g;
const REF_LINK_RE = /\](\[[^\]\n]*\])/g;
const FOOTNOTE_RE = /\[\^[^\]\s]+\]/g;
const HEADING_ID_RE = /\{#[A-Za-z0-9_:.-]+\}/g;
const BARE_URL_RE = /https?:\/\/[A-Za-z0-9\-._~:/?#@!$&'*+,;=%()]+/g;
const URL_TRAILING_PUNCT_RE = /[.,:;!?'*]/;

function isEscaped(text, index) {
  let backslashes = 0;
  for (let j = index - 1; j >= 0 && text[j] === '\\'; j -= 1) backslashes += 1;
  return backslashes % 2 === 1;
}

function runLength(text, index, ch) {
  let j = index;
  while (text[j] === ch) j += 1;
  return j - index;
}

function closingRun(text, from, length) {
  let i = from;
  while (i < text.length) {
    if (text[i] !== '`') {
      i += 1;
    } else {
      const run = runLength(text, i, '`');
      if (run === length) return i;
      i += run;
    }
  }
  return -1;
}

/** CommonMark のコードスパン（バッククォート列の長さ一致、エスケープされた ` は開始しない）。 */
function protectCodeSpans(line, put) {
  let out = '';
  let i = 0;
  while (i < line.length) {
    if (line[i] === '`' && !isEscaped(line, i)) {
      const run = runLength(line, i, '`');
      const close = closingRun(line, i + run, run);
      const end = close === -1 ? i + run : close + run;
      out += close === -1 ? line.slice(i, end) : put(line.slice(i, end));
      i = end;
    } else {
      out += line[i];
      i += 1;
    }
  }
  return out;
}

function countChar(text, ch) {
  return text.split(ch).length - 1;
}

/** GFM の autolink literal と同様に、末尾の句読点と対応の取れない ")" は URL に含めない。 */
function splitUrlTail(url) {
  let end = url.length;
  while (end > 0) {
    const ch = url[end - 1];
    const head = url.slice(0, end);
    const unbalanced = ch === ')' && countChar(head, '(') < countChar(head, ')');
    if (!URL_TRAILING_PUNCT_RE.test(ch) && !unbalanced) break;
    end -= 1;
  }
  return { core: url.slice(0, end), tail: url.slice(end) };
}

function protectInline(line, put) {
  let s = protectCodeSpans(line, put('code-span'));
  s = s.replace(DISPLAY_MATH_INLINE_RE, put('math-inline'));
  s = s.replace(INLINE_MATH_RE, put('math-inline'));
  s = s.replace(AUTOLINK_RE, put('autolink'));
  s = s.replace(HTML_INLINE_COMMENT_RE, put('html-inline'));
  s = s.replace(HTML_INLINE_TAG_RE, put('html-inline'));
  s = s.replace(
    INLINE_LINK_RE,
    (_m, head, dest) => head + put(head.startsWith('!') ? 'image-dest' : 'link-dest')(dest)
  );
  s = s.replace(REF_LINK_RE, (_m, label) => `]${put('ref-label')(label)}`);
  s = s.replace(FOOTNOTE_RE, put('footnote'));
  s = s.replace(HEADING_ID_RE, put('heading-id'));
  return s.replace(BARE_URL_RE, (url) => {
    const { core, tail } = splitUrlTail(url);
    return /^https?:\/\/[A-Za-z0-9]/.test(core) ? put('bare-url')(core) + tail : url;
  });
}

// ---- 保護と復元 ---------------------------------------------------------------
export class ProtectionError extends Error {}

/**
 * @returns {{ text: string, store: Map<string, { kind: string, original: string }> }}
 *   text は API に送る文字列。store は id（"P3" / "B0"）→ 元の文字列。
 */
export function protect(markdown) {
  const source = normalizeNewlines(markdown);
  if (/[⟦⟧]/.test(source))
    throw new ProtectionError('本文に予約文字 ⟦ ⟧ が含まれているため安全に保護できません');
  const store = new Map();
  let counter = 0;
  const register = (kind, prefix) => (original) => {
    const id = `${prefix}${counter}`;
    counter += 1;
    store.set(id, { kind, original });
    return `⟦${id}⟧`;
  };
  const text = segment(source)
    .map((seg) => {
      if (seg.kind === 'text') return protectInline(seg.text, (kind) => register(kind, 'P'));
      const prefix = seg.text.match(QUOTE_PREFIX_RE)[1];
      return `${prefix}${register(seg.kind, 'B')(seg.text)}`;
    })
    .join('\n');
  return { text, store };
}

/** トークン（入れ子を含む）を元の文字列に戻す。 */
export function expandTokens(text, store) {
  let current = text;
  for (let depth = 0; depth < 32 && /⟦[PB]\d+⟧/.test(current); depth += 1) {
    current = current.replace(
      TOKEN_RE,
      (token, kind, n) => store.get(`${kind}${n}`)?.original ?? token
    );
  }
  return current;
}

/** 翻訳結果を復元する。ブロックトークンの行は行ごと元のブロックに置き換える。 */
export function restore(translated, store) {
  const lines = normalizeNewlines(translated)
    .split('\n')
    .map((line) => {
      const m = line.match(BLOCK_LINE_RE);
      return m && store.has(`B${m[2]}`) ? store.get(`B${m[2]}`).original : line;
    });
  return expandTokens(lines.join('\n'), store);
}

/** 文字列中のトークン id を出現順に返す。 */
export function tokenIds(text) {
  return [...text.matchAll(TOKEN_RE)].map((m) => `${m[1]}${m[2]}`);
}

export function stripTokens(text) {
  return text.replace(TOKEN_ANY_RE, ' ');
}

export function isBlockTokenLine(line) {
  return BLOCK_LINE_RE.test(line);
}

// ---- 構造メトリクス -----------------------------------------------------------
const HEADING_RE = /^ {0,3}(#{1,6})(?:[ \t]|$)/;
const TABLE_ROW_RE = /^[ \t]*\|/;

/**
 * 構造メトリクス。kinds は保護対象の種類ごとの元文字列（入れ子展開済み）。
 * @returns {{ headings: number[], tableRows: number, kinds: Record<string, string[]> }}
 */
export function analyze(markdown) {
  const { text, store } = protect(markdown);
  const kinds = {};
  for (const { kind, original } of store.values()) {
    kinds[kind] = [...(kinds[kind] ?? []), expandTokens(original, store)];
  }
  const headings = [0, 0, 0, 0, 0, 0];
  let tableRows = 0;
  for (const line of text.split('\n')) {
    const h = line.match(HEADING_RE);
    if (h) headings[h[1].length - 1] += 1;
    if (TABLE_ROW_RE.test(line)) tableRows += 1;
  }
  return { headings, tableRows, kinds };
}
