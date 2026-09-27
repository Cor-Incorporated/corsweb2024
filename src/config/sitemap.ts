/**
 * sitemap の lastmod（Epic #330 / #334）。astro.config.mjs の @astrojs/sitemap serialize から使う。
 *
 * 以前は `lastmod: new Date()` で全 URL がビルド時刻になり、更新の合図として意味を持たなかった。
 * 記事だけに frontmatter の updatedDate ?? pubDate を付け、記事以外には付けない。
 * astro.config の評価時点では content collections を使えないため、frontmatter を直接読む。
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

export const BLOG_LOCALES = ['ja', 'en', 'zh', 'ko', 'es'] as const;

/** ブログ記事の公開 URL パス（src/pages/{,<lang>/}blog/[...slug].astro と同じ規則）。 */
export function blogPostPath(lang: string, slug: string): string {
  return lang === 'ja' ? `/blog/${slug}/` : `/${lang}/blog/${slug}/`;
}

type ArticleDates = { pubDate?: unknown; updatedDate?: unknown };

/** 記事の lastmod（updatedDate ?? pubDate）を ISO 文字列で返す。解釈できなければ null。 */
export function articleLastmod({ pubDate, updatedDate }: ArticleDates): string | null {
  for (const value of [updatedDate, pubDate]) {
    if (value == null || value === '') continue;
    const date = value instanceof Date ? value : new Date(String(value));
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return null;
}

/** src/content/blog/<lang>/<slug>.md の frontmatter から「記事 URL パス → lastmod」を作る（下書きは除外）。 */
export function collectBlogLastmod(blogDir: string): ReadonlyMap<string, string> {
  const entries: [string, string][] = [];
  for (const lang of BLOG_LOCALES) {
    const dir = path.join(blogDir, lang);
    let files: string[];
    try {
      files = readdirSync(dir);
    } catch {
      continue;
    }
    for (const file of files.filter((name) => /\.mdx?$/.test(name)).sort()) {
      const { data } = matter(readFileSync(path.join(dir, file), 'utf8'));
      if (data.isDraft === true) continue;
      const lastmod = articleLastmod(data);
      if (lastmod) entries.push([blogPostPath(lang, file.replace(/\.mdx?$/, '')), lastmod]);
    }
  }
  return new Map(entries);
}
