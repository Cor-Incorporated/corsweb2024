import type { Locale } from '../utils/i18n';

/** 通常ページとブログ記事で共有する Open Graph の言語表記。 */
export const OG_LOCALES = {
  ja: 'ja_JP',
  en: 'en_US',
  zh: 'zh_CN',
  ko: 'ko_KR',
  es: 'es_ES',
} as const satisfies Record<Locale, string>;
