// #347: 通常ページとブログ記事の og:locale が、ページの言語と一致することを描画後の HTML で確かめる。
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const DIST_DIR = path.resolve(process.env.CONTACT_GUARD_DIST_DIR || 'dist');
const EXPECTED = {
  ja: 'ja_JP',
  en: 'en_US',
  zh: 'zh_CN',
  ko: 'ko_KR',
  es: 'es_ES',
} as const;

describe('5 言語の Open Graph locale (#347)', () => {
  for (const [locale, expected] of Object.entries(EXPECTED)) {
    for (const route of ['', 'blog/complete-markdown-guide']) {
      it(`${locale}: /${route} の og:locale が ${expected} で、重複しない`, () => {
        const file = path.join(DIST_DIR, locale === 'ja' ? '' : locale, route, 'index.html');
        expect(existsSync(file), `${file} が無い。先に npm run build を実行する`).toBe(true);
        const dom = new JSDOM(readFileSync(file, 'utf8'));
        const metas = dom.window.document.querySelectorAll('head meta[property="og:locale"]');
        expect([...metas].map((meta) => meta.getAttribute('content'))).toEqual([expected]);
        dom.window.close();
      });
    }
  }
});
