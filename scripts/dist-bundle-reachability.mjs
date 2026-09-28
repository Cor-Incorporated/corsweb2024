// 公開 dist の JS が、どこかの HTML から実際に読み込まれるかを調べる（Epic #330 / #337）。
//
// vite の rollupOptions.output で出力名を上書きしていた間、Astro のサーバー描画用モジュールが
// dist/_astro/*.js として公開ディレクトリに残っていた。記事本文だけのチャンクや i18n 等には
// createComponent / renderTemplate のような目印が無いものも多く（修正前のビルドでは目印の無いものが
// 200 本を超えた。本数はビルドごとに変わる）、文字列の目印だけでは取り残しを見落とす。そこで dist の
// すべての HTML を起点に、実際の依存の辺（静的 import・再エクスポート・動的 import()・Vite の依存リスト
// __vite__mapDeps）だけを辿り、到達できない _astro/*.js を取り残しとして扱う。
// 起点にするのは実際にモジュールを読み込むタグだけ（<script src>・<link rel="modulepreload">・Astro の
// island の URL・インライン script 内の import）。<a href> や文字列に書かれただけのファイル名は数えない。
// 限界: 変数を埋め込んだ動的 import（`./${name}.js` 等）は辿れない。そうした JS を持つ画面を足すときは
// 起点の HTML から静的に辿れる形にするか、ここに例外を足す。
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const JS_FILE = /\.m?js$/;
const toPosix = (file) => file.split(path.sep).join('/');
const stripQuery = (value) => value.split('#')[0].split('?')[0];

// 実際の依存の辺だけを拾う（文字列にファイル名が書かれているだけのものは import ではない）
const IMPORT_EDGES = [
  /\bimport\s*[\w*${},\s]*?\s*from\s*["']([^"']+)["']/g, // import x from "…" / import{a}from"…"
  /\bimport\s*["']([^"']+)["']/g, // import "…"（副作用だけの import）
  /\bexport\s*(?:\*(?:\s*as\s+[\w$]+)?|\{[^}]*\})\s*from\s*["']([^"']+)["']/g, // export … from "…"
  /\bimport\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g, // import("…")
];
// Vite の動的 import が先読みする依存の一覧: const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["_astro/a.js"])))=>…
const VITE_MAP_DEPS = /\b__vite__mapDeps\s*=\s*\([^)]*?\bm\.f\s*=\s*\[([^\]]*)\]/g;

/** JS から、読み込みの依存になっている .js / .mjs のパスを取り出す。 */
export function extractJsRefs(code) {
  const refs = [];
  for (const pattern of IMPORT_EDGES) for (const match of code.matchAll(pattern)) refs.push(match[1]);
  for (const match of code.matchAll(VITE_MAP_DEPS)) {
    for (const dep of match[1].matchAll(/["'`]([^"'`]+)["'`]/g)) refs.push(dep[1]);
  }
  return refs.map(stripQuery).filter((ref) => JS_FILE.test(ref));
}

// 属性値を読む。HTML では `=` の前後に空白を置けるので（src = "…"）それも許し、引用符なしの値も読む。
// 読めないと本当に読み込まれている JS を取り残しと誤検知する。
const attribute = (tag, name) => {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\x60]+))`, 'i'));
  return match ? (match[1] ?? match[2] ?? match[3]) : null;
};

/** HTML のうち、実際にモジュールを読み込むものだけを起点として取り出す。 */
export function extractHtmlScriptRefs(html) {
  const refs = [];
  for (const [tag] of html.matchAll(/<script\b[^>]*>/gi)) refs.push(attribute(tag, 'src'));
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = (attribute(tag, 'rel') ?? '').toLowerCase().split(/\s+/);
    if (rel.includes('modulepreload')) refs.push(attribute(tag, 'href'));
  }
  // Astro の island はランタイムがこれらの URL を import する
  for (const [tag] of html.matchAll(/<astro-island\b[^>]*>/gi)) {
    for (const name of ['component-url', 'renderer-url', 'before-hydration-url']) refs.push(attribute(tag, name));
  }
  for (const match of html.matchAll(/<script\b(?![^>]*\ssrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)) refs.push(...extractJsRefs(match[1]));
  return refs.filter(Boolean).map(stripQuery).filter((ref) => JS_FILE.test(ref));
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

// Astro 4 のサーバービルドの出力名（node_modules/astro/dist/core/build/static-build.js の entryFileNames /
// chunkFileNames）。静的ビルドでは生成後に消されるので、dist に残っていれば取り残し。正当な公開 .mjs
// （public/ に置いた配布用モジュールなど）を誤検知しないよう、名前と置き場（dist 直下）で絞る。
const SERVER_OUTPUT = [
  /^entry\.mjs$/,
  /^renderers\.mjs$/,
  /^manifest_[^/]+\.mjs$/,
  /^adapter_[^/]+\.mjs$/,
  /^_noop-middleware\.mjs$/,
  /^_@astrojs-ssr-adapter\.mjs$/,
  /^chunks\/.+\.mjs$/,
  /^pages\/.+\.mjs$/,
];

/** サーバービルドの残骸（dist 相対・POSIX 形式）。 */
export function findServerOutputRemnants(distDir, files) {
  return files
    .map((file) => toPosix(path.relative(distDir, file)))
    .filter((relative) => SERVER_OUTPUT.some((pattern) => pattern.test(relative)))
    .sort();
}
