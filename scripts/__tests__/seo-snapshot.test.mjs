// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  collectSnapshot,
  contentHash,
  diffJson,
  diffSnapshots,
  excerptPair,
  extractPageSeo,
  foldSelfUrl,
  formatDiff,
  hasDifferences,
  htmlFileToUrlPath,
  jsonLdByKey,
  jsonLdTypes,
  logicalAssetName,
  multisetDiff,
  normalizeJson,
  parseArgs,
  parseFeed,
  parseSitemapIndex,
  parseSitemapUrls,
  runCli,
  SNAPSHOT_VERSION,
  staticImports,
} from '../seo-snapshot.mjs';

const SCRIPT = fileURLToPath(new URL('../seo-snapshot.mjs', import.meta.url));

// astro-compress 後の実出力と同じく、属性の引用符が省かれた minify 済み HTML で検証する。
const MINIFIED_PAGE = [
  '<!DOCTYPE html><html lang=ja x-data><head><meta charset=utf-8>',
  '<meta content="説明文 です" name=description>',
  '<meta content="index, follow" name=robots>',
  '<link href=https://cor-jp.com/blog/a/ rel=canonical>',
  '<link href=https://cor-jp.com/zh/blog/a/ rel=alternate hreflang=zh>',
  '<link href=https://cor-jp.com/blog/a/ rel=alternate hreflang=ja>',
  '<link href=https://cor-jp.com/blog/a/ rel=alternate hreflang=x-default>',
  '<link href=/rss.xml rel=alternate type=application/rss+xml title=RSS>',
  '<meta content=article property=og:type><meta content=T property=og:title>',
  '<meta content=https://cor-jp.com/og/a.png property=og:image><meta content=1200 property=og:image:width>',
  '<meta content=summary_large_image name=twitter:card><meta content=@cor name=twitter:site>',
  '<meta content=2025-01-01 property=article:published_time>',
  '<script type=application/ld+json>{"name":"x","@type":"Organization","@context":"https://schema.org"}</script>',
  '<script type=application/ld+json>{"@context":"https://schema.org","@graph":[{"@type":"Person"},{"@type":["WebSite","Thing"]}]}</script>',
  '<script type=application/ld+json>{broken</script>',
  '<title>  記事  タイトル｜Cor.株式会社 </title>',
  '<link href=/_astro/index.AbCd1234.css rel=stylesheet>',
  '<link href=https://cdn.example.com/k.css rel=stylesheet>',
  '<link as=font href=/_astro/KaTeX_Main.B22Nviop.woff2 rel=preload crossorigin>',
  '<script type=module src=/_astro/hoisted.Dgzzfq7E.js></script>',
  '<script>document.documentElement.classList.add("js")</script>',
  '<style>body{margin:0}</style>',
  '</head><body><h1>見出し <span>1</span></h1><main><h1>本文の h1</h1></main></body></html>',
].join('');

describe('htmlFileToUrlPath', () => {
  it.each([
    ['index.html', '/'],
    ['about/index.html', '/about/'],
    [path.join('en', 'blog', 'a', 'index.html'), '/en/blog/a/'],
    ['404.html', '/404.html'],
  ])('%s → %s', (file, url) => {
    expect(htmlFileToUrlPath(file)).toBe(url);
  });
});

