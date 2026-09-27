# ADR-0009 yomimono CMS の news/cases 拡張 + 非エンジニア向けUI改善 + OGP PNG化

## ステータス: 一部 Deprecated (2026-09-27)

yomimono の Worker・UI に関する部分は廃止した（コードは #328 でリポジトリから削除。後継候補は ADR-0018、Proposed）。news / cases のコレクション定義、プレスリリース運用、OGP の PNG 化は存続する。以下は当時の記録（Accepted 2026-07-14）。

## 背景
ADR-0008 で確立した「静的＋記事bot（DBなし）」の読みものCMS基盤（yomimono Worker / `cor-yomimono-bot`）は**ブログ単機能で稼働中**。これを取り巻く4つの課題がある:

1. **ニュース（お知らせ）機能が不在**: コーポレートサイトとしてメディア掲載・製品アップデート・イベント・受賞等の「お知らせ」を出す場所がない。ニュースは SNS 拡散が命（PR・メディア露出）だが、現状は後述の OGP 問題でリンクカードすら表示されない。
2. **cases（実績記事）の CMS 投稿パスが不在**: 実績（`src/content/cases/`）は Markdown 直接編集のみで、編集者（凪沙さん）が単独で投稿できない。
3. **既存ブログCMS はエンジニア向け**: 稼働中のブログCMS（`workers/yomimono/src/ui-manual.ts`）は「軽量Markdownエディタ」であり、非エンジニアが note/Qiita のように書くには**5つの壁**がある:
   - **slug 露出**: URL の一部を編集者が手動で決める（概念の説明が必要・誤入力リスク）
   - **Markdown 必須**: `**太字**` 等の記法を知らないと書けない（ツールバー非搭載）
   - **下書き保存不在**: ブラウザを閉じると入力中の記事が消える
   - **既存編集不可**: 投稿済み記事の誤字修正・追記ができない（新規作成のみ）
   - **専門用語**: 「slug」「ガードレール」「main マージ」等の技術語が並ぶ
4. **OGP 画像が SVG 形式で SNS 非表示**: 現状 OGP 画像は `src/pages/og/[...slug].svg.ts` が生 SVG（`image/svg+xml`）を返すのみ。**Twitter/X・Facebook の OGP クローラは SVG を解釈しない**（PNG/JPG/GIF/WebP 必須）→ リンクを貼っても画像が表示されない。コード内コメント（`og/page/[...slug].svg.ts`）で「確実に全SNSで出すには PNG 化が必要（将来対応）」と未解決 TODO 明記済み。

## 決定
ADR-0008 の「静的＋記事bot・DBなし・Cloudflare Worker」アーキテクチャを**そのまま拡張**し、以下3本を一本のパイプラインで達成する:

1. **yomimono Worker を blog/news/cases の3コレクションに拡張（DBレス・同 GitHub App・静的）**:
   - Worker 1つ・route 1つ（`/blog-admin*`）のまま、`body.collection`（`'blog'|'news'|'cases'`・既定 `'blog'`）でコレクションを切替。別 Worker/別 route は Cloudflare 設定・シークレット再登録コストが高いため採用しない。
   - 同一の GitHub App（`cor-yomimono-bot`・`contents:write`・パス制限なし）が `src/content/{blog/ja,news,cases}/` 配下にコミット。**DB・SSR 化なし・既存の push→Firebase SSG デプロイでそのまま公開**。
   - `src/content/config.ts` に `newsCollection` を追加（本文 ja 専用・cases と同じ `availableLocales={['ja']}` 方針・6カテゴリ: info/media/update/event/award/press・`externalUrl` 設定時は個別ページ生成せず外部遷移）。
   - cases はフラット配置（`cases/<slug>.md`）を維持（URL 破壊を回避）。
