---
title: "How Constantly Taking on Hiroshi Abe's Homepage Led to an Incredible Website"
description: "The journey and technical insights of a self-proclaimed \"man with the fastest downstream homepage\" persistently challenging Hiroshi Abe's website"
summary: "After continuously challenging Hiroshi Abe's homepage, I built a site combining Astro, Alpine.js, AVIF images, and a one-year cache. On desktop Lighthouse, it scored a perfect 100 in both Performance and SEO. Fast is good, but user-friendly is even better."
pubDate: 2024-01-20
updatedDate: 2026-10-23
author: "Terisuke"
category: "engineering"
tags: ["Astro", "Alpine.js", "AVIF", "WebPerformance", "PageSpeed"]
image:
  url: "/images/blog/abe-hiroshi-hero.avif"
  alt: "Image of a high-performance website"
lang: "en"
featured: true
translationSourceHash: "649e508785eff7c26ae56890bbd4f262e1393be5a83304d7992bcf65cdef550c"
translatedAt: "2026-10-23T06:14:30.592Z"
translationModel: "gemini-3.8-flash"
---

# How Constantly Taking on Hiroshi Abe's Homepage Led to an Incredible Website

As the "self-proclaimed man with the fastest downhill homepage," I kept taking on Hiroshi Abe's website. As a result, I ended up creating a high-performance website that goes beyond just competing on speed. By the way, Hiroshi Abe's site is still fast today. All due respect.

![Developer Profile Image](/images/blog/k-terada.avif)

## Technology Stack Selection

### Why We Adopted Astro + Alpine.js

We chose this combination because it allows us to use JavaScript "only when and where it is needed." Astro removes unnecessary JavaScript as much as possible at build time, keeping pages lightweight. That said, without at least some animations like screen transitions, it feels lacking for a corporate website. Therefore, we used Alpine.js—an ultra-simple alternative to SPA tools like Vue, React, and Angular—to implement animations with the bare minimum of JavaScript.

### Image Optimization Strategy

Images are the heavy baggage of the modern web. That's why I adopted the modern image format, AVIF.

## Performance Optimization Results

We finally did it. On Lighthouse, Desktop Performance and SEO reached perfect scores.

- Lighthouse (Desktop): Performance 100, Accessibility 99, Best Practices 93, SEO 100
- Lighthouse (Mobile): Performance 95, Accessibility 99, Best Practices 93, SEO 100
- First Contentful Paint: Desktop 0.5s, Mobile 1.9s
- Largest Contentful Paint: Desktop 0.6s, Mobile 2.3s

## Cache-Control Strategy

Cache is our friend. With a 1-year (31,536,000 seconds) cache setting, images loaded once will not be reloaded for an entire year. It also saves users data bandwidth. Everyone wins.

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

Through this challenge, I learned the importance of designing websites with a focus on user experience, not just raw speed. Speed is great, but usability is even greater.