describe('extractPageSeo', () => {
  const page = extractPageSeo(MINIFIED_PAGE);

  it('reads head SEO fields from minified HTML with unquoted attributes', () => {
    expect(page.lang).toBe('ja');
    expect(page.title).toBe('記事 タイトル｜Cor.株式会社');
    expect(page.description).toEqual(['説明文 です']);
    expect(page.canonical).toEqual(['https://cor-jp.com/blog/a/']);
    expect(page.robots).toEqual(['index, follow']);
    expect(page.h1).toEqual(['見出し 1', '本文の h1']);
  });

  it('lists hreflang alternates only (not RSS alternates), sorted by lang', () => {
    expect(page.hreflang).toEqual([
      { lang: 'ja', href: 'https://cor-jp.com/blog/a/' },
      { lang: 'x-default', href: 'https://cor-jp.com/blog/a/' },
      { lang: 'zh', href: 'https://cor-jp.com/zh/blog/a/' },
    ]);
  });

  it('collects og:* and twitter:* metas (not article:*) with sorted keys', () => {
    expect(page.social).toEqual({
      'og:image': ['https://cor-jp.com/og/a.png'],
      'og:image:width': ['1200'],
      'og:title': ['T'],
      'og:type': ['article'],
      'twitter:card': ['summary_large_image'],
      'twitter:site': ['@cor'],
    });
  });

  it('parses JSON-LD with @type (incl. @graph) and key-sorted JSON; broken JSON is reported, not thrown', () => {
    expect(page.jsonLd.map((block) => block.types)).toEqual([['Organization'], ['Person', 'WebSite', 'Thing'], []]);
    expect(Object.keys(page.jsonLd[0].json)).toEqual(['@context', '@type', 'name']);
    expect(page.jsonLd[2].error).toMatch(/^invalid JSON/);
  });

  it('collects referenced JS/CSS/preloads and hashes inline scripts/styles (JSON-LD excluded)', () => {
    expect(page.scripts).toEqual(['/_astro/hoisted.Dgzzfq7E.js']);
    expect(page.stylesheets).toEqual(['/_astro/index.AbCd1234.css', 'https://cdn.example.com/k.css']);
    expect(page.preloads).toEqual([
      { rel: 'preload', as: 'font', type: null, crossorigin: 'anonymous', href: '/_astro/KaTeX_Main.B22Nviop.woff2' },
    ]);
    expect(page.inline).toMatchObject({
      scripts: 1,
      scriptHashes: [contentHash('document.documentElement.classList.add("js")')],
      styles: 1,
      styleHashes: [contentHash('body{margin:0}')],
    });
  });

  it('keeps duplicated robots / canonical / description visible as separate values', () => {
    const html = [
      '<html><head><meta name=robots content=noindex><meta name=ROBOTS content="index, follow">',
      '<link rel=canonical href=https://cor-jp.com/a/><link rel=canonical href=https://cor-jp.com/b/>',
      '<meta name=description content=one><meta name=description content=two></head></html>',
    ].join('');
    const seo = extractPageSeo(html);
    expect(seo.robots).toEqual(['noindex', 'index, follow']);
    expect(seo.canonical).toEqual(['https://cor-jp.com/a/', 'https://cor-jp.com/b/']);
    expect(seo.description).toEqual(['one', 'two']);
  });

  it('does not confuse one value containing " | " with two tags', () => {
    const one = extractPageSeo('<html><head><meta name=description content="A | B"></head></html>');
    const two = extractPageSeo('<html><head><meta name=description content=A><meta name=description content=B></head></html>');
    expect(one.description).not.toEqual(two.description);
  });
});

