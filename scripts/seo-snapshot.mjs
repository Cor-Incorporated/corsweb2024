#!/usr/bin/env node
// SEO/AIO スナップショット。
//
// dist の全 HTML から、検索エンジン / AI クローラーが読む要素（URL・title・meta description・canonical・
// hreflang・meta robots・h1・og:* / twitter:*・JSON-LD）と、そのページが読み込む JS/CSS（raw / brotli
// サイズ）・preload・インライン script/style（中身のハッシュ）を抽出して JSON にする。
// `--compare <baseline.json>` を付けると、ベースラインとの差分を「どのフィールドが・何ページで・
// どう変わったか」の形で出力する。
//
// 使い方:
//   npm run build
//   npm run seo:snapshot -- --out snapshot.json                     # dist → JSON
//   npm run seo:snapshot -- --compare baseline.json                 # dist とベースラインの差分
//   npm run seo:snapshot -- --compare a.json --current b.json
//   npm run seo:snapshot -- --compare baseline.json --fail-on-diff  # 差分があれば exit 1（エラーは exit 2）
//
// 目的は「意図した差分だけが出ていること」をブランチごとに確認すること（ADR-0017: 各段階は URL 一覧・
// 構造化データ・hreflang・ページごとの JS 量のスナップショット差分で検証する）。宣言（設定・コンポーネント）
// を変えたら、それを実際に読む側（HTML / sitemap / robots.txt）の出力で確かめる。
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { brotliCompressSync, constants as zlibConstants } from 'node:zlib';
import { JSDOM } from 'jsdom';

// 形式を変えたら上げる。比較時に一致しなければエラーにする（形式違いの比較は偽の差分を出すため）。
// 2: sitemap-index / sitemap の hreflang / og・twitter / preload / インライン CSS・JS の中身 / ビルド条件
export const SNAPSHOT_VERSION = 2;
const SITE_ORIGIN = 'https://cor-jp.com';

/** dist 相対の HTML パス → サイトの URL パス（dist/about/index.html → /about/）。 */
export function htmlFileToUrlPath(relativeFile) {
  const posix = relativeFile.split(path.sep).join('/');
  if (posix === 'index.html') return '/';
  if (posix.endsWith('/index.html')) return `/${posix.slice(0, -'index.html'.length)}`;
  return `/${posix}`;
}

/** キー順をソートした JSON（差分を安定させるための正規化）。 */
export function normalizeJson(value) {
  if (Array.isArray(value)) return value.map(normalizeJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalizeJson(value[key])]),
    );
  }
  return value;
}

/** JSON-LD ブロックの @type を列挙する（トップレベル・配列・@graph を辿る。入れ子のノードは辿らない）。 */
export function jsonLdTypes(data) {
  const types = [];
  const visit = (node) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== 'object') return;
    if (node['@type']) types.push(...[].concat(node['@type']));
    if (node['@graph']) visit(node['@graph']);
  };
  visit(data);
  return types;
}

/** ハッシュ付きアセット名から論理名を得る（/_astro/hoisted.Dgzzfq7E.js → /_astro/hoisted.js）。 */
export function logicalAssetName(assetPath) {
  const clean = assetPath.split('#')[0].split('?')[0];
  return clean.replace(/\.[A-Za-z0-9_-]{8}(?=\.(?:js|mjs|css|woff2?|ttf|otf)$)/, '');
}

/** インライン <script> / <style> の中身の短いハッシュ（件数が同じでも中身の変化を検出するため）。 */
export function contentHash(text) {
  return createHash('sha256')
    .update(text ?? '')
    .digest('hex')
    .slice(0, 12);
}

/** 重複を数えた差集合（removed: before にだけある要素、added: after にだけある要素）。 */
export function multisetDiff(before, after) {
  const counts = new Map();
  for (const item of before) counts.set(item, (counts.get(item) ?? 0) + 1);
  const added = [];
  for (const item of after) {
    const count = counts.get(item) ?? 0;
    if (count > 0) counts.set(item, count - 1);
    else added.push(item);
  }
  const removed = [...counts].flatMap(([item, count]) => Array(count).fill(item));
  return { removed, added };
}

const collapse = (value) => (value ?? '').replace(/\s+/g, ' ').trim();

const isLocalAsset = (href) => typeof href === 'string' && href.startsWith('/') && !href.startsWith('//');

