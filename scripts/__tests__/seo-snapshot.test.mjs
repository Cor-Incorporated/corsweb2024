// @vitest-environment node
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  collectSnapshot,
  diffJson,
  diffSnapshots,
  extractPageSeo,
  formatDiff,
  htmlFileToUrlPath,
  jsonLdTypes,
  logicalAssetName,
  normalizeJson,
  parseArgs,
  parseSitemapUrls,
  staticImports,
} from '../seo-snapshot.mjs';

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
  '<script type=application/ld+json>{"name":"x","@type":"Organization","@context":"https://schema.org"}</script>',
  '<script type=application/ld+json>{"@context":"https://schema.org","@graph":[{"@type":"Person"},{"@type":["WebSite","Thing"]}]}</script>',
  '<script type=application/ld+json>{broken</script>',
  '<title>  記事  タイトル｜Cor.株式会社 </title>',
  '<link href=/_astro/index.AbCd1234.css rel=stylesheet>',
  '<link href=https://cdn.example.com/k.css rel=stylesheet>',
  '<link as=font href=/f.woff2 rel=preload crossorigin>',
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
    expect(page.description).toBe('説明文 です');
    expect(page.canonical).toBe('https://cor-jp.com/blog/a/');
    expect(page.robots).toBe('index, follow');
    expect(page.h1).toEqual(['見出し 1', '本文の h1']);
  });

  it('lists hreflang alternates only (not RSS alternates), sorted by lang', () => {
    expect(page.hreflang).toEqual([
      { lang: 'ja', href: 'https://cor-jp.com/blog/a/' },
      { lang: 'x-default', href: 'https://cor-jp.com/blog/a/' },
      { lang: 'zh', href: 'https://cor-jp.com/zh/blog/a/' },
    ]);
  });

  it('parses JSON-LD with @type (incl. @graph) and key-sorted JSON; broken JSON is reported, not thrown', () => {
    expect(page.jsonLd.map((block) => block.types)).toEqual([['Organization'], ['Person', 'WebSite', 'Thing'], []]);
    expect(Object.keys(page.jsonLd[0].json)).toEqual(['@context', '@type', 'name']);
    expect(page.jsonLd[2].error).toMatch(/^invalid JSON/);
  });

  it('collects referenced JS/CSS and counts inline scripts without JSON-LD', () => {
    expect(page.scripts).toEqual(['/_astro/hoisted.Dgzzfq7E.js']);
    expect(page.stylesheets).toEqual(['/_astro/index.AbCd1234.css', 'https://cdn.example.com/k.css']);
    expect(page.preloads).toEqual([{ rel: 'preload', as: 'font', href: '/f.woff2' }]);
    expect(page.inline.scripts).toBe(1);
    expect(page.inline.styles).toBe(1);
  });

  it('keeps duplicated robots metas visible', () => {
    const html = '<html><head><meta name=robots content=noindex><meta name=ROBOTS content="index, follow"></head></html>';
    expect(extractPageSeo(html).robots).toBe('noindex | index, follow');
  });
});

