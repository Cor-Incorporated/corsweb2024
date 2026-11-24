import { LOCALES } from '../utils/content-i18n';
import { INDUSTRY_SLUGS, industryPagePath } from './industry-context';

/**
 * 資料請求の固定値。Worker の同名定数とパリティテストで揃える。
 * 資料そのものは COMPANY_DECK_URL（公開スライド）。この ID は請求の種別だけを表す。
 */
export const DOCUMENT_REQUEST_ID = 'company-deck';

/** 同意チェックの版。文言を変えたら版も変える。法務の確定前の仮の版。 */
export const DOCUMENT_REQUEST_CONSENT_VERSION = 'document-request-1';

// 現行の公開スライドは同じ URL で更新されるため、実物の版を特定できない。
export const DOCUMENT_REQUEST_VERSION = '';

export const DOCUMENT_REQUEST_INDUSTRIES = INDUSTRY_SLUGS;

// 会社情報と、静的に公開する5業種のページを5言語分だけ記録する。
export const DOCUMENT_REQUEST_ENTRY_PATHS: readonly string[] = LOCALES.flatMap((locale) => {
  const prefix = locale === 'ja' ? '' : `/${locale}`;
  return [
    `${prefix}/company/`,
    ...INDUSTRY_SLUGS.map((slug) => `${prefix}${industryPagePath(slug)}/`),
  ];
});

export type DocumentRequestIndustry = (typeof DOCUMENT_REQUEST_INDUSTRIES)[number];

export function isDocumentRequestIndustry(value: string): value is DocumentRequestIndustry {
  return (DOCUMENT_REQUEST_INDUSTRIES as readonly string[]).includes(value);
}

/**
 * どこで知ったか（任意）。GA4 には送らず、受付の記録にだけ残す。
 * 自由記述は「その他」の時だけ受け付け、この文字数までにする。
 */
export const DOCUMENT_REQUEST_DISCOVERY_SOURCES = [
  'x',
  'linkedin',
  'note',
  'qiita',
  'search',
  'referral',
  'event',
  'other',
] as const;

export const DOCUMENT_REQUEST_DISCOVERY_OTHER_MAX = 100;
