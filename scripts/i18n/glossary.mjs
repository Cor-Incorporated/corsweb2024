/**
 * 社名の用語集（ADR-0007: 社名は「Cor.株式会社」に統一）。
 *
 * 正本は src/config/organization.ts の ORGANIZATION_NAMES（PR #335。JSON-LD・フッター・<title> が読む）。
 * 正本と同じ値であることは __tests__/organization-link.test.mjs が照合する（片方だけ変えると両側の値を出して落ちる。
 * 正本がまだ無い間は理由を出して skip し、#335 がマージされた時点から強制される）。
 *
 * 社名はプロンプト頼みにせず決定的に扱う:
 *   1. 翻訳前に、ja 側の社名（表記ゆれを含む）を保護トークン ⟦N…⟧ に置き換えてモデルに渡さない
 *      （本文は markdown.mjs の protect()、frontmatter は protectNames()）
 *   2. 翻訳後に、トークンを翻訳先言語の正式表記へ戻す（restore / expandTokens に lang を渡す）
 *   3. モデルが自分で書いた社名の表記ゆれ（「Cor.」を「Cor. Inc.」に広げた等）も正式表記にそろえる
 *   トークンの欠落・重複は既存のプレースホルダ検証（validate.mjs）で落とす。
 */

export const ORGANIZATION_NAMES = Object.freeze({
  ja: 'Cor.株式会社',
  zh: 'Cor.株式会社',
  ko: 'Cor.주식회사',
  en: 'Cor.Inc.',
  es: 'Cor.Inc.',
});

// 「Cor.」単独（ブランド名）や「Cor.Incorporated」（YouTube のハンドル）は社名の表記ゆれとして扱わない。
const COR = String.raw`(?<![A-Za-z0-9])Cor\.?`;
// 半角スペースか全角スペース（U+3000）を 1 つまで
const SPACE = String.raw`[ \u3000]?`;
// 「Cor.Inc.」「Cor. Inc.」「Cor., Inc.」「Cor Inc」。Cor と Inc の間に「.」か空白が要る（「Corinc」は対象外）
const LATIN_NAME = String.raw`(?<![A-Za-z0-9])Cor(?:\.,?[ \u3000]?|,?[ \u3000])[Ii]nc(?![A-Za-z])\.?`;

/** ja 側に現れる社名の表記（正式表記と表記ゆれ）。 */
export const SOURCE_NAME_PATTERN = new RegExp(
  String.raw`${COR}${SPACE}株式会社|株式会社${SPACE}Cor\.?(?![A-Za-z])|コー株式会社|${LATIN_NAME}`,
  'g'
);

/** モデルの出力に現れうる社名の表記（全言語の正式表記と表記ゆれ）。正式表記にそろえる対象。 */
export const OUTPUT_NAME_PATTERN = new RegExp(
  String.raw`${SOURCE_NAME_PATTERN.source}|${COR}${SPACE}주식회사`,
  'g'
);

export function organizationName(lang) {
  const name = ORGANIZATION_NAMES[lang];
  if (!name) throw new Error(`社名の表記が未定義の言語です: ${lang}`);
  return name;
}

// URL と保護トークンの中は書き換えない。
const UNTOUCHABLE_RE = /(https?:\/\/[^\s"'<>()]+|⟦[PBN]\d+⟧)/;

/**
 * 正式表記が「.」で終わる言語か（en / es の「Cor.Inc.」）。そうなら、社名の直後の文末の「.」は重ねない
 * （「Cor.Inc..」→「Cor.Inc.」。省略記号「...」の一部の「.」は残す）。#339 最終レビュー LOW-2
 */
export function endsWithPeriod(lang) {
  return organizationName(lang).endsWith('.');
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** モデルの出力にある社名の表記ゆれを、翻訳先言語の正式表記にそろえる（URL・トークンの中は触らない）。 */
export function normalizeOrganizationNames(text, lang) {
  const name = organizationName(lang);
  // そろえた結果（「Cor. Inc..」→「Cor.Inc..」）を含め、社名の後の「.」を重ねない
  const doubled = endsWithPeriod(lang) ? new RegExp(`${escapeRegExp(name)}\\.(?!\\.)`, 'g') : null;
  const normalize = (part) => {
    const replaced = part.replace(OUTPUT_NAME_PATTERN, name);
    return doubled ? replaced.replace(doubled, name) : replaced;
  };
  return text
    .split(UNTOUCHABLE_RE)
    .map((part, i) => (i % 2 === 1 ? part : normalize(part)))
    .join('');
}
