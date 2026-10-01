# ブログ CMS（Sveltia CMS）の使い方とセットアップ

ADR-0018（#329）で採用した Sveltia CMS の、編集者向けの使い方と、管理者向けのセットアップ手順です。

- 管理画面: **https://cor-jp-cms-admin.web.app/** （公開サイトとは別の Firebase プロジェクト `cor-jp-cms-admin`。main からだけ配信）
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

ログインすると、CMS はあなたの GitHub のトークンを受け取り、このブラウザの CMS（cor-jp-cms-admin.web.app）の中に保存します。

- トークンの範囲は `public_repo,user` です。**あなたが書き込める全ての公開リポジトリ**（このリポジトリ以外も含む）へのコードの書き込み・共同編集者の追加などと、プロフィールの読み書きに及びます。
- トークンに期限はありません。使い終わったら右上のアカウントメニューから「ログアウト」してください（ブラウザからトークンが消えます）。共用の PC では必ずログアウトしてください。
- 2026-09-28 時点の権限（`gh api repos/Cor-Incorporated/corsweb2024/collaborators --jq '.[]|.login+" "+.role_name'`）: **admin は terisuke だけ**、nagi0705・kisayama0725・cloudia-Cor は write。組織の既定権限は write（`gh api orgs/Cor-Incorporated --jq .default_repository_permission`）。
- admin のアカウント（terisuke）のトークンが漏れると、公開リポジトリの設定の変更や共同編集者の追加まで行えてしまいます。編集には、できるだけ admin ではない Write だけのアカウントを使ってください。
- CMS の配信元を公開サイトと別のプロジェクト・別オリジンにしているのは、このトークンを公開サイトの外部スクリプトや、公開サイトの配信権限から守るためです（ADR-0018）。

### 1-2. 管理画面の URL

**https://cor-jp-cms-admin.web.app/** だけを使います（`cor-jp-cms-admin.firebaseapp.com` や cor-jp.com の下では使えません。以前の `cor-jp-cms.web.app` は 2026-09-28 に削除しました）。

認証の仕組み（Worker と GitHub の OAuth App。2-1 の表の 13〜16）は 2026-10-01 に用意しました。ただし `base_url`（16）が管理画面に届くのは、develop → main のリリースで `deploy-cms.yml` が配信した後です。それまでは、画面を開いても「GitHub にログイン」が失敗します。

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

   ステータスが「**下書き**」の間は、`*` の欄が空でも保存できます（Sveltia CMS の仕様。途中まで書いて置いておけるように）。ただし **カテゴリ・タイトル・概要・公開日** のどれかが空だと、下書きの PR のチェック（`verify` など）が失敗します（ビルドが止めるため。ログに空の欄の名前が出ます）。「**レビュー中**」「**公開可**」に進めるときは、CMS が空の `*` の欄を止めます。編集画面でステータスを変えるときは、CMS は画面に入っている値で確かめるので、**欄を埋めたら先に「保存」してから** 変えてください（保存せずにステータスを変えると、空のままの記事がレビューに回ります）。

> 既存の記事を直すときは、本文を **Markdown のまま** 直してください。リッチテキストに切り替えると、数式・リンクカード・表などの書き方が自動で書き換わることがあります。

### 1-5. 本文に書けないもの（PR のチェックで止まる）

PR のチェック（`content-safety.test.ts`）は、記事をサイトと同じ仕組みで HTML に変換した結果を調べ、閲覧者のブラウザでスクリプトが動く形を見つけたら失敗します（書き方を変えても同じ結果になれば止まります）。

- `<script>`・`<iframe>`・`<object>`・`<embed>`・`<form>`・`<style>`・`<meta>`・`<link>`・`<base>` などの要素
- `onerror=` など `on` で始まる属性
- `http`・`https`・`mailto`・相対パス以外のリンク先・画像（`javascript:`・`data:` など）
- `<svg>`・`<math>` の直接の記述（数式は `$...$` / `$$...$$` で書く。KaTeX が出す数式は通る）
- `public/images/blog/` の SVG ファイル

コードブロック（```` ``` ````）やインラインコード（`` ` ``）の中は、表示されるだけなので対象外です。見た目の変更（`class` やインラインの `style` 属性）と、https の外部画像の読み込みは、このチェックの範囲外です。

リンクカード（本文に URL だけを書いた行から作るカード）も content-safety の範囲外です（検査ではカードを作るプラグインを外して描画します）。カードが取り込む画像のキャッシュ（`/remark-link-card-plus/`）は、#340 の監査と sandbox の CSP で扱います。

### 1-6. 画像の入れ方

- **アイキャッチ**: 「アイキャッチ画像 を追加」にチェック →「参照」でファイルを選ぶ（ドラッグ＆ドロップ可）→「代替テキスト」に画像の説明を書く。
- **本文の中**: 先にアイキャッチ欄などでアップロードし、`![画像の説明](/images/blog/ファイル名.webp)` と書く。
- 使える形式は AVIF・WebP・JPEG・PNG・HEIC です。**SVG は使えません**（スクリプトを含められるため）。
- 写真（JPEG・PNG・HEIC）は、アップロード時に自動で **WebP・最大 1600px** に変換され、ファイル名も英数字に直されます。保存場所は `public/images/blog/` で、記事と同じ PR に入ります。
- 左上の「アセット」（画像の一覧画面）からの直接のアップロード・名前変更・削除はしないでください。develop は PR 必須なので、PR を通らない書き込みは失敗します（保護設定からの推定。未確認）。

### 1-7. レビューに送る → プレビューを見る → 公開

