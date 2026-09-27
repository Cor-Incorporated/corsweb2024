# ブログ CMS（Sveltia CMS）の使い方とセットアップ

ADR-0018 で採用した Sveltia CMS の、編集者向けの使い方と、管理者向けのセットアップ手順です。

- 管理画面: **https://cor-jp.com/admin/** （本番に入るまでは develop プレビューの `/admin/`。下の「管理画面の URL」）
- 編集できるもの: ブログの **日本語の記事だけ**（`src/content/blog/ja/`）。英語・中国語・韓国語・スペイン語は翻訳 CI が自動で作ります（ADR-0019）。
- 仕組み: 保存すると GitHub に PR（プルリクエスト）ができ、「公開」でその PR が develop に取り込まれます。本番（cor-jp.com）には、次の develop → main のリリースで反映されます。

---

## 1. 編集者向け

### 1-1. 用意するもの

| もの | 内容 |
|---|---|
| GitHub のアカウント | 管理者に伝えて、リポジトリ `Cor-Incorporated/corsweb2024` に **Write** 権限で招待してもらう。届いた招待メールで「Accept」を押す |
| ブラウザ | Chrome / Edge / Safari の最新版。日本語設定なら画面は日本語で出る |

### 1-2. 管理画面の URL

| 時期 | URL |
|---|---|
| 本番リリース後 | https://cor-jp.com/admin/ |
| それまで（develop のプレビュー） | https://cor-jp-main--develop-v6sxy3wv.web.app/admin/ （2026-09-27 時点。変わっていたら管理者に確認） |

### 1-3. ログイン

1. 管理画面を開き、「**GitHub にログイン**」を押す。
2. 小さなウィンドウで GitHub の確認画面が出たら「Authorize」を押す（初回だけ）。
3. 左に「ブログ」と記事の一覧が出れば完了。

ウィンドウが開かないときは、ブラウザのポップアップブロックでこのサイトを許可してください。共用の PC では、使い終わったら右上のアカウントメニューから「ログアウト」してください。

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
   | アイキャッチ画像 | 使うときだけ「アイキャッチ画像 を追加」→ 画像と代替テキスト |
   | おすすめに表示 | トップ等のおすすめに出したいときだけ ON |
   | 本文 `*` | Markdown（`## 見出し`、`- 箇条書き` など）で書く。本文欄の右上で「リッチテキスト」に切り替えると、Word のようなボタンでも書ける |

4. 右上の「**保存**」。ここで **下書きの PR** ができます（まだ公開されません）。

> 既存の記事を直すときは、本文を **Markdown のまま** 直してください。リッチテキストに切り替えると、数式・リンクカード・表などの書き方が自動で書き換わることがあります。

### 1-5. 画像の入れ方

- **アイキャッチ**: 「アイキャッチ画像 を追加」→ 画像欄でファイルを選ぶ（ドラッグ＆ドロップ可）→「代替テキスト」に画像の説明を書く。
- **本文の中**: 新しい記事ならリッチテキストに切り替えて画像ボタンから。Markdown のまま書くなら、先にアイキャッチ欄などでアップロードし、`![画像の説明](/images/blog/ファイル名.webp)` と書く。
- 写真（JPEG・PNG・HEIC）は、アップロード時に自動で **WebP・最大 1600px** に変換され、ファイル名も英数字に直されます。保存場所は `public/images/blog/` で、記事と同じ PR に入ります。
- 左上の「アセット」（画像の一覧画面）から直接アップロード・名前変更・削除はしないでください。記事の PR を通らずに develop に直接書き込まれる可能性があります（2026-09-27 時点で未確認。確認後にこの注意を更新）。

### 1-6. レビューに送る → プレビューを見る → 公開

