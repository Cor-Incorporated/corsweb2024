#!/usr/bin/env node
// SEO/AIO スナップショット。
//
// dist の全 HTML から、検索エンジン / AI クローラーが読む要素（URL・title・meta description・
// canonical・hreflang・meta robots・h1・JSON-LD）と、そのページが読み込む JS/CSS（raw / brotli
// サイズ）を抽出して JSON にする。`--compare <baseline.json>` を付けると、ベースラインとの差分を
// 「どのフィールドが・何ページで・どう変わったか」の形で出力する。
//
// 使い方:
//   npm run build
//   npm run seo:snapshot -- --out snapshot.json            # dist → JSON
//   npm run seo:snapshot -- --compare baseline.json        # dist とベースラインの差分
//   npm run seo:snapshot -- --compare a.json --current b.json
//
// 目的は「意図した差分だけが出ていること」をブランチごとに確認すること。宣言（設定・コンポーネント）
// を変えたら、それを実際に読む側（HTML / sitemap / robots.txt）の出力で確かめる。
import { existsSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { brotliCompressSync, constants as zlibConstants } from 'node:zlib';
import { JSDOM } from 'jsdom';

export const SNAPSHOT_VERSION = 1;
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
  return clean.replace(/\.[A-Za-z0-9_-]{8}(?=\.(?:js|mjs|css)$)/, '');
}

const collapse = (value) => (value ?? '').replace(/\s+/g, ' ').trim();

const isLocalAsset = (href) => typeof href === 'string' && href.startsWith('/') && !href.startsWith('//');

/**
 * 1 ページ分の HTML から SEO 要素と参照アセットを抽出する（ファイル I/O なしの純関数）。
 * アセットのサイズ解決は collectSnapshot が行う。
 */
export function extractPageSeo(html) {
  const { document } = new JSDOM(html).window;
  const all = (selector) => [...document.querySelectorAll(selector)];
  const robots = all('meta[name="robots" i]').map((m) => m.getAttribute('content') ?? '');

  const hreflang = all('link[rel~="alternate"][hreflang]')
    .map((link) => ({ lang: link.getAttribute('hreflang') ?? '', href: link.getAttribute('href') ?? '' }))
    .sort((a, b) => a.lang.localeCompare(b.lang) || a.href.localeCompare(b.href));

  const jsonLd = all('script[type="application/ld+json"]').map((script) => {
    try {
      const data = JSON.parse(script.textContent ?? '');
      return { types: jsonLdTypes(data), json: normalizeJson(data) };
    } catch (error) {
      return { types: [], error: `invalid JSON: ${error.message}` };
    }
  });

  const inlineScripts = all('script:not([src])').filter(
    (script) => (script.getAttribute('type') ?? '').toLowerCase() !== 'application/ld+json',
  );
  const styles = all('style');

  return {
    lang: document.documentElement.getAttribute('lang'),
    title: collapse(document.querySelector('title')?.textContent),
    description: document.querySelector('meta[name="description" i]')?.getAttribute('content') ?? null,
    canonical: document.querySelector('link[rel~="canonical"]')?.getAttribute('href') ?? null,
    // 複数あると検索エンジンは最も厳しい指定を採る。重複自体を差分に出すため連結して残す。
    robots: robots.length > 0 ? robots.join(' | ') : null,
    hreflang,
    h1: all('h1').map((h) => collapse(h.textContent)),
    jsonLd,
    scripts: all('script[src]').map((script) => script.getAttribute('src') ?? ''),
    stylesheets: all('link[rel~="stylesheet"][href]').map((link) => link.getAttribute('href') ?? ''),
    preloads: all('link[rel~="preload"][href], link[rel~="modulepreload"][href]').map((link) => ({
      rel: link.getAttribute('rel') ?? '',
      as: link.getAttribute('as') ?? null,
      href: link.getAttribute('href') ?? '',
    })),
    inline: {
      scripts: inlineScripts.length,
      scriptBytes: inlineScripts.reduce((total, s) => total + Buffer.byteLength(s.textContent ?? ''), 0),
      styles: styles.length,
      styleBytes: styles.reduce((total, s) => total + Buffer.byteLength(s.textContent ?? ''), 0),
    },
  };
}