| 手順 | 画面での操作 | GitHub で起きること |
|---|---|---|
| レビューに送る | 保存後に出る確認で「**レビューを依頼**」（あとからでも、記事のステータスを「レビュー中」に変更） | PR にラベル `sveltia-cms/pending_review` が付く |
| プレビューを見る | 保存から数分後、「プレビューを確認中」が「**プレビューを見る**」に変わったら押す（#341 のマージ後） | PR ごとのプレビューサイト（Firebase、30 日で失効）で記事が開く |
| 翻訳が付く | 何もしなくてよい（#339 のマージ後） | 翻訳 CI が同じ PR に英・中・韓・西のファイルを追加する。このコミットのあとはチェックが自動では始まらないので、**terisuke か cloudia-Cor** が PR の画面の「Approve workflows to run」で承認する（PR のコメントとメールで知らせる） |
| チェックを待つ | PR の必須チェック 3 本（`h5-admission`・`verify`・`Chromium visual text audit`）が緑になるまで待つ（visual text audit は約 13 分） | 緑になるまで develop に取り込めない。チェックと翻訳の検査がすべて終わると、PR のコメントとメールで結果（「公開できます」か「チェックが失敗しました」）を知らせる |
| 公開 | **terisuke か cloudia-Cor** がステータスを「**公開可**」にして「**エントリーを公開**」 | PR が develop に merge commit で取り込まれ、作業ブランチ（`cms/blog/<スラッグ>`）は削除される |

**通知（PR のコメントとメール）**: CMS の画面には、翻訳が付いたか・チェックが通ったかが出ません（2026-10-01 の通しの確認で分かった）。そのため `.github/workflows/cms-pr-status.yml` が、CMS の PR のワークフロー（CI・Responsive visual text・H5 Admission・Deploy to Firebase Hosting・Translate content (i18n)）が終わるたびに状態を見直し、次の場面でコメントします。GitHub はそれを PR の作成者（CMS で書いた人）と @メンションした人にメールで知らせます（各自の GitHub の通知設定で、Participating と @mentions の Email が有効な場合）。最後に書いた状態・コミットと同じなら書きません。

- **チェックの実行に承認が必要です**: 翻訳 CI のコミットのあと、チェックが承認待ちで止まったとき（承認を待つワークフローへのリンク。terisuke と cloudia-Cor に @メンション）
- **公開できます**: ワークフローがすべて終わり、必須チェックと翻訳の検査（`i18n-check`）が通ったとき（翻訳がそろっていることと、プレビューの URL を書く。プレビューの配信だけが失敗したときも、そのことを書いて知らせる）
- **チェックが失敗しました**: ワークフローがすべて終わり、必須チェックか `i18n-check` が失敗したとき（失敗したチェックへのリンクをまとめて書く。下書きなら、空にできない欄を案内する）

ワークフローが動いている間は書きません（失敗をまとめて 1 回で知らせ、翻訳の途中で「公開できます」と書かないため）。翻訳がそろったかは、PR の差分ではなく `i18n-check` の結果で決めます（書式だけ直した記事では、翻訳は作り直されず差分に出ないため）。使うのは PR のイベントで動いた `i18n-check` だけです（手で動かす `mode=check` は言語や記事を絞れるため）。ワークフローがすべて終わっても `i18n-check` の結果が無いとき（翻訳 CI を止めたときなど）は、待たずに「翻訳: 確かめられていません」と書いて知らせます。

このワークフローは main に入ってから動きます（`workflow_run` は既定ブランチのワークフローでだけ動く）。通知が来ないときは、Actions タブ → **CMS PR status** → **Run workflow**（ブランチは main のまま）で PR の番号を入れると、今の状態を判定し直します（main から起動したときだけ動く）。コメントするのは、状態が「承認が必要」「失敗」「公開できます」のどれかで、最後のコメントと違うときだけです（それ以外は、実行のログに `state=… notify=false` と出ます）。CLI では次の 2 つ（1 つ目で CMS の PR の番号とブランチが出る）:

```bash
gh pr list --repo Cor-Incorporated/corsweb2024 --json number,headRefName --jq '.[] | select(.headRefName | startswith("cms/")) | "\(.number) \(.headRefName)"'
gh workflow run cms-pr-status.yml --repo Cor-Incorporated/corsweb2024 --ref main -f pr=<1 つ目で出た番号>
```

手元で確かめるときは `GH_REPO=Cor-Incorporated/corsweb2024 node scripts/cms/pr-status.mjs --pr <1 つ目で出た番号> --dry-run`（コメントせずに判定と文面を表示する。`GH_REPO` が無いと、gh は `upstream` の remote〔旧名のリポジトリ〕を選ぶ）。

- 公開（develop への取り込み）ができるのは **terisuke と cloudia-Cor の 2 アカウントだけ** です。develop のブランチ保護の push 制限で強制されていて、enforce_admins=true のため admin にも適用されます。ほかのアカウントで「エントリーを公開」を押すと失敗します。
- 公開 = develop への取り込みです。**cor-jp.com に出るのは、次の develop → main のリリースの後** です。main への取り込みも、push 制限（terisuke・cloudia-Cor）・承認 1 件・必須チェック 5 本（`build_and_deploy`・`Chromium visual text audit`・`guard`・`h5-admission`・`verify`）付きです。

### 1-8. この CMS でできないこと（PoC の範囲）

- 記事の削除（翻訳ファイルと一緒に消す必要があるため、エンジニアに依頼）
- 公開後のスラッグ（URL）の変更
- 英語などほかの言語の記事、ニュース・事例の編集

---

## 2. 管理者向けセットアップ

### 2-1. 外部の設定の一覧と状態（2026-09-28 時点）

この CMS が頼るリポジトリの外の設定です。**サービスアカウントの JSON 鍵は作らず、使いません**（配信は Workload Identity 連携で行います）。各項目の「確かめ方」はすべて読み取りだけのコマンドで、番号は下のコマンド一覧の番号です。

