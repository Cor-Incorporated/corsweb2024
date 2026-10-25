// @vitest-environment node
/**
 * リンクテスト: 代表の氏名の用語集（scripts/i18n/glossary.mjs の FOUNDER_NAMES）と、正本（src/config/author.ts の
 * KOUSUKE_TERADA。著者ボックス・About・Person の JSON-LD が読む）を照合する。
 * - names: どれかの言語が食い違うと、両側の値を出して落ちる
 * - alternateNames: 正本に載っている別表記は、どれも用語集が扱える（ja の文字は翻訳前にトークンにし、
 *   ローマ字とハングルは訳の後に正式表記へそろえる）。新しい別表記を正本だけに足すと落ちる
 */
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SOURCE_LANG, TARGET_LANGS } from '../config.mjs';
import { FOUNDER_NAMES, normalizeFounderNames, SOURCE_FOUNDER_PATTERN } from '../glossary.mjs';

const SOURCE_OF_TRUTH = 'src/config/author.ts';
const sourceFile = path.resolve(import.meta.dirname, '../../..', SOURCE_OF_TRUTH);
const LANGS = [SOURCE_LANG, ...TARGET_LANGS];

/** 言語ごとの値を「どちらのファイルの値か」が分かるキーで並べる（食い違うと両側の値が差分に出る）。 */
const byLang = (names) => Object.fromEntries(LANGS.map((lang) => [`names.${lang}`, names?.[lang]]));

const { KOUSUKE_TERADA } = await import(sourceFile);

describe(`代表の氏名: scripts/i18n/glossary.mjs ↔ ${SOURCE_OF_TRUTH}（正本）`, () => {
  it('全言語で同じ値である（片方だけ変えると両側の値を出して落ちる）', () => {
    expect(
      byLang(FOUNDER_NAMES),
      `Received = scripts/i18n/glossary.mjs の FOUNDER_NAMES、Expected = ${SOURCE_OF_TRUTH} の KOUSUKE_TERADA.names`
    ).toEqual(byLang(KOUSUKE_TERADA.names));
  });

  const handles = new Set(KOUSUKE_TERADA.handles.map((h) => h.toLowerCase()));
  const alternates = KOUSUKE_TERADA.alternateNames.filter((n) => !handles.has(n.toLowerCase()));
  const isJapaneseScript = (name) => /[\p{Script=Han}\p{Script=Katakana}]/u.test(name);
  const isHangul = (name) => /\p{Script=Hangul}/u.test(name);

  it.each(alternates)('alternateNames の「%s」を用語集が扱える', (name) => {
    if (isJapaneseScript(name)) {
      // ja の原文に現れる表記: 全体が 1 つの氏名として一致する（翻訳前にトークンへ置き換わる）
      expect([...name.matchAll(SOURCE_FOUNDER_PATTERN)].map((m) => m[0])).toEqual([name]);
      return;
    }
    // 訳に現れる表記: 同じ文字の種類の正式表記にそろう
    const lang = isHangul(name) ? 'ko' : 'en';
    expect(normalizeFounderNames(name, lang), `${SOURCE_OF_TRUTH} の alternateNames`).toBe(
      FOUNDER_NAMES[lang]
    );
  });
});
