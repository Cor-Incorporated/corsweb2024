# Architecture Decision Records (ADR)

`cor-jp.com`（`Cor-Incorporated/corsweb2024`）HP刷新（C案）に関するアーキテクチャ決定の記録。

各 ADR は「背景／決定／理由／影響／代替案」を記す標準フォーマット。決定の正本は社内文書 `00.7_意思決定ログ` / `00.8_実装計画＆役割分担＆Issue・ADR設計`（いずれも 2026-06-13）および 2026-07-10 監査（`Cor_Grift_サイト刷新提案`）。

## 一覧

| ADR | タイトル | ステータス |
|---|---|---|
| [ADR-0001](./ADR-0001-cms-studiocms.md) | CMS に StudioCMS（Astroネイティブ・SSR・libSQL）を採用 | Accepted (2026-06-13) |
| [ADR-0002](./ADR-0002-hosting-firebase-app-hosting.md) | ホスティングを Firebase App Hosting（cor-jp-web）＋Astro SSR に移行（静的SSGから） | Accepted (2026-06-13) |
| [ADR-0003](./ADR-0003-db-supabase-postgres.md) | DB に Supabase（Postgres・東京 ap-northeast-1・既存org再利用）を採用。PII は対象外（別管理） | Accepted (2026-06-13) / **注記 2026-09-13**（Contact の PII 記述が古い。正本は ADR-0005/0013） |
| [ADR-0004](./ADR-0004-analytics-cloudflare-clarity.md) | 計測を Cloudflare Web Analytics＋Microsoft Clarity（ファネルイベント含む） | Accepted (2026-06-13) / rev 2026-07-10 |
| [ADR-0005](./ADR-0005-contact-phased-migration.md) | Contact 段階移行（Phase2 = Cloudia UI + contact-chat Worker） | Accepted (2026-06-13) / rev 2026-07-10 / **rev 2026-09-13（§6 撤回・Cloudia 一本化）** |
| [ADR-0006](./ADR-0006-i18n-single-source.md) | i18n source of truth を `src/utils/i18n.ts` に一本化（`*.json` 廃止） | Accepted (2026-06-13) |
| [ADR-0007](./ADR-0007-external-expression-guardrails.md) | 対外表現ガードレール（ISMS・旧事業・社名・証拠ルール） | Accepted (2026-06-13) / rev 2026-07-10 |
| [ADR-0008](./ADR-0008-yomimono-ai-workflow.md) | 読みもの AI 支援ワークフロー | Proposed |
| [ADR-0009](./ADR-0009-news-cases-cms-expansion.md) | news/cases CMS 拡張 + プレスリリース運用 + OGP PNG | Accepted (2026-07-14) |
| [ADR-0010](./ADR-0010-cross-site-cta-env-and-intent.md) | Cor↔Grift CTA 環境変数・intent・Preview noindex | Accepted (2026-07-10) |
| [ADR-0011](./ADR-0011-paid-entry-and-nav-ia.md) | 有料入口 CTA・Header IA・050 表示方針 | Accepted (2026-07-10) |
| [ADR-0012](./ADR-0012-cloudia-integration-and-org-transfer.md) | Cloudia を Contact フォーム代用として統合（org 移管・CF） | Accepted (2026-07-10) / **一部撤回 2026-09-13**（フォーム fallback） |
| [ADR-0013](./ADR-0013-contact-consolidation-cloudia.md) | 問い合わせ一極集中（Cloudia UI + contact-chat） | Accepted (2026-07-11) / **一部撤回 2026-09-13**（fallback フォーム恒久維持） |
| [ADR-0014](./ADR-0014-intent-7keys-and-routing.md) | intent 正本の 7 キー化と intent ルーティング | Accepted (2026-07-11) |
| [ADR-0015](./ADR-0015-cross-repo-adr-canon.md) | 横断 ADR の正本配置と参照方式 | Accepted (2026-07-11) |

## フェーズ対応

- **Phase1（バックエンド土台＋公開前ガードレール）**: ADR-0001〜0003／ADR-0005 Phase1／ADR-0006／ADR-0007。
- **Phase2（C案UI刷新・新ページ）**: ADR-0004／ADR-0005 Phase2 着手。
- **Phase3（公開前・導線真実性・有料入口・証拠）**: ADR-0010／ADR-0011／ADR-0007 証拠ルール。
- **Phase4（Cloudia 統合）**: ADR-0005 rev／ADR-0012（org 移管・Cloudflare・フォーム代用カットオーバー）。

## intent 正本（他リポ共通）

| intent | 意味 |
|---|---|
| `confidential-ai-assessment` | 機密データAI活用診断 |
| `local-llm-poc` | ローカルLLM / セキュアAI PoC |
| `grift-team-beta` | Grift Team Beta |
| `grift-paid-trial` | Grift Paid Trial |
| `estimate-audit` | Estimate Audit |
| `press-speaking-other` | 取材・登壇・その他 |

## 運用

- 新たな論点は ADR の改訂・追加 or children Issue で吸収する。
- ADR は `docs/adr/ADR-00xx-*.md` を Docs PR で追加・改訂する（`develop` 向け）。