| # | 項目 | 値 | 状態 |
|---|---|---|---|
| 1 | GCP / Firebase プロジェクト | `cor-jp-cms-admin`（プロジェクト番号 `60287323048`、組織 cor-jp.com `460639040363`） | 済 |
| 2 | Hosting サイト | `cor-jp-cms-admin`（既定サイト）→ https://cor-jp-cms-admin.web.app/ 。配信のたびにプレビューチャネル `candidate`（1 時間で失効）も使う | 済 |
| 3 | 有効な API | firebasehosting、iam、iamcredentials、sts | 済 |
| 4 | 配信用サービスアカウント | `cms-deployer@cor-jp-cms-admin.iam.gserviceaccount.com`（ロールは `roles/firebasehosting.admin` だけ。**JSON 鍵なし**） | 済 |
| 5 | Workload Identity プール / プロバイダ | プール `github`、プロバイダ `corsweb2024`。完全な名前は `projects/60287323048/locations/global/workloadIdentityPools/github/providers/corsweb2024`（ACTIVE） | 済 |
| 6 | プロバイダの issuer / audience | issuer `https://token.actions.githubusercontent.com`。allowedAudiences は空（既定の audience = プロバイダの完全な名前） | 済 |
| 7 | プロバイダの条件（attribute-condition） | `assertion.repository_id=='799991752' && assertion.repository_owner_id=='233881863' && assertion.ref=='refs/heads/main' && assertion.job_workflow_ref=='Cor-Incorporated/corsweb2024/.github/workflows/deploy-cms.yml@refs/heads/main' && assertion.environment=='cms-production' && assertion.event_name in ['push', 'workflow_dispatch']` | 済 |
| 8 | サービスアカウントの利用許可 | `roles/iam.workloadIdentityUser` を `principal://iam.googleapis.com/projects/60287323048/locations/global/workloadIdentityPools/github/subject/repo:Cor-Incorporated/corsweb2024:environment:cms-production` の 1 つだけに付与（OIDC の sub は既定の形式: `use_default: true`） | 済 |
| 9 | 公開サイトの SA に権限が無いこと | `cor-jp-cms-admin` の祖先（プロジェクトと組織 460639040363）の IAM のメンバー 39 件に、cor-jp-web の SA は 0 件（継承による権限も無い） | 済 |
| 10 | GitHub Environment | `cms-production`。deployment branch policy は custom で `main`（branch）だけ。secret は入れない | 済 |
| 11 | リポジトリ変数 | `CMS_DEPLOY_ENABLED` = `true`（2026-09-27T17:14:23Z） | 済 |
| 12 | ブランチ保護 | develop: PR 必須・承認 0・必須チェック 3 本（`h5-admission`・`Chromium visual text audit`・`verify`）・enforce_admins・push は terisuke と cloudia-Cor だけ。main: 承認 1・必須チェック 5 本（`build_and_deploy`・`Chromium visual text audit`・`guard`・`h5-admission`・`verify`）・enforce_admins・push は terisuke と cloudia-Cor だけ | 済 |
| 13 | 認証 Worker | `cor-sveltia-cms-auth`（Cloudflare、Company@cor-jp.com）→ `https://cor-sveltia-cms-auth.company-997.workers.dev`（2026-10-01 にデプロイ、version `29e5673a-9a52-4455-89eb-8c7cc2828159`） | 済 |
| 14 | GitHub OAuth App | 名前 `Cor.inc コンテンツ管理（Sveltia CMS）`（Cor-Incorporated 所有）、Homepage `https://cor-jp-cms-admin.web.app/`、Callback `https://cor-sveltia-cms-auth.company-997.workers.dev/callback`（2026-10-01 に作成） | 済 |
| 15 | Worker の secret | `GITHUB_CLIENT_ID`・`GITHUB_CLIENT_SECRET`（2026-10-01 に登録。`wrangler secret list` で名前を確かめた） | 済 |
| 16 | `base_url` | `cms/public/config.yml` を `https://cor-sveltia-cms-auth.company-997.workers.dev` に（develop へは PR で反映。管理画面に出るのは main へのリリース後） | 済 |
| 17 | 旧サイト `cor-jp-cms`（プロジェクト cor-jp-web 内） | 2026-09-28 に削除（CEO 確認済み）。cor-jp-web に残るサイトは `cor-jp-main` と `cor-jp-web` | 済 |

`CMS_DEPLOY_ENABLED` は `true` なので、`cms/` などを変えた push が main に入ると CMS が配信されます（2026-09-30 の初回は firebase-tools の不具合で止まり、PR #359 で直した）。13〜16 は済んでいますが、16 の `base_url` を含む版が main から配信されるまでは、管理画面は開いても **ログインだけが失敗** します。

確かめ方（番号は上の表の番号。すべて読み取りのみ）:

