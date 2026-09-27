# ブログ CMS（Sveltia CMS）の使い方とセットアップ

ADR-0018（#329）で採用した Sveltia CMS の、編集者向けの使い方と、管理者向けのセットアップ手順です。

- 管理画面: **https://cor-jp-cms.web.app/** （公開サイト cor-jp.com とは別の Firebase Hosting サイト・別オリジン。main からだけ配信）
- 編集できるもの: ブログの **日本語の記事だけ**（`src/content/blog/ja/`）。英語・中国語・韓国語・スペイン語は、翻訳 CI（#339 のマージ後）が自動で作ります（ADR-0019）。
- 仕組み: 保存すると GitHub に develop 宛の PR（プルリクエスト）ができ、「公開」でその PR が develop に取り込まれます。本番（cor-jp.com）には、次の develop → main のリリースで反映されます。
- 前提の PR とマージ順: #329（ADR）→ #341（develop 宛 PR のプレビュー）→ #342（この CMS）。

---

## 1. 編集者向け

### 1-1. 用意するものと、ログインで渡す権限

| もの | 内容 |
|---|---|
| GitHub のアカウント | 管理者に伝えて、リポジトリ `Cor-Incorporated/corsweb2024` に **Write** 権限で招待してもらう。届いた招待メールで「Accept」を押す |
| ブラウザ | Chrome / Edge / Safari の最新版。日本語設定なら画面は日本語で出る |

ログインすると、CMS はあなたの GitHub のトークンを受け取り、このブラウザの CMS（cor-jp-cms.web.app）の中に保存します。

- トークンの範囲は `public_repo,user` です。**あなたが書き込める全ての公開リポジトリ**（このリポジトリ以外も含む）へのコードの書き込み・共同編集者の追加などと、プロフィールの読み書きに及びます。
- トークンに期限はありません。使い終わったら右上のアカウントメニューから「ログアウト」してください（ブラウザからトークンが消えます）。共用の PC では必ずログアウトしてください。
- 2026-09-28 時点で、このリポジトリに書き込めるアカウント（terisuke・nagi0705・kisayama0725・cloudia-Cor）は **全員が admin** です。admin のアカウントのトークンが漏れると、公開リポジトリの共同編集者の追加なども行えてしまいます。編集だけの人は、admin ではない Write だけのアカウントで使ってください。
- CMS の配信元を公開サイトと分けているのは、このトークンを公開サイトの外部スクリプトから読まれないようにするためです（ADR-0018）。

### 1-2. 管理画面の URL

**https://cor-jp-cms.web.app/** だけを使います（`cor-jp-cms.firebaseapp.com` や cor-jp.com の下では使えません）。

認証の仕組み（Worker と GitHub の OAuth App）が用意できるまでは、画面は開いても「GitHub にログイン」が失敗します（2-1 の表の 5〜8）。

### 1-3. ログイン

1. 管理画面を開き、「**GitHub にログイン**」を押す。
2. 小さなウィンドウで GitHub の確認画面が出たら「Authorize」を押す（初回だけ）。
3. 左に「ブログ」と記事の一覧が出れば完了。

ウィンドウが開かないときは、ブラウザのポップアップブロックでこのサイトを許可してください。

### 1-4. 記事を書く

1. 左の「**ブログ**」→ 右上の「**新規作成**」。
2. 右側の「**スラッグ**」欄に、記事の URL の末尾を **英小文字・数字・ハイフン** で入れる。
   例: `ai-adoption-roadmap` → 公開後の URL は `https://cor-jp.com/blog/ai-adoption-roadmap/`。**作成後は変更できません。**
3. 左の欄を埋める（`*` は必須）。

   | 欄 | 書き方 |
   |---|---|
   | タイトル `*` | 記事の見出し。検索結果や SNS にもそのまま出る |
   | 概要 `*` | 記事一覧・検索結果・SNS に出る説明文。1〜2 文、改行なし |
   | 公開日 `*` | 最初は今日の日付が入っている |
   | 更新日 | 内容を大きく直したときだけ。普段は空のまま |
   | 著者 `*` | 最初は `Terisuke` |
   | カテゴリ `*` | AI / エンジニアリング / 創業 / ラボ から 1 つ |
   | タグ | 1 行に 1 つ。Enter で次の行 |
   | アイキャッチ画像 | 使うときだけ「アイキャッチ画像 を追加」にチェック → 画像と代替テキスト |
   | おすすめに表示 | トップ等のおすすめに出したいときだけ ON |
   | 本文 `*` | Markdown（`## 見出し`、`- 箇条書き` など）で書く（最初は「マークダウンで編集」が ON）。OFF にすると、Word のようなボタンでも書ける |

