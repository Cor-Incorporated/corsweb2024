/**
 * 小さな純関数ユーティリティ（イミュータブル）。
 */

export function isPlainObject(value) {
  return (
    value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)
  );
}

/** 'image.alt' のようなドット区切りパスで値を読む。 */
export function getPath(obj, path) {
  return path.split('.').reduce((acc, key) => (isPlainObject(acc) ? acc[key] : undefined), obj);
}

/** ドット区切りパスに値を設定した新しいオブジェクトを返す（元は変更しない）。 */
export function setPath(obj, path, value) {
  const [head, ...rest] = path.split('.');
  const base = isPlainObject(obj) ? obj : {};
  if (rest.length === 0) return { ...base, [head]: value };
  return { ...base, [head]: setPath(base[head], rest.join('.'), value) };
}

/** ドット区切りパスを取り除いた新しいオブジェクトを返す（中間オブジェクトは残す）。 */
export function omitPath(obj, path) {
  if (!isPlainObject(obj)) return obj;
  const [head, ...rest] = path.split('.');
  if (!(head in obj)) return obj;
  if (rest.length === 0) {
    const { [head]: _removed, ...others } = obj;
    return others;
  }
  return { ...obj, [head]: omitPath(obj[head], rest.join('.')) };
}

/** Date を ISO 文字列に、キーを昇順にした JSON。値の比較に使う。 */
export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value) {
  if (value instanceof Date) return { $date: value.toISOString() };
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .filter((k) => value[k] !== undefined)
        .sort()
        .map((k) => [k, canonicalize(value[k])])
    );
  }
  return value;
}

export function deepEqual(a, b) {
  return canonicalJson(a) === canonicalJson(b);
}

/** 文字列の出現回数を数えた Map（多重集合の比較用）。入力は変更しない。 */
export function countBy(items) {
  const counts = new Map();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return counts;
}

/** 多重集合の差分を人が読める形で返す。一致なら空配列。 */
export function multisetDiff(expected, actual) {
  const want = countBy(expected);
  const got = countBy(actual);
  const keys = [...new Set([...want.keys(), ...got.keys()])];
  return keys
    .filter((k) => (want.get(k) ?? 0) !== (got.get(k) ?? 0))
    .map(
      (k) =>
        `${JSON.stringify(truncate(k, 80))}: 期待 ${want.get(k) ?? 0} / 実際 ${got.get(k) ?? 0}`
    );
}

export function truncate(text, max) {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** 正規化: BOM 除去と改行コードの LF 統一。 */
export function normalizeNewlines(text) {
  return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}
