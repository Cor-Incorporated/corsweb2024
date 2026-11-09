# 契約と課金の設計（business-dossier / XESM）

2026-11-06 の設計案。Stripe の商品・価格・税率の作成、本番への切替、顧客への請求と案内は、すべて寺田が実行する。
AI のレーンは Stripe の API を鍵付きで呼ばない。鍵の値を読まない・書かない。

このリポジトリは公開されている。**顧客ごとの情報（社名、メールアドレス、開始月、回収の状況）はここに書かない。**
顧客ごとの数字は、非公開の台帳（寺田の手元と、統括への報告）に置く。

| ファイル | 中身 |
|---|---|
| [plans.json](plans.json) | 商品・価格・税率の宣言（機械可読）。金額は税別の円 |
| [apply-plans.sh](apply-plans.sh) | plans.json を読んで Stripe に冪等に作る。既定は dry-run（通信しない・鍵を読まない） |
| [subscribe.sh](subscribe.sh) | 顧客 1 社の契約と毎月末の請求書（1C 章の作り方 B）。`customer`・`find`・`contract`・`card-setup`・`cancel`・`invoice`・`charge`・`mark-paid`・`simulate`・`status`・`clerk-sync`・`hold`・`unhold`・`resync`・`set-payment`。既定は dry-run |
| [lib.sh](lib.sh) | 2 本が共有する部品（鍵の受け取り、モードの確認、API の呼出し、日付と明細の計算 `billing_lines`） |
| [runbook.md](runbook.md) | 寺田が実行する手順（テストモード → 本番、顧客 1 社の契約 → 入口を開ける → 毎月の請求 → 解約 → 閉じる） |
| [contract/](contract/) | 権利（`services`）の判定の見本と試験ベクトル。`judge.sh`（jq。`--services-json`・`--service`・`--date` で 4 つの結果を 1 行）・`entitlement-vectors.json`（判定表の境界 31 件。bd と XESM の試験もこれを読む）・`verify-sample.mjs`（Clerk のトークンの検証の見本。R1・R2） |
| [tests/](tests/) | 通信しない検査（偽の curl で、鍵が漏れないこと・モード違いで止まること・事故入力を落とすこと・明細の金額が手で計算した値と合うこと）。`test-apply-plans.sh` 54 項目、`test-subscribe.sh` 381 項目、`test-entitlement-vectors.sh` 68 項目（判定表の境界 ↔ `judge.sh` ↔ plans.json）、`test-verify-sample.sh` 25 項目（トークンの検証の陽性 1・陰性 9）、`test-gitleaksignore.sh` 6 項目（リポジトリ直下の `.gitleaksignore` が除くのは plans.json の税率の識別子の 1 行だけであること）、`test-tokushoho-link.sh`（特商法ページの月額・支払時期・解約条件・最低利用期間 ↔ plans.json）。CI では回らないので手で回す |

## 0. 決まっていること（寺田、2026-11-06 13:5x）

- business-dossier と XESM は同じプロジェクトで管理する。Stripe のアカウントは 1 つにし、どのサービスを使うかはプラン（価格）で決める。
- 利用料は 1 サービスあたり 10,000 円（税別）/ 月。今のシステムは basic プラン。あとから premium プランを足せる形にする。
- 設計開発費用は 8,000 円（税別）/ 月 × 12 回の分割。Stripe に「開発費用」の特別プランを作って回収する。
- 開始月・回収済みの回数・未回収の月は顧客ごとに違うので、非公開の台帳に書く（8 章）。
- 追加の決定（寺田、2026-11-06 14:0x）: business-dossier と XESM のアカウントは Clerk で管理する。Clerk のアカウントと Stripe のサブスクリプションを紐づけ、今後の Cor. のサービスの共通の基盤にする（1A 章）。
- 1A 章の形（身元は Clerk の組織、課金は自前の Stripe、Clerk Billing は使わない、紐づけは双方の metadata、入口は段階 0 → 1 → 2）で進める（寺田、2026-11-06 14:5x）。

- 請求の形の決定（寺田、2026-11-07）: 全ての顧客を月末締め・翌月末払いにそろえ、初月は 1 か月分、最低利用期間は契約から 1 年（その後は月単位）、解約は受理日の 1 か月後の同じ日に終わり（最後の月は日割り）、終了日が 1 年未満なら残りの期間分の利用料と開発費の残りを一括で請求する（1C 章）。Stripe での作り方は B（毎月末に請求書）に決まった。B は `subscribe.sh` に実装した（1C 章の「実装の状態」）。

## 1A. 身元は Clerk、課金は Stripe

身元の正本は Clerk（利用者と Organization）、課金の正本は Stripe の Customer。2 つを顧客の会社ごとに結んだものが、Cor. のサービスに共通の契約の基盤になる。**設計の全文は [ADR-0028](../adr/ADR-0028-cor-account-billing-foundation.md)（corsweb2024 #514）に移した。** この章は、実装が使う形だけを書く。

- 顧客（テナント）= Clerk の Organization（`org_…`）。会社 1 社に 1 つ。契約と請求は Stripe の Customer（`cus_…`）が持ち、`metadata.clerk_org_id` で組織に結ぶ
- 権利（使えるサービス）= 契約から作り、組織の `public_metadata.services` に写す。形は `services.<サービス> = {from, until, hold}`、サービスの名前は `plans.json` と同じ。サービスは日本時間の今日の日付で判定し、結果は 4 つ（**開ける**／**見るだけ**（hold。書き込みだけ止める）／**読む・書き出すだけ**（終了日の翌日から 30 日）／**閉じる**）。判定表は ADR-0028 の 3 節、見本は `contract/judge.sh` と `contract/entitlement-vectors.json`（決定 1）
- 写すのは `subscribe.sh clerk-sync`（契約・解約のあと）と `hold`・`unhold`（支払いが遅れたとき）。毎月の `resync` が全件を送り直す（2 節）
- Clerk のアプリケーションは新しく作り、本番のドメインは `cor-jp.com` にする（決定 11）。Clerk Billing は使わない（請求の通貨が USD だけで、消費税に対応していない。ADR-0028 の代替案）
- サービスの役割と所属は、今までどおり各サービスの DB に持つ（Clerk の独自の役割は使わない。決定 3）

