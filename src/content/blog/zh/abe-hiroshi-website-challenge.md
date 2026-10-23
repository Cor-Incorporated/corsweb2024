---
title: "不断挑战阿部宽的个人主页，最终打造出一个惊人网站的故事"
description: "作为“自称拥有最快下行速度主页的男人”，记录不断挑战阿部宽个人主页的历程与技术洞察"
summary: "我不断向阿部宽先生的主页发起挑战，结合 Astro、Alpine.js、AVIF 图像和长达 1 年的缓存技术搭建了一个网站。在 Lighthouse 桌面端评测中，Performance 和 SEO 均获得了满分。天下武功唯快不破，但易用才是终极的正义。"
pubDate: 2024-01-20
updatedDate: 2026-10-23
author: "Terisuke"
category: "engineering"
tags: ["Astro", "Alpine.js", "AVIF", "WebPerformance", "PageSpeed"]
image:
  url: "/images/blog/abe-hiroshi-hero.avif"
  alt: "高性能网站示意图"
lang: "zh"
featured: true
translationSourceHash: "649e508785eff7c26ae56890bbd4f262e1393be5a83304d7992bcf65cdef550c"
translatedAt: "2026-10-23T06:17:27.492Z"
translationModel: "gemini-3.8-flash"
---

# 不断挑战阿部宽的个人主页，最终打造出一个惊人网站的故事

作为“自称拥有最快下行速度主页的男人”，我屡次向阿部宽先生的主页发起挑战。结果，我打造出的不仅是一个单纯比拼速度的网站，更是一个高性能的网站。顺便提一句，阿部宽先生的网站至今依然很快，谨致敬意。

![开发者个人资料图片](/images/blog/k-terada.avif)

## 技术栈选型

### 采用 Astro + Alpine.js 的理由

选择这套组合的原因在于，它可以实现 JavaScript“在需要时按需取用”。Astro 能够在构建时尽可能剔除不必要的 JavaScript，从而让页面变得轻量。话虽如此，如果没有任何页面跳转等过渡动效，作为公司官网未免显得有些单调。因此，我们选用了作为 Vue、React、Angular 等 SPA 工具极简版的 Alpine.js，仅用最底限度的 JavaScript 实现了动效。

### 图像优化策略

图像是当今网络环境中的沉重负担。因此，我采用了新一代的图像格式 AVIF。

## 性能优化结果

终于大功告成。在 Lighthouse 测试中，桌面端的 Performance 和 SEO 均获得了满分。

- Lighthouse（桌面端）：Performance 100、Accessibility 99、Best Practices 93、SEO 100
- Lighthouse（移动端）：Performance 95、Accessibility 99、Best Practices 93、SEO 100
- First Contentful Paint：桌面端 0.5 秒，移动端 1.9 秒
- Largest Contentful Paint：桌面端 0.6 秒，移动端 2.3 秒

## Cache-Control 策略

缓存是我们的好帮手。通过设置 1 年（31536000 秒）的缓存，加载过一次的图像在 1 年内无需重新加载。这样既能节省用户的数据流量，也能让大家皆大欢喜。

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

通过这次挑战，我深刻体会到：设计网站不仅要追求速度，更要重视用户体验。速度固然是王道，但好用才是硬道理。