```bash
# 1・2
gcloud projects describe cor-jp-cms-admin --format='value(projectNumber,parent.id)'
firebase hosting:sites:list --project cor-jp-cms-admin
# 3
gcloud services list --enabled --project cor-jp-cms-admin --format='value(config.name)' \
  | grep -E '^(firebasehosting|iam|iamcredentials|sts)\.googleapis\.com$'
# 4（ロールが firebasehosting.admin だけ、ユーザー管理の鍵が 0 件）
gcloud projects get-iam-policy cor-jp-cms-admin --flatten='bindings[].members' \
  --filter='bindings.members:serviceAccount:cms-deployer@cor-jp-cms-admin.iam.gserviceaccount.com' --format='value(bindings.role)'
gcloud iam service-accounts keys list --iam-account=cms-deployer@cor-jp-cms-admin.iam.gserviceaccount.com --managed-by=user
# 5・6・7（ACTIVE、条件、allowedAudiences が空。issuer）
gcloud iam workload-identity-pools providers describe corsweb2024 --project cor-jp-cms-admin --location=global \
  --workload-identity-pool=github --format='value(state,attributeCondition,oidc.allowedAudiences)'
gcloud iam workload-identity-pools providers describe corsweb2024 --project cor-jp-cms-admin --location=global \
  --workload-identity-pool=github --format='value(oidc.issuerUri)'
# 8（workloadIdentityUser の members が上の principal:// の 1 つだけ。sub が既定の形式）
gcloud iam service-accounts get-iam-policy cms-deployer@cor-jp-cms-admin.iam.gserviceaccount.com --project cor-jp-cms-admin
gh api repos/Cor-Incorporated/corsweb2024/actions/oidc/customization/sub
# 9（祖先の IAM に cor-jp-web の SA が無い: 何も出なければよい）
gcloud projects get-ancestors-iam-policy cor-jp-cms-admin --format=json | grep -n 'cor-jp-web'
# 10
gh api repos/Cor-Incorporated/corsweb2024/environments/cms-production/deployment-branch-policies --jq '.branch_policies[] | .type + " " + .name'
# 11
gh variable list -R Cor-Incorporated/corsweb2024
# 12（develop と main）
for b in develop main; do gh api repos/Cor-Incorporated/corsweb2024/branches/$b/protection \
  --jq "{branch: \"$b\", enforce_admins: .enforce_admins.enabled, reviews: .required_pull_request_reviews.required_approving_review_count, checks: [.required_status_checks.checks[].context], push: [.restrictions.users[].login]}"; done
# 17（cor-jp-cms が出ない）
firebase hosting:sites:list --project cor-jp-web
```

### 2-2. CMS の配信（`.github/workflows/deploy-cms.yml`）

| 項目 | 値 |
|---|---|
| 起動 | main への push（`cms/**`・`package.json`・`package-lock.json`・このワークフローの変更時）と、main での手動実行。`on:` はこの 2 つだけ（`pull_request_target` などは足さない） |
| 条件 | `CMS_DEPLOY_ENABLED` が `true` かつ ref が main（build・deploy とも） |
| build ジョブ | 権限は `contents: read` だけ（id-token なし）。Node 22。`npm ci` → `npm run build:cms` → `npm run test:e2e:admin`（本番と同じヘッダーで CSP 違反 0 件）→ `cms/dist` と `cms/firebase.json` を artifact に上げる。e2e が落ちたら（時間切れを含む）、失敗の記録（`test-results/admin-cms/`）を成果物 `cms-admin-e2e` に 14 日残す（`if: failure() || cancelled()`。成功した配信では動かない。deploy ジョブは動かない。開き方は 3-1） |
| deploy ジョブ | `needs: build`・`environment: cms-production`・権限は `contents: read` と `id-token: write`。artifact だけを受け取り、checkout も npm もしない。使うコマンドは jq・curl・gh api（読み取り）・sha256sum・chmod・firebase（hosting:channel:deploy と hosting:clone）だけ（テストで照合） |
| deploy の手順 | ① main の最新の SHA と、この run の SHA が違えば止める（古い run の再実行で巻き戻さない）→ ② artifact を受け取る → ③ `firebase.json` に predeploy / postdeploy が無いことを確かめる → ④ firebase-tools v15.32.1 のリリースの単体バイナリ（`firebase-tools-linux`）を、GitHub がリリースに記録した sha256 で照合する → ④' 資格情報を作る前に `firebase hosting:channel:deploy --help` で deploy の処理を読み込めるか確かめる → ⑤ `google-github-actions/auth`（WIF、鍵なし）で `cms-deployer` になる → ⑥ プレビューチャネル `candidate` に配信（1 時間で失効。失敗したら `--json` の出力をログに出す）→ ⑦ candidate の CSP と COOP を `cms/firebase.json` と比べ、違えば止める（live は変わらない）→ ⑧ `hosting:clone` で candidate と同じ版を live に出す → ⑨ live の CSP と COOP を確かめる |
| 止めているとき | `CMS_DEPLOY_ENABLED` が true でない（または main 以外）のときは配信せず、`cms/` の変更があれば `::warning::` を出す |

firebase-tools を npm（`npx`）ではなくリリースの単体バイナリにしているのは、npm では依存の版が実行のたびに解決され、依存の install スクリプトも動くためです。単体バイナリは依存を含めて中身が sha256 で固定され、install スクリプトもありません。版を上げるときは、`gh api repos/firebase/firebase-tools/releases/tags/v<版> --jq '.assets[] | select(.name == "firebase-tools-linux") | .digest'` の値で URL と sha256 を同時に書き換えます。**`ci.yml` の `verify` にも同じ URL と sha256 があり、PR の段階で同じバイナリの `hosting:channel:deploy --help` を実行します**（両方の一致は `cms-deploy.test.ts` が検査します）。deploy ジョブは main でしか動かないため、ピンが壊れていても PR では気づけなかったからです。2026-09-30 の初回配信（run 36678478928）は、v15.31.0 の単体バイナリが同梱する Node 20.18.2 で ESM 専用の依存を `require()` できず、exit 2（An unexpected error has occurred.）で止まりました（firebase-tools #11168。v15.32.0 で修正）。

「main からだけ配信する」は、次の 2 か所で強制されています（どちらか一方でも拒否される）。

- GCP: プロバイダの条件（2-1 の 7）と利用許可（2-1 の 8）。このリポジトリ（ID で照合）の、ref が main で、main 版の `deploy-cms.yml` の、Environment `cms-production` のジョブが、push か workflow_dispatch で起動したときのトークンしか `cms-deployer` に交換できない。
- GitHub: Environment `cms-production` の branch policy（2-1 の 10）。main 以外では deploy ジョブが始まらない。

公開サイトの配信用のサービスアカウント（プロジェクト cor-jp-web）には、`cor-jp-cms-admin` への権限がありません（継承も含めて。2-1 の 9）。

