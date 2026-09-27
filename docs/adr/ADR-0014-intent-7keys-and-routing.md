# ADR-0014 intent 正本の 7 キー化と intent ルーティング

## ステータス: Accepted (2026-07-11)

## 背景
- ADR-0010 で intent 正本 6 キーを定義した。
- 「受託開発の相談」（Cor.inc に開発を依頼したい企業からの相談）に相当する専用キーが存在せず、`confidential-ai-assessment` 等に混在していた。
- グランドデザインとして、受託相談は将来 **Grift の Cor.inc 専用テナント**（Grift 製品のドッグフーディング）でヒアリング〜見積の上流工程を自動対応する方針が決定した。

## 決定

### intent 正本（7 キー）
ADR-0010 の 6 キーに `contract-dev` を追加し、正本を以下の 7 キーとする:

| intent | 意味 | 処理 |
|---|---|---|
| `confidential-ai-assessment` | 機密データAI活用診断 | contact-chat → メール通知（人間対応） |
| `local-llm-poc` | ローカルLLM / セキュアAI PoC | contact-chat → メール通知（人間対応） |
| `grift-team-beta` | Grift Team Beta | メール通知＋明示同意済みの場合だけ Grift 公開相談セッションを発行 |
| `grift-paid-trial` | Grift Paid Trial | メール通知＋明示同意済みの場合だけ Grift 公開相談セッションを発行 |
| `estimate-audit` | Estimate Audit（見積監査） | メール通知＋明示同意済みの場合だけ Grift 公開相談セッションを発行 |
| `contract-dev` | **受託開発の相談（新設）** | **同意後に Grift Cor テナントの公開相談セッションを発行し、相談者が Grift へ移動（Phase 3）** |
| `press-speaking-other` | 取材・登壇・その他 | contact-chat → メール通知（人間対応） |

### ルーティング原則
- **公開相談セッション引継ぎの対象は `contract-dev` / `grift-team-beta` / `grift-paid-trial` / `estimate-audit` の4 intent**。
  - 4 intent は Cloudia とメールで元の intent / source を維持する。contact-chat Worker が Grift 内部契約へ中継するときだけ `intent=contract-dev` / `source=corsweb-contact-chat` へ固定する。
- Cloudia は intent を初期文脈として受け取り（`?intent=` クエリ、cloudia 実装済み）、上記4 intent で Grift 引継ぎフローを案内する（未知キーは従来フローへフォールバック）。
- Cloudia のブラウザから Grift 内部 API を直接呼ばない。相談者が転送内容と利用目的を確認して同意した後、contact-chat Worker が Cor 固定テナントの公開相談セッションをサービス間通信で発行する。
- PII と確認済み要約を Grift へ送る前にユーザーの明示確認を必須とし、生の会話全文は転送しない（ADR-0012 の PII 原則を継承）。

### コード反映
- 本 ADR はキー定義の正本のみを更新する。コード反映は以下で実施:
  - corsweb: `src/config/site.ts` の `ContactIntent` への追加・contact-chat 対応（#250）
  - cloudia: `constants/intents.ts` への追加、4 intent の明示同意、公開 Grift URL への遷移（Phase 3 issue）
  - griftai: `contract-dev` は Grift LP の CTA からは使用しない（Grift LP の intent は grift-* / estimate-audit のみ）

## 影響
- 各リポの intent 一覧（corsweb `ContactIntent` 型 / cloudia `CONTACT_INTENTS` / griftai `cor-cta.ts`）は本表に追従する。差分検知は各リポの check スクリプト・ユニットテストで担保する。

## 参照
- ADR-0010（6 キー初版） / ADR-0013（一極集中） / ADR-0015（正本配置） / ADR-0016（公開相談セッション引継ぎ）
