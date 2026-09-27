/**
 * Gemini に渡すシステム指示と、frontmatter 翻訳用の JSON スキーマ。
 */
import { GLOSSARY, KEEP_AS_IS, LANGUAGE_NAMES } from './config.mjs';

function glossaryLines(lang) {
  const terms = GLOSSARY.map((entry) => `- "${entry.ja}" → "${entry[lang]}"`);
  return [
    `- Keep these names exactly as written (do not translate or transliterate): ${KEEP_AS_IS.join(
      ', '
    )}.`,
    ...terms,
  ].join('\n');
}

const COMMON_RULES = (
  lang
) => `You are a professional localizer for the corporate website of Cor. Inc. (Cor.株式会社),
a Japanese company that helps businesses adopt AI and builds software. Translate from Japanese into ${
  LANGUAGE_NAMES[lang]
}.
Write natural, accurate ${
  LANGUAGE_NAMES[lang]
} for business readers. Keep the author's voice and level of formality.
Do not add, remove, summarize or explain content. Translate every piece of Japanese text.
Glossary:
${glossaryLines(lang)}`;

/** 本文（保護済み Markdown）用のシステム指示。 */
export function bodySystemInstruction(lang) {
  return `${COMMON_RULES(lang)}

The user message is a Markdown document. Return ONLY the translated Markdown document:
no preface, no notes, and do not wrap the output in a code fence.

Placeholders:
- Tokens like ⟦P12⟧ and ⟦B3⟧ stand for content that must not change (code, URLs, math, HTML, image paths).
- Copy every token exactly once, character for character. Never translate, split, space out, reorder the
  characters of, duplicate or drop a token.
- A line that contains only a ⟦B…⟧ token (optionally after ">" quote markers) must stay on its own line.

Markdown structure must stay identical:
- the same headings with the same number of "#", the same list markers and numbering, the same table rows
  and columns, the same blockquote markers (">"), emphasis markers and blank lines between blocks;
- translate headings, list items, table cells, link texts ([text]) and image alt texts (![alt]);
- do not create new headings, code fences, links, images or tables.`;
}

/** frontmatter フィールド（JSON）用のシステム指示。 */
export function fieldsSystemInstruction(lang) {
  return `${COMMON_RULES(lang)}

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
