// SEO スナップショットのうち、ページ単位ではない「サイト全体」の要素（robots.txt・sitemap-index・
// sitemap とその hreflang・RSS フィード・公開 _astro の JS 棚卸し）の収集と比較。
// 本体は scripts/seo-snapshot.mjs（ページ単位の抽出・比較と CLI）。
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const stableString = (value) => JSON.stringify(value ?? null);

/** ハッシュ付きアセット名から論理名を得る（/_astro/hoisted.Dgzzfq7E.js → /_astro/hoisted.js）。 */
export function logicalAssetName(assetPath) {
  const clean = assetPath.split('#')[0].split('?')[0];
  return clean.replace(/\.[A-Za-z0-9_-]{8}(?=\.(?:js|mjs|css|woff2?|ttf|otf)$)/, '');
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

export const listWithMore = (list, limit) =>
  `${list.slice(0, limit).join(', ')}${list.length > limit ? ` …(+${list.length - limit})` : ''}`;

export async function walkFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walkFiles(full)));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

const byRelThenLang = (a, b) =>
  a.rel.localeCompare(b.rel) || a.hreflang.localeCompare(b.hreflang) || a.href.localeCompare(b.href);

/** sitemap XML から <url> の loc / lastmod / xhtml:link（rel・言語・代替 URL）を取り出す。 */
export function parseSitemapUrls(xml) {
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, body]) => ({
    loc: body.match(/<loc>([^<]*)<\/loc>/)?.[1] ?? '',
    lastmod: body.match(/<lastmod>([^<]*)<\/lastmod>/)?.[1] ?? null,
    // rel も残す（alternate 以外に変わるとクローラーは言語版として扱わないため、比較対象にする）
    alternates: [...body.matchAll(/<xhtml:link\b([^>]*)>/g)]
      .map(([, attrs]) => ({
        rel: attrs.match(/\brel="([^"]*)"/)?.[1] ?? '',
        hreflang: attrs.match(/\bhreflang="([^"]*)"/)?.[1] ?? '',
        href: attrs.match(/\bhref="([^"]*)"/)?.[1] ?? '',
      }))
      .sort(byRelThenLang),
  }));
}

/** sitemap-index.xml から <sitemap> の loc / lastmod を取り出す。 */
export function parseSitemapIndex(xml) {
  return [...xml.matchAll(/<sitemap>([\s\S]*?)<\/sitemap>/g)].map(([, body]) => ({
    loc: body.match(/<loc>([^<]*)<\/loc>/)?.[1] ?? '',
    lastmod: body.match(/<lastmod>([^<]*)<\/lastmod>/)?.[1] ?? null,
  }));
}

const unwrapCdata = (text) => text.replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1').trim();
const firstTag = (body, name) => {
  const match = body.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return match ? unwrapCdata(match[1]) : null;
};

/**
 * RSS 2.0 のチャンネル情報と item（title / link / guid / pubDate / category）を取り出す。
 * lastBuildDate・copyright の年のようにビルド時刻で変わる値は比較が揺れるため取り込まない。
 */
export function parseFeed(xml) {
  const channelHead = xml.replace(/<item>[\s\S]*?<\/item>/g, '');
  return {
    title: firstTag(channelHead, 'title'),
    description: firstTag(channelHead, 'description'),
    link: firstTag(channelHead, 'link'),
    language: firstTag(channelHead, 'language'),
    items: [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, body]) => ({
      title: firstTag(body, 'title'),
      link: firstTag(body, 'link'),
      guid: firstTag(body, 'guid'),
      pubDate: firstTag(body, 'pubDate'),
      categories: [...body.matchAll(/<category(?:\s[^>]*)?>([\s\S]*?)<\/category>/g)].map(([, text]) => unwrapCdata(text)),
    })),
  };
}

// 目印（createComponent / renderTemplate）による旧来の判定。#337 は「どの HTML からも辿れない _astro/*.js」
// （scripts/dist-bundle-reachability.mjs の findUnreachableBundles）で判定しており、定義が異なる
// （修正前ビルドで目印あり 122 本に対し、到達不能は 333 本）。#337 のマージ後にそちらへ揃える。
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

