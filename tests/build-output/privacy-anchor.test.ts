// ビルド済み dist の、プライバシーポリシーの AI 受付の節の id の検査（設定: vitest.dist.config.ts。`npm run build` の後に `npm run test:dist`）。
// Cloudia の画面のリンクは /privacy/#ai-reception（en は /en/privacy/#ai-reception）へ飛ぶ。
// 見るもの: 5 言語の /privacy/ に id="ai-reception" の section が 1 つだけ在り、その見出しが AI 受付の節の題。
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import en from '../../src/i18n/locales/en.json';
import es from '../../src/i18n/locales/es.json';
import ja from '../../src/i18n/locales/ja.json';
import ko from '../../src/i18n/locales/ko.json';
import zh from '../../src/i18n/locales/zh.json';

const DIST_DIR = path.resolve(process.env.CONTACT_GUARD_DIST_DIR || 'dist');
const AI_RECEPTION_ID = 'ai-reception';

type Section = { title: string; id?: string };
const PAGES: Array<{ locale: string; file: string; sections: Section[] }> = [
  { locale: 'ja', file: 'privacy/index.html', sections: ja.privacy.sections },
  { locale: 'en', file: 'en/privacy/index.html', sections: en.privacy.sections },
  { locale: 'es', file: 'es/privacy/index.html', sections: es.privacy.sections },
  { locale: 'ko', file: 'ko/privacy/index.html', sections: ko.privacy.sections },
  { locale: 'zh', file: 'zh/privacy/index.html', sections: zh.privacy.sections },
];

function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

describe('privacy policy AI reception anchor (dist)', () => {
  for (const page of PAGES) {
    it(`${page.locale}: has one section with id="${AI_RECEPTION_ID}" headed by the AI reception title`, () => {
      const file = path.join(DIST_DIR, page.file);
      expect(existsSync(file), file).toBe(true);
      const html = readFileSync(file, 'utf8');

      // 圧縮した HTML は属性の引用符を省く（id=ai-reception）。引用符の有無のどちらも数える。
      const opens = html.match(new RegExp(`<section[^>]*\\bid=(?:"${AI_RECEPTION_ID}"|'${AI_RECEPTION_ID}'|${AI_RECEPTION_ID}(?=[\\s>]))[^>]*>`, 'g')) ?? [];
      expect(opens, page.locale).toHaveLength(1);

      const title = page.sections.find((section) => section.id === AI_RECEPTION_ID)?.title;
      expect(title, page.locale).toBeTruthy();
      const start = html.indexOf(opens[0]);
      const nextHeading = html.slice(start).match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
      // 題には文と塊の印（span）が付く（docs/design/layout-rules.md の R1）。印を外した文字で比べる。
      const headingText = (nextHeading?.[1] ?? '').replace(/<[^>]*>/g, '');
      expect(headingText, page.locale).toBe(escapeHtml(title as string));
    });
  }
});
