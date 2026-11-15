// @vitest-environment node
/**
 * 5 言語の ISMS の「有効期間」の文は、有効の条件を併記する。
 * 記録（#532 の facts.json）は、有効期間を「有効期間中の維持審査にて登録の継続が認められる限り有効」の条件つきでだけ許し、
 * 期限（2029年11月7日）まで無条件に有効とは書かない。条件の文を消す・一部の言語だけ消すと落ちる。
 */
import { describe, expect, it } from 'vitest';
import en from '../../i18n/locales/en.json';
import es from '../../i18n/locales/es.json';
import ja from '../../i18n/locales/ja.json';
import ko from '../../i18n/locales/ko.json';
import zh from '../../i18n/locales/zh.json';

type Locale = { proof: { items: { body: string }[] }; companyPage: { securityBody: string }; faq: { questions: { answer: string }[] } };

// 有効期間の文と、同じ文の中の条件（ja は facts.json の validity_condition と同じ文言）
const LOCALES: [string, Locale, RegExp, RegExp][] = [
  ['ja', ja as Locale, /有効期間は2026年11月7日から2029年11月7日までです。/, /有効期間中の維持審査にて登録の継続が認められる限り有効です。/],
  ['en', en as Locale, /valid from November 7, 2026 to November 7, 2029\./, /remains valid as long as continued registration is confirmed at the surveillance audits during the validity period\./],
  ['zh', zh as Locale, /有效期为2026年11月7日至2029年11月7日。/, /只要在有效期内的监督审核中确认继续注册，认证即保持有效。/],
  ['ko', ko as Locale, /유효 기간은 2026년 11월 7일부터 2029년 11월 7일까지입니다\./, /유효 기간 중의 사후심사에서 등록의 계속이 인정되는 한 유효합니다\./],
  ['es', es as Locale, /válida del 7 de noviembre de 2026 al 7 de noviembre de 2029\./, /Se mantiene vigente mientras la continuidad del registro se confirme en las auditorías de seguimiento/],
];

function validityStrings(locale: Locale): [string, string][] {
  return [
    ['proof.items.2.body', locale.proof.items[2].body],
    ['companyPage.securityBody', locale.companyPage.securityBody],
    ['faq.questions.5.answer', locale.faq.questions[5].answer],
  ];
}

describe('ISMS の有効期間の文は、有効の条件つきで書く（5 言語）', () => {
  for (const [lang, locale, period, condition] of LOCALES) {
    for (const [key, text] of validityStrings(locale)) {
      it(`${lang} ${key}: 期限の文の直後に、維持審査の条件がある`, () => {
        const periodAt = text.search(period);
        const conditionAt = text.search(condition);
        expect({ lang, key, periodAt: periodAt >= 0, conditionAt: conditionAt >= 0, text: text.slice(-200) }).toMatchObject({
          periodAt: true,
          conditionAt: true,
        });
        // 条件は期限の文より後ろ（条件なしで期限だけを書いた文に、別の場所の条件が足されただけ、を許さない）
        expect(conditionAt).toBeGreaterThan(periodAt);
      });
    }
  }

  it('5 言語 × 3 か所で、条件の文が同じ数だけある', () => {
    const counts = LOCALES.map(([lang, locale, , condition]) => [lang, validityStrings(locale).filter(([, t]) => condition.test(t)).length]);
    expect(counts).toEqual([['ja', 3], ['en', 3], ['zh', 3], ['ko', 3], ['es', 3]]);
  });
});
