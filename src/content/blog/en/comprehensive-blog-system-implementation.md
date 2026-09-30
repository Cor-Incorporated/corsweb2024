---
title: "Full Implementation of a Blog System in Astro 4.8 - A Comprehensive Approach Including AI Translation and E2E Testing"
description: "A record of the implementation of a high-performance blog system based on Astro Content Collections. Explains the comprehensive development process, including AI automatic translation using the Google Gemini API, Playwright E2E testing, and rate limiting features."
pubDate: 2025-06-22
category: "engineering"
tags: ["Astro", "ブログシステム", "AI翻訳", "E2Eテスト", "TypeScript", "Google Gemini API", "Playwright", "レート制限"]
author: "Terisuke"
lang: "en"
featured: true
translationSourceHash: "1b3935bc380f58ac78655e28b05d56636ec781d7d6341005c1e2506ead4416bd"
translatedAt: "2026-09-28T06:09:16.002Z"
translationModel: "adopted-legacy"
---

## Overview

In a recent development, we've implemented a comprehensive blog system built on Astro 4.8.7. This system is a modern technical blog platform, encompassing not just Markdown display but also features like AI auto-translation, E2E testing, and functionalities geared towards full-scale operation.

The era of wrestling with WordPress widgets is over. Now, you can let AI translate, automate tests, and engineers can just sleep (just kidding).

## Technical Stack

### Core Technologies
- **Astro 4.8.7**: High-speed SSG with Island Architecture
- **TypeScript**: Type-safe development environment
- **Tailwind CSS**: Utility-first styling
- **Alpine.js 3.14.0**: Lightweight frontend JavaScript

### Blog-Specific Features
- **Content Collections**: Astro's type-safe content management
- **Google Gemini API**: AI auto-translation engine
- **Playwright**: E2E test automation
- **remark-link-card-plus**: Rich link card generation

## Core Implementation Architecture

### 1. Content Collections Design

We adopted Astro's `Content Collections` for managing Markdown files, moving away from conventional methods. No more "Wait, was this frontmatter format correct?":

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

**Advantages**:
- Prevents metadata errors through build-time type validation.
- Real-time updates with hot reloading.
- Automatic schema validation.

### 2. AI Translation System Design

We built an automatic translation system utilizing the Google Gemini API. What used to take days for human translators can now be done in seconds by AI, and without complaints:

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

**Features**:
- **Rate Limiting**: A conservative limit of 15 requests per minute.
- **Error Handling**: Retry functionality with exponential backoff.
- **YAML Safety**: Proper escaping of frontmatter.

### 3. Rate Limiting System

We implemented a rate limiting function for stable API operation. This ensures we don't get yelled at by Google for sending too many requests:

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

We've implemented comprehensive tests for blog functionalities using Playwright. Just saying "it works" isn't good enough anymore:

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
- Image delivery in AVIF format.
- WebP fallback.
- Responsive image sizes (480w, 800w).

## Challenges and Solutions

### 1. YAML Frontmatter Escaping Issue

**Challenge**: YAML parsing errors when translated titles or descriptions contain special characters.

**Solution**:
```javascript
function escapeYAMLString(str) {
  return str
    .replace(/\\/g, "\\\\") // Escape backslashes first
    .replace(/"/g, '\\"');   // Escape double quotes
}
```

### 2. API Rate Limit Handling

**Challenge**: Request failures due to Gemini API limits.

**Solution**: Exponential backoff and intelligent rate limiting.
- 1-second based delay.
- Gradual delays up to a maximum of 60 seconds.
- Pre-emptive limiting by tracking request times.

### 3. E2E Test Stability

**Challenge**: Test instability due to dynamic content.

**Solution**: Reliable element identification using `data-testid` attributes.

## Operational Flow

### New Article Posting Process

1. **Create Japanese Article**: Create a Markdown file in `/src/content/blog/ja/`.
2. **AI Translation**: `npm run translate src/content/blog/ja/article-name.md`
3. **Run Tests**: `npm run test:e2e`
4. **Build**: `npm run build`
5. **Deploy**: Automatic deployment to Firebase Hosting.

### Quality Assurance

- **Type Checking**: Compile-time checks with TypeScript.
- **Schema Validation**: Content validation with Zod.
- **E2E Tests**: Functional tests with Playwright.

## Lessons Learned

### 1. The Power of Content Collections

Compared to traditional file-based management, type safety and developer experience have dramatically improved. Notably, the clear scope of impact when changing schemas allows for safe refactoring.

Now that TypeScript shouts "Type mismatch!", we don't have to fear runtime errors. It's the best.

### 2. Practicality of AI Translation

The translation quality of the Google Gemini API for technical articles is very high, minimizing the need for manual adjustments. However, consistency in technical terms requires ongoing improvement.

I chuckled when "npm" was translated to "en-pee-em". Well, it's not wrong.

### 3. Importance of E2E Testing

We've realized that for complex functionalities like routing and metadata generation, E2E tests are indispensable, even for static site generators.

I want to punch my past self for thinking "Static sites don't need tests."

## Performance Results

- **First Contentful Paint**: 0.8 seconds
- **Largest Contentful Paint**: 1.2 seconds
- **Cumulative Layout Shift**: 0.05
- **Total Bundle Size**: 45KB (after gzip compression)

## Conclusion

Through the implementation of this blog system, we've confirmed the importance of the following in modern JAMstack architecture:

1. **Type Safety**: Design-time error prevention with Content Collections (no more crying over runtime errors).
2. **Automation**: Operational efficiency through AI translation and E2E testing (taking away human jobs).
3. **Performance**: High-speed optimization through aggressive tuning (peak speed).
4. **Maintainability**: Sustainable development with a clear architecture (kind to our future selves).

As a technical blog platform, we've achieved complete automation from article writing to publication, creating an environment where developers can focus on essential content creation.

In other words, we now have no excuse for slacking off on blog updates. Is that... wonderful?
