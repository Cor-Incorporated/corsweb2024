/**
 * コンテンツ自動翻訳パイプラインの設定（ADR-0019）。
 *
 * 正本は ja。`src/content/<collection>/ja/*.md` だけを人（CMS）が編集し、
 * en/zh/ko/es は翻訳 CI が生成・専有する。
 */
import { z } from 'astro/zod';

export const SOURCE_LANG = 'ja';
export const TARGET_LANGS = Object.freeze(['en', 'zh', 'ko', 'es']);
export const CONTENT_ROOT = 'src/content';

export const LANGUAGE_NAMES = Object.freeze({
  en: 'English',
  zh: 'Simplified Chinese (简体中文)',
  ko: 'Korean (한국어)',
  es: 'Spanish (Español)',
});

/**
 * コレクションごとの「翻訳する frontmatter フィールド」（ドット区切りでネスト指定）。
 * ここに無いフィールドは ja からそのままコピーする（pubDate / category / image.url / featured 等）。
 *
 * 既存翻訳ファイルの慣習に合わせている:
 * - blog: tags は訳さない。/<lang>/blog/tags/<tag> の言語切替（utils/blog-i18n.ts）が
 *   全言語で同一のタグ文字列を前提にしており、既存 en/zh/ko/es も ja のタグをそのまま持つ。
 * - cases / news: tags を訳す（既存 en/zh/ko/es がすべて訳語）。
 * - news: source を訳す（既存 en: "Cor.株式会社" → "Cor. Inc."）。
 */
export const COLLECTIONS = Object.freeze({
  blog: Object.freeze({
    fields: Object.freeze(['title', 'description', 'image.alt']),
    translateTags: false,
  }),
  cases: Object.freeze({
    fields: Object.freeze(['title', 'description', 'summary', 'securityNote', 'heroImage.alt']),
    translateTags: true,
  }),
  news: Object.freeze({
    fields: Object.freeze(['title', 'description', 'source']),
    translateTags: true,
  }),
});

export const COLLECTION_NAMES = Object.freeze(Object.keys(COLLECTIONS));

/** 翻訳先 frontmatter にだけ書く来歴フィールド。 */
export const META_KEYS = Object.freeze([
  'translationSourceHash',
  'translatedAt',
  'translationModel',
]);

/** --adopt で既存（来歴なし）翻訳を採用したときに translationModel へ入れる値。 */
export const ADOPTED_MODEL_LABEL = 'adopted-legacy';

/** ソースハッシュの入力形式を変えたら上げる（上げると全翻訳が stale になる）。 */
export const HASH_VERSION = 1;

/**
 * モデル ID の既定値。根拠: https://ai.google.dev/gemini-api/docs/models （2026-09-27 確認）
 * 「New projects should use either 3.5 Flash-Lite or 3.8 Flash」、gemini-3.8-flash は Stable。
 * 環境変数 GEMINI_MODEL で差し替える。
 */
export const DEFAULT_MODEL = 'gemini-3.8-flash';

/** 用語集（既存の翻訳ファイルで使われている訳に揃える）。 */
export const GLOSSARY = Object.freeze([
  Object.freeze({
    ja: 'Cor.株式会社',
    en: 'Cor. Inc.',
    zh: 'Cor.株式会社',
    ko: 'Cor.주식회사',
    es: 'Cor. Inc.',
  }),
]);

/** 固有名詞として訳さない語。 */
export const KEEP_AS_IS = Object.freeze(['Cor.', 'Grift', 'Cloudia', 'Terisuke']);

const intFromEnv = (min, max, fallback) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v.trim() === '' ? String(fallback) : v.trim()))
    .pipe(z.coerce.number().int().min(min).max(max));

const RuntimeEnvSchema = z.object({
  GEMINI_MODEL: z
    .string()
    .optional()
    .transform((v) => (v === undefined || v.trim() === '' ? DEFAULT_MODEL : v.trim()))
    .pipe(
      z
        .string()
        .regex(/^[a-z0-9][a-z0-9.-]{1,80}$/, 'GEMINI_MODEL は英小文字・数字・.- のモデル ID')
    ),
  // Gemini 3 系は thinkingLevel（MINIMAL/LOW/MEDIUM/HIGH）。"NONE" なら thinkingConfig を送らない。
  GEMINI_THINKING_LEVEL: z
    .string()
    .optional()
    .transform((v) => (v === undefined || v.trim() === '' ? 'LOW' : v.trim().toUpperCase()))
    .pipe(z.enum(['NONE', 'MINIMAL', 'LOW', 'MEDIUM', 'HIGH'])),
  I18N_RPM: intFromEnv(1, 600, 10),
  // 並列度は 1〜2 に制限（小さなレート上限でも 429 を連発しないため）。
  I18N_CONCURRENCY: intFromEnv(1, 2, 2),
  I18N_MAX_API_ATTEMPTS: intFromEnv(1, 10, 5),
  I18N_MAX_VALIDATION_ATTEMPTS: intFromEnv(1, 5, 2),
  I18N_REQUEST_TIMEOUT_MS: intFromEnv(10_000, 600_000, 180_000),
});

/**
 * 実行時設定を環境変数から読む（Zod で検証）。API キーはここでは読まない。
 * @param {Record<string, string | undefined>} env
 */
export function readRuntimeConfig(env) {
  const parsed = RuntimeEnvSchema.safeParse(env);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`環境変数が不正です: ${detail}`);
  }
  const e = parsed.data;
  return Object.freeze({
    model: e.GEMINI_MODEL,
    thinkingLevel: e.GEMINI_THINKING_LEVEL === 'NONE' ? '' : e.GEMINI_THINKING_LEVEL,
    rpm: e.I18N_RPM,
    concurrency: e.I18N_CONCURRENCY,
    maxApiAttempts: e.I18N_MAX_API_ATTEMPTS,
    maxValidationAttempts: e.I18N_MAX_VALIDATION_ATTEMPTS,
    requestTimeoutMs: e.I18N_REQUEST_TIMEOUT_MS,
    baseDelayMs: 2_000,
    maxDelayMs: 60_000,
  });
}