4. 右上の「**保存**」。ここで **下書きの PR** ができます（まだ公開されません）。

> 既存の記事を直すときは、本文を **Markdown のまま** 直してください。リッチテキストに切り替えると、数式・リンクカード・表などの書き方が自動で書き換わることがあります。
>
> 本文に `<script>`、`onerror=` などの属性、`javascript:` のリンク、許可していない `<iframe>` を書くと、PR のチェック（`content-safety.test.ts`）が落ちて公開できません。

### 1-5. 画像の入れ方

- **アイキャッチ**: 「アイキャッチ画像 を追加」にチェック →「参照」でファイルを選ぶ（ドラッグ＆ドロップ可）→「代替テキスト」に画像の説明を書く。
- **本文の中**: 先にアイキャッチ欄などでアップロードし、`![画像の説明](/images/blog/ファイル名.webp)` と書く。
- 使える形式は AVIF・WebP・JPEG・PNG・HEIC です。**SVG は使えません**（スクリプトを含められるため）。
- 写真（JPEG・PNG・HEIC）は、アップロード時に自動で **WebP・最大 1600px** に変換され、ファイル名も英数字に直されます。保存場所は `public/images/blog/` で、記事と同じ PR に入ります。
- 左上の「アセット」（画像の一覧画面）からの直接のアップロード・名前変更・削除はしないでください。develop は PR 必須なので、PR を通らない書き込みは失敗します（保護設定からの推定。未確認）。

### 1-6. レビューに送る → プレビューを見る → 公開

| 手順 | 画面での操作 | GitHub で起きること |
|---|---|---|
| レビューに送る | 保存後に出る確認で「**レビューを依頼**」（あとからでも、記事のステータスを「レビュー中」に変更） | PR にラベル `sveltia-cms/pending_review` が付く |
| プレビューを見る | 保存から数分後、「プレビューを確認中」が「**プレビューを見る**」に変わったら押す（#341 のマージ後） | PR ごとのプレビューサイト（Firebase、30 日で失効）で記事が開く |
| 翻訳が付く | 何もしなくてよい（#339 のマージ後） | 翻訳 CI が同じ PR に英・中・韓・西のファイルを追加する |
| チェックを待つ | PR の必須チェック 2 本（`h5-admission` と `Chromium visual text audit`）が緑になるまで待つ（visual text audit は約 13 分） | 緑になるまで develop に取り込めない |
| 公開 | **terisuke か cloudia-Cor** がステータスを「**公開可**」にして「**エントリーを公開**」 | PR が develop に merge commit で取り込まれ、作業ブランチ（`cms/blog/<スラッグ>`）は削除される |

- 公開（develop への取り込み）ができるのは **terisuke と cloudia-Cor の 2 アカウントだけ** です。develop のブランチ保護の push 制限で強制されていて、enforce_admins=true のため admin のアカウントにも適用されます。ほかのアカウントで「エントリーを公開」を押すと失敗します。
- 公開 = develop への取り込みです。**cor-jp.com に出るのは、次の develop → main のリリースの後** です。

### 1-7. この CMS でできないこと（PoC の範囲）

- 記事の削除（翻訳ファイルと一緒に消す必要があるため、エンジニアに依頼）
- 公開後のスラッグ（URL）の変更
- 英語などほかの言語の記事、ニュース・事例の編集

---

## 2. 管理者向けセットアップ

### 2-1. 全体の流れ・担当・状態（2026-09-28 時点）

