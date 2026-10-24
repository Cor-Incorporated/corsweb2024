---
title: "[Full 5-Language Support] A Whirlwind 3-Hour Chronicle of Expanding a Japanese-English Blog to Chinese, Korean, and Spanish"
description: "The shocking realization that our supposed 5-language support was actually just two languages. A complete record of blazing-fast implementation to support Chinese, Korean, and Spanish alongside Claude Code."
summary: "On a site that was supposed to support five languages, only the blog was limited to Japanese and English. In about three hours alongside Claude Code, we built Chinese, Korean, and Spanish pages, translated eight existing articles using the Gemini API, and fixed build errors. You never truly know what \"supported\" means until you check for yourself."
pubDate: 2025-09-25
updatedDate: 2026-10-23
author: "Terisuke"
category: "engineering"
tags: ["多言語化", "i18n", "Astro", "Claude Code", "自動化", "Gemini API"]
image:
  url: "/images/blog/ko-404.avif"
  alt: "Korean blog 404 page"
lang: "en"
featured: true
isDraft: false
translationSourceHash: "772589688a81666ca3dff4dff9d0215ef52dad0a70360fe768f0873b4d940fc3"
translatedAt: "2026-10-23T06:16:04.762Z"
translationModel: "gemini-3.8-flash"
---

# [Full 5-Language Support] A Whirlwind 3-Hour Chronicle of Expanding a Japanese-English Blog to Chinese, Korean, and Spanish

"Wait, doesn't it say 5 languages supported?!"

It was early Thursday afternoon when I was casually reviewing the implementation on the site's develop branch. Just as requested of Cursor Agent, five national flags were neatly lined up on the language switcher button. But then, I tried opening the blog page in Chinese.

![Chinese blog page showing a 404 error](/images/blog/404.avif)

**404 Not Found**.

Upon digging in, a shocking truth came to light.

## "5-Language Support" That Was Actually 2-Language Support

```typescript
// utils/i18n.ts には確かに5言語の翻訳が...
export type Locale = 'ja' | 'en' | 'zh' | 'ko' | 'es';
```

Looking at the i18n settings, it certainly appeared to support 5 languages. The home page, the company overview—everything was properly translated. But then I looked at the blog page directory.

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

**Only the blog supported Japanese and English**.

![Checking the directory structure](/images/blog/keyboardclasher.avif)

## Kicking Off Rapid Implementation with Claude Code

At this point, the only option was to implement the remaining three languages. Fortunately, I had Claude Code. Without hesitation, I began the implementation.

### Step 1: Duplicating and Modifying the Blog Pages

First, copy the English blog pages and modify them for each language.

```bash
# 中国語、韓国語、スペイン語のディレクトリを作成
for lang in zh ko es; do
  mkdir -p src/pages/$lang/blog/
  cp -r src/pages/en/blog/* src/pages/$lang/blog/
done
```

However, this alone won't get it working. We need to update the language filters inside each file.

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

### Step 2: Creating a Translation Script

Translating eight Japanese articles manually simply wasn't realistic. So, I wrote an automated translation script using the Gemini API.

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

### Step 3: The Battle with Errors

Having run the translation script, I set out in high spirits to verify the site.

```bash
$ npm run build
✘ [ERROR] Expected "}" but found "."
  script:/ProductsTable.astro:3:33:
    3 │   buttonTexts: {t.buttonTexts},
      ╵                ^
```

**A storm of build errors**.

![A pile of error logs](/images/blog/naniittenda.avif)

## A Succession of Bug Fixes

### Issue 1: Mysterious Debug Code in ProductsTable.astro

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

Resolved by removing this debug code.

### Issue 2: Missing Language Support in CategoryBadge

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

### Issue 3: PostCard Links All Navigating to English

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

### Issue 4: Translated, but Titles Remained in Japanese

This was the trickiest one. While the translation script seemed to be running properly, the title and description in the frontmatter remained in Japanese.

```yaml
# 中国語の記事なのに...
---
title: "【爆速15分】MCPサーバーでMCPサーバーを作る！"  # 日本語！
description: "LT中止の絶望から生まれた奇跡..."  # 日本語！
lang: "zh"
---

# 【闪电15分钟】用MCP服务器构建MCP服务器！  # 本文は中国語
```

Investigating the cause revealed a bug in the translation script's parsing logic. I addressed this by writing a separate correction script.

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

## The Results of a Whirlwind 3 Hours

Roughly three hours after discovering the initial error. At last, every issue was resolved.

### List of Implemented Features

- Creation of Chinese, Korean, and Spanish blog pages
- 5-language support for category pages
- 5-language support for tag pages
- 5-language support for RSS feeds
- 5-language support for checkout success/cancel pages
- Automated translation of 8 existing articles × 3 languages = 24 articles
- Elimination of all TypeScript errors
- Successful build (317 pages)

![Completed Chinese blog](/images/blog/zh.avif)
![Completed Korean blog](/images/blog/ko.avif)
![Completed Spanish blog](/images/blog/es.avif)


### Translation Quality

The translations generated by the Gemini API were higher quality than expected.

```text
日本語: 「いい感じにアレしとくアプリ」開発秘話
中国語: "随心所欲处理应用"开发秘辛
韓国語: '적당히 알아서 해주는 앱' 개발 비화
スペイン語: La historia detrás de la aplicación 'Hazlo bien y ya'
```

They resulted in natural translations that accurately capture the nuances of each language.

## Lessons Learned

### 1. The Definition of "Supported" Is Vague

Even when something claims "5-language support," you won't know the actual extent of coverage until you check. Cases like this—where the top page is supported, but the blog is not—are probably more common than one might think.

### 2. The Power of Collaborating with Claude Code

Having Claude Code was a huge factor in being able to complete the implementation of 5 languages × 8 articles in just three hours. It was especially helpful in the following areas:

- Instantly pinpointing root causes from error messages
- Learning fix patterns and applying identical fixes en masse
- Efficiently implementing the translation script logic

### 3. Automation Scripts Are King

Translating 24 articles by hand would likely have taken far longer. Even if it takes an hour to build an automation script, the return is well worth it.

### 4. Errors Are a Goldmine

The numerous errors encountered this time were great opportunities to uncover latent issues in the system. The missing language support in CategoryBadge, in particular, would inevitably have become a problem down the line.

## Conclusion: Toward True Multilingual Support

The shocking revelation that a site initially thought to have "5-language support" was actually just "pseudo-5-language support." Yet through three hours of battle alongside Claude Code, we were able to achieve true 5-language support.

Now, blog posts display properly in Chinese, Korean, and Spanish alike. No more 404 errors.

This is what real multilingual support looks like.

---

*The implemented code is available on GitHub. The translation script should also be usable in other Astro projects.*

https://github.com/Cor-Incorporated/corsweb2024

*The three hours spent battling alongside Claude Code were intense, yet immensely fulfilling.*