## 1B. 入口の段階案

入口は Cloudflare Access。段階の番号は ADR-0028 の「移行の順番と Yes の関門」に合わせた。

- **段階 0**: ADR-0028 を Accepted にする（#514 の merge）
- **段階 1（いま）**: Clerk のアプリケーションと開発のインスタンスを作り（寺田の画面の作業。P6・E6）、`clerk-sync`・`hold`・`unhold`・`resync` と試験ベクトル・検証の見本を入れ、最後に本番のインスタンスを作る。入口はまだ Access の許可メールで、寺田が契約とカードの保存を確かめてから手で足す（5 章、runbook C0〜C7）
- **段階 2**: business-dossier を Clerk に載せる（道 A）。**Clerk の認証が入ったら、そのサービスの Access を外す**（決定 5。Access の IdP は Clerk にしない）。製品は組織の metadata の `services` で機能を開け閉めする
- 個人のアカウントは許さない（組織が必須。決定 2）。メンバーの追加は Clerk の組織への招待にそろえる（決定 10）

## 1C. 請求の形（寺田、2026-11-07 の決定）

### 決まったこと

- 全ての顧客を、月末締め・翌月末払いにそろえる。初月は、利用の開始日にかかわらず 1 か月分を請求する（開発費用の回収のため）。
- 最低利用期間は契約から 1 年。その後は月単位の契約で、1 年ごとの自動更新にはしない。
- 解約は、受理日の 1 か月後の同じ日（同じ日が無い月は、その月の末日）に終わる。終了日を含む月の利用料は、終了日までの日割りで計算し、その月の末日の締めで請求する（2026-11-07 11:4x。11:3x の「受理した月の末日」はやめた）。
- 終了日が契約から 1 年未満なら、残りの期間分の利用料と、設計開発費用の分割の残りを、終了日を含む月の末日の締めで一括して請求する。どちらも違約金ではなく、契約した対価の残りとして扱う。ページでも「解約手数料」の語は使わない。
- 根拠: 顧問弁護士との MTG（tl;dv 6ae826bc…）で、1 年契約で途中解約時に残りの期間分を支払う内容は問題ない範囲、との見解を得た（寺田 2026-11-07 了承済み扱い）。
- 注記: テスター（無償や割引の試用）を設けるときは、解約料を設けず、本契約と別の書面にする。
- Stripe での作り方は B（下の表）に決まった（寺田 2026-11-07 11:4x）。
- 宣言は `plans.json` の `billing`（`closing: month_end`、`payment_due: end_of_next_month`、`first_month: full_month`）、`minimum_term`（`months: 12`、`on_early_termination: remaining_term_fees`、`dev_fee_on_early_termination: remaining_lump_sum`）、`cancellation`（`ends: accepted_plus_notice`、`notice_months: 1`、`final_period: prorated`、`refund: none`）。特商法ページの支払時期と解約条件の行とは、`tests/test-tokushoho-link.sh` が結ぶ。

### 実装の状態

**B は実装した（2026-11-07）。** `lib.sh` の `IMPLEMENTED_BILLING_CLOSING` は `month_end` で、`plans.json` の `billing.closing` と同じ。2 つは `tests/test-subscribe.sh` が結ぶ（片方だけ変えると、両方の値を出して落ちる）。前の形（`same_day_advance`）の写しを `--plans` で渡すと、新しいサブコマンドはテストモードでも本番でも、dry-run でも何もせずに止まる（exit 3）。前の形の部品（`basic`・`devfee`・前の `cancel`、`verify-installments.sh`）は外した。

契約と請求の記録は、Stripe の Customer の metadata に置く（subscription は使わない）。

| metadata | 書くサブコマンド | 中身 |
|---|---|---|
| `payment` | `customer --payment` | `card`（期限の日に当社が保存したカードで払う）か `transfer`（請求書のとおり振り込んでもらう） |
| `contract_<サービス>_start` | `contract --start` | 契約の開始日。開始の月を 1 か月目と数える |
| `contract_<サービス>_devfee_count` | `contract --devfee-count` | 開発費の回数（0〜12）。開始の月から 1 回ずつ |
| `contract_<サービス>_end` | `cancel --accepted` | 終了日（受理日の 1 か月後の同じ日） |
| `contract_<サービス>_hold` | `hold`・`unhold` | 支払いが遅れて止めているか（`true` のときだけ書く。外すときは空の値にして key を消す） |
| `card_setup_session` | `card-setup` | カードを保存する Checkout のページの id（`charge` がここからカードをたどる） |

毎月の流れ:

