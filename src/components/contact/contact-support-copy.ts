import type { Locale } from '../../utils/i18n';

export const CONTACT_SUPPORT_LABEL = {
  ja: 'ご契約中のお客様のお問い合わせ',
  en: 'Support for existing customers',
  zh: '现有客户支持',
  ko: '기존 고객 지원',
  es: 'Soporte para clientes actuales',
} as const satisfies Record<Locale, string>;
