/**
 * Markdown の frontmatter を読み書きする。
 *
 * 読み込みは js-yaml の DEFAULT_SCHEMA（日付は Date になる）。Astro の content collections が
 * 使う gray-matter（js-yaml safeLoad）と同じ解釈にして、検証結果を実ビルドと揃える。
 * 書き出しは独自の決定的エミッタ（文字列は常にダブルクォート、日付は素の YAML 日付、
 * 配列はフロー形式）で、書いた YAML を読み戻して元の値と一致しなければ例外にする。
 */
import yaml from 'js-yaml';
import { deepEqual, isPlainObject, normalizeNewlines } from './util.mjs';

const FRONTMATTER_RE = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)([\s\S]*)$/;
const PLAIN_KEY_RE = /^[A-Za-z_][A-Za-z0-9_-]*$/;

export class FrontmatterError extends Error {}

/** 本文から frontmatter と body を分ける。 */
export function splitDocument(text) {
  const match = normalizeNewlines(text).match(FRONTMATTER_RE);
  if (!match) throw new FrontmatterError('frontmatter（先頭の --- から --- まで）が見つかりません');
  return { yamlText: match[1], body: match[2] };
}

export function parseFrontmatter(yamlText) {
  let data;
  try {
    data = yaml.load(yamlText);
  } catch (err) {
    throw new FrontmatterError(`frontmatter の YAML を解釈できません: ${err.message}`);
  }
  if (!isPlainObject(data))
    throw new FrontmatterError('frontmatter がマッピング（key: value）ではありません');
  return data;
}

/** @returns {{ data: Record<string, unknown>, body: string }} */
export function parseDocument(text) {
  const { yamlText, body } = splitDocument(text);
  return { data: parseFrontmatter(yamlText), body };
}

/** 先頭の空行と末尾の空白を除いた本文。ハッシュ・翻訳・パリティ検証はこの形で扱う。 */
export function bodyCore(body) {
  return normalizeNewlines(body).replace(/^\n+/, '').replace(/\s+$/, '');
}

function formatDate(date) {
  if (Number.isNaN(date.getTime())) throw new FrontmatterError('不正な日付値は書き出せません');
  const iso = date.toISOString();
  return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso;
}

function emitScalar(value) {
  if (value instanceof Date) return formatDate(value);
  // JSON の文字列表現は YAML のダブルクォート文字列としても有効（YAML 1.2 は JSON の上位集合）。
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return String(value);
  if (value === null) return 'null';
  throw new FrontmatterError(`書き出せない値の型です: ${typeof value}`);
}

function isScalar(value) {
  return !Array.isArray(value) && !isPlainObject(value);
}

function emitEntry(key, value, indent) {
  const pad = ' '.repeat(indent);
  const name = PLAIN_KEY_RE.test(key) ? key : JSON.stringify(key);
  if (Array.isArray(value)) {
    if (!value.every(isScalar))
      throw new FrontmatterError(`${key}: オブジェクトを含む配列は未対応です`);
    return [`${pad}${name}: [${value.map(emitScalar).join(', ')}]`];
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return [`${pad}${name}: {}`];
    return [`${pad}${name}:`, ...entries.flatMap(([k, v]) => emitEntry(k, v, indent + 2))];
  }
  return [`${pad}${name}: ${emitScalar(value)}`];
}

/** frontmatter の YAML テキスト（末尾改行つき、区切り線なし）を返す。 */
export function serializeFrontmatter(data) {
  const lines = Object.entries(data)
    .filter(([, v]) => v !== undefined)
    .flatMap(([k, v]) => emitEntry(k, v, 0));
  const text = `${lines.join('\n')}\n`;
  const reparsed = parseFrontmatter(text);
  if (!deepEqual(reparsed, data)) {
    throw new FrontmatterError('frontmatter の書き出し結果を読み戻すと元の値と一致しません');
  }
  return text;
}

/** frontmatter と本文から Markdown 文書を組み立てる。 */
export function composeDocument(data, body) {
  const core = bodyCore(body);
  const head = `---\n${serializeFrontmatter(data)}---\n`;
  return core ? `${head}\n${core}\n` : head;
}
