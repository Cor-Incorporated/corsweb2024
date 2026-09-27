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
