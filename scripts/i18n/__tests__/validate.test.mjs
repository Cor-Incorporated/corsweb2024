// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { bodyCore, parseDocument } from '../frontmatter.mjs';
import { protect } from '../markdown.mjs';
import {
  checkBodyOutput,
  checkFieldsOutput,
  checkTokens,
  compareStructure,
  japaneseRatio,
  unwrapOuterFence,
} from '../validate.mjs';
import { dropFirstBlockToken, fakeTranslate, JA_BLOG } from './helpers.mjs';

const sourceCore = bodyCore(parseDocument(JA_BLOG).body);
const { text: protectedText, store } = protect(sourceCore);
const goodOutput = fakeTranslate(protectedText);
const check = (output, lang = 'en') =>
  checkBodyOutput({ output, finishReason: 'STOP', protectedText, store, sourceCore, lang });

/** 正しい翻訳（復元済み）からコードブロックを 1 本取り除いた Markdown。 */
function withoutFirstCodeFence(markdown) {
  return markdown.replace(/```js\n[\s\S]*?\n```\n\n/, '');
}

describe('compareStructure (parity)', () => {
  const translated = check(goodOutput).text;

  it('accepts a translation with the same structure', () => {
    expect(compareStructure(sourceCore, translated)).toEqual([]);
  });

  it('F2: a translation that lost one code fence is rejected', () => {
    const broken = withoutFirstCodeFence(translated);
    expect(broken).not.toBe(translated);
    expect(compareStructure(sourceCore, broken)).toContain(
      'コードブロックの数が一致しません（ja 2 / 翻訳 1）'
    );
  });

  it.each([
    [
      'heading removed',
      (t) => t.replace('### lorem\n', ''),
      '見出し H3 の数が一致しません（ja 1 / 翻訳 0）',
    ],
    [
      'heading level changed',
      (t) => t.replace('## lorem', '### lorem'),
      '見出し H2 の数が一致しません（ja 1 / 翻訳 0）',
    ],
    [
      'image dropped',
      (t) => t.replace(/!\[lorem\]\([^)]*\)/, ''),
      '画像の数が一致しません（ja 1 / 翻訳 0）',
    ],
    [
      'link URL changed',
      (t) => t.replace('https://cor-jp.com', 'https://evil.example'),
      'リンクの内容が一致しません',
    ],
    [
      'link card dropped',
      (t) => t.replace('https://github.com\n', ''),
      'リンクカード行の数が一致しません（ja 1 / 翻訳 0）',
    ],
    [
      'table row dropped',
      (t) => t.replace('| A | lorem |\n', ''),
      '表の行数が一致しません（ja 3 / 翻訳 2）',
    ],
    [
      'code edited',
      (t) => t.replace('console.log', 'console.error'),
      'コードブロック #1 の内容が ja と一致しません',
    ],
    [
      'math block dropped',
      (t) => t.replace(/\$\$\nE = mc\^2\n\$\$\n/, ''),
      '数式ブロックの数が一致しません（ja 1 / 翻訳 0）',
    ],
  ])('rejects: %s', (_name, mutate, message) => {
    const broken = mutate(translated);
    expect(broken).not.toBe(translated);
    expect(compareStructure(sourceCore, broken).join('\n')).toContain(message);
  });
});

