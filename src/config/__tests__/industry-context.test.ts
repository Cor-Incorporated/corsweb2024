import { describe, expect, it } from 'vitest';
import {
  INDUSTRY_NAMED_CASE,
  INDUSTRY_SLUGS,
  industryContactSource,
  industrySlugFromPath,
} from '../industry-context';

describe('業種ページの source', () => {
  it.each(INDUSTRY_SLUGS)('%s のパスから industry-* を返す', (slug) => {
    expect(industrySlugFromPath(`/industries/${slug}`)).toBe(slug);
    expect(industrySlugFromPath(`/industries/${slug}/`)).toBe(slug);
    expect(industrySlugFromPath(`/en/industries/${slug}`)).toBe(slug);
    expect(industryContactSource(slug)).toBe(`industry-${slug}`);
  });

  it('業種ページ以外は null', () => {
    expect(industrySlugFromPath('/')).toBeNull();
    expect(industrySlugFromPath('/contact')).toBeNull();
    expect(industrySlugFromPath('/industries/medical/extra')).toBeNull();
  });

  it('公開本文が業種を名指しする実績は教育だけ', () => {
    expect(INDUSTRY_NAMED_CASE).toEqual({ education: 'legacy-core-system-cloud-migration' });
  });
});
