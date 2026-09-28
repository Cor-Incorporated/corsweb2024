# Cor.inc Corporate Website

高速化を極限まで追求したコーポレートサイト。阿部寛のホームページと同等かそれ以上の読み込み速度を実現。AI駆動のブログシステムを統合し、日本語から英語・中国語・韓国語・スペイン語への自動翻訳機能を提供。

## 🚀 デモ

- Production: <https://corweb.co.jp/>
- Staging: <https://cor-jp.com/>

## 📊 パフォーマンス指標

- **First Contentful Paint (FCP)**: < 0.5秒
- **Largest Contentful Paint (LCP)**: < 1.0秒
- **Total Blocking Time (TBT)**: 0ms
- **Cumulative Layout Shift (CLS)**: 0
- **Speed Index**: < 1.0秒

## 🏗️ 技術スタック

- **Framework**: Astro 4.8.7 (Islands Architecture)
- **Interactivity**: Alpine.js 3.14（npm からバンドル。CDN 非依存）
- **Styling**: Tailwind CSS + @tailwindcss/typography
- **Hosting**: Firebase Hosting
- **Language**: TypeScript
- **i18n**: 5言語対応（日本語、英語、中国語、韓国語、スペイン語）
- **AI Translation**: Google Generative AI (Gemini 1.5 Flash)
- **Content Management**: Astro Content Collections with Zod
- **YouTube Integration**: YouTube Data API v3 for dynamic video content

## 🤖 新機能: AI駆動ブログシステム

### 自動翻訳機能
- **日本語 → 4言語**: Gemini APIで英語・中国語・韓国語・スペイン語への高品質自動翻訳
- **一括翻訳**: 全言語への同時翻訳対応
- **バッチ処理**: 全記事の一括翻訳対応
- **メタデータ保持**: frontmatterとマークダウン構造を完全保持

### ブログ機能
- **Content Collections**: 型安全なコンテンツ管理
- **SEO最適化**: 自動OGP画像生成、構造化データ
- **リッチマークダウン**: 数式(KaTeX)、コードハイライト、自動リンクカード生成
- **インタラクティブ機能**: 目次、シェアボタン、投げ銭機能
- **投げ銭システム**: Stripe Payment Linkによる安全な投げ銭機能（自由金額設定可能）

### 翻訳コマンド

```bash
# 単一記事を全4言語に翻訳
node scripts/translate-blog-all-languages.js src/content/blog/ja/your-post.md

# 単一記事を特定言語に翻訳
node scripts/translate-blog-multi.js zh src/content/blog/ja/your-post.md
# 言語オプション: en (英語), zh (中国語), ko (韓国語), es (スペイン語)

# 英語のみに翻訳（レガシー）
node scripts/translate-blog.js src/content/blog/ja/your-post.md

# 全記事を英語に一括翻訳（レガシー）
node scripts/translate-all-blog.js

# 環境変数設定が必要
# .env ファイルに GEMINI_API_KEY を設定
```

## ⚡ 高速化の工夫（詳細）

### 1. 画像最適化
- **AVIF形式の採用**: WebPよりさらに高圧縮率のAVIF形式を全面採用
- **レスポンシブ画像**: 複数サイズを用意（例: hero-480w.avif, hero-800w.avif）
- **遅延読み込み**: ビューポート外の画像は遅延読み込み
- **画像圧縮**: astro-compressで追加圧縮（平均60%削減）

### 2. アセット配信の最適化
- **自己ホスト**: Alpine.js は npm からバンドルし同一オリジンで配信（外部 CDN の遮断・遅延で白紙にならない）
- **DNS Prefetch**: 外部リソースのDNS解決を事前実行
  ```html
  <link rel="dns-prefetch" href="//fonts.gstatic.com">
  <link rel="dns-prefetch" href="//ssgform.com">
  ```
- **長期キャッシュ**: Firebase設定で静的アセットは1年間キャッシュ

### 3. JavaScript最適化
- **Islands Architecture**: Astroの部分的ハイドレーション
- **遅延実行**: Alpine.js はモジュールスクリプト（defer 相当）で実行。`<html>` に x-cloak を付けないため起動前でも本文を描画
- **インライン初期化**: ダークモード設定は `<head>` のインラインで即座に実行（ちらつき防止。View Transitions 後も再適用）
- **最小限のバンドル**: 必要な機能のみを含む軽量実装

### 4. CSS最適化
- **Critical CSS**: 初期表示に必要なCSSはインライン化
- **Font Display**: `font-display: optional`でフォント読み込みをブロッキングしない
- **システムフォント**: 初期表示はシステムフォント、Inter読み込み後に切り替え
- **Tailwind CSS**: 使用クラスのみをビルド時に抽出

### 5. HTML/コンテンツ最適化
- **HTML圧縮**: astro-compressで不要な空白を削除（平均10%削減）
- **Gzip/Brotli圧縮**: astro-compressorで全アセットを圧縮配信
- **View Transitions API**: ページ遷移をスムーズに（プリフェッチ機能付き）

### 6. ビルド時最適化
- **静的サイト生成**: 全ページを事前ビルド
- **TypeScript型チェック**: ビルド時に型安全性を保証
- **バンドル分析**: bundle-analyzer.jsで不要なコードを検出・削除

