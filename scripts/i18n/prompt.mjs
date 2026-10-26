/**
 * Gemini に渡すシステム指示と、frontmatter 翻訳用の JSON スキーマ。
 */
import { KEEP_AS_IS, LANGUAGE_NAMES } from './config.mjs';
import { founderName, organizationName } from './glossary.mjs';

// 社名はトークン ⟦N…⟧、代表の氏名は ⟦F…⟧ で送り、翻訳後に正式表記へ置き換える（glossary.mjs）。
// モデルには文法（冠詞・助詞）のために名前を伝える。
function glossaryLines(lang) {
  const name = organizationName(lang);
  const founder = founderName(lang);
  return [
    `- Keep these names exactly as written (do not translate or transliterate): ${KEEP_AS_IS.join(
      ', '
    )}.`,
    `- Tokens like ⟦N0⟧ stand for the company name, which will be inserted as "${name}". Output the token`,
    `  itself, never the name; choose articles and particles as if the token were "${name}".`,
    `- If you need to write the company's full name anywhere else, write exactly "${name}".`,
    `- Tokens like ⟦F0⟧ stand for the founder's name, which will be inserted as "${founder}". Output the token`,
    `  itself, never the name; choose articles and particles as if the token were "${founder}".`,
    `- If you need to write the founder's full name anywhere else, write exactly "${founder}".`,
  ].join('\n');
}

// Grift の記事では、Grift の用語もトークン ⟦G…⟧ で送る（grift-terms.mjs）。記事ごとに、どのトークンがどの語に
// なるかを伝える（文法のため。韓国語の助詞は語の最後の音で変わる）。用語の無い記事のプロンプトは変えない。
function griftTermLines(terms) {
  if (terms.length === 0) return [];
  return [
    "- Tokens like ⟦G0⟧ stand for terms of Grift, the company's open-source CLI. Output each token itself",
    '  exactly once, never the term; choose articles and particles as if the token were the term it will be',
    '  replaced with:',
    ...terms.map(({ tokens, form }) => `  ${tokens.join(' ')} → "${form}"`),
  ];
}

function commonRules(lang, terms = []) {
  const language = LANGUAGE_NAMES[lang];
  return [
    'You are a professional localizer for the corporate website of Cor.Inc. (Cor.株式会社),',
    `a Japanese company that helps businesses adopt AI and builds software. Translate from Japanese into ${language}.`,
    `Write natural, accurate ${language} for business readers. Keep the author's voice and level of formality.`,
    'Do not add, remove, summarize or explain content. Translate every piece of Japanese text.',
    // ADR-0007（対外表現ガードレール）: 訳で主張を強めない（例: 「ISMS 取得に向け整備中」→ "ISMS certified" は禁止）。
    'Never strengthen or weaken claims: certifications, guarantees, results, numbers and dates must keep exactly',
    'the same degree of certainty as the Japanese (e.g. "preparing for ISMS certification" must not become "ISMS certified").',
    'Glossary:',
    glossaryLines(lang),
    ...griftTermLines(terms),
  ].join('\n');
}

/**
 * 本文（保護済み Markdown）用のシステム指示。
 * @param {{ tokens: string[], form: string }[]} [terms] この記事の Grift の用語のトークン（grift-terms.mjs の griftTermTokens）
 */
export function bodySystemInstruction(lang, terms = []) {
  return `${commonRules(lang, terms)}

The user message is a Markdown document. Return ONLY the translated Markdown document:
no preface, no notes, and do not wrap the output in a code fence.

Placeholders:
- Tokens like ⟦P12⟧, ⟦B3⟧, ⟦N0⟧ and ⟦F0⟧ stand for content that must not change (code, URLs, math, HTML,
  image paths, the company name, the founder's name).
- Copy every token exactly once, character for character. Never translate, split, space out, reorder the
  characters of, duplicate or drop a token.
- A line that contains only a ⟦B…⟧ token (optionally after ">" quote markers) must stay on its own line.

Markdown structure must stay identical:
- the same headings with the same number of "#", the same list markers and numbering, the same table rows
  and columns, the same blockquote markers (">"), emphasis markers and blank lines between blocks;
- translate headings, list items, table cells, link texts ([text]), image alt texts (![alt]) and link / image
  titles (the quoted text after a placeholder, e.g. (⟦P3⟧ "title")), keeping the same straight quote characters;
- do not create new headings, code fences, links, images or tables.`;
}

/** frontmatter フィールド（JSON）用のシステム指示。terms は bodySystemInstruction と同じ。 */
export function fieldsSystemInstruction(lang, terms = []) {
  return `${commonRules(lang, terms)}

The user message is a JSON object whose values are page metadata (title, description, tags, ...).
Return a JSON object with exactly the same keys. Translate every value; never translate or rename keys.
If a value is an array, return an array with the same number of items in the same order.
Keep each value on a single line and keep URLs unchanged.`;
}

/** レスポンス用 JSON Schema（responseJsonSchema）。 */
export function fieldsResponseSchema(payload) {
  const properties = Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [
      key,
      Array.isArray(value)
        ? {
            type: 'array',
            items: { type: 'string' },
            minItems: value.length,
            maxItems: value.length,
          }
        : { type: 'string' },
    ])
  );
  return {
    type: 'object',
    properties,
    required: Object.keys(payload),
    additionalProperties: false,
  };
}
