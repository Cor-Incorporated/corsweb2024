/**
 * Markdown の「訳してはいけない部分」をプレースホルダで保護し、翻訳後に完全復元する。
 *
 * 保護するもの（ブロック = 1 行の ⟦Bn⟧、インライン = ⟦Pn⟧、社名 = ⟦Nn⟧）:
 *   ブロック: フェンスコード（``` / ~~~）、$ 数式、HTML ブロック・コメント、
 *             URL だけの行（remark-link-card-plus のリンクカード）、参照リンク定義
 *   インライン: インラインコード、$ 数式、<autolink>、インライン HTML、
 *             リンク・画像の宛先（テキスト / alt / "title" は訳す）、参照ラベル、脚注、{#id}、裸 URL
 *   社名: 「Cor.株式会社」とその表記ゆれ（glossary.mjs）。復元時に翻訳先言語の正式表記へ置き換える
 *
 * analyze() は同じ走査で構造メトリクス（見出し数・コードブロック・リンク・画像…）を数える。
 * 翻訳の前後を同じ関数で数えるので、保護と検証の判定がずれない。
 */
import { endsWithPeriod, organizationName, SOURCE_NAME_PATTERN } from './glossary.mjs';
import { normalizeNewlines } from './util.mjs';

export const TOKEN_RE = /⟦([PBN])(\d+)⟧/g;
export const TOKEN_ANY_RE = /⟦[PBN]\d+⟧/g;
const ORG_TOKEN_PERIOD_RE = /(⟦N(\d+)⟧)\.(?!\.)/g;
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
// 宛先（URL・パス）だけを保護し、title（"..." / '...' / (...)）は訳す対象に残す。
const INLINE_LINK_RE = new RegExp(
  String.raw`(!?\[${LINK_TEXT}\])\(([ \t]*)(${LINK_DEST})(${LINK_TITLE})([ \t]*)\)`,
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
  s = s.replace(INLINE_LINK_RE, (_m, head, lead, dest, title, trail) => {
    const token = dest ? put(head.startsWith('!') ? 'image-dest' : 'link-dest')(dest) : '';
    return `${head}(${lead}${token}${title}${trail})`;
  });
  s = s.replace(REF_LINK_RE, (_m, label) => `]${put('ref-label')(label)}`);
  s = s.replace(FOOTNOTE_RE, put('footnote'));
  s = s.replace(HEADING_ID_RE, put('heading-id'));
  s = s.replace(BARE_URL_RE, (url) => {
    const { core, tail } = splitUrlTail(url);
    return /^https?:\/\/[A-Za-z0-9]/.test(core) ? put('bare-url')(core) + tail : url;
  });
  // 社名は最後に置き換える（コード・URL などの中にあるものは先にトークン化されているので触らない）
  return s.replace(SOURCE_NAME_PATTERN, put('org-name', 'N'));
}

// ---- 保護と復元 ---------------------------------------------------------------
export class ProtectionError extends Error {}

/**
 * @returns {{ text: string, store: Map<string, { kind: string, original: string }> }}
 *   text は API に送る文字列。store は id（"P3" / "B0" / "N1"）→ 元の文字列。
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
      if (seg.kind === 'text') {
        return protectInline(seg.text, (kind, prefix = 'P') => register(kind, prefix));
      }
      const prefix = seg.text.match(QUOTE_PREFIX_RE)[1];
      return `${prefix}${register(seg.kind, 'B')(seg.text)}`;
    })
    .join('\n');
  return { text, store };
}

/**
 * トークン（入れ子を含む）を元の文字列に戻す。lang を渡すと、社名（org-name）は元の表記ではなく
 * その言語の正式表記にする（翻訳結果の復元）。lang なしは完全な往復（構造の比較・テスト用）。
 */
export function expandTokens(text, store, lang) {
  const valueOf = (token, kind, n) => {
    const entry = store.get(`${kind}${n}`);
    if (!entry) return token;
    return entry.kind === 'org-name' && lang ? organizationName(lang) : entry.original;
  };
  // 正式表記が「.」で終わる言語（en / es の Cor.Inc.）では、社名トークンの直後の文末の「.」を重ねない
  // （「⟦N0⟧.」→「Cor.Inc.」。省略記号の「...」は残す）。#339 最終レビュー LOW-2
  let current =
    lang && endsWithPeriod(lang)
      ? text.replace(ORG_TOKEN_PERIOD_RE, (match, token, n) =>
          store.get(`N${n}`)?.kind === 'org-name' ? token : match
        )
      : text;
  for (let depth = 0; depth < 32 && /⟦[PBN]\d+⟧/.test(current); depth += 1) {
    current = current.replace(TOKEN_RE, valueOf);
  }
  return current;
}

