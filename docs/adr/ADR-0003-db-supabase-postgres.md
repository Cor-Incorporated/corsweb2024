# ADR-0003 DB に Supabase（Postgres・東京 ap-northeast-1・既存org再利用）を採用。PII は対象外（別管理）

## ステータス: Accepted (2026-06-13)

## 背景
- StudioCMS（ADR-0001）は DB ストレージとして **libsql / postgresql / mysql の複数方言に対応**しており、`db.dialect` で選択する（StudioCMS 公式ドキュメント `config-reference` で確認済）。CMS コンテンツ（ブログ・お知らせ）の永続化に DB が必要。
- 本番ランタイムは Firebase App Hosting（GCP `cor-jp-web`）＋Astro SSR（ADR-0002）。
- 当初は Turso(libSQL) を検討したが、本番運用のための org/team 作成に月額（約 $5.99）が発生する懸念があった。一方で当社は **既存の Supabase org を保有**しており、追加の月額負担なく無料枠から開始できる。
- Contact 経由の PII（個人情報）は別管理方針（ADR-0005）であり、CMS コンテンツ DB に混在させない。

## 決定
- DB に **Supabase（Postgres・東京 `ap-northeast-1`）** を採用する（CMS コンテンツ用）。**既存の Supabase org を再利用**し、無料枠から開始する。
- StudioCMS の **`db.dialect = 'postgresql'`** で接続する。Postgres 接続変数（`CMS_PG_DATABASE` / `CMS_PG_USER` / `CMS_PG_PASSWORD` / `CMS_PG_HOST` / `CMS_PG_PORT`、任意で `CMS_PG_CONNECTION_LIMIT`）を使用する（StudioCMS 公式 env 仕様で確認済）。SSR ランタイムからの接続は **Supabase pooler（コネクションプーラ）** を使用する。
- **PII はここに置かない**（Contact の PII は ADR-0005 の段階移行方針に従う。~~Wave1 は SSGFORM、Wave2 は GCP 集約で国内管理~~ → **この括弧内の記述は古い**: GCP 集約は ADR-0005 の 2026-07-10 改訂で撤回され、Contact は Cloudflare Workers `workers/contact-chat` に収束。SSGFORM フォームも 2026-09-13 改訂で fallback としても残さないことになった。PII の扱いの正本は ADR-0005 / ADR-0013 を参照）。
- **接続情報（DATABASE_URL／各 key）は代表が事前に作成し、Secret Manager（GCP `cor-jp-web`）へ格納する。実装者は `secretAccessor` 権限で参照する**（最小権限・ISMS 整合）。env は Secret Manager 管理とし、リポジトリ・CI ログ・クライアントバンドルに平文露出させない。

## 理由
- 既存 Supabase org を再利用することで、Turso の有料 org/team 月額（約 $5.99）を回避し、無料枠から低コストで開始できる。
- Supabase は東京リージョン（`ap-northeast-1`）のマネージド Postgres を提供し、自前 RDBMS 構築より運用負荷が低い。SSR からは pooler で接続上限を制御できる。
- StudioCMS は postgresql dialect をネイティブにサポートしており統合が容易（ADR-0001）。
- 接続情報の作成を代表に限定し、実装者は最小権限（secretAccessor）で参照することで、秘密情報の管理境界を明確化し ISMS（整備中・ADR-0007）の運用基準に整合させる。
- PII を CMS DB から分離することで、個人情報の保管・越境・安全管理の責任境界を明確化できる（社内『個人情報保護方針(案)』整合）。

## 影響
- 接続情報（DATABASE_URL／各 key）は **代表が事前作成 → Secret Manager（cor-jp-web）へ格納**。実装者は `secretAccessor` で参照（コミット0・平文ログ0）。
- StudioCMS の dialect 設定を postgresql とし、Postgres 接続変数（CMS_PG_*）を `.env.example`／apphosting.yaml／Secret Manager の鍵名で一貫させる。
- `CMS_ENCRYPTION_KEY` 等の認証シークレットを生成し Secret Manager に登録。バックアップ／リストア手順を確立。
- 初回本番DBマイグレーション（`studiocms migrate` 系）は **手動承認ゲート**を通し、post-merge validation／soak time（migration は1営業日）の対象とする。
- プレビュー環境は本番 Supabase プロジェクトを指さず別プロジェクト／別スキーマに分離（PII/CMS 保護）。
- SSR の同時接続が Supabase pooler の接続上限に収まることを検証する（要・諫山）。
- 無料枠（行数／ストレージ／同時接続）が本番想定に収まるかの検証が要（未検証・諫山）。

## 代替案
- **Turso(libSQL) 個人無料枠**: 個人プランの無料枠は使えるが、本番運用に必要な org/team 作成に月額（約 $5.99）が発生する懸念があり、既存 Supabase org を再利用できる本案を優先。
- **GCP 自己ホスト（Cloud SQL / sqld セルフホスト）**: マネージド Cloud SQL は無料枠が無く運用コスト・構築が重い。sqld（libSQL サーバ）のセルフホストは運用・可用性の負担が大きく、CMS コンテンツ用途には過剰。
- **PII を同一 DB に同居**: 責任境界・越境判断・安全管理が複雑化し、個人情報保護方針との整合が困難なため却下。

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