describe('helpers', () => {
  it('normalizeJson sorts keys recursively and keeps array order', () => {
    expect(JSON.stringify(normalizeJson({ b: 1, a: [{ d: 1, c: 2 }, 3] }))).toBe('{"a":[{"c":2,"d":1},3],"b":1}');
  });

  it('jsonLdTypes handles arrays of nodes', () => {
    expect(jsonLdTypes([{ '@type': 'A' }, { '@type': ['B', 'C'] }, 'x', null])).toEqual(['A', 'B', 'C']);
  });

  it('logicalAssetName strips the 8-char content hash of scripts, styles and fonts', () => {
    expect(logicalAssetName('/_astro/hoisted.Dgzzfq7E.js')).toBe('/_astro/hoisted.js');
    expect(logicalAssetName('/_astro/_slug_.B-_x1Yz9.css?v=1')).toBe('/_astro/_slug_.css');
    expect(logicalAssetName('/_astro/KaTeX_Main-Regular.B22Nviop.woff2')).toBe('/_astro/KaTeX_Main-Regular.woff2');
    expect(logicalAssetName('/assets/k-terada.avif')).toBe('/assets/k-terada.avif');
    expect(logicalAssetName('https://cdn.jsdelivr.net/npm/alpinejs@3.14.0/dist/cdn.min.js')).toBe(
      'https://cdn.jsdelivr.net/npm/alpinejs@3.14.0/dist/cdn.min.js',
    );
  });

  it('staticImports follows static imports and re-exports, but not dynamic import()', () => {
    const code = [
      'import{a as b}from"./chunk.A1b2C3d4.js";import"./side.js";import*as n from "/abs.js";',
      'export{c as d}from"./re.js";export*from"./star.js";export * as ns from "./ns.js";',
      'const l=()=>import("./lazy.js");',
    ].join('');
    expect(staticImports(code).sort()).toEqual(
      ['./chunk.A1b2C3d4.js', './side.js', '/abs.js', './re.js', './star.js', './ns.js'].sort(),
    );
  });

  it('parseSitemapUrls reads loc, optional lastmod and xhtml:link alternates with their rel', () => {
    const xml = [
      '<urlset><url><loc>https://cor-jp.com/</loc><lastmod>2026-01-01</lastmod>',
      '<xhtml:link rel="alternate" hreflang="en" href="https://cor-jp.com/en/"/>',
      '<xhtml:link rel="alternate" hreflang="ja" href="https://cor-jp.com/"/></url>',
      '<url><loc>https://cor-jp.com/a/</loc></url></urlset>',
    ].join('');
    expect(parseSitemapUrls(xml)).toEqual([
      {
        loc: 'https://cor-jp.com/',
        lastmod: '2026-01-01',
        alternates: [
          { rel: 'alternate', hreflang: 'en', href: 'https://cor-jp.com/en/' },
          { rel: 'alternate', hreflang: 'ja', href: 'https://cor-jp.com/' },
        ],
      },
      { loc: 'https://cor-jp.com/a/', lastmod: null, alternates: [] },
    ]);
  });

  it('parseFeed reads the channel and items (CDATA unwrapped), ignoring build-time fields', () => {
    const xml = [
      '<rss version="2.0"><channel><title><![CDATA[Cor.株式会社 ブログ]]></title><description>d</description>',
      '<link>https://cor-jp.com/</link><language>ja</language><lastBuildDate>Mon, 28 Sep 2026 00:00:00 GMT</lastBuildDate>',
      '<item><title>A</title><link>https://cor-jp.com/blog/a/</link><guid isPermaLink="true">https://cor-jp.com/blog/a/</guid>',
      '<pubDate>Tue, 21 Jan 2025 00:00:00 GMT</pubDate><category>AI</category><category>Astro</category></item>',
      '</channel></rss>',
    ].join('');
    expect(parseFeed(xml)).toEqual({
      title: 'Cor.株式会社 ブログ',
      description: 'd',
      link: 'https://cor-jp.com/',
      language: 'ja',
      items: [
        {
          title: 'A',
          link: 'https://cor-jp.com/blog/a/',
          guid: 'https://cor-jp.com/blog/a/',
          pubDate: 'Tue, 21 Jan 2025 00:00:00 GMT',
          categories: ['AI', 'Astro'],
        },
      ],
    });
  });

  it('parseSitemapIndex reads each child sitemap', () => {
    const xml =
      '<sitemapindex><sitemap><loc>https://cor-jp.com/sitemap-0.xml</loc></sitemap><sitemap><loc>https://cor-jp.com/sitemap-1.xml</loc><lastmod>x</lastmod></sitemap></sitemapindex>';
    expect(parseSitemapIndex(xml)).toEqual([
      { loc: 'https://cor-jp.com/sitemap-0.xml', lastmod: null },
      { loc: 'https://cor-jp.com/sitemap-1.xml', lastmod: 'x' },
    ]);
  });

  it('diffJson reports changed, added and removed paths', () => {
    expect(diffJson({ a: 1, b: [1, 2], c: 'x' }, { a: 2, b: [1], d: true }, 'Org')).toEqual([
      'Org.a: 1 → 2',
      'Org.b[1]: 2 → (削除)',
      'Org.c: "x" → (削除)',
      'Org.d: (なし) → true',
    ]);
  });

  it('excerptPair shows the region around the first difference of long values', () => {
    const head = 'x'.repeat(300);
    const [before, after] = excerptPair(`${head}-OLD-tail`, `${head}-NEW-tail`);
    expect(before).toContain('-OLD-tail');
    expect(after).toContain('-NEW-tail');
    expect(before.startsWith('…')).toBe(true);
    expect(excerptPair('short', 'value')).toEqual(['short', 'value']);
  });

  it('multisetDiff counts duplicates', () => {
    expect(multisetDiff(['a', 'a', 'b'], ['a', 'c'])).toEqual({ removed: ['a', 'b'], added: ['c'] });
  });

  it('foldSelfUrl folds only the exact quoted page URL', () => {
    expect(foldSelfUrl('{"url":"https://cor-jp.com/blog/"}', '/blog/')).toBe('{"url":"{self}"}');
    expect(foldSelfUrl('"https://cor-jp.com/blog/a/"', '/blog/')).toBe('"https://cor-jp.com/blog/a/"');
    expect(foldSelfUrl(null, '/blog/')).toBeNull();
  });

  it('jsonLdByKey keeps every block of the same @type', () => {
    const blocks = [
      { types: ['Organization'], json: { n: 1 } },
      { types: ['Organization'], json: { n: 2 } },
      { types: [], error: 'invalid' },
    ];
    expect([...jsonLdByKey(blocks).keys()]).toEqual(['Organization', 'Organization#2', '(no @type)']);
  });

  it('parseArgs handles value flags and the boolean --fail-on-diff', () => {
    expect(parseArgs(['--compare', 'b.json'])).toMatchObject({ dist: 'dist', compare: 'b.json', failOnDiff: false });
    expect(parseArgs(['--compare', 'b.json', '--fail-on-diff'])).toMatchObject({ failOnDiff: true });
    expect(() => parseArgs(['--bogus', 'x'])).toThrow(/invalid argument/);
    expect(() => parseArgs(['--out'])).toThrow(/invalid argument/);
    expect(() => parseArgs(['--out', '--fail-on-diff'])).toThrow(/invalid argument/);
    expect(() => parseArgs(['--fail-on-diff'])).toThrow(/requires --compare/);
  });
});

