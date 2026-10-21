# ADR-0004 計測を Cloudflare Web Analytics＋Microsoft Clarity（cookieless優先・Clarity は PP 明記）

## ステータス: Accepted (2026-06-13) / 改訂 2026-07-10（リードファネルイベントを追加）/ **改訂 2026-07-17**（Clarity のタグ実装と PP 開示が完了。**同意の要否を決定＝同意導線なしで有効化・弁護士確認は未実施**）

## 背景
- 現状アナリティクスは未実装または部分実装（gtag/GTM 前提の残骸に注意）。
- HP刷新でアクセス解析・行動分析の計測基盤を導入する必要がある。
- 2026-07-10 監査により、pageview より **相談ファネル**（関心 → 相談開始 → 適合 → 商談 → 売上）を測る必要があると確定。

## 決定
- 計測を **Cloudflare Web Analytics（cookieless）をベース**に導入する。
- 加えて **Microsoft Clarity（行動分析）を導入**する。
- Clarity は cookie＋セッション記録のため、**プライバシーポリシーに Clarity（Microsoft・米国越境）を第三者ツールとして明記**する。
  → **2026-07-17 実施済み**。5言語の PP 第5項で提供者・所在国・取得情報・オプトアウト方法を開示し、越境移転は第4項（法第28条）に接続。セッション再生のマスキングは `data-clarity-mask` でコード側に固定。
- measurement ID 等は `PUBLIC_` 環境変数で管理（ハードコード禁止）。
- 計測は **production（cor-jp.com）のみ**で有効化する。preview / develop は社内確認用のため、`isProductionSite()` と CI の env 二重で閉じる。

- CTA / Cloudia は **明示的イベント**で計測する（下記ファネル）。

### 同意の要否（2026-07-17 決定）

- **決定**: EEA / UK / スイス向けの**同意導線（同意バナー・Clarity の Consent API 呼び出し）は設けない**。PP での開示をもって Clarity を有効化する。
- **判断者・日付**: 諫山（PM）／ 2026-07-17。
- **根拠**:
  - cor-jp.com は日本国内向けであり、EEA / UK / スイスからの訪問は実質的に想定されない。
  - PP 第5項で提供者・所在国・取得情報・オプトアウト方法を5言語で開示済み。越境移転は第4項（法第28条）に接続。オプトアウトは **GPC（全世界で利用可・Clarity 対応）を主たる手段**として案内し、DAA のオプトアウトページを併記する。DAA のブラウザ拡張（Protect My Choices）は**米国・カナダ・アルゼンチンでのみ提供**のため、提供地域を明記した上での補助的な案内に留める。
  - 問い合わせフォーム・チャットは `data-clarity-mask` により**コード側でマスクを固定**（`ContactForm.astro` / `ChatPanel.astro`。ビルド出力で検証済み）。Clarity の既定マスキング「バランス」でも入力欄はマスクされるため、PP の記載はダッシュボード設定に依存しない。
  - **（ダッシュボード設定・コード外）** 2026-07-17 時点で Clarity のマスキングは「確実（Strict）＝全テキストをマスク」に設定されていることを、諫山提供のダッシュボード画面で確認。ただし**既定は「バランス」であり、この設定はリポジトリ外**のため、誰かが戻しても CI もテストも検知しない。本 ADR の根拠としては上記 `data-clarity-mask` を正とし、Strict は上乗せの運用と位置づける。
  - Microsoft は「同意を取得しないことは Clarity の**利用規約**違反ではない」と明示している（＝Microsoft との契約上の問題は生じない）。**ただしこれは規約上の話であり、適法性の根拠ではない。** 同 FAQ は "To comply with local regulations explicit user consent is required before placing cookies on their devices." とも述べている。