// 同じ要素が複数あると検索エンジンの扱いが変わる（robots は最も厳しい指定、canonical は無視され得る）。
// 重複自体を差分に出すため、全件を ` | ` で連結して残す。
const joinAll = (values) => (values.length > 0 ? values.join(' | ') : null);

/** og:* / twitter:* の meta を { key: [content...] } にまとめる（キー順は正規化）。 */
function extractSocialMeta(all) {
  const map = {};
  const push = (key, content) => (map[key] ??= []).push(content ?? '');
  for (const meta of all('meta[property^="og:"]')) push(meta.getAttribute('property'), meta.getAttribute('content'));
  for (const meta of all('meta[name^="twitter:"]')) push(meta.getAttribute('name'), meta.getAttribute('content'));
  return normalizeJson(map);
}

function extractJsonLd(all) {
  return all('script[type="application/ld+json"]').map((script) => {
    try {
      const data = JSON.parse(script.textContent ?? '');
      return { types: jsonLdTypes(data), json: normalizeJson(data) };
    } catch (error) {
      return { types: [], error: `invalid JSON: ${error.message}` };
    }
  });
}

function extractInline(all) {
  const scripts = all('script:not([src])').filter(
    (script) => (script.getAttribute('type') ?? '').toLowerCase() !== 'application/ld+json',
  );
  const styles = all('style');
  const bytes = (nodes) => nodes.reduce((total, node) => total + Buffer.byteLength(node.textContent ?? ''), 0);
  return {
    scripts: scripts.length,
    scriptBytes: bytes(scripts),
    scriptHashes: scripts.map((node) => contentHash(node.textContent)),
    styles: styles.length,
    styleBytes: bytes(styles),
    styleHashes: styles.map((node) => contentHash(node.textContent)),
  };
}

/**
 * 1 ページ分の HTML から SEO 要素と参照アセットを抽出する（ファイル I/O なしの純関数）。
 * アセットのサイズ解決は collectSnapshot が行う。
 */
export function extractPageSeo(html) {
  const { document } = new JSDOM(html).window;
  const all = (selector) => [...document.querySelectorAll(selector)];
  const hreflang = all('link[rel~="alternate"][hreflang]')
    .map((link) => ({ lang: link.getAttribute('hreflang') ?? '', href: link.getAttribute('href') ?? '' }))
    .sort((a, b) => a.lang.localeCompare(b.lang) || a.href.localeCompare(b.href));
  return {
    lang: document.documentElement.getAttribute('lang'),
    title: collapse(document.querySelector('title')?.textContent),
    description: joinAll(all('meta[name="description" i]').map((m) => m.getAttribute('content') ?? '')),
    canonical: joinAll(all('link[rel~="canonical"]').map((l) => l.getAttribute('href') ?? '')),
    robots: joinAll(all('meta[name="robots" i]').map((m) => m.getAttribute('content') ?? '')),
    hreflang,
    h1: all('h1').map((h) => collapse(h.textContent)),
    social: extractSocialMeta(all),
    jsonLd: extractJsonLd(all),
    scripts: all('script[src]').map((script) => script.getAttribute('src') ?? ''),
    stylesheets: all('link[rel~="stylesheet"][href]').map((link) => link.getAttribute('href') ?? ''),
    preloads: all('link[rel~="preload"][href], link[rel~="modulepreload"][href]').map((link) => ({
      rel: link.getAttribute('rel') ?? '',
      as: link.getAttribute('as') ?? null,
      href: link.getAttribute('href') ?? '',
    })),
    inline: extractInline(all),
  };
}

/** minify 済み ESM から静的に読み込まれる先を取り出す（動的 import() は遅延読込なので含めない）。 */
export function staticImports(code) {
  const found = new Set();
  const patterns = [
    /\bimport\s*[\w*${},\s]*?\s*from\s*["']([^"']+)["']/g,
    /\bimport\s*["']([^"']+)["']/g,
    // 再エクスポート（export { a } from / export * from）も読み込みを発生させる
    /\bexport\s*(?:\*(?:\s*as\s+[\w$]+)?|\{[^}]*\})\s*from\s*["']([^"']+)["']/g,
  ];
  for (const pattern of patterns) {
    for (const match of code.matchAll(pattern)) found.add(match[1]);
  }
  return [...found];
}

