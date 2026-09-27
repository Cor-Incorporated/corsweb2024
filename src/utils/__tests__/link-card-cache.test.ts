import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// remark-link-card-plus（v0.5.0）は、リンクカードの画像を取得すると、応答の status も Content-Type も
// 見ずに保存する。中身の形式を判別できない（HTML・SVG）と拡張子を .png にする。キャッシュは
// sha256(画像 URL) の前方一致で永久に再利用される（node_modules/remark-link-card-plus/build/index.js:334-379）。
// そのため 404 ページや SVG が .png のまま残ると、そのカードの画像は表示されない（#340）。
// 旧 404 ページには旧電話番号も入っていた。
const CACHE_DIR = path.resolve('public/remark-link-card-plus');

const startsWithBytes = (buffer: Buffer, bytes: number[]) =>
  buffer.subarray(0, bytes.length).equals(Buffer.from(bytes));

const SIGNATURES: Record<string, (buffer: Buffer) => boolean> = {
  png: (b) => startsWithBytes(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  jpg: (b) => startsWithBytes(b, [0xff, 0xd8, 0xff]),
  jpeg: (b) => startsWithBytes(b, [0xff, 0xd8, 0xff]),
  gif: (b) => ['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString('latin1')),
  webp: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  avif: (b) => b.subarray(4, 12).toString('latin1') === 'ftypavif',
  ico: (b) => b.length >= 4 && b.readUInt32LE(0) === 0x00010000,
  svg: (b) => /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg\b/i.test(b.subarray(0, 1024).toString('utf8')),
};

// サイト自身のファビコンは、ビルドのたびに本番から取り直さないよう、正しい PNG をキャッシュとして追跡する
// （本番が保守画面などの HTML を返すと、上の理由でそのまま .png として保存されるため）。
const OWN_FAVICON_URL = 'https://cor-jp.com/favicon-32x32.png';
const OWN_FAVICON_SOURCE = path.resolve('public/favicon-32x32.png');

const cacheFiles = () => readdirSync(CACHE_DIR).filter((name) => !name.startsWith('.'));

describe('remark-link-card-plus image cache', () => {
  it('has a known extension whose file signature matches the content for every cached image', () => {
    const mismatches = cacheFiles().flatMap((name) => {
      const extension = path.extname(name).slice(1).toLowerCase();
      const buffer = readFileSync(path.join(CACHE_DIR, name));
      const matches = SIGNATURES[extension];
      if (matches?.(buffer)) return [];
      return [`${name} (.${extension}) starts with ${buffer.subarray(0, 16).toString('hex')}`];
    });

    // 失敗したファイルは削除するか、中身に合う拡張子に直す（前方一致で探すので、拡張子を変えても再利用される）。
    expect(mismatches).toEqual([]);
  });

  it('serves no active content from cached SVG files', () => {
    const active = cacheFiles()
      .filter((name) => name.toLowerCase().endsWith('.svg'))
      .filter((name) => /<script\b|\son[a-z]+\s*=|javascript:/i.test(readFileSync(path.join(CACHE_DIR, name), 'utf8')));

    expect(active).toEqual([]);
  });

  it('keeps the tracked copy of the site favicon identical to public/favicon-32x32.png', () => {
    const hash = createHash('sha256').update(OWN_FAVICON_URL).digest('hex');
    const cached = cacheFiles().find((name) => name.startsWith(`${hash}.`));

    expect(cached).toBe(`${hash}.png`);
    const cachedDigest = createHash('sha256').update(readFileSync(path.join(CACHE_DIR, cached ?? ''))).digest('hex');
    const sourceDigest = createHash('sha256').update(readFileSync(OWN_FAVICON_SOURCE)).digest('hex');
    expect({ cached: cachedDigest }).toEqual({ cached: sourceDigest });
  });
});
