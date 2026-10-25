/**
 * 社名と代表の氏名の用語集（ADR-0007: 社名は「Cor.株式会社」に統一）。
 *
 * 正本:
 * - 社名: src/config/organization.ts の ORGANIZATION_NAMES（PR #335。JSON-LD・フッター・<title> が読む）。
 *   照合は __tests__/organization-link.test.mjs
 * - 代表の氏名: src/config/author.ts の KOUSUKE_TERADA.names（著者ボックス・About・Person の JSON-LD が読む）。
 *   照合は __tests__/founder-link.test.mjs（names と alternateNames。PR #405 の CI の訳で、en / es が
 *   「Kosuke Terada」、ko が「테라다 코스케」になったため足した）
 * どちらも片方だけ変えると両側の値を出して落ちる。
 *
 * 名前はプロンプト頼みにせず決定的に扱う（NAME_TOKENS の表で、社名と氏名を同じ手順で扱う）:
 *   1. 翻訳前に、ja 側の名前（表記ゆれを含む）を保護トークン（社名 ⟦N…⟧ / 氏名 ⟦F…⟧）に置き換えてモデルに渡さない
 *      （本文は markdown.mjs の protect()、frontmatter は translate.mjs の protectPayloadNames()）
 *   2. 翻訳後に、トークンを翻訳先言語の正式表記へ戻す（restore / expandTokens に lang を渡す）
 *   3. モデルが自分で書いた表記ゆれ（「Cor.」を「Cor. Inc.」に広げた、氏名を旧表記で書いた等）も正式表記にそろえる
 *      （normalizeNames）
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

// URL と保護トークン（⟦P0⟧ ⟦N0⟧ ⟦F0⟧ など、接頭辞の種類を問わない）の中は書き換えない。
const UNTOUCHABLE_RE = /(https?:\/\/[^\s"'<>()]+|⟦[A-Z]\d+⟧)/;

/** URL と保護トークンを除いた部分だけに replace を適用する。 */
const outsideUntouchable = (text, replace) =>
  text
    .split(UNTOUCHABLE_RE)
    .map((part, i) => (i % 2 === 1 ? part : replace(part)))
    .join('');

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
  return outsideUntouchable(text, (part) => {
    const replaced = part.replace(OUTPUT_NAME_PATTERN, name);
    return doubled ? replaced.replace(doubled, name) : replaced;
  });
}

// ---- 代表の氏名 ------------------------------------------------------------------

export const FOUNDER_NAMES = Object.freeze({
  ja: '寺田 康佑',
  zh: '寺田 康佑',
  ko: '데라다 코스케',
  en: 'Kousuke Terada',
  es: 'Kousuke Terada',
});

export function founderName(lang) {
  const name = FOUNDER_NAMES[lang];
  if (!name) throw new Error(`代表の氏名の表記が未定義の言語です: ${lang}`);
  return name;
}

/**
 * ja 側に現れる代表の氏名（漢字とカタカナ。間の空白・中黒は 1 つまで）。名字だけ・名前だけは、別の人
 * （社員の寺田など）の場合があるので扱わない。ローマ字はモデルにそのまま渡し、訳の後で normalizeFounderNames がそろえる。
 */
export const SOURCE_FOUNDER_PATTERN = /寺田[ 　]?康佑|テラダ[ 　・]?コウスケ/g;

// 訳に現れうる表記ゆれ。名前は Kousuke / Kosuke / Kōsuke / Kôsuke / Kohsuke、並びは「名 姓」「姓 名」「姓, 名」
const GIVEN_LATIN = String.raw`K(?:ou|oh|o|ō|ô)suke`;
const LATIN_FOUNDER_RE = new RegExp(
  String.raw`(?<![A-Za-z])(?:${GIVEN_LATIN}[  ]Terada|Terada,?[  ]${GIVEN_LATIN})(?![A-Za-z])`,
  'g'
);
// 데라다 / 테라다、코스케 / 고스케（間の空白は無くてもよい）。韓国語は名前の直後に助詞が続くので後ろは区切らない
const HANGUL_FOUNDER_RE = /[데테]라다 ?[코고]스케/g;
const KANJI_FOUNDER_RE = /寺田[ 　]?康佑/g;
const isLatin = (text) => /^[A-Za-z]/.test(text);

/**
 * モデルの出力にある代表の氏名の表記ゆれを、同じ文字の種類の正式表記にそろえる（URL・トークンの中は触らない）。
 * 文字の種類はまたがない: ローマ字はローマ字（en / es はその言語の表記、ko / zh の訳の中では en の表記）、
 * ハングルは ko、漢字は zh の正式表記にする。「寺田 康佑（Kousuke Terada）」のような併記を壊さないため。
 */
export function normalizeFounderNames(text, lang) {
  const own = founderName(lang);
  const latin = isLatin(own) ? own : founderName('en');
  return outsideUntouchable(text, (part) =>
    part
      .replace(LATIN_FOUNDER_RE, latin)
      .replace(HANGUL_FOUNDER_RE, founderName('ko'))
      .replace(KANJI_FOUNDER_RE, founderName('zh'))
  );
}

/** モデルの出力にある社名と代表の氏名の表記ゆれを、まとめて正式表記にそろえる（validate.mjs が使う）。 */
export function normalizeNames(text, lang) {
  return normalizeFounderNames(normalizeOrganizationNames(text, lang), lang);
}

/**
 * 保護トークンにする名前の表。kind は store に記録する種類、prefix はトークンの接頭辞（⟦N0⟧ / ⟦F0⟧）、
 * pattern は ja 側の表記、official は翻訳先言語の正式表記。markdown.mjs（本文）と translate.mjs（frontmatter）が
 * この表を同じ順で適用し、expandTokens が official で戻す。
 */
export const NAME_TOKENS = Object.freeze([
  { kind: 'org-name', prefix: 'N', pattern: SOURCE_NAME_PATTERN, official: organizationName },
  { kind: 'founder-name', prefix: 'F', pattern: SOURCE_FOUNDER_PATTERN, official: founderName },
]);

/** store の kind が名前なら、翻訳先言語の正式表記を返す。名前でなければ undefined。 */
export function officialNameFor(kind, lang) {
  return NAME_TOKENS.find((entry) => entry.kind === kind)?.official(lang);
}
