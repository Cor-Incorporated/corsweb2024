/**
 * 資料請求の固定値。Worker の同名定数とパリティテストで揃える。
 * 資料そのものは COMPANY_DECK_URL（公開スライド）。この ID は請求の種別だけを表す。
 */
export const DOCUMENT_REQUEST_ID = 'company-deck';

/** 同意チェックの版。文言を変えたら版も変える。法務の確定前の仮の版。 */
export const DOCUMENT_REQUEST_CONSENT_VERSION = 'document-request-1';

export const DOCUMENT_REQUEST_INDUSTRIES = [
  'medical',
  'shigyo',
  'construction',
  'manufacturing',
  'education',
] as const;

export type DocumentRequestIndustry = (typeof DOCUMENT_REQUEST_INDUSTRIES)[number];

export function isDocumentRequestIndustry(value: string): value is DocumentRequestIndustry {
  return (DOCUMENT_REQUEST_INDUSTRIES as readonly string[]).includes(value);
}
