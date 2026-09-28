// 画像ファイルの拡張子と、中身の先頭バイトの形式が一致するかを判定する（#340）。
// remark-link-card-plus のキャッシュの検査で、追跡しているファイル（src/utils/__tests__/link-card-cache.test.ts）と
// ビルド後の dist（scripts/audit-dist-security.mjs）の両方から使う。
//
// remark-link-card-plus（0.5.0）は画像を取得すると、応答の status も Content-Type も見ずに保存し、
// 形式を判別できない中身（HTML・SVG）の拡張子を .png にする（build/index.js:334-379）。
// そのまま配信されると画像は表示されない（404 ページの HTML や SVG が .png になっていた）。

const startsWithBytes = (buffer, bytes) => buffer.subarray(0, bytes.length).equals(Buffer.from(bytes));
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// XML 宣言・コメント・DOCTYPE の後に <svg が来るもの。
const SVG_PROLOG = /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE\s+svg[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg\b/i;

export const SIGNATURES = {
  png: buffer => startsWithBytes(buffer, PNG),
  // file-type はアニメーション PNG を .apng として返す（中身は PNG の形式）。
  apng: buffer => startsWithBytes(buffer, PNG),
  jpg: buffer => startsWithBytes(buffer, [0xff, 0xd8, 0xff]),
  jpeg: buffer => startsWithBytes(buffer, [0xff, 0xd8, 0xff]),
  gif: buffer => ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('latin1')),
  webp: buffer =>
    buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP',
  // 静止画（avif）と連続画像（avis）のどちらのブランドも AVIF として扱う。
  avif: buffer =>
    buffer.subarray(4, 8).toString('latin1') === 'ftyp' && /avi[fs]/.test(buffer.subarray(8, 32).toString('latin1')),
  ico: buffer => buffer.length >= 4 && buffer.readUInt32LE(0) === 0x00010000,
  svg: buffer => SVG_PROLOG.test(buffer.subarray(0, 2048).toString('utf8')),
};

export const hasKnownSignature = name => Object.hasOwn(SIGNATURES, name.slice(name.lastIndexOf('.') + 1).toLowerCase());

// 拡張子が中身と一致すれば null、一致しなければ診断用のメッセージ（ファイル名・拡張子・先頭 16 バイト）を返す。
// 判定表に無い拡張子も不一致として返す（追跡するファイルは既知の形式に限るため）。
// 注: file-type は XML 宣言付きの SVG を xml と判定するので、プラグインは .xml で保存する（dist 側では警告）。
export const signatureMismatch = (name, buffer) => {
  const extension = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  if (SIGNATURES[extension]?.(buffer)) return null;
  return `${name} (.${extension}) starts with ${buffer.subarray(0, 16).toString('hex')}`;
};

// SVG を文書として直接開いたときに動きうる内容。実体参照（&#106;avascript: など）までは捕まえきれないので、
// 配信側の CSP（firebase.json の /remark-link-card-plus/** の sandbox）と併用する。
export const ACTIVE_SVG_CONTENT = /<script\b|\son[a-z]+\s*=|javascript:|<foreignObject\b/i;
