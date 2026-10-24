// ページの title と description（src/i18n/locales/*.json の meta）の社名と言語の検査。
// ADR-0007: 社名は「Cor.株式会社」。ブランド表記の Cor.inc を使うときも、会社情報では正式名称を明示する。
// title に出す社名は、各言語の正式な表記（ORGANIZATION_NAMES）にそろえる（CLAUDE.md: 社名の唯一の出どころ）。
// 2026-10-24: ja の /about・/contact・404 の title が英語のまま「Cor.inc」で、/contact と 404 の
// description も英語だった。ビルド結果の <title> は tests/build-output/company-name.test.ts で見る。
import { describe, expect, it } from 'vitest';
import enJson from '../../i18n/locales/en.json';
import esJson from '../../i18n/locales/es.json';
import jaJson from '../../i18n/locales/ja.json';
import koJson from '../../i18n/locales/ko.json';
import zhJson from '../../i18n/locales/zh.json';
import { ORGANIZATION_NAMES } from '../organization';

type MetaEntry = { title?: unknown; description?: unknown };

const LOCALE_META = {
  ja: jaJson.meta,
  en: enJson.meta,
  zh: zhJson.meta,
  ko: koJson.meta,
  es: esJson.meta,
} as Record<keyof typeof ORGANIZATION_NAMES, Record<string, MetaEntry>>;

const JAPANESE = /[぀-ヿ一-鿿]/;
// 古い表記。大文字小文字を区別する（英語の正式な表記は「Cor.Inc.」）
const OLD_NAMES = /Cor\.inc|Cor Inc\.|Cor株式会社/;

function entries(locale: keyof typeof ORGANIZATION_NAMES) {
  return Object.entries(LOCALE_META[locale]).map(([key, value]) => ({
    key,
    title: String(value.title ?? ''),
    description: String(value.description ?? ''),
  }));
}

describe('meta の社名', () => {
  for (const locale of Object.keys(LOCALE_META) as Array<keyof typeof ORGANIZATION_NAMES>) {
    it(`${locale}: どの title にも正式な社名（${ORGANIZATION_NAMES[locale]}）が入り、Cor.inc が無い`, () => {
      const offenders = entries(locale)
        .filter(({ title, description }) => !title.includes(ORGANIZATION_NAMES[locale]) || OLD_NAMES.test(title + description))
        .map(({ key, title }) => `meta.${key}.title = ${JSON.stringify(title)}`);
      expect(offenders, `正式な社名: ${ORGANIZATION_NAMES[locale]}`).toEqual([]);
    });
  }
});

describe('ja の meta は日本語', () => {
  it('ja の title と description に日本語が入っている（英語のままの meta が無い）', () => {
    const offenders = entries('ja')
      .filter(({ title, description }) => !JAPANESE.test(title) || !JAPANESE.test(description))
      .map(({ key, title, description }) => `meta.${key}: title=${JSON.stringify(title)} description=${JSON.stringify(description)}`);
    expect(offenders).toEqual([]);
  });
});
