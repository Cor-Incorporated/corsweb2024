import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { includeInSitemap, isNoindexPath } from '../indexing';
import { DISALLOWED_PATHS } from '../robots';

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : walk(full);
    return /\.(astro|ts)$/.test(name) ? [full] : [];
  });
const SOURCES = walk(path.resolve('src')).map((file) => ({ file, text: readFileSync(file, 'utf8') }));

// meta robots（Layout）と sitemap filter が同じ判定を使うことの真理値表。
// 落ちるべき変更: パターンの削除・ロケール接頭辞の取りこぼし・記事スラッグの誤爆。
describe('isNoindexPath', () => {
  it.each([
    ['/blog/tags/Astro/', true],
    ['/blog/tags/Astro/2/', true],
    ['/en/blog/tags/AI/', true],
    ['/blog/tags/%E3%83%AD%E3%83%BC%E3%82%AB%E3%83%ABLLM/', true],
    ['/test-blog/', true],
    ['/styleguide/', true],
    ['/tip-success/', true],
    ['/ko/tip-cancelled/', true],
    ['/404.html', true],
    ['/404', true],
    ['/en/404/', true],
    ['/contact/chat/', true],
    ['/', false],
    ['/blog/', false],
    ['/blog/2/', false],
    ['/blog/category/ai/', false],
    ['/blog/test-blog-migration/', false],
    ['/blog/tagsonomy-guide/', false],
    ['/contact/', false],
    ['/en/about/', false],
    ['/works/grift/', false],
  ])('%s → %s', (path, expected) => {
    expect(isNoindexPath(path)).toBe(expected);
  });
});

describe('includeInSitemap', () => {
  it.each([
    ['https://cor-jp.com/', true],
    ['https://cor-jp.com/blog/complete-markdown-guide/', true],
    ['https://cor-jp.com/zh/blog/category/ai/', true],
    ['https://cor-jp.com/blog/tags/Astro/', false],
    ['https://cor-jp.com/contact/chat/', false],
    ['https://cor-jp.com/styleguide/', false],
    ['https://cor-jp.com/api/contact', false],
    ['https://cor-jp.com/_astro/x.js', false],
    ['https://cor-jp.com/remark-link-card-plus/a.png', false],
  ])('%s → %s', (url, expected) => {
    expect(includeInSitemap(url)).toBe(expected);
  });

  // 宣言（robots.txt の Disallow）と実体（sitemap の filter）を結ぶ: 拒否しているパスを sitemap に載せない
  it.each(DISALLOWED_PATHS.map((disallowed) => [disallowed]))('never lists %s (disallowed in robots.txt)', (disallowed) => {
    expect(includeInSitemap(`https://cor-jp.com${disallowed}`)).toBe(false);
    expect(includeInSitemap(`https://cor-jp.com${disallowed}page/`)).toBe(false);
  });

  it('never keeps a URL whose page is noindex', () => {
    for (const path of ['/blog/tags/x/', '/en/404/', '/tip-success/', '/contact/chat/']) {
      expect(isNoindexPath(path)).toBe(true);
      expect(includeInSitemap(`https://cor-jp.com${path}`)).toBe(false);
    }
  });
});

// 宣言（config/indexing.ts の判定）と実体（meta robots を出す箇所）を結ぶ。
describe('meta robots call sites', () => {
  it('every getRobotsContent() call passes the shared isNoindexPath judgement', () => {
    const callers = SOURCES.filter(({ file, text }) => !file.endsWith(path.join('config', 'site.ts')) && /getRobotsContent\(/.test(text));
    expect(callers.map(({ file }) => path.relative(path.resolve('src'), file)).sort()).toEqual([
      path.join('components', 'blog', 'seo', 'BlogSeoMeta.astro'),
      path.join('layouts', 'Layout.astro'),
    ]);
    for (const { file, text } of callers) {
      expect(text, file).toMatch(/getRobotsContent\(\{\s*noindex:\s*isNoindexPath\(Astro\.url\.pathname\)\s*\}\)/);
    }
  });

  it('every page that passes slot="head" uses a layout that defines <slot name="head"> (otherwise it is dropped)', () => {
    const layouts = SOURCES.filter(({ file }) => file.includes(`${path.sep}layouts${path.sep}`));
    // 走査対象が空で素通りしないこと
    expect(layouts.map(({ file }) => path.basename(file)).sort()).toEqual(['BlogLayout.astro', 'Layout.astro']);
    const offenders = SOURCES.filter(({ text }) => /slot=["']head["']/.test(text)).flatMap(({ file, text }) => {
      const usedLayouts = [...text.matchAll(/from\s+['"][^'"]*layouts\/(\w+\.astro)['"]/g)].map((match) => match[1]);
      const hasHeadSlot = layouts.some(
        ({ file: layout, text: layoutText }) => usedLayouts.includes(path.basename(layout)) && /<slot\s+name=["']head["']/.test(layoutText),
      );
      return hasHeadSlot ? [] : [path.relative(path.resolve('src'), file)];
    });
    expect(offenders).toEqual([]);
  });
});