| # | 作業 | 担当 | CLI で可能か | 状態 |
|---|---|---|---|---|
| 1 | Firebase Hosting サイト `cor-jp-cms` を作る（プロジェクト `cor-jp-web`） | CEO 承認・実施済み | 可 | **済**。`firebase hosting:sites:list --project cor-jp-web` に cor-jp-cms / cor-jp-main / cor-jp-web の 3 件 |
| 2 | リポジトリ変数 `CMS_DEPLOY_ENABLED` | CEO 承認・実施済み | 可 | **済**。未設定 → `true`（2026-09-27T17:14:23Z） |
| 3 | develop のブランチ保護 | CEO 承認・実施済み | 可 | **済**。PR 必須・承認 0・必須チェック 2 本・enforce_admins=true・push は terisuke と cloudia-Cor だけ |
| 4 | #329 → #341 → #342 のマージ、develop → main のリリース | CEO（merge） | 可 | 未。main に入ると `deploy-cms.yml` が CMS を配信する |
| 5 | 認証 Worker をデプロイして URL を得る | エンジニア | 可（wrangler） | 未 |
| 6 | GitHub OAuth App を作る | CEO（組織オーナー） | 不可（GitHub の画面のみ） | 未 |
| 7 | Worker に Client ID / Client secret を登録 | Client secret: CEO / ほか: エンジニア | 可（wrangler） | 未 |
| 8 | `cms/public/config.yml` の `base_url` を Worker の URL に直す PR → develop → main | エンジニア | 可 | 未 |
| 9 | 編集者を Write 権限で招待する | エンジニア（誰を入れるかは CEO が決める） | 可（gh） | 未 |
| 10 | ブラウザでログイン〜公開まで通す（CSP 違反の確認を含む） | CEO | 不可（人の目視） | 未 |

`CMS_DEPLOY_ENABLED` は既に `true` なので、`deploy-cms.yml` が main に入った最初の push で CMS が配信されます。5〜8 が終わるまでは、管理画面は開いても **ログインだけが失敗** します。

各項目の現在値は次で確かめられます（読み取りのみ）。

```bash
gh variable list -R Cor-Incorporated/corsweb2024                    # CMS_DEPLOY_ENABLED  true
gh api repos/Cor-Incorporated/corsweb2024/branches/develop/protection \
  --jq '{enforce_admins: .enforce_admins.enabled, reviews: .required_pull_request_reviews.required_approving_review_count, checks: [.required_status_checks.checks[].context], push: [.restrictions.users[].login]}'
# {"enforce_admins":true,"reviews":0,"checks":["h5-admission","Chromium visual text audit"],"push":["terisuke","cloudia-Cor"]}
```

### 2-2. CMS の配信（`.github/workflows/deploy-cms.yml`）

| 項目 | 値 |
|---|---|
| 配信先 | Firebase Hosting サイト `cor-jp-cms`（プロジェクト `cor-jp-web`）、`https://cor-jp-cms.web.app/` |
| 起動 | main への push（`cms/**`・`package.json`・`package-lock.json`・このワークフローの変更時）と、main での手動実行 |
| 条件 | リポジトリ変数 `CMS_DEPLOY_ENABLED` が `true` |
| 手順 | `npm ci` → `npm run build:cms`（`cms/dist`）→ `npm run test:e2e:admin`（本番と同じヘッダーで CSP 違反 0 件）→ デプロイ |
| ヘッダー | `cms/firebase.json`（CSP・`X-Frame-Options: DENY`・`Cross-Origin-Opener-Policy: same-origin-allow-popups` など） |

```bash
# 手動で配信し直す（main のみ。ほかのブランチで実行してもジョブはスキップされる）
gh workflow run deploy-cms.yml --ref main -R Cor-Incorporated/corsweb2024
# 配信を止める（現在値 true → 設定値 false）
gh variable set CMS_DEPLOY_ENABLED --body false -R Cor-Incorporated/corsweb2024
# 配信されたヘッダーが cms/firebase.json の CSP と一致するか
curl -sI https://cor-jp-cms.web.app/ | grep -i '^content-security-policy'
node -e "console.log(require('./cms/firebase.json').hosting.headers[0].headers[0].value)"
```

### 2-3. 認証 Worker をデプロイする

コードは `workers/sveltia-cms-auth/`（上流 sveltia/sveltia-cms-auth をそのまま取り込み。詳細は同ディレクトリの README.md）。
Cloudflare のアカウントは Company@cor-jp.com（account_id `9973f2d2304b58a1f90d4d9409e9f8cc`、workers/contact-chat と同じ）。

