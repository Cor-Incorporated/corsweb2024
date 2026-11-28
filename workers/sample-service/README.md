# 見本のサービス（sample service）

中央の利用権の台帳に載る、製品の側の見本の Worker。Clerk の session を確かめ、中央の
`POST /v2/entitlements/check` に問い合わせ、`open`・`view_only`・`read_export_only`・`closed`
の 4 つと、`view`・`edit`・`export` の可否を返す。DB も裏の処理も管理の画面も持たない。

## 道

| 道 | 動き |
|---|---|
| `GET /` | HTML の頁。Clerk JS を読み、同じ origin の `/api/access` を 3 回呼び、結果を画面に出す。login していなければ sign-in への link を出す。 |
| `GET /api/access?operation=view\|edit\|export` | Clerk の session を確かめ、中央へ 1 回だけ問い合わせて `{access, allowed}` を返す。 |
| それ以外 | 404。既知の道の他の method は 405。`/docs`・`/redoc`・`/openapi.json` のような説明の頁は作らない。 |

`GET /api/access` は `Authorization: Bearer <JWT>` か `__session` cookie を読む。JWT は
`CLERK_JWT_KEY` の公開鍵で RS256 だけを受け、`iss`・`azp`（`SITE_ORIGIN`）・`sub`・`sid`・
`v=2`・`sts` が `pending` でないこと・`exp`・`nbf` を確かめる。時計のずれは 60 秒まで許す。
`o.id` が在れば `org_...` の形だけを受け、中央の `organizationId` にそのまま渡す。

中央への要求は次の形。timeout は 2 秒、再試行はしない、redirect は追わない、200 以外・
壊れた JSON・4096 B を超える答えは閉じる。`Cache-Control: private, no-store` を付ける。

```json
{
  "service": "sample",
  "issuer": "https://clerk.cor-jp.com",
  "subject": "user_...",
  "tenantId": "sample",
  "organizationId": "org_..." ,
  "operation": "view"
}
```

`allowed` が真偽値で `access` が 4 つのどれかであっても、`allowed` がその `access` と操作の
対応と食い違うときは閉じる。答えは常に 200 の `{access, allowed}` で、閉じたときは
`{access: "closed", allowed: false}`。

| `access` | 閲覧 | 編集 | 書き出し |
|---|---|---|---|
| `open` | 可 | 可 | 可 |
| `view_only` | 可 | 不可 | 不可 |
| `read_export_only` | 可 | 不可 | 可 |
| `closed` | 不可 | 不可 | 不可 |

## Clerk JS の版

`6.46.3` に固定する。`@clerk/backend` `3.31.4` と同じ 2026-11-20 に公開され（backend が
22:22:20Z、clerk-js が 22:24:23Z）、この repo のルートが使っている版でもある。頁は
`${CLERK_ISSUER}/npm/@clerk/clerk-js@6.46.3/dist/clerk.browser.js` から読み、公開の CDN は
使わない。CSP の `script-src` は自分と `CLERK_ISSUER` だけにし、頁の中の script には
毎回の nonce を付ける。

publishable key は秘密ではなく、Frontend API の host だけを持つ。`CLERK_ISSUER` の host から
`pk_live_`（`*.clerk.accounts.dev` のときは `pk_test_`）を組み立てて頁に渡す。Clerk JS を
読めないときは `__session` cookie だけで同じ origin の API を呼ぶ。

## 設定と秘密

`wrangler.toml` の `[vars]` は `SITE_ORIGIN`・`CLERK_ISSUER`・`ENTITLEMENTS_URL`・
`SERVICE_ID`・`TENANT_ID`。秘密は次の 2 つで、`wrangler secret put` で置き、file には書かない。

- `CLERK_JWT_KEY`: Clerk の session token を確かめる公開鍵（PEM）
- `SAMPLE_ENTITLEMENT_QUERY_TOKEN`: 中央の照会の製品ごとの token

## 手元での確認

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm test
```

試験は Miniflare で Worker を起こし、中央は outbound の差し替えで返す。JWT は試験の中で
作った RSA の鍵で署名する。`node --test` が `test/sample-service.test.js` を流す。

配備せずに binding を確かめる:

```sh
npx --no -- wrangler deploy --dry-run --config wrangler.toml --outdir /tmp/cor-sample-service
```

## 当たらない試験

C-B（結び付け）と C-E7（裏の処理）は、この製品に DB と裏の処理が無いので当たらない。
