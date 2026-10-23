---
title: "阿部寛のホームページに挑み続けたらすごいHPができた話"
description: "「自称下り最速のホームページを持つ男」として、阿部寛のホームページに挑戦し続けた軌跡と技術的洞察"
summary: "阿部寛さんのホームページに挑み続け、AstroとAlpine.js、AVIF画像、1年間のキャッシュを組み合わせたサイトを作った。Lighthouseのデスクトップでは、PerformanceとSEOが満点になった。速いは正義だが、使いやすいはもっと正義だ。"
pubDate: 2024-01-20
updatedDate: 2026-10-23
author: "Terisuke"
category: "engineering"
tags: ["Astro", "Alpine.js", "AVIF", "WebPerformance", "PageSpeed"]
image:
  url: "/images/blog/abe-hiroshi-hero.avif"
  alt: "高性能Webサイトのイメージ"
lang: "ja"
featured: true
---

# 阿部寛のホームページに挑み続けたらすごいHPができた話

「自称下り最速のホームページを持つ男」として、阿部寛さんのホームページに挑み続けた。その結果、速さを競うだけでは終わらない、性能の高いWebサイトができた。ちなみに阿部寛さんのサイトは今でも速い。敬意を表する。

![開発者プロフィール画像](/images/blog/k-terada.avif)

## 技術スタックの選定

### Astro + Alpine.js の採用理由

この組み合わせにしたのは、JavaScriptを「必要な時に必要な分だけ」使えるからだ。Astroはビルドのときに不必要なJavaScriptをなるべく排除して、ページを軽くできる。とはいえ、画面遷移など多少のアニメーションがないと、会社のホームページとしては物足りない。そこで、Vue、React、AngularなどのSPAツールの超シンプル版であるAlpine.jsを使い、必要最低限のJavaScriptでアニメーションを実装した。

### 画像最適化戦略

画像は今のWebの重い荷物だ。だから僕は、新しい画像形式のAVIFを採用した。

## パフォーマンス最適化の結果

ついにやった。Lighthouseでは、デスクトップのPerformanceとSEOが満点になった。

- Lighthouse（デスクトップ）: Performance 100、Accessibility 99、Best Practices 93、SEO 100
- Lighthouse（モバイル）: Performance 95、Accessibility 99、Best Practices 93、SEO 100
- First Contentful Paint: デスクトップ0.5秒、モバイル1.9秒
- Largest Contentful Paint: デスクトップ0.6秒、モバイル2.3秒

## Cache-Control戦略

キャッシュは友達だ。1年間（31536000秒）のキャッシュ設定で、一度読み込んだ画像は1年間読み込み直さない。ユーザーのデータ通信料も節約できる。みんなハッピーだ。

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

この挑戦を通じて、速さだけでなく、ユーザー体験を重視してWebサイトを設計することが大事だと学んだ。速いは正義だが、使いやすいはもっと正義だ。
