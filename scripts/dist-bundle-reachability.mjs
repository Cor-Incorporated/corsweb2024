// 公開 dist の JS が、どこかの HTML から実際に読み込まれるかを調べる（Epic #330 / #337）。
//
// vite の rollupOptions.output で出力名を上書きしていた間、Astro のサーバー描画用モジュールが
// dist/_astro/*.js として公開ディレクトリに残っていた。記事本文だけのチャンクや i18n 等には
// createComponent / renderTemplate のような目印が無いものも多く（修正前ビルドの 338 本中 215 本）、
// 文字列の目印だけでは取り残しを見落とす。そこで dist のすべての HTML（将来の管理画面
// admin/index.html も含む）を起点に、JS の静的 import・再エクスポート・動的 import・Vite の依存リスト
// （__vite__mapDeps）に現れる .js を辿り、到達できない _astro/*.js を取り残しとして扱う。
// 限界: 変数を埋め込んだ動的 import（`./${name}.js` 等）は辿れない。そうした JS を持つ画面を足すときは
// 起点の HTML から静的に辿れる形にするか、ここに例外を足す。
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const JS_FILE = /\.m?js$/;
const toPosix = (file) => file.split(path.sep).join('/');
const stripQuery = (value) => value.split('#')[0].split('?')[0];

/** JS 内の引用符で囲まれた .js / .mjs のパス（import / export … from / import() / __vite__mapDeps）。 */
export function extractJsRefs(code) {
  return [...code.matchAll(/["'`]([^"'`\s]+?\.m?js)(?:[?#][^"'`\s]*)?["'`]/g)].map((match) => match[1]);
}

/** HTML が読み込む JS（script src / modulepreload / island の URL 属性 / インライン script 内の参照）。 */
export function extractHtmlScriptRefs(html) {
  const refs = [];
  const attributes = /\b(?:src|href|component-url|renderer-url|before-hydration-url)=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  for (const match of html.matchAll(attributes)) {
    const value = stripQuery(match[1] ?? match[2] ?? match[3] ?? '');
    if (JS_FILE.test(value)) refs.push(value);
  }
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) refs.push(...extractJsRefs(match[1]));
  return refs;
}

/** 参照を dist 内の絶対パス候補にする（外部 URL は対象外）。相対パスは参照元の場所、次に dist 直下で解決する。 */
function resolveCandidates(ref, fromFile, distDir) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith('//')) return [];
  if (ref.startsWith('/')) return [path.join(distDir, ref)];
  return [path.resolve(path.dirname(fromFile), ref), path.join(distDir, ref)];
}

/**
 * dist のすべての HTML から辿れる JS の集合を作り、到達できない _astro/*.js を返す（dist 相対・POSIX 形式）。
 * @param {string} distDir dist の絶対パス
 * @param {string[]} files dist 配下の全ファイル（絶対パス）
 */
export async function findUnreachableBundles(distDir, files) {
  const known = new Set(files);
  const reachable = new Set();
  const queue = [];
  const enqueue = (refs, fromFile) => {
    for (const ref of refs) {
      const hit = resolveCandidates(ref, fromFile, distDir).find((candidate) => known.has(candidate));
      if (hit && !reachable.has(hit)) {
        reachable.add(hit);
        queue.push(hit);
      }
    }
  };
  for (const file of files.filter((name) => name.endsWith('.html'))) {
    enqueue(extractHtmlScriptRefs(await readFile(file, 'utf8')), file);
  }
  while (queue.length > 0) {
    const file = queue.shift();
    enqueue(extractJsRefs(await readFile(file, 'utf8')), file);
  }
  return files
    .filter((file) => JS_FILE.test(file) && toPosix(path.relative(distDir, file)).startsWith('_astro/'))
    .filter((file) => !reachable.has(file))
    .map((file) => toPosix(path.relative(distDir, file)))
    .sort();
}

/** サーバービルドの残骸（Astro のサーバー用チャンクは .mjs、置き場は chunks/）。 */
export function findServerOutputRemnants(distDir, files) {
  return files
    .map((file) => toPosix(path.relative(distDir, file)))
    .filter((relative) => relative.endsWith('.mjs') || relative.split('/').slice(0, -1).includes('chunks'))
    .sort();
}