```bash
# 手動で配信し直す（main のみ）
gh workflow run deploy-cms.yml --ref main -R Cor-Incorporated/corsweb2024
# 配信を止める（現在値 true → 設定値 false）
gh variable set CMS_DEPLOY_ENABLED --body false -R Cor-Incorporated/corsweb2024
# 配信されたヘッダーが cms/firebase.json の CSP と一致するか
curl -sI https://cor-jp-cms-admin.web.app/ | grep -i '^content-security-policy'
node -e "console.log(require('./cms/firebase.json').hosting.headers[0].headers[0].value)"
```

WIF の値やワークフローの名前を変えるときは、GCP の設定・このワークフロー・この表を同時に変えます（`cms-deploy.test.ts` が、ワークフローとこの文書の値の一致を検査します）。

### 2-3. 認証 Worker をデプロイする

コードは `workers/sveltia-cms-auth/`（上流 sveltia/sveltia-cms-auth をそのまま取り込み。詳細は同ディレクトリの README.md）。
Cloudflare のアカウントは Company@cor-jp.com（account_id `9973f2d2304b58a1f90d4d9409e9f8cc`、workers/contact-chat と同じ）。

トークンを渡す先 `ALLOWED_DOMAINS` は、`wrangler.toml` の `[vars]` に **`cor-jp-cms-admin.web.app`（完全一致）** として置いてあり、デプロイで一緒に入ります。secret としては登録しません（値を git で確かめられるようにするため）。`[env.*]` の設定は置きません。`cms/firebase.json` のサイト名との一致は `cms-config.test.ts` が検査しています。

wrangler 4 は **Node.js 22 以上**でしか動きません（Node 20 では `Wrangler requires at least Node.js v22.0.0` で止まる）。既定の Node が 22 未満なら、コマンドの前に `mise exec node@22 --` を付けます（2026-10-01 はこの形でデプロイした）。mise を使っていない場合は、Node.js 22 以上を入れた環境で `mise exec node@22 --` を外して実行します。

```bash
cd workers/sveltia-cms-auth
mise exec node@22 -- npx --yes wrangler@4.135.0 login     # Company@cor-jp.com のアカウントで（ログイン済みなら不要）
mise exec node@22 -- npx --yes wrangler@4.135.0 deploy
```

出力の `https://cor-sveltia-cms-auth.<サブドメイン>.workers.dev` が **Worker の URL** です。2026-10-01 のデプロイでは **`https://cor-sveltia-cms-auth.company-997.workers.dev`**（version `29e5673a-9a52-4455-89eb-8c7cc2828159`）。

デプロイ直後（secret の登録前）の確認:

```bash
curl -s 'https://cor-sveltia-cms-auth.company-997.workers.dev/auth?provider=github&site_id=cor-jp-cms-admin.web.app&scope=public_repo,user' | grep -o 'MISCONFIGURED_CLIENT'
# MISCONFIGURED_CLIENT（CMS のホストは許可されている。Client ID / secret がまだ無い）
curl -s 'https://cor-sveltia-cms-auth.company-997.workers.dev/auth?provider=github&site_id=cor-jp.com&scope=public_repo,user' | grep -o 'UNSUPPORTED_DOMAIN'
# UNSUPPORTED_DOMAIN（CMS 以外のホストには渡さない）
```

### 2-4. GitHub OAuth App を作る

GitHub で **Organization「Cor-Incorporated」→ Settings → Developer settings → OAuth Apps → New OAuth App**（個人アカウントに紐づけないため組織で作る）。

| 入力欄 | 値 |
|---|---|
| Application name | `Cor.inc コンテンツ管理（Sveltia CMS）` |
| Homepage URL | `https://cor-jp-cms-admin.web.app/` |
| Application description | 空欄のまま |
| Authorization callback URL | `https://cor-sveltia-cms-auth.company-997.workers.dev/callback` |
| Enable Device Flow | チェックしない |

「Register application」→ 表示される **Client ID** を控える →「Generate a new client secret」→ 表示される **Client secret** を控える（この画面でしか見られない）。

組織で「OAuth app access restrictions」を有効にしている場合は、Organization settings → Third-party access → OAuth app policy で、このアプリを承認してください。

### 2-5. Worker に Client ID / Client secret を登録する

値はコードやチャットに貼らないでください。secret は再デプロイしても消えません。

| 名前 | 種類 | 値（2026-10-01 時点） |
|---|---|---|
| `GITHUB_CLIENT_ID` | secret | 2-4 の Client ID（2026-10-01 に登録済み） |
| `GITHUB_CLIENT_SECRET` | secret | 2-4 の Client secret（2026-10-01 に登録済み） |
| `ALLOWED_DOMAINS` | `[vars]`（wrangler.toml） | `cor-jp-cms-admin.web.app`（2026-10-01 のデプロイで設定済み。登録作業は不要） |

```bash
cd workers/sveltia-cms-auth
mise exec node@22 -- npx --yes wrangler@4.135.0 secret put GITHUB_CLIENT_ID       # プロンプトに Client ID を貼る
mise exec node@22 -- npx --yes wrangler@4.135.0 secret put GITHUB_CLIENT_SECRET   # プロンプトに Client secret を貼る
mise exec node@22 -- npx --yes wrangler@4.135.0 secret list                      # 2 つの名前が出れば登録済み（値は出ない）
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' 'https://cor-sveltia-cms-auth.company-997.workers.dev/auth?provider=github&site_id=cor-jp-cms-admin.web.app&scope=public_repo,user'
# 302 https://github.com/login/oauth/authorize?client_id=...&scope=public_repo%2Cuser&state=...
```

Cloudflare の画面で登録する場合: Workers & Pages → `cor-sveltia-cms-auth` → Settings → Variables and Secrets → Add（Type: Secret）。`ALLOWED_DOMAINS` は画面で足さないでください（同じ名前の secret があると `wrangler deploy` が失敗します）。

