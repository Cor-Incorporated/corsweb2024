/**
 * 鮮度判定用のソースハッシュ。
 *
 * ja の「翻訳対象部分」だけを入力にする（コレクション設定の fields、tags を訳すコレクションでは
 * tags、そして本文）。pubDate / featured / category のようなコピー対象フィールドや、YAML の
 * クォート・キー順・改行コード（CRLF）の違いではハッシュは変わらない。
 *
 * Grift の記事で Grift の用語が出るときは、その用語と各言語の正式表記（grift-terms.mjs）も入力にする
 * （griftTerms）。用語の表を変えると、その用語を含む記事の訳だけが stale になり、バックフィルで訳し直せる。
 * 用語の出ない記事の入力は griftTerms を足す前と同じで、ハッシュも変わらない（HASH_VERSION を上げない理由）。
 */
import { createHash } from 'node:crypto';
import { COLLECTIONS, HASH_VERSION } from './config.mjs';
import { bodyCore } from './frontmatter.mjs';
import { griftTermFingerprint } from './grift-terms.mjs';
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
  const source = {
    v: HASH_VERSION,
    collection,
    fields,
    ...(tags ? { tags } : {}),
    body: bodyCore(body),
  };
  const griftTerms = griftTermFingerprint(source);
  return griftTerms ? { ...source, griftTerms } : source;
}

/** @returns {string} 64 桁の小文字 16 進 SHA-256 */
export function computeSourceHash(collection, data, body) {
  const input = JSON.stringify(translatableSource(collection, data, body));
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export const SOURCE_HASH_RE = /^[0-9a-f]{64}$/;
