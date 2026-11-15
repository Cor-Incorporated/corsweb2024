// 業種のページの本文（locale の industry<Name>.proposal）の、ja と訳の形の照合。
// 訳は ja と同じ形でなければならない: 同じ key が同じ順に並び、配列の長さ、出典の番号（cite・sourceLink）、
// 文の中のリンクの名前（link）、署名の区画の向き（bylineAt）、上の小見出し（eyebrow）が ja と同じ。
// 文字は空でなく、かな（区切りの「・」は除く）・Markdown の記号・[n] の印が残っていない。
// 形が違うと、出典の番号が別の資料を指したり、区画が欠けたりする。
import { describe, expect, it } from 'vitest';
import { PROPOSAL_LINKS } from '../proposal-links';
import { PROPOSAL_LOCALES } from '../proposal-locales';
import { assertProposalLinks, proposalPageSchema } from '../proposal-schema';
import en from '../../../i18n/locales/en.json';
import es from '../../../i18n/locales/es.json';
import ja from '../../../i18n/locales/ja.json';
import ko from '../../../i18n/locales/ko.json';
import zh from '../../../i18n/locales/zh.json';

const LOCALES = { ja, en, zh, ko, es } as const;
type LocaleKey = keyof typeof LOCALES;
const PAGE_KEYS = {
  medical: 'industryMedical',
  shigyo: 'industryShigyo',
  construction: 'industryConstruction',
  manufacturing: 'industryManufacturing',
  education: 'industryEducation',
} as const;
type Slug = keyof typeof PAGE_KEYS;
const SLUGS = Object.keys(PAGE_KEYS) as Slug[];
const COPIED_KEYS = new Set(['link', 'bylineAt', 'eyebrow']);
// かな（U+30FB の「・」は名前の区切りとして使うので除く）
const KANA = /[぀-ゟ゠-ヺー-ヿ]/;

function proposal(locale: LocaleKey, slug: Slug): unknown {
  return (LOCALES[locale][PAGE_KEYS[slug]] as { proposal?: unknown }).proposal;
}

/** ja と訳を並べてたどり、食い違いを「場所: 中身」の形で集める */
function compare(source: unknown, target: unknown, where: string, problems: string[], inLinkRun = false): void {
  if (Array.isArray(source)) {
    if (!Array.isArray(target) || target.length !== source.length) {
      problems.push(`${where}: 長さ ja=${source.length} 訳=${Array.isArray(target) ? target.length : typeof target}`);
      return;
    }
    const linkRun = source.some((part) => typeof part === 'object' && part !== null && 'link' in part);
    source.forEach((item, i) => compare(item, target[i], `${where}[${i}]`, problems, linkRun));
    return;
  }
  if (typeof source === 'object' && source !== null) {
    const sourceKeys = Object.keys(source);
    const targetKeys = typeof target === 'object' && target !== null ? Object.keys(target) : [];
    if (sourceKeys.join() !== targetKeys.join()) {
      problems.push(`${where}: key ja=[${sourceKeys}] 訳=[${targetKeys}]`);
      return;
    }
    for (const key of sourceKeys) {
      const a = (source as Record<string, unknown>)[key];
      const b = (target as Record<string, unknown>)[key];
      if (COPIED_KEYS.has(key)) {
        if (a !== b) problems.push(`${where}.${key}: ja=${JSON.stringify(a)} 訳=${JSON.stringify(b)}`);
      } else {
        compare(a, b, `${where}.${key}`, problems);
      }
    }
    return;
  }
  if (typeof source === 'string') {
    if (typeof target !== 'string' || target.trim() === '') {
      problems.push(`${where}: 空か文字列でない`);
      return;
    }
    if (target !== target.trim() && !inLinkRun) problems.push(`${where}: 前後に空白`);
    if (KANA.test(target)) problems.push(`${where}: かなが残っている ${JSON.stringify(target.slice(0, 40))}`);
    if (/\*\*|##|<!--|\]\(/.test(target)) problems.push(`${where}: Markdown の記号 ${JSON.stringify(target.slice(0, 40))}`);
    if (/\[[0-9]+\]/.test(target)) problems.push(`${where}: 文の中に [n] の印 ${JSON.stringify(target.slice(0, 40))}`);
    return;
  }
  if (source !== target) problems.push(`${where}: ja=${JSON.stringify(source)} 訳=${JSON.stringify(target)}`);
}

const TRANSLATED = PROPOSAL_LOCALES.filter((locale) => locale !== 'ja') as LocaleKey[];
const CASES = TRANSLATED.flatMap((locale) => SLUGS.map((slug) => ({ locale, slug, name: `${locale}/${slug}` })));

describe('業種のページの本文の形', () => {
  it.each(SLUGS)('ja/%s: 形の検証と、出典の番号・リンク先の表がそろう', (slug) => {
    const page = proposalPageSchema.parse(proposal('ja', slug));
    expect(() => assertProposalLinks(page, PROPOSAL_LINKS[slug], `ja/${slug}`)).not.toThrow();
  });

  it.each(CASES)('$name: 訳が ja と同じ形で、検証と出典の表がそろう', ({ locale, slug }) => {
    const problems: string[] = [];
    compare(proposal('ja', slug), proposal(locale, slug), `${locale}/${slug}`, problems);
    expect(problems).toEqual([]);
    const page = proposalPageSchema.parse(proposal(locale, slug));
    expect(() => assertProposalLinks(page, PROPOSAL_LINKS[slug], `${locale}/${slug}`)).not.toThrow();
  });
});