### 2-6. `base_url` を直す

`cms/public/config.yml` の `backend.base_url`:

| 現在値 | 設定する値 |
|---|---|
| `https://cor-sveltia-cms-auth.REPLACE-WITH-CF-SUBDOMAIN.workers.dev`（2026-10-01 まで） | `https://cor-sveltia-cms-auth.company-997.workers.dev`（末尾の `/` なし。設定済み） |

develop 宛の PR で変更します。`npm run test:run`（`cms-config.test.ts` が `wrangler.toml` の name と URL の形を照合）が通ることを確かめて取り込み、develop → main のリリースで `deploy-cms.yml` が配信するまで、管理画面には反映されません。

### 2-7. 編集者を招待する

Write 権限（`push`）で招待します。Maintain・Admin は不要です（1-1 のトークンの範囲を参照）。

```bash
gh api -X PUT repos/Cor-Incorporated/corsweb2024/collaborators/<GitHubユーザー名> -f permission=push
gh api repos/Cor-Incorporated/corsweb2024/collaborators/<GitHubユーザー名>/permission --jq .permission   # 招待の承認後に write と出る
```

画面で行う場合: リポジトリの Settings → Collaborators and teams → Add people → Role: **Write**。
Write の編集者は記事を書いてレビューに送れますが、公開（develop への取り込み）はできません（1-7）。

### 2-8. 通しの確認（ADR-0018 の PoC 受入基準）

| 確認 | 期待 |
|---|---|
| 最初の配信（deploy-cms.yml の run） | build・deploy とも成功し、「Check the candidate …」と「Check live …」が OK |
| 日本語のブラウザで https://cor-jp-cms-admin.web.app/ を開く | 画面が日本語。ブログの件数 = `ls src/content/blog/ja/*.md \| wc -l` の数 |
| 初回ログインの直後に、ブラウザの開発者ツールの Console を見る | CSP 違反（`Refused to ... because it violates the following Content Security Policy directive`）が 0 件。ログイン後の通信（api.github.com など）は e2e では確かめていないので、ここで確かめる |
| 記事を作って「レビューを依頼」 | base が develop の PR ができ、差分が `src/content/blog/ja/*.md` と `public/images/blog/*` だけ |
| その PR | 必須チェックとプレビューが成功し、「プレビューを見る」で記事が開く |
| 翻訳 CI が他言語を追加した後に ja を再保存 | 他言語のファイルが変わらない（#339 のマージ後） |
| 翻訳 CI が他言語を追加した後の PR（cms-pr-status.yml が main に入った後） | PR に github-actions[bot] の「チェックの実行に承認が必要です」が付き、メールが届く。承認してチェックがすべて終わると「公開できます」が付き、メールが届く（来なければ 1-7 の Run workflow で知らせ直し、3 の「通知が来ない」を見る） |
| terisuke か cloudia-Cor で「エントリーを公開」 | develop に merge commit で入り、`cms/blog/<スラッグ>` ブランチが消える |
| それ以外の Write のアカウントで「エントリーを公開」 | 失敗する（develop の push 制限） |
| 既存記事を開いて何も変えずに保存 | frontmatter の値が変わらない（キーの順序・引用符は変わりうる） |
| Write 権限のないアカウントでログイン | 保存できない |
| main 以外のブランチで deploy-cms.yml を動かす | 配信されない（Environment と WIF の条件で拒否。`::warning::` が出る） |

CSP 違反が出たら、違反した送信元を `cms/firebase.json` の CSP に足す PR を作り、`npm run build:cms && npm run test:e2e:admin` を通してください。

---

## 3. 問題が起きたら