- **未実施＝既知のリスク（隠さず記録する）**:
  - **弁護士による確認は行っていない。** 本決定は PM の事業判断であり、法的な結論ではない。
  - Microsoft は EEA / UK / スイスの訪問者について、クライアント API による同意シグナルの送信を求めている。**本リポジトリに当該 API の呼び出しは無く、同意シグナルは送信していない。**
  - Cor. は en / es を含む5言語を公開しており、当該地域からの訪問が皆無である保証はない。
- **再検討トリガー**（いずれかに該当したら本 ADR を再訪する）。**担当: 寺田康佑（代表、terisuke。2026-10-20 に諫山から引き継ぎ）／確認頻度: 月次**（担当と頻度を書かないとトリガーは飾りになる）:
  - **Clarity の国別データで EEA / UK / スイスからの訪問が観測された場合**。
    - **限界1（事後性）**: 観測できた時点で当該訪問の取得は既に起きている。トリガーは「止める」ものではなく「方針を見直す」もの。
    - **限界2（過少報告の可能性・未検証）**: Microsoft は同意シグナルが無い場合 "Without explicit consent, Clarity cookies can't be used. This means that some functionalities, like funnel tracking and session recordings, might be impacted" としており、**EEA 等からの訪問がむしろ過少に見える可能性がある**。国別内訳がこの抑制の影響を受けるかは未検証。初回の月次確認時に確かめること。
  - en / es の露出を強化する、または当該地域を対象とした施策を行う場合。
  - 弁護士確認の機会が生じた場合。PP が「第0.3版（案）」のままであるため、その確定と併せて行うのが自然。

### 残タスク（計測の可否とは独立に必要）

- PP 第4項は、越境移転先の**国の情報を求めに応じて提供する**と約束している。これに応えられる**内部記録**（Clarity / Cloudflare の移転先国と根拠）を用意すること。記録が無いままだと PP の記載が空手形になる。

### ファネル KPI

| 段階 | KPI |
|---|---|
| 関心 | サービス詳細到達、実績閲覧、セキュリティ閲覧 |
| 相談開始 | Cloudia 開始率、電話開始、CTA 別開始率 |
| 適合 | 診断 / PoC / Grift 別の適合リード数 |
| 商談 | 有効面談、診断提案、PoC 提案、Team Beta 提案 |
| 売上 | パイプライン金額、契約額、入口→PoC 転換率（オフライン連携可） |

### イベント名（正本）

| イベント | 発火タイミング | 主な properties |
|---|---|---|
| `cta_click` | 主/副 CTA クリック | `intent`, `source`, `page`, `label` |
| `cloudia_start` | Cloudia / contact-chat 開始 | `intent`, `source`, `page` |
| `cloudia_intent_selected` | 初期選択肢確定 | `intent` |
| `cloudia_completed` | 要約確認後の送信成功 | `intent`, `classification` |
| `lead_qualified` | 人手 or ルールで適合判定 | `intent`, `segment` |
| `meeting_booked` | 日程確定 | `intent`, `channel` |
| `phone_ai_completed` | 050 AI 受付完了（将来） | `intent` |
| `human_transfer_success` | 有人転送成功（将来） | `intent` |

Grift 外部 CTA は遷移離脱前に `sendBeacon` / `transport: beacon` で送信する。

## 理由
- Cloudflare Web Analytics は cookieless で同意負荷が低い。
- Clarity は行動分析を補完するが越境・cookie を伴うため二層構成とする。
- 監査の改善サイクルは「どの CTA・intent が商談化したか」に依存するため、イベント名を ADR で固定する。

## 影響
- 実装 Issue で analytics ユーティリティに上記イベントを定義し、Cor / Grift / Cloudia で同名を使う。
- PP と同意導線（ADR-0005）と整合させる。

## 代替案
- **GA4 をベース**: Consent Mode 負荷が高く、cookieless 優先と相反するためベースには採らない。
- **イベント未定義のまま pageview のみ**: 公開後のコピー改善ができないため却下。

## 参照
- 監査資料 §11 計測設計
- ADR-0010（CTA intent / source）
