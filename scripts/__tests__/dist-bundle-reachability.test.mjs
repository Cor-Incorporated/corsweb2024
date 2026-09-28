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
  it('reads only module-loading tags: script src / modulepreload / island URLs / inline imports', () => {
    const html = [
      '<script type=module src=/_astro/hoisted.Dgzzfq7E.js></script>',
      '<link rel=modulepreload href="/_astro/pre.js">',
      '<astro-island component-url="/_astro/Island.js" renderer-url="/_astro/client.js?v=1"></astro-island>',
      '<link rel=stylesheet href=/_astro/site.css>',
      '<script>import("/_astro/inline-dyn.js")</script>',
      // 読み込みではないもの: 普通のリンク・data 属性・preload 以外の link・インライン script 内の文字列
      '<a href="/_astro/linked.js">download</a><img data-src=/_astro/lazy-img.js><link rel=prefetch href=/_astro/prefetch.js>',
      '<script>const note = "/_astro/just-a-string.js";</script>',
      // `=` の前後に空白がある属性（HTML として正しい）と、引用符なし・単引用符の値
      '<script type="module" src = "/_astro/spaced.js"></script><link rel = "modulepreload" href = /_astro/pre-spaced.js>',
      "<script src ='/_astro/single-quoted.js'></script>",
    ].join('');
    expect(extractHtmlScriptRefs(html).sort()).toEqual(
      [
        '/_astro/hoisted.Dgzzfq7E.js',
        '/_astro/pre.js',
        '/_astro/Island.js',
        '/_astro/client.js',
        '/_astro/inline-dyn.js',
        '/_astro/spaced.js',
        '/_astro/pre-spaced.js',
        '/_astro/single-quoted.js',
      ].sort(),
    );
  });

  it('reads only real dependency edges from minified JS (not file names that merely appear in strings)', () => {
    const code =
      'import{a}from"./a.js";export{b}from"./b.js";export*from"../c.mjs";import"./side.js";const l=()=>import("./lazy.js");' +
      'const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["_astro/mapped.js","_astro/x.css"])))=>i.map(i=>d[i]);' +
      'const manual="./orphan.js";const list=["./also-not-an-import.js"];';
    expect(extractJsRefs(code).sort()).toEqual(['./a.js', './b.js', '../c.mjs', './side.js', './lazy.js', '_astro/mapped.js'].sort());
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
    await mkdir(path.join(dist, 'pages'), { recursive: true });
    const put = (file, text) => writeFile(path.join(dist, file), text);
    await put(
      'index.html',
      '<script type=module src=/_astro/entry.AAAAAAAA.js></script><script>import("/_astro/inline-dyn.js")</script>' +
        // 普通のリンクで指されているだけの JS は読み込まれない
        '<a href="/_astro/linked-only.js">x</a>' +
        // `=` の前後に空白があっても読み込みとして数える（誤検知しない）
        '<script type="module" src = "/_astro/spaced-src.js"></script>',
    );
    await put(
      '_astro/entry.AAAAAAAA.js',
      'import{a}from"./a.js";export{b}from"./b.js";const l=()=>import("./lazy.js");' +
        'const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["_astro/mapped.js"])))=>i.map(i=>d[i]);' +
        // 文字列にファイル名が書かれているだけで、import はしていない
        'const manual="./string-only.js";',
    );
    for (const name of ['a', 'b', 'lazy', 'mapped', 'inline-dyn', 'admin-chunk', 'linked-only', 'string-only', 'spaced-src']) {
      await put(`_astro/${name}.js`, 'export{};');
    }
    // 管理画面（別の HTML 起点）から辿れる JS は取り残しではない
    await put('admin/index.html', '<script type="module" src="/_astro/admin.js"></script>');
    await put('_astro/admin.js', 'import"./admin-chunk.js";');
    // 目印（createComponent 等）の無い取り残し: 本文だけのコンテンツモジュール相当
    await put('_astro/orphan-content.js', 'const html="<p>記事本文</p>";export{html as default};');
    await put('chunks/pages_AbC123.mjs', 'export{};');
    await put('manifest_Xy9.mjs', 'export{};');
    await put('pages/index.astro.mjs', 'export{};');
    // 正当な公開 .mjs（public/ から配布するモジュール等）と、ページとしての chunks/ は残骸ではない
    await mkdir(path.join(dist, 'vendor'), { recursive: true });
    await mkdir(path.join(dist, 'blog', 'chunks'), { recursive: true });
    await put('vendor/widget.mjs', 'export{};');
    await put('blog/chunks/index.html', '<p>a post named chunks</p>');
    files = await walk(dist);
  });

  afterAll(async () => {
    await rm(dist, { recursive: true, force: true });
  });

  it('reports the _astro JS that no page loads, including ones only linked by <a> or named in a string', async () => {
    expect(await findUnreachableBundles(dist, files)).toEqual([
      '_astro/linked-only.js',
      '_astro/orphan-content.js',
      '_astro/string-only.js',
    ]);
  });

  it('reports only Astro server build output names as remnants (not legitimate public .mjs)', () => {
    expect(findServerOutputRemnants(dist, files)).toEqual(['chunks/pages_AbC123.mjs', 'manifest_Xy9.mjs', 'pages/index.astro.mjs']);
  });
});