const byLangThenHref = (a, b) => a.hreflang.localeCompare(b.hreflang) || a.href.localeCompare(b.href);

/** sitemap XML から <url> の loc / lastmod / xhtml:link（言語版の代替 URL）を取り出す。 */
export function parseSitemapUrls(xml) {
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, body]) => ({
    loc: body.match(/<loc>([^<]*)<\/loc>/)?.[1] ?? '',
    lastmod: body.match(/<lastmod>([^<]*)<\/lastmod>/)?.[1] ?? null,
    alternates: [...body.matchAll(/<xhtml:link\b([^>]*)>/g)]
      .map(([, attrs]) => ({
        hreflang: attrs.match(/\bhreflang="([^"]*)"/)?.[1] ?? '',
        href: attrs.match(/\bhref="([^"]*)"/)?.[1] ?? '',
      }))
      .sort(byLangThenHref),
  }));
}

/** sitemap-index.xml から <sitemap> の loc / lastmod を取り出す。 */
export function parseSitemapIndex(xml) {
  return [...xml.matchAll(/<sitemap>([\s\S]*?)<\/sitemap>/g)].map(([, body]) => ({
    loc: body.match(/<loc>([^<]*)<\/loc>/)?.[1] ?? '',
    lastmod: body.match(/<lastmod>([^<]*)<\/lastmod>/)?.[1] ?? null,
  }));
}

async function walkFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walkFiles(full)));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

function createAssetLoader(distDir) {
  const cache = new Map();
  return async (assetPath) => {
    if (cache.has(assetPath)) return cache.get(assetPath);
    const file = path.join(distDir, assetPath.split('#')[0].split('?')[0]);
    let info = { raw: null, br: null, code: null };
    if (existsSync(file)) {
      const buffer = await readFile(file);
      const brFile = `${file}.br`;
      const br = existsSync(brFile)
        ? (await readFile(brFile)).length
        : brotliCompressSync(buffer, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 } }).length;
      info = { raw: buffer.length, br, code: assetPath.endsWith('.js') ? buffer.toString('utf8') : null };
    }
    cache.set(assetPath, info);
    return info;
  };
}

function createAssetResolver(distDir) {
  const load = createAssetLoader(distDir);

  // script src と、その静的 import / 再エクスポートを再帰的に辿った JS（ページが実際に読む JS）
  const resolveJs = async (entries) => {
    const seen = new Map();
    const queue = entries.map((src) => ({ src, via: 'script' }));
    while (queue.length > 0) {
      const { src, via } = queue.shift();
      if (seen.has(src)) continue;
      if (!isLocalAsset(src)) {
        seen.set(src, { file: src, raw: null, br: null, via, external: true });
        continue;
      }
      const info = await load(src);
      seen.set(src, { file: src, raw: info.raw, br: info.br, via });
      for (const spec of info.code ? staticImports(info.code) : []) {
        if (!spec.startsWith('.') && !spec.startsWith('/')) continue;
        const resolved = spec.startsWith('/') ? spec : path.posix.join(path.posix.dirname(src), spec);
        queue.push({ src: resolved, via: 'import' });
      }
    }
    return [...seen.values()];
  };

  const resolveCss = (hrefs) =>
    Promise.all(
      hrefs.map(async (href) => {
        if (!isLocalAsset(href)) return { file: href, raw: null, br: null, external: true };
        const info = await load(href);
        return { file: href, raw: info.raw, br: info.br };
      }),
    );

  return { resolveJs, resolveCss };
}

const sumOf = (items, key) => items.reduce((total, item) => total + (item[key] ?? 0), 0);

// 公開ディレクトリ _astro の JS 棚卸し（HTML から参照されないサーバー描画チャンクの検出用）
async function inventoryAstroDir(distDir) {
  const astroDir = path.join(distDir, '_astro');
  const astroJs = existsSync(astroDir) ? (await walkFiles(astroDir)).filter((file) => file.endsWith('.js')).sort() : [];
  const serverChunks = [];
  let jsBytes = 0;
  for (const file of astroJs) {
    const code = await readFile(file, 'utf8');
    jsBytes += Buffer.byteLength(code);
    if (/\bcreateComponent\b|\brenderTemplate\b/.test(code)) {
      serverChunks.push(logicalAssetName(`/${path.relative(distDir, file).split(path.sep).join('/')}`));
    }
  }
  return {
    jsFiles: astroJs.length,
    jsBytes,
    serverChunkFiles: serverChunks.length,
    serverChunks: [...new Set(serverChunks)].sort(),
  };
}

