---
title: "아베 히로시의 홈페이지에 계속 도전했더니 굉장한 HP가 만들어진 이야기"
description: "\"자칭 내리막길 최고 속도의 홈페이지를 가진 남자\"로서, 아베 히로시의 홈페이지에 계속 도전한 궤적과 기술적 통찰"
pubDate: 2024-01-20
author: "Terisuke"
category: "engineering"
tags: ["Astro", "Alpine.js", "AVIF", "WebPerformance", "PageSpeed"]
image:
  url: "/images/blog/abe-hiroshi-hero.avif"
  alt: "高性能Webサイトのイメージ"
lang: "ko"
featured: true
translationSourceHash: "85871aef8ac9f5e6f95e4d9a1ce2058781b6b9ae5ea5ff7d34f3ba23b7574b4e"
translatedAt: "2026-09-28T06:09:16.013Z"
translationModel: "adopted-legacy"
---

# 아베 히로시 웹사이트에 계속 도전했더니 놀라운 웹사이트가 탄생한 이야기

"스스로 '내리막길 최속' 웹사이트를 가졌다"고 자칭하는 남자로, 아베 히로시 씨의 웹사이트에 계속 도전했습니다. 그 결과, 단순한 속도 경쟁을 넘어선 진정한 고성능 웹사이트가 탄생했습니다. 참고로 아베 히로시 씨의 사이트는 지금도 빠릅니다. 경의를 표합니다.

![개발자 프로필 이미지](/images/blog/k-terada.avif)

## 기술 스택 선정

### Astro + Alpine.js 채택 이유

왜 이 조합인가? 답은 간단합니다. "필요한 때 필요한 만큼만"이라는 선(禅)의 정신을 체현했기 때문입니다. React? 무겁습니다. Vue? 괜찮습니다. 하지만 Alpine.js? 이것이 가장 가벼운 답이었습니다.

```astro
---
// Astro Islands Architecture
import Hero from '../components/Hero.astro';
import ContactForm from '../components/ContactForm.vue';
---

<Layout title="Ultra Fast Website">
  <Hero />
  <!-- 필요한 부분만 JavaScript 로드 -->
  <ContactForm client:load />
</Layout>
```

### 이미지 최적화 전략

이미지는 현대 웹의 무거운 짐입니다. 그래서 저는 최신 AVIF 형식을 채택했습니다. JPEG의 절반 크기이면서 화질은 변하지 않습니다. 마법 같지만, 이것이 기술의 발전입니다.

```html
<!-- AVIF 형식으로 이미지 제공 -->
<picture>
  <source srcset="hero-480w.avif 480w, hero-800w.avif 800w" type="image/avif">
  <source srcset="hero-480w.webp 480w, hero-800w.webp 800w" type="image/webp">
  <img src="hero-800w.jpg" alt="Hero image" loading="lazy">
</picture>
```

## 성능 최적화 결과

해냈습니다. 모든 점수에서 만점을 기록했습니다:

- **Lighthouse Score**: 100/100/100/100 (완벽합니다!)
- **First Contentful Paint**: 0.3초 (눈 깜짝할 사이)
- **Largest Contentful Paint**: 0.5초 (커피 한 모금 마시기 전에 로딩 완료)
- **Cumulative Layout Shift**: 0 (전혀 움직이지 않습니다)

## Cache-Control 전략

캐시는 친구입니다. 1년(31,536,000초)의 캐시 설정으로, 한 번 로드한 이미지는 다시 로드하지 않습니다. 사용자의 데이터 통신료도 절약할 수 있습니다. 모두가 행복합니다.

```javascript
// Firebase Hosting 설정
{
  "headers": [
    {
      "source": "**/*.@(jpg|jpeg|gif|png|webp|avif)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "max-age=31536000, immutable"  // 1년간 캐시!
        }
      ]
    }
  ]
}
```

이 도전을 통해 단순한 '속도'를 넘어 사용자의 경험을 중시한 웹사이트 설계의 중요성을 배웠습니다. 결론: 빠름은 정의지만, 사용하기 쉬움은 더 큰 정의입니다.

*고성능 웹사이트 구축에 관심 있으신 분은 [문의](/contact)를 통해 상담해 주세요. 아베 히로시 씨보다 빠른 사이트를 함께 만들어 봅시다 (어려울 수도 있지만, 도전할 가치는 있습니다).*