1. 月末の翌日に、寺田が顧客ごとに `invoice --month <先月>` を実行する。明細は `lib.sh` の `billing_lines` が計算する（`simulate` も同じ関数を使う）。サービスごとに、その月の利用料（開始の月は 1 か月分、終了の月は日割り）、開発費の 1 回分、終了の月が最低利用期間の中なら残りの期間分の利用料と開発費の残り。円未満は切り捨て。明細ごとに消費税と期間を付ける。
2. スクリプトは draft を作り、明細を足し、小計（税別）と明細の数を計算と照らしてから確定し（finalize）、送る（send）。違えば確定しない。同じ顧客・同じ月の請求書が既にあれば作らない（metadata の `billing_month` で探す）。作れるのは今月か先月の分だけ。
3. 支払期限は翌月末日の 23:59:59（日本時間）。カードの顧客は、期限の日に寺田が `charge --month <その月>` を実行する（保存したカードで `invoices/pay`）。期限の日より前と、振込の顧客には払わない。

テストモードでまだ測っていないこと（**未実測（T で確かめる）**）:

- 請求書のメール。テストモードでは送られない（Stripe の文書）。本番で最初の 1 通を寺田が確かめる。
- `invoices/pay` の成功。偽の応答でしか通していない。
- Checkout の setup のあと、カードが顧客に付くか（`charge` が SetupIntent の `payment_method` で払えるか）。
- 明細ごとの消費税の端数（今の金額では 10% で端数が出ないが、日割りと残りの期間分では出る。切り捨てか四捨五入かは Stripe の計算）。
- `due_date` が未来である必要があるか（文書に記載が無い。未確認）。作れる月を今月と先月に限っているので、期限はいつも今月末か来月末で、未来になる。
- invoice item の `customer` と invoice の `currency` は、2026-11-07 に確かめた API の一覧に入っていない（未照合）。テストモードで 400 が出たら、この 2 つを疑う。

### Stripe での作り方（B に決まった）

Stripe の公式文書（2026-11-07 に読んだ）で分かったこと:

- 毎月の末日に請求の区切りを置ける（`billing_cycle_anchor_config[day_of_month]=31`。31 日が無い月は末日）[30]。
- 定額の subscription は、いつも期間の初めに前払いで請求される。後払い（期間が終わってから請求）は、使用量に応じた価格だけに書かれている [30]。
- 期間の途中で始めて `proration_behavior=none` にすると、最初の区切りまでは無料になる。最初の短い期間に 1 か月分を請求する方法は書かれていない [30]。
- カードの自動引き落とし（`charge_automatically`）は、請求書の確定から遅らせられない [31]。請求書払い（`send_invoice`）は、顧客が請求書のページか振込で払う [31]。
- 単発の請求書には支払期限の日時（`due_date`）を付けられる。請求書の明細には期間と税率を付けられる [32]。開いている請求書を、保存したカードで当社から払える（`POST /v1/invoices/{id}/pay`）[33]。

| | 作り方 | 良い点 | 弱い点 |
|---|---|---|---|
| **B（決定）** | subscription を使わず、毎月末日に顧客ごとの請求書を 1 枚作る（その月の利用料、初月は 1 か月分、最後の月は日割り、開発費の 1 回分、終了日が 1 年未満なら残りの期間分の利用料と開発費の残りの一括）。支払期限は翌月末日（`due_date`）。カードの顧客は、期限の日に保存したカードで当社が払う（`invoices/pay`）。振込の顧客は請求書のとおり | 決まったことを全部そのまま書ける。今の請求書払いの顧客とも同じ形になる | 毎月末と毎月の期限の日に、スクリプトを動かす人か仕組みが要る（初めは寺田、あとで自動化）。カードを最初に保存する手順（Checkout の setup など）を新しく作る |
| 代替 A（採らない） | subscription のまま、区切りを毎月末日にし、カードを自動で引き落とす | Stripe の標準の動きで、毎月の作業が無い | 前払いになる（月末に翌月分を払う）。「翌月末払い」と書けない |
| 代替 C（採らない） | subscription のまま、区切りを毎月末日にし、請求書払い（`send_invoice`、`days_until_due` 30 日前後）にする | 毎月の作業が少ない | 前払いの請求書に期限を付ける形で、明細の期間は翌月になる。期限は日数でしか書けない |

### 残りの期間分の利用料と開発費の残りの数え方（推奨。寺田に確かめる）

- 契約の月（初月。短くても 1 か月分）を 1 か月目と数え、12 か月目の末日までを最低利用期間とする（「ご契約から 1 年間」をこう数える）。
- 最後の月の日割り = 10,000 円 × 終了日の日にち ÷ その月の日数、税別、円未満は切り捨て。
- 残りの期間分の利用料 = max(0, 10,000 円 × 12 − 終了日までに請求した利用料（初月は 1 か月分、最後の月は日割り）)、税別。終了日が 12 か月目の末日より後なら 0。
- 開発費の残り = 8,000 円 × max(0, 契約した回数 − 終了日を含む月までに請求した回数)、税別。残りの期間分の利用料と同じ請求書で一括。
- 例（仮の数字）: 11 月 15 日に契約（11 月が 1 か月目）、3 月 5 日に受理 → 4 月 5 日に終了。利用料は 11〜3 月の 5 か月分 50,000 円と、4 月の日割り 10,000 × 5 ÷ 30 = 1,666 円。残りの期間分の利用料 = 120,000 − 51,666 = 68,334 円。開発費は 11〜4 月の 6 回を請求済みなら、残り 6 回 = 48,000 円。4 月末の締めの請求書に足し、5 月末が支払期限。
- 残りの期間分の利用料と開発費の残りに消費税をかけるかは、税理士に確かめる（12 章の 2 と同じ相談）。どちらも対価の残りなので、毎月の利用料と同じく課税と見るのが自然（未確認）。

### 前からの顧客への適用

