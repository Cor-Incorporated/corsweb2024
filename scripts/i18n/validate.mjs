/**
 * 翻訳結果の検証。1 つでも違反があれば呼び出し側は書き込まない（「壊さない」を優先）。
 *
 * - トークン検証: プレースホルダが全部・1 回ずつ・壊れず残っているか、ブロックは単独行か
 * - 構造パリティ: 見出し（レベル別）・コードブロック（内容一致）・リンク/画像の宛先・数式・HTML・
 *   リンクカード・表の行数・空行区切りのブロック（段落等）の数・リスト項目の数が ja と一致するか
 * - 行き先の順序: リンク・画像などの行き先のプレースホルダの出現順が、見出し・表のセル・リスト項目・段落ごとに
 *   ja と一致するか（行き先だけを入れ替えた訳を落とす。#339 Codex 最終レビュー P2-1）
 * - 未翻訳検出: 日本語（かな・漢字）が残りすぎていないか
 * - 社名: モデルが書いた表記ゆれを翻訳先言語の正式表記にそろえ、社名トークンを正式表記で戻す（glossary.mjs）
 */
import { normalizeOrganizationNames } from './glossary.mjs';
import {
  analyze,
  isBlockTokenLine,
  restore,
  stripTokens,
  textUnits,
  TOKEN_ANY_RE,
  tokenIds,
} from './markdown.mjs';
import { countBy, multisetDiff, normalizeNewlines } from './util.mjs';

const SEQUENCE_KINDS = ['code-block'];
const MULTISET_KINDS = [
  'math-block',
  'html-block',
  'link-card',
  'ref-def',
  'code-span',
  'math-inline',
  'autolink',
  'html-inline',
  'link-dest',
  'image-dest',
  'ref-label',
  'footnote',
  'heading-id',
  'bare-url',
];
const KIND_LABELS = {
  'code-block': 'コードブロック',
  'math-block': '数式ブロック',
  'html-block': 'HTML ブロック',
  'link-card': 'リンクカード行',
  'ref-def': '参照リンク定義',
  'code-span': 'インラインコード',
  'math-inline': 'インライン数式',
  autolink: '<URL> リンク',
  'html-inline': 'インライン HTML',
  'link-dest': 'リンク',
  'image-dest': '画像',
  'ref-label': '参照リンク',
  footnote: '脚注',
  'heading-id': '見出し ID',
  'bare-url': 'URL',
};

/** 本文に許す日本語文字の割合の上限（本文 / frontmatter フィールド）。 */
export const MAX_JAPANESE_RATIO = Object.freeze({ body: 0.1, fields: 0.3 });

const JAPANESE_SCRIPT_RE = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/gu;
const KANA_RE = /[\p{Script=Hiragana}\p{Script=Katakana}]/gu;
const LETTER_RE = /\p{L}/gu;
const FENCE_LINE_RE = /^(?:[ \t]*>)*[ \t]*(`{3,}|~{3,})/m;

/**
 * 文字（\p{L}）のうち日本語の文字の割合。zh は漢字を使うので仮名だけを数える。
 */
export function japaneseRatio(text, lang) {
  const stripped = stripTokens(text);
  const letters = (stripped.match(LETTER_RE) ?? []).length;
  if (letters === 0) return 0;
  const japanese = (stripped.match(lang === 'zh' ? KANA_RE : JAPANESE_SCRIPT_RE) ?? []).length;
  return japanese / letters;
}

function compareKind(kind, expected, actual) {
  const label = KIND_LABELS[kind] ?? kind;
  if (expected.length !== actual.length)
    return [`${label}の数が一致しません（ja ${expected.length} / 翻訳 ${actual.length}）`];
  if (SEQUENCE_KINDS.includes(kind)) {
    const index = expected.findIndex((value, i) => value !== actual[i]);
    return index === -1 ? [] : [`${label} #${index + 1} の内容が ja と一致しません`];
  }
  const diff = multisetDiff(expected, actual);
  return diff.length === 0 ? [] : [`${label}の内容が一致しません: ${diff.slice(0, 3).join(', ')}`];
}

/**
 * ja 本文と翻訳本文の構造パリティ。違反メッセージの配列（一致なら空）。
 */
export function compareStructure(sourceMarkdown, translatedMarkdown) {
  const src = analyze(sourceMarkdown);
  const out = analyze(translatedMarkdown);
  const errors = [];
  src.headings.forEach((count, i) => {
    if (count !== out.headings[i])
      errors.push(`見出し H${i + 1} の数が一致しません（ja ${count} / 翻訳 ${out.headings[i]}）`);
  });
  for (const kind of [...SEQUENCE_KINDS, ...MULTISET_KINDS]) {
    errors.push(...compareKind(kind, src.kinds[kind] ?? [], out.kinds[kind] ?? []));
  }
  if (src.tableRows !== out.tableRows)
    errors.push(`表の行数が一致しません（ja ${src.tableRows} / 翻訳 ${out.tableRows}）`);
  // 見出し・コード・リンクの数が変わらない「段落 1 つ」「リスト項目 1 つ」の欠落・結合も落とす。
  if (src.textBlocks !== out.textBlocks)
    errors.push(
      `段落などのブロック数が一致しません（ja ${src.textBlocks} / 翻訳 ${out.textBlocks}）`
    );
  if (src.listItems !== out.listItems)
    errors.push(`リスト項目の数が一致しません（ja ${src.listItems} / 翻訳 ${out.listItems}）`);
  return errors;
}

