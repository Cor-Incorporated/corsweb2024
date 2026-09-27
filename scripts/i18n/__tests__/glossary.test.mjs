// @vitest-environment node
/**
 * 社名の用語集（glossary.mjs）。値は src/config/organization.ts の ORGANIZATION_NAMES（PR #335）と同じにする。
 * #335 のマージ後に、両者を機械照合するリンクテストを追加する（それまではこのテストで値を固定する）。
 */
import { describe, expect, it } from 'vitest';
import {
  normalizeOrganizationNames,
  organizationName,
  ORGANIZATION_NAMES,
  SOURCE_NAME_PATTERN,
} from '../glossary.mjs';
import { expandTokens, protect, restore } from '../markdown.mjs';

describe('ORGANIZATION_NAMES（ADR-0007 の正式表記）', () => {
  it('ja / zh は Cor.株式会社、ko は Cor.주식회사、en / es は Cor.Inc.', () => {
    expect(ORGANIZATION_NAMES).toEqual({
      ja: 'Cor.株式会社',
      zh: 'Cor.株式会社',
      ko: 'Cor.주식회사',
      en: 'Cor.Inc.',
      es: 'Cor.Inc.',
    });
    expect(() => organizationName('fr')).toThrow(/未定義/);
  });
});

describe('SOURCE_NAME_PATTERN（ja 側の社名とその表記ゆれ）', () => {
  const matchOf = (text) => text.match(SOURCE_NAME_PATTERN);

  it.each([
    ['Cor.株式会社', 'Cor.株式会社'],
    ['Cor. 株式会社', 'Cor. 株式会社'],
    ['Cor.　株式会社', 'Cor.　株式会社'],
    ['株式会社Cor.', '株式会社Cor.'],
    ['コー株式会社', 'コー株式会社'],
    ['Cor.incブログ', 'Cor.inc'],
    ['Cor.Inc.のミッション', 'Cor.Inc.'],
    ['Cor. Inc.', 'Cor. Inc.'],
    ['Cor., Inc.', 'Cor., Inc.'],
    ['導入はCor.株式会社へ', 'Cor.株式会社'],
  ])('%s → %s', (text, expected) => {
    expect(matchOf(text)).toEqual([expected]);
  });

  it.each([
    'Cor.',
    'Cor.のセキュリティ方針',
    'Cor.Incorporated',
    '@Cor.Incorporated',
    'Corinc',
    'SCor Inc',
  ])('社名として扱わない: %s', (text) => {
    expect(matchOf(text)).toBeNull();
  });
});

describe('protect / restore: 社名はトークン ⟦N…⟧ にし、翻訳先言語の正式表記で戻す', () => {
  const markdown =
    '## 導入はCor.株式会社へ\n\n[Cor.inc公式サイト](https://cor-jp.com) と `Cor.株式会社` と https://www.youtube.com/@Cor.Incorporated';

  it('コード・URL の中は置き換えない', () => {
    const { text } = protect(markdown);
    expect(text).toMatch(/^## 導入は⟦N\d+⟧へ/);
    expect(text).toMatch(/\[⟦N\d+⟧公式サイト\]\(⟦P\d+⟧\)/);
    expect(text).not.toContain('株式会社');
    expect(text).not.toContain('Cor.inc');
  });

  it('lang なしは完全な往復（構造の比較・テスト用）、lang ありは正式表記', () => {
    const { text, store } = protect(markdown);
    expect(restore(text, store)).toBe(markdown);
    expect(restore(text, store, 'en')).toBe(
      '## 導入はCor.Inc.へ\n\n[Cor.Inc.公式サイト](https://cor-jp.com) と `Cor.株式会社` と https://www.youtube.com/@Cor.Incorporated'
    );
    expect(expandTokens(text, store, 'ko')).toContain('## 導入はCor.주식회사へ');
  });
});

describe('normalizeOrganizationNames（モデルが書いた表記ゆれをそろえる）', () => {
  it.each([
    ['en', 'Contact Cor. Inc. today.', 'Contact Cor.Inc. today.'],
    ['es', 'Contacte a Cor., Inc.', 'Contacte a Cor.Inc.'],
    ['zh', '联系 Cor. Inc.', '联系 Cor.株式会社'],
    ['ko', 'Cor. 주식회사로 문의', 'Cor.주식회사로 문의'],
    ['en', 'Cor.Inc. stays', 'Cor.Inc. stays'],
  ])('%s: %s', (lang, text, expected) => {
    expect(normalizeOrganizationNames(text, lang)).toBe(expected);
  });

  it('URL とトークンの中は触らない', () => {
    expect(
      normalizeOrganizationNames('see https://example.com/Cor.Inc/a and ⟦N0⟧ Cor Inc', 'en')
    ).toBe('see https://example.com/Cor.Inc/a and ⟦N0⟧ Cor.Inc.');
  });
});