| 症状 | 主な原因 | 対処 |
|---|---|---|
| 「GitHub にログイン」を押しても何も開かない | ポップアップブロック | ブラウザでこのサイトのポップアップを許可 |
| ログインの小窓が「サーバーが見つからない」 | `base_url` が Worker の URL（`https://cor-sveltia-cms-auth.company-997.workers.dev`）と違う、または main に未反映 | 2-6 を行い、main への反映と `deploy-cms.yml` の完了を待つ |
| 小窓に「この認証アプリではお使いのドメインの使用は許可されていません」 | https://cor-jp-cms-admin.web.app/ 以外（`firebaseapp.com`・旧 `cor-jp-cms.web.app` など）で開いた | https://cor-jp-cms-admin.web.app/ で開き直す |
| 小窓に「OAuth アプリのクライアント ID またはシークレットが設定されていません」 | Worker の secret 未登録 | 2-5 |
| ログインの小窓が真っ白・404・別のサイトのエラーになる（GitHub で許可した後） | OAuth App の Callback URL が `https://cor-sveltia-cms-auth.company-997.workers.dev/callback` と違う（この Worker は GitHub に redirect_uri を送らないので、GitHub は登録した Callback URL に戻す） | 2-4 の Callback URL を直す |
| `wrangler deploy` が `Binding name 'ALLOWED_DOMAINS' already in use` で失敗 | 同じ名前の secret が登録されている | `mise exec node@22 -- npx --yes wrangler@4.135.0 secret delete ALLOWED_DOMAINS` の後に再デプロイ（値は `[vars]` から入る） |
| `wrangler` が `Wrangler requires at least Node.js v22.0.0` で止まる | wrangler 4 は Node.js 22 以上が必要 | コマンドの前に `mise exec node@22 --` を付ける（2-3） |
| build ジョブの「CMS admin e2e …」が失敗（配信されない。live は変わらない） | CMS の版・`cms/public/config.yml`・`cms/firebase.json` の CSP の変更、または CI での描き遅れ | 3-1 で失敗の記録（trace）を開く。CI の遅さは `CMS_E2E_CPU_THROTTLE=6 npm run test:e2e:admin` で手元に再現できる。直すときは develop 宛の PR で `npm run build:cms && npm run test:e2e:admin` を通す |
| deploy ジョブの認証（google-github-actions/auth）が `unauthorized_client` や `Permission 'iam.serviceAccounts.getAccessToken' denied` で失敗 | プロバイダの条件（2-1 の 7）か利用許可（2-1 の 8）に合わない（main 以外・push と workflow_dispatch 以外・Environment の名前・ワークフローの名前・リポジトリの変更） | main の `deploy-cms.yml` から push か手動で動かす。名前を変えたなら GCP の条件と binding も同時に直す |
| deploy ジョブが「Branch "…" is not allowed to deploy to cms-production」で始まらない | Environment の branch policy（main だけ） | main で動かす |
| deploy ジョブが「main が進んでいます」で止まる | main に新しいコミットが入った後に、古い run を再実行した | 最新の main の run（またはその手動実行）を使う |
| deploy ジョブの sha256 の照合（`sha256sum -c`）が失敗 | ダウンロードした firebase-tools のバイナリが、固定した値と違う | 迂回しない。リリースの digest を確かめ、版を上げるときは URL と sha256 を同時に書き換える PR を作る |
| deploy ジョブの `firebase hosting:channel:deploy` / `hosting:clone` が権限エラー | `cms-deployer` のロール不足、または API が無効 | 2-1 の 3・4 を確かめる。ロールを足す前に CEO に確認する |
| 「Check the candidate …」が失敗 | candidate が返すヘッダーが `cms/firebase.json` と違う。live は変わっていない | `cms/firebase.json` と Firebase の設定を確かめてから、手動で配信し直す |
| 「Check live …」が失敗 | live への反映の遅れ、または live のヘッダーが違う | 数分おいて手動で配信し直す。続くなら Firebase コンソールで cor-jp-cms-admin の最新リリースを確かめる |
| Actions に「CMS は配信していません」の警告 | `CMS_DEPLOY_ENABLED` が true でない、または main 以外で実行した | 意図どおりなら何もしない。配信するなら変数を true にして main で動かす |
| ログインできるが、保存で権限エラー | Write 権限がない・招待を未承認・組織の OAuth app policy で未承認 | 2-7、2-4 の最後の段落 |
| 「エントリーを公開」が失敗する | (1) 必須チェック（約 13 分）がまだ緑でない (2) terisuke・cloudia-Cor 以外のアカウント（develop の push 制限） | (1) PR の Checks が緑になってから押す (2) terisuke か cloudia-Cor に公開を頼む |
| 「アセット」画面からのアップロードが失敗する | develop は PR 必須で、直接の書き込みは拒否される | 記事の画像欄からアップロードする（記事の PR に入る） |
| 「プレビューを確認中」のまま | PR のビルドが失敗（必須項目の漏れなど）、または #341 が未マージ | GitHub の PR の Checks で `build_and_deploy` を確認 |
| PR のコメント（github-actions[bot]）やメールが来ない | (1) cms-pr-status.yml が main に未反映 (2) ワークフローがまだ動いている（すべて終わるまで書かない） (3) 承認のあとのチェックの終わりで、通知のワークフローが動かなかった（GitHub の仕様の確認待ち） (4) 各自の GitHub の通知設定でメールが無効 | (1) リリースを待つ (2) PR の Checks がすべて終わるのを待つ (3) 1-7 の Run workflow で PR の番号を入れて知らせ直す (4) GitHub の Settings → Notifications で Participating と @mentions の Email を有効にする |
| PR のチェックで `content-safety.test.ts` が落ちる | 本文に 1-5 の書けないもの、または SVG 画像 | メッセージの `ファイル: <要素・属性>` を直す。埋め込みが必要ならエンジニアに相談する |
| ブラウザの Console に CSP 違反が出る | CMS が使う送信元が `cms/firebase.json` の CSP に無い | 2-8 の最後の段落 |
| 保存時に「保存中に他のユーザーがリポジトリを更新しました」 | 翻訳 CI が同じ PR に書き込んだ直後 | 画面を再読み込みしてもう一度保存 |
| 「公開」したのに cor-jp.com に出ない | 公開は develop への取り込み | 次の develop → main のリリースを待つ（develop のプレビューでは見える） |
| スラッグで「英小文字・数字・ハイフンだけで入力してください」 | 大文字・日本語・空白・記号が入っている | `ai-adoption-roadmap` の形にする |
| `config.yml` を直したのに管理画面が古いまま | main への反映と `deploy-cms.yml` がまだ、またはブラウザのキャッシュ | Actions の `Deploy CMS admin (cor-jp-cms-admin)` の完了を確認し、強制再読み込み（Windows: Ctrl+Shift+R、Mac: Cmd+Shift+R） |
| `npm run test:run` の `cms-config.test.ts`・`cms-deploy.test.ts` が落ちる | `config.yml`・スキーマ・カテゴリ定義・`wrangler.toml`・`cms/firebase.json`・`deploy-cms.yml`・この文書の片方だけを変えた | メッセージに出る両側の値を見て、もう片方も直す |
| `npm run test:run` の `cms-pr-status.test.ts` が落ちる | `cms-pr-status.yml`・`scripts/cms/pr-status-core.mjs`・ほかのワークフローの `name` やジョブ名・`translate-content.yml` の paths・`firebase.json` のサイト名の片方だけを変えた | メッセージに出る両側の値を見て、もう片方も直す |

### 3-1. 配信の e2e の失敗の記録を開く

成果物 `cms-admin-e2e` は、build ジョブの e2e のテストが落ちた run（時間切れで止まった run を含む）にだけでき、14 日で消えます。リポジトリの直下で実行します。いちばん新しい記録を、run ごとのフォルダ（`test-results/` の下。git の対象外）に落として開きます。

