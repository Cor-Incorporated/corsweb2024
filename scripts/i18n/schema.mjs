/**
 * src/content/config.ts の Zod スキーマのミラー（翻訳結果を書き込む前の検証用）。
 *
 * config.ts は `astro:content`（Vite の仮想モジュール）を import するため素の Node からは読めない。
 * そのためここに同じ制約を複製し、__tests__/schema-link.test.mjs が両者の構造（キー・任意/必須・
 * 型・enum 値）と、実コンテンツ・変異入力に対する合否を機械照合する。片方だけ変えるとテストが
 * 両方の値を挙げて落ちる。
 */
import { z } from 'astro/zod';
import { TARGET_LANGS } from './config.mjs';
import { SOURCE_HASH_RE } from './hash.mjs';

// src/config/categories.ts の BLOG_CATEGORIES[].id
export const BLOG_CATEGORY_IDS = Object.freeze(['ai', 'engineering', 'founder', 'lab']);
// src/config/news-categories.ts の NEWS_CATEGORIES[].id
export const NEWS_CATEGORY_IDS = Object.freeze([
  'info',
  'media',
  'update',
  'event',
  'award',
  'press',
]);
// src/content/config.ts の caseCategories
export const CASE_CATEGORY_IDS = Object.freeze([
  'grift',
  'confidential-ai',
  'local-llm',
  'ai-contract',
  'tech-culture',
]);

const LANG = z.enum(['ja', 'en', 'zh', 'ko', 'es']);

const blogSchema = z.object({
  title: z.string(),
  description: z.string(),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  author: z.string().default('Terisuke'),
  category: z.enum([...BLOG_CATEGORY_IDS]),
  tags: z.array(z.string()).default([]),
  image: z.object({ url: z.string(), alt: z.string() }).optional(),
  ogImage: z.string().optional(),
  isDraft: z.boolean().default(false),
  featured: z.boolean().default(false),
  lang: LANG.default('ja'),
  readingTime: z.number().optional(),
});

const casesSchema = z.object({
  title: z.string(),
  description: z.string(),
  category: z.enum([...CASE_CATEGORY_IDS]),
  tags: z.array(z.string()).default([]),
  publishedAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
  heroImage: z.object({ url: z.string(), alt: z.string() }).optional(),
  ogImage: z.string().optional(),
  summary: z.string(),
  securityNote: z.string().optional(),
  ctaType: z.enum([...CASE_CATEGORY_IDS]).optional(),
  relatedSlugs: z.array(z.string()).optional(),
  isDraft: z.boolean().default(false),
  featured: z.boolean().default(false),
  lang: LANG.default('ja'),
});

const newsSchema = z.object({
  title: z.string(),
  description: z.string(),
  publishedAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
  author: z.string().default('Terisuke'),
  category: z.enum([...NEWS_CATEGORY_IDS]),
  tags: z.array(z.string()).default([]),
  externalUrl: z.string().url().optional(),
  source: z.string().optional(),
  ogImage: z.string().optional(),
  isDraft: z.boolean().default(false),
  featured: z.boolean().default(false),
  lang: LANG.default('ja'),
});

export const CONTENT_SCHEMAS = Object.freeze({
  blog: blogSchema,
  cases: casesSchema,
  news: newsSchema,
});

/** 翻訳先だけに付く来歴フィールド（config.ts の z.object は未知キーを捨てるのでビルドには影響しない）。 */
export const TranslationMetaSchema = z.object({
  lang: z.enum([...TARGET_LANGS]),
  translationSourceHash: z
    .string()
    .regex(SOURCE_HASH_RE, '64 桁の小文字 16 進 SHA-256 ではありません'),
  translatedAt: z
    .union([z.string(), z.date()])
    .refine((v) => !Number.isNaN(new Date(v).getTime()), '日時として解釈できません'),
  translationModel: z.string().min(1),
});

function issues(result, prefix) {
  return result.success
    ? []
    : result.error.issues.map((i) => `${prefix}${i.path.join('.') || '(root)'}: ${i.message}`);
}

/**
 * 翻訳先 frontmatter の検証。違反メッセージの配列（問題なければ空）。
 */
export function validateTranslatedFrontmatter(collection, data, lang) {
  const schema = CONTENT_SCHEMAS[collection];
  if (!schema) return [`未知のコレクションです: ${collection}`];
  const errors = [
    ...issues(schema.safeParse(data), 'schema '),
    ...issues(TranslationMetaSchema.safeParse(data), 'meta '),
  ];
  if (data.lang !== lang) errors.push(`lang が ${lang} ではありません（${String(data.lang)}）`);
  return errors;
}
