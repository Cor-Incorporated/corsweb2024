// @vitest-environment node
/**
 * 代表の氏名の表記を決定的にする（PR #405 の CI の訳で、en / es が「Kosuke Terada」、ko が「테라다 코스케」になった）。
 * 正式表記: ja / zh「寺田 康佑」、ko「데라다 코스케」、en / es「Kousuke Terada」（正本は src/config/author.ts の
 * KOUSUKE_TERADA.names。用語集との照合は founder-link.test.mjs）。
 *
 * 事故入力: モデルが氏名を旧表記で訳す。氏名は翻訳前にトークン ⟦F…⟧ へ置き換えるのでモデルには届かず、
 * 翻訳後に各言語の正式表記へ戻る。モデルが自分で書いた表記ゆれも、同じ文字の種類の正式表記にそろえる。
 */
import { describe, expect, it } from 'vitest';
import { parseDocument } from '../frontmatter.mjs';
import { translateDocument } from '../translate.mjs';
import { createMockClient, fakeTranslate, FIXED_NOW } from './helpers.mjs';

const JA_FOUNDER = `---
title: "代表・寺田康佑の話"
description: "Cor.株式会社の代表・寺田康佑が会社を立ち上げるまで。"
pubDate: 2026-10-25
author: "Terisuke"
category: "founder"
tags: ["代表"]
lang: "ja"
---

## 寺田 康佑のプロフィール

代表の寺田康佑は、元トランペット奏者です。テラダコウスケとも書きます。寺田さんとだけ書いたところは名字なので触りません。

[寺田康佑の記事](https://note.com/cor_instrument)

\`寺田康佑\` はコードなので訳さない。
`;

const source = parseDocument(JA_FOUNDER);

/** 氏名を見たら #405 の CI と同じ表記で訳してしまうモデル（実際に起きた事故の再現）。 */
const MISTRANSLATED = {
  en: 'Kosuke Terada',
  es: 'Kosuke Terada',
  ko: '테라다 코스케',
  zh: '寺田康佑',
};
const mistranslateName = (lang) => (text) =>
  text.replace(/寺田[ 　]?康佑|テラダコウスケ/g, MISTRANSLATED[lang]);

function accidentClient(lang, { mutateBody = (t) => t } = {}) {
  const client = createMockClient({ mutateBody });
  const generate = client.generate.bind(client);
  return {
    ...client,
    async generate(request) {
      return generate({ ...request, prompt: mistranslateName(lang)(request.prompt) });
    },
  };
}

const translate = (lang, client = accidentClient(lang)) =>
  translateDocument({ collection: 'blog', lang, source, client, now: FIXED_NOW, attempts: 1 });

describe('代表の氏名は各言語の正式表記に決定的にそろう', () => {
  it.each([
    ['en', 'Kousuke Terada', 'Cor.Inc.'],
    ['es', 'Kousuke Terada', 'Cor.Inc.'],
    ['zh', '寺田 康佑', 'Cor.株式会社'],
    ['ko', '데라다 코스케', 'Cor.주식회사'],
  ])('%s: モデルが旧表記で訳す事故でも %s になる', async (lang, official, company) => {
    const { text, data } = await translate(lang);
    // コード（`寺田康佑`）は訳さないので、それを除いたところに旧表記が残っていないこと
    expect(text.replaceAll('`寺田康佑`', '')).not.toContain(MISTRANSLATED[lang]);
    expect(data.title).toContain(official);
    expect(data.description).toContain(official);
    expect(data.description).toContain(company);
    const body = parseDocument(text).body;
    expect(body).toContain(`## ${official}lorem`);
    expect(body).toContain(`lorem${official}lorem`);
    expect(body).toContain(`[${official}lorem](https://note.com/cor_instrument)`);
  });

  // 訳の後のそろえ直しがあるので、訳文だけを見ると保護が無くても通ってしまう。モデルに届いた文で保護を確かめる
  it.each(['en', 'es', 'zh', 'ko'])(
    '%s: 氏名はモデルに渡さない（トークンで送る）。名字だけ・コードの中はそのまま',
    async (lang) => {
      const client = accidentClient(lang);
      const { text } = await translate(lang, client);
      const bodyRequest = client.calls.find((c) => !c.jsonSchema);
      expect(bodyRequest.prompt).not.toContain('康佑');
      expect(bodyRequest.prompt).not.toContain('コウスケ');
      expect(bodyRequest.prompt).toMatch(/⟦F\d+⟧/);
      expect(bodyRequest.prompt).toContain('寺田さん'); // 名字だけは氏名として扱わない
      const fieldsRequest = client.calls.find((c) => c.jsonSchema);
      expect(fieldsRequest.prompt).not.toContain('康佑');
      expect(parseDocument(text).body).toContain('`寺田康佑`'); // コードは訳さない
    }
  );

  it.each([
    ['en', ' Kosuke Terada lorem', 'Kousuke Terada lorem'],
    ['es', ' Terada Kosuke lorem', 'Kousuke Terada lorem'],
    ['ko', ' 테라다 코스케는 lorem', '데라다 코스케는 lorem'],
    ['zh', ' 寺田康佑 lorem', '寺田 康佑 lorem'],
  ])(
    '%s: モデルが自分で書いた表記ゆれ（%s）も正式表記にそろえる',
    async (lang, written, expected) => {
      const client = accidentClient(lang, {
        mutateBody: (t) => t.replace(/(⟦F\d+⟧)lorem/, `$1lorem${written}`),
      });
      const body = parseDocument((await translate(lang, client)).text).body;
      expect(body).toContain(expected);
    }
  );

  it.each([
    ['en', 'Kosuke Terada', 'Kousuke Terada'],
    ['ko', '테라다 코스케', '데라다 코스케'],
  ])(
    '%s: frontmatter でモデルが自分で書いた表記ゆれ（%s）も正式表記にそろえる',
    async (lang, written, official) => {
      const client = createMockClient({
        mutateFields: (o) => ({ ...o, title: `${o.title} ${written}` }),
      });
      const { data } = await translate(lang, client);
      expect(data.title).toBe(`lorem${official}lorem ${official}`);
    }
  );

  it('氏名のトークンが消えた・増えた訳は書き込まない（既存のプレースホルダ検証で落とす）', async () => {
    const dropped = accidentClient('en', { mutateBody: (t) => t.replace(/⟦F\d+⟧/, '') });
    await expect(translate('en', dropped)).rejects.toThrow(
      /プレースホルダ ⟦F\d+⟧ が欠落しています/
    );
    const doubled = accidentClient('en', { mutateBody: (t) => t.replace(/(⟦F\d+⟧)/, '$1 $1') });
    await expect(translate('en', doubled)).rejects.toThrow(/⟦F\d+⟧ が 2 回出現しています/);
  });

  it('fakeTranslate の前提: 氏名が届けば旧表記が訳に残る（事故の再現が効いていることの確認）', () => {
    expect(fakeTranslate(mistranslateName('en')('代表の寺田康佑は'))).toBe(
      'loremKosuke Teradalorem'
    );
  });
});