### 7. SEO最適化
- **構造化データ**: JSON-LDで企業情報を提供（会社名バリエーション含む）
- **メタタグ最適化**: Open Graph、Twitter Card対応
- **Sitemap自動生成**: @astrojs/sitemapで検索エンジン最適化
- **多言語対応**: 5言語でSEO最適化（日本語、英語、中国語、韓国語、スペイン語）
- **ブログSEO**: 自動OGP画像、hreflangタグ、パンくずリスト

## 🛠️ 開発環境

```bash
# 開発サーバー起動
npm run dev

# ビルド（型チェック含む）
npm run build

# プロダクションプレビュー
npm run preview

# バンドル分析
node bundle-analyzer.js

# ブログ翻訶全言語翻訳
node scripts/translate-blog-all-languages.js src/content/blog/ja/your-post.md
# 特定言語への翻訳
node scripts/translate-blog-multi.js zh src/content/blog/ja/your-post.md
```

### 環境変数設定

```bash
# .env ファイルに以下を設定
GEMINI_API_KEY=your_gemini_api_key_here              # Gemini APIキー（ブログ自動翻訳用）
PUBLIC_STRIPE_PAYMENT_LINK=your_stripe_payment_link_here  # Stripe Payment Link URL（投げ銭機能用）
PUBLIC_YOUTUBE_API_KEY=your_youtube_api_key_here     # YouTube Data API v3キー（動画ランダム表示用）
```

## 📁 プロジェクト構成

```
src/
├── components/       # ページ別・機能別コンポーネント
│   ├── blog/        # ブログ専用コンポーネント
│   ├── home/        # ホームページコンポーネント
│   ├── layout/      # 共通レイアウト
│   ├── products/    # プロダクト紹介コンポーネント
│   └── youtube/     # YouTube API統合コンポーネント
├── content/         # コンテンツコレクション
│   └── blog/
│       ├── ja/      # 日本語ブログ記事（ソース）
│       ├── en/      # 英語ブログ記事（自動翻訳）
│       ├── zh/      # 中国語ブログ記事（自動翻訳）
│       ├── ko/      # 韓国語ブログ記事（自動翻訳）
│       └── es/      # スペイン語ブログ記事（自動翻訶）
├── i18n/           # 多言語対応ファイル
├── layouts/        # レイアウトコンポーネント
├── pages/          # ルーティングページ
├── utils/          # ユーティリティ関数
└── types/          # TypeScript型定義

scripts/            # 自動化スクリプト
├── translate-blog-all-languages.js  # 单一記事ₒ全4言語に翻訳
├── translate-blog-multi.js         # 単一記事を指定言語に翻訳
├── translate-blog.js               # 単一記事英語翻訳（レガシー）
└── translate-all-blog.js          # 全記事英語一括翻訳（レガシー）
```

## 📝 ブログ投稿の流れ

1. **日本語記事作成**: `/src/content/blog/ja/` に Markdown ファイルを作成
2. **リッチコンテンツ活用**: リンクカード、数式、コードハイライトを活用
3. **自動翻訳実行**: `node scripts/translate-blog-all-languages.js` で全4言語版を同時生成
4. **内容確認**: 翻訳された各言語記事の内容を確認・調整（オプション）
5. **デプロイ**: Firebase Hosting に自動デプロイ

## ✨ サポートされているマークダウン機能

### 基本記法
- **GitHub Flavored Markdown**: 表、取り消し線、タスクリスト
- **コードハイライト**: 30以上の言語対応（Dracula テーマ）
- **数式表示**: KaTeX による LaTeX 記法サポート

### リッチリンクカード
```markdown
https://cor-jp.com/
https://github.com
```
- **自動メタデータ取得**: タイトル、説明文、OG画像を自動取得
- **キャッシュ機能**: `/public/remark-link-card-plus/` にローカル保存
- **レスポンシブデザイン**: デスクトップ・モバイル両対応
- **ダークモード対応**: テーマ切り替えに自動追従

### YouTube統合
- **動的コンテンツ**: YouTube Data API v3によるランダム動画表示
- **チャンネル統合**: Cor.Incorporated公式チャンネルと連携
- **自動更新**: 新しい動画が自動的に表示候補に追加

### 高度な機能
- **自動目次生成**: 見出し構造から自動生成
- **アンカーリンク**: 見出しに自動的にリンクアンカーを追加
- **構造化データ**: SEO向けのJSON-LD自動生成
- **OGP画像**: 記事ごとの動的SVG画像生成

## 🎯 今後の改善点

- Service Workerによるオフライン対応
- Resource Hintsの追加最適化
- 画像のLazy Loading戦略の改善
- Core Web Vitals の実測値（Cloudflare Web Analytics）を改善に使う仕組み
- 翻訳精度のさらなる向上
- ブログ管理UI/CMSの実装
- 投げ銭履歴の管理機能
- 投げ銭者への特別コンテンツ提供

## 📚 参考資料

- [Astro Documentation](https://astro.build/)
- [Alpine.js Documentation](https://alpinejs.dev/)
- [Firebase Hosting](https://firebase.google.com/)
- [Web.dev Performance](https://web.dev/performance/)
- [Google Generative AI](https://ai.google.dev/)
- [阿部寛のホームページ](http://abehiroshi.la.coocan.jp/)

## 📝 ライセンス

MIT License