const pageFixture = (overrides = {}) => ({
  lang: 'ja',
  title: 'T',
  description: ['D'],
  canonical: ['https://cor-jp.com/a/'],
  robots: ['index, follow'],
  hreflang: [],
  h1: ['H'],
  social: { 'og:title': ['T'] },
  jsonLd: [{ types: ['Organization'], json: { '@type': 'Organization', url: 'https://cor-jp.com/a/' } }],
  preloads: [],
  inline: { scripts: 1, scriptBytes: 10, scriptHashes: ['aaa'], styles: 1, styleBytes: 10, styleHashes: ['sss'] },
  assets: { js: [], css: [], jsRaw: 0, jsBr: 100, cssRaw: 0, cssBr: 100 },
  ...overrides,
});

const snapshotOf = (pages, site = {}) => ({
  version: SNAPSHOT_VERSION,
  meta: { gitSha: null, gitDirty: null, publicSiteEnv: null },
  site: { robotsTxt: 'User-agent: *', sitemapIndex: [], sitemap: [], feeds: {}, ...site },
  pages,
});

const onePageDiff = (before, after) => diffSnapshots(snapshotOf({ '/a/': before }), snapshotOf({ '/a/': after }));

describe('diffSnapshots / formatDiff', () => {
  const baseline = snapshotOf(
    { '/a/': pageFixture(), '/b/': pageFixture(), '/gone/': pageFixture() },
    { robotsTxt: 'User-agent: *\nDisallow: /_astro/', sitemap: [{ loc: 'https://cor-jp.com/a/', lastmod: 'x' }] },
  );
  const current = snapshotOf(
    {
      '/a/': pageFixture({ robots: ['noindex, follow'] }),
      '/b/': pageFixture({
        robots: ['noindex, follow'],
        jsonLd: [{ types: ['Organization'], json: { '@type': 'Organization', url: 'https://cor-jp.com/b/' } }],
      }),
      '/new/': pageFixture(),
    },
    { robotsTxt: 'User-agent: *\nAllow: /', sitemap: [{ loc: 'https://cor-jp.com/a/', lastmod: 'y' }] },
  );
  const diff = diffSnapshots(baseline, current);

  it('groups identical changes across pages and lists added/removed pages', () => {
    expect(diff.pages).toMatchObject({ before: 3, after: 3, added: ['/new/'], removed: ['/gone/'] });
    expect(diff.fields.robots).toEqual([
      { detail: 'robots[0]: "index, follow" → "noindex, follow"', urls: ['/a/', '/b/'] },
    ]);
    expect(diff.fields.title).toBeUndefined();
  });

  it('folds the page URL to {self} in JSON-LD changes', () => {
    expect(diff.fields['jsonLd.content']).toEqual([
      { detail: 'Organization.url: "https://cor-jp.com/a/" → "{self}"', urls: ['/b/'] },
    ]);
  });

  it('reports robots.txt and sitemap changes and renders readable text', () => {
    expect(diff.site.robotsTxt).toEqual({ before: baseline.site.robotsTxt, after: current.site.robotsTxt });
    expect(diff.site.sitemap).toMatchObject({ before: 1, after: 1, lastmodChanged: 1 });
    const text = formatDiff(diff);
    expect(text).toContain('[robots] 2 page(s), 1 distinct change(s)');
    expect(text).toContain('robots.txt changed:');
    expect(text).toContain('added: /new/');
    expect(hasDifferences(diff)).toBe(true);
  });

  it('reports no differences for identical snapshots', () => {
    const same = diffSnapshots(baseline, baseline);
    expect(same.fields).toEqual({});
    expect(hasDifferences(same)).toBe(false);
    expect(formatDiff(same)).toContain('(ページ単位の差分なし)');
  });

  it('refuses to compare snapshots of different formats', () => {
    expect(() => diffSnapshots({ ...baseline, version: 1 }, current)).toThrow(/version mismatch/);
  });
});

