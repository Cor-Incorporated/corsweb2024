# ADR-0008 読みもの（AI支援記事）作成ワークフロー — 編集者が main を経由せず単独で公開

## ステータス: Superseded by ADR-0018 (2026-09-27)

旧ステータス: Proposed (2026-06-25, rev.2 で「静的＋記事bot（DBなし）」に確定)。yomimono Worker は #328 で、Claude による自動下書きは #327 で退役した。CMS は ADR-0018 で置き換え、AI による執筆補助は ADR-0018 の第 2 段階として別 ADR で設計する。以下は当時の記録。

## 背景
- main ブランチは「マージ可能なのは `kisayama0725` のみ」のブランチ保護下にある（誤デプロイ防止のセキュリティ統制）。
- 現状ブログ記事は `src/content/blog`（Content Collections・各言語10本＝計50本）の `.md`＝**コードの一部**であり、記事公開＝コードの main マージが必須。
- 結果、**読みもの更新が main マージ権限保持者（諫山）のマージ待ちになるボトルネック**が発生。日々の読みもの運用を Nagi（編集者）に**単独で**委譲したい。
- 文体・自動下書きの資産は既にある: `docs/blog-style-guide.md`（社長＝寺田の書き方メモリ）、`scripts/generate-blog-draft.mjs`（Claude＋`web_search` で収集→執筆→ガードレール）、`scripts/blog-guardrails.mjs`（旧事業名・未取得認証等の機械検出）。
- **コスト最優先**の要件があり、固定のサーバ/DB費を避けたい。

## 決定（rev.2 — 静的＋記事bot、DBなし）
1. **記事は git の `.md` のまま（DB不使用）、サイトは静的（SSG・現状のFirebase Hosting）を維持する。** → 固定インフラ費ほぼ¥0・既存のSEO/表示速度を維持。
2. **公開＝記事専用 GitHub App（content-bot）が `src/content/blog/**` にコミット** → 既存の自動デプロイ（push→Firebase）で本番反映。**人の手動マージを挟まない**。反映は「コミット→ビルド（数分）」。
3. **編集者はログイン認証付き管理UI**から操作。AI支援フロー（収集・生成・ガードレール）は**サーバレスの小さなバックエンド（Cloudflare Workers / Firebase Functions 等の無料枠、または既存 GitHub Actions）**で Claude を呼ぶ。Claude APIキー・GitHub App 秘密鍵はバックエンドのシークレットに保持（クライアントに出さない）。
4. **main の人マージ保護は維持**（マージは諫山のみ）。例外として **content-bot だけを main の許可 pusher に1つ追加**し、bot は `src/content/blog/` 配下の記事のみ書く（コードには触れない・信頼アクター）。→ 人に対する保護は不変のまま、編集者が単独で本番公開できる。
5. **AI支援フロー（Claude）**: ①情報収集（`web_search` で直近約27hの AI/DX/ローカルLLM等の候補を10〜15件ランキング）→②テーマ複数選択（人）→③枚数決定→④生成（`blog-style-guide.md` の社長文体＝誰でも同じ視点・一次出典は実在URLのみ・捏造禁止）→⑤レビュー（人）→⑥GO公開（bot コミット）。既存 `generate-blog-draft.mjs` / `blog-guardrails.mjs` を再利用。ガードレールは生成時と公開時の二段で機械チェック。
6. **認証**: 管理UIはログイン必須（cor-jp.com 限定の OAuth 等）。**「秘密URL（隠しパス）」は採用しない**（推測アクセスで Claude API 浪費・無断公開のリスク）。
7. **AIツールは Claude**（`claude-opus-4-8`、adaptive thinking、`web_search_20260209`）。

## 理由
- **最小コスト**: 固定のサーバ/DB費が発生せず、継続コストは **Claude の生成料（1本あたり概ね数十円・使った分だけ）のみ**。サイトは静的のまま＝ホスティングもほぼ無料・SEO/速度も最強。
- **単独完結**: 認証→収集→生成→レビュー→bot公開まで、諫山もエンジニアも介在せず編集者だけで日々運用できる（初期構築のみエンジニア・以降は不要、例外は故障時のみ）。
- **セキュリティ維持**: 記事専用 bot を1つ信頼するだけで、人の main マージ保護は不変。bot は記事パスのみ書く。
- **資産再利用**: 既存の生成エンジン・文体メモリ・ガードレールをそのまま活かせる。

## 影響
- content-bot（GitHub App）を main の許可 pusher に追加する設計判断（記事専用の信頼アクター）。App の権限はコンテンツ commit に必要な最小限に絞る。
- Claude APIキー／GitHub App 秘密鍵のシークレット管理（バックエンド側）。
- 公開反映は「コミット→ビルド（数分）」＝即時ではない（日次の読みもの運用には十分）。
- **MVP はテキスト記事・日本語のみ**で単独完結。画像は将来（bot が画像も commit）、多言語化（ja/en/zh/ko/es、#60 の翻訳基盤と接続）は任意の後付け工程。
- 非エンジニア自由投稿による本文経由のガードレール違反リスク（ADR-0007）。生成・公開の二段機械チェックで担保。

## 代替案
- **B: develop へ自動コミット＋諫山が定期昇格** — 本番反映が諫山依存のままで「単独完結」を満たさず却下。
- **C: 対話UIで PR 作成＋諫山が1クリック承認** — 毎回のクリックが残りボトルネック解消にならず却下。
- **DB(Supabase)+SSR（StudioCMS / ADR-0001）** — 本格CMS（ニュース・お知らせまで拡張）には最適で即時反映も得られるが、**今回の読みもの単機能にはコスト・複雑性が過剰**。本MVPでは不採用とし、将来のCMS拡張時のオプションとして温存（ADR-0001 は当面 Deferred 扱い）。
- **秘密URL（隠しパス）** — 認証なしは推測アクセスのリスクで却下。

## 関連
- **拡張: ADR-0009** — 本 ADR（ブログ単機能）を **blog/news/cases の3コレクションに拡張**（DBレス・同 GitHub App・静的・非エンジニア向けUI改善・OGP PNG化）。news/cases は ADR-0009 にて。本 ADR 本体はブログ単機能の設計記録として温存。
- 将来オプション: ADR-0001（StudioCMS）/ ADR-0002（SSR Hosting）/ ADR-0003（Supabase）= 本MVPでは不採用・拡張時に再検討
- 整合: ADR-0006（i18n 単一正本）/ ADR-0007（対外表現ガードレール）
- 既存資産: `docs/blog-style-guide.md` / `scripts/generate-blog-draft.mjs` / `scripts/blog-guardrails.mjs` / `.github/workflows/blog-autodraft.yml`（自動下書きの cron 版。本ワークフローは対話・編集者単独公開版）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
