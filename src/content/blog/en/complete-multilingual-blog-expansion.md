---
title: "[Full 5-Language Support] A Furious 3-Hour Battle Report of Expanding a Blog from Just Japanese and English to Chinese, Korean, and Spanish"
description: "The shocking truth that it was only 2 languages when it was supposed to be 5 languages. The complete record of rapidly implementing Chinese, Korean, and Spanish support with Claude Code."
pubDate: 2025-09-25
author: "Terisuke"
category: "engineering"
tags: ["多言語化", "i18n", "Astro", "Claude Code", "自動化", "Gemini API"]
image:
  url: "/images/blog/ko-404.avif"
  alt: "韓国語ブログ404ページ"
lang: "en"
featured: true
isDraft: false
translationSourceHash: "7586bfc2c8375645439c90fb49b1669b1cc49c8f3ac391a4d605e79a6bc1ecb6"
translatedAt: "2026-09-27T15:04:04.302Z"
translationModel: "adopted-legacy"
---

# [Fully 5-Language Support] A Frenzied 3-Hour Battle to Expand a Blog from English/Japanese to Chinese, Korean, and Spanish

"Doesn't it say 'supports 5 languages' right there!"

It was a Thursday afternoon, and I was casually looking at the implementation of the Develop branch of the site. Just as I had requested from Cursor Agent, five flags were indeed lined up on the language switcher button. However, when I opened a blog page in Chinese...

![A Chinese blog page displaying a 404 error](/images/blog/404.avif)

**404 Not Found.**

Upon investigation, a shocking truth was revealed.

## 5-Language Support That Was Actually 2-Language Support

```typescript
// utils/i18n.ts indeed has translations for 5 languages...
export type Locale = 'ja' | 'en' | 'zh' | 'ko' | 'es';
```

Looking at the i18n configuration, it indeed supports 5 languages. The top page, the company profile, everything was translated properly. However...

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

**Only English and Japanese were supported for the blog.**

![Checking the directory structure](/images/blog/keyboardclasher.avif)

## High-Speed Implementation with Claude Code Begins

With no other choice, the remaining three languages had to be implemented. Fortunately, Claude Code was available. I immediately started the implementation.

### Step 1: Duplicate and Modify Blog Pages

First, I copied the English blog pages and modified them for each language.

```bash
# Create directories for Chinese, Korean, and Spanish
for lang in zh ko es; do
  mkdir -p src/pages/$lang/blog/
  cp -r src/pages/en/blog/* src/pages/$lang/blog/
done
```

However, this alone wouldn't work. The language filters within each file needed to be corrected.

```typescript
// Before modification (common to all files)
const allPosts = await getCollection('blog', ({ data }) => {
  return data.lang === 'en' && !data.isDraft;
});

// After modification (e.g., for Chinese)
const allPosts = await getCollection('blog', ({ data }) => {
  return data.lang === 'zh' && !data.isDraft;
});
```

### Step 2: Create the Ultimate Translation Script

Manually translating 8 Japanese articles was not feasible. So, I created an automatic translation script using the Gemini API.

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

  // Translate title and description
  const titleAndDescription = `Title: ${frontmatter.title}\nDescription: ${frontmatter.description}`;
  const translatedTitleDesc = await translateWithGemini(titleAndDescription, targetLang);

  // Translate body
  const translatedBody = await translateWithGemini(body, targetLang);

  // Save the file
  saveTranslatedFile(targetLang, translatedContent);
}
```

https://github.com/Cor-Incorporated/corsweb2024/blob/52f7f174d7f2b32cd655b5d3c0e786cf137ab9fa/scripts/translate-blog-all-languages.js

### Step 3: A Fierce Battle with Errors

After running the translation script and eagerly checking the site...

```bash
$ npm run build
✘ [ERROR] Expected "}" but found "."
  script:/ProductsTable.astro:3:33:
    3 │   buttonTexts: {t.buttonTexts},
      ╵                ^
```

**A storm of build errors.**

![A pile of error logs](/images/blog/naniittenda.avif)

## Continuous Bug Fixing

### Problem 1: Mysterious Debug Code in ProductsTable.astro

```javascript
// Mysterious debug code that was unexpectedly present
<script>
  console.log('Button text debug:', {
    buttonTexts: {t.buttonTexts},  // ← This caused a syntax error
    goTo: {t.buttonTexts?.goTo},
    itemName: {item.name}
  });