/** robots.txt / sitemap-index / sitemap / RSS フィード（rss.xml・news.xml）/ _astro の JS を集める。 */
export async function collectSiteFiles(distDir, allFiles) {
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
  const feeds = {};
  for (const file of allFiles.filter((name) => /(^|[\\/])(rss|news)\.xml$/.test(name)).sort()) {
    feeds[`/${path.relative(distDir, file).split(path.sep).join('/')}`] = parseFeed(await readFile(file, 'utf8'));
  }
  return {
    robotsTxt,
    sitemapIndex: indexXml === null ? null : parseSitemapIndex(indexXml),
    sitemap,
    feeds,
    astroDir: await inventoryAstroDir(distDir),
  };
}

/** 全 URL が同じ lastmod なら、それはビルド時刻（astro.config の `lastmod: new Date()`）とみなして返す。 */
const buildTimeLastmod = (sitemap) => {
  const values = new Set(sitemap.map((entry) => entry.lastmod));
  return sitemap.length > 1 && values.size === 1 ? [...values][0] : undefined;
};

function compareSitemap(baseSitemap = [], curSitemap = []) {
  const base = new Map(baseSitemap.map((entry) => [entry.loc, entry]));
  const cur = new Map(curSitemap.map((entry) => [entry.loc, entry]));
  const common = [...cur.keys()].filter((loc) => base.has(loc));
  const alternates = (entry) => (entry.alternates ?? []).map((link) => `${link.rel ?? ''} ${link.hreflang} ${link.href}`);
  const [baseStamp, curStamp] = [buildTimeLastmod(baseSitemap), buildTimeLastmod(curSitemap)];
  const lastmodDiffs = common.filter((loc) => base.get(loc).lastmod !== cur.get(loc).lastmod);
  // 両側ともビルド時刻の一律 lastmod どうしの変化は、別々にビルドしただけで必ず出るので差分判定から外す
  const buildTimeOnly = (loc) =>
    baseStamp !== undefined && curStamp !== undefined && base.get(loc).lastmod === baseStamp && cur.get(loc).lastmod === curStamp;
  return {
    before: base.size,
    after: cur.size,
    added: [...cur.keys()].filter((loc) => !base.has(loc)).sort(),
    removed: [...base.keys()].filter((loc) => !cur.has(loc)).sort(),
    lastmodChanged: lastmodDiffs.filter((loc) => !buildTimeOnly(loc)).length,
    lastmodBuildTimeOnly: lastmodDiffs.filter(buildTimeOnly).length,
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

function compareFeed(before, after) {
  const lines = [];
  for (const key of ['title', 'description', 'link', 'language']) {
    if (before[key] !== after[key]) lines.push(`${key}: ${stableString(before[key])} → ${stableString(after[key])}`);
  }
  const itemKey = (item) => item.guid ?? item.link ?? item.title ?? '';
  const baseItems = new Map(before.items.map((item) => [itemKey(item), item]));
  const curItems = new Map(after.items.map((item) => [itemKey(item), item]));
  if (before.items.length !== after.items.length) lines.push(`items: ${before.items.length} → ${after.items.length}`);
  for (const [key, item] of curItems) {
    if (!baseItems.has(key)) lines.push(`+ ${key}`);
    else if (stableString(baseItems.get(key)) !== stableString(item)) lines.push(`~ ${key}`);
  }
  for (const key of baseItems.keys()) if (!curItems.has(key)) lines.push(`- ${key}`);
  return lines;
}

function compareFeeds(before = {}, after = {}) {
  const feedPaths = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return feedPaths.flatMap((feedPath) => {
    if (!before[feedPath] || !after[feedPath]) return [{ feed: feedPath, lines: [before[feedPath] ? 'removed' : 'added'] }];
    const lines = compareFeed(before[feedPath], after[feedPath]);
    return lines.length > 0 ? [{ feed: feedPath, lines }] : [];
  });
}

export function compareSite(baseSite = {}, curSite = {}) {
  return {
    robotsTxt:
      baseSite.robotsTxt === curSite.robotsTxt ? null : { before: baseSite.robotsTxt, after: curSite.robotsTxt },
    sitemapIndex: compareSitemapIndex(baseSite.sitemapIndex, curSite.sitemapIndex),
    sitemap: compareSitemap(baseSite.sitemap, curSite.sitemap),
    feeds: compareFeeds(baseSite.feeds, curSite.feeds),
    astroDir: { before: baseSite.astroDir ?? null, after: curSite.astroDir ?? null },
  };
}

/** サイト全体の要素に差分があるか（--fail-on-diff の判定。ビルド時刻だけの lastmod の変化は除く）。 */
export function siteHasDifferences(site) {
  const { sitemapIndex: index, sitemap } = site;
  return (
    site.robotsTxt !== null ||
    index.added.length + index.removed.length + index.lastmodChanged.length > 0 ||
    sitemap.added.length + sitemap.removed.length + sitemap.lastmodChanged + sitemap.alternatesChanged.length > 0 ||
    site.feeds.length > 0 ||
    stableString(site.astroDir.before) !== stableString(site.astroDir.after)
  );
}

function formatSitemaps(site, out) {
  const index = site.sitemapIndex;
  out.push(
    `  sitemap-index: ${index.before} → ${index.after} sitemaps (added ${index.added.length}, removed ${index.removed.length}, lastmod changed ${index.lastmodChanged.length})`,
  );
  for (const [label, list] of [['added', index.added], ['removed', index.removed]]) {
    if (list.length > 0) out.push(`    ${label}: ${listWithMore(list, 5)}`);
  }
  const sm = site.sitemap;
  out.push(
    `  sitemap: ${sm.before} → ${sm.after} URLs (added ${sm.added.length}, removed ${sm.removed.length}, lastmod changed ${sm.lastmodChanged} (+${sm.lastmodBuildTimeOnly} build-time only); distinct lastmod values ${sm.distinctLastmodBefore} → ${sm.distinctLastmodAfter}; hreflang alternates changed ${sm.alternatesChanged.length})`,
  );
  if (sm.added.length > 0) out.push(`    added: ${listWithMore(sm.added, 15)}`);
  if (sm.removed.length > 0) out.push(`    removed: ${listWithMore(sm.removed, 15)}`);
  for (const change of sm.alternatesChanged.slice(0, 5)) {
    out.push(`    alternates ${change.loc}: ${[...change.removed.map((x) => `- ${x}`), ...change.added.map((x) => `+ ${x}`)].join(' / ')}`);
  }
}

export function formatSite(site, out) {
  out.push('\n[site]');
  if (site.robotsTxt) {
    out.push('  robots.txt changed:', '  --- before');
    for (const line of (site.robotsTxt.before ?? '(none)').split('\n')) out.push(`  | ${line}`);
    out.push('  --- after');
    for (const line of (site.robotsTxt.after ?? '(none)').split('\n')) out.push(`  | ${line}`);
  } else {
    out.push('  robots.txt: unchanged');
  }
  formatSitemaps(site, out);
  out.push(`  feeds: ${site.feeds.length === 0 ? 'unchanged' : `${site.feeds.length} changed`}`);
  for (const change of site.feeds) out.push(`    ${change.feed}: ${listWithMore(change.lines, 6)}`);
  const { before, after } = site.astroDir;
  if (before && after) {
    out.push(
      `  _astro JS: ${before.jsFiles} → ${after.jsFiles} files, ${before.jsBytes} → ${after.jsBytes} bytes; server-render chunk files ${before.serverChunkFiles} → ${after.serverChunkFiles}`,
    );
    // 件数や容量が同じでも名前が変わると差分判定に掛かるため、変わった名前を出す
    const { removed, added } = multisetDiff(before.serverChunks ?? [], after.serverChunks ?? []);
    const names = [...removed.map((x) => `- ${x}`), ...added.map((x) => `+ ${x}`)];
    if (names.length > 0) out.push(`    server-render chunks: ${listWithMore(names, 10)}`);
  }
}
