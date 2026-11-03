// @vitest-environment node
/**
 * Grok 検索応答から文体の下書きを生成する処理のテスト（#454 B）
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  extractQuotes,
  validateQuoteLength,
  formatStyleDraft,
} from '../voice/format-style.mjs';

const fixturesDir = path.join(import.meta.dirname, 'fixtures');

describe('voice-grok-style', () => {
  describe('extractQuotes', () => {
    it('引用ブロック（> で始まる行）を抽出する', () => {
      const markdown = `# タイトル

段落1

> 引用行1
> 引用行2

段落2

> 別の引用`;

      const quotes = extractQuotes(markdown);

      expect(quotes).toHaveLength(2);
      expect(quotes[0]).toContain('引用行1');
      expect(quotes[0]).toContain('引用行2');
      expect(quotes[1]).toContain('別の引用');
    });
  });

  describe('validateQuoteLength', () => {
    it('引用が上限以下なら valid: true', () => {
      const markdown = `> 短い引用`;

      const result = validateQuoteLength(markdown);

      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('引用が上限を超えると valid: false', () => {
      const longQuote = '> ' + 'あ'.repeat(400);
      const markdown = `${longQuote}`;

      const result = validateQuoteLength(markdown);

      expect(result.valid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].length).toBeGreaterThan(300);
    });
  });

  describe('formatStyleDraft', () => {
    it('fixture から文体の下書きを生成する', () => {
      const fixturePath = path.join(fixturesDir, 'grok-style-response.json');
      const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8'));

      const draft = formatStyleDraft(fixture, 'tanaka-taro');

      // 構造が残る
      expect(draft).toContain('# 文体の特徴');
      expect(draft).toContain('## 1 文の長さ');
      expect(draft).toContain('## 参考資料');
      expect(draft).toContain('https://example.com/tanaka-article');
    });

    it('引用が上限を超えるとエラーを投げる', () => {
      const longQuote = '> ' + 'あ'.repeat(400);
      const invalidResponse = {
        choices: [
          {
            message: {
              role: 'assistant',
              content: `# タイトル\n\n${longQuote}`,
            },
          },
        ],
      };

      expect(() => formatStyleDraft(invalidResponse, 'test')).toThrow(
        /引用が上限（300 文字）を超えています/
      );
    });

    it('不正な応答でエラーを投げる', () => {
      expect(() => formatStyleDraft({}, 'test')).toThrow(/Invalid Grok response format/);
    });
  });

  describe('引用上限チェックを外すと長い引用が通る（red）', () => {
    it('長い引用を含む fixture で、検査を外すと通ってしまう', () => {
      const longQuote = '> ' + 'あ'.repeat(400);
      const content = `# タイトル\n\n${longQuote}`;

      // 検査無しだと通る
      const noValidation = content; // validateQuoteLength を呼ばない
      expect(noValidation.length).toBeGreaterThan(0);

      // 検査ありだと invalid
      const validation = validateQuoteLength(content);
      expect(validation.valid).toBe(false);
    });
  });
});
