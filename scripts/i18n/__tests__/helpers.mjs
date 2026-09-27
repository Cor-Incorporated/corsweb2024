/**
 * テスト共通: フィクスチャ文書・モック LLM クライアント・一時リポジトリ。
 * 実 API は呼ばない（Gemini クライアントは依存注入でこのモックに差し替える）。
 */
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const JA_BLOG = `---
title: "テスト記事：翻訳パイプライン"
description: "説明文です。詳細は https://example.com/docs を参照"
pubDate: 2025-01-21
author: "Terisuke"
category: "lab"
tags: ["テスト", "AI"]
image:
  url: "/images/blog/テスト.avif"
  alt: "テスト画像"
lang: "ja"
featured: true
---

## はじめに

これは \`npm run build\` の説明です。詳細は [公式サイト](https://cor-jp.com) を参照。

\`\`\`js
// コメントは訳さない
console.log("こんにちは");
\`\`\`

![図の説明](/images/blog/図1.avif "タイトル")

https://github.com

### 数式

円の面積は $A = \\pi r^2$ です。

$$
E = mc^2
$$

| 項目 | 説明 |
|---|---|
| A | 高品質 |

<!-- 執筆メモ（訳さない） -->

~~~bash
echo "完了"
~~~
`;

export const JA_NEWS = `---
title: "ニュースページを追加しました"
description: "お知らせをまとめました。"
publishedAt: 2026-07-08
category: "info"
tags: ["お知らせ", "サイト更新"]
source: "Cor.株式会社"
isDraft: false
featured: true
lang: "ja"
---
`;

const JAPANESE_RUN_RE =
  /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー・、。「」『』（）！？：]+/gu;

/** 日本語の連なりを英単語に置き換える「翻訳」。トークン・記法・URL はそのまま残る。 */
export function fakeTranslate(text) {
  return text.replace(JAPANESE_RUN_RE, 'lorem');
}

/**
 * モッククライアント。mutateBody / mutateFields で翻訳結果に事故を注入できる。
 * calls に受け取ったリクエストを記録する。
 */
export function createMockClient({ mutateBody = (t) => t, mutateFields = (o) => o, fail } = {}) {
  const calls = [];
  return {
    model: 'mock-model',
    calls,
    async generate(request) {
      calls.push(request);
      if (fail) await fail(calls.length, request);
      if (request.jsonSchema) {
        const input = JSON.parse(request.prompt);
        const output = Object.fromEntries(
          Object.entries(input).map(([k, v]) => [
            k,
            Array.isArray(v) ? v.map(fakeTranslate) : fakeTranslate(v),
          ])
        );
        return { text: JSON.stringify(mutateFields(output)), finishReason: 'STOP' };
      }
      return { text: mutateBody(fakeTranslate(request.prompt)), finishReason: 'STOP' };
    },
  };
}

/** 最初の「⟦B…⟧ だけの行」を 1 行落とす（= コードフェンス 1 本の欠落事故）。 */
export function dropFirstBlockToken(text) {
  const lines = text.split('\n');
  const index = lines.findIndex((l) => /^\s*⟦B\d+⟧\s*$/.test(l));
  return lines.filter((_, i) => i !== index).join('\n');
}

/** files: { 'blog/ja/foo.md': '...' } を src/content 配下に書いた一時リポジトリ。 */
export async function createTempRepo(files) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'i18n-test-'));
  for (const [rel, text] of Object.entries(files)) {
    const file = path.join(root, 'src/content', rel);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, text, 'utf8');
  }
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) };
}

/** 出力を配列に溜める out。 */
export function createOut() {
  const lines = [];
  return {
    lines,
    info: (l) => lines.push(l),
    error: (l) => lines.push(`ERR ${l}`),
    text: () => lines.join('\n'),
  };
}

export const FIXED_NOW = () => new Date('2026-09-27T00:00:00.000Z');
