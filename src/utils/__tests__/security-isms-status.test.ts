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

// 有効期間の文と、有効の条件の文（各言語）。ja は有効期間中の維持審査にて登録の継続が認められる限り有効
const VALIDITY_PERIOD: Record<Locale, RegExp> = {
  ja: /有効期間は2026年11月7日から2029年11月7日までです。/,
  en: /valid from November 7, 2026 to November 7, 2029\./,
  zh: /有效期为2026年11月7日至2029年11月7日。/,
  ko: /유효 기간은 2026년 11월 7일부터 2029년 11월 7일까지입니다\./,
  es: /válida del 7 de noviembre de 2026 al 7 de noviembre de 2029\./,
};
const VALIDITY_CONDITION: Record<Locale, RegExp> = {
  ja: /有効期間中の維持審査にて登録の継続が認められる限り有効です。/,
  en: /remains valid as long as continued registration is confirmed at the surveillance audits during the validity period\./,
  zh: /只要在有效期内的监督审核中确认继续注册，认证即保持有效。/,
  ko: /유효 기간 중의 사후심사에서 등록의 계속이 인정되는 한 유효합니다\./,
  es: /Se mantiene vigente mientras la continuidad del registro se confirme en las auditorías de seguimiento realizadas durante el período de vigencia\./,
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

  // 有効期間は、有効の条件つきで書く。期限（2029年11月7日）まで無条件に有効とは書かない（ほかのページと同じ）
  it.each(LOCALES)('%s: 状態の欄と体制の説明で、有効期間の文の直後に、有効の条件がある', (locale) => {
    const texts = securityIsmsTexts(locale);
    for (const key of ['security.status.isms', 'security.governanceDescription']) {
      const text = texts[key];
      const periodAt = text.search(VALIDITY_PERIOD[locale]);
      const conditionAt = text.search(VALIDITY_CONDITION[locale]);
      expect({ locale, key, period: periodAt >= 0, condition: conditionAt >= 0, text }).toMatchObject({ period: true, condition: true });
      // 条件は、有効期間の文より後ろにある
      expect(conditionAt, `${locale} ${key}`).toBeGreaterThan(periodAt);
    }
  });
});
