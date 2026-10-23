---
title: "Astro 4.8 기반 블로그 시스템 완전 구현 - AI 번역 및 E2E 테스트를 포함한 포괄적 접근 방식"
description: "Astro Content Collections를 기반으로 한 고성능 블로그 시스템 구현 기록. Google Gemini API를 활용한 AI 자동 번역, Playwright E2E 테스트, 속도 제한(Rate Limiting) 기능을 포함한 포괄적인 개발 프로세스 해설"
summary: "Astro 4.8.7의 Content Collections를 기반으로 Gemini API 자동 번역과 Playwright E2E 테스트를 갖춘 블로그 시스템을 구현했다. 빌드 시 타입 검증을 통해 메타데이터 오류를 방지할 수 있게 되었으며, 정적 사이트에서도 E2E 테스트가 필수적임을 실감했다."
pubDate: 2025-06-22
updatedDate: 2026-10-23
category: "engineering"
tags: ["Astro", "ブログシステム", "AI翻訳", "E2Eテスト", "TypeScript", "Google Gemini API", "Playwright", "レート制限"]
author: "Terisuke"
lang: "ko"
featured: true
translationSourceHash: "8b54af12c168859d53d6138a17b5e56f908b6f0e2703998d15036aa7d61193fa"
translatedAt: "2026-10-23T06:22:14.693Z"
translationModel: "gemini-3.8-flash"
---

## 개요

최근 개발에서 Astro 4.8.7을 기반으로 한 포괄적인 블로그 시스템을 구현했다. 이 시스템은 Markdown을 표시하는 데 그치지 않고, AI 자동 번역, E2E 테스트, 그리고 본격적인 운영을 고려한 기능까지 갖춘 현대적인 기술 블로그 플랫폼이다.

이제 WordPress에서 위젯과 씨름하던 시대는 끝났다. 앞으로는 AI에게 번역시키고, 테스트도 자동화하고, 엔지니어는 잠만 자면 된다(농담이다).

## 기술 스택

### 코어 기술
- Astro 4.8.7: 아일랜드 아키텍처를 통한 고속 SSG
- TypeScript: 타입 안전한 개발 환경
- Tailwind CSS: 유틸리티 퍼스트 스타일링
- Alpine.js 3.14.0: 경량 프론트엔드 JavaScript

### 블로그 전용 기능
- Content Collections: Astro의 타입 안전한 콘텐츠 관리
- Google Gemini API: AI 자동 번역 엔진
- Playwright: E2E 테스트 자동화
- remark-link-card-plus: 리치 링크 카드 생성

## 구현의 핵심이 되는 아키텍처

### 1. Content Collections 설계

기존의 Markdown 파일 관리에서 Astro의 `Content Collections`(으)로 전환했다. 이제 "어라? 이 frontmatter 작성 방식이 맞았나?"라며 고민하지 않는다.

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

장점은 다음과 같다.
- 빌드 시 타입 검증으로 메타데이터 오류 방지
- Hot reloading으로 실시간 업데이트
- 자동 스키마 유효성 검사

### 2. AI 번역 시스템 설계

Google Gemini API를 사용하여 자동 번역 시스템을 만들었다. 인간 번역가에게 의뢰하는 것보다 훨씬 빨리 끝난다. 게다가 불평도 하지 않는다.

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

특징은 다음과 같다.
- 속도 제한(Rate Limiting): 15요청/분의 보수적인 제한
- 오류 처리: 지수 백오프를 통한 재시도 기능
- YAML 안전성: frontmatter의 적절한 이스케이프 처리

### 3. 속도 제한(Rate Limiting) 시스템

API를 안정적으로 운영하기 위해 속도 제한 기능을 구현했다. Google에 "너, 요청 너무 많이 보내!"라며 혼나지 않기 위함이기도 하다.

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

### 4. E2E 테스트 구현

Playwright를 사용하여 블로그 기능의 포괄적인 테스트를 구현했다. "작동하니까 됐어!"로는 안 되는 것이다.

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

## 성능 최적화