describe('checkBodyOutput (tokens → restore → parity)', () => {
  it('restores a well-formed translation', () => {
    const result = check(goodOutput);
    expect(result.ok).toBe(true);
    expect(result.text).toContain('```js\n// コメントは訳さない\nconsole.log("こんにちは");\n```');
    expect(result.text).toContain('[lorem](https://cor-jp.com)');
    expect(result.text).toContain('![lorem](/images/blog/図1.avif "タイトル")');
  });

  it('F2: the model dropping one code-fence placeholder is rejected (nothing to write)', () => {
    const result = check(dropFirstBlockToken(goodOutput));
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/プレースホルダ ⟦B\d+⟧ が欠落しています/);
  });

  it.each([
    ['duplicated token', (t) => t.replace(/⟦P(\d+)⟧/, '⟦P$1⟧ ⟦P$1⟧'), /2 回出現しています/],
    [
      'mangled token',
      (t) => t.replace(/⟦P(\d+)⟧/, '⟦P $1⟧'),
      /欠落しています|壊れたプレースホルダ/,
    ],
    ['unknown token', (t) => `${t}\n⟦P999⟧`, /未知のプレースホルダ ⟦P999⟧/],
    [
      'block token merged into text',
      (t) => t.replace(/\n\n(⟦B\d+⟧)/, ' $1'),
      /単独行になっていません/,
    ],
    ['model invented a fence', (t) => `${t}\n\n\`\`\`\nextra\n\`\`\``, /コードフェンスがあります/],
    ['Japanese left untranslated', () => protectedText, /日本語が残っています/],
    ['empty output', () => '   ', /翻訳結果が空です/],
  ])('rejects: %s', (_name, mutate, pattern) => {
    const result = check(mutate(goodOutput));
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(pattern);
  });

  it('rejects a truncated generation (finishReason != STOP)', () => {
    const result = checkBodyOutput({
      output: goodOutput,
      finishReason: 'MAX_TOKENS',
      protectedText,
      store,
      sourceCore,
      lang: 'en',
    });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/finishReason=MAX_TOKENS/);
  });

  it('unwraps a whole-document ```markdown fence added by the model', () => {
    expect(check(`\`\`\`markdown\n${goodOutput}\n\`\`\``).ok).toBe(true);
    expect(unwrapOuterFence('```\nonly\n```')).toBe('only');
    expect(unwrapOuterFence('a\n```\nb\n```')).toBe('a\n```\nb\n```');
  });
});

describe('japaneseRatio', () => {
  it('counts kana + kanji for en/ko/es but only kana for zh', () => {
    expect(japaneseRatio('これは日本語です', 'en')).toBe(1);
    expect(japaneseRatio('这是中文', 'zh')).toBe(0);
    expect(japaneseRatio('これは中文', 'zh')).toBeCloseTo(3 / 5);
    expect(japaneseRatio('Plain English ⟦P0⟧', 'en')).toBe(0);
  });
});

describe('checkTokens', () => {
  it('passes when every expected token appears exactly once', () => {
    expect(checkTokens('a ⟦P0⟧\n⟦B1⟧', 'x ⟦P0⟧\n⟦B1⟧')).toEqual([]);
  });
});

describe('checkFieldsOutput', () => {
  const input = {
    title: 'タイトル',
    description: '説明 https://example.com/a',
    tags: ['お知らせ', 'AI'],
  };
  const run = (value, lang = 'en') =>
    checkFieldsOutput({
      output: typeof value === 'string' ? value : JSON.stringify(value),
      finishReason: 'STOP',
      input,
      lang,
    });

  it('accepts same keys, same tag count, URLs kept', () => {
    const result = run({
      title: ' Title ',
      description: 'Desc https://example.com/a',
      tags: ['News', 'AI'],
    });
    expect(result).toEqual({
      ok: true,
      value: { title: 'Title', description: 'Desc https://example.com/a', tags: ['News', 'AI'] },
    });
  });

  it.each([
    ['not JSON', 'Title: x', /JSON オブジェクト/],
    ['missing key', { title: 'T', tags: ['a', 'b'] }, /キーが一致しません/],
    [
      'extra key',
      { title: 'T', description: 'D https://example.com/a', tags: ['a', 'b'], lang: 'en' },
      /キーが一致しません/,
    ],
    [
      'tag count changed',
      { title: 'T', description: 'D https://example.com/a', tags: ['a'] },
      /要素数が一致しません/,
    ],
    [
      'URL changed',
      { title: 'T', description: 'D https://example.com/b', tags: ['a', 'b'] },
      /URL が変わっています/,
    ],
    [
      'empty value',
      { title: ' ', description: 'D https://example.com/a', tags: ['a', 'b'] },
      /空または文字列ではありません/,
    ],
    [
      'newline injected',
      { title: 'T\nU', description: 'D https://example.com/a', tags: ['a', 'b'] },
      /改行が混入/,
    ],
    [
      'left in Japanese',
      { title: 'タイトル', description: '説明 https://example.com/a', tags: ['お知らせ', 'AI'] },
      /日本語が残っています/,
    ],
  ])('rejects: %s', (_name, value, pattern) => {
    const result = run(value);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(pattern);
  });
});