async function collectSiteFiles(distDir) {
  const readIfExists = async (name) => {
    const file = path.join(distDir, name);
    return existsSync(file) ? readFile(file, 'utf8') : null;
  };
  const robotsTxt = await readIfExists('robots.txt');
  const indexXml = await readIfExists('sitemap-index.xml');
  const sitemapFiles = (await readdir(distDir)).filter((name) => /^sitemap-\d+\.xml$/.test(name)).sort();
  const sitemap = [];
  for (const name of sitemapFiles) sitemap.push(...parseSitemapUrls(await readIfExists(name)));
  sitemap.sort((a, b) => a.loc.localeCompare(b.loc));
  return {
    robotsTxt,
    sitemapIndex: indexXml === null ? null : parseSitemapIndex(indexXml),
    sitemap,
    astroDir: await inventoryAstroDir(distDir),
  };
}

/**
 * ビルド条件のメモ（比較の表示にだけ使い、差分判定には使わない）。dist をビルドしたのと同じ作業ツリー・
 * 同じシェルで実行した場合にだけ意味がある（preview 用ビルドとの取り違えを見つけるため）。
 */
function collectBuildMeta(distDir) {
  const git = (args) => {
    try {
      const options = { cwd: path.dirname(distDir), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };
      return execFileSync('git', args, options).trim();
    } catch {
      return null;
    }
  };
  const status = git(['status', '--porcelain']);
  return {
    gitSha: git(['rev-parse', 'HEAD']),
    gitDirty: status === null ? null : status.length > 0,
    publicSiteEnv: process.env.PUBLIC_SITE_ENV ?? null,
  };
}

/** dist ディレクトリ全体のスナップショットを作る。 */
export async function collectSnapshot(distDir) {
  const absoluteDist = path.resolve(distDir);
  const htmlFiles = (await walkFiles(absoluteDist)).filter((file) => file.endsWith('.html')).sort();
  const resolver = createAssetResolver(absoluteDist);
  const pages = {};
  for (const file of htmlFiles) {
    const { scripts, stylesheets, ...seo } = extractPageSeo(await readFile(file, 'utf8'));
    const js = await resolver.resolveJs(scripts);
    const css = await resolver.resolveCss(stylesheets);
    pages[htmlFileToUrlPath(path.relative(absoluteDist, file))] = {
      ...seo,
      assets: {
        js,
        css,
        jsRaw: sumOf(js, 'raw'),
        jsBr: sumOf(js, 'br'),
        cssRaw: sumOf(css, 'raw'),
        cssBr: sumOf(css, 'br'),
      },
    };
  }
  return {
    version: SNAPSHOT_VERSION,
    meta: collectBuildMeta(absoluteDist),
    pageCount: htmlFiles.length,
    site: await collectSiteFiles(absoluteDist),
    pages,
  };
}

// ---------------------------------------------------------------------------
// 差分
// ---------------------------------------------------------------------------

const stableString = (value) => JSON.stringify(value ?? null);
const DISPLAY_WIDTH = 160;

/**
 * 長い値の表示を、最初に異なる位置の前後だけに絞る（短い値はそのまま）。切り詰めは表示にだけ使い、
 * グループ化のキーには全文を使う（末尾だけ違う別々の変更を 1 つにまとめないため）。
 */
export function excerptPair(before, after, { width = DISPLAY_WIDTH, context = 40 } = {}) {
  if (before.length <= width && after.length <= width) return [before, after];
  let index = 0;
  while (index < before.length && index < after.length && before[index] === after[index]) index += 1;
  const start = Math.max(0, index - context);
  const cut = (text) => `${start > 0 ? '…' : ''}${text.slice(start, start + width)}${text.length > start + width ? '…' : ''}`;
  return [cut(before), cut(after)];
}