/**
 * プレースホルダの検証（復元前の翻訳結果に対して）。
 * @param {string} output 翻訳結果
 * @param {string} protectedText API に送ったテキスト
 */
export function checkTokens(output, protectedText) {
  const expected = countBy(tokenIds(protectedText));
  const found = countBy(tokenIds(output));
  const errors = [];
  for (const id of expected.keys()) {
    const n = found.get(id) ?? 0;
    if (n === 0) errors.push(`プレースホルダ ⟦${id}⟧ が欠落しています`);
    if (n > 1) errors.push(`プレースホルダ ⟦${id}⟧ が ${n} 回出現しています`);
  }
  for (const id of found.keys())
    if (!expected.has(id)) errors.push(`未知のプレースホルダ ⟦${id}⟧ があります`);
  if (/[⟦⟧]/.test(output.replace(TOKEN_ANY_RE, '')))
    errors.push('壊れたプレースホルダ（⟦ ⟧ の断片）があります');
  const misplaced = output
    .split('\n')
    .filter((line) => /⟦B\d+⟧/.test(line) && !isBlockTokenLine(line));
  if (misplaced.length > 0)
    errors.push(
      `ブロック用プレースホルダが単独行になっていません: ${misplaced[0].trim().slice(0, 60)}`
    );
  return errors;
}

/** モデルが全体を ```markdown ... ``` で包んで返したときだけ外す。 */
export function unwrapOuterFence(text) {
  const lines = text.split('\n');
  const first = lines.findIndex((l) => l.trim() !== '');
  const last = lines.findLastIndex((l) => l.trim() !== '');
  if (first === -1 || first === last) return text;
  if (/^\s*```[\w-]*\s*$/.test(lines[first]) && /^\s*```\s*$/.test(lines[last])) {
    return lines.slice(first + 1, last).join('\n');
  }
  return text;
}

function finishReasonErrors(finishReason) {
  return finishReason && finishReason !== 'STOP'
    ? [`生成が途中で止まりました（finishReason=${finishReason}）`]
    : [];
}

/**
 * 本文の翻訳結果を検証し、問題なければ復元済み本文を返す。
 * @returns {{ ok: true, text: string } | { ok: false, errors: string[] }}
 */
export function checkBodyOutput({ output, finishReason, protectedText, store, sourceCore, lang }) {
  const text = unwrapOuterFence(normalizeNewlines(output ?? ''))
    .replace(/^\n+/, '')
    .replace(/\s+$/, '');
  if (text.trim() === '')
    return { ok: false, errors: [...finishReasonErrors(finishReason), '翻訳結果が空です'] };
  const errors = [...finishReasonErrors(finishReason), ...checkTokens(text, protectedText)];
  if (FENCE_LINE_RE.test(text)) errors.push('翻訳結果に元の文書に無いコードフェンスがあります');
  const ratio = japaneseRatio(text, lang);
  if (ratio > MAX_JAPANESE_RATIO.body)
    errors.push(`日本語が残っています（割合 ${ratio.toFixed(2)}）`);
  if (errors.length > 0) return { ok: false, errors };
  const restored = restore(normalizeOrganizationNames(text, lang), store, lang);
  const structural = compareStructure(sourceCore, restored);
  if (structural.length > 0) return { ok: false, errors: structural };
  const order = checkDestinationOrder(protectedText, text, store);
  return order.length > 0 ? { ok: false, errors: order } : { ok: true, text: restored };
}

// 行き先を持つプレースホルダ。リンク・画像の宛先、URL、参照リンクのラベル、脚注、リンクカード行、
// href / src を持つインライン HTML（<a href> の開始タグなど）。
const DESTINATION_KINDS = new Set([
  'link-dest',
  'image-dest',
  'autolink',
  'bare-url',
  'ref-label',
  'footnote',
  'link-card',
]);
const isDestination = (entry) =>
  DESTINATION_KINDS.has(entry?.kind) ||
  (entry?.kind === 'html-inline' && /\b(?:href|src)\s*=/i.test(entry.original));