トークンを渡す先 `ALLOWED_DOMAINS` は、`wrangler.toml` の `[vars]` に **`cor-jp-cms.web.app`（完全一致）** として置いてあり、デプロイで一緒に入ります。secret としては登録しません（値を git で確かめられるようにするため）。`cms/firebase.json` のサイト名との一致は `cms-config.test.ts` が検査しています。

```bash
cd workers/sveltia-cms-auth
npx wrangler@4.135.0 login     # Company@cor-jp.com のアカウントで（ログイン済みなら不要）
npx wrangler@4.135.0 deploy
```

出力の `https://cor-sveltia-cms-auth.<サブドメイン>.workers.dev` が **Worker の URL** です（以下 `<WORKER_URL>`）。

デプロイ直後（secret の登録前）の確認:

```bash
curl -s '<WORKER_URL>/auth?provider=github&site_id=cor-jp-cms.web.app&scope=public_repo,user' | grep -o 'MISCONFIGURED_CLIENT'
# MISCONFIGURED_CLIENT（CMS のホストは許可されている。Client ID / secret がまだ無い）
curl -s '<WORKER_URL>/auth?provider=github&site_id=cor-jp.com&scope=public_repo,user' | grep -o 'UNSUPPORTED_DOMAIN'
# UNSUPPORTED_DOMAIN（CMS 以外のホストには渡さない）
```

### 2-4. GitHub OAuth App を作る

GitHub で **Organization「Cor-Incorporated」→ Settings → Developer settings → OAuth Apps → New OAuth App**（個人アカウントに紐づけないため組織で作る）。

| 入力欄 | 値 |
|---|---|
| Application name | `Cor.inc コンテンツ管理（Sveltia CMS）` |
| Homepage URL | `https://cor-jp-cms.web.app/` |
| Application description | 空欄のまま |
| Authorization callback URL | `<WORKER_URL>/callback` （例: `https://cor-sveltia-cms-auth.example.workers.dev/callback`） |
| Enable Device Flow | チェックしない |

「Register application」→ 表示される **Client ID** を控える →「Generate a new client secret」→ 表示される **Client secret** を控える（この画面でしか見られない）。

組織で「OAuth app access restrictions」を有効にしている場合は、Organization settings → Third-party access → OAuth app policy で、このアプリを承認してください。

### 2-5. Worker に Client ID / Client secret を登録する

値はコードやチャットに貼らないでください。secret は再デプロイしても消えません。

| 名前 | 種類 | 現在値 → 設定する値 |
|---|---|---|
| `GITHUB_CLIENT_ID` | secret | 未設定 → 2-4 の Client ID |
| `GITHUB_CLIENT_SECRET` | secret | 未設定 → 2-4 の Client secret |
| `ALLOWED_DOMAINS` | `[vars]`（wrangler.toml） | 未デプロイ → `cor-jp-cms.web.app`（2-3 のデプロイで入る。登録作業は不要） |

```bash
cd workers/sveltia-cms-auth
npx wrangler@4.135.0 secret put GITHUB_CLIENT_ID
npx wrangler@4.135.0 secret put GITHUB_CLIENT_SECRET
npx wrangler@4.135.0 secret list                      # 2 つの名前が出れば登録済み（値は出ない）
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' '<WORKER_URL>/auth?provider=github&site_id=cor-jp-cms.web.app&scope=public_repo,user'
# 302 https://github.com/login/oauth/authorize?client_id=...&scope=public_repo%2Cuser&state=...
```

Cloudflare の画面で登録する場合: Workers & Pages → `cor-sveltia-cms-auth` → Settings → Variables and Secrets → Add（Type: Secret）。`ALLOWED_DOMAINS` は画面で足さないでください（同じ名前の secret があると `wrangler deploy` が失敗します）。

### 2-6. `base_url` を直す

`cms/public/config.yml` の `backend.base_url`:

| 現在値 | 設定する値 |
|---|---|
| `https://cor-sveltia-cms-auth.REPLACE-WITH-CF-SUBDOMAIN.workers.dev` | `<WORKER_URL>`（末尾の `/` なし） |

develop 宛の PR で変更します。`npm run test:run`（`cms-config.test.ts` が `wrangler.toml` の name と URL の形を照合）が通ることを確かめて取り込み、develop → main のリリースで `deploy-cms.yml` が配信するまで、管理画面には反映されません。

