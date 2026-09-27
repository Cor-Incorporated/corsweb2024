import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACTIVE_SVG_CONTENT, signatureMismatch } from '../../../scripts/lib/file-signatures.mjs';

// remark-link-card-plus のキャッシュ（public/remark-link-card-plus/）のうち、リポジトリで追跡しているファイルを検査する。
// 中身と拡張子が食い違うと、そのリンクカードの画像は表示されない（#340。理由は scripts/lib/file-signatures.mjs）。
// - 未追跡のファイル（手元のビルドが取得したもの）は見ない。環境によって結果が変わらないように。
// - ビルド時に新しく取得された画像は、ビルド後に security:audit:dist が同じ判定で dist 側を検査する。
// - このディレクトリは .gitignore の対象なので、拡張子を直すときは `git mv`（新しく足すときは `git add -f`）を使う。
//   mv と git add -A では削除だけがステージされ、ファイルが追跡から外れる。
const CACHE_DIR = 'public/remark-link-card-plus';

const trackedCacheFiles = () =>
  execFileSync('git', ['ls-files', '-z', '--', CACHE_DIR], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);

// サイト自身のファビコンは、ビルドのたびに本番から取り直さないよう、正しい PNG を追跡している
// （本番が保守画面などの HTML を返すと、上の理由でそのまま .png として保存されるため）。
// プラグインはリンク先のページの <link rel="icon"> からファビコンの URL を得て、sha256(URL) をファイル名にする。
const SITE_ORIGIN = 'https://cor-jp.com';
const OWN_FAVICON_SOURCE = 'public/favicon-32x32.png';
const LAYOUTS = ['src/layouts/Layout.astro', 'src/layouts/BlogLayout.astro'];

const firstIconHref = (source: string) => {
  const tag = source.match(/<link\b[^>]*>/g)?.find((link) => /\brel=["']icon["']/i.test(link));
  return tag?.match(/\bhref=["']([^"']+)["']/i)?.[1];
};

describe('remark-link-card-plus image cache', () => {
  it('tracks at least the known cache files', () => {
    expect(trackedCacheFiles().length).toBeGreaterThan(0);
  });

  it('has an extension that matches the file signature for every tracked image', () => {
    const mismatches = trackedCacheFiles().flatMap((file) => {
      const message = signatureMismatch(path.basename(file), readFileSync(file));
      return message ? [message] : [];
    });

    expect(mismatches).toEqual([]);
  });

  it('serves no active content from tracked SVG files', () => {
    const active = trackedCacheFiles()
      .filter((file) => file.toLowerCase().endsWith('.svg'))
      .filter((file) => ACTIVE_SVG_CONTENT.test(readFileSync(file, 'utf8')));

    expect(active).toEqual([]);
  });

  it('tracks a copy of the favicon that the layouts declare, identical to the source file', () => {
    for (const layout of LAYOUTS) {
      const href = firstIconHref(readFileSync(layout, 'utf8'));
      const url = href ? new URL(href, SITE_ORIGIN).href : undefined;
      expect({ layout, url }).toEqual({ layout, url: `${SITE_ORIGIN}/${path.basename(OWN_FAVICON_SOURCE)}` });
    }

    const hash = createHash('sha256').update(`${SITE_ORIGIN}/${path.basename(OWN_FAVICON_SOURCE)}`).digest('hex');
    const cached = trackedCacheFiles().find((file) => path.basename(file).startsWith(`${hash}.`));
    expect(cached).toBe(`${CACHE_DIR}/${hash}.png`);

    const digest = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
    expect({ cached: digest(cached ?? '') }).toEqual({ cached: digest(OWN_FAVICON_SOURCE) });
  });
});
