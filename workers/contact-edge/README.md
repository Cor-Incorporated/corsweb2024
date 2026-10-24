# cor-contact-edge

`cor-jp.com/contact/chat` とその配下だけをCloudia Pagesへプロキシする、段階移行用のCloudflare Workerです。
`/api/contact/*` は別の `cor-contact-chat` Workerが担当し、その他のcorswebページは既存Firebase Hostingへそのまま流れます。

## 安全な切替

`CONTACT_ORIGIN` は `firebase`（既定）または `pages` のみを受け付けます。Pagesを有効化しても、Pagesが5xx・404・通信失敗の場合はFirebaseへ一度だけフォールバックします。

Node.js 22.12 以上で実行する（wrangler 4 は Node.js 22 以上、vitest 5 は 22.12 以上を求める）。

```bash
cd workers/contact-edge
npm ci
npm run typecheck
npm test
# --env="" は最上位の環境（本番）を明示する。付けなくても本番に出るが、
# wrangler 4 は [env.preview] があると --env の無い deploy に警告を出す。
npx wrangler deploy --env=""

# PagesのPreview検証後に本番をCloudiaへ切替（DNS変更は不要）
npx wrangler deploy --env="" --var CONTACT_ORIGIN:pages

# 即時ロールバック
npx wrangler deploy --env="" --var CONTACT_ORIGIN:firebase
```

`CLOUDIA_PAGES_ORIGIN` はCloudia Pagesのoriginです。Pagesをルート配信する構成では、Workerが `/contact/chat` のプレフィックスを取り除いてPagesへ転送します。Cloudiaのビルド成果物が `/contact/chat/` をbaseとして生成される場合は、Pages側の公開パス設計と合わせてから切り替えてください。`FIREBASE_ORIGIN` はロールバック用の `https://cor-jp-main.web.app` を維持します。

本番切替前に、GET `/contact/chat/`、静的asset、GET `/api/contact/health`、既存 `/`・`/about`・`/contact/` の疎通を確認してください。DNSの切替やFirebase停止はこのWorkerのWaveには含めません。
