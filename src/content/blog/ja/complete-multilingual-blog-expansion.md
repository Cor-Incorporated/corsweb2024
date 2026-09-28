---
title: "【完全5言語対応】日英だけだったブログを中韓西まで拡張した怒涛の3時間戦記"
description: "5言語対応と思いきや実は2言語だけだった衝撃の事実。Claude Codeと共に中国語・韓国語・スペイン語対応を爆速実装した全記録"
pubDate: 2025-09-25
author: "Terisuke"
category: "engineering"
tags: ["多言語化", "i18n", "Astro", "Claude Code", "自動化", "Gemini API"]
image:
  url: "/images/blog/ko-404.avif"
  alt: "韓国語ブログ404ページ"
lang: "ja"
featured: true
isDraft: false
---

# 【完全5言語対応】日英だけだったブログを中韓西まで拡張した怒涛の3時間戦記

「5ヶ国語対応って書いてあるじゃないですか！」

木曜日の昼下がり、何気なくサイトのDevelopブランチの実装を見ていた時のこと。Cursor Agentにお願いした通り、言語切り替えボタンには確かに5つの国旗が並んでいる。しかし、中国語でブログページを開いてみると...

![404エラーが表示される中国語ブログページ](/images/blog/404.avif)

**404 Not Found。**

調査してみると、衝撃の事実が判明した。

## 5言語対応という名の2言語対応

```typescript
// utils/i18n.ts には確かに5言語の翻訳が...
export type Locale = 'ja' | 'en' | 'zh' | 'ko' | 'es';
```

i18nの設定を見る限り、確かに5言語対応している。トップページも、会社概要も、全部きちんと翻訳されている。しかし...

```bash
$ ls src/pages/*/blog/
src/pages/en/blog/:
[...page].astro  [...slug].astro

src/pages/zh/blog/:
ls: src/pages/zh/blog/: No such file or directory

src/pages/ko/blog/:
ls: src/pages/ko/blog/: No such file or directory

src/pages/es/blog/:
ls: src/pages/es/blog/: No such file or directory
```

**ブログだけ日英しか対応していなかった。**

![ディレクトリ構造を確認する様子](/images/blog/keyboardclasher.avif)

## Claude Codeとの高速実装開始

こうなったら、残りの3言語も実装するしかない。幸い、Claude Codeがある。早速、実装を開始した。

### ステップ1: ブログページの複製と修正

まずは英語版のブログページをコピーして、各言語用に修正する。

```bash
# 中国語、韓国語、スペイン語のディレクトリを作成
for lang in zh ko es; do
  mkdir -p src/pages/$lang/blog/
  cp -r src/pages/en/blog/* src/pages/$lang/blog/
done
```

しかし、これだけでは動かない。各ファイル内の言語フィルターを修正する必要がある。

```typescript
// 修正前（全ファイル共通）
const allPosts = await getCollection('blog', ({ data }) => {
  return data.lang === 'en' && !data.isDraft;
});

// 修正後（例：中国語版）
const allPosts = await getCollection('blog', ({ data }) => {
  return data.lang === 'zh' && !data.isDraft;
});
```

### ステップ2: 最強の翻訳スクリプト作成

8つの日本語記事を手動で翻訳するなんて現実的じゃない。そこで、Gemini APIを使った自動翻訳スクリプトを作成した。

```javascript
// scripts/translate-blog-all-languages.js
const LANGUAGES = {
  en: { name: 'English', author: 'Terisuke' },
  zh: { name: 'Chinese', author: 'Terisuke' },
  ko: { name: 'Korean', author: 'Terisuke' },
  es: { name: 'Spanish', author: 'Terisuke' }
};

async function translateToLanguage(inputFile, targetLang, body, frontmatter) {
  console.log(`📝 Translating to ${LANGUAGES[targetLang].name}...`);

  // タイトルとdescriptionを翻訳
  const titleAndDescription = `Title: ${frontmatter.title}\nDescription: ${frontmatter.description}`;
  const translatedTitleDesc = await translateWithGemini(titleAndDescription, targetLang);

  // 本文を翻訳
  const translatedBody = await translateWithGemini(body, targetLang);

  // ファイルを保存
  saveTranslatedFile(targetLang, translatedContent);
}
```

https://github.com/Cor-Incorporated/corsweb2024/blob/52f7f174d7f2b32cd655b5d3c0e786cf137ab9fa/scripts/translate-blog-all-languages.js

### ステップ3: エラーとの死闘

翻訳スクリプトを実行して、意気揚々とサイトを確認すると...

```bash
$ npm run build
✘ [ERROR] Expected "}" but found "."
  script:/ProductsTable.astro:3:33:
    3 │   buttonTexts: {t.buttonTexts},
      ╵                ^
```

**ビルドエラーの嵐。**

![エラーログの山](/images/blog/naniittenda.avif)

## バグ修正の連続

### 問題1: ProductsTable.astroの謎のデバッグコード

```javascript
// なぜか入っていた謎のデバッグコード
<script>
  console.log('Button text debug:', {
    buttonTexts: {t.buttonTexts},  // ← これが構文エラー
    goTo: {t.buttonTexts?.goTo},
    itemName: {item.name}
  });
</script>
```

