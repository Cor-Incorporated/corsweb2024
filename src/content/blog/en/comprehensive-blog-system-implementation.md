---
title: "Complete Blog System Implementation with Astro 4.8: A Comprehensive Approach Including AI Translation and E2E Testing"
description: "An implementation record of a high-performance blog system built on Astro Content Collections. Explains the comprehensive development process, including automated AI translation with the Google Gemini API, Playwright E2E testing, and rate limiting features."
summary: "We implemented a blog system built on Astro 4.8.7's Content Collections, equipped with automated translation via the Gemini API and E2E testing with Playwright. Build-time type verification now prevents metadata errors, and we realized that E2E testing is essential even for static sites."
pubDate: 2025-06-22
updatedDate: 2026-10-23
category: "engineering"
tags: ["Astro", "ブログシステム", "AI翻訳", "E2Eテスト", "TypeScript", "Google Gemini API", "Playwright", "レート制限"]
author: "Terisuke"
lang: "en"
featured: true
translationSourceHash: "8b54af12c168859d53d6138a17b5e56f908b6f0e2703998d15036aa7d61193fa"
translatedAt: "2026-10-23T06:16:06.051Z"
translationModel: "gemini-3.8-flash"
---

## Overview

In our recent development, we implemented a comprehensive blog system built on Astro 4.8.7. This system is a modern technical blog platform that not only displays Markdown, but also comes fully equipped with features designed for production operations, including AI automatic translation and E2E testing.

The days of wrestling with widgets in WordPress are over. From now on, we can let AI handle translations, automate testing, and engineers can just sleep all day (just kidding).

## Tech Stack

### Core Technologies
- Astro 4.8.7: Fast SSG powered by Island Architecture
- TypeScript: Type-safe development environment
- Tailwind CSS: Utility-first styling
- Alpine.js 3.14.0: Lightweight front-end JavaScript

### Blog-Specific Features
- Content Collections: Astro's type-safe content management
- Google Gemini API: AI automated translation engine
- Playwright: E2E test automation
- remark-link-card-plus: Rich link card generation

## Core Implementation Architecture

### 1. Content Collections Design

We switched from traditional Markdown file management to Astro's `Content Collections`. No more worrying about "Wait, is this the right way to write frontmatter?"

```typescript
// src/content/config.ts
const blogCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    category: z.enum(['ai', 'engineering', 'founder', 'lab']),
    tags: z.array(z.string()).default([]),
    lang: z.enum(['ja', 'en']).default('ja'),
    featured: z.boolean().default(false),
  }),
});
```

The advantages are as follows:
- Build-time type verification prevents metadata errors
- Real-time updates with hot reloading
- Automatic schema validation

### 2. AI Translation System Design

We built an automated translation system using the Google Gemini API. It finishes much faster than asking human translators. Plus, it never complains.

```javascript
// scripts/translate-blog.js
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
  model: "gemini-2.5-flash-lite-preview-06-17" 
});

async function translateBlogPost(japaneseContent) {
  const prompt = `Translate the following Japanese blog post to English. 
  Translate technical terms appropriately and make it readable English:

${japaneseContent}`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
```

The features are as follows:
- Rate limiting: A conservative limit of 15 requests/minute
- Error handling: Retry functionality using exponential backoff
- YAML safety: Proper escaping of frontmatter

### 3. Rate Limiting System

To ensure stable API operations, we implemented a rate limiting feature. This is also to keep Google from getting mad and telling us, "Hey, you're sending too many requests!"

```javascript
// scripts/rate-limiter.js
class RateLimiter {
  constructor({ requestsPerMinute = 15, maxRetries = 3 }) {
    this.requestsPerMinute = requestsPerMinute;
    this.maxRetries = maxRetries;
    this.requestTimes = [];
  }

  async executeWithRetry(operation, description) {
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        await this.checkRateLimit();
        return await operation();
      } catch (error) {
        if (attempt === this.maxRetries) throw error;
        await this.backoff(attempt);
      }
    }
  }
}
```

### 4. E2E Test Implementation