/** JSON の差分を { path, before, after }（値は JSON 文字列。無い側は null）で返す（配列は添字で比較）。 */
export function diffJsonEntries(before, after, basePath = '$') {
  if (stableString(before) === stableString(after)) return [];
  const isObject = (value) => Boolean(value) && typeof value === 'object';
  if (!isObject(before) || !isObject(after) || Array.isArray(before) !== Array.isArray(after)) {
    return [{ path: basePath, before: stableString(before), after: stableString(after) }];
  }
  const entries = [];
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const childPath = Array.isArray(before) ? `${basePath}[${key}]` : `${basePath}.${key}`;
    if (!(key in before)) entries.push({ path: childPath, before: null, after: stableString(after[key]) });
    else if (!(key in after)) entries.push({ path: childPath, before: stableString(before[key]), after: null });
    else entries.push(...diffJsonEntries(before[key], after[key], childPath));
  }
  return entries;
}

export function formatEntry({ path: entryPath, before, after }) {
  if (before === null) return `${entryPath}: (なし) → ${excerptPair('', after)[1]}`;
  if (after === null) return `${entryPath}: ${excerptPair(before, '')[0]} → (削除)`;
  const [shownBefore, shownAfter] = excerptPair(before, after);
  return `${entryPath}: ${shownBefore} → ${shownAfter}`;
}

/** JSON の差分を「パス: 旧 → 新」の表示行にする。 */
export function diffJson(before, after, basePath = '$') {
  return diffJsonEntries(before, after, basePath).map(formatEntry);
}

/** 値がページ自身の URL と完全一致（引用符込み）する箇所だけを {self} に畳む。部分一致は畳まない。 */
export function foldSelfUrl(text, url) {
  if (text === null) return null;
  return text.split(JSON.stringify(`${SITE_ORIGIN}${url}`)).join('"{self}"');
}

/** 同じ @type の組が複数あっても上書きしないよう、出現順の番号を付けたキーで並べる。 */
export function jsonLdByKey(blocks) {
  const seen = new Map();
  return new Map(
    blocks.map((block) => {
      const type = block.types.join('+') || '(no @type)';
      const count = (seen.get(type) ?? 0) + 1;
      seen.set(type, count);
      return [count === 1 ? type : `${type}#${count}`, block.json ?? block.error];
    }),
  );
}

const assetNames = (list) =>
  list.map((asset) => `${logicalAssetName(asset.file)}${asset.external ? ' (external)' : ''}`).sort();

const preloadNames = (list = []) =>
  list.map((preload) => `${preload.rel} ${preload.as ?? '-'} ${logicalAssetName(preload.href)}`).sort();

const hreflangByLang = (links = []) => {
  const map = {};
  for (const { lang, href } of links) (map[lang] ??= []).push(href);
  return normalizeJson(map);
};

const signed = (delta) => `${delta >= 0 ? '+' : ''}${delta}`;

function createGrouper() {
  const groups = new Map();
  // key はグループ化用の全文、display は表示用（長い値は差分位置の前後だけ）
  const add = (field, url, display, key = display) => {
    const fieldGroups = groups.get(field) ?? new Map();
    const group = fieldGroups.get(key) ?? { detail: display, urls: [] };
    group.urls.push(url);
    fieldGroups.set(key, group);
    groups.set(field, fieldGroups);
  };
  const addEntries = (field, url, entries) => {
    if (entries.length === 0) return;
    const folded = entries.map((entry) => ({
      ...entry,
      before: foldSelfUrl(entry.before, url),
      after: foldSelfUrl(entry.after, url),
    }));
    add(field, url, folded.map(formatEntry).join('\n'), stableString(folded));
  };
  const toObject = () =>
    Object.fromEntries(
      [...groups].map(([field, fieldGroups]) => [
        field,
        [...fieldGroups.values()].sort((a, b) => b.urls.length - a.urls.length || a.detail.localeCompare(b.detail)),
      ]),
    );
  return { add, addEntries, toObject };
}

const PAGE_SCALAR_FIELDS = ['lang', 'title', 'description', 'canonical', 'robots'];

function compareHead(url, before, after, grouper) {
  for (const field of PAGE_SCALAR_FIELDS) {
    grouper.addEntries(field, url, diffJsonEntries(before[field], after[field], field));
  }
  grouper.addEntries('hreflang', url, diffJsonEntries(hreflangByLang(before.hreflang), hreflangByLang(after.hreflang), 'hreflang'));
  grouper.addEntries('h1', url, diffJsonEntries(before.h1, after.h1, 'h1'));
  grouper.addEntries('social', url, diffJsonEntries(before.social ?? {}, after.social ?? {}, 'meta'));
}