新しい請求の形・最低利用期間・残りの期間分の支払いは、さかのぼって当てない。前からの顧客は、2026-11 分から月末締め・翌月末払いに切り替える（10 月分は請求書のまま）。最低利用期間と残りの期間分の支払いは、書面で合意してから当て、元の契約月から数える（寺田 2026-11-07）。顧客ごとの値（社名・開始月・請求の方法）は、このリポジトリには書かず、非公開の台帳に書く（8 章）。

**決まったこと（寺田、2026-11-07 12:4x）:** 前からの顧客の `contract` は、`--start` に元の契約日を入れ、`--billing-from <この仕組みで請求を始める月>`（例: `2026-11`）を足す。Customer の metadata に `contract_<サービス>_bill_from` が入る。

- 最低利用期間・初月・開発費の回数は、元の契約日から数える（`--devfee-count` は契約した回数のまま。請求書払いで回収した回は、その月に請求済みとして数える）。
- `invoice` は `bill_from` より前の月を作らない（exit 3。その月は請求書払いで請求済み）。`bill_from` の月の利用料は 1 か月分で、初月の扱いにはしない。
- `bill_from` は一度書いたら変えない。契約を書いたあとから `bill_from` を足すこともしない（二重請求の元になる）。

## 1. 商品と価格

どのサービスを使うかは Customer の metadata（`contract_<サービス>_start`）で決まる。サービス → plans.json の `services[].entry` → 開ける入口（Cloudflare Access）の順にたどる。作り方 B の請求書は価格（Price）を使わず、plans.json の金額を明細の `amount` に入れる。商品と価格は、台帳として Stripe に作っておく（`apply-plans.sh`）。

| 商品 id | 商品名（請求書に出る。寺田が確定） | 種類 | 価格の lookup_key | 金額（税別） | 状態 |
|---|---|---|---|---|---|
| `cor_business_dossier` | business-dossier 利用料 | service | `business_dossier_basic_monthly` | 10,000 円 / 月 | 作る |
| 〃 | 〃 | 〃 | `business_dossier_premium_monthly` | 未定 | 枠だけ（`enabled: false`） |
| `cor_xesm` | XESM 利用料 | service | `xesm_basic_monthly` | 10,000 円 / 月 | 作る |
| 〃 | 〃 | 〃 | `xesm_premium_monthly` | 未定 | 枠だけ（`enabled: false`） |
| `cor_devfee_business_dossier` | business-dossier 設計開発費用（分割） | dev_fee | `business_dossier_devfee_monthly` | 8,000 円 / 月 × 12 回 | 作る |
| `cor_devfee_xesm` | XESM 設計開発費用（分割） | dev_fee | `xesm_devfee_monthly` | 8,000 円 / 月 × 12 回 | 作る |

- 商品の id は自分で決めた固定値にする（Stripe は商品 id の上書きを許す [1]）。価格は `lookup_key` で探す [2]。どちらも、何度実行しても同じものを指すため（冪等）。
- 開発費は、サービスごとに別の商品にする。請求書の行に商品名が出るので、どのサービスの開発費かが顧客に分かる。
- 価格の金額は、作ったあとに変えられない（価格の更新で変えられる項目に `unit_amount` が無い [3]）。金額を変えるときは、新しい lookup_key で価格を作り直す。`apply-plans.sh` は、既存の価格が plans.json と違えば上書きせずに止まる。
- premium を足すときは、plans.json の premium の行に金額を入れ、`enabled: true` にして `apply-plans.sh` を実行する。今の `subscribe.sh` の明細は basic の金額だけを読むので、premium の顧客を請求するには `lib.sh` の `load_amounts` と契約の metadata（どのプランか）も足す。日割りにするかは寺田が決める（未決）。
- 金額はゼロ小数の円で書く。`unit_amount` の 10000 は 10,000 円 [4]。JPY の最低請求額は 50 円 [4]。plans.json の上限（`limits.max_unit_amount_jpy` = 100,000 円）は、100 倍の打ち間違い（1,000,000）を落とすためにある。

## 2. 税

| 項目 | 方式 | 根拠 |
|---|---|---|
| 価格の表示 | すべて税別。価格の `tax_behavior` は `exclusive` | 一度 `inclusive` か `exclusive` にすると変えられない [2]。税込で作る事故は戻せないので、plans.json の検査と `apply-plans.sh` の照合の両方で落とす |
| 消費税の計算 | 手動の税率（Tax Rate）を 1 つ作る: 表示名「消費税」、10%、`inclusive=false`、国 `JP`、`tax_type=jct` | 税率の項目と `jct` の値 [5]。率と国は作成後に変えられない [5] |
| 税率の付け方 | 請求書の明細ごとの `tax_rates[]` に付ける（`subscribe.sh invoice`） | 明細に税率を付けられる [32]。手動の税率と自動計算（Stripe Tax）は混ぜない |
| 自動計算（Stripe Tax） | 今は使わない | 日本は対象だが、費用が取引ごとに 0.5%（API 経由は 1 取引 65 円）かかる [7]。顧客は国内の事業者で、税率は 10% の 1 つだけ。Stripe Tax が消費税をどう扱うかは未確認 |
| 適格請求書 | Cor の登録番号を、アカウントの税 ID（`jp_trn`）として請求書の PDF に載せられる [8] | **Stripe の請求書が適格請求書の要件を満たすかは未確認**（文書に記載なし）。寺田（税理士）が確かめる |

税込の額は参考として書く。basic は 11,000 円 / 月、開発費は 8,800 円 / 月。どちらも 10% で端数が出ない。

## 3. 開発費の分割（12 回で止める）

作り方 B（1C 章）では、開発費は毎月の請求書の明細の 1 行になる。subscription schedule は使わない（前の案 A の schedule と、それを test clock で測る `verify-installments.sh` は外した）。

