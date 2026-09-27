/**
 * 鮮度判定用のソースハッシュ。
 *
 * ja の「翻訳対象部分」だけを入力にする（コレクション設定の fields、tags を訳すコレクションでは
 * tags、そして本文）。pubDate / featured / category のようなコピー対象フィールドや、YAML の
 * クォート・キー順・改行コード（CRLF）の違いではハッシュは変わらない。
 */
import { createHash } from 'node:crypto';
import { COLLECTIONS, HASH_VERSION } from './config.mjs';
import { bodyCore } from './frontmatter.mjs';
import { getPath } from './util.mjs';

/** ハッシュの入力になる正規化済みオブジェクト（キー順は設定順で固定）。 */
export function translatableSource(collection, data, body) {
  const spec = COLLECTIONS[collection];
  if (!spec) throw new Error(`未知のコレクションです: ${collection}`);
  const fields = {};
  for (const path of spec.fields) {
    const value = getPath(data, path);
    if (value !== undefined && value !== null) fields[path] = String(value);
  }
  const tags = spec.translateTags && Array.isArray(data.tags) ? data.tags.map(String) : undefined;
  return { v: HASH_VERSION, collection, fields, ...(tags ? { tags } : {}), body: bodyCore(body) };
}

/** @returns {string} 64 桁の小文字 16 進 SHA-256 */
export function computeSourceHash(collection, data, body) {
  const input = JSON.stringify(translatableSource(collection, data, body));
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export const SOURCE_HASH_RE = /^[0-9a-f]{64}$/;
