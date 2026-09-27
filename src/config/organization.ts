/**
 * 会社（Organization）の事実の正本。JSON-LD・フッター・ブログの <title> がここを読む。
 * 同じ事実を複数箇所に書かない（片方だけ直して表記が 4 種類に割れた経緯がある: M1）。
 */
import type { Locale } from '../utils/i18n';

export const SITE_ORIGIN = 'https://cor-jp.com';
export const ORGANIZATION_ID = `${SITE_ORIGIN}/#organization`;
export const WEBSITE_ID = `${SITE_ORIGIN}/#website`;

/** 正式社名（ADR-0007: 社名は「Cor.株式会社」に統一）。JSON-LD の legalName は全ロケールでこれ。 */
export const LEGAL_NAME = 'Cor.株式会社';

/**
 * ロケール別の社名表記（#306 で決めた <title> の表記と同じ）。ja / zh は正式名、ko はハングル表記、
 * en / es はラテン文字表記。Record にして全ロケールの網羅を型で強制する。
 */
export const ORGANIZATION_NAMES: Record<Locale, string> = {
  ja: LEGAL_NAME,
  zh: LEGAL_NAME,
  ko: 'Cor.주식회사',
  en: 'Cor.Inc.',
  es: 'Cor.Inc.',
};

/**
 * 会社の公式 SNS アカウント。フッター「Social」と Organization.sameAs の正本。
 * 個人アカウント（代表の LinkedIn / Facebook / Qiita 等）は会社の sameAs に入れない（Person 側で扱う）。
 */
export const COMPANY_SOCIAL_LINKS = [
  { name: 'Github', href: 'https://github.com/Cor-Incorporated' },
  { name: 'X(Twitter)', href: 'https://x.com/cor_terisuke' },
  { name: 'YouTube', href: 'https://www.youtube.com/@Cor.Incorporated' },
] as const;
