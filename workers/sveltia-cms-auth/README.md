# workers/sveltia-cms-auth — Sveltia CMS Authenticator（上流コードの取り込み）

CMS の管理画面（https://cor-jp-cms-admin.web.app/ 、ADR-0018・#329）の「GitHub にログイン」を仲介する Cloudflare Worker。
GitHub OAuth App の client secret をブラウザに出さずにアクセストークンを受け取り、
`ALLOWED_DOMAINS`（`wrangler.toml` の `[vars]`、`cor-jp-cms-admin.web.app` だけ）のホストで開かれた CMS にだけ渡す。

## 上流

| 項目 | 値 |
|---|---|
| リポジトリ | https://github.com/sveltia/sveltia-cms-auth |
| コミット | `4fd08b5d4e009a85fa473fd523824ca9dfee9533`（main、2026-09-21「Update dependencies」） |
| ライセンス | MIT（Copyright (c) 2026 Kohei Yoshino）。全文は `LICENSE.txt` |

- `src/index.js` と `LICENSE.txt` は上流のファイルそのまま。git の blob SHA が上流と一致する
  （`src/index.js` = `8c4c3beb721245c30b43e8b5e8444be7038f1789`、`LICENSE.txt` = `0d1f75bec76122bd15bcdf7a895119b2fe5a7f71`）。
- 変えたのは `wrangler.toml`（`name`・`account_id`・`workers_dev`・`[vars]`・コメント）と、この README だけ。
- `ALLOWED_DOMAINS` は secret ではなく `[vars]` に置く。値を git で確認でき、デプロイのたびにこの値で上書きされる。
  `cms/firebase.json` の `hosting.site` との一致は `src/config/__tests__/cms-config.test.ts` が検査する。
- 上流の `package.json`・`pnpm-lock.yaml`・lint 設定は取り込まない。Worker は外部パッケージを使わず、デプロイは wrangler だけで足りる。
- ルートの `tsconfig.json`（`exclude` に `workers`）・`astro check`・vitest（`src/**` のみ）の対象外。

## 取り込み直すとき

```bash
SHA=$(gh api repos/sveltia/sveltia-cms-auth/commits/main --jq .sha)
gh api "repos/sveltia/sveltia-cms-auth/contents/src/index.js?ref=$SHA" --jq .content | base64 -d > workers/sveltia-cms-auth/src/index.js
gh api "repos/sveltia/sveltia-cms-auth/contents/LICENSE.txt?ref=$SHA" --jq .content | base64 -d > workers/sveltia-cms-auth/LICENSE.txt
git diff -- workers/sveltia-cms-auth   # 差分を読んでから、上の表のコミットと blob SHA を書き換える
```

上流の `wrangler.toml` の `compatibility_date` が変わっていたら、こちらの `wrangler.toml` にも合わせる。

## デプロイと設定

手順は `docs/cms-sveltia.md` の「管理者向けセットアップ」。要点だけ:

```bash
cd workers/sveltia-cms-auth
npx wrangler@4.135.0 deploy                           # 上流が固定している wrangler の版。ALLOWED_DOMAINS もここで入る
npx wrangler@4.135.0 secret put GITHUB_CLIENT_ID
npx wrangler@4.135.0 secret put GITHUB_CLIENT_SECRET
```

`ALLOWED_DOMAINS` を空・`*` 入り・プレビューチャネルのホストにしない。上流の Worker は空だと、どのサイトで開かれた CMS にもトークンを渡す。
