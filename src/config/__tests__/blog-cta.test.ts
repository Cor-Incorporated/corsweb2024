import { describe, expect, it } from 'vitest';
import { BLOG_CTA_DEFAULT_INTENTS, blogCtaSource, resolveBlogCtaIntent } from '../blog-cta';
import { getCategoryIds } from '../categories';
import { CONTACT_INTENTS } from '../site';

describe('blog CTA intent (ADR-0020)', () => {
  it('has a default intent for every blog category', () => {
    expect(Object.keys(BLOG_CTA_DEFAULT_INTENTS).sort()).toEqual([...getCategoryIds()].sort());
  });

  it('uses only the intents of ADR-0014', () => {
    for (const intent of Object.values(BLOG_CTA_DEFAULT_INTENTS)) {
      expect(CONTACT_INTENTS).toContain(intent);
    }
  });

  it.each([
    ['ai', undefined, 'confidential-ai-assessment'],
    ['engineering', undefined, 'contract-dev'],
    ['founder', undefined, 'press-speaking-other'],
    ['lab', undefined, 'press-speaking-other'],
    ['ai', 'local-llm-poc', 'local-llm-poc'],
    ['engineering', 'grift-team-beta', 'grift-team-beta'],
  ] as const)('%s + %s → %s', (category, override, expected) => {
    expect(resolveBlogCtaIntent(category, override)).toBe(expected);
  });

  it('records the article as the source', () => {
    expect(blogCtaSource('local-llm-secure-ai-start-guide')).toBe('blog/local-llm-secure-ai-start-guide');
  });
});
