/**
 * 1 文書 × 1 言語の翻訳。LLM クライアントは引数で受け取る（依存注入）。
 *
 * 流れ: ja frontmatter の翻訳対象フィールドを JSON で翻訳 → 本文を保護して翻訳 → 検証 →
 * frontmatter を組み立て（翻訳対象以外は ja からコピー、lang と来歴を設定）→ Zod ミラーで検証。
 * どこかで検証に落ちたら例外（呼び出し側はファイルを書かない）。
 * 社名と代表の氏名は本文・frontmatter とも保護トークン（⟦N…⟧ / ⟦F…⟧）で送り、翻訳先言語の正式表記で戻す
 * （glossary.mjs の NAME_TOKENS）。Grift の記事では、Grift の用語も保護トークン（⟦G…⟧）で送り、正式表記で戻す
 * （grift-terms.mjs。どの記事で固定するかは griftTermsIn が決め、来歴のハッシュと同じ判定を使う）。
 * ja で title と本文の最初の H1 が同じ文言なら、訳文の H1 も訳した title にそろえる（alignTitleHeading）。
 */
import { COLLECTIONS, META_KEYS } from './config.mjs';
import { bodyCore, composeDocument } from './frontmatter.mjs';
import { griftTermsIn, griftTermTokens } from './grift-terms.mjs';
import { computeSourceHash, translatableSource } from './hash.mjs';
import { expandTokens, protect, ProtectionError, segment, tokenTable } from './markdown.mjs';
import { bodySystemInstruction, fieldsResponseSchema, fieldsSystemInstruction } from './prompt.mjs';
import { validateTranslatedFrontmatter } from './schema.mjs';
import { getPath, setPath } from './util.mjs';
import { checkBodyOutput, checkFieldsOutput, compareStructure } from './validate.mjs';

export class TranslationError extends Error {
  constructor(part, errors) {
    super(`${part} の翻訳が検証に通りませんでした: ${errors.join(' / ')}`);
    this.name = 'TranslationError';
    this.part = part;
    this.errors = errors;
  }
}

const toKey = (path) => path.replace(/\./g, '_');

/** 翻訳 API に送るフィールド（空でない文字列だけ。tags は訳すコレクションのみ）。 */
export function fieldsPayload(collection, data) {
  const spec = COLLECTIONS[collection];
  const entries = spec.fields
    .map((path) => [toKey(path), getPath(data, path)])
    .filter(([, value]) => typeof value === 'string' && value.trim() !== '');
  const tags =
    spec.translateTags && Array.isArray(data.tags) && data.tags.length > 0
      ? [['tags', data.tags.map(String)]]
      : [];
  return Object.fromEntries([...entries, ...tags]);
}

/**
 * frontmatter の翻訳ペイロードの名前（社名・代表の氏名）と、Grift の記事なら Grift の用語を、保護トークンに置き換える
 * （本文の protect() と同じ表・同じ順）。
 * @param {{ griftTerms?: boolean }} [options]
 * @returns {{ payload: Record<string, string | string[]>, store: Map<string, { kind: string, original: string }> }}
 */
export function protectPayloadNames(payload, { griftTerms = false } = {}) {
  const store = new Map();
  const tokens = tokenTable(griftTerms);
  const protectText = (text) => {
    if (/[⟦⟧]/.test(text)) {
      throw new ProtectionError(
        'frontmatter に予約文字 ⟦ ⟧ が含まれているため安全に保護できません'
      );
    }
    return tokens.reduce(
      (current, { kind, prefix, pattern }) =>
        current.replace(pattern, (original) => {
          const id = `${prefix}${store.size}`;
          store.set(id, { kind, original });
          return `⟦${id}⟧`;
        }),
      text
    );
  };
  const protectedPayload = Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.map(protectText) : protectText(value),
    ])
  );
  return { payload: protectedPayload, store };
}

/** 翻訳済みペイロードの名前と用語のトークンを、翻訳先言語の正式表記に戻す。 */
export function restorePayloadNames(value, store, lang) {
  const restoreText = (text) => expandTokens(text, store, lang);
  return Object.fromEntries(
    Object.entries(value).map(([key, v]) => [
      key,
      Array.isArray(v) ? v.map(restoreText) : restoreText(v),
    ])
  );
}

/** 翻訳済みの値を { fields: { 'image.alt': ... }, tags? } に戻す。 */
export function fromPayload(collection, value) {
  const spec = COLLECTIONS[collection];
  const fields = Object.fromEntries(
    spec.fields.filter((p) => toKey(p) in value).map((p) => [p, value[toKey(p)]])
  );
  return { fields, ...(Array.isArray(value.tags) ? { tags: value.tags } : {}) };
}

/** 既存の翻訳ファイルから翻訳済みの値を取り出す（resync / adopt 用）。 */
export function extractTranslatedValues(collection, targetData) {
  const spec = COLLECTIONS[collection];
  const fields = Object.fromEntries(
    spec.fields.map((p) => [p, getPath(targetData, p)]).filter(([, v]) => v !== undefined)
  );
  return {
    fields,
    ...(spec.translateTags && Array.isArray(targetData.tags) ? { tags: targetData.tags } : {}),
  };
}

/**
 * ja の frontmatter をベースに翻訳済みの値・lang・来歴を差し込んだ新しい frontmatter。
 * @param {{ hash: string, translatedAt: string | Date, model: string }} meta
 */
