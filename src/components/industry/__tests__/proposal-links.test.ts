// 業種のページの「問い合わせ」の入口（industryInquiryHref）の行き先。
// サイトのほかの入口と同じ getContactUrl を通るので、Cloudia を止めた切り戻しの旗（PUBLIC_CLOUDIA_CONTACT_PRIMARY_ENABLED）にも従う。
import { afterEach, describe, expect, it, vi } from 'vitest';
import { INDUSTRY_SLUGS } from '../../../config/industry-context';
import { industryInquiryHref } from '../proposal-links';

const LOCALES = ['ja', 'en', 'zh', 'ko', 'es'] as const;
const CASES = LOCALES.flatMap((locale) => INDUSTRY_SLUGS.map((slug) => ({ locale, slug })));

describe('industryInquiryHref', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(CASES)('$locale/$slug: 既定の build では、浮きボタンと同じ形でチャットへ（query の順も同じ）', ({ locale, slug }) => {
    expect(industryInquiryHref(locale, slug)).toBe(`/contact/chat/?source=industry-${slug}&locale=${locale}`);
  });

  it.each(CASES)('$locale/$slug: 切り戻し（旗が false）の build では、その言語の問い合わせページへ', ({ locale, slug }) => {
    vi.stubEnv('PUBLIC_CLOUDIA_CONTACT_PRIMARY_ENABLED', 'false');
    const page = locale === 'ja' ? '/contact' : `/${locale}/contact`;
    expect(industryInquiryHref(locale, slug)).toBe(`${page}?source=industry-${slug}`);
  });
});
