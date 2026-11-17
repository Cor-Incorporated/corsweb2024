// 文と塊の区切りを、build の時に決める純粋な関数。
// 決まりは docs/design/layout-rules.md の R1。文字は 1 字も変えず、元の文字を切り出すだけ。
// - 日本語・中国語は「。」「！」「？」で文に分ける。直後の閉じ括弧（」』）)）は前の文に付ける。
// - 日本語は「、」、中国語は「，」「、」の後で塊に分ける。5 字以下の出だしは次の塊と続ける。
// - 英語などの題は「, 」「: 」「 — 」の後で塊に分ける。本文を分けるかは呼び出し側が決める。

export type InlinePart = {
  text: string;
  href?: string;
  external?: boolean;
};

/** 読点までの塊。link は塊の途中で切らない。 */
export type InlineClause = InlinePart[];

/** 文。中に塊を持つ。 */
export type InlineSentence = InlineClause[];

const CJK_LOCALES = new Set(['ja', 'zh']);
const SENTENCE_END = new Set(['。', '！', '？']);
const CLOSING = new Set(['」', '』', '）', ')']);

function languageOf(locale: string): string {
  return (locale.toLowerCase().split(/[-_]/)[0] ?? '').trim();
}

export function isCjkLocale(locale: string): boolean {
  return CJK_LOCALES.has(languageOf(locale));
}

/** 文の終わりの直後（閉じ括弧を含む）の位置。 */
function sentenceEnds(text: string, locale: string): number[] {
  if (!isCjkLocale(locale)) return [];
  const ends: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    if (!SENTENCE_END.has(text[i])) continue;
    let end = i + 1;
    while (end < text.length && CLOSING.has(text[end])) end += 1;
    ends.push(end);
    i = end - 1;
  }
  return ends;
}

/** 区切りの文字（列）の直後の位置。文末の区切りは塊を作らないので除く。 */
function afterDelimiter(text: string, delimiters: readonly string[]): number[] {
  const ends: number[] = [];
  let i = 0;
  while (i < text.length) {
    const delimiter = delimiters.find((candidate) => text.startsWith(candidate, i));
    if (!delimiter) {
      i += 1;
      continue;
    }
    const end = i + delimiter.length;
    if (end < text.length) ends.push(end);
    i = end;
  }
  return ends;
}

/** 5 字以下の出だし（句読点を除いた長さ）は、次の塊と 1 つにする。 */
function mergeShortLead(text: string, ends: number[]): number[] {
  if (ends.length === 0) return ends;
  const first = ends[0];
  const lead = text.slice(0, first).replace(/[、，]$/, '');
  return [...lead].length <= 5 ? ends.slice(1) : ends;
}

function clauseEnds(text: string, locale: string): number[] {
  const language = languageOf(locale);
  if (language === 'ja') return mergeShortLead(text, afterDelimiter(text, ['、']));
  if (language === 'zh') return mergeShortLead(text, afterDelimiter(text, ['，', '、']));
  return afterDelimiter(text, [', ', ': ', ' — ']);
}

function rangesFromEnds(text: string, ends: number[]): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let start = 0;
  for (const end of ends) {
    if (end > start) ranges.push([start, end]);
    start = end;
  }
  if (start < text.length) ranges.push([start, text.length]);
  return ranges;
}

/** 文に分ける。日本語・中国語以外と空の文字列は分けない（空は 0 個）。 */
export function splitSentences(text: string, locale: string): string[] {
  if (!text) return [];
  if (!isCjkLocale(locale)) return [text];
  return rangesFromEnds(text, sentenceEnds(text, locale)).map(([start, end]) => text.slice(start, end));
}

/** 塊に分ける。日本語・中国語のほか、英語などの題は「, 」「: 」「 — 」の後で分ける。 */
export function splitClauses(text: string, locale: string): string[] {
  if (!text) return [];
  return rangesFromEnds(text, clauseEnds(text, locale)).map(([start, end]) => text.slice(start, end));
}

function totalLength(parts: readonly InlinePart[]): number {
  return parts.reduce((sum, part) => sum + part.text.length, 0);
}

/** parts の [start, end) を切り出す。link の属性はそのまま残す。 */
function sliceParts(parts: readonly InlinePart[], start: number, end: number): InlinePart[] {
  const result: InlinePart[] = [];
  let offset = 0;
  for (const part of parts) {
    const partStart = offset;
    const partEnd = offset + part.text.length;
    offset = partEnd;
    const from = Math.max(start, partStart);
    const to = Math.min(end, partEnd);
    if (from < to) result.push({ ...part, text: part.text.slice(from - partStart, to - partStart) });
  }
  return result;
}

/** link の途中に落ちた区切りは、link の終わりへ寄せる（link の文字を切らない）。 */
function snapCuts(parts: readonly InlinePart[], cuts: readonly number[]): number[] {
  const length = totalLength(parts);
  const linkRanges: Array<[number, number]> = [];
  let offset = 0;
  for (const part of parts) {
    const start = offset;
    offset += part.text.length;
    if (part.href) linkRanges.push([start, offset]);
  }
  const snapped = cuts
    .map((cut) => {
      if (cut <= 0 || cut >= length) return -1;
      const range = linkRanges.find(([start, end]) => start < cut && cut < end);
      return range ? range[1] : cut;
    })
    .filter((cut) => cut > 0 && cut < length);
  return [...new Set(snapped)].sort((a, b) => a - b);
}

function groups(parts: readonly InlinePart[], cuts: readonly number[]): InlinePart[][] {
  const length = totalLength(parts);
  const edges = [0, ...cuts, length];
  const result: InlinePart[][] = [];
  for (let i = 0; i < edges.length - 1; i += 1) {
    const group = sliceParts(parts, edges[i], edges[i + 1]);
    if (group.length > 0) result.push(group);
  }
  return result;
}

/**
 * 文と塊に分ける。日本語・中国語以外の本文は分けない（1 文 1 塊）。
 * link をまたいで数え、link の途中では切らない。
 */
export function groupSentences(parts: readonly InlinePart[], locale: string): InlineSentence[] {
  const clean = parts.filter((part) => part.text.length > 0);
  if (clean.length === 0) return [];
  const text = clean.map((part) => part.text).join('');
  if (!isCjkLocale(locale)) return [[clean.map((part) => ({ ...part }))]];
  const sentences = groups(clean, snapCuts(clean, sentenceEnds(text, locale)));
  return sentences.map((sentence) => {
    const sentenceText = sentence.map((part) => part.text).join('');
    return groups(sentence, snapCuts(sentence, clauseEnds(sentenceText, locale)));
  });
}

/** 題を塊に分ける。文の span は作らない。日本語・中国語は句点でも切る（R1 の題）。 */
export function groupClauses(parts: readonly InlinePart[], locale: string): InlineClause[] {
  const clean = parts.filter((part) => part.text.length > 0);
  if (clean.length === 0) return [];
  const text = clean.map((part) => part.text).join('');
  if (!isCjkLocale(locale)) return groups(clean, snapCuts(clean, clauseEnds(text, locale)));
  return groups(clean, snapCuts(clean, sentenceEnds(text, locale))).flatMap((sentence) => {
    const sentenceText = sentence.map((part) => part.text).join('');
    return groups(sentence, snapCuts(sentence, clauseEnds(sentenceText, locale)));
  });
}