- 回数は Customer の metadata `contract_<サービス>_devfee_count`（0〜12。plans.json の `installments` が上限）。`subscribe.sh contract --devfee-count` で書く。
- 開始の月を 1 回目として、毎月 1 回分（税別 8,000 円）を請求する。契約した回数の次の月からは請求しない（13 回目は無い。`tests/test-subscribe.sh` が確かめる）。
- 終了日が最低利用期間の中なら、終了の月の請求書に残りの回数分を一括で足す（`8,000 × (契約した回数 − 終了の月までに請求した回数)`）。
- 回数は顧客ごとに決まる。前からの顧客の残りの回数と数え方は 1C 章の「確かめたい点」。値は非公開の台帳に書く（8 章）。
- 回数を数えるのはスクリプトで、Stripe の機能ではない。Stripe 側に「あと何回」の記録は無い。請求書の明細の説明（`… 6/12 回目`）と metadata の `kind=devfee` が記録になる。
- 前の案で使った API の注意（subscription schedule の `iterations` は API の版 `2025-09-30.clover` で削除された [11] など）は、B では当たらない。

## 4. 顧客の識別（Clerk の組織 ↔ Stripe の顧客 ↔ Access の許可 ↔ 製品側の組織）

4 つの記録を、Clerk の組織の id と顧客コード（英小文字・数字・ハイフン。XESM の申込票の「顧客コード」と同じ規則）で結ぶ。

| 記録 | 正本 | 入れるもの |
|---|---|---|
| 身元（会社と利用者） | Clerk の組織（Organization） | 組織の id（`org_…`）、利用者のメール、`public_metadata.services`（1A 章。契約は Stripe が正本で、`clerk-sync` が写す） |
| 契約者（会社） | Stripe の Customer | 社名、請求先のメールアドレス、`metadata.customer_code`、`metadata.clerk_org_id`、`metadata.payment` |
| 使うサービスと契約 | Stripe の Customer の metadata | `contract_<サービス>_start`・`_devfee_count`・`_end`（1C 章の表） |
| 毎月の請求 | Stripe の請求書（月に 1 枚） | `metadata.billing_month`、`metadata.customer_code`。明細の `metadata.service`・`metadata.kind` |
| 入口（利用者ごと） | Cloudflare Access のポリシーの許可メール | 利用者のメールアドレス（1 社に複数）。**Stripe には写さない**（利用者のメールを決済事業者へ複製しない） |
| 製品側 | business-dossier: お客様ごとの起動（`bd-<slug>`、bd-deploy の報告 2 章）。XESM: 組織（Tenant。組織名で探す） | business-dossier なら slug（例の形: `c01`）、XESM なら組織名。作り方 B では Stripe に入れず、非公開の台帳に書く |

実際の行（どの顧客が、どのメールで、どの組織か）は、Stripe・Access・製品側にそれぞれあり、このリポジトリには書かない。突き合わせの手順は runbook C3。

## 5. 契約 → 入口を開ける（今週は手動）

作り方 B では、最初の支払いは契約の月の翌月末日（期限の日）に来る。入口は、支払いではなく契約とカードの保存（カードの顧客）を確かめてから開ける。どこまで確かめてから開けるかは寺田が決める（12 章の 10）。詳しい手順は runbook C0〜C7。

1. 契約書を交わし、非公開の台帳に 1 行足す（寺田）。
2. Stripe に Customer を作る（`subscribe.sh customer --payment card|transfer`）。
3. 契約を書く（`subscribe.sh contract --service <サービス> --start <契約日> --devfee-count <回数>`）。書く前に `simulate` で毎月の額を確かめる。
4. カードの顧客には、カードを保存するページの URL を作り（`subscribe.sh card-setup`）、寺田が送る。Checkout の `mode=setup` で、ページの期限はスクリプトの出力の `期限` の行。
5. カードが保存されたことを確かめる（`subscribe.sh status` の `CARD pm_…`）。
6. 製品側の準備: XESM は `contract-to-use.md` の手順 3〜7、business-dossier は `docs/deploy/onboarding.md`。
7. Access の許可メールに、顧客の利用者を足す（**公開スイッチ。寺田のみ**）。初回のログインを見届ける。
8. 毎月: 月末の翌日に `invoice --month <先月>`、期限の日（翌月末日）にカードの顧客だけ `charge --month <その月>`（runbook M1〜M3）。今月の分は締めの日（月の末日）からしか作れない。
9. 振込の顧客: 請求書の `footer` に当社の振込先を載せる（値は環境変数 `COR_BILLING_TRANSFER_FOOTER`。リポジトリに書かない。無ければ `invoice` は止まる）。入金を確かめたら `mark-paid --month <その月> --paid-on <入金日>` で、その請求書を Stripe の外で支払い済みにする（`invoices/pay` の `paid_out_of_band=true`。引き落とさない [33]）。open のままだと、請求書のページから二重に払われうる。
10. 確定のあと送付で止まった請求書は、やり直しで送り直す（送った記録は Customer の metadata `invoice_sent`。請求書の metadata を確定のあと変えられるかは文書に無いため）。

### 権利（services）を Clerk に写す・hold・照合・支払い方法

ADR-0028 で足した 4 つの操作。手順の全文は runbook E1〜E6。

