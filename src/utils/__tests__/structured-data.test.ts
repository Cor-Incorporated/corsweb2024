import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LEGAL_NAME,
  ORGANIZATION_ID,
  ORGANIZATION_NAMES,
  ORGANIZATION_SAME_AS,
  SOCIAL_LINKS,
  WEBSITE_ID,
} from '../../config/organization';
import type { Locale } from '../i18n';
import { buildFaqPageJsonLd, buildOrganizationJsonLd, buildWebSiteJsonLd, organizationRef } from '../structured-data';

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

  it('lists only company accounts in sameAs (the founder\'s personal X stays in the footer only)', () => {
    const sameAs = buildOrganizationJsonLd('ja').sameAs as string[];
    expect(sameAs).toEqual([...ORGANIZATION_SAME_AS]);
    expect(sameAs).toEqual(SOCIAL_LINKS.filter((link) => link.owner === 'company').map((link) => link.href));
    expect(sameAs).not.toContain('https://x.com/cor_terisuke');
    for (const personal of ['linkedin.com/in/', 'facebook.com/kousuke', 'qiita.com/terisuke', 'zenn.dev/cloudia']) {
      expect(sameAs.some((url) => url.includes(personal))).toBe(false);
    }
  });

  it.each(LOCALES)('%s: contactPoint points to the localized contact page', (locale) => {
    const contact = buildOrganizationJsonLd(locale).contactPoint as Record<string, unknown>;
    expect(contact.url).toBe(locale === 'ja' ? 'https://cor-jp.com/contact/' : `https://cor-jp.com/${locale}/contact/`);
  });

  it.each(LOCALES)('%s: organizationRef uses the same @id and name as the Organization node', (locale) => {
    const org = buildOrganizationJsonLd(locale);
    expect(organizationRef(locale)).toMatchObject({ '@id': org['@id'], name: org.name, '@type': 'Organization' });
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

// 宣言（config/organization.ts）の外に、会社の @id や社名を直書きしていないこと（別ノード化の再発防止）。
const SRC = path.resolve('src');
const ORGANIZATION_FILE = path.join(SRC, 'config', 'organization.ts');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return ['__tests__', 'content'].includes(name) ? [] : walk(full);
    return /\.(astro|ts|mjs|js)$/.test(name) ? [full] : [];
  });
const CODE = walk(SRC)
  .filter((file) => file !== ORGANIZATION_FILE)
  .map((file) => ({ file: path.relative(SRC, file), text: readFileSync(file, 'utf8') }));

describe('single source of the Organization', () => {
  it('no file other than config/organization.ts writes an organization @id', () => {
    const offenders = CODE.filter(({ text }) => text.includes('#organization')).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  // og:site_name は WebSite.name と一致させる（SNS カードと検索結果でサイト名が割れないように）
  it('every og:site_name meta takes its value from ORGANIZATION_NAMES (same source as WebSite.name)', () => {
    const metas = CODE.flatMap(({ file, text }) =>
      [...text.matchAll(/<meta\s+property=["']og:site_name["']\s+content=([^/>]+?)\s*\/?>/g)].map((match) => ({ file, content: match[1] })),
    );
    expect(metas.map(({ file }) => file).sort()).toEqual([path.join('components', 'blog', 'seo', 'BlogOgp.astro'), path.join('layouts', 'Layout.astro')]);
    for (const { file, content } of metas) expect(content, file).toBe('{ORGANIZATION_NAMES[currentLocale]}');
    for (const locale of LOCALES) expect(buildWebSiteJsonLd(locale).name).toBe(ORGANIZATION_NAMES[locale]);
  });

  it('no file other than config/organization.ts hard-codes the company name as a name / locale-map value', () => {
    // name: 'Cor.inc' / "name": "Cor.株式会社" / ja: 'Cor.株式会社'（社名マップ）/ alternateName: ['Cor.Inc.'] の形を探す。
    // alt 属性や本文・RSS のタイトル中の社名（UI の文言）は対象外。
    const companyName = String.raw`(?:Cor\.(?:inc|Inc\.|株式会社|주식회사)|Cor Inc|Cor株式会社|コー株式会社)`;
    const pattern = new RegExp(
      String.raw`["']?\b(?:name|legalName|alternateName|ja|en|zh|ko|es)["']?\s*:\s*\[?\s*(['"\x60])` + companyName + String.raw`\1`,
    );
    const offenders = CODE.filter(({ text }) => pattern.test(text)).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});