describe('diffSnapshots: detection of each kind of change', () => {
  it('does not merge changes that differ only after the display width', () => {
    const long = 'd'.repeat(300);
    const diff = diffSnapshots(
      snapshotOf({ '/a/': pageFixture(), '/b/': pageFixture() }),
      snapshotOf({
        '/a/': pageFixture({ description: [`${long}-first`] }),
        '/b/': pageFixture({ description: [`${long}-second`] }),
      }),
    );
    expect(diff.fields.description.map((group) => group.urls)).toEqual([['/a/'], ['/b/']]);
  });

  it('reports hreflang changes per language line', () => {
    const diff = onePageDiff(
      pageFixture({ hreflang: [{ lang: 'ja', href: 'https://cor-jp.com/a/' }] }),
      pageFixture({
        hreflang: [
          { lang: 'ja', href: 'https://cor-jp.com/a/' },
          { lang: 'zh', href: 'https://cor-jp.com/zh/a/' },
        ],
      }),
    );
    expect(diff.fields.hreflang[0].detail).toBe('hreflang.zh: (なし) → ["https://cor-jp.com/zh/a/"]');
  });

  it('reports og:* / twitter:* changes', () => {
    const diff = onePageDiff(pageFixture(), pageFixture({ social: { 'og:title': ['New'] } }));
    expect(diff.fields.social[0].detail).toBe('meta.og:title[0]: "T" → "New"');
  });

  it('reports a second canonical (duplicates are kept in the joined value)', () => {
    const diff = onePageDiff(pageFixture(), pageFixture({ canonical: ['https://cor-jp.com/a/', 'https://cor-jp.com/x/'] }));
    expect(diff.fields.canonical[0].detail).toBe('canonical[1]: (なし) → "https://cor-jp.com/x/"');
  });

  it('compares every JSON-LD block of the same @type (no overwrite by the later block)', () => {
    const org = (n) => ({ types: ['Organization'], json: { '@type': 'Organization', n } });
    const diff = onePageDiff(pageFixture({ jsonLd: [org(1), org(2)] }), pageFixture({ jsonLd: [org(9), org(2)] }));
    expect(diff.fields['jsonLd.content'][0].detail).toBe('Organization.n: 1 → 9');
  });

  it('reports JS and CSS brotli sizes separately (a +N / -N swap is not hidden)', () => {
    const diff = onePageDiff(
      pageFixture(),
      pageFixture({ assets: { js: [], css: [], jsRaw: 0, jsBr: 150, cssRaw: 0, cssBr: 50 } }),
    );
    expect(diff.fields['assets.jsBytes'][0].detail).toBe('JS brotli 100B → 150B (+50B)');
    expect(diff.fields['assets.cssBytes'][0].detail).toBe('CSS brotli 100B → 50B (-50B)');
  });

  it('reports preload changes (hash-insensitive names), including type and crossorigin', () => {
    const font = (overrides = {}) => ({ rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: 'anonymous', href: '/_astro/a.AAAAAAAA.woff2', ...overrides });
    const diff = onePageDiff(
      pageFixture({ preloads: [font()] }),
      pageFixture({ preloads: [{ rel: 'preload', as: 'style', type: null, crossorigin: null, href: 'https://cdn.example.com/k.css' }] }),
    );
    expect(diff.fields.preloads[0].detail).toBe(
      '- preload as=font type=font/woff2 crossorigin=anonymous /_astro/a.woff2\n+ preload as=style type=- crossorigin=- https://cdn.example.com/k.css',
    );
    expect(onePageDiff(pageFixture({ preloads: [font()] }), pageFixture({ preloads: [font({ href: '/_astro/a.BBBBBBBB.woff2' })] })).fields.preloads).toBeUndefined();
    // 同じ URL のまま crossorigin が消える / type が変わる（フォントが二重取得になる）
    expect(onePageDiff(pageFixture({ preloads: [font()] }), pageFixture({ preloads: [font({ crossorigin: null })] })).fields.preloads).toHaveLength(1);
    expect(onePageDiff(pageFixture({ preloads: [font()] }), pageFixture({ preloads: [font({ type: 'font/woff' })] })).fields.preloads).toHaveLength(1);
  });

  it('reports inline script/style content changes even when the counts are equal', () => {
    const inline = { scripts: 1, scriptBytes: 10, scriptHashes: ['bbb'], styles: 1, styleBytes: 10, styleHashes: ['sss'] };
    const diff = onePageDiff(pageFixture(), pageFixture({ inline }));
    expect(diff.fields.inline[0].detail).toBe('inline <script> 1 → 1; removed aaa; added bbb');
  });

  it('reports sitemap-index and sitemap hreflang alternates changes', () => {
    const alternates = (hreflang) => [{ rel: 'alternate', hreflang, href: `https://cor-jp.com/${hreflang}/` }];
    const diff = diffSnapshots(
      snapshotOf({}, {
        sitemapIndex: [{ loc: 'https://cor-jp.com/sitemap-0.xml', lastmod: null }],
        sitemap: [{ loc: 'https://cor-jp.com/a/', lastmod: null, alternates: alternates('en') }],
      }),
      snapshotOf({}, {
        sitemapIndex: [{ loc: 'https://cor-jp.com/sitemap-1.xml', lastmod: null }],
        sitemap: [{ loc: 'https://cor-jp.com/a/', lastmod: null, alternates: alternates('zh') }],
      }),
    );
    expect(diff.site.sitemapIndex).toMatchObject({
      added: ['https://cor-jp.com/sitemap-1.xml'],
      removed: ['https://cor-jp.com/sitemap-0.xml'],
    });
    expect(diff.site.sitemap.alternatesChanged).toEqual([
      {
        loc: 'https://cor-jp.com/a/',
        removed: ['alternate en https://cor-jp.com/en/'],
        added: ['alternate zh https://cor-jp.com/zh/'],
      },
    ]);
    expect(hasDifferences(diff)).toBe(true);
    expect(formatDiff(diff)).toContain('hreflang alternates changed 1');
  });
});