```bash
RUN=$(gh api 'repos/Cor-Incorporated/corsweb2024/actions/artifacts?name=cms-admin-e2e&per_page=100' --jq '[.artifacts[] | select(.expired | not)] | sort_by(.created_at) | last | .workflow_run.id // empty')
if [ -z "$RUN" ]; then echo '14 日以内の記録はありません（下の段落を見てください）'; else
  echo "run: $RUN"
  gh run download "$RUN" --repo Cor-Incorporated/corsweb2024 --name cms-admin-e2e --dir "test-results/cms-admin-e2e/$RUN"
  find "test-results/cms-admin-e2e/$RUN" -name trace.zip
  npx playwright show-trace "$(find "test-results/cms-admin-e2e/$RUN" -name trace.zip | head -1)"
fi
```

落ちたテストが 2 件以上なら、`find` が出した trace.zip のパスごとに `npx playwright show-trace` で開きます。記録が無いとき、または `run:` の番号が落ちた配信の run と違うときは、その配信の e2e は記録を残していません。主な理由は次のとおりです。

- e2e より前のステップ（`npm ci`・`npm run build:cms` など）か、deploy ジョブで落ちた
- テストが始まる前に落ちた（ローカルサーバーが起動しないなど）。出力先には隠しファイルの `.last-run.json` しか残らず、upload-artifact は隠しファイルを上げない
- 14 日を過ぎた

そのときは、落ちた配信（いちばん新しい失敗の run）のログを見ます。

```bash
FAILED=$(gh run list --repo Cor-Incorporated/corsweb2024 --workflow deploy-cms.yml --status failure --limit 1 --json databaseId --jq '.[0].databaseId')
gh run view "$FAILED" --repo Cor-Incorporated/corsweb2024 --log-failed
```

## 4. 関係するファイル

| ファイル | 役割 |
|---|---|
| `cms/index.html`・`cms/main.js` | 管理画面の HTML と起動コード。CMS 本体（npm の `@sveltia/cms`、版固定）を Vite で同梱する |
| `cms/vite.config.mjs` | CMS のビルド（`npm run build:cms` → `cms/dist`）。公開サイトの Astro とは独立 |
| `cms/public/config.yml` | CMS の設定（GitHub・develop・編集ワークフロー・項目定義） |
| `cms/public/robots.txt` | 全体を `Disallow: /` |
| `cms/firebase.json` | CMS サイト `cor-jp-cms-admin` の配信設定とヘッダー（CSP など） |
| `cms/scripts/serve.mjs` | `cms/firebase.json` のヘッダーを付けて `cms/dist` を配信するローカルサーバー（e2e 用） |
| `.github/workflows/deploy-cms.yml` | main から CMS を配信する（build ジョブと、WIF・Environment 付きの deploy ジョブ） |
| `.github/workflows/visual-text.yml` | develop の必須チェック。vitest（照合・記事の安全性）と CMS の e2e も実行する |
| `src/config/blog-schema.ts` | 記事の frontmatter のスキーマ（`src/content/config.ts` が使う） |
| `src/config/__tests__/cms-config.test.ts` | `config.yml` ↔ スキーマ・カテゴリ定義・ADR-0018、`wrangler.toml` ↔ `cms/firebase.json` の照合 |
| `src/config/__tests__/cms-deploy.test.ts` | `deploy-cms.yml` ↔ この文書（WIF・サービスアカウント）・`cms/firebase.json` の照合 |
| `src/config/__tests__/content-safety.test.ts` | 記事をサイトと同じパイプラインで描画し、スクリプトが動く要素・属性・URL と SVG を検査する |
| `e2e/admin-cms.spec.ts` | 本番と同じヘッダーで、ログイン画面と編集画面の CSP 違反 0 件を確認（`npm run build:cms && npm run test:e2e:admin`）。CI の遅さは `CMS_E2E_CPU_THROTTLE=6 npm run test:e2e:admin` で手元に再現できる（Chromium のみ）。失敗の記録（trace・`error-context.md`）は `test-results/admin-cms/` に出て、CI では visual-text.yml の成果物 `visual-text-audit` と、main からの配信（deploy-cms.yml）で落ちたときの成果物 `cms-admin-e2e` に載る（どちらも 14 日。照合: `src/config/__tests__/admin-e2e-artifacts.test.ts`） |
| `workers/sveltia-cms-auth/` | 認証 Worker（上流の取り込み）。`ALLOWED_DOMAINS` は `wrangler.toml` の `[vars]` |
| `firebase.json`（公開サイト） | `/images/blog/**/*.svg` に `Content-Security-Policy: sandbox; default-src 'none'` |

CMS の版を上げるときは `package.json` の `@sveltia/cms` を書き換える PR を作り、`npm run test:run`・`npm run build:cms`・`npm run test:e2e:admin` を通します（visual-text.yml で CI でも実行されます）。

版を上げたら、Sveltia が欄を画面に入ってから描く作り（`@sveltia/ui` の `VisibilityObserver`）が、エディタの各欄（`entry-editor.svelte`）とオブジェクトの中の欄（`object-body.svelte`）に残っているかを確かめます。e2e の `uploadPng` のスクロールは、この作りを前提にしています。

```bash
node -e "const m=JSON.parse(require('fs').readFileSync('node_modules/@sveltia/cms/dist/sveltia-cms.mjs.map','utf8')); m.sources.forEach((s,i)=>{ if (/(entry-editor|object-body)\.svelte$/.test(s)) console.log(s.split('/').pop(), /VisibilityObserver/.test(m.sourcesContent[i])); })"
```

どちらも `true` なら前提のままです。`false` になったら、`e2e/admin-cms.spec.ts` の `uploadPng` のスクロールを外せるか見直します。