/** minify 済み ESM から静的 import 先を取り出す（動的 import() は遅延読込なので含めない）。 */
export function staticImports(code) {
  const found = new Set();
  const patterns = [/\bimport\s*[\w*${},\s]*?\s*from\s*["']([^"']+)["']/g, /\bimport\s*["']([^"']+)["']/g];
  for (const pattern of patterns) {
    for (const match of code.matchAll(pattern)) found.add(match[1]);
  }
  return [...found];
}

/** sitemap XML から <url> の loc / lastmod を取り出す。 */
export function parseSitemapUrls(xml) {
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, body]) => ({
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

function createAssetResolver(distDir) {
  const cache = new Map();
  const load = async (assetPath) => {
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

  // script src と、その静的 import を再帰的に辿った JS（ページが実際に読む JS）
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

async function collectSiteFiles(distDir) {
  const robotsFile = path.join(distDir, 'robots.txt');
  const robotsTxt = existsSync(robotsFile) ? await readFile(robotsFile, 'utf8') : null;
  const sitemapFiles = (await readdir(distDir)).filter((name) => /^sitemap-\d+\.xml$/.test(name)).sort();
  const sitemap = [];
  for (const name of sitemapFiles) {
    sitemap.push(...parseSitemapUrls(await readFile(path.join(distDir, name), 'utf8')));
  }
  sitemap.sort((a, b) => a.loc.localeCompare(b.loc));

  // 公開ディレクトリ _astro の JS 棚卸し（HTML から参照されないサーバー描画チャンクの検出用）
  const astroDir = path.join(distDir, '_astro');
  const astroJs = existsSync(astroDir)
    ? (await walkFiles(astroDir)).filter((file) => file.endsWith('.js')).sort()
    : [];
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
    robotsTxt,
    sitemap,
    astroDir: {
      jsFiles: astroJs.length,
      jsBytes,
      serverChunkFiles: serverChunks.length,
      serverChunks: [...new Set(serverChunks)].sort(),
    },
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
    pageCount: htmlFiles.length,
    site: await collectSiteFiles(absoluteDist),
    pages,
  };
}

// ---------------------------------------------------------------------------
// 差分
// ---------------------------------------------------------------------------

const stableString = (value) => JSON.stringify(value ?? null);

function truncate(value, max = 160) {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/** JSON の差分を「パス: 旧 → 新」の行にする（配列は添字で比較）。 */
export function diffJson(before, after, basePath = '$') {
  if (stableString(before) === stableString(after)) return [];
  const isObject = (value) => Boolean(value) && typeof value === 'object';
  if (!isObject(before) || !isObject(after) || Array.isArray(before) !== Array.isArray(after)) {
    return [`${basePath}: ${truncate(stableString(before))} → ${truncate(stableString(after))}`];
  }
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const lines = [];
  for (const key of keys) {
    const childPath = Array.isArray(before) ? `${basePath}[${key}]` : `${basePath}.${key}`;
    if (!(key in before)) lines.push(`${childPath}: (なし) → ${truncate(stableString(after[key]))}`);
    else if (!(key in after)) lines.push(`${childPath}: ${truncate(stableString(before[key]))} → (削除)`);
    else lines.push(...diffJson(before[key], after[key], childPath));
  }
  return lines;
}

const assetNames = (list) =>
  list.map((asset) => `${logicalAssetName(asset.file)}${asset.external ? ' (external)' : ''}`).sort();

const PAGE_FIELDS = ['lang', 'title', 'description', 'canonical', 'robots', 'hreflang', 'h1'];

function comparePage(url, before, after, addGroup) {
  for (const field of PAGE_FIELDS) {
    if (stableString(before[field]) !== stableString(after[field])) {
      addGroup(field, url, `${truncate(stableString(before[field]))} → ${truncate(stableString(after[field]))}`);
    }
  }
  const typesBefore = before.jsonLd.map((block) => block.types.join('+'));
  const typesAfter = after.jsonLd.map((block) => block.types.join('+'));
  if (stableString(typesBefore) !== stableString(typesAfter)) {
    addGroup('jsonLd.types', url, `${stableString(typesBefore)} → ${stableString(typesAfter)}`);
  }
  // 同じ @type の組を持つブロック同士で中身を比べる。ページ固有 URL は {self} に畳んで同種の変化を束ねる。
  const byType = (blocks) => new Map(blocks.map((block, i) => [block.types.join('+') || `#${i}`, block.json ?? block.error]));
  const mapBefore = byType(before.jsonLd);
  for (const [type, json] of byType(after.jsonLd)) {
    if (!mapBefore.has(type)) continue;
    const lines = diffJson(mapBefore.get(type), json, type).map((line) =>
      line.split(`${SITE_ORIGIN}${url}`).join('{self}'),
    );
    if (lines.length > 0) addGroup('jsonLd.content', url, lines.join('\n'));
  }
  for (const kind of ['js', 'css']) {
    const namesBefore = assetNames(before.assets[kind]);
    const namesAfter = assetNames(after.assets[kind]);
    if (stableString(namesBefore) !== stableString(namesAfter)) {
      addGroup(`assets.${kind}`, url, `${stableString(namesBefore)} → ${stableString(namesAfter)}`);
    }
  }
  const brBefore = before.assets.jsBr + before.assets.cssBr;
  const brAfter = after.assets.jsBr + after.assets.cssBr;
  if (brBefore !== brAfter) {
    const delta = brAfter - brBefore;
    addGroup('assets.bytes', url, `JS+CSS brotli ${brBefore}B → ${brAfter}B (${delta >= 0 ? '+' : ''}${delta}B)`);
  }
  for (const key of ['scripts', 'styles']) {
    if (before.inline[key] !== after.inline[key]) {
      addGroup('inline', url, `inline <${key === 'scripts' ? 'script' : 'style'}> ${before.inline[key]} → ${after.inline[key]}`);
    }
  }
}

function compareSite(baseSite = {}, curSite = {}) {
  const baseLocs = new Map((baseSite.sitemap ?? []).map((entry) => [entry.loc, entry.lastmod]));
  const curLocs = new Map((curSite.sitemap ?? []).map((entry) => [entry.loc, entry.lastmod]));
  return {
    robotsTxt:
      baseSite.robotsTxt === curSite.robotsTxt ? null : { before: baseSite.robotsTxt, after: curSite.robotsTxt },
    sitemap: {
      before: baseLocs.size,
      after: curLocs.size,
      added: [...curLocs.keys()].filter((loc) => !baseLocs.has(loc)).sort(),
      removed: [...baseLocs.keys()].filter((loc) => !curLocs.has(loc)).sort(),
      lastmodChanged: [...curLocs.keys()].filter((loc) => baseLocs.has(loc) && baseLocs.get(loc) !== curLocs.get(loc))
        .length,
      distinctLastmodBefore: new Set(baseLocs.values()).size,
      distinctLastmodAfter: new Set(curLocs.values()).size,
    },
    astroDir: { before: baseSite.astroDir ?? null, after: curSite.astroDir ?? null },
  };
}

/** 2 つのスナップショットの差分。フィールドごとに「同じ変化」をまとめ、ページ数の多い順に並べる。 */
export function diffSnapshots(baseline, current) {
  const basePages = baseline.pages ?? {};
  const curPages = current.pages ?? {};
  const groups = new Map();
  const addGroup = (field, url, detail) => {
    const fieldGroups = groups.get(field) ?? new Map();
    const group = fieldGroups.get(detail) ?? { detail, urls: [] };
    group.urls.push(url);
    fieldGroups.set(detail, group);
    groups.set(field, fieldGroups);
  };
  for (const url of Object.keys(curPages).sort()) {
    if (url in basePages) comparePage(url, basePages[url], curPages[url], addGroup);
  }
  const fields = Object.fromEntries(
    [...groups].map(([field, fieldGroups]) => [
      field,
      [...fieldGroups.values()].sort((a, b) => b.urls.length - a.urls.length || a.detail.localeCompare(b.detail)),
    ]),
  );
  return {
    pages: {
      before: Object.keys(basePages).length,
      after: Object.keys(curPages).length,
      added: Object.keys(curPages).filter((url) => !(url in basePages)).sort(),
      removed: Object.keys(basePages).filter((url) => !(url in curPages)).sort(),
    },
    fields,
    site: compareSite(baseline.site, current.site),
  };
}

const listWithMore = (list, limit) =>
  `${list.slice(0, limit).join(', ')}${list.length > limit ? ` …(+${list.length - limit})` : ''}`;

/** diffSnapshots の結果を人が読むテキストにする。 */
export function formatDiff(diff, { maxGroups = 12, maxUrls = 4 } = {}) {
  const out = ['== SEO snapshot diff =='];
  const { pages, fields, site } = diff;
  out.push(`pages: ${pages.before} → ${pages.after} (added ${pages.added.length}, removed ${pages.removed.length})`);
  if (pages.added.length > 0) out.push(`  added: ${listWithMore(pages.added, 20)}`);
  if (pages.removed.length > 0) out.push(`  removed: ${listWithMore(pages.removed, 20)}`);
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
  out.push('\n[site]');
  if (site.robotsTxt) {
    out.push('  robots.txt changed:', '  --- before');
    for (const line of (site.robotsTxt.before ?? '(none)').split('\n')) out.push(`  | ${line}`);
    out.push('  --- after');
    for (const line of (site.robotsTxt.after ?? '(none)').split('\n')) out.push(`  | ${line}`);
  } else {
    out.push('  robots.txt: unchanged');
  }
  const sm = site.sitemap;
  out.push(
    `  sitemap: ${sm.before} → ${sm.after} URLs (added ${sm.added.length}, removed ${sm.removed.length}, lastmod changed ${sm.lastmodChanged}; distinct lastmod values ${sm.distinctLastmodBefore} → ${sm.distinctLastmodAfter})`,
  );
  if (sm.added.length > 0) out.push(`    added: ${listWithMore(sm.added, 15)}`);
  if (sm.removed.length > 0) out.push(`    removed: ${listWithMore(sm.removed, 15)}`);
  const { before, after } = site.astroDir;
  if (before && after) {
    out.push(
      `  _astro JS: ${before.jsFiles} → ${after.jsFiles} files, ${before.jsBytes} → ${after.jsBytes} bytes; server-render chunk files ${before.serverChunkFiles} → ${after.serverChunkFiles}`,
    );
  }
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export function parseArgs(argv) {
  const args = { dist: 'dist', out: null, compare: null, current: null };
  const flags = { '--dist': 'dist', '--out': 'out', '--compare': 'compare', '--current': 'current' };
  for (let i = 0; i < argv.length; i += 2) {
    const key = flags[argv[i]];
    if (!key || argv[i + 1] === undefined) throw new Error(`invalid argument: ${argv[i]}`);
    args[key] = argv[i + 1];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const current = args.current
    ? JSON.parse(await readFile(args.current, 'utf8'))
    : await collectSnapshot(args.dist);
  if (args.out) await writeFile(args.out, `${JSON.stringify(current, null, 2)}\n`);
  if (args.compare) {
    const baseline = JSON.parse(await readFile(args.compare, 'utf8'));
    process.stdout.write(`${formatDiff(diffSnapshots(baseline, current))}\n`);
  } else if (!args.out) {
    process.stdout.write(`${JSON.stringify(current, null, 2)}\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`seo-snapshot: ${error.stack ?? error}\n`);
    process.exit(1);
  });
}
