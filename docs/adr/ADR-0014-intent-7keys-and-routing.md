# ADR-0014 intent 正本の 7 キー化と intent ルーティング

## ステータス: Accepted (2026-07-11) / 改訂 2026-10-27（キーの意味と処理を今に合わせた）

2026-10-27 の改訂: キーは 7 つのまま変えない（古いリンクや外から来る intent も受け付けるため）。意味と処理は次のように読み替える。下の表とルーティング原則は、2026-07 の決定の記録として残す。

- `grift-team-beta`: Grift（OSS の Grift CLI と、人材紹介会社・SES の営業や自社開発企業の採用担当に向けたテスト導入）の相談（ADR-0022）
- `grift-paid-trial`・`estimate-audit`: 2026-10 に取り下げた商品。サイトと Cloudia の選択肢からは送らない（griftai ADR-0005 の決定 5、cloudia#33）。届いたときは、ほかのキーと同じく人間が対応する
- `contract-dev`: AI・システム開発の依頼（受託開発）。自動ハンドオフの先だった旧 Grift のテナントは構想ごと取り下げたので、ほかのキーと同じく contact-chat → メール通知（人間対応）にする。`AUTO_HANDOFF_INTENTS`（`src/config/site.ts`・`workers/contact-chat/src/types.ts`）は定義とテストだけが残り、読むコードは無い

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
| `grift-team-beta` | Grift Team Beta | contact-chat → メール通知（人間対応） |
| `grift-paid-trial` | Grift Paid Trial | contact-chat → メール通知（人間対応） |
| `estimate-audit` | Estimate Audit（見積監査） | contact-chat → メール通知（人間対応） |
| `contract-dev` | **受託開発の相談（新設）** | **Grift Cor テナントへ自動ハンドオフ（Phase 3）** |
| `press-speaking-other` | 取材・登壇・その他 | contact-chat → メール通知（人間対応） |

### ルーティング原則
- **自動ハンドオフの対象は `contract-dev` のみ**。
  - `grift-team-beta` / `grift-paid-trial` / `estimate-audit` は「依頼企業側に Grift を導入する」製品販売リードであり、Grift テナントでの自動対応は困難なため**人間対応を維持**する。
- Cloudia は intent を初期文脈として受け取り（`?intent=` クエリ、cloudia 実装済み）、`contract-dev` 検知時のみ Grift ハンドオフフローに入る（未知キーは従来フローへフォールバック）。
- ハンドオフ前に PII を Grift へ送る場合はユーザーの明示確認を必須とする（ADR-0012 の PII 原則を継承）。

### コード反映
- 本 ADR はキー定義の正本のみを更新する。コード反映は以下で実施:
  - corsweb: `src/config/site.ts` の `ContactIntent` への追加・contact-chat 対応（#250）
  - cloudia: `constants/intents.ts` への追加とルーター実装（Phase 3 issue)
  - griftai: `contract-dev` は Grift LP の CTA からは使用しない（Grift LP の intent は grift-* / estimate-audit のみ）

## 影響
- 各リポの intent 一覧（corsweb `ContactIntent` 型 / cloudia `CONTACT_INTENTS` / griftai `cor-cta.ts`）は本表に追従する。差分検知は各リポの check スクリプト・ユニットテストで担保する。

## 参照
- ADR-0010（6 キー初版） / ADR-0013（一極集中） / ADR-0015（正本配置）