/** 翻訳結果を復元する。ブロックトークンの行は行ごと元のブロックに置き換える（lang は expandTokens と同じ）。 */
export function restore(translated, store, lang) {
  const lines = normalizeNewlines(translated)
    .split('\n')
    .map((line) => {
      const m = line.match(BLOCK_LINE_RE);
      return m && store.has(`B${m[2]}`) ? store.get(`B${m[2]}`).original : line;
    });
  return expandTokens(lines.join('\n'), store, lang);
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
// 空行（引用記号 > だけの行も含む）。これで区切られた連続行を 1 ブロック（段落・リスト・表・見出し…）と数える。
const SEPARATOR_RE = /^(?:[ \t]*>)*[ \t]*$/;
// 箇条書き・番号付きリストの項目（引用内・入れ子を含む）。`*強調*` や `---` は項目ではない。
const LIST_ITEM_RE = /^(?:[ \t]*>)*[ \t]*(?:[-*+]|\d{1,9}[.)])(?:[ \t]+|$)/;

/**
 * 表の行（保護後のテキスト）をセルに分ける。前後の | は外し、\| はセルの区切りに数えない
 * （インラインコードの中の | はトークンになっているので現れない）。
 */
export function splitTableRow(line) {
  let row = line.trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1);
  const cells = [''];
  for (let i = 0; i < row.length; i += 1) {
    if (row[i] === '\\' && i + 1 < row.length) {
      cells[cells.length - 1] += row.slice(i, i + 2);
      i += 1;
    } else if (row[i] === '|') {
      cells.push('');
    } else {
      cells[cells.length - 1] += row[i];
    }
  }
  return cells;
}

/**
 * 保護後のテキストを、訳の前後で 1 対 1 に対応する単位（見出しの行・表のセル・リスト項目・段落）に分ける。
 * リスト項目と段落は、続きの行（空行まで）を含む。行き先の順序の照合（validate.mjs）に使う。
 * @returns {string[]}
 */
export function textUnits(text) {
  const units = [];
  let open = false; // 続きの行を足せる単位（段落・リスト項目）の中か
  for (const line of text.split('\n')) {
    if (SEPARATOR_RE.test(line)) {
      open = false;
    } else if (HEADING_RE.test(line)) {
      units.push(line);
      open = false;
    } else if (TABLE_ROW_RE.test(line)) {
      units.push(...splitTableRow(line));
      open = false;
    } else if (LIST_ITEM_RE.test(line) || !open) {
      units.push(line);
      open = true;
    } else {
      units[units.length - 1] += `\n${line}`;
    }
  }
  return units;
}

/**
 * 構造メトリクス。保護後のテキスト（コード等は 1 行のトークン）で数えるので、コードブロック内の
 * 空行や "- " は数に入らない。kinds は保護対象の種類ごとの元文字列（入れ子展開済み）。
 * tableCells は表の各行（見出し行・区切り行・本文の行）のセルの数を、文書の順に並べたもの。
 * @returns {{ headings: number[], tableRows: number, tableCells: number[], textBlocks: number,
 *            listItems: number, kinds: Record<string, string[]> }}
 */
export function analyze(markdown) {
  const { text, store } = protect(markdown);
  const kinds = {};
  for (const { kind, original } of store.values()) {
    kinds[kind] = [...(kinds[kind] ?? []), expandTokens(original, store)];
  }
  const headings = [0, 0, 0, 0, 0, 0];
  let tableRows = 0;
  const tableCells = [];
  let textBlocks = 0;
  let listItems = 0;
  let inBlock = false;
  for (const line of text.split('\n')) {
    if (SEPARATOR_RE.test(line)) {
      inBlock = false;
      continue;
    }
    if (!inBlock) textBlocks += 1;
    inBlock = true;
    const h = line.match(HEADING_RE);
    if (h) headings[h[1].length - 1] += 1;
    if (TABLE_ROW_RE.test(line)) {
      tableRows += 1;
      tableCells.push(splitTableRow(line).length);
    }
    if (LIST_ITEM_RE.test(line)) listItems += 1;
  }
  return { headings, tableRows, tableCells, textBlocks, listItems, kinds };
}
