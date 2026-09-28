# ADR-0002 ホスティングを Firebase App Hosting（cor-jp-web）＋Astro SSR に移行（静的SSGから）

## ステータス: Superseded by ADR-0017 (2026-09-27)

旧ステータス: Accepted (2026-06-13)。SSR 移行は実施されず、サイトは `firebase.json`（public: `dist`）の静的配信のまま。静的 Astro の継続を ADR-0017 で決定した。以下は当時の記録。

## 背景
- 現行は `firebase.json`（public: `dist`）の純静的 Hosting で、`.github/workflows/deploy.yml` が `projectId: cor-jp-web` ＋ `FIREBASE_SERVICE_ACCOUNT_COR_JP_WEB` で固定。ライブ `cor-jp-main.web.app` の稼働を確認済。
- StudioCMS（ADR-0001）は SSR を必須とするため、静的 SSG のままでは CMS のダッシュボード・API・動的ページを配信できない。
- `.firebaserc` の default が `corsweb-28db5`（未使用・社内アクセス不可の残骸）であり、deploy.yml の `cor-jp-web` と不一致＝実害。

## 決定
- ホスティング／ランタイムを **Firebase App Hosting（GCP `cor-jp-web`）＋ Astro SSR** に移行する。
- Astro を `output: 'server'` に切り替え、`@astrojs/node` standalone アダプタを導入。既存21ページには `prerender = true` を付与してハイブリッド運用する。
- `.firebaserc` の default を `corsweb-28db5` から **`cor-jp-web` に修正**し、`corsweb-28db5` 参照（etags 含む）を撤去してデプロイ先を1本化する。
- `apphosting.yaml` を新規作成し、runConfig（asia-northeast1）・env（PUBLIC_* は BUILD、機密は `valueFrom: secret` で RUNTIME 注入）を定義する。

## 理由
- App Hosting は GCP `cor-jp-web` 上で Astro SSR をネイティブに配信でき、Secret Manager 連携・自動ロールアウトが利用できる。
- Cloud Run / Functions を別途手組みするより、Astro SSR の標準デプロイ経路に乗れて運用が単純。
- 本番 Firebase プロジェクト＝`cor-jp-web` は既に deploy.yml で固定されており、権限（curated 8ロール）も付与済。

## 影響
- `firebase.json` の hosting ブロックを App Hosting backend への rewrite／再定義へ移行。旧 redirects（/pricing→/products 301）・cache headers（js/css/img immutable・html no-cache）を App Hosting／Astro レスポンス側で再現する必要がある。
- Cloudflare 前段の DNS/プロキシのオリジンを Firebase 静的 Hosting → App Hosting 新オリジンへ切替。二重CDN/キャッシュ衝突に注意（SSR HTML を CF が過剰キャッシュしない設定）。
- 移行中は現静的デプロイをフォールバックとして保持し、初回本番DBマイグレーションは手動承認ゲートを通す（ADR-0003／ADR-0005 と関連）。
- Docker 利用時は `--platform linux/amd64`。soak time は develop→main 半日、infra・migration は1営業日。
- git 追跡下の `.firebase/hosting.*.cache` を `.gitignore` に追加し追跡解除。

## 代替案
- **静的 SSG 継続**: StudioCMS の SSR 要件を満たせず却下。
- **Vercel / Cloudflare Pages へ全面移行**: GCP `cor-jp-web` の既存権限・Secret Manager・本番固定を捨てることになり、移行リスクとコストが大きいため却下。
- **Cloud Run を直接構築**: App Hosting の自動ロールアウト・Secret 注入の利便性を捨てる必要があり、当面は App Hosting を優先。

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