</script>
```

This was resolved by deleting this debug code.

### Problem 2: Missing Language Support for CategoryBadge

```typescript
// Before modification
const categoryLabels = {
  ja: { 'ai': 'AI', 'engineering': 'エンジニアリング', ... },
  en: { 'ai': 'AI', 'engineering': 'Engineering', ... },
  // zh, ko, es were missing!
};

// After modification
const categoryLabels = {
  ja: { ... },
  en: { ... },
  zh: { 'ai': '人工智能', 'engineering': '工程', ... },
  ko: { 'ai': 'AI', 'engineering': '엔지니어링', ... },
  es: { 'ai': 'IA', 'engineering': 'Ingeniería', ... },
};
```

### Problem 3: Post Card Links All Redirect to English

```typescript
// Before modification
const postUrl = currentLocale === 'ja'
  ? `/blog/${cleanSlug}`
  : `/en/blog/${cleanSlug}`;  // Even for other languages, it would redirect to /en/!

// After modification
const postUrl = currentLocale === 'ja'
  ? `/blog/${cleanSlug}`
  : `/${currentLocale}/blog/${cleanSlug}`;
```

### Problem 4: Translated But Title Remains in Japanese

This was the most troublesome. The translation script seemed to be working correctly, but the `title` and `description` in the frontmatter remained in Japanese...

```yaml
# Even though it's a Chinese article...
---
title: "【爆速15分】MCPサーバーでMCPサーバーを作る！"  # Japanese!
description: "LT中止の絶望から生まれた奇跡..."  # Japanese!
lang: "zh"
---

# 【闪电15分钟】用MCP服务器构建MCP服务器！  # The body is in Chinese
```

After investigating the cause, it was found that there was a bug in the parsing logic of the translation script. A separate script was created to fix this.

```javascript
// scripts/fix-translated-frontmatter.cjs
function extractTitleFromBody(body) {
  const lines = body.split('\n');
  for (const line of lines) {
    if (line.startsWith('# ')) {
      return line.substring(2).trim();  // Extract from the first heading in the body
    }
  }
  return null;
}
```

## Achievements of a Frenzied 3 Hours

Approximately 3 hours after discovering the first error, all problems were finally resolved.

### Implemented Features List

- ✅ Created blog pages for Chinese, Korean, and Spanish
- ✅ 5-language support for category pages
- ✅ 5-language support for tag pages
- ✅ 5-language support for RSS feeds
- ✅ 5-language support for payment success/cancellation pages
- ✅ Automatic translation of 8 existing articles x 3 languages = 24 articles
- ✅ Resolved all TypeScript errors
- ✅ Successful build (317 pages)

![Completed Chinese blog](/images/blog/zh.avif)
![Completed Korean blog](/images/blog/ko.avif)
![Completed Spanish blog](/images/blog/es.avif)

### Translation Quality

The translations by the Gemini API were of higher quality than expected.

```text
Japanese: 「いい感じにアレしとくアプリ」開発秘話
Chinese: "随心所欲处理应用"开发秘辛
Korean: '적당히 알아서 해주는 앱' 개발 비화
Spanish: La historia detrás de la aplicación 'Hazlo bien y ya'
```

The translations accurately captured the nuances of each language and are natural.

## What I Learned

### 1. The Definition of "Supports" is Vague

Even if it says "supports 5 languages," you can't know the extent of that support until you investigate. Cases where the top page is supported but the blog is not, like this one, seem surprisingly common.

### 2. The Power of Collaboration with Claude Code

The fact that we were able to complete the implementation for 5 languages and 8 articles in 3 hours is largely due to Claude Code. It was particularly helpful in the following aspects:

- Instantly identifying the cause of errors from error messages.
- Learning correction patterns and applying similar corrections in bulk.
- Efficiently implementing the logic for translation scripts.

### 3. Automation Scripts are Justice

If I had manually translated 24 articles, it probably would have taken a week. Even if it takes an hour to create an automation script, the return is far greater.

### 4. Errors are a Treasure Trove

The errors encountered this time were a great opportunity to discover potential issues in the system. The missing language support for CategoryBadge, in particular, would have eventually become a problem.

## Conclusion: Towards True Multilingual Support

The shocking truth that the site, initially thought to have "5-language support," was actually "fake 5-language support." However, through 3 hours of battling with Claude Code, true 5-language support was achieved.

Now, blog articles are displayed correctly in Chinese, Korean, and Spanish. No more 404 errors.

This is true multilingual support.

---

*The implemented code is available on GitHub. The translation script should be usable in other Astro projects.*

https://github.com/Cor-Incorporated/corsweb2024

*The 3 hours spent battling with Claude Code was a frenzied yet fulfilling time.*
