// @vitest-environment node
/**
 * 社名の表記を決定的にする（PR #339 実 API 検証 PR #344 の指摘: 英訳で「Cor.株式会社」が「Cor. Inc.」になった）。
 * 正式表記: ja / zh「Cor.株式会社」、ko「Cor.주식회사」、en / es「Cor.Inc.」（ADR-0007。正本は
 * src/config/organization.ts の ORGANIZATION_NAMES、PR #335）。
 *
 * 事故入力: モデルが社名を「Cor. Inc.」と訳す。社名は翻訳前にトークンへ置き換えるのでモデルには届かず、
 * 翻訳後に各言語の正式表記へ戻る。モデルが自分で書いた表記ゆれ（「Cor.」を「Cor. Inc.」に広げる等）も
 * 正式表記にそろえる。
 */
import { describe, expect, it } from 'vitest';
import { parseDocument } from '../frontmatter.mjs';
import { translateDocument } from '../translate.mjs';
import { createMockClient, fakeTranslate, FIXED_NOW } from './helpers.mjs';
import { normalizeOrganizationNames } from '../glossary.mjs';

const JA_COMPANY = `---
title: "AI導入はCor.株式会社へ"
description: "Cor.株式会社がAI導入を支援します。"
pubDate: 2026-06-12
author: "Terisuke"
category: "ai"
tags: ["AI"]
lang: "ja"
---

## AI導入はCor.株式会社へ

Cor.株式会社は福岡のAI企業です。Cor.のセキュリティ方針も公開しています。

[Cor.inc公式サイト](https://cor-jp.com)

\`Cor.株式会社\` はコードなので訳さない。

https://www.youtube.com/@Cor.Incorporated
`;

const source = parseDocument(JA_COMPANY);

/** 社名を見たら「Cor. Inc.」と訳してしまうモデル（実 API で起きた事故の再現）。 */
const mistranslateName = (text) =>
  text.replaceAll('Cor.株式会社', 'Cor. Inc.').replaceAll('Cor.inc', 'Cor. Inc.');

function accidentClient({ mutateBody = (t) => t } = {}) {
  const client = createMockClient({ mutateBody });
  const generate = client.generate.bind(client);
  return {
    ...client,
    async generate(request) {
      return generate({ ...request, prompt: mistranslateName(request.prompt) });
    },
  };
}

const translate = (lang, client = accidentClient()) =>
  translateDocument({ collection: 'blog', lang, source, client, now: FIXED_NOW, attempts: 1 });

describe('社名は各言語の正式表記に決定的にそろう', () => {
  it.each([
    ['en', 'Cor.Inc.'],
    ['es', 'Cor.Inc.'],
    ['zh', 'Cor.株式会社'],
    ['ko', 'Cor.주식회사'],
  ])('%s: モデルが「Cor. Inc.」と訳す事故でも %s になる', async (lang, official) => {
    const { text, data } = await translate(lang);
    expect(text).not.toContain('Cor. Inc.');
    expect(data.title).toContain(official);
    expect(data.description).toContain(official);
    const body = parseDocument(text).body;
    expect(body).toContain(`## AIlorem${official}lorem`);
    expect(body).toContain(`[${official}lorem](https://cor-jp.com)`);
  });

  it('モデルが自分で書いた表記ゆれ（「Cor.」を「Cor. Inc.」に広げた等）も正式表記にそろえる', async () => {
    // 実際の訳文と同じく社名の前に空白がある形にする（fakeTranslate は日本語の連なりを詰めて置き換えるため）。
    // 英単語に続けて書かれた「…Cor Inc」は別の語の一部とみなし、社名として扱わない（glossary.mjs）。
    const client = accidentClient({
      mutateBody: (t) => t.replace('Cor.lorem', ' Cor. Inc. lorem'),
    });
    const en = parseDocument((await translate('en', client)).text).body;
    expect(en).toContain('Cor.Inc. lorem');
    expect(en).not.toContain('Cor. Inc.');
    const zh = parseDocument((await translate('zh', client)).text).body;
    expect(zh).toContain('Cor.株式会社 lorem');
  });

  it('社名はモデルに渡さない（トークンで送る）。「Cor.」単独・コード・URL はそのまま', async () => {
    const client = accidentClient();
    const { text } = await translate('en', client);
    const bodyRequest = client.calls.find((c) => !c.jsonSchema);
    expect(bodyRequest.prompt).not.toContain('株式会社');
    expect(bodyRequest.prompt).toMatch(/⟦N\d+⟧/);
    const fieldsRequest = client.calls.find((c) => c.jsonSchema);
    expect(fieldsRequest.prompt).not.toContain('株式会社');
    const body = parseDocument(text).body;
    expect(body).toContain('Cor.lorem'); // 「Cor.」単独（ブランド名）は社名として扱わない
    expect(body).toContain('`Cor.株式会社`'); // コードは訳さない
    expect(body).toContain('https://www.youtube.com/@Cor.Incorporated'); // URL（リンクカード）はそのまま
  });

  it('社名のトークンが消えた・増えた訳は書き込まない（既存のプレースホルダ検証で落とす）', async () => {
    const dropped = accidentClient({ mutateBody: (t) => t.replace(/⟦N\d+⟧/, '') });
    await expect(translate('en', dropped)).rejects.toThrow(
      /プレースホルダ ⟦N\d+⟧ が欠落しています/
    );
    const doubled = accidentClient({ mutateBody: (t) => t.replace(/(⟦N\d+⟧)/, '$1 $1') });
    await expect(translate('en', doubled)).rejects.toThrow(/⟦N\d+⟧ が 2 回出現しています/);
  });

  it('fakeTranslate の前提: 社名が届けば「Cor.lorem」になる（事故の再現が効いていることの確認）', () => {
    expect(fakeTranslate(mistranslateName('Cor.株式会社へ'))).toBe('Cor. Inc.lorem');
  });
});

