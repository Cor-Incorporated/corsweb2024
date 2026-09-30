// @vitest-environment node
/**
 * リンクテスト（#339 最終レビュー LOW-5）: 社名の用語集（scripts/i18n/glossary.mjs の ORGANIZATION_NAMES）と、
 * 正本（src/config/organization.ts の ORGANIZATION_NAMES。PR #335。JSON-LD・フッター・<title> が読む）を照合する。
 * 正本があれば値を読み、どれかの言語が食い違うと両側の値を出して落ちる。正本がまだ無い間（#335 のマージ前）は、
 * 理由をテスト名に出して skip する。#335 と #339 のどちらが先にマージされても、後から入った側の CI で強制される。
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SOURCE_LANG, TARGET_LANGS } from '../config.mjs';
import { ORGANIZATION_NAMES } from '../glossary.mjs';

const SOURCE_OF_TRUTH = 'src/config/organization.ts';
const sourceFile = path.resolve(import.meta.dirname, '../../..', SOURCE_OF_TRUTH);
const exists = existsSync(sourceFile);
const LANGS = [SOURCE_LANG, ...TARGET_LANGS];

/** 言語ごとの値を「どちらのファイルの値か」が分かるキーで並べる（食い違うと両側の値が差分に出る）。 */
const byLang = (names) =>
  Object.fromEntries(LANGS.map((lang) => [`ORGANIZATION_NAMES.${lang}`, names?.[lang]]));

describe(`社名: scripts/i18n/glossary.mjs ↔ ${SOURCE_OF_TRUTH}（正本）`, () => {
  it.skipIf(!exists)(
    exists
      ? '全言語で同じ値である（片方だけ変えると両側の値を出して落ちる）'
      : `全言語で同じ値である（skip: ${SOURCE_OF_TRUTH} がまだ無い。PR #335 のマージ後に強制される）`,
    async () => {
      const { ORGANIZATION_NAMES: source } = await import(sourceFile);
      expect(
        byLang(ORGANIZATION_NAMES),
        `Received = scripts/i18n/glossary.mjs、Expected = ${SOURCE_OF_TRUTH}`
      ).toEqual(byLang(source));
    }
  );
});