| 手順 | 画面での操作 | GitHub で起きること |
|---|---|---|
| レビューに送る | 保存後に出る確認で「**レビューを依頼**」（あとからでも、記事のステータスを「レビュー中」に変更） | PR にラベル `sveltia-cms/pending_review` が付く |
| プレビューを見る | 保存から数分後、「プレビューを確認中」が「**プレビューを見る**」に変わったら押す | PR ごとのプレビューサイト（Firebase、30 日で失効）で記事が開く |
| 翻訳が付く | 何もしなくてよい | 翻訳 CI が同じ PR に英・中・韓・西のファイルを追加する |
| 公開 | レビューした人（CEO）がステータスを「**公開可**」にして「**エントリーを公開**」 | PR が develop に merge commit で取り込まれ、作業ブランチ（`cms/blog/<スラッグ>`）は削除される |

公開 = develop への取り込みです。**cor-jp.com に出るのは、次の develop → main のリリースの後** です。

### 1-7. この CMS でできないこと（PoC の範囲）

- 記事の削除（翻訳ファイルと一緒に消す必要があるため、エンジニアに依頼）
- 公開後のスラッグ（URL）の変更
- 英語などほかの言語の記事、ニュース・事例の編集

---

## 2. 管理者向けセットアップ

### 2-1. 全体の流れと担当

| # | 作業 | 担当 | CLI で可能か |
|---|---|---|---|
| 1 | 認証 Worker をデプロイして URL を得る | エンジニア | 可（wrangler） |
| 2 | GitHub OAuth App を作り、Client ID / Client secret を得る | CEO（組織オーナー） | 不可（GitHub の画面のみ） |
| 3 | Worker に 3 つの値を登録する | Client secret: CEO / ほか: エンジニア | 可（wrangler）。secret は Cloudflare の画面でも可 |
| 4 | `public/admin/config.yml` の `base_url` を Worker の URL に直す PR | エンジニア | 可 |
| 5 | 編集者を Write 権限で招待する | エンジニア（誰を入れるかは CEO が決める） | 可（gh） |
| 6 | ブラウザでログイン〜公開まで通す | CEO | 不可（人の目視） |

前提: develop 宛 PR にもプレビューを作る `.github/workflows/deploy.yml` の変更（`pull_request.branches` に `develop`）が develop に入っていること。

### 2-2. 認証 Worker をデプロイする（手順 1）

コードは `workers/sveltia-cms-auth/`（上流 sveltia/sveltia-cms-auth をそのまま取り込み。詳細は同ディレクトリの README.md）。
Cloudflare のアカウントは Company@cor-jp.com（account_id `9973f2d2304b58a1f90d4d9409e9f8cc`、workers/contact-chat と同じ）。

```bash
cd workers/sveltia-cms-auth
npx wrangler@4.135.0 login     # Company@cor-jp.com のアカウントで（ログイン済みなら不要）
npx wrangler@4.135.0 deploy
```

出力の `https://cor-sveltia-cms-auth.<サブドメイン>.workers.dev` が **Worker の URL** です（以下 `<WORKER_URL>`）。

### 2-3. GitHub OAuth App を作る（手順 2）

GitHub で **Organization「Cor-Incorporated」→ Settings → Developer settings → OAuth Apps → New OAuth App**（個人アカウントに紐づけないため組織で作る）。

| 入力欄 | 値 |
|---|---|
| Application name | `Cor.inc コンテンツ管理（Sveltia CMS）` |
| Homepage URL | `https://cor-jp.com/admin/` |
| Application description | 空欄のまま |
| Authorization callback URL | `<WORKER_URL>/callback` （例: `https://cor-sveltia-cms-auth.example.workers.dev/callback`） |
| Enable Device Flow | チェックしない |

「Register application」→ 表示される **Client ID** を控える →「Generate a new client secret」→ 表示される **Client secret** を控える（この画面でしか見られない）。

組織で「OAuth app access restrictions」を有効にしている場合は、Organization settings → Third-party access → OAuth app policy で、このアプリを承認してください。

### 2-4. Worker に値を登録する（手順 3）

3 つとも secret として登録します（secret は再デプロイしても消えない）。値はコードやチャットに貼らないでください。

