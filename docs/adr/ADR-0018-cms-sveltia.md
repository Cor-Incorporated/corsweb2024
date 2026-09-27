# ADR-0018 CMS を Sveltia CMS（Git ベース・静的管理画面・PR レビュー）にする

## ステータス: Proposed (2026-09-27)

置換: ADR-0001（StudioCMS）、ADR-0008（読みもの AI 支援ワークフロー）、ADR-0009 のうち yomimono の Worker・UI 部分（news / cases のコレクション定義と OGP の PNG 化は存続）

PoC の受入基準をすべて満たした時点で Accepted に改める。

## 暫定運用（PoC 完了まで）

記事の追加・更新は、Markdown を develop 宛の PR で追加して行う（Claude Code での執筆を含む）。yomimono（`cor-jp.com/blog-admin`）は使わない。

## 背景

- 自作 CMS「読みもの（yomimono）」（Cloudflare Worker、合言葉ログイン、bot によるコミット、入口 `cor-jp.com/blog-admin`）は、2026-06-25 の公開以降、CMS 経由の投稿が 0 本だった。入口 URL がサイト上のどこにも無く、「公開」も develop のプレビューにしか届かなかった。
- CEO 決定（2026-09-27）: yomimono は退役し、OSS・購入・レンタルのいずれかで、Astro に合った使いやすい CMS に移行する。将来は AI による執筆補助を付けたい。
- 制約:
  - サイトは Astro の静的出力で、Firebase Hosting の静的配信（ADR-0017）。
  - 本文は `src/content/<collection>/<lang>/<slug>.md`（blog / news / cases × ja / en / zh / ko / es）。スキーマは `src/content/config.ts`。ja が原文。
  - 全記事を 5 言語で出す。ja を含む PR に、翻訳 CI が他の 4 言語を同じ PR へ追加する（ADR-0019、別 PR で作成予定）。
  - main はブランチ保護で PR 経由の更新のみ（必須チェック・承認 1 件）。main への PR は develop からのみ。develop には現時点で GitHub 上の保護が無い（PoC で設定する）。

## 決定

1. CMS に Sveltia CMS（MIT）を採用する。管理画面は `public/admin/index.html` と `public/admin/config.yml` を静的に置き、`https://cor-jp.com/admin/` で配信する。SSR・adapter・DB は導入しない。
2. GitHub バックエンドを使う（対象ブランチは develop）。`publish_mode: editorial_workflow` とし、下書きは PR、レビューは PR のラベル、公開は merge commit で行う。
3. 認証は GitHub OAuth App と Sveltia CMS Authenticator（Cloudflare Workers）で行う。呼び出し元のドメインを限定する。編集者は各自の GitHub アカウント（リポジトリの Write 権限）でログインする。
4. CMS が編集するのは ja のフォルダだけとする（`src/content/{blog,news,cases}/ja`）。en / zh / ko / es は翻訳 CI の専有とする。この範囲と、カテゴリの定義・スキーマの必須項目が一致していることを、`config.yml` を読むテストで強制する。
5. プレビューは Firebase Hosting のプレビューチャネルを使う。develop 宛の PR にもプレビューを作り、CMS の「プレビューを表示」から開けるようにする。
6. Sveltia CMS の版は固定し、更新は依存更新の PR で行う。
7. AI は 2 段階で導入する。第 1 段階（本 ADR）では導入しない。第 2 段階で、Sveltia のカスタムフィールド API を使い、サーバー側（Worker）を呼ぶ「AI 下書き・推敲」ウィジェットを別の ADR で追加する。文体ガイド `docs/blog-style-guide.md` とガードレール `scripts/blog-guardrails.mjs` を再利用する。Sveltia 内蔵の AI 翻訳は翻訳 CI と責務が重なるので使わない。
8. 次点は Decap CMS とする。設定形式が互換で、Sveltia に問題が出た場合の退避先にする。

## PoC の受入基準

- 最初に、Sveltia CMS の editorial workflow（下書き・レビューを PR とラベルで管理する機能）が本構成で動作することを確認する。動作しない場合は Decap CMS に切り替える。
- develop にブランチ保護（PR 必須・必須チェック）を設定し、CMS から develop へ直接 push できないことを確認する。
- ブラウザの言語が日本語のとき、管理画面が日本語で表示される。一覧の件数が `src/content/blog/ja` の記事数と一致する。
- 記事を作成して「レビューに送る」と、base が develop の PR ができ、差分が ja の Markdown と画像だけになる。
- その PR でビルドとプレビューが成功し、CMS の「プレビューを表示」から該当記事を開ける。
- 翻訳 CI が同じ PR に他言語ファイルを追加した後、CMS で ja を再保存しても、他言語ファイルが変わらない。
- 公開（merge）すると develop に merge commit で入り、作業ブランチが削除される。
- 既存記事を CMS で保存しても、frontmatter の値が変わらない。
- `config.yml` からカテゴリを 1 つ消すと、スキーマとの照合テストが両側の値を出して失敗する。
- Write 権限のないアカウントでは保存できない。

## 理由

- 管理画面が静的なので、Firebase の構成・表示速度・SEO を変えずに済む。Astro のバージョンにも依存しない。
- 本文は Git の Markdown のまま残るので、Claude Code で書いた記事も CMS で書いた記事も、同じ PR の流れに合流する。
- CMS は ja のフォルダしか書かないので、翻訳ファイルを CMS が書き換える経路が無い。
- 下書き・レビュー・公開が PR とラベルで表現されるので、ブランチ保護・必須チェック・プレビューと整合する。
- 日本語 UI、画像のアップロード（WebP 変換）があり、ライセンス費用は 0 円、認証用 Worker は Cloudflare の無料枠で動く。
- 開発が活発で、AI 機能の拡張点になる API がある。

## 影響

- 編集者全員に GitHub アカウントと Write 権限が必要になる。
- 本番への反映は、develop への merge の後、次の develop → main のリリースで行われる。
- develop 宛の PR ごとにプレビューチャネルが作られる。
- 翻訳 CI が GitHub Actions の標準トークンで push すると、後続のワークフローが起動しない（GitHub の仕様）。翻訳 CI の設計でこれを扱う（ADR-0019、別 PR で作成予定）。
- ja 記事の削除や slug の変更で翻訳ファイルが孤立しないよう、翻訳 CI 側で追随する。
- スキーマが `config.yml` と `src/content/config.ts` の二重管理になるため、照合テストで結ぶ。
- Sveltia は 1.0 未満で、主な保守者が 1 人。版の固定と Decap への退避手順を維持する。

## 代替案

- Decap CMS: 要件は満たすが、UI・画像処理・AI 機能で劣る。次点として維持する。
- Keystatic: GitHub モードに adapter（SSR）が必要で、静的配信を崩す。
- TinaCMS / CloudCannon: PR ベースのレビュー機能が有料プラン（年額・月額）に限られる。
- Pages CMS: PR ベースのレビュー機能が無い。
- StudioCMS（ADR-0001）: SSR と DB が必須で、日本語 UI が無い。
- Sanity / Storyblok / microCMS / Payload: 本文が Git の外に出るため、翻訳 CI・既存記事の移行・ページ実装を作り直す必要がある。
- yomimono の継続: 投稿実績が 0 本で、CEO 決定により退役。

## 関連

ADR-0007（対外表現ガードレール）、ADR-0017（静的 Astro の継続）、ADR-0019（翻訳パイプライン、別 PR で作成予定）
