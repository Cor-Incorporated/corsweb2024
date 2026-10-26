# ADR-0010 Cor↔Grift クロスサイト CTA の環境変数化・intent・Preview noindex

## ステータス: Accepted (2026-07-10) / 注記 2026-10-27

2026-10-27 の注記: intent のキーは ADR-0014 で 7 キーにし、2026-10-27 に意味を今に合わせた。下の intent の表と「30秒」の推奨代替にある Team Beta・Paid Trial・Estimate Audit・見積もりの文言は、ADR-0022 で Grift の扱いを改めた（git 履歴から確かめられる事実を取り出す CLI とテスト導入。見積もりのツールではない）ので使わない。環境変数・Preview noindex・「30秒」を使わない決まり（`npm run check:links`）は今も有効。

## 背景
- 更新予定 Cor は CTA が `https://griftai.org` ハードコード、更新予定 Grift は `https://cor-jp.com/contact/` ハードコード。
- Preview 同士を通しで検証できず、本番/Preview 混在のリスクがある（2026-07-10 監査 P0-1）。
- 「AI見積もりを試す（30秒）」と表示されるが遷移先は LP のみで、その場で見積できない（P0-2）。

## 決定

### 環境変数
| 変数 | 用途 | 本番例 | Preview 例 |
|---|---|---|---|
| `PUBLIC_GRIFT_BASE_URL` | Cor から Grift へのベース URL | `https://griftai.org` | Preview Grift URL |
| `PUBLIC_COR_BASE_URL` | Grift から Cor へのベース URL（Grift 側 ADR） | `https://cor-jp.com` | Preview Cor URL |
| `PUBLIC_SITE_ENV` 等 | `production` / `preview` | — | Preview 判定用 |

- コンポーネントにドメインを直書きしない。共通ヘルパ（例: `getGriftUrl(path, { intent, source, utm })`）経由とする。

### intent / source / UTM
- CTA には少なくとも `intent` と `source` を付与する。
- intent 正本:

| intent | 意味 |
|---|---|
| `confidential-ai-assessment` | 機密データAI活用診断 |
| `local-llm-poc` | ローカルLLM / セキュアAI PoC |
| `grift-team-beta` | Grift Team Beta |
| `grift-paid-trial` | Grift Paid Trial |
| `estimate-audit` | Estimate Audit |
| `press-speaking-other` | 取材・登壇・その他 |

### 「30秒」文言
- その場で完了するミニ診断が **未実装** の間は、「AI見積もりを試す（30秒）」「Griftで試す（30秒）」を使わない。
- 推奨代替: 「Griftの仕組みを見る」「見積根拠の整理方法を見る」「Team Beta を見る」。
- 業種別ページの第一 CTA は機密データAI診断とし、Grift は副 CTA。

### Preview noindex
- Preview ドメインは `noindex, nofollow` または `X-Robots-Tag: noindex, nofollow`。
- Preview の canonical が本番を向く設計は可。Preview 自体を index させない。

### 検査
- デプロイ前または CI で: リンク切れ、本番 URL と Preview URL の混在、禁止の「30秒」文言（機能未実装時）を検出する。

## 理由
- 導線の真実性が公開前の最優先（監査 §1, §12）。
- 環境変数化により Preview 通し検証と本番切替を安全にする。

## 影響
- `Header.astro` / `ProblemHero.astro` / industry bodies / `FinalCta.astro` / i18n CTA 文言を更新。
- Grift 側は ADR-0002（griftai）と対で実装。

## 代替案
- **ハードコードのまま Preview だけ手動置換**: 漏れやすく却下。
- **本当に 30 秒ミニ診断を先に作る**: 中期オプション。公開前は文言修正を優先。

## 参照
- 監査資料 §4 P0-1, P0-2, §10, §12
- griftai `docs/adr/ADR-0002-cta-intent-and-cor-bridge.md`
