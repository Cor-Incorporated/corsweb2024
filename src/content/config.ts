import { z, defineCollection } from 'astro:content';
import { blogFrontmatterSchema } from '../config/blog-schema';
import { getNewsCategoryIds } from '../config/news-categories';

// スキーマ本体は src/config/blog-schema.ts。CMS の public/admin/config.yml と照合するテストが
// astro:content を経由せずに同じ定義を読めるよう、別ファイルに置いている（ADR-0018）。
const blogCollection = defineCollection({
  type: 'content',
  schema: blogFrontmatterSchema,
});

// 実績記事（ケーススタディ）コレクション。/works のカードから個別記事へリンクするための構造化記事。
// 本文（problem / approach / implementation / result）は markdown body に `## 課題` `## アプローチ`
// `## 実装` `## 成果` の見出しで執筆する（terisuke が自然に書けるように）。
// ファイルは blog と同じく `cases/{ja,en,zh,ko,es}/<slug>.md` に言語別ディレクトリで配置する
// （slug が `<lang>/<slug>` になるため、ルート側で lang フィルタ + 接頭辞の除去が必要）。
const caseCategories = [
  'grift',
  'confidential-ai',
  'local-llm',
  'ai-contract',
  'tech-culture',
] as const;

const casesCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    // CTA の出し分けを駆動するカテゴリ（step 3 参照）。
    category: z.enum(caseCategories),
    tags: z.array(z.string()).default([]),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    heroImage: z
      .object({
        url: z.string(),
        alt: z.string(),
      })
      .optional(),
    ogImage: z.string().optional(),
    // 1〜2行のリード文。hero に表示。
    summary: z.string(),
    // NDA案件用の注記。設定時は callout box に表示。
    securityNote: z.string().optional(),
    // CTA の種類。省略時は category にフォールバック（step 3）。
    ctaType: z.enum(caseCategories).optional(),
    relatedSlugs: z.array(z.string()).optional(),
    isDraft: z.boolean().default(false),
    featured: z.boolean().default(false),
    // 記事の言語。ディレクトリ名（cases/<lang>/）と一致させる。既定は ja。
    lang: z.enum(['ja', 'en', 'zh', 'ko', 'es']).default('ja'),
  }),
});

// ニュースコレクション。cases と同じく `news/{ja,en,zh,ko,es}/<slug>.md` に言語別配置する。
const newsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    author: z.string().default('Terisuke'),
    category: z.enum(getNewsCategoryIds() as [string, ...string[]]),
    tags: z.array(z.string()).default([]),
    externalUrl: z.string().url().optional(),
    source: z.string().optional(),
    ogImage: z.string().optional(),
    isDraft: z.boolean().default(false),
    featured: z.boolean().default(false),
    lang: z.enum(['ja', 'en', 'zh', 'ko', 'es']).default('ja'),
  }),
});

export const collections = {
  blog: blogCollection,
  cases: casesCollection,
  news: newsCollection,
};
