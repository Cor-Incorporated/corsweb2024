import { describe, expect, it } from 'vitest';
import {
  COMPANY_SOCIAL_LINKS,
  LEGAL_NAME,
  ORGANIZATION_ID,
  ORGANIZATION_NAMES,
  WEBSITE_ID,
} from '../../config/organization';
import type { Locale } from '../i18n';
import { buildFaqPageJsonLd, buildOrganizationJsonLd, buildWebSiteJsonLd } from '../structured-data';

const LOCALES: Locale[] = ['ja', 'en', 'zh', 'ko', 'es'];

describe('buildOrganizationJsonLd', () => {
  it.each(LOCALES)('%s: fixed @id, locale name and the legal name from ADR-0007', (locale) => {
    const org = buildOrganizationJsonLd(locale);
    expect(org['@id']).toBe(ORGANIZATION_ID);
    expect(org['@id']).toBe('https://cor-jp.com/#organization');
    expect(org.name).toBe(ORGANIZATION_NAMES[locale]);
    expect(org.legalName).toBe('Cor.株式会社');
    expect(org.legalName).toBe(LEGAL_NAME);
    expect(org.alternateName).not.toContain(org.name);
    expect(typeof org.description).toBe('string');
    expect((org.description as string).length).toBeGreaterThan(20);
  });

  it('uses only the official locale name forms (no Cor.inc / コー株式会社 variants)', () => {
    const names = LOCALES.flatMap((locale) => {
      const org = buildOrganizationJsonLd(locale);
      return [org.name, org.legalName, ...(org.alternateName as string[])];
    });
    expect([...new Set(names)].sort()).toEqual(['Cor.Inc.', 'Cor.주식회사', 'Cor.株式会社'].sort());
  });

  it('lists only company accounts in sameAs (same source as the footer Social links)', () => {
    const sameAs = buildOrganizationJsonLd('ja').sameAs as string[];
    expect(sameAs).toEqual(COMPANY_SOCIAL_LINKS.map((link) => link.href));
    for (const personal of ['linkedin.com/in/', 'facebook.com/kousuke', 'qiita.com/terisuke', 'zenn.dev/cloudia']) {
      expect(sameAs.some((url) => url.includes(personal))).toBe(false);
    }
  });
});

describe('buildWebSiteJsonLd', () => {
  it('has no SearchAction and points to the Organization as publisher', () => {
    const site = buildWebSiteJsonLd('en');
    expect(site['@id']).toBe(WEBSITE_ID);
    expect(site.name).toBe('Cor.Inc.');
    expect(site).not.toHaveProperty('potentialAction');
    expect(site.publisher).toEqual({ '@id': ORGANIZATION_ID });
  });
});

describe('buildFaqPageJsonLd', () => {
  it('mirrors the displayed questions and answers', () => {
    const faq = buildFaqPageJsonLd([{ question: 'Q1', answer: 'A1' }]);
    expect(faq['@type']).toBe('FAQPage');
    expect(faq.mainEntity).toEqual([
      { '@type': 'Question', name: 'Q1', acceptedAnswer: { '@type': 'Answer', text: 'A1' } },
    ]);
  });
});
