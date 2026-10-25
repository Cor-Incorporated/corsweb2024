// ビルド済み dist の社名の検査（設定: vitest.dist.config.ts。`npm run build` の後に `npm run test:dist`）。
// ADR-0007: 社名は「Cor.株式会社」。ブランド表記の Cor.inc を使うときも、会社情報では正式名称を明示する。
// ページの <title>、フッターの著作権表示、特商法の販売業者、ブログの RSS の著作権は、各言語の正式な表記
// （ORGANIZATION_NAMES）にそろえる。OG 画像のロゴの文字や RSS の題名など、ブランドとしての Cor.inc は見ない。
// 2026-10-24: /about・/contact・404・特商法・ブログのカテゴリとタグの一覧の <title>、全ページのフッター、
// 特商法の販売業者、RSS の <copyright> に「Cor.inc」「Cor株式会社」「Cor Inc.」が残っていた。
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ORGANIZATION_NAMES } from '../../src/config/organization';

const DIST_DIR = path.resolve(process.env.CONTACT_GUARD_DIST_DIR || 'dist');
// 古い表記。大文字小文字を区別する（英語の正式な表記は「Cor.Inc.」）
const OLD_NAMES = /Cor\.inc|Cor Inc\.|Cor株式会社/;
const NON_JA = ['en', 'zh', 'ko', 'es'] as const;
type Locale = keyof typeof ORGANIZATION_NAMES;

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(full);
    return entry.name.endsWith('.html') ? [full] : [];
  });
}

function localeOf(file: string): Locale {
  const first = path.relative(DIST_DIR, file).split(path.sep)[0];
  return (NON_JA as readonly string[]).includes(first) ? (first as Locale) : 'ja';
}

const read = (file: string) => readFileSync(file, 'utf8');
const relative = (file: string) => path.relative(DIST_DIR, file);

describe('dist の社名', () => {
  it('dist がある', () => {
    expect(existsSync(DIST_DIR), `${DIST_DIR} が無い。先に npm run build を実行する`).toBe(true);
  });

  const files = existsSync(DIST_DIR) ? htmlFiles(DIST_DIR) : [];

  it('どのページの <title> にも古い表記が無い', () => {
    const offenders = files.flatMap((file) => {
      const title = read(file).match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '';
      return OLD_NAMES.test(title) ? [`${relative(file)}: ${title}`] : [];
    });
    expect(files.length).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });

  it('フッターの著作権表示は、その言語の正式な社名', () => {
    const checked: string[] = [];
    const offenders = files.flatMap((file) => {
      const match = read(file).match(/©\s*\d{4}\s*([^<]+?)\s*</);
      if (!match) return [];
      checked.push(relative(file));
      const expected = ORGANIZATION_NAMES[localeOf(file)];
      return match[1] === expected ? [] : [`${relative(file)}: 「${match[1]}」（正: ${expected}）`];
    });
    expect(checked.length).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });

  it('特商法のページの販売業者は正式な社名で、古い表記が無い', () => {
    for (const locale of ['ja', ...NON_JA] as Locale[]) {
      const file = path.join(DIST_DIR, locale === 'ja' ? '' : locale, 'legal', 'tokushoho', 'index.html');
      expect(existsSync(file), file).toBe(true);
      const html = read(file);
      expect(html.match(OLD_NAMES)?.[0], relative(file)).toBeUndefined();
      expect(html, relative(file)).toContain(ORGANIZATION_NAMES[locale]);
    }
  });

  it('ブログの RSS の著作権は、その言語の正式な社名', () => {
    for (const locale of ['ja', ...NON_JA] as Locale[]) {
      const file = path.join(DIST_DIR, locale === 'ja' ? '' : locale, 'rss.xml');
      expect(existsSync(file), file).toBe(true);
      const copyright = read(file).match(/<copyright>([\s\S]*?)<\/copyright>/)?.[1] ?? '';
      expect(copyright, relative(file)).toMatch(new RegExp(`^Copyright \\d{4} ${ORGANIZATION_NAMES[locale].replace(/[.]/g, '\\.')}$`));
    }
  });
});