function compareJsonLd(url, before, after, grouper) {
  const typesBefore = before.jsonLd.map((block) => block.types.join('+'));
  const typesAfter = after.jsonLd.map((block) => block.types.join('+'));
  if (stableString(typesBefore) !== stableString(typesAfter)) {
    grouper.add('jsonLd.types', url, `${stableString(typesBefore)} → ${stableString(typesAfter)}`);
  }
  const mapBefore = jsonLdByKey(before.jsonLd);
  const entries = [];
  for (const [key, json] of jsonLdByKey(after.jsonLd)) {
    if (mapBefore.has(key)) entries.push(...diffJsonEntries(mapBefore.get(key), json, key));
  }
  grouper.addEntries('jsonLd.content', url, entries);
}

function compareAssets(url, before, after, grouper) {
  for (const kind of ['js', 'css']) {
    const namesBefore = assetNames(before.assets[kind]);
    const namesAfter = assetNames(after.assets[kind]);
    if (stableString(namesBefore) !== stableString(namesAfter)) {
      grouper.add(`assets.${kind}`, url, `${stableString(namesBefore)} → ${stableString(namesAfter)}`);
    }
  }
  // JS と CSS は合算しない（片方が増えて片方が減ると合計では消えるため）
  for (const [key, label, field] of [['jsBr', 'JS', 'assets.jsBytes'], ['cssBr', 'CSS', 'assets.cssBytes']]) {
    const bytesBefore = before.assets[key];
    const bytesAfter = after.assets[key];
    if (bytesBefore !== bytesAfter) {
      grouper.add(field, url, `${label} brotli ${bytesBefore}B → ${bytesAfter}B (${signed(bytesAfter - bytesBefore)}B)`);
    }
  }
  const { removed, added } = multisetDiff(preloadNames(before.preloads), preloadNames(after.preloads));
  if (removed.length + added.length > 0) {
    grouper.add('preloads', url, [...removed.map((x) => `- ${x}`), ...added.map((x) => `+ ${x}`)].join('\n'));
  }
}

function compareInline(url, before, after, grouper) {
  for (const [key, tag] of [['scriptHashes', 'script'], ['styleHashes', 'style']]) {
    const hashesBefore = before.inline[key] ?? [];
    const hashesAfter = after.inline[key] ?? [];
    if (stableString(hashesBefore) === stableString(hashesAfter)) continue;
    const { removed, added } = multisetDiff(hashesBefore, hashesAfter);
    const parts = [`inline <${tag}> ${hashesBefore.length} → ${hashesAfter.length}`];
    if (removed.length > 0) parts.push(`removed ${removed.join(', ')}`);
    if (added.length > 0) parts.push(`added ${added.join(', ')}`);
    if (removed.length + added.length === 0) parts.push('order changed');
    grouper.add('inline', url, parts.join('; '));
  }
}

function compareSitemap(baseSitemap = [], curSitemap = []) {
  const base = new Map(baseSitemap.map((entry) => [entry.loc, entry]));
  const cur = new Map(curSitemap.map((entry) => [entry.loc, entry]));
  const common = [...cur.keys()].filter((loc) => base.has(loc));
  const alternates = (entry) => (entry.alternates ?? []).map((link) => `${link.hreflang} ${link.href}`);
  return {
    before: base.size,
    after: cur.size,
    added: [...cur.keys()].filter((loc) => !base.has(loc)).sort(),
    removed: [...base.keys()].filter((loc) => !cur.has(loc)).sort(),
    lastmodChanged: common.filter((loc) => base.get(loc).lastmod !== cur.get(loc).lastmod).length,
    distinctLastmodBefore: new Set(baseSitemap.map((entry) => entry.lastmod)).size,
    distinctLastmodAfter: new Set(curSitemap.map((entry) => entry.lastmod)).size,
    alternatesChanged: common.flatMap((loc) => {
      const { removed, added } = multisetDiff(alternates(base.get(loc)), alternates(cur.get(loc)));
      return removed.length + added.length > 0 ? [{ loc, removed, added }] : [];
    }),
  };
}

function compareSitemapIndex(before, after) {
  const base = new Map((before ?? []).map((entry) => [entry.loc, entry.lastmod]));
  const cur = new Map((after ?? []).map((entry) => [entry.loc, entry.lastmod]));
  return {
    before: base.size,
    after: cur.size,
    added: [...cur.keys()].filter((loc) => !base.has(loc)).sort(),
    removed: [...base.keys()].filter((loc) => !cur.has(loc)).sort(),
    lastmodChanged: [...cur.keys()].filter((loc) => base.has(loc) && base.get(loc) !== cur.get(loc)).sort(),
  };
}