| 名前 | 現在値 → 設定する値 |
|---|---|
| `GITHUB_CLIENT_ID` | 未設定 → 手順 2 の Client ID |
| `GITHUB_CLIENT_SECRET` | 未設定 → 手順 2 の Client secret |
| `ALLOWED_DOMAINS` | 未設定 → `cor-jp.com, cor-jp-main--develop-*.web.app` |

```bash
cd workers/sveltia-cms-auth
npx wrangler@4.135.0 secret put GITHUB_CLIENT_ID
npx wrangler@4.135.0 secret put GITHUB_CLIENT_SECRET
npx wrangler@4.135.0 secret put ALLOWED_DOMAINS       # 入力: cor-jp.com, cor-jp-main--develop-*.web.app
npx wrangler@4.135.0 secret list                      # 3 つの名前が出れば登録済み（値は出ない）
```

Cloudflare の画面で登録する場合: Workers & Pages → `cor-sveltia-cms-auth` → Settings → Variables and Secrets → Add（Type: Secret）。

`ALLOWED_DOMAINS` について:
- ここにあるホストで開いた管理画面にだけ、ログインのトークンを渡します。未設定だとどのサイトにも渡すため、必ず設定します。
- `*` は任意の文字列に一致します。`cor-jp-main--develop-*.web.app` は develop のプレビュー（今は `cor-jp-main--develop-v6sxy3wv.web.app`）に一致し、チャネルが作り直されて末尾が変わっても一致し続けます。
- PR ごとのプレビュー（`cor-jp-main--pr<番号>-….web.app`）ではログインできません。PR のプレビューで管理画面を試すときだけ、そのホストを一時的に足します。
- develop のプレビューの現在のホストは次で確かめられます。

  ```bash
  gh run list --repo Cor-Incorporated/corsweb2024 --workflow deploy.yml --branch develop --event push --limit 1 --json databaseId --jq '.[0].databaseId' \
    | xargs -I{} gh run view {} --repo Cor-Incorporated/corsweb2024 --log | grep -o 'https://cor-jp-main--develop-[a-z0-9]*\.web\.app' | head -1
  ```

登録の確認（302 で GitHub に転送されれば OK）:

```bash
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' '<WORKER_URL>/auth?provider=github&site_id=cor-jp.com&scope=public_repo,user'
# 302 https://github.com/login/oauth/authorize?client_id=...&scope=public_repo%2Cuser&state=...
curl -s '<WORKER_URL>/auth?provider=github&site_id=example.com&scope=public_repo,user' | grep -o 'UNSUPPORTED_DOMAIN'
# UNSUPPORTED_DOMAIN（許可していないホストには渡さない）
```

### 2-5. `base_url` を直す（手順 4）

`public/admin/config.yml` の `backend.base_url`:

| 現在値 | 設定する値 |
|---|---|
| `https://cor-sveltia-cms-auth.REPLACE-WITH-CF-SUBDOMAIN.workers.dev` | `<WORKER_URL>`（末尾の `/` なし） |

develop 宛の PR で変更し、`npm run test:run`（設定の照合テスト）が通ることを確認して取り込みます。

### 2-6. 編集者を招待する（手順 5）

Write 権限（`push`）で招待します。Maintain・Admin は不要です。

```bash
gh api -X PUT repos/Cor-Incorporated/corsweb2024/collaborators/<GitHubユーザー名> -f permission=push
gh api repos/Cor-Incorporated/corsweb2024/collaborators/<GitHubユーザー名>/permission --jq .permission   # 招待の承認後に write と出る
```

画面で行う場合: リポジトリの Settings → Collaborators and teams → Add people → Role: **Write**。

### 2-7. 通しの確認（手順 6、ADR-0018 の PoC 受入基準）