2. **全 CMS UI の非エンジニア向けフル改善（blog/news/cases 共通）**:
   - `ui-shared.ts` に共通改善モジュールを新設し、3画面（`ui-manual.ts`/`ui-manual-news.ts`/`ui-manual-cases.ts`）で共有。note/Qiita 級の書きやすさを実現:
     - **slug 隠蔽**: タイトルから `titleToSlug(title)` で自動生成（重複時は `-2` 接尾）。上級者向け「URLを編集」は `<details>` 折りたたみ。**非エンジニアは slug 概念に触れない**。
     - **WYSIWYG 風ツールバー**: 太字・H2/H3・リンク・リスト・引用・水平線・画像をボタン挿入（選択範囲を囲む）。**Markdown 記法の知識不要**。
     - **下書き保存（2階層）**: LocalStorage 自動保存（デバウンス・ブラウザ再開で復元）＋サーバー下書き（`isDraft:true` で commit・サイト一覧は `!isDraft` で非表示）。
     - **既存記事の編集**: HUB の「記事一覧」→選択→読込→frontmatter 解析→フォーム埋め→更新モードで commit（`updateArticle`）。
     - **用語の平易化**: 「slug」→非表示、「説明」→「記事のまとめ」、「ガードレール再チェック」→「公開前チェック」等。技術的注記はヘルプ折りたたみへ。
3. **OGP 画像の SVG→PNG 化（全ページ共通）**:
   - `satori` + `@resvg/resvg-js` でビルド時静的 PNG 生成（`src/pages/og/{[...slug],page/[...slug],news/[...slug],cases/[...slug]}.png.ts`）。既存 SVG テンプレ文字列を resvg の `render()` に渡し `Content-Type: image/png` を返す。
   - **CJK フォント必須**: `public/fonts/NotoSansJP.otf` 配置（サーバ側フォント描画が必要＝最大の作業点）。
   - `BlogLayout.astro` / `Layout.astro` のメタ参照を `.svg`→`.png` に切替。`og:image:width=1200`/`height=630`/`alt`/`secure_url` を補完。
   - 既存 SVG は Slack/Discord 用に残置（または廃止）。

## 理由
- **corsweb の売りを維持**: 「超高速 SSG・SEO・5言語基盤」を崩さず、固定 DB/サーバ費ほぼ¥0・既存の Firebase Hosting デプロイで完結する。Firebase 新規導入のコスト・リスク（CORS・Mixed Content・IAM・移行）を回避。
- **パイプライン再利用**: ブログで実績のある「Worker→git commit→SSG」を news/cases にも流用。別基盤（Firebase RTD・Supabase 等）は今回の要件（ja 専用・静的で足りる）に過剰。
- **単独完結の拡張**: ADR-0008 が編集者の「単独公開」を実現した blog を、news/cases にも拡げ、かつ非エンジニアの書きやすさを note/Qiita 級に引き上げることで、運用ボトルネックを全コンテンツ種で解消する。
- **OGP PNG 化は必須**: ニュース（メディア掲載・PR）は SNS 拡散が命。SVG では Twitter/Facebook で画像非表示＝拡散効果ゼロ。PNG 化は技術負債（既存 TODO）の解消でもあり、既存ブログの SNS シェア画像も復旧する。

## 影響
- **Milestone 構成（1PR=1意図・ワークツリー分岐）**:
  - **M1: yomimono collection 基盤 + UI改善基盤** — I1（collection 対応基盤）/ I2（UI改善基盤・共通）/ I3（既存記事編集）。**M1-I1 は PR #221 で develop マージ済**（test 172 緑・blog 回帰なし・`contentDir`/`normalizeArticle`/`buildMarkdown` の collection 分岐）。
  - **M2: cases CMS** — I4（cases 投稿UI・改善版）。`/manual/cases` から `body.collection='cases'` で `src/content/cases/<slug>.md` へ投稿する経路を追加済み。
  - **M3: news 機能**（★news は M3 で有効化）— I5（news コレクション+投稿UI）/ I6（一覧・個別・NewsCard・SEO）/ I7（i18n+nav+sitemap+RSS）。プレスリリースは `press` カテゴリと `/news/press/` の専用導線で公開する。
  - **M4: OGP PNG化**（★news リリース前完了推奨・先輩の直接要件）— I10（SVG→PNG・全ページ共通）。