### 2-7. 編集者を招待する

Write 権限（`push`）で招待します。Maintain・Admin は不要です（1-1 のトークンの範囲を参照）。

```bash
gh api -X PUT repos/Cor-Incorporated/corsweb2024/collaborators/<GitHubユーザー名> -f permission=push
gh api repos/Cor-Incorporated/corsweb2024/collaborators/<GitHubユーザー名>/permission --jq .permission   # 招待の承認後に write と出る
```

画面で行う場合: リポジトリの Settings → Collaborators and teams → Add people → Role: **Write**。
Write の編集者は記事を書いてレビューに送れますが、公開（develop への取り込み）はできません（1-6）。

### 2-8. 通しの確認（ADR-0018 の PoC 受入基準）

| 確認 | 期待 |
|---|---|
| 日本語のブラウザで https://cor-jp-cms.web.app/ を開く | 画面が日本語。ブログの件数 = `ls src/content/blog/ja/*.md \| wc -l` の数 |
| 初回ログインの直後に、ブラウザの開発者ツールの Console を見る | CSP 違反（`Refused to ... because it violates the following Content Security Policy directive`）が 0 件。ログイン後の通信（api.github.com など）は e2e では確かめていないので、ここで確かめる |
| 記事を作って「レビューを依頼」 | base が develop の PR ができ、差分が `src/content/blog/ja/*.md` と `public/images/blog/*` だけ |
| その PR | 必須チェックとプレビューが成功し、「プレビューを見る」で記事が開く |
| 翻訳 CI が他言語を追加した後に ja を再保存 | 他言語のファイルが変わらない（#339 のマージ後） |
| terisuke か cloudia-Cor で「エントリーを公開」 | develop に merge commit で入り、`cms/blog/<スラッグ>` ブランチが消える |
| それ以外の Write のアカウントで「エントリーを公開」 | 失敗する（develop の push 制限） |
| 既存記事を開いて何も変えずに保存 | frontmatter の値が変わらない（キーの順序・引用符は変わりうる） |
| Write 権限のないアカウントでログイン | 保存できない |

CSP 違反が出たら、違反した送信元を `cms/firebase.json` の CSP に足す PR を作り、`npm run build:cms && npm run test:e2e:admin` を通してください。

---

## 3. 問題が起きたら

