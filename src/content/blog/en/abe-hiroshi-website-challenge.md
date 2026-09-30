---
title: "The Story of How I Kept Challenging Abe Hiroshi's Homepage and Made an Amazing One"
description: "The journey and technical insights of continuing to challenge Abe Hiroshi's homepage, as a \"man who claims to have the fastest descending homepage.\""
pubDate: 2024-01-20
author: "Terisuke"
category: "engineering"
tags: ["Astro", "Alpine.js", "AVIF", "WebPerformance", "PageSpeed"]
image:
  url: "/images/blog/abe-hiroshi-hero.avif"
  alt: "高性能Webサイトのイメージ"
lang: "en"
featured: true
translationSourceHash: "85871aef8ac9f5e6f95e4d9a1ce2058781b6b9ae5ea5ff7d34f3ba23b7574b4e"
translatedAt: "2026-09-28T06:09:15.997Z"
translationModel: "adopted-legacy"
---

# The Story of How I Built an Amazing Website by Continuously Challenging Hiroshi Abe's Homepage

As the "man who claims to have the fastest homepage," I persistently challenged Hiroshi Abe's website. The result was not just a speed competition, but the birth of a truly high-performance web experience. By the way, Hiroshi Abe's site is still fast today. I offer my respect.

![Developer Profile Image](/images/blog/k-terada.avif)

## Selecting the Technology Stack

### Why Astro + Alpine.js?

Why this combination? The answer is simple. It embodies the Zen spirit of "only what you need, when you need it." React? Heavy. Vue? Okay. But Alpine.js? That was the lightest answer.

```astro
---
// Astro Islands Architecture
import Hero from '../components/Hero.astro';
import ContactForm from '../components/ContactForm.vue';
---

<Layout title="Ultra Fast Website">
  <Hero />
  <!-- Load JavaScript only where needed -->
  <ContactForm client:load />
</Layout>
```

### Image Optimization Strategy

Images are the heavy burden of the modern web. That's why I adopted the latest AVIF format. It's half the size of JPEG with no compromise in image quality. It's like magic, but this is technological progress.

```html
<!-- Image delivery in AVIF format -->
<picture>
  <source srcset="hero-480w.avif 480w, hero-800w.avif 800w" type="image/avif">
  <source srcset="hero-480w.webp 480w, hero-800w.webp 800w" type="image/webp">
  <img src="hero-800w.jpg" alt="Hero image" loading="lazy">
</picture>
```

## Performance Optimization Results

I finally did it. I achieved perfect scores across the board:

- **Lighthouse Score**: 100/100/100/100 (Perfect!)
- **First Contentful Paint**: 0.3 seconds (Too fast to blink)
- **Largest Contentful Paint**: 0.5 seconds (Loaded before you can take a sip of coffee)
- **Cumulative Layout Shift**: 0 (Not a single pixel moved)

## Cache-Control Strategy

Caching is your friend. With a cache setting of one year (31,536,000 seconds), images once loaded will never be loaded again. This also saves users' data costs. Everyone is happy.

```javascript
// Firebase Hosting Configuration
{
  "headers": [
    {
      "source": "**/*.@(jpg|jpeg|gif|png|webp|avif)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "max-age=31536000, immutable"  // Cache for 1 year!
        }
      ]
    }
  ]
}
```

Through this challenge, I learned the importance of designing websites that prioritize user experience beyond mere "speed." Conclusion: Speed is justice, but usability is even greater justice.

*If you're interested in building a high-performance website, please consult with me via the [Contact](/contact) page. Let's build a site faster than Hiroshi Abe's together (it might be impossible, but it's worth the challenge).*