describe('diffSnapshots: site-level details', () => {
  const url = (lastmod, extra = {}) => ({ loc: 'https://cor-jp.com/a/', lastmod, alternates: [], ...extra });
  const two = (lastmod) => [url(lastmod), { ...url(lastmod), loc: 'https://cor-jp.com/b/' }];

  it('reports a sitemap hreflang link whose rel changed while hreflang and href stay the same', () => {
    const link = (rel) => [{ rel, hreflang: 'en', href: 'https://cor-jp.com/en/a/' }];
    const diff = diffSnapshots(
      snapshotOf({}, { sitemap: [url(null, { alternates: link('alternate') })] }),
      snapshotOf({}, { sitemap: [url(null, { alternates: link('canonical') })] }),
    );
    expect(diff.site.sitemap.alternatesChanged).toHaveLength(1);
    expect(hasDifferences(diff)).toBe(true);
  });

  it('does not fail on build-time lastmod churn, but does on a real lastmod change', () => {
    const churn = diffSnapshots(snapshotOf({}, { sitemap: two('2026-09-27T00:00:00.000Z') }), snapshotOf({}, { sitemap: two('2026-09-28T00:00:00.000Z') }));
    expect(churn.site.sitemap).toMatchObject({ lastmodChanged: 0, lastmodBuildTimeOnly: 2 });
    expect(hasDifferences(churn)).toBe(false);
    // lastmod が無い sitemap（全 URL が null）はビルド時刻ではない: 一律の lastmod が復活したら差分として出す
    const revived = diffSnapshots(snapshotOf({}, { sitemap: two(null) }), snapshotOf({}, { sitemap: two('2026-09-28T00:00:00.000Z') }));
    expect(revived.site.sitemap).toMatchObject({ lastmodChanged: 2, lastmodBuildTimeOnly: 0 });
    expect(hasDifferences(revived)).toBe(true);
    const real = diffSnapshots(
      snapshotOf({}, { sitemap: two('2025-01-01T00:00:00.000Z') }),
      snapshotOf({}, { sitemap: [url('2025-02-01T00:00:00.000Z'), { ...url('2025-01-01T00:00:00.000Z'), loc: 'https://cor-jp.com/b/' }] }),
    );
    expect(real.site.sitemap.lastmodChanged).toBe(1);
    expect(hasDifferences(real)).toBe(true);
  });

  it('reports RSS feed changes (channel, added / changed / removed items, added feeds)', () => {
    const feed = (items, title = 'Blog') => ({ title, description: 'd', link: 'https://cor-jp.com/', language: 'ja', items });
    const item = (guid, title = guid) => ({ title, link: guid, guid, pubDate: null, categories: [] });
    const diff = diffSnapshots(
      snapshotOf({}, { feeds: { '/rss.xml': feed([item('a'), item('b')]) } }),
      snapshotOf({}, { feeds: { '/rss.xml': feed([item('a', 'A2'), item('c')], 'Blog2'), '/en/rss.xml': feed([]) } }),
    );
    expect(diff.site.feeds).toEqual([
      { feed: '/en/rss.xml', lines: ['added'] },
      { feed: '/rss.xml', lines: ['title: "Blog" → "Blog2"', '~ a', '+ c', '- b'] },
    ]);
    expect(hasDifferences(diff)).toBe(true);
    expect(formatDiff(diff)).toContain('/rss.xml: title: "Blog" → "Blog2", ~ a, + c, - b');
  });

  it('names the server-render chunks that changed even when counts and bytes stay the same', () => {
    const astro = (serverChunks) => ({ jsFiles: 3, jsBytes: 100, serverChunkFiles: 1, serverChunks });
    const diff = diffSnapshots(
      snapshotOf({}, { astroDir: astro(['/_astro/Old.js']) }),
      snapshotOf({}, { astroDir: astro(['/_astro/New.js']) }),
    );
    expect(hasDifferences(diff)).toBe(true);
    expect(formatDiff(diff)).toContain('server-render chunks: - /_astro/Old.js, + /_astro/New.js');
  });
});