このデバッグコードを削除して解決。

### 問題2: CategoryBadgeの言語対応漏れ

```typescript
// 修正前
const categoryLabels = {
  ja: { 'ai': 'AI', 'engineering': 'エンジニアリング', ... },
  en: { 'ai': 'AI', 'engineering': 'Engineering', ... },
  // zh, ko, es が存在しない！
};

// 修正後
const categoryLabels = {
  ja: { ... },
  en: { ... },
  zh: { 'ai': '人工智能', 'engineering': '工程', ... },
  ko: { 'ai': 'AI', 'engineering': '엔지니어링', ... },
  es: { 'ai': 'IA', 'engineering': 'Ingeniería', ... },
};
```

### 問題3: PostCardのリンクが全部英語に飛ぶ

```typescript
// 修正前
const postUrl = currentLocale === 'ja'
  ? `/blog/${cleanSlug}`
  : `/en/blog/${cleanSlug}`;  // 他の言語でも/en/に飛んでしまう！

// 修正後
const postUrl = currentLocale === 'ja'
  ? `/blog/${cleanSlug}`
  : `/${currentLocale}/blog/${cleanSlug}`;
```

### 問題4: 翻訳されたのにタイトルが日本語のまま

最も厄介だったのがこれ。翻訳スクリプトは正常に動いているはずなのに、frontmatterのtitleとdescriptionが日本語のまま...

```yaml
# 中国語の記事なのに...
---
title: "【爆速15分】MCPサーバーでMCPサーバーを作る！"  # 日本語！
description: "LT中止の絶望から生まれた奇跡..."  # 日本語！
lang: "zh"
---

# 【闪电15分钟】用MCP服务器构建MCP服务器！  # 本文は中国語
```

原因を調査した結果、翻訳スクリプトのパース処理にバグがあることが判明。修正用のスクリプトを別途作成して対応した。

```javascript
// scripts/fix-translated-frontmatter.cjs
function extractTitleFromBody(body) {
  const lines = body.split('\n');
  for (const line of lines) {
    if (line.startsWith('# ')) {
      return line.substring(2).trim();  // 本文の最初の見出しから抽出
    }
  }
  return null;
}
```

## 怒涛の3時間の成果

最初のエラー発見から約3時間。ついに全ての問題を解決した。

### 実装した機能一覧

- ✅ 中国語・韓国語・スペイン語のブログページ作成
- ✅ カテゴリページの5言語対応
- ✅ タグページの5言語対応
- ✅ RSS フィードの5言語対応
- ✅ 決済成功/キャンセルページの5言語対応
- ✅ 既存8記事×3言語＝24記事の自動翻訳
- ✅ 全てのTypeScriptエラーの解消
- ✅ ビルド成功（317ページ）

![完成した中国語ブログ](/images/blog/zh.avif)
![完成した韓国語ブログ](/images/blog/ko.avif)
![完成したスペイン語ブログ](/images/blog/es.avif)


### 翻訳の品質

Gemini APIによる翻訳は想像以上に高品質だった。

```text
日本語: 「いい感じにアレしとくアプリ」開発秘話
中国語: "随心所欲处理应用"开发秘辛
韓国語: '적당히 알아서 해주는 앱' 개발 비화
スペイン語: La historia detrás de la aplicación 'Hazlo bien y ya'
```

各言語のニュアンスをきちんと捉えた、自然な翻訳になっている。

## 学んだこと

### 1. 「対応している」の定義は曖昧

「5言語対応」と言っても、実際にどこまで対応しているかは調べてみないとわからない。今回のようにトップページは対応していてもブログは対応していない、というケースは意外とありそう。

### 2. Claude Codeとの協働の威力

3時間で5言語×8記事の実装を完了できたのは、Claude Codeの存在が大きい。特に以下の点で助けられた：

- エラーメッセージから原因を即座に特定
- 修正パターンを学習して同様の修正を一括適用
- 翻訳スクリプトのロジックを効率的に実装

### 3. 自動化スクリプトは正義

手動で24記事を翻訳していたら、おそらく1週間はかかっていた。自動化スクリプトを作るのに1時間かけても、それ以上のリターンがある。

### 4. エラーは宝の山

今回遭遇したエラーの数々は、システムの潜在的な問題を発見する良い機会だった。特にCategoryBadgeの言語対応漏れは、いずれ問題になっていたはずだ。

## まとめ：真の多言語対応へ

当初「5言語対応済み」と思っていたサイトが、実は「なんちゃって5言語対応」だったという衝撃の事実。しかし、Claude Codeと共に戦った3時間で、真の5言語対応を実現することができた。

今、中国語でも韓国語でもスペイン語でも、きちんとブログ記事が表示される。404エラーはもう表示されない。

これが本当の多言語対応だ。

---

*実装したコードはGitHubで公開しています。翻訳スクリプトは他のAstroプロジェクトでも使えるはずです。*

https://github.com/Cor-Incorporated/corsweb2024

*Claude Codeと共に戦った3時間。それは、怒涛でありながらも充実した時間だった。*