| サブコマンド | いつ使うか | 何をするか |
|---|---|---|
| `clerk-sync --customer <cus_…>` | 契約・解約を書いたあと | 契約の metadata から `services` を作り、Clerk の組織の `public_metadata.services` に送る。契約の無いサービスは `null` で消す（ADR 2 節） |
| `hold` / `unhold --customer <cus_…> --service <サービス>` | 支払いが遅れたとき・払われたとき | `contract_<サービス>_hold=true` を書き、Clerk にも写す。`hold` は書き込みだけを止め、閲覧は残す（決定 1） |
| `resync` | 毎月の照合 | `clerk_org_id` を持つ全部の顧客の `services` を送り直し、`resync_at` を書く。同じ回で、請求書の支払いの期限の 14 日後を過ぎても open のものから `hold` を決めて書き直す（決定 1） |
| `set-payment --customer <cus_…> --payment card|transfer` | 段階 5（請求書払いからカードへ移す） | `metadata.payment` を変える。発行済みの請求書は変えない（次の締めから効く）。`card` へ変えるときは保存したカードがあることを確かめる |

`clerk-sync` は契約・解約・`hold` のあとに自動では走らない（片方だけ失敗して状態がずれるのを避けるため）。変えたら 1 回だけ実行する。写し忘れは `resync` が直す。

## 6. 解約 → 入口を閉じる

解約は、当社がお申し出を受理した日の 1 か月後の同じ日（同じ日が無い月は末日）に終わる。例: 3 月 5 日に受理したら 4 月 5 日。宣言は `plans.json` の `cancellation`（`notice_months: 1`、`final_period: prorated`、`refund: none`）で、特商法ページの解約条件の行とは `tests/test-tokushoho-link.sh` が結ぶ。詳しい手順は runbook D1〜D5。

1. 解約の申し出を受理したら、寺田が終了日を書く（`subscribe.sh cancel --customer <cus_…> --service <サービス> --accepted <受理日>`）。スクリプトは終了日を `contract_<サービス>_end` に書き、終了の月の明細を出す。Stripe には何も予約しない（subscription が無いので、`cancel_at` も日割りの按分も起きない）。
   - 受理日は今日以前の実在する日。終了日が契約の開始日より前なら止まる（exit 64）。別の終了日が既にあれば書き換えない（exit 3）。
   - 終了の月の請求書が既にあれば止まる（exit 3）。書いても、その月の日割りと残りが請求されないため。
2. 終了の月の末日の締めで、毎月の `invoice`（runbook M1）がその月の請求書に次を入れる。終了日までの日割り（円未満は切り捨て）、開発費の 1 回分（契約した回数の中なら）、終了日が最低利用期間の中なら残りの期間分の利用料と開発費の残り（1C 章の数え方）。支払期限は翌月末日。返金はしない（スクリプトは返金を作らない）。
3. 終了日を過ぎたら、**先に Access の許可から利用者を外し**、入口を閉じる。
4. 製品側の利用者を無効にする。XESM はお客様用の無効化の手順がまだ無い（xesm の報告 W6）。データの書き出しと消去は契約書に従う。
5. 支払いが失敗したとき（`charge` が `STOP: API エラー（HTTP 402、…）` で止まる、またはカードの確認を求められる）: 再請求のやり方と、何日で入口を閉じるかは寺田が決める（未決。12 章の 5）。

## 7. 自動化の案（来週以降）

- 毎月の作業: 月末の翌日の `invoice` と、期限の日の `charge` を、決まった日に動かす仕組み（はじめは寺田が手で実行する。runbook M1〜M2）。
- 受け口: Cloudflare Worker で Stripe の通知（`invoice.paid`、`invoice.payment_failed` [16]）を受け、署名を確かめる。
- 処理: 請求書の `metadata.customer_code` と、Customer の契約の metadata（`contract_<サービス>_end`）から、開けるべき・閉じるべき Access のポリシーを決める。利用者のメールは非公開の保管場所（KV か D1）から読む。足す・外す操作は、はじめは寺田の承認 1 回を挟む。
- 秘密: 通知の署名の鍵と Cloudflare の API token は、`register-secret-verified.sh` に査読済みの recipe が無い。recipe ができるまで手順に書かず、保留にする。
- 通知の受け口は作ったときの API の版で固定される [12]。作るときに `2026-10-28.endive` を選ぶ。

## 8. 過去の月の未回収分

顧客ごとの数字（どの月が、どの方法で請求済みか）は、非公開の台帳に書く。ここでは方法だけを比べる。

| 案 | 中身 | 向くとき |
|---|---|---|
| **a（推奨）** | すでに請求書（銀行振込）で請求した月は、その請求書のまま回収する。Stripe の請求は、切り替えの月から始める | 請求書を出し済みの月。2 つの経路で同じ月を請求する事故を避ける |
| b | Stripe で 1 回だけの請求書を作り、支払いページでカードで払ってもらう | まだどこにも請求していない過去の月を、カードでまとめて払ってもらうとき（`subscribe.sh invoice` は今月と先月しか作らないので、寺田が画面で作る。文言は未確認） |
| c | 開発費の回数に足す（`--devfee-count` を増やす） | 使わない。開始月と回数の対応が崩れ、台帳と合わなくなる |

二重請求を防ぐ決まり: `invoice` は、請求書払いで請求済みの月には実行しない。台帳には月ごとに「請求の方法・請求日・入金日」を書く。`invoice` は同じ月の 2 枚目を作らないが、Stripe の外で出した請求書は見えない。

## 9. テストモード → 本番

- 同じ `apply-plans.sh` を、`--mode test` で先に通し、そのあと `--mode live` で通す。商品 id と lookup_key は両方のモードで同じなので、手順のコマンドも同じになる。
- テストモードで作ったものが本番に写るかは確かめていない。写らない前提で、本番でも作る。
- `apply-plans.sh` は、書く前に `GET /v1/balance` の `livemode` を読む [17]。`--mode` と食い違えば、何も書かずに止まる（鍵の接頭辞では見分けない）。
- Stripe はテストモードの代わりにサンドボックスを勧めている [18]。寺田のアカウントがどちらを使うかは未確認。

