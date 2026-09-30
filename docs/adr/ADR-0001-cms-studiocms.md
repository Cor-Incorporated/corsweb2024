# ADR-0001 CMS に StudioCMS（Astroネイティブ・SSR・libSQL）を採用

## ステータス: Superseded by ADR-0017 (2026-09-27)

旧ステータス: Accepted (2026-06-13)。StudioCMS は導入されなかった（依存もコードも無い）。SSR と DB を前提とする本 ADR は、静的 Astro の継続（ADR-0017）により不採用とした。後継の CMS は ADR-0018（Proposed、Sveltia CMS）で選定中。以下は当時の記録。

## 背景
- 現行サイトはブログ記事を `src/content/blog`（Content Collections・各言語10記事）で管理しており、記事更新にはエンジニアの介在とビルド・デプロイが必須。社長（寺田）・Nagi など非エンジニアが「お知らせ」「プレスリリース」「登壇・受賞」を投稿できる運用基盤が存在しない。
- HP刷新で `/news`（お知らせ）を新設し、非エンジニアによるコンテンツ投稿・運用一本化を実現する必要がある。
- 現状のスタックは実質 `output: static`（アダプタ無し・全21ページ getStaticPaths／prerender宣言0＝実査確認）であり、CMS の動的編集・認証・ダッシュボードを担えない。

## 決定
- CMS に **StudioCMS（Astroネイティブ・SSR・libSQL）を Phase1 から導入**する。
- StudioCMS のダッシュボード／API／`/news` を SSR で配信し、既存21ページは `prerender = true` を付与してハイブリッド運用する。
- 既存ブログは StudioCMS へ全移行し、運用を一本化する（ADR-0002／ADR-0003 と一体）。
- StudioCMS は DB ストレージとして **libsql / postgresql / mysql の複数方言に対応**する（`db.dialect` で選択）。本件は **Supabase（Postgres）を採用**する（ADR-0003）。

## 理由
- StudioCMS は Astro ネイティブで、既存の Astro コンポーネント・i18n・ルーティング資産を活かしつつ SSR の CMS を統合できる。別フレームワークの headless CMS を外部接続するより結合コストが低い。
- DB 方言を選択でき（libsql/postgresql/mysql）、マネージド Postgres（Supabase）をストレージに使えるため、Astro DB に依存せず運用できる（ADR-0003）。
- 非エンジニアがダッシュボードから記事・お知らせを作成・公開でき、即時反映（再ビルド不要）の運用に移行できる。

## 影響
- ホスティング／ランタイムを static→SSR に切り替える必要がある（ADR-0002）。
- DB（Supabase/Postgres）のプロビジョニング・接続・認証シークレット管理が新規に必要（ADR-0003）。
- 管理者認証（cor-jp.com Google OAuth 限定・最小権限・操作ログ）を ISMS（整備中）の運用基準に整合させる必要がある（ADR-0007 と関連）。
- 既存ブログ50本（ja10＋各言語10×4）の移行作業が Phase1 の土台に含まれる。**既存 URL 不変が絶対条件**。
- 非エンジニア自由投稿により、本文経由で対外表現ガードレール違反が混入するリスクが新規発生する（ADR-0007）。

## 代替案
- **Content Collections 継続（CMS 非導入）**: 非エンジニア投稿・運用一本化の要件を満たせず却下。
- **外部 headless CMS（Contentful / microCMS 等）**: 月額コスト・越境データ保管・Astro 統合コストが増し、マネージド Postgres（Supabase）より運用が複雑化するため却下。
- **Astro DB（旧）**: マネージド運用・東京リージョン・無料枠の観点で Supabase（Postgres）を優先（ADR-0003）。

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