Using Playwright, we implemented comprehensive tests for the blog features. Just saying "It looks like it works, so it's fine!" simply won't cut it.

```typescript
// e2e/blog.spec.ts
test.describe('Blog functionality', () => {
  test('should navigate to Japanese blog', async ({ page }) => {
    await page.goto('/blog/');
    await expect(page.locator('h1')).toContainText('技術ブログ');
  });

  test('should display OGP image for blog posts', async ({ page }) => {
    await page.goto('/blog/');
    const firstPost = page.locator('[data-testid="blog-post"]').first();
    await firstPost.click();
    
    const ogImage = page.locator('meta[property="og:image"]');
    await expect(ogImage).toHaveAttribute('content', /\/og\/.*\.svg/);
  });
});
```

## Performance Optimization

### Compression and Optimization Settings

```javascript
// astro.config.mjs
integrations: [
  compress({
    CSS: true,
    HTML: {
      'remove-comments': true,
      'minify-js': true,
      'minify-css': true
    },
    JavaScript: true,
    SVG: true
  }),
  compressor({
    gzip: true,
    brotli: true
  })
]
```

### Image Optimization
- Image delivery in AVIF format
- WebP fallback
- Responsive image sizes (480w, 800w)

## Challenges and Solutions

### 1. YAML Frontmatter Escaping Issue

The challenge was that special characters contained in translated titles or descriptions resulted in YAML parsing errors.

As a solution, we escape them using the following function:
```javascript
function escapeYAMLString(str) {
  return str
    .replace(/\\/g, "\\\\") // バックスラッシュを最初にエスケープ
    .replace(/"/g, '\\"');   // ダブルクォートをエスケープ
}
```

### 2. Handling API Rate Limits

The challenge was that requests were failing due to Gemini API limits.

The solution is exponential backoff and intelligent rate limiting:
- 1-second base delay
- Progressive delay up to a maximum of 60 seconds
- Proactive limiting by tracking request timestamps

### 3. E2E Test Stability

The challenge was that tests became flaky due to dynamic content.

The solution is to reliably identify elements using data-testid attributes.

## Operational Workflow

### New Article Publishing Process

1. Create Japanese article: Create a Markdown file in `/src/content/blog/ja/`
2. AI translation: `npm run translate src/content/blog/ja/article-name.md`
3. Run tests: `npm run test:e2e`
4. Build: `npm run build`
5. Deploy: Automatic deployment to Firebase Hosting

### Quality Assurance

- Type checking: Compile-time checks with TypeScript
- Schema verification: Content validation with Zod
- E2E testing: Functional testing with Playwright

## Lessons Learned

### 1. The Power of Content Collections

Compared to traditional file-based management, type safety and the developer experience improved dramatically. In particular, the scope of impact when changing a schema became clear, enabling safe refactoring.

Now TypeScript gets mad at us with "The types don't match!", so there's no need to freak out over runtime errors. It's fantastic.

### 2. The Practicality of AI Translation

The translation quality of the Google Gemini API was extremely high for technical articles, requiring minimal manual tweaking. However, continuous improvement is needed for consistency in technical terminology.

It cracked me up when "npm" got translated into Japanese as "エヌピーエム" (E-nu-pii-e-mu). Well, technically it's not wrong.

### 3. The Importance of E2E Testing

We realized that even for a static site generator, E2E testing is indispensable for complex features like routing and metadata generation.

I want to kick the past version of myself who thought, "It's a static site, so we don't need tests, right?"

## Summary

Through the implementation of this blog system, we confirmed that the following points are crucial in a modern JAMstack architecture:

1. Type safety: Preventing design-time errors with Content Collections (no more crying over runtime errors)
2. Automation: Operational efficiency through AI translation and E2E testing (taking away humans' jobs)
3. Performance: Speed enhancements through aggressive optimization (the pinnacle of blazing-fast speed)
4. Maintainability: Sustainable development through a clear architecture (kind to our future selves)

As a technical blog platform, we automated the flow from article writing to publication, creating an environment where developers can focus on crafting the content of their articles.

In other words, this means we no longer have any excuses to slack off on updating the blog. Wonderful... or is it?