- **ADR-0008 からの進化**: ADR-0008「ブログ単機能」を「blog/news/cases の3コレクション・DBレス同 bot・非エンジニア向けUI」に拡張。ADR-0008 本体は温存し、本 ADR で拡張する関係（詳細は ADR-0008 末尾の追記参照）。
- Worker は既存の `routes=cor-jp.com/blog-admin*`・シークレット群を再利用（`NEWS_DIR`/`CASES_DIR` の `[vars]` 追加のみ・シークレット再登録不要）。
- **セキュリティ維持**: `cor-yomimono-bot` は引き続き `contents:write`（パス制限なし）。main ブランチ保護・人のマージ権限は不変。bot が書くパスが `blog/ja/` から `news/`・`cases/` に広がるが、いずれもコンテンツ配下（コード不接触）。
- **news ja 専用**: `/en/news` 等を生成すると「英訳 chrome＋ja 本文」の不整合ページがインデックスされる。ja 専用ルート＋`availableLocales={['ja']}`＋nav は ja のみ表示（works と同じ）で回避。
- 非エンジニア自由投稿による本文経由のガードレール違反リスク（ADR-0007）。news/cases 本文にも既存ガードレールを適用し、生成・公開の二段機械チェックで担保。

## 代替案
- **Firebase Realtime Database CMS（web プロジェクト方式）**: corsweb とは別の web プロジェクトで RTD バックエンドの CMS を組む案。リアルタイム性・即時反映は得られるが、**corsweb の「超高速 SSG・SEO・5言語」要件と矛盾**（SSR/CSR になり表示速度劣化・別ホスト/別ドメインの考慮・Firebase セキュリティルール設計）。固定費・運用複雑性も過剰で不採用。
- **StudioCMS（Supabase・ADR-0001/0003）**: 本格 CMS（ニュース・お知らせまで拡張）には最適だが、**今回の news/cases（ja 専用・静的で足りる）にはコスト・複雑性が過剰**。ADR-0008 と同様に将来の全面 CMS 化のオプションとして温存（ADR-0001/0003 は当面 Deferred）。
- **Cloudflare D1（SQLite・Worker から直接読み書き）**: Worker と同アカウントで使えるが、**静的 .md コミットで要件を満たす今回、DB を置く理由がない**（固定費・スキーマ設計・マイグレーション運用が発生・SSG との二重管理リスク）。不採用。
- **OGP を SVG のまま残す**: Slack/Discord は SVG を表示するが、Twitter/Facebook（拡散の主戦場）は非対応。ニュースの SNS 拡散が命のため却下。

## 関連
- 前段・拡張元: **ADR-0008**（読みもの AI ワークフロー・ブログ単機能・rev.2「静的＋記事bot・DBなし」）← 本 ADR で blog/news/cases の3コレクションに拡張
- 将来オプション: ADR-0001（StudioCMS）/ ADR-0002（SSR Hosting）/ ADR-0003（Supabase）= 本 ADR では不採用・全面 CMS 化時に再検討
- 整合: ADR-0006（i18n 単一正本・news は ja 専用）/ ADR-0007（対外表現ガードレール・news/cases 本文にも適用）
- 実装計画（Epic #220）: M1〜M4 の Milestone/Issue 構成・Critical Files
- 既存資産（再利用）: `docs/blog-style-guide.md` / `scripts/generate-blog-draft.mjs` / `scripts/blog-guardrails.mjs` / `workers/yomimono/src/{guardrails,generate,validate}.ts`

## プレスリリース運用

- 新規の外部API、PR TIMES自動取込、DBは導入せず、既存の `news` コレクションと Yomimono CMS で管理する。
- `category: press`、既存の `externalUrl`、`source` を使用し、公式発表または掲載許諾を確認できた内容だけを公開する。
- `/news/press/`、ホームのニュース欄、日本語Header、ニュース一覧から導線を提供する。RSS・OGP・JSON-LD・外部リンクの `noopener noreferrer` は既存実装を継承する。
- 公開責任者は担当者（初期は `terisuke`）とし、公開前に内容・日付・出典・リンク先・社名表記を校正する。公開後の訂正は新しい更新日と理由を記録する。
- 取材・登壇・掲載相談の入口は `press-speaking-other` とし、プレスリリースの公開と問い合わせ受付を混同しない。

Co-Authored-By: Claude <noreply@anthropic.com>