## 10. 突合表

| 要求 | 設計書 | 宣言ファイル | 手順書 | 未確認の限界 |
|---|---|---|---|---|
| 商品 | 1 章 | `products` | T2〜T4・L2〜L3 | 商品名は寺田が確定。請求書の明細の説明にも商品名を出す |
| プラン（basic / premium の枠） | 1 章 | `prices[].plan`・`enabled` | T2・C3 | premium の金額は未定。明細は basic の金額だけを読む |
| 請求の形（月末締め・翌月末払い・初月 1 か月分） | 1C 章 | `billing` ↔ `lib.sh` の `IMPLEMENTED_BILLING_CLOSING` | T8・M1 | 結びは `test-subscribe.sh`。請求書のメールは未実測 |
| 開発費の分割 | 3 章 | `prices[].installments` | C3・M1 | 13 回目が無いことは偽の応答と `simulate` でだけ確かめた |
| 最低利用期間と残りの期間分 | 1C 章 | `minimum_term` | D1・M1 | 数え方（12 か月目の末日まで、円未満の切り捨て）は寺田に確かめる（12 章の 9） |
| 解約の終了日と最後の月の日割り | 1C・6 章 | `cancellation` | D1〜D3 | 終了の月の請求書は、本番では終了の月の翌月 1 日まで作れない |
| 税 | 2 章 | `tax_rate`・`tax_behavior` | T8 の `INVOICE` の行 | 適格請求書の要件は未確認。日割りと残りの期間分の消費税の端数は未実測 |
| 顧客の識別 | 1A・4 章 | `services` | C1〜C3 | 実際の行は repo に書かない。台帳の置き場所が未決。Clerk の組織の metadata の文書は未確認 |
| 身元（Clerk）と入口の段階 | 1A・1B 章 | — | C0（Clerk の組織を作る） | Clerk のアプリの作成は寺田。段階 1・2 は設計だけ |
| カードの保存 → 期限の日に払う | 5 章 | `services[].entry` | T7・T9・C4・M2 | Checkout の setup のあとカードが顧客に付くか、`invoices/pay` が通るかは未実測（T で確かめる） |
| 解約 → 入口を閉じる | 6 章 | — | D1〜D5 | XESM の利用者の無効化手順が無い |
| 未回収分 | 8 章 | — | C7 | 顧客ごとの数字は非公開の台帳 |
| 特商法 | 別 PR | — | — | 文言は寺田が確定 |
| 権利の写し（`services`）と hold | 1A・5 章 | `services` ↔ `contract/entitlement-vectors.json` ↔ `contract/judge.sh` | C7・E1〜E4 | Clerk の API のモード（test/live）は判別できない（未確認）。本物の Clerk では未実測 |
| 支払い方法の変更（段階 5） | 5 章 | `payment` | E5 | 本物のカードでは未実測。発行済みの請求書が変わらないことは偽の応答でだけ確かめた |
| 手順書 | — | — | runbook.md | Stripe の画面の文言は確かめていない |

## 11. 出典（2026-11-06 に読んだ）