describe('helpers', () => {
  it('normalizeJson sorts keys recursively and keeps array order', () => {
    expect(JSON.stringify(normalizeJson({ b: 1, a: [{ d: 1, c: 2 }, 3] }))).toBe('{"a":[{"c":2,"d":1},3],"b":1}');
  });

  it('jsonLdTypes handles arrays of nodes', () => {
    expect(jsonLdTypes([{ '@type': 'A' }, { '@type': ['B', 'C'] }, 'x', null])).toEqual(['A', 'B', 'C']);
  });

  it('logicalAssetName strips the 8-char content hash', () => {
    expect(logicalAssetName('/_astro/hoisted.Dgzzfq7E.js')).toBe('/_astro/hoisted.js');
    expect(logicalAssetName('/_astro/_slug_.B-_x1Yz9.css?v=1')).toBe('/_astro/_slug_.css');
    expect(logicalAssetName('https://cdn.jsdelivr.net/npm/alpinejs@3.14.0/dist/cdn.min.js')).toBe(
      'https://cdn.jsdelivr.net/npm/alpinejs@3.14.0/dist/cdn.min.js',
    );
  });

  it('staticImports finds static imports in minified ESM but not dynamic import()', () => {
    const code = 'import{a as b}from"./chunk.A1b2C3d4.js";import"./side.js";import*as n from "/abs.js";const l=()=>import("./lazy.js");';
    expect(staticImports(code).sort()).toEqual(['./chunk.A1b2C3d4.js', './side.js', '/abs.js']);
  });

  it('parseSitemapUrls reads loc and optional lastmod', () => {
    const xml =
      '<urlset><url><loc>https://cor-jp.com/</loc><lastmod>2026-01-01</lastmod></url><url><loc>https://cor-jp.com/a/</loc></url></urlset>';
    expect(parseSitemapUrls(xml)).toEqual([
      { loc: 'https://cor-jp.com/', lastmod: '2026-01-01' },
      { loc: 'https://cor-jp.com/a/', lastmod: null },
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

  it('parseArgs rejects unknown or value-less flags', () => {
    expect(parseArgs(['--compare', 'b.json'])).toMatchObject({ dist: 'dist', compare: 'b.json' });
    expect(() => parseArgs(['--bogus', 'x'])).toThrow(/invalid argument/);
    expect(() => parseArgs(['--out'])).toThrow(/invalid argument/);
  });
});

const pageFixture = (overrides = {}) => ({
  lang: 'ja',
  title: 'T',
  description: 'D',
  canonical: 'https://cor-jp.com/a/',
  robots: 'index, follow',
  hreflang: [],
  h1: ['H'],
  jsonLd: [{ types: ['Organization'], json: { '@type': 'Organization', url: 'https://cor-jp.com/a/' } }],
  preloads: [],
  inline: { scripts: 1, scriptBytes: 10, styles: 1, styleBytes: 10 },
  assets: { js: [], css: [], jsRaw: 0, jsBr: 0, cssRaw: 0, cssBr: 0 },
  ...overrides,
});

describe('diffSnapshots / formatDiff', () => {
  const baseline = {
    site: { robotsTxt: 'User-agent: *\nDisallow: /_astro/', sitemap: [{ loc: 'https://cor-jp.com/a/', lastmod: 'x' }] },
    pages: { '/a/': pageFixture(), '/b/': pageFixture(), '/gone/': pageFixture() },
  };
  const current = {
    site: { robotsTxt: 'User-agent: *\nAllow: /', sitemap: [{ loc: 'https://cor-jp.com/a/', lastmod: 'y' }] },
    pages: {
      '/a/': pageFixture({ robots: 'noindex, follow' }),
      '/b/': pageFixture({
        robots: 'noindex, follow',
        jsonLd: [{ types: ['Organization'], json: { '@type': 'Organization', url: 'https://cor-jp.com/b/' } }],
      }),
      '/new/': pageFixture(),
    },
  };
  const diff = diffSnapshots(baseline, current);

  it('groups identical changes across pages and lists added/removed pages', () => {
    expect(diff.pages).toMatchObject({ before: 3, after: 3, added: ['/new/'], removed: ['/gone/'] });
    expect(diff.fields.robots).toEqual([
      { detail: '"index, follow" → "noindex, follow"', urls: ['/a/', '/b/'] },
    ]);
    expect(diff.fields.title).toBeUndefined();
  });

  it('detects JSON-LD content changes with the page URL folded to {self}', () => {
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
  });

  it('reports no page-level differences for identical snapshots', () => {
    const same = diffSnapshots(baseline, baseline);
    expect(same.fields).toEqual({});
    expect(formatDiff(same)).toContain('(ページ単位の差分なし)');
  });
});

describe('collectSnapshot (temporary dist)', () => {
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
    await writeFile(path.join(dist, '_astro', 'dep.CCCCCCCC.js'), 'export const x=()=>1;');
    await writeFile(path.join(dist, '_astro', 'Server.DDDDDDDD.js'), 'const $$C=createComponent(()=>renderTemplate``);');
    await writeFile(path.join(dist, '_astro', 'site.BBBBBBBB.css'), 'body{color:red}');
    await writeFile(path.join(dist, 'robots.txt'), 'User-agent: *\nAllow: /\n');
    await writeFile(
      path.join(dist, 'sitemap-0.xml'),
      '<urlset><url><loc>https://cor-jp.com/about/</loc></url><url><loc>https://cor-jp.com/</loc></url></urlset>',
    );
  });

  afterAll(async () => {
    await rm(dist, { recursive: true, force: true });
  });

  it('follows static imports, measures raw/brotli sizes and inventories server chunks', async () => {
    const snapshot = await collectSnapshot(dist);
    expect(snapshot.pageCount).toBe(2);
    expect(Object.keys(snapshot.pages)).toEqual(['/about/', '/']);
    const home = snapshot.pages['/'];
    expect(home.assets.js.map((asset) => [asset.file, asset.via])).toEqual([
      ['/_astro/entry.AAAAAAAA.js', 'script'],
      ['/_astro/dep.CCCCCCCC.js', 'import'],
    ]);
    expect(home.assets.jsRaw).toBe(
      Buffer.byteLength('import{x}from"./dep.CCCCCCCC.js";x();') + Buffer.byteLength('export const x=()=>1;'),
    );
    expect(home.assets.jsBr).toBeGreaterThan(0);
    expect(home.assets.css[0]).toMatchObject({ file: '/_astro/site.BBBBBBBB.css', raw: 15 });
    expect(snapshot.site.sitemap.map((entry) => entry.loc)).toEqual(['https://cor-jp.com/', 'https://cor-jp.com/about/']);
    expect(snapshot.site.astroDir).toMatchObject({ jsFiles: 3, serverChunkFiles: 1, serverChunks: ['/_astro/Server.js'] });
  });
});
