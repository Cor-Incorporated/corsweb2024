---
title: "아베 히로시의 홈페이지에 끊임없이 도전했더니 엄청난 홈페이지가 완성된 이야기"
description: "'자칭 다운로드 최고속 홈페이지를 가진 남자'로서 아베 히로시의 홈페이지에 지속적으로 도전했던 궤적과 기술적 인사이트"
summary: "아베 히로시 씨의 홈페이지에 끊임없이 도전하여 Astro와 Alpine.js, AVIF 이미지, 1년간의 캐시를 결합한 사이트를 제작했습니다. Lighthouse 데스크톱에서는 Performance와 SEO에서 만점을 받았습니다. 빠른 것은 정의이지만, 사용하기 편리한 것은 더욱 큰 정의입니다."
pubDate: 2024-01-20
updatedDate: 2026-10-23
author: "Terisuke"
category: "engineering"
tags: ["Astro", "Alpine.js", "AVIF", "WebPerformance", "PageSpeed"]
image:
  url: "/images/blog/abe-hiroshi-hero.avif"
  alt: "고성능 웹사이트 이미지"
lang: "ko"
featured: true
translationSourceHash: "649e508785eff7c26ae56890bbd4f262e1393be5a83304d7992bcf65cdef550c"
translatedAt: "2026-10-23T06:20:39.420Z"
translationModel: "gemini-3.8-flash"
---

# 아베 히로시의 홈페이지에 끊임없이 도전했더니 엄청난 홈페이지가 완성된 이야기

'자칭 다운로드 속도 최강의 홈페이지를 가진 남자'로서, 아베 히로시 씨의 홈페이지에 끊임없이 도전했다. 그 결과, 단순히 속도를 겨루는 데서 끝나지 않고 뛰어난 성능을 갖춘 웹사이트가 탄생했다. 덧붙이자면 아베 히로시 씨의 사이트는 지금도 여전히 빠르다. 경의를 표한다.

![개발자 프로필 이미지](/images/blog/k-terada.avif)

## 기술 스택 선정

### Astro + Alpine.js 채택 이유

이 조합을 선택한 이유는 JavaScript를 '필요할 때 필요한 만큼만' 사용할 수 있기 때문이다. Astro는 빌드 시 불필요한 JavaScript를 최대한 배제하여 페이지를 가볍게 만들 수 있다. 그렇다고는 해도 화면 전환 등 어느 정도의 애니메이션이 없으면 회사 홈페이지로서는 다소 아쉬움이 남는다. 그래서 Vue, React, Angular 같은 SPA 툴의 초심플 버전인 Alpine.js를 활용해 최소한의 JavaScript로 애니메이션을 구현했다.

### 이미지 최적화 전략

이미지는 오늘날 웹의 무거운 짐이다. 그래서 나는 새로운 이미지 형식인 AVIF를 채택했다.

## 성능 최적화 결과

마침내 해냈다. Lighthouse에서 데스크톱의 Performance와 SEO 만점을 달성했다.

- Lighthouse(데스크톱): Performance 100, Accessibility 99, Best Practices 93, SEO 100
- Lighthouse(모바일): Performance 95, Accessibility 99, Best Practices 93, SEO 100
- First Contentful Paint: 데스크톱 0.5초, 모바일 1.9초
- Largest Contentful Paint: 데스크톱 0.6초, 모바일 2.3초

## Cache-Control 전략

캐시는 친구다. 1년(31,536,000초)의 캐시 설정으로 한 번 불러온 이미지는 1년 동안 다시 불러오지 않는다. 사용자의 데이터 통신료도 절약할 수 있다. 모두에게 좋은 일이다.

```javascript
// Firebase Hosting設定
{
  "headers": [
    {
      "source": "**/*.@(jpg|jpeg|gif|png|webp|avif)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "max-age=31536000, immutable"  // 1年間のキャッシュ！
        }
      ]
    }
  ]
}
```

이번 도전을 통해 속도뿐만 아니라 사용자 경험을 중시하여 웹사이트를 설계하는 것이 중요하다는 점을 배웠다. 빠른 것은 정의이지만, 쓰기 편한 것은 더욱 정의다.
