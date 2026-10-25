// @vitest-environment node
/**
 * 社名と代表の氏名の用語集（glossary.mjs）。値は src/config/organization.ts の ORGANIZATION_NAMES（PR #335）と、
 * src/config/author.ts の KOUSUKE_TERADA.names と同じにする。両者の機械照合は organization-link.test.mjs と
 * founder-link.test.mjs。ここでは値そのものを固定する。
 */
import { describe, expect, it } from 'vitest';
import {
  FOUNDER_NAMES,
  founderName,
  normalizeFounderNames,
  normalizeNames,
  normalizeOrganizationNames,
  organizationName,
  ORGANIZATION_NAMES,
  SOURCE_FOUNDER_PATTERN,
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

describe('FOUNDER_NAMES（代表の氏名の正式表記。正本は src/config/author.ts）', () => {
  it('ja / zh は 寺田 康佑、ko は 데라다 코스케、en / es は Kousuke Terada', () => {
    expect(FOUNDER_NAMES).toEqual({
      ja: '寺田 康佑',
      zh: '寺田 康佑',
      ko: '데라다 코스케',
      en: 'Kousuke Terada',
      es: 'Kousuke Terada',
    });
    expect(() => founderName('fr')).toThrow(/未定義/);
  });
});

describe('SOURCE_FOUNDER_PATTERN（ja 側の代表の氏名とその表記ゆれ）', () => {
  const matchOf = (text) => text.match(SOURCE_FOUNDER_PATTERN);

  it.each([
    ['代表・寺田康佑が', '寺田康佑'],
    ['寺田 康佑', '寺田 康佑'],
    ['寺田　康佑', '寺田　康佑'],
    ['テラダコウスケ', 'テラダコウスケ'],
    ['テラダ・コウスケ', 'テラダ・コウスケ'],
    ['テラダ コウスケ', 'テラダ コウスケ'],
  ])('%s → %s', (text, expected) => {
    expect(matchOf(text)).toEqual([expected]);
  });

  // 名字だけ・名前だけは別の人（社員の寺田など）の場合があるので扱わない。ローマ字はモデルに渡し、訳の後でそろえる
  it.each(['寺田', '寺田さん', '康佑', 'Kousuke Terada', 'Kosuke Terada'])(
    '氏名として扱わない: %s',
    (text) => {
      expect(matchOf(text)).toBeNull();
    }
  );
});

describe('protect / restore: 代表の氏名はトークン ⟦F…⟧ にし、翻訳先言語の正式表記で戻す', () => {
  const markdown =
    '## 寺田康佑のプロフィール\n\n[テラダコウスケの記事](https://note.com/cor_instrument) と `寺田康佑`';

  it('コード・URL の中は置き換えない。社名と同じ文に並んでもそれぞれのトークンになる', () => {
    const { text } = protect(`${markdown}\n\nCor.株式会社の代表・寺田康佑`);
    expect(text).toMatch(/^## ⟦F\d+⟧のプロフィール/);
    expect(text).toMatch(/\[⟦F\d+⟧の記事\]\(⟦P\d+⟧\)/);
    expect(text).toMatch(/⟦N\d+⟧の代表・⟦F\d+⟧$/);
    expect(text).not.toContain('康佑');
  });

  it('lang なしは完全な往復、lang ありは正式表記', () => {
    const { text, store } = protect(markdown);
    expect(restore(text, store)).toBe(markdown);
    expect(restore(text, store, 'en')).toBe(
      '## Kousuke Teradaのプロフィール\n\n[Kousuke Teradaの記事](https://note.com/cor_instrument) と `寺田康佑`'
    );
    expect(expandTokens(text, store, 'ko')).toContain('## 데라다 코스케のプロフィール');
    expect(expandTokens(text, store, 'zh')).toContain('## 寺田 康佑のプロフィール');
  });
});

describe('normalizeFounderNames（モデルが書いた表記ゆれを、同じ文字の種類の正式表記にそろえる）', () => {
  it.each([
    ['en', 'Kosuke Terada founded it.', 'Kousuke Terada founded it.'],
    ['es', 'Kōsuke Terada fundó', 'Kousuke Terada fundó'],
    ['en', 'Terada Kousuke', 'Kousuke Terada'],
    ['en', 'Terada, Kosuke', 'Kousuke Terada'],
    ['en', 'Kousuke Terada stays', 'Kousuke Terada stays'],
    ['ko', '테라다 코스케는', '데라다 코스케는'],
    ['ko', '데라다코스케', '데라다 코스케'],
    ['zh', '寺田康佑', '寺田 康佑'],
    // ローマ字はローマ字のまま正式表記へ（ko / zh の訳でも、文字の種類をまたいで書き換えない）
    ['ko', 'Kosuke Terada', 'Kousuke Terada'],
    ['zh', 'Kosuke Terada', 'Kousuke Terada'],
  ])('%s: %s', (lang, text, expected) => {
    expect(normalizeFounderNames(text, lang)).toBe(expected);
  });

  it.each(['Kosuke Tanaka', 'Terada Nagisa', 'kousuketerada', 'Kousuke'])(
    '別の人・名字だけ・ハンドルは触らない: %s',
    (text) => {
      expect(normalizeFounderNames(text, 'en')).toBe(text);
    }
  );

  it('URL とトークンの中は触らない', () => {
    expect(
      normalizeFounderNames('see https://example.com/Kosuke%20Terada and ⟦F0⟧ Kosuke Terada', 'en')
    ).toBe('see https://example.com/Kosuke%20Terada and ⟦F0⟧ Kousuke Terada');
  });
});

describe('normalizeNames（社名と代表の氏名をまとめてそろえる）', () => {
  it('両方の表記ゆれを 1 回でそろえる', () => {
    expect(normalizeNames('Kosuke Terada of Cor. Inc.', 'en')).toBe('Kousuke Terada of Cor.Inc.');
  });
});
