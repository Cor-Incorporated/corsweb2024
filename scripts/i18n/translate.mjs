/**
 * 1 文書 × 1 言語の翻訳。LLM クライアントは引数で受け取る（依存注入）。
 *
 * 流れ: ja frontmatter の翻訳対象フィールドを JSON で翻訳 → 本文を保護して翻訳 → 検証 →
 * frontmatter を組み立て（翻訳対象以外は ja からコピー、lang と来歴を設定）→ Zod ミラーで検証。
 * どこかで検証に落ちたら例外（呼び出し側はファイルを書かない）。
 * 社名は本文・frontmatter とも保護トークン ⟦N…⟧ で送り、翻訳先言語の正式表記で戻す（glossary.mjs）。
 */
import { COLLECTIONS, META_KEYS } from './config.mjs';
import { bodyCore, composeDocument } from './frontmatter.mjs';
import { SOURCE_NAME_PATTERN } from './glossary.mjs';
import { computeSourceHash } from './hash.mjs';
import { expandTokens, protect, ProtectionError } from './markdown.mjs';
import { bodySystemInstruction, fieldsResponseSchema, fieldsSystemInstruction } from './prompt.mjs';
import { validateTranslatedFrontmatter } from './schema.mjs';
import { getPath, setPath } from './util.mjs';
import { checkBodyOutput, checkFieldsOutput } from './validate.mjs';

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
 * frontmatter の翻訳ペイロードの社名を保護トークン ⟦N…⟧ に置き換える（本文の protect() と同じ扱い）。
 * @returns {{ payload: Record<string, string | string[]>, store: Map<string, { kind: string, original: string }> }}
 */
export function protectPayloadNames(payload) {
  const store = new Map();
  const protectText = (text) => {
    if (/[⟦⟧]/.test(text)) {
      throw new ProtectionError(
        'frontmatter に予約文字 ⟦ ⟧ が含まれているため安全に保護できません'
      );
    }
    return text.replace(SOURCE_NAME_PATTERN, (original) => {
      const id = `N${store.size}`;
      store.set(id, { kind: 'org-name', original });
      return `⟦${id}⟧`;
    });
  };
  const protectedPayload = Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.map(protectText) : protectText(value),
    ])
  );
  return { payload: protectedPayload, store };
}

/** 翻訳済みペイロードの社名トークンを、翻訳先言語の正式表記に戻す。 */
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

async function translateFields({ collection, lang, data, client, attempts }) {
  const { payload, store } = protectPayloadNames(fieldsPayload(collection, data));
  if (Object.keys(payload).length === 0) return { fields: {} };
  const errors = [];
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await client.generate({
      system: fieldsSystemInstruction(lang),
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

async function translateBody({ body, lang, client, attempts }) {
  const sourceCore = bodyCore(body);
  if (sourceCore === '') return '';
  const { text: protectedText, store } = protect(sourceCore);
  const errors = [];
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await client.generate({
      system: bodySystemInstruction(lang),
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

/**
 * @param {{ collection: string, lang: string, source: { data: object, body: string },
 *           client: { model: string, generate: Function }, now: () => Date, attempts: number }} args
 * @returns {Promise<{ text: string, data: object }>}
 */
export async function translateDocument({ collection, lang, source, client, now, attempts }) {
  const hash = computeSourceHash(collection, source.data, source.body);
  const translated = await translateFields({
    collection,
    lang,
    data: source.data,
    client,
    attempts,
  });
  const body = await translateBody({ body: source.body, lang, client, attempts });
  const data = buildTranslatedData(collection, source.data, translated, lang, {
    hash,
    translatedAt: now().toISOString(),
    model: client.model,
  });
  const errors = validateTranslatedFrontmatter(collection, data, lang);
  if (errors.length > 0) throw new TranslationError('frontmatter', errors);
  return { text: composeDocument(data, body), data };
}
