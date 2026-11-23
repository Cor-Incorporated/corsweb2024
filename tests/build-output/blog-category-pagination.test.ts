import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BLOG_CATEGORIES } from '../../src/config/categories';

const dist = path.resolve(process.env.CONTACT_GUARD_DIST_DIR || 'dist');
const locales = ['ja', 'en', 'zh', 'ko', 'es'];

describe('ブログのカテゴリーのページ送り', () => {
  for (const locale of locales) {
    for (const { id } of BLOG_CATEGORIES) {
      it(`${locale}/${id}: 前後と番号が生成済みの同じカテゴリーを向く`, () => {
        const categoryPath = `${locale === 'ja' ? '' : `/${locale}`}/blog/category/${id}`;
        const directory = path.join(dist, categoryPath);
        const pageNumbers = [1, ...readdirSync(directory, { withFileTypes: true })
          .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
          .map((entry) => Number(entry.name))
          .sort((a, b) => a - b)];
        const pagePath = (number: number) => number === 1 ? categoryPath : `${categoryPath}/${number}`;

        for (const [index, pageNumber] of pageNumbers.entries()) {
          const currentPath = pagePath(pageNumber);
          const html = readFileSync(path.join(dist, currentPath, 'index.html'), 'utf8');
          const nav = html.match(/<nav\b[^>]*aria-label=["']?Pagination["']?(?=[\s>])[^>]*>([\s\S]*?)<\/nav>/)?.[1];
          if (pageNumbers.length === 1) {
            expect(nav).toBeUndefined();
            continue;
          }
          expect(nav, currentPath).toBeDefined();

          const targets = [...nav!.matchAll(/\bhref=["']?([^"'\s>]+)/g)]
            .map((match) => match[1])
            .filter((href) => href !== '#')
            .map((href) => href.replace(/\/$/, ''));
          const expected = pageNumbers.map(pagePath);
          if (index > 0) expected.unshift(pagePath(pageNumbers[index - 1]));
          if (index < pageNumbers.length - 1) expected.push(pagePath(pageNumbers[index + 1]));
          expect(targets, currentPath).toEqual(expected);
        }
      });
    }
  }
});
