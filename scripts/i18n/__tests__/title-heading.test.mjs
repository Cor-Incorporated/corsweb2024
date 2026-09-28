// @vitest-environment node
/**
 * 本文の H1 とタイトルの一致（PR #339 の実 API 検証 PR #344 の指摘）。
 * ja では frontmatter の title と本文先頭の `# ` 見出しが同じ文言なのに、英訳では title
 * 「…Before Deploying AI Agents」と H1「…Before Adopting AI Agents」が別の訳になった。
 * ja で両者が同じ文字列なら、訳文の最初の H1 を訳した title に決定的にそろえる。
 */
import { describe, expect, it } from 'vitest';
import { parseDocument } from '../frontmatter.mjs';
import { alignTitleHeading, translateDocument, TranslationError } from '../translate.mjs';
import { createMockClient, FIXED_NOW } from './helpers.mjs';

const doc = (title, body) => `---
title: "${title}"
description: "説明です。"
pubDate: 2026-06-12
author: "Terisuke"
category: "ai"
tags: ["AI"]
lang: "ja"
---

${body}
`;

const TITLE = 'AIエージェント導入前に決めるべき権限・ログ・承認フロー';
const JA_TITLED = doc(TITLE, `# ${TITLE}\n\n本文です。\n\n## 見出し\n\n内容です。`);

/** モデルが本文の H1 をタイトルとは別の言い回しに訳す事故（実 API で起きたもの）。 */
const rewordHeading = (t) =>
  t.replace(
    /^# .*$/m,
    '# Permissions, Logs, and Approval Flows to Define Before Adopting AI Agents'
  );

const run = (text, client) =>
  translateDocument({
    collection: 'blog',
    lang: 'en',
    source: parseDocument(text),
    client,
    now: FIXED_NOW,
    attempts: 1,
  });

describe('ja で title と H1 が同じなら、訳でも H1 を訳した title にそろえる', () => {
  it('モデルが H1 を別の言い回しに訳しても、H1 は訳した title になる', async () => {
    const { data, text } = await run(JA_TITLED, createMockClient({ mutateBody: rewordHeading }));
    const body = parseDocument(text).body;
    expect(data.title).toBe('AIlorem');
    expect(body).toMatch(/^\n?# AIlorem\n/);
    expect(body).not.toContain('Before Adopting');
  });

  it('ja で title と H1 が違う記事は、モデルの H1 をそのまま使う', async () => {
    const differs = doc(TITLE, '# 別の見出しです\n\n本文です。');
    const client = createMockClient({ mutateBody: (t) => t.replace(/^# .*$/m, '# Own heading') });
    const body = parseDocument((await run(differs, client)).text).body;
    expect(body).toContain('# Own heading');
  });

  it('H1 をタイトルにそろえると構造が変わる場合（title のコードが訳で消えた等）は書き込まない', async () => {
    const coded = doc('`npm` の使い方', '# `npm` の使い方\n\n本文です。');
    const client = createMockClient({
      mutateFields: (o) => ({ ...o, title: o.title.replaceAll('`', '') }),
    });
    const error = await run(coded, client).catch((e) => e);
    expect(error).toBeInstanceOf(TranslationError);
    expect(error.errors.join('\n')).toMatch(
      /見出し（H1）をタイトルにそろえると構造が ja と一致しません/
    );
  });
});

describe('alignTitleHeading', () => {
  const align = (sourceBody, translatedBody, sourceTitle = 'タイトル', translatedTitle = 'Title') =>
    alignTitleHeading({ sourceTitle, sourceBody, translatedTitle, translatedBody });

  it('最初の H1 だけを置き換え、ほかの行はそのまま', () => {
    expect(align('# タイトル\n\n本文\n\n# 二つ目', '# Heading\n\nBody\n\n# Second')).toBe(
      '# Title\n\nBody\n\n# Second'
    );
  });

  it('閉じの # と前後の空白を無視して比べる', () => {
    expect(align('#   タイトル  ##', '# Heading #')).toBe('# Title');
  });

  it('コードブロックの中の「# 」は見出しとして扱わない', () => {
    const source = '```sh\n# タイトル\n```\n\n本文';
    expect(align(source, '```sh\n# タイトル\n```\n\nBody')).toBe('```sh\n# タイトル\n```\n\nBody');
  });

  it('H2 以下や、ja に H1 が無い記事は変えない', () => {
    expect(align('## タイトル\n\n本文', '## Heading\n\nBody')).toBe('## Heading\n\nBody');
    expect(align('本文だけ', 'Body only')).toBe('Body only');
  });
});
