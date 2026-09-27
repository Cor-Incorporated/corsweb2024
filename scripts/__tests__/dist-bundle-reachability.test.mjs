// @vitest-environment node
import { mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  extractHtmlScriptRefs,
  extractJsRefs,
  findServerOutputRemnants,
  findUnreachableBundles,
} from '../dist-bundle-reachability.mjs';

const walk = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => (entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)])),
  );
  return nested.flat();
};

describe('reference extraction', () => {
  it('reads script / modulepreload / island URLs (unquoted minified attributes too) and inline imports', () => {
    const html = [
      '<script type=module src=/_astro/hoisted.Dgzzfq7E.js></script>',
      '<link rel=modulepreload href="/_astro/pre.js">',
      '<astro-island component-url="/_astro/Island.js" renderer-url="/_astro/client.js?v=1"></astro-island>',
      '<link rel=stylesheet href=/_astro/site.css>',
      '<script>import("/_astro/inline-dyn.js")</script>',
    ].join('');
    expect(extractHtmlScriptRefs(html).sort()).toEqual(
      ['/_astro/hoisted.Dgzzfq7E.js', '/_astro/pre.js', '/_astro/Island.js', '/_astro/client.js', '/_astro/inline-dyn.js'].sort(),
    );
  });

  it('reads static imports, re-exports, dynamic imports and Vite mapDeps from minified JS', () => {
    const code =
      'import{a}from"./a.js";export{b}from"./b.js";export*from"../c.mjs";const l=()=>import("./lazy.js");' +
      'const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["_astro/mapped.js","_astro/x.css"])))=>i.map(i=>d[i]);';
    expect(extractJsRefs(code).sort()).toEqual(['./a.js', './b.js', '../c.mjs', './lazy.js', '_astro/mapped.js'].sort());
  });
});

describe('findUnreachableBundles / findServerOutputRemnants (temporary dist)', () => {
  let dist;
  let files;

  beforeAll(async () => {
    dist = await mkdtemp(path.join(os.tmpdir(), 'dist-reach-'));
    await mkdir(path.join(dist, '_astro'), { recursive: true });
    await mkdir(path.join(dist, 'admin'), { recursive: true });
    await mkdir(path.join(dist, 'chunks'), { recursive: true });
    const put = (file, text) => writeFile(path.join(dist, file), text);
    await put('index.html', '<script type=module src=/_astro/entry.AAAAAAAA.js></script><script>import("/_astro/inline-dyn.js")</script>');
    await put(
      '_astro/entry.AAAAAAAA.js',
      'import{a}from"./a.js";export{b}from"./b.js";const l=()=>import("./lazy.js");const d=["_astro/mapped.js"];',
    );
    for (const name of ['a', 'b', 'lazy', 'mapped', 'inline-dyn', 'admin-chunk']) await put(`_astro/${name}.js`, 'export{};');
    // 管理画面（別の HTML 起点）から辿れる JS は取り残しではない
    await put('admin/index.html', '<script type="module" src="/_astro/admin.js"></script>');
    await put('_astro/admin.js', 'import"./admin-chunk.js";');
    // 目印（createComponent 等）の無い取り残し: 本文だけのコンテンツモジュール相当
    await put('_astro/orphan-content.js', 'const html="<p>記事本文</p>";export{html as default};');
    await put('chunks/pages.mjs', 'export{};');
    files = await walk(dist);
  });

  afterAll(async () => {
    await rm(dist, { recursive: true, force: true });
  });

  it('reports only the _astro JS that no HTML page can reach', async () => {
    expect(await findUnreachableBundles(dist, files)).toEqual(['_astro/orphan-content.js']);
  });

  it('reports .mjs files and chunks/ directories as server build remnants', () => {
    expect(findServerOutputRemnants(dist, files)).toEqual(['chunks/pages.mjs']);
  });
});
