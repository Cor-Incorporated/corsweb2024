// プライバシーポリシーの AI 受付の節の id（#ai-reception）。Cloudia の画面のリンクが、この id へ飛ぶ。
// id は locale の JSON（privacy.sections の 1 つ）に置き、5 言語の privacy.astro が <section id> に描く。
// 見るもの: 5 言語とも、id を持つ節は AI 受付の節の 1 つだけで、同じ位置・同じ値。
// 描いた後の HTML は tests/build-output/privacy-anchor.test.ts が見る。
import { describe, expect, it } from 'vitest';
import en from '../../i18n/locales/en.json';
import es from '../../i18n/locales/es.json';
import ja from '../../i18n/locales/ja.json';
import ko from '../../i18n/locales/ko.json';
import zh from '../../i18n/locales/zh.json';

const AI_RECEPTION_ID = 'ai-reception';

type Section = { title: string; id?: string };
const LOCALES: Record<string, { privacy: { sections: Section[] } }> = { ja, en, es, ko, zh };

function sectionIds(locale: string): Array<{ index: number; id: string; title: string }> {
  return LOCALES[locale].privacy.sections
    .map((section, index) => ({ index, id: section.id, title: section.title }))
    .filter((entry): entry is { index: number; id: string; title: string } => typeof entry.id === 'string');
}

describe('privacy policy section ids', () => {
  it('gives exactly one section the AI reception id in every language', () => {
    for (const locale of Object.keys(LOCALES)) {
      const ids = sectionIds(locale);
      expect(ids, locale).toHaveLength(1);
      expect(ids[0].id, locale).toBe(AI_RECEPTION_ID);
    }
  });

  it('puts the id on the same section in every language, the one about the AI reception', () => {
    const jaIndex = sectionIds('ja')[0].index;
    expect(sectionIds('ja')[0].title).toContain('AI受付（Cloudia）');
    for (const locale of Object.keys(LOCALES)) {
      expect(sectionIds(locale)[0].index, locale).toBe(jaIndex);
      expect(sectionIds(locale)[0].title, locale).toContain('Cloudia');
    }
  });
});