### 압축 및 최적화 설정

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

### 이미지 최적화
- AVIF 형식으로 이미지 전송
- WebP 폴백
- 반응형 이미지 크기(480w, 800w)

## 과제와 해결책

### 1. YAML Frontmatter의 이스케이프 문제

과제는 번역된 제목이나 설명문에 특수 문자가 포함되면 YAML 파싱 오류가 발생하는 것이었다.

해결책으로 다음 함수를 통해 이스케이프한다.
```javascript
function escapeYAMLString(str) {
  return str
    .replace(/\\/g, "\\\\") // バックスラッシュを最初にエスケープ
    .replace(/"/g, '\\"');   // ダブルクォートをエスケープ
}
```

### 2. API 속도 제한 대응

과제는 Gemini API의 제한으로 인해 요청이 실패하는 것이었다.

해결책은 지수 백오프와 인텔리전트한 속도 제한이다.
- 1초 기본 지연
- 최대 60초까지의 단계적 지연
- 요청 시간 추적을 통한 사전 제한

### 3. E2E 테스트의 안정성

과제는 동적 콘텐츠로 인해 테스트가 불안정해지는 것이었다.

해결책은 data-testid 속성을 사용하여 요소를 확실하게 식별하는 것이다.

## 운영 플로우

### 새 글 포스팅 프로세스

1. 일본어 글 작성: `/src/content/blog/ja/`에 Markdown 파일 생성
2. AI 번역: `npm run translate src/content/blog/ja/article-name.md`
3. 테스트 실행: `npm run test:e2e`
4. 빌드: `npm run build`
5. 배포: Firebase Hosting으로 자동 배포

### 품질 보증

- 타입 체크: TypeScript를 통한 컴파일 시점 검사
- 스키마 검증: Zod를 통한 콘텐츠 검증
- E2E 테스트: Playwright를 통한 기능 테스트

## 배운 점

### 1. Content Collections의 위력

기존 파일 기반 관리와 비교해 타입 안전성과 개발 경험이 획기적으로 향상되었다. 특히 스키마를 변경했을 때의 영향 범위가 명확해져 안전하게 리팩터링할 수 있게 되었다.

이제 TypeScript가 "타입이 다르잖아!"라고 화를 내주므로 런타임 오류로 겁먹을 일도 없다. 최고다.

### 2. AI 번역의 실용성

Google Gemini API의 번역 품질은 기술 문서에서 매우 높았으며, 수작업을 통한 미세 조정은 최소한으로 끝났다. 다만 전문 용어의 일관성에 대해서는 지속적인 개선이 필요하다.

"npm"을 "엔피엠"으로 번역했을 때는 웃음이 나왔다. 뭐, 틀린 말은 아니지만.

### 3. E2E 테스트의 중요성

정적 사이트 생성기라도 라우팅이나 메타데이터 생성과 같은 복잡한 기능에는 E2E 테스트가 필수적임을 실감했다.

"정적 사이트니까 테스트는 필요 없겠지"라고 생각했던 과거의 나를 때려주고 싶다.

## 요약

이번 블로그 시스템 구현을 통해 현대적인 JAMstack 아키텍처에서는 다음 사항이 중요하다는 점을 확인할 수 있었다.

1. 타입 안전성: Content Collections를 통한 설계 시점 오류 방지(더 이상 런타임 오류로 울지 않는다)
2. 자동화: AI 번역과 E2E 테스트를 통한 운영 효율화(인간의 일자리를 빼앗아 간다)
3. 성능: 적극적인 최적화를 통한 고속화(초고속의 정점)
4. 유지보수성: 명확한 아키텍처를 통한 지속 가능한 개발(미래의 나에게 친절하다)

기술 블로그 플랫폼으로서 글 작성부터 공개까지의 흐름을 자동화하여, 개발자가 콘텐츠 작성에만 집중할 수 있는 환경을 만들 수 있었다.

즉, 이제 블로그 업데이트를 게을리할 핑계가 사라졌다는 뜻이다. 훌륭한... 일인가?