export function buildTranslatedData(collection, sourceData, translated, lang, meta) {
  const spec = COLLECTIONS[collection];
  const base = Object.fromEntries(
    Object.entries(sourceData).filter(([key]) => !META_KEYS.includes(key))
  );
  const withFields = Object.entries(translated.fields).reduce(
    (acc, [path, value]) => setPath(acc, path, value),
    base
  );
  const withTags =
    spec.translateTags && translated.tags ? { ...withFields, tags: translated.tags } : withFields;
  return {
    ...withTags,
    lang,
    translationSourceHash: meta.hash,
    translatedAt: meta.translatedAt,
    translationModel: meta.model,
  };
}

async function translateFields({ collection, lang, data, client, attempts, griftTerms }) {
  const { payload, store } = protectPayloadNames(fieldsPayload(collection, data), { griftTerms });
  if (Object.keys(payload).length === 0) return { fields: {} };
  const errors = [];
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await client.generate({
      system: fieldsSystemInstruction(lang, griftTermTokens(store, lang)),
      prompt: JSON.stringify(payload, null, 2),
      jsonSchema: fieldsResponseSchema(payload),
    });
    const result = checkFieldsOutput({
      output: response.text,
      finishReason: response.finishReason,
      input: payload,
      lang,
    });
    if (result.ok) return fromPayload(collection, restorePayloadNames(result.value, store, lang));
    errors.push(...result.errors.map((e) => `#${attempt} ${e}`));
  }
  throw new TranslationError('frontmatter', errors);
}

async function translateBody({ body, lang, client, attempts, griftTerms }) {
  const sourceCore = bodyCore(body);
  if (sourceCore === '') return '';
  const { text: protectedText, store } = protect(sourceCore, { griftTerms });
  const errors = [];
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await client.generate({
      system: bodySystemInstruction(lang, griftTermTokens(store, lang)),
      prompt: protectedText,
    });
    const result = checkBodyOutput({
      output: response.text,
      finishReason: response.finishReason,
      protectedText,
      store,
      sourceCore,
      lang,
    });
    if (result.ok) return result.text;
    errors.push(...result.errors.map((e) => `#${attempt} ${e}`));
  }
  throw new TranslationError('本文', errors);
}

// ATX の H1（「# 見出し」。閉じの # と前後の空白は見出しの文言に含めない）
const H1_RE = /^( {0,3}#[ \t]+)(.*?)(?:[ \t]+#+)?[ \t]*$/;

/** 本文の最初の H1（コードブロック・HTML 等の中は除く）。無ければ null。 */
function firstH1(markdown) {
  const segments = segment(markdown);
  const index = segments.findIndex((s) => s.kind === 'text' && H1_RE.test(s.text));
  if (index === -1) return null;
  const [, prefix, text] = segments[index].text.match(H1_RE);
  return { segments, index, prefix, text: text.trim() };
}

/**
 * ja で title と本文の最初の H1 が同じ文字列なら、訳文の最初の H1 を訳した title に置き換える。
 * モデルは title（frontmatter）と H1（本文）を別々に訳すため、同じ文言でも訳が割れることがある。
 * それ以外（ja で違う文言・H1 が無い）は訳文をそのまま返す。
 */
export function alignTitleHeading({ sourceTitle, sourceBody, translatedTitle, translatedBody }) {
  if (typeof sourceTitle !== 'string' || typeof translatedTitle !== 'string') return translatedBody;
  const source = firstH1(sourceBody);
  if (!source || source.text !== sourceTitle.trim()) return translatedBody;
  const target = firstH1(translatedBody);
  if (!target) return translatedBody;
  return target.segments
    .map((s, i) => (i === target.index ? `${target.prefix}${translatedTitle.trim()}` : s.text))
    .join('\n');
}

/**
 * @param {{ collection: string, lang: string, source: { data: object, body: string },
 *           client: { model: string, generate: Function }, now: () => Date, attempts: number }} args
 * @returns {Promise<{ text: string, data: object }>}
 */
export async function translateDocument({ collection, lang, source, client, now, attempts }) {
  const hash = computeSourceHash(collection, source.data, source.body);
  // Grift の用語を固定する記事か（来歴のハッシュに用語を入れる判定と同じ）
  const griftTerms =
    griftTermsIn(source.data, translatableSource(collection, source.data, source.body)).length > 0;
  const translated = await translateFields({
    collection,
    lang,
    data: source.data,
    client,
    attempts,
    griftTerms,
  });
  const translatedBody = await translateBody({
    body: source.body,
    lang,
    client,
    attempts,
    griftTerms,
  });
  const body = alignTitleHeading({
    sourceTitle: source.data.title,
    sourceBody: bodyCore(source.body),
    translatedTitle: translated.fields.title,
    translatedBody,
  });
  if (body !== translatedBody) {
    // title にマークダウン記法（コード等）があって訳で変わった場合、H1 をそろえると構造が崩れる。書き込まない。
    const structural = compareStructure(bodyCore(source.body), body);
    if (structural.length > 0) {
      throw new TranslationError('本文', [
        `見出し（H1）をタイトルにそろえると構造が ja と一致しません（${structural.join(' / ')}）`,
      ]);
    }
  }
  const data = buildTranslatedData(collection, source.data, translated, lang, {
    hash,
    translatedAt: now().toISOString(),
    model: client.model,
  });
  const errors = validateTranslatedFrontmatter(collection, data, lang);
  if (errors.length > 0) throw new TranslationError('frontmatter', errors);
  return { text: composeDocument(data, body), data };
}