function compareSite(baseSite = {}, curSite = {}) {
  return {
    robotsTxt:
      baseSite.robotsTxt === curSite.robotsTxt ? null : { before: baseSite.robotsTxt, after: curSite.robotsTxt },
    sitemapIndex: compareSitemapIndex(baseSite.sitemapIndex, curSite.sitemapIndex),
    sitemap: compareSitemap(baseSite.sitemap, curSite.sitemap),
    astroDir: { before: baseSite.astroDir ?? null, after: curSite.astroDir ?? null },
  };
}

/** 2 つのスナップショットの差分。フィールドごとに「同じ変化」をまとめ、ページ数の多い順に並べる。 */
export function diffSnapshots(baseline, current) {
  if (baseline.version !== current.version) {
    throw new Error(
      `snapshot version mismatch (baseline v${baseline.version ?? '?'}, current v${current.version ?? '?'}). ` +
        'Regenerate the baseline with the same seo-snapshot.mjs.',
    );
  }
  const basePages = baseline.pages ?? {};
  const curPages = current.pages ?? {};
  const grouper = createGrouper();
  for (const url of Object.keys(curPages).sort()) {
    if (!(url in basePages)) continue;
    const [before, after] = [basePages[url], curPages[url]];
    compareHead(url, before, after, grouper);
    compareJsonLd(url, before, after, grouper);
    compareAssets(url, before, after, grouper);
    compareInline(url, before, after, grouper);
  }
  return {
    meta: { before: baseline.meta ?? null, after: current.meta ?? null },
    pages: {
      before: Object.keys(basePages).length,
      after: Object.keys(curPages).length,
      added: Object.keys(curPages).filter((url) => !(url in basePages)).sort(),
      removed: Object.keys(basePages).filter((url) => !(url in curPages)).sort(),
    },
    fields: grouper.toObject(),
    site: compareSite(baseline.site, current.site),
  };
}

/** 差分が 1 つでもあるか（--fail-on-diff の判定）。 */
export function hasDifferences(diff) {
  const { pages, fields, site } = diff;
  const index = site.sitemapIndex;
  const sitemap = site.sitemap;
  return (
    pages.added.length + pages.removed.length > 0 ||
    Object.keys(fields).length > 0 ||
    site.robotsTxt !== null ||
    index.added.length + index.removed.length + index.lastmodChanged.length > 0 ||
    sitemap.added.length + sitemap.removed.length + sitemap.lastmodChanged + sitemap.alternatesChanged.length > 0 ||
    stableString(site.astroDir.before) !== stableString(site.astroDir.after)
  );
}

const listWithMore = (list, limit) =>
  `${list.slice(0, limit).join(', ')}${list.length > limit ? ` …(+${list.length - limit})` : ''}`;

const formatMeta = (meta) =>
  meta
    ? `git ${meta.gitSha ? meta.gitSha.slice(0, 7) : '?'}${meta.gitDirty ? '+dirty' : ''}, PUBLIC_SITE_ENV=${meta.publicSiteEnv ?? '(unset)'}`
    : '(記録なし)';

function formatFields(fields, out, { maxGroups, maxUrls }) {
  if (Object.keys(fields).length === 0) out.push('\n(ページ単位の差分なし)');
  for (const [field, fieldGroups] of Object.entries(fields)) {
    const pageTotal = fieldGroups.reduce((total, group) => total + group.urls.length, 0);
    out.push(`\n[${field}] ${pageTotal} page(s), ${fieldGroups.length} distinct change(s)`);
    for (const group of fieldGroups.slice(0, maxGroups)) {
      out.push(`  - ${group.urls.length} page(s): ${listWithMore(group.urls, maxUrls)}`);
      for (const line of group.detail.split('\n')) out.push(`      ${line}`);
    }
    if (fieldGroups.length > maxGroups) out.push(`  … (+${fieldGroups.length - maxGroups} more distinct changes)`);
  }
}