| 症状 | 主な原因 | 対処 |
|---|---|---|
| 「GitHub にログイン」を押しても何も開かない | ポップアップブロック | ブラウザでこのサイトのポップアップを許可 |
| ログインの小窓が「サーバーが見つからない」 | `base_url` がまだ `REPLACE-WITH-CF-SUBDOMAIN` のまま、または main に未反映 | 2-6 を行い、main への反映と `deploy-cms.yml` の完了を待つ |
| 小窓に「この認証アプリではお使いのドメインの使用は許可されていません」 | https://cor-jp-cms.web.app/ 以外（`cor-jp-cms.firebaseapp.com` など）で開いた | https://cor-jp-cms.web.app/ で開き直す |
| 小窓に「OAuth アプリのクライアント ID またはシークレットが設定されていません」 | Worker の secret 未登録 | 2-5 |
| GitHub の画面で「redirect_uri の不一致」などのエラー | OAuth App の Callback URL が `<WORKER_URL>/callback` と違う | 2-4 の Callback URL を直す |
| `wrangler deploy` が `Binding name 'ALLOWED_DOMAINS' already in use` で失敗 | 同じ名前の secret が登録されている | `npx wrangler@4.135.0 secret delete ALLOWED_DOMAINS` の後に再デプロイ（値は `[vars]` から入る） |
| ログインできるが、保存で権限エラー | Write 権限がない・招待を未承認・組織の OAuth app policy で未承認 | 2-7、2-4 の最後の段落 |
| 「エントリーを公開」が失敗する | (1) 必須チェック（約 13 分）がまだ緑でない (2) terisuke・cloudia-Cor 以外のアカウント（develop の push 制限） | (1) PR の Checks が緑になってから押す (2) terisuke か cloudia-Cor に公開を頼む |
| 「アセット」画面からのアップロードが失敗する | develop は PR 必須で、直接の書き込みは拒否される | 記事の画像欄からアップロードする（記事の PR に入る） |
| 「プレビューを確認中」のまま | PR のビルドが失敗（必須項目の漏れなど）、または #341 が未マージ | GitHub の PR の Checks で `build_and_deploy` を確認 |
| PR のチェックで `content-safety.test.ts` が落ちる | 本文に `<script>`・`on〜=` 属性・`javascript:` のリンク・許可していない `<iframe>`、または SVG 画像 | メッセージの `ファイル:行` を直す。埋め込みが必要ならエンジニアに許可リストの追加を頼む |
| ブラウザの Console に CSP 違反が出る | CMS が使う送信元が `cms/firebase.json` の CSP に無い | 2-8 の最後の段落 |
| 保存時に「保存中に他のユーザーがリポジトリを更新しました」 | 翻訳 CI が同じ PR に書き込んだ直後 | 画面を再読み込みしてもう一度保存 |
| 「公開」したのに cor-jp.com に出ない | 公開は develop への取り込み | 次の develop → main のリリースを待つ（develop のプレビューでは見える） |
| スラッグで「英小文字・数字・ハイフンだけで入力してください」 | 大文字・日本語・空白・記号が入っている | `ai-adoption-roadmap` の形にする |
| `config.yml` を直したのに管理画面が古いまま | main への反映と `deploy-cms.yml` がまだ、またはブラウザのキャッシュ | Actions の `Deploy CMS admin (cor-jp-cms)` の完了を確認し、強制再読み込み（Windows: Ctrl+Shift+R、Mac: Cmd+Shift+R） |
| `npm run test:run` の `cms-config.test.ts` が落ちる | `config.yml`・スキーマ・カテゴリ定義・`wrangler.toml`・`cms/firebase.json` の片方だけを変えた | メッセージに出る両側の値を見て、もう片方も直す |

## 4. 関係するファイル

| ファイル | 役割 |
|---|---|
| `cms/index.html`・`cms/main.js` | 管理画面の HTML と起動コード。CMS 本体（npm の `@sveltia/cms`、版固定）を Vite で同梱する |
| `cms/vite.config.mjs` | CMS のビルド（`npm run build:cms` → `cms/dist`）。公開サイトの Astro とは独立 |
| `cms/public/config.yml` | CMS の設定（GitHub・develop・編集ワークフロー・項目定義） |
| `cms/public/robots.txt` | 全体を `Disallow: /` |
| `cms/firebase.json` | CMS サイト `cor-jp-cms` の配信設定とヘッダー（CSP など） |
| `cms/scripts/serve.mjs` | `cms/firebase.json` のヘッダーを付けて `cms/dist` を配信するローカルサーバー（e2e 用） |
| `.github/workflows/deploy-cms.yml` | main から CMS を配信する |
| `.github/workflows/visual-text.yml` | develop の必須チェック。vitest（照合・記事の安全性）と CMS の e2e も実行する |
| `src/config/blog-schema.ts` | 記事の frontmatter のスキーマ（`src/content/config.ts` が使う） |
| `src/config/__tests__/cms-config.test.ts` | `config.yml` ↔ スキーマ・カテゴリ定義・ADR-0018、`wrangler.toml` ↔ `cms/firebase.json` の照合 |
| `src/config/__tests__/content-safety.test.ts` | 記事の stored XSS 対策（`<script>`・`on〜=`・`javascript:`・`<iframe>`・SVG） |
| `e2e/admin-cms.spec.ts` | 本番と同じヘッダーで、ログイン画面と編集画面の CSP 違反 0 件を確認（`npm run build:cms && npm run test:e2e:admin`） |
| `workers/sveltia-cms-auth/` | 認証 Worker（上流の取り込み）。`ALLOWED_DOMAINS` は `wrangler.toml` の `[vars]` |
| `firebase.json`（公開サイト） | `/images/blog/**/*.svg` に `Content-Security-Policy: sandbox; default-src 'none'` |

CMS の版を上げるときは `package.json` の `@sveltia/cms` を書き換える PR を作り、`npm run test:run`・`npm run build:cms`・`npm run test:e2e:admin` を通します（visual-text.yml で CI でも実行されます）。