/**
 * 行き先のプレースホルダの出現順を、単位（見出し・表のセル・リスト項目・段落）ごとに ja とそろえる。
 * 各トークンが 1 回ずつ現れるかだけを見ると、[A](⟦P1⟧) [B](⟦P0⟧) のような行き先の取り違えを通してしまう
 * （#339 Codex 最終レビュー P2-1）。訳では語順が変わるのでラベルとは照合できないため、並び順で見る。
 * 構造パリティ（ブロック・リスト項目・表のセルの数）を通った後に呼ぶので、単位は 1 対 1 に対応する。
 */
function checkDestinationOrder(protectedText, output, store) {
  const destinationsIn = (unit) => tokenIds(unit).filter((id) => isDestination(store.get(id)));
  const expected = textUnits(protectedText).map(destinationsIn);
  const actual = textUnits(output).map(destinationsIn);
  if (expected.length !== actual.length)
    return [
      `リンク・画像などの行き先の配置を ja と照合できません（単位の数: ja ${expected.length} / 翻訳 ${actual.length}）`,
    ];
  const show = (ids) => (ids.length === 0 ? 'なし' : ids.map((id) => `⟦${id}⟧`).join(' '));
  const errors = [];
  expected.forEach((ids, i) => {
    if (ids.join(' ') !== actual[i].join(' '))
      errors.push(
        `リンク・画像などの行き先の順序が ja と一致しません（ブロック #${i + 1}: ja ${show(ids)} / 翻訳 ${show(actual[i])}）`
      );
  });
  return errors.slice(0, 3);
}

const URL_IN_TEXT_RE = /https?:\/\/[^\s"'<>()]+/g;

function fieldValueErrors(key, source, translated) {
  if (typeof translated !== 'string' || translated.trim() === '')
    return [`${key}: 空または文字列ではありません`];
  const errors = [];
  if (!source.includes('\n') && translated.trim().includes('\n'))
    errors.push(`${key}: 改行が混入しています`);
  // 社名トークン（⟦N…⟧）は入力と同じものが同じ回数だけ残っていること。それ以外の ⟦ ⟧ は混入扱い。
  if (multisetDiff(tokenIds(source), tokenIds(translated)).length > 0)
    errors.push(`${key}: プレースホルダ（社名）が一致しません`);
  if (/[⟦⟧]/.test(translated.replace(TOKEN_ANY_RE, '')))
    errors.push(`${key}: 予約文字 ⟦ ⟧ が混入しています`);
  const diff = multisetDiff(
    source.match(URL_IN_TEXT_RE) ?? [],
    translated.match(URL_IN_TEXT_RE) ?? []
  );
  if (diff.length > 0) errors.push(`${key}: URL が変わっています`);
  return errors;
}

function tagErrors(source, translated) {
  if (!Array.isArray(translated)) return ['tags: 配列ではありません'];
  if (translated.length !== source.length)
    return [`tags: 要素数が一致しません（ja ${source.length} / 翻訳 ${translated.length}）`];
  return translated.flatMap((tag, i) => fieldValueErrors(`tags[${i}]`, source[i], tag));
}

function parseJsonObject(text) {
  try {
    const value = JSON.parse(unwrapOuterFence(normalizeNewlines(text ?? '')).trim());
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * frontmatter フィールド翻訳（JSON）の検証。
 * @param {{ output: string, finishReason?: string, input: Record<string, string | string[]>, lang: string }} args
 * @returns {{ ok: true, value: Record<string, string | string[]> } | { ok: false, errors: string[] }}
 */
export function checkFieldsOutput({ output, finishReason, input, lang }) {
  const parsed = parseJsonObject(output);
  if (!parsed)
    return {
      ok: false,
      errors: [...finishReasonErrors(finishReason), 'JSON オブジェクトとして解釈できません'],
    };
  const errors = [...finishReasonErrors(finishReason)];
  const expectedKeys = Object.keys(input).sort();
  const actualKeys = Object.keys(parsed).sort();
  if (expectedKeys.join('\n') !== actualKeys.join('\n')) {
    errors.push(
      `キーが一致しません（期待 ${expectedKeys.join(',')} / 実際 ${actualKeys.join(',')}）`
    );
  }
  for (const key of expectedKeys) {
    if (!(key in parsed)) continue;
    const src = input[key];
    errors.push(
      ...(Array.isArray(src)
        ? tagErrors(src, parsed[key])
        : fieldValueErrors(key, src, parsed[key]))
    );
  }
  if (errors.length > 0) return { ok: false, errors };
  const joined = expectedKeys.flatMap((k) => parsed[k]).join('\n');
  const ratio = japaneseRatio(joined, lang);
  if (ratio > MAX_JAPANESE_RATIO.fields)
    return { ok: false, errors: [`日本語が残っています（割合 ${ratio.toFixed(2)}）`] };
  const finish = (text) => normalizeOrganizationNames(text.trim(), lang);
  const value = Object.fromEntries(
    expectedKeys.map((k) => [
      k,
      Array.isArray(parsed[k]) ? parsed[k].map(finish) : finish(parsed[k]),
    ])
  );
  return { ok: true, value };
}