function formatSite(site, out) {
  out.push('\n[site]');
  if (site.robotsTxt) {
    out.push('  robots.txt changed:', '  --- before');
    for (const line of (site.robotsTxt.before ?? '(none)').split('\n')) out.push(`  | ${line}`);
    out.push('  --- after');
    for (const line of (site.robotsTxt.after ?? '(none)').split('\n')) out.push(`  | ${line}`);
  } else {
    out.push('  robots.txt: unchanged');
  }
  const index = site.sitemapIndex;
  out.push(
    `  sitemap-index: ${index.before} → ${index.after} sitemaps (added ${index.added.length}, removed ${index.removed.length}, lastmod changed ${index.lastmodChanged.length})`,
  );
  for (const [label, list] of [['added', index.added], ['removed', index.removed]]) {
    if (list.length > 0) out.push(`    ${label}: ${listWithMore(list, 5)}`);
  }
  const sm = site.sitemap;
  out.push(
    `  sitemap: ${sm.before} → ${sm.after} URLs (added ${sm.added.length}, removed ${sm.removed.length}, lastmod changed ${sm.lastmodChanged}; distinct lastmod values ${sm.distinctLastmodBefore} → ${sm.distinctLastmodAfter}; hreflang alternates changed ${sm.alternatesChanged.length})`,
  );
  if (sm.added.length > 0) out.push(`    added: ${listWithMore(sm.added, 15)}`);
  if (sm.removed.length > 0) out.push(`    removed: ${listWithMore(sm.removed, 15)}`);
  for (const change of sm.alternatesChanged.slice(0, 5)) {
    out.push(`    alternates ${change.loc}: ${[...change.removed.map((x) => `- ${x}`), ...change.added.map((x) => `+ ${x}`)].join(' / ')}`);
  }
  const { before, after } = site.astroDir;
  if (before && after) {
    out.push(
      `  _astro JS: ${before.jsFiles} → ${after.jsFiles} files, ${before.jsBytes} → ${after.jsBytes} bytes; server-render chunk files ${before.serverChunkFiles} → ${after.serverChunkFiles}`,
    );
  }
}

/** diffSnapshots の結果を人が読むテキストにする。 */
export function formatDiff(diff, { maxGroups = 12, maxUrls = 4 } = {}) {
  const out = ['== SEO snapshot diff =='];
  out.push(`baseline: ${formatMeta(diff.meta.before)}`, `current:  ${formatMeta(diff.meta.after)}`);
  const { pages } = diff;
  out.push(`pages: ${pages.before} → ${pages.after} (added ${pages.added.length}, removed ${pages.removed.length})`);
  if (pages.added.length > 0) out.push(`  added: ${listWithMore(pages.added, 20)}`);
  if (pages.removed.length > 0) out.push(`  removed: ${listWithMore(pages.removed, 20)}`);
  formatFields(diff.fields, out, { maxGroups, maxUrls });
  formatSite(diff.site, out);
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export function parseArgs(argv) {
  const args = { dist: 'dist', out: null, compare: null, current: null, failOnDiff: false };
  const valueFlags = { '--dist': 'dist', '--out': 'out', '--compare': 'compare', '--current': 'current' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--fail-on-diff') {
      args.failOnDiff = true;
      continue;
    }
    const key = valueFlags[argv[i]];
    const value = argv[i + 1];
    if (!key || value === undefined || value.startsWith('--')) throw new Error(`invalid argument: ${argv[i]}`);
    args[key] = value;
    i += 1;
  }
  if (args.failOnDiff && !args.compare) throw new Error('--fail-on-diff requires --compare');
  return args;
}

/** 戻り値は終了コード（0: 差分なし・比較なし、1: --fail-on-diff で差分あり）。 */
export async function runCli(argv) {
  const args = parseArgs(argv);
  const current = args.current
    ? JSON.parse(await readFile(args.current, 'utf8'))
    : await collectSnapshot(args.dist);
  if (args.out) await writeFile(args.out, `${JSON.stringify(current, null, 2)}\n`);
  if (!args.compare) {
    if (!args.out) process.stdout.write(`${JSON.stringify(current, null, 2)}\n`);
    return 0;
  }
  const diff = diffSnapshots(JSON.parse(await readFile(args.compare, 'utf8')), current);
  process.stdout.write(`${formatDiff(diff)}\n`);
  return args.failOnDiff && hasDifferences(diff) ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runCli(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      process.stderr.write(`seo-snapshot: ${error.stack ?? error}\n`);
      process.exitCode = 2;
    });
}
