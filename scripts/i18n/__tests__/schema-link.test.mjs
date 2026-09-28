// @vitest-environment node
/**
 * リンクテスト: scripts/i18n/schema.mjs（ミラー）と src/content/config.ts（正本）を機械照合する。
 * どちらか片方だけを変えると、両方の構造を並べた diff で落ちる。
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('astro:content', async () => {
  const { z } = await import('astro/zod');
  return { z, defineCollection: (definition) => definition };
});

const { collections } = await import('../../../src/content/config.ts');
const { CONTENT_SCHEMAS } = await import('../schema.mjs');
const { parseDocument } = await import('../frontmatter.mjs');
const { z } = await import('astro/zod');

/** Zod スキーマを比較可能な素のオブジェクトに落とす（型名・任意/必須・既定値・enum・チェック）。 */
function describeSchema(schema) {
  const def = schema._def;
  switch (def.typeName) {
    case 'ZodOptional':
      return { optional: describeSchema(def.innerType) };
    case 'ZodDefault':
      return { default: def.defaultValue(), of: describeSchema(def.innerType) };
    case 'ZodObject':
      return {
        object: Object.fromEntries(
          Object.entries(schema.shape).map(([k, v]) => [k, describeSchema(v)])
        ),
      };
    case 'ZodArray':
      return { array: describeSchema(def.type) };
    case 'ZodEnum':
      return { enum: [...def.values] };
    case 'ZodString':
      return { string: def.checks.map((c) => c.kind) };
    case 'ZodDate':
      return { date: { coerce: Boolean(def.coerce) } };
    default:
      return { type: def.typeName };
  }
}

// コレクションのスキーマは、関数（({ image }) => z.object(...)）でも Zod スキーマそのものでもよい
// （develop の #342 で blog は src/config/blog-schema.ts の blogFrontmatterSchema を直接渡す形になった）
const resolveSchema = (schema) =>
  typeof schema === 'function' ? schema({ image: () => z.string() }) : schema;

const canonical = {
  blog: resolveSchema(collections.blog.schema),
  cases: resolveSchema(collections.cases.schema),
  news: resolveSchema(collections.news.schema),
};

const contentRoot = path.resolve(import.meta.dirname, '../../../src/content');
const contentFiles = (collection) =>
  ['ja', 'en', 'zh', 'ko', 'es'].flatMap((lang) =>
    readdirSync(path.join(contentRoot, collection, lang)).map((f) =>
      path.join(contentRoot, collection, lang, f)
    )
  );

describe.each(['blog', 'cases', 'news'])(
  'schema mirror ↔ src/content/config.ts (%s)',
  (collection) => {
    it('has the same structure (keys, optional/required, defaults, enums, checks)', () => {
      expect(describeSchema(CONTENT_SCHEMAS[collection])).toEqual(
        describeSchema(canonical[collection])
      );
    });

    it('gives the same verdict on every existing content file', () => {
      for (const file of contentFiles(collection)) {
        const { data } = parseDocument(readFileSync(file, 'utf8'));
        const expected = canonical[collection].safeParse(data).success;
        expect({ file, verdict: CONTENT_SCHEMAS[collection].safeParse(data).success }).toEqual({
          file,
          verdict: expected,
        });
      }
    });

    it('gives the same verdict on broken inputs', () => {
      const [first] = contentFiles(collection).filter((f) => f.includes('/ja/'));
      const { data } = parseDocument(readFileSync(first, 'utf8'));
      const { title: _title, ...withoutTitle } = data;
      const mutations = [
        withoutTitle,
        { ...data, category: 'not-a-category' },
        { ...data, lang: 'fr' },
        { ...data, tags: 'not-an-array' },
        { ...data, featured: 'yes' },
      ];
      for (const input of mutations) {
        expect(CONTENT_SCHEMAS[collection].safeParse(input).success).toBe(
          canonical[collection].safeParse(input).success
        );
        expect(CONTENT_SCHEMAS[collection].safeParse(input).success).toBe(false);
      }
    });
  }
);