| 確認 | 期待 |
|---|---|
| 日本語のブラウザで `/admin/` を開く | 画面が日本語。ブログの件数 = `ls src/content/blog/ja/*.md \| wc -l` の数 |
| 記事を作って「レビューを依頼」 | base が develop の PR ができ、差分が `src/content/blog/ja/*.md` と `public/images/blog/*` だけ |
| その PR | ビルドとプレビューが成功し、「プレビューを見る」で記事が開く |
| 翻訳 CI が他言語を追加した後に ja を再保存 | 他言語のファイルが変わらない |
| 「エントリーを公開」 | develop に merge commit で入り、`cms/blog/<スラッグ>` ブランチが消える |
| 既存記事を開いて何も変えずに保存 | frontmatter の値が変わらない（キーの順序・引用符は変わりうる） |
| Write 権限のないアカウントでログイン | 保存できない |

---

## 3. 問題が起きたら

| 症状 | 主な原因 | 対処 |
|---|---|---|
| 「GitHub にログイン」を押しても何も開かない | ポップアップブロック | ブラウザでこのサイトのポップアップを許可 |
| ログインの小窓が「サーバーが見つからない」 | `base_url` がまだ `REPLACE-WITH-CF-SUBDOMAIN` のまま | 2-5 を行う |
| 小窓に「この認証アプリではお使いのドメインの使用は許可されていません」 | 開いたホストが `ALLOWED_DOMAINS` に無い | 2-4 で追加（例: PR のプレビューで試すとき） |
| 小窓に「OAuth アプリのクライアント ID またはシークレットが設定されていません」 | Worker の secret 未登録 | 2-4 |
| GitHub の画面で「redirect_uri の不一致」などのエラー | OAuth App の Callback URL が `<WORKER_URL>/callback` と違う | 2-3 の Callback URL を直す |
| ログインできるが、保存で権限エラー | Write 権限がない・招待を未承認・組織の OAuth app policy で未承認 | 2-6、2-3 の最後の段落 |
| 「プレビューを確認中」のまま | PR のビルドが失敗（必須項目の漏れなど）、または deploy.yml の develop 宛 PR 設定が未反映 | GitHub の PR の Checks で `build_and_deploy` を確認 |
| 保存時に「保存中に他のユーザーがリポジトリを更新しました」 | 翻訳 CI が同じ PR に書き込んだ直後 | 画面を再読み込みしてもう一度保存 |
| 「公開」したのに cor-jp.com に出ない | 公開は develop への取り込み | 次の develop → main のリリースを待つ（develop のプレビューでは見える） |
| スラッグで「英小文字・数字・ハイフンだけで入力してください」 | 大文字・日本語・空白・記号が入っている | `ai-adoption-roadmap` の形にする |
| `config.yml` を直したのに管理画面が古いまま | ブラウザのキャッシュ（`config.yml` には Cache-Control の指定が無い） | 強制再読み込み（Windows: Ctrl+Shift+R、Mac: Cmd+Shift+R） |
| `npm run test:run` の `cms-config.test.ts` が落ちる | `config.yml` とスキーマ・カテゴリ定義の片方だけを変えた | メッセージに出る両側の値を見て、もう片方も直す |

## 4. 関係するファイル

| ファイル | 役割 |
|---|---|
| `src/pages/admin/index.astro` | 管理画面の HTML。CMS 本体（npm の `@sveltia/cms`、版固定）を同梱して読み込む |
| `public/admin/config.yml` | CMS の設定（GitHub・develop・編集ワークフロー・項目定義） |
| `src/config/blog-schema.ts` | 記事の frontmatter のスキーマ（`src/content/config.ts` が使う） |
| `src/config/__tests__/cms-config.test.ts` | `config.yml` とスキーマ・カテゴリ定義・ADR-0018 の照合テスト |
| `e2e/admin-cms.spec.ts` | `/admin/` のログイン画面の確認（`npm run build && npm run test:e2e:admin`） |
| `workers/sveltia-cms-auth/` | 認証 Worker（上流の取り込み） |
| `.github/workflows/deploy.yml` | PR ごとのプレビュー（check run「Deploy Preview」を CMS が読む） |

CMS の版を上げるときは `package.json` の `@sveltia/cms` を書き換える PR を作り、`npm run test:run`・`npm run build`・`npm run test:e2e:admin` を通します。
