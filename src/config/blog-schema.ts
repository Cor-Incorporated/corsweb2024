import { z } from 'astro/zod';
import { getCategoryIds } from './categories';

/**
 * ブログ記事（src/content/blog/<lang>/*.md）の frontmatter スキーマ。
 * src/content/config.ts の blog コレクションはこの定義だけを使う。
 *
 * 二重管理の注意: CMS（Sveltia CMS, ADR-0018）の cms/public/config.yml も同じ項目を持つ。
 * src/config/__tests__/cms-config.test.ts が次を照合し、片方だけ変えると両側の値を出して落ちる。
 * - 必須項目（default も optional も無いキー）↔ config.yml の必須フィールド
 * - category の選択肢 ↔ config.yml の select の選択肢
 * - optional のキー ↔ config.yml の required: false（空のとき出力しない）
 */
export const blogFrontmatterSchema = z.object({
  title: z.string(),
  description: z.string(),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  author: z.string().default('Terisuke'),
  category: z.enum(getCategoryIds() as [string, ...string[]]),
  tags: z.array(z.string()).default([]),
  image: z
    .object({
      url: z.string(),
      alt: z.string(),
    })
    .optional(),
  ogImage: z.string().optional(),
  isDraft: z.boolean().default(false),
  featured: z.boolean().default(false),
  lang: z.enum(['ja', 'en', 'zh', 'ko', 'es']).default('ja'),
  readingTime: z.number().optional(),
});
