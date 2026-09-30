---
title: "挑战阿部宽的官网后，我构建了一个超棒的网站"
description: "我自诩为“拥有最快下载速度的网站的男人”，一直以来都在挑战阿部宽的官网。结果，我构建了一个超越单纯速度竞争的、真正高性能的网站。顺带一提，阿部宽的网站至今仍然很快。致以敬意。"
pubDate: 2024-01-20
author: "Terisuke"
category: "engineering"
tags: ["Astro", "Alpine.js", "AVIF", "WebPerformance", "PageSpeed"]
image:
  url: "/images/blog/abe-hiroshi-hero.avif"
  alt: "高性能Webサイトのイメージ"
lang: "zh"
featured: true
translationSourceHash: "85871aef8ac9f5e6f95e4d9a1ce2058781b6b9ae5ea5ff7d34f3ba23b7574b4e"
translatedAt: "2026-09-28T06:09:16.006Z"
translationModel: "adopted-legacy"
---

# 挑战阿部宽的官网后，我构建了一个超棒的网站

我自诩为“拥有最快下载速度的网站的男人”，一直以来都在挑战阿部宽的官网。结果，我构建了一个超越单纯速度竞争的、真正高性能的网站。顺带一提，阿部宽的网站至今仍然很快。致以敬意。

![开发者个人资料图片](/images/blog/k-terada.avif)

## 技术栈的选择

### 为什么选择 Astro + Alpine.js

为什么是这个组合？答案很简单。它体现了“需要时才加载所需内容”的禅宗精神。React？太重了。Vue？还可以。但 Alpine.js？这是最轻量级的选择。

```astro
---
// Astro Islands 架构
import Hero from '../components/Hero.astro';
import ContactForm from '../components/ContactForm.vue';
---

<Layout title="超快速网站">
  <Hero />
  <!-- 只在需要时加载JavaScript -->
  <ContactForm client:load />
</Layout>
```

### 图片优化策略

图片是现代网页的沉重负担。所以我采用了最新的 AVIF 格式。它的文件大小只有 JPEG 的一半，但画质却毫无变化。这就像魔法一样，但这就是技术的进步。

```html
<!-- AVIF 格式的图片分发 -->
<picture>
  <source srcset="hero-480w.avif 480w, hero-800w.avif 800w" type="image/avif">
  <source srcset="hero-480w.webp 480w, hero-800w.webp 800w" type="image/webp">
  <img src="hero-800w.jpg" alt="主视觉图" loading="lazy">
</picture>
```

## 性能优化结果

我终于做到了。所有指标都取得了满分：

- **Lighthouse Score**: 100/100/100/100（完美！）
- **First Contentful Paint**: 0.3秒（眨眼之间）
- **Largest Contentful Paint**: 0.5秒（喝一口咖啡前就已加载完成）
- **Cumulative Layout Shift**: 0（纹丝不动）

## Cache-Control 策略

缓存是我的朋友。设置一年的缓存（31536000秒），一旦加载过的图片就不会再重复加载。这也能节省用户的流量。皆大欢喜。

```javascript
// Firebase Hosting 配置
{
  "headers": [
    {
      "source": "**/*.@(jpg|jpeg|gif|png|webp|avif)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "max-age=31536000, immutable"  // 一年缓存！
        }
      ]
    }
  ]
}
```

通过这次挑战，我学到了超越单纯“速度”的用户体验至上网站设计的重要性。结论：快是正义，但好用才是更大的正义。

*如果您对构建高性能网站感兴趣，欢迎通过[联系我们](/contact)进行咨询。让我们一起制作一个比阿部宽官网更快的网站吧（虽然可能很难，但值得尝试）。*
