// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  bodySystemInstruction,
  fieldsResponseSchema,
  fieldsSystemInstruction,
} from '../prompt.mjs';

describe('system instructions', () => {
  it.each([
    ['en', 'English', 'Cor.Inc.'],
    ['zh', 'Simplified Chinese', 'Cor.株式会社'],
    ['ko', 'Korean', 'Cor.주식회사'],
    ['es', 'Spanish', 'Cor.Inc.'],
  ])(
    '%s: names the language, the company-name token rule and the placeholder / claim rules',
    (lang, name, official) => {
      const body = bodySystemInstruction(lang);
      expect(body).toContain(`Translate from Japanese into ${name}`);
      // 社名はトークン ⟦N…⟧ で送る。モデルには文法のために正式表記を伝え、トークンのまま返させる
      expect(body).toContain(`stand for the company name, which will be inserted as "${official}"`);
      expect(body).toContain(`write exactly "${official}"`);
      expect(body).not.toContain('Cor. Inc.');
      expect(fieldsSystemInstruction(lang)).toContain(`"${official}"`);
      expect(body).toContain('Copy every token exactly once');
      // ADR-0007: 訳で主張（認証・保証・数値）を強めない
      expect(body).toContain('Never strengthen or weaken claims');
      expect(fieldsSystemInstruction(lang)).toContain('exactly the same keys');
    }
  );
});

describe('system instructions — 代表の氏名', () => {
  it.each([
    ['en', 'Kousuke Terada'],
    ['zh', '寺田 康佑'],
    ['ko', '데라다 코스케'],
    ['es', 'Kousuke Terada'],
  ])('%s: 氏名のトークン ⟦F…⟧ の決まりと正式表記「%s」を伝える', (lang, official) => {
    const body = bodySystemInstruction(lang);
    expect(body).toContain(`stand for the founder's name, which will be inserted as "${official}"`);
    expect(body).toContain(
      `write the founder's full name anywhere else, write exactly "${official}"`
    );
    expect(body).toMatch(/⟦N0⟧ and ⟦F0⟧ stand for content that must not change/);
    expect(body).not.toContain('Kosuke Terada');
    expect(fieldsSystemInstruction(lang)).toContain(`"${official}"`);
  });
});

describe('fieldsResponseSchema', () => {
  it('pins keys and the tag count', () => {
    expect(fieldsResponseSchema({ title: 'タ', tags: ['a', 'b'] })).toEqual({
      type: 'object',
      properties: {
        title: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 2 },
      },
      required: ['title', 'tags'],
      additionalProperties: false,
    });
  });
});
