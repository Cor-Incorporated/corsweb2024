// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseDocument } from '../frontmatter.mjs';
import { computeSourceHash } from '../hash.mjs';
import { classify } from '../plan.mjs';
import {
  buildTranslatedData,
  fieldsPayload,
  translateDocument,
  TranslationError,
} from '../translate.mjs';
import { createMockClient, dropFirstBlockToken, FIXED_NOW, JA_BLOG, JA_NEWS } from './helpers.mjs';

const blog = parseDocument(JA_BLOG);
const news = parseDocument(JA_NEWS);
const run = (client, { source = blog, collection = 'blog', lang = 'en' } = {}) =>
  translateDocument({ collection, lang, source, client, now: FIXED_NOW, attempts: 2 });

describe('translateDocument with a mocked Gemini client', () => {
  it('translates fields + body, copies the rest from ja and records provenance', async () => {
    const client = createMockClient();
    const { text } = await run(client);
    const out = parseDocument(text);
    expect(out.data).toMatchObject({
      title: 'lorem',
      description: 'lorem https://example.com/docs lorem',
      category: 'lab',
      author: 'Terisuke',
      featured: true,
      tags: ['テスト', 'AI'], // blog は tags を訳さない（既存慣習）
      image: { url: '/images/blog/テスト.avif', alt: 'lorem' },
      lang: 'en',
      translationSourceHash: computeSourceHash('blog', blog.data, blog.body),
      translatedAt: '2026-09-27T00:00:00.000Z',
      translationModel: 'mock-model',
    });
    expect(out.data.pubDate).toEqual(new Date('2025-01-21'));
    expect(text).toMatch(/^---\ntitle: "lorem"\n/);
    expect(text).toContain('pubDate: 2025-01-21\n');
    expect(out.body).toContain('```js\n// コメントは訳さない\n');
    expect(classify({ collection: 'blog', lang: 'en', source: blog, target: out }).status).toBe(
      'ok'
    );
    expect(client.calls).toHaveLength(2); // frontmatter 1 回 + 本文 1 回
  });

  it('sends only protected text to the model (no code, no URLs)', async () => {
    const client = createMockClient();
    await run(client);
    const bodyRequest = client.calls.find((c) => !c.jsonSchema);
    expect(bodyRequest.prompt).not.toMatch(/https?:\/\/|console\.log|```/);
    expect(bodyRequest.system).toMatch(/English/);
  });

  it('sends image / link titles to the model but not their paths (Codex: titles are translated)', async () => {
    const client = createMockClient();
    const { text } = await run(client);
    const bodyRequest = client.calls.find((c) => !c.jsonSchema);
    expect(bodyRequest.prompt).toMatch(/!\[図の説明\]\(⟦P\d+⟧ "タイトル"\)/);
    expect(bodyRequest.prompt).not.toContain('図1.avif');
    expect(text).toContain('![lorem](/images/blog/図1.avif "lorem")');
  });

  it('F2: a translation that drops one code fence is rejected after the retry and nothing is returned', async () => {
    const client = createMockClient({ mutateBody: dropFirstBlockToken });
    const error = await run(client).catch((e) => e);
    expect(error).toBeInstanceOf(TranslationError);
    expect(error.part).toBe('本文');
    expect(error.errors.join('\n')).toMatch(/#1 プレースホルダ ⟦B\d+⟧ が欠落しています/);
    expect(error.errors.join('\n')).toMatch(/#2 プレースホルダ ⟦B\d+⟧ が欠落しています/);
    expect(client.calls.filter((c) => !c.jsonSchema)).toHaveLength(2);
  });

  it('retries a bad generation once and accepts the second, valid one', async () => {
    let bodyCalls = 0;
    const client = createMockClient({
      mutateBody: (t) => {
        bodyCalls += 1;
        return bodyCalls === 1 ? dropFirstBlockToken(t) : t;
      },
    });
    const { text } = await run(client);
    expect(parseDocument(text).data.lang).toBe('en');
    expect(bodyCalls).toBe(2);
  });

  it('rejects field translations that change the tag count (news translates tags)', async () => {
    const client = createMockClient({ mutateFields: (o) => ({ ...o, tags: o.tags.slice(1) }) });
    const error = await run(client, { source: news, collection: 'news' }).catch((e) => e);
    expect(error).toBeInstanceOf(TranslationError);
    expect(error.part).toBe('frontmatter');
    expect(error.errors.join('\n')).toMatch(/tags: 要素数が一致しません/);
  });

  it('translates news tags and source, and skips the body call when the body is empty', async () => {
    const client = createMockClient();
    const { data } = await run(client, { source: news, collection: 'news', lang: 'ko' });
    expect(data).toMatchObject({
      tags: ['lorem', 'lorem'],
      source: 'Cor.주식회사', // 社名はモデルに渡さず、各言語の正式表記で戻す（glossary.mjs）
      lang: 'ko',
      category: 'info',
    });
    expect(client.calls).toHaveLength(1);
  });
});

describe('frontmatter building blocks', () => {
  it('fieldsPayload sends only translatable, non-empty strings (dots become underscores)', () => {
    expect(fieldsPayload('blog', blog.data)).toEqual({
      title: 'テスト記事：翻訳パイプライン',
      description: '説明文です。詳細は https://example.com/docs を参照',
      image_alt: 'テスト画像',
    });
    expect(fieldsPayload('news', news.data)).toEqual({
      title: 'ニュースページを追加しました',
      description: 'お知らせをまとめました。',
      source: 'Cor.株式会社',
      tags: ['お知らせ', 'サイト更新'],
    });
  });

  it('buildTranslatedData keeps ja key order, sets lang in place and does not mutate the source', () => {
    const before = structuredClone(blog.data);
    const data = buildTranslatedData('blog', blog.data, { fields: { title: 'T' } }, 'zh', {
      hash: 'a'.repeat(64),
      translatedAt: '2026-09-27T00:00:00.000Z',
      model: 'm',
    });
    expect(Object.keys(data)).toEqual([
      ...Object.keys(blog.data),
      'translationSourceHash',
      'translatedAt',
      'translationModel',
    ]);
    expect(data.lang).toBe('zh');
    expect(blog.data).toEqual(before);
  });
});