describe('collectSnapshot (temporary dist) and CLI', () => {
  let dist;

  beforeAll(async () => {
    dist = await mkdtemp(path.join(os.tmpdir(), 'seo-snapshot-'));
    await mkdir(path.join(dist, '_astro'), { recursive: true });
    await mkdir(path.join(dist, 'about'), { recursive: true });
    await writeFile(
      path.join(dist, 'index.html'),
      '<html lang=ja><head><title>Home</title><script type=module src=/_astro/entry.AAAAAAAA.js></script><link rel=stylesheet href=/_astro/site.BBBBBBBB.css></head><body><h1>Home</h1></body></html>',
    );
    await writeFile(path.join(dist, 'about', 'index.html'), '<html lang=en><head><title>About</title></head></html>');
    await writeFile(path.join(dist, '_astro', 'entry.AAAAAAAA.js'), 'import{x}from"./dep.CCCCCCCC.js";x();');
    await writeFile(path.join(dist, '_astro', 'dep.CCCCCCCC.js'), 'export{y as x}from"./leaf.EEEEEEEE.js";');
    await writeFile(path.join(dist, '_astro', 'leaf.EEEEEEEE.js'), 'export const y=()=>1;');
    await writeFile(path.join(dist, '_astro', 'Server.DDDDDDDD.js'), 'const $$C=createComponent(()=>renderTemplate``);');
    await writeFile(path.join(dist, '_astro', 'site.BBBBBBBB.css'), 'body{color:red}');
    await writeFile(path.join(dist, 'robots.txt'), 'User-agent: *\nAllow: /\n');
    await writeFile(
      path.join(dist, 'sitemap-index.xml'),
      '<sitemapindex><sitemap><loc>https://cor-jp.com/sitemap-0.xml</loc></sitemap></sitemapindex>',
    );
    await writeFile(
      path.join(dist, 'sitemap-0.xml'),
      '<urlset><url><loc>https://cor-jp.com/about/</loc></url><url><loc>https://cor-jp.com/</loc><xhtml:link rel="alternate" hreflang="en" href="https://cor-jp.com/en/"/></url></urlset>',
    );
    await mkdir(path.join(dist, 'en'), { recursive: true });
    await writeFile(path.join(dist, 'en', 'news.xml'), '<rss><channel><title>News</title><item><guid>g1</guid></item></channel></rss>');
  });

  afterAll(async () => {
    await rm(dist, { recursive: true, force: true });
  });

  it('follows imports and re-exports, measures sizes and records site files and build meta', async () => {
    const snapshot = await collectSnapshot(dist);
    expect(snapshot.version).toBe(SNAPSHOT_VERSION);
    expect(Object.keys(snapshot.meta)).toEqual(['gitSha', 'gitDirty', 'publicSiteEnv']);
    expect(snapshot.pageCount).toBe(2);
    const home = snapshot.pages['/'];
    expect(home.assets.js.map((asset) => [asset.file, asset.via])).toEqual([
      ['/_astro/entry.AAAAAAAA.js', 'script'],
      ['/_astro/dep.CCCCCCCC.js', 'import'],
      ['/_astro/leaf.EEEEEEEE.js', 'import'],
    ]);
    expect(home.assets.jsBr).toBeGreaterThan(0);
    expect(home.assets.css[0]).toMatchObject({ file: '/_astro/site.BBBBBBBB.css', raw: 15 });
    expect(snapshot.site.sitemapIndex).toEqual([{ loc: 'https://cor-jp.com/sitemap-0.xml', lastmod: null }]);
    expect(snapshot.site.sitemap[0]).toEqual({
      loc: 'https://cor-jp.com/',
      lastmod: null,
      alternates: [{ rel: 'alternate', hreflang: 'en', href: 'https://cor-jp.com/en/' }],
    });
    expect(Object.keys(snapshot.site.feeds)).toEqual(['/en/news.xml']);
    expect(snapshot.site.feeds['/en/news.xml'].items.map((item) => item.guid)).toEqual(['g1']);
    expect(snapshot.site.astroDir).toMatchObject({ jsFiles: 4, serverChunkFiles: 1, serverChunks: ['/_astro/Server.js'] });
  });

  // 終了コード 0 / 1 はプロセス内で確かめ、子プロセスは「例外で exit 2 になる」の 1 回だけ起動する
  // （子プロセスは起動のたびに Node と依存を読み込むため、既定の 5 秒に収まらないことがあった）
  it('--fail-on-diff returns 0 without differences and 1 with differences (in process)', async () => {
    const same = path.join(dist, 'same.json');
    const changed = path.join(dist, 'changed.json');
    const snapshot = await collectSnapshot(dist);
    await writeFile(same, JSON.stringify(snapshot));
    await writeFile(changed, JSON.stringify({ ...snapshot, site: { ...snapshot.site, robotsTxt: 'User-agent: *\nDisallow: /' } }));
    const output = [];
    const write = (text) => output.push(text);
    expect(await runCli(['--compare', same, '--current', same, '--fail-on-diff'], { write })).toBe(0);
    expect(await runCli(['--compare', same, '--current', changed, '--fail-on-diff'], { write })).toBe(1);
    expect(await runCli(['--compare', same, '--current', changed], { write })).toBe(0);
    expect(output.join('')).toContain('robots.txt changed:');
  }, 30_000);

  it('exits 2 with the reason when the snapshot formats do not match (child process via a symlink)', async () => {
    const snapshot = await collectSnapshot(dist);
    const current = path.join(dist, 'current.json');
    const old = path.join(dist, 'old.json');
    await writeFile(current, JSON.stringify(snapshot));
    await writeFile(old, JSON.stringify({ ...snapshot, version: 1 }));
    // シンボリックリンク経由（/tmp → /private/tmp と同じ状況）でも CLI として動くこと。動かないと何も出さずに exit 0
    const linked = path.join(dist, 'seo-snapshot-link.mjs');
    await symlink(SCRIPT, linked);
    const result = spawnSync(process.execPath, [linked, '--compare', old, '--current', current, '--fail-on-diff'], {
      encoding: 'utf8',
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('version mismatch');
  }, 30_000);
});