1. 商品の作成（id の上書き）: https://docs.stripe.com/api/products/create
2. 価格の作成（`lookup_key`、`tax_behavior` は一度決めると変えられない）: https://docs.stripe.com/api/prices/create 、一覧（`lookup_keys` は 10 件まで）: https://docs.stripe.com/api/prices/list
3. 価格の更新（`unit_amount` が無い）: https://docs.stripe.com/api/prices/update
4. 通貨（JPY はゼロ小数、最低 50 円）: https://docs.stripe.com/currencies
5. 税率の作成（`tax_type=jct`）: https://docs.stripe.com/api/tax_rates/create 、https://docs.stripe.com/billing/taxes/tax-rates
6. subscription schedule のフェーズの `default_tax_rates`: https://docs.stripe.com/api/subscription_schedules/create
7. Stripe Tax の料金（販売のページで、技術文書ではない）: https://stripe.com/jp/tax
8. アカウントの税 ID（`jp_trn`）: https://docs.stripe.com/invoicing/taxes/account-tax-ids
9. schedule の `phases[].duration`・`end_behavior`・`start_date`: https://docs.stripe.com/api/subscription_schedules/create
10. subscription の `cancel_at` と日割り: https://docs.stripe.com/api/subscriptions/create
11. `iterations` の削除（`2025-09-30.clover`）: https://docs.stripe.com/changelog
12. API の版（今の版、通知の受け口の版）: https://docs.stripe.com/api/versioning
13. schedule の使い方（分割払いの例。`iterations` のまま）: https://docs.stripe.com/billing/subscriptions/subscription-schedules/use-cases
14. 顧客ポータル（schedule の変更を予定した subscription は顧客が変えられない）: https://docs.stripe.com/customer-management
15. `save_default_payment_method=on_subscription`: https://docs.stripe.com/api/subscriptions/create
16. subscription の通知: https://docs.stripe.com/billing/subscriptions/webhooks
17. 残高の `livemode`: https://docs.stripe.com/api/balance/balance_object
18. サンドボックス: https://docs.stripe.com/sandboxes
19. test clock（作成・進め方・上限）: https://docs.stripe.com/api/test_clocks/advance 、https://docs.stripe.com/billing/testing/test-clocks/api-advanced-usage
20. subscription の更新（`cancel_at_period_end`。2026-11-07 から解約は `cancel_at` を使う [28]）: https://docs.stripe.com/api/subscriptions/update
21. テスト用のカード（`pm_card_visa`、`4242 4242 4242 4242`）: https://docs.stripe.com/testing
22. Clerk Billing の概要（USD だけ、税と VAT に未対応、月払いか年払い、3DS に未対応、返金に未対応）: https://clerk.com/docs/billing/overview
23. Clerk Billing の組織のプラン（`has()`、既存の Stripe の商品と同期しない）: https://clerk.com/docs/nextjs/guides/billing/for-b2b
24. Clerk の料金（Billing の 0.7%、組織は 100 まで無料）: https://clerk.com/pricing
25. Clerk の metadata（public / private / unsafe、Stripe の顧客 id の例）: https://clerk.com/docs/users/metadata
26. Clerk を IdP にする（OAuth 2.0 / OIDC、スコープ `user:org:read` と `org_id`）: https://clerk.com/docs/advanced-usage/clerk-idp 、https://clerk.com/docs/guides/configure/auth-strategies/oauth/how-clerk-implements-oauth
27. Cloudflare Access の generic OIDC と、ポリシーの OIDC claim: https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/generic-oidc/ 、https://developers.cloudflare.com/cloudflare-one/access-controls/policies/
28. `cancel_at` が次の期間に入るとき、その期間は必ず日割りになる（2026-11-07 に読んだ）: https://docs.stripe.com/api/subscriptions/update 、https://docs.stripe.com/billing/subscriptions/cancel
29. 日割りの按分は秒単位、マイナスの按分は自動では返金されない（2026-11-07 に読んだ）: https://docs.stripe.com/billing/subscriptions/prorations
30. 請求の区切り（`billing_cycle_anchor_config`、月末、`proration_behavior=none` の最初の期間、定額は前払い）（2026-11-07 に読んだ）: https://docs.stripe.com/billing/subscriptions/billing-cycle 、https://docs.stripe.com/api/subscriptions/create
31. 引き落としと請求書払い（`charge_automatically` / `send_invoice`、`days_until_due`）（2026-11-07 に読んだ）: https://docs.stripe.com/billing/collection-method 、https://docs.stripe.com/billing/invoices/subscription
32. 単発の請求書の `due_date` と、明細の `period`・`tax_rates`（2026-11-07 に読んだ）: https://docs.stripe.com/api/invoices/create 、https://docs.stripe.com/api/invoiceitems/create
33. 開いている請求書を保存したカードで払う（`payment_method`、`off_session`）（2026-11-07 に読んだ）: https://docs.stripe.com/api/invoices/pay
34. 作り方 B の実装で使った API（2026-11-07 に統括が公式文書で確かめた事実。実装のレーンは読み直していない）: invoice item の `amount`・`currency`・`invoice`・`description`・`tax_rates[]`・`period[start]`/`period[end]`（両端を含む）・`metadata`、invoice の `collection_method=send_invoice`・`due_date`・`auto_advance`（既定 false）・`pending_invoice_items_behavior`（既定 exclude）・`metadata`、`finalize`・`send`（`auto_advance=false` ではメールが出ない。テストモードでは送られない）・`pay`、invoice の一覧（`customer`・`created`・`status` で絞れ、metadata では絞れない）と検索（`customer:"…" AND metadata["k"]:"v"`、反映に最大 1 分、障害時 1 時間）、Checkout Session の `mode=setup`（`currency` が要る。`payment_method_types` はこの版に無い）→ `setup_intent` → SetupIntent の `payment_method`: https://docs.stripe.com/api/invoiceitems/create 、https://docs.stripe.com/api/invoices/create 、https://docs.stripe.com/api/invoices/search 、https://docs.stripe.com/api/checkout/sessions/create

## 12. 確かめたい点（寺田）

1. 請求書に出る商品名（1 章の表）。
2. 適格請求書の要件を Stripe の請求書で満たすか。登録番号を `jp_trn` で載せるか。
3. 解約の終了日（受理日の 1 か月後の同じ日、最後の月は日割り）と最低利用期間（契約から 1 年、その後は月単位）は決まった（1C 章、2026-11-07）。
4. 開発費の途中解約は一括で請求すると決まった（1C 章、2026-11-07）。
8. 「翌月末払い」の作り方は B に決まった（1C 章、2026-11-07 11:4x）。
9. 「ご契約から 1 年間」を、契約の月を 1 か月目として 12 か月目の末日までと数えてよいか。最後の月の日割りの円未満を切り捨ててよいか（1C 章）。
5. 支払いが失敗してから入口を閉じるまでの日数。
6. 開始月から今月までの各月を、どの方法（請求書か Stripe か）で請求するか（8 章。顧客ごとの数字は非公開の台帳）。
7. （前の形の subscription の問題。作り方 B では起きない）
10. 入口を開けるのは、契約とカードの保存を確かめた時点でよいか（作り方 B では、最初の支払いは契約の月の翌月末日に来る。5 章）。
11. 前からの顧客の `contract` は決まった: 元の契約日 + `--billing-from`（1C 章、2026-11-07 12:4x）。
12. テストモードの `charge` は決まった: `--early-test` でテストモードだけ期限前に払える。本番では受け付けない（exit 64。2026-11-07 12:4x）。
13. Clerk の鍵が test 用か live 用かを、`clerk-sync` は API で確かめられない（**未確認**）。`--mode` は意図の宣言で、`live` のときは端末で `live` と打つ確認だけがある。確かめる道があれば教えてほしい。
14. `clerk-sync`・`hold`・`resync` は、契約の無くなったサービスを `null` にして Clerk から消す。`until` の無い契約では `until` のキーが残らない（PATCH の `null` がキーを消すため）。読み手は「`until` が無い = 終了日なし」として扱う（`contract/judge.sh` と試験ベクトル v31）。