// #339 最終レビュー LOW-2: en / es の正式表記「Cor.Inc.」は「.」で終わるので、文末の社名トークンに
// モデルが「.」を付けると「Cor.Inc..」になっていた（本文も frontmatter も同じ）
describe('文末の社名で「.」を重ねない（en / es の Cor.Inc.）', () => {
  const JA_END = `---
title: "相談窓口"
description: "ご相談はCor.株式会社へ。"
pubDate: 2026-06-12
author: "Terisuke"
category: "ai"
tags: ["AI"]
lang: "ja"
---

ご相談はCor.株式会社へ。
`;
  // 実際の訳と同じく、文末の社名トークンの後に「.」を付けて返すモデル
  const sentenceEnd = (t) => t.replace(/lorem(⟦N\d+⟧)lorem/, 'Contact $1.');
  const client = () =>
    createMockClient({
      mutateBody: sentenceEnd,
      mutateFields: (o) => ({ ...o, description: sentenceEnd(o.description) }),
    });
  const run = (lang) =>
    translateDocument({
      collection: 'blog',
      lang,
      source: parseDocument(JA_END),
      client: client(),
      now: FIXED_NOW,
      attempts: 1,
    });

  it.each(['en', 'es'])('%s: 本文と description は「Contact Cor.Inc.」（「Cor.Inc..」にしない）', async (lang) => {
    const { text, data } = await run(lang);
    expect(text).not.toContain('Cor.Inc..');
    expect(parseDocument(text).body.trim()).toBe('Contact Cor.Inc.');
    expect(data.description).toBe('Contact Cor.Inc.');
  });

  it.each([
    ['zh', 'Cor.株式会社'],
    ['ko', 'Cor.주식회사'],
  ])('%s: 正式表記が「.」で終わらない言語では、文末の「.」をそのまま残す', async (lang, official) => {
    const { text, data } = await run(lang);
    expect(parseDocument(text).body.trim()).toBe(`Contact ${official}.`);
    expect(data.description).toBe(`Contact ${official}.`);
  });

  it('モデルが自分で書いた社名（表記ゆれ）の後の「.」も重ねない。省略記号「...」は残す', () => {
    expect(normalizeOrganizationNames('Contact Cor. Inc..', 'en')).toBe('Contact Cor.Inc.');
    expect(normalizeOrganizationNames('Contact Cor.Inc..', 'es')).toBe('Contact Cor.Inc.');
    expect(normalizeOrganizationNames('Cor.Inc., and more', 'en')).toBe('Cor.Inc., and more');
    expect(normalizeOrganizationNames('Cor.Inc...', 'en')).toBe('Cor.Inc...');
  });
});
