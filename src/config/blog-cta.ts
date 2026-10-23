/**
 * ブログ記事の CTA ボックス（本文の下に 1 つ）で案内する相談の種類（ADR-0020）。
 * frontmatter の ctaIntent が無いときは、カテゴリの既定値を使う。source は `blog/<slug>`。
 */
import type { ContactIntent } from './site';

export const BLOG_CTA_DEFAULT_INTENTS: Readonly<Record<string, ContactIntent>> = {
  ai: 'confidential-ai-assessment',
  engineering: 'contract-dev',
  founder: 'press-speaking-other',
  lab: 'press-speaking-other',
};

export function resolveBlogCtaIntent(category: string, ctaIntent?: ContactIntent): ContactIntent {
  return ctaIntent ?? BLOG_CTA_DEFAULT_INTENTS[category] ?? 'confidential-ai-assessment';
}

/** 問い合わせの通知に残す流入元（ADR-0020 の 3）。slug は言語の接頭辞を除いたもの。 */
export function blogCtaSource(cleanSlug: string): string {
  return `blog/${cleanSlug}`;
}
