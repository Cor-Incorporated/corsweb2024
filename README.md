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
- **AI Translation**: Gemini API（`@google/genai`、既定モデル `gemini-3.8-flash`）を CI で実行（[docs/i18n-translation.md](docs/i18n-translation.md)）
- **Content Management**: Astro Content Collections with Zod
- **YouTube Integration**: YouTube Data API v3 for dynamic video content

## 🤖 新機能: AI駆動ブログシステム

### 自動翻訳機能
- **日本語だけ書けば 5 言語が揃う**: `src/content/{blog,news,cases}/ja` を編集した PR で、CI が英語・中国語・韓国語・スペイン語を自動翻訳してコミット（他言語は CI が専有）
- **差分翻訳**: ja の翻訳対象部分のハッシュ（`translationSourceHash`）で、未翻訳・古い翻訳だけを翻訳
- **壊さない検証**: コード・URL・数式・画像パスを保護し、見出し・リンク・画像などの構造とスキーマを検証。違反した翻訳は書き込まない
- 詳細: [docs/i18n-translation.md](docs/i18n-translation.md) / [ADR-0019](docs/adr/ADR-0019-i18n-auto-translation.md)

### ブログ機能
- **Content Collections**: 型安全なコンテンツ管理
- **SEO最適化**: 自動OGP画像生成、構造化データ
- **リッチマークダウン**: 数式(KaTeX)、コードハイライト、自動リンクカード生成
- **インタラクティブ機能**: 目次、シェアボタン、投げ銭機能
- **投げ銭システム**: Stripe Payment Linkによる安全な投げ銭機能（自由金額設定可能）

### 翻訳コマンド

```bash
# 未翻訳・古い翻訳を一覧（API キー不要。問題があれば exit 1）
npm run i18n:check

# 何をするかだけ表示（API も書き込みもしない）
npm run i18n:translate -- --dry-run

# 不足・古い翻訳を翻訳して書き込む（GEMINI_API_KEY が必要。.env は自動では読まない）
node --env-file=.env scripts/i18n/translate-content.mjs --write
# 1 記事・特定言語だけ
node --env-file=.env scripts/i18n/translate-content.mjs --write --only blog/your-post --langs zh
```

通常は PR 上の CI（`.github/workflows/translate-content.yml`）が自動で翻訳するため、手元での実行は不要です。

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

# 翻訳の検査 / 翻訳（docs/i18n-translation.md）
npm run i18n:check
npm run i18n:translate -- --dry-run
```

### 環境変数設定

```bash
# .env ファイルに以下を設定
GEMINI_API_KEY=your_gemini_api_key_here              # Gemini APIキー（ローカルで翻訳するときのみ。CI は GitHub secret を使用）
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
└── i18n/           # ja → en/zh/ko/es の差分翻訳・検証（translate-content.mjs）
```

## 📝 ブログ投稿の流れ

1. **日本語記事作成**: `/src/content/blog/ja/` に Markdown ファイルを作成
2. **リッチコンテンツ活用**: リンクカード、数式、コードハイライトを活用
3. **PR を作成**: CI が en/zh/ko/es を自動翻訳して同じ PR にコミット（`i18n-check` で欠けを検査）
4. **内容確認**: PR の差分で各言語の訳を確認（訳を直したいときは ja 側の表現を調整）
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
