// 情報セキュリティのページの ISMS の状態の表記（5 言語）。
// ISO/IEC 27001:2022 の認証は 2026年11月に取得した。このページの 4 か所（状態の欄・体制の説明・
// 取り組みの表の ISMS の行・meta の description）に、取得の前の「第2段階審査を終え、登録を見込む」
// 書き方が残ると、認証を取得したと書くほかのページと食い違う。
// 沿革（aboutPage.founderTimeline）の「10 月に第2段階審査を終えた」は過去の出来事なので対象の外。
import { describe, expect, it } from 'vitest';
import { getTranslations, type Locale } from '../i18n';

const LOCALES: Locale[] = ['ja', 'en', 'zh', 'ko', 'es'];

// 取得の前の書き方（登録の見込み・第2段階審査）を、言語ごとに表す語
const BEFORE_CERTIFICATION: Record<Locale, RegExp> = {
  ja: /見込|第2段階|審査を終え/,
  en: /expect|stage 2/i,
  zh: /预计|第二阶段/,
  ko: /예상|전망|2단계/,
  es: /prev(?:emos|isto|ista)|etapa 2/i,
};

// 認証の対象範囲（「ソフトウエアの受託開発および運用」）の各言語の表記
const SCOPE: Record<Locale, string> = {
  ja: 'ソフトウエアの受託開発および運用',
  en: 'Contract development and operation of software',
  zh: '软件的受托开发及运营',
  ko: '소프트웨어의 수탁 개발 및 운영',
  es: 'Desarrollo y operación de software por encargo',
};

function securityIsmsTexts(locale: Locale): Record<string, string> {
  const t = getTranslations(locale);
  const ismsRow = t.security.table.find((row) => row.area === 'ISMS');
  return {
    'security.status.isms': t.security.status.isms,
    'security.governanceDescription': t.security.governanceDescription,
    'security.table[ISMS].state': ismsRow?.state ?? '',
    'meta.security.description': t.meta.security.description,
  };
}

describe('情報セキュリティのページの ISMS の状態', () => {
  it.each(LOCALES)('%s: 4 か所に、認証の取得の前の書き方が残っていない', (locale) => {
    const texts = securityIsmsTexts(locale);
    const stale = Object.entries(texts)
      .filter(([, text]) => text === '' || BEFORE_CERTIFICATION[locale].test(text))
      .map(([key, text]) => `${key} = ${JSON.stringify(text)}`);
    expect(stale).toEqual([]);
  });

  it.each(LOCALES)('%s: 状態の欄と体制の説明に、認証の対象範囲がある', (locale) => {
    const texts = securityIsmsTexts(locale);
    for (const key of ['security.status.isms', 'security.governanceDescription']) {
      expect(texts[key], `${locale} ${key}`).toContain(SCOPE[locale]);
    }
  });
});
