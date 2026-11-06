# 契約と課金の設計（business-dossier / XESM）

2026-11-06 の設計案。Stripe の商品・価格・税率の作成、本番への切替、顧客への請求と案内は、すべて寺田が実行する。
AI のレーンは Stripe の API を鍵付きで呼ばない。鍵の値を読まない・書かない。

このリポジトリは公開されている。**顧客ごとの情報（社名、メールアドレス、開始月、回収の状況）はここに書かない。**
顧客ごとの数字は、非公開の台帳（寺田の手元と、統括への報告）に置く。

| ファイル | 中身 |
|---|---|
| [plans.json](plans.json) | 商品・価格・税率の宣言（機械可読）。金額は税別の円 |
| [apply-plans.sh](apply-plans.sh) | plans.json を読んで Stripe に冪等に作る。既定は dry-run（通信しない・鍵を読まない） |
| [subscribe.sh](subscribe.sh) | 顧客 1 社の契約（Customer・basic・開発費の schedule）、状態の読取、basic の期間末の解約。既定は dry-run |
| [verify-installments.sh](verify-installments.sh) | テストモード専用。test clock で、開発費が N 回で止まることと、basic の最初の支払いでカードが保存されることを実測する |
| [lib.sh](lib.sh) | 3 本が共有する部品（鍵の受け取り、モードの確認、API の呼出し） |
| [runbook.md](runbook.md) | 寺田が実行する手順（テストモード → 本番、顧客 1 社の契約 → 入口を開ける → 解約 → 閉じる） |
| [tests/](tests/) | 通信しない検査（偽の curl で、鍵が漏れないこと・モード違いで止まること・事故入力を落とすこと・13 回目の請求を不合格にすること）。`test-apply-plans.sh` 41 項目、`test-subscribe.sh` 71 項目。CI では回らないので手で回す |

## 0. 決まっていること（寺田、2026-11-06 13:5x）

- business-dossier と XESM は同じプロジェクトで管理する。Stripe のアカウントは 1 つにし、どのサービスを使うかはプラン（価格）で決める。
- 利用料は 1 サービスあたり 10,000 円（税別）/ 月。今のシステムは basic プラン。あとから premium プランを足せる形にする。
- 設計開発費用は 8,000 円（税別）/ 月 × 12 回の分割。Stripe に「開発費用」の特別プランを作って回収する。
- 開始月・回収済みの回数・未回収の月は顧客ごとに違うので、非公開の台帳に書く（8 章）。
- 追加の決定（寺田、2026-11-06 14:0x）: business-dossier と XESM のアカウントは Clerk で管理する。Clerk のアカウントと Stripe のサブスクリプションを紐づけ、今後の Cor. のサービスの共通の基盤にする（1A 章）。
- 1A 章の形（身元は Clerk の組織、課金は自前の Stripe、Clerk Billing は使わない、紐づけは双方の metadata、入口は段階 0 → 1 → 2）で進める（寺田、2026-11-06 14:5x）。

## 1A. 身元は Clerk、課金は Stripe

身元の正本は Clerk（利用者と組織）、課金の正本は Stripe にする。2 つを顧客の組織ごとに紐づけたものが、Cor. のサービスに共通の契約の基盤になる。business-dossier と XESM は、その上に載る最初の 2 つのサービス。

```text
Clerk（身元の正本）
  組織 org_…（顧客の会社）── privateMetadata に stripe_customer_id ──▶ Stripe（課金の正本）
    └ 利用者（メールアドレス）                                          Customer cus_…（metadata.clerk_org_id）
        │                                                                 ├ basic の subscription（サービスごと）
        │                                                                 └ 開発費の schedule（N 回で止まる）
        ▼                                                                       │
Cloudflare Access（入口）                                              支払い → 開ける / 解約 → 閉じる
  今週: 許可メールに利用者を足す（寺田の手）                          （今週は寺田の手。来週以降は通知で）
  来週以降: Clerk を OIDC の IdP にして、Clerk のログインで通す
        │
        ▼
製品側: business-dossier（お客様ごとの起動 bd-<slug>）／ XESM（組織 Tenant）
```

### Clerk Billing を使うか

Clerk には、Stripe で決済するプランと機能の仕組み（Clerk Billing）がある。今回の要件と照らすと、次の理由で**使わない**。表の Clerk Billing の列は、2026-11-06 に [22]〜[24] の公式文書を読んで確かめた（Clerk Billing は機能の追加が続いているので、使うかを見直すときは読み直す）。

| 要件 | Clerk Billing | Clerk + 自前の Stripe（推奨） |
|---|---|---|
| 円で請求 | 不可。請求の通貨は USD だけ [22] | 可。JPY はゼロ小数 [4] |
| 消費税（税別 10%） | 不可。税と VAT に未対応 [22] | 可。手動の税率（`tax_type=jct`）[5] |
| 12 回で止まる開発費 | 文書に記載なし（未確認）。期間は月払いか年払い [22] | 可。schedule の `duration` + `end_behavior=cancel` [9]（T5 で実測） |
| 組織（B2B）のプラン | 可。組織が持つプラン [23] | 可。Stripe の Customer を組織ごとに作り、Clerk の組織と紐づける |
| プランで使える機能を切る | 可。`has({ plan })`・`has({ feature })` [23] | 自前で持つ（Clerk の組織の metadata に契約中のサービスを書き、製品側で読む。来週以降） |
| 既存の Stripe の商品と価格 | 使えない。Clerk のプランは Stripe の商品と同期しない [23] | plans.json の商品と価格をそのまま使う |
| 手数料 | Stripe の手数料に加えて 0.7% [24] | Stripe の手数料だけ |
| 3D セキュア | 未対応。3DS の確認が要る支払いは失敗する [22] | Stripe の支払いページで扱える（日本のカードでの動きは T6 で確かめる） |

紐づけ方:

- Stripe の Customer の `metadata.clerk_org_id` に Clerk の組織の id を入れる（`subscribe.sh customer --clerk-org`）。
- Clerk の側には `privateMetadata.stripe_customer_id` を入れる。private metadata はバックエンドと webhook だけが読み書きでき、Clerk の文書も Stripe の顧客 id を例に挙げている [25]。**これは利用者（user）の metadata の文書で、組織（organization）の metadata の文書はまだ読んでいない（未確認）。**
- Clerk の組織は無料の範囲で使える（1 アプリあたり 100 組織まで、1 組織 20 人まで）[24]。

## 1B. 入口の段階案

| 段階 | 時期 | 入口 | 支払いとの結びつけ |
|---|---|---|---|
| 0 | 今週 | Cloudflare Access の許可メール（XESM の `contract-to-use.md` 手順 8、business-dossier の `onboarding.md`） | 寺田が支払いを確かめてから、手でメールを足す（5 章） |
| 1 | 来週以降 | Clerk を OIDC の IdP にして Access に登録する。Clerk は OAuth 2.0 / OIDC の提供者になれる [26]。Access の generic OIDC は Client ID・Client secret・Auth URL・Token URL・Certificate URL（JWKS）を要る [27] | Access のポリシーはメール（Emails）か OIDC の claim で絞れる [27]。組織の id（`org_id`）を claim に入れる `user:org:read` のスコープを Access が要求できるかは**未確認** [26][27] |
| 2 | その後 | 製品が Clerk で直接ログインする（XESM は Keycloak に Clerk を外部の IdP としてつなぐ、business-dossier はローカル認証を Clerk に置き換える） | 製品が Clerk の組織の metadata（契約中のサービス）を読んで機能を切る |

段階 1 と 2 は設計だけで、試していない。段階 1 の Client secret は、`register-secret-verified.sh` に査読済みの recipe が無いため手順に書かず保留にする（7 章と同じ）。

段階 1 の前提条件（どちらも未確認。今週の段階 0 には影響しない）:

1. Clerk の組織（organization）の private metadata に、バックエンドから `stripe_customer_id` を書けること。読んだのは利用者（user）の metadata の文書だけ [25]。
2. Cloudflare Access が、Clerk に `user:org:read` のスコープを要求し、`org_id` の claim でポリシーを絞れること。Access の文書の「OIDC のスコープに対応しない」という一文の読み方が定まらない [27]。満たせないときは、段階 1 のポリシーをメール（Emails）で絞る。

## 1. 商品と価格

どのサービスを使うかは、顧客の subscription に入れた価格で決まる。価格 → 商品 → 商品の `metadata.service` → 開ける入口（Cloudflare Access）の順にたどる。

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
- premium を足すときは、plans.json の premium の行に金額を入れ、`enabled: true` にして `apply-plans.sh` を実行する。既存の顧客を basic から移すときは、subscription の価格を差し替える。日割りにするかは寺田が決める（未決）。
- 金額はゼロ小数の円で書く。`unit_amount` の 10000 は 10,000 円 [4]。JPY の最低請求額は 50 円 [4]。plans.json の上限（`limits.max_unit_amount_jpy` = 100,000 円）は、100 倍の打ち間違い（1,000,000）を落とすためにある。

## 2. 税

| 項目 | 方式 | 根拠 |
|---|---|---|
| 価格の表示 | すべて税別。価格の `tax_behavior` は `exclusive` | 一度 `inclusive` か `exclusive` にすると変えられない [2]。税込で作る事故は戻せないので、plans.json の検査と `apply-plans.sh` の照合の両方で落とす |
| 消費税の計算 | 手動の税率（Tax Rate）を 1 つ作る: 表示名「消費税」、10%、`inclusive=false`、国 `JP`、`tax_type=jct` | 税率の項目と `jct` の値 [5]。率と国は作成後に変えられない [5] |
| 税率の付け方 | subscription と subscription schedule の各フェーズの `default_tax_rates` に付ける | どちらにも付けられる [6]。手動の税率と自動計算は同じフェーズで混ぜられない [6] |
| 自動計算（Stripe Tax） | 今は使わない | 日本は対象だが、費用が取引ごとに 0.5%（API 経由は 1 取引 65 円）かかる [7]。顧客は国内の事業者で、税率は 10% の 1 つだけ。Stripe Tax が消費税をどう扱うかは未確認 |
| 適格請求書 | Cor の登録番号を、アカウントの税 ID（`jp_trn`）として請求書の PDF に載せられる [8] | **Stripe の請求書が適格請求書の要件を満たすかは未確認**（文書に記載なし）。寺田（税理士）が確かめる |

税込の額は参考として書く。basic は 11,000 円 / 月、開発費は 8,800 円 / 月。どちらも 10% で端数が出ない。

## 3. 開発費の分割（12 回で止める）

| 案 | 中身 | 良い点 | 弱い点 |
|---|---|---|---|
| **A（推奨）** | 開発費の商品に月額の価格を作り、顧客ごとに subscription schedule を 1 フェーズで作る。`phases[0].duration` を `interval=month`、`interval_count=<残りの回数>`、`end_behavior=cancel` | 回数で止まる。止め忘れが無い。開始日を先の日付にできる [9] | 「ちょうど N 回請求する」と書いた文書は無い。**テストモードの test clock で N 回目の次が請求されないことを実測してから使う**（`verify-installments.sh`、runbook T5） |
| B | 普通の subscription に `cancel_at`（終了日時）を付ける | 作るのは 1 回 | 期間の途中に `cancel_at` が来ると日割りが起きる [10]。期間の境目ちょうどのときの動きは未確認 |
| C | 毎月、寺田が 1 回分の請求書を作る | Stripe の機能に頼らない | 顧客 × サービスごとに 12 回の手作業。漏れと二重請求の危険 |

次の点に気をつける。

- subscription schedule の `iterations`（回数）は、API の版 `2025-09-30.clover` で削除された [11]。今の版（`2026-10-28.endive` [12]）では `duration` か `end_date` を使う [9]。Stripe の使い方の案内（分割払いの例）は、まだ `iterations` で書かれている [13]。`apply-plans.sh` は `Stripe-Version: 2026-10-28.endive` を固定して送る。
- schedule の作成には、カードを保存する設定（`payment_behavior` / `payment_settings`）が無い。カードは basic の最初の支払いで保存し（5 章）、schedule の `default_settings.default_payment_method` にそのカードを指定する（この項目はある [9]）。**この組み合わせを通しで書いた文書は無い**ので、`verify-installments.sh` で実測してから使う（runbook T5）。
- test clock は 1 回に「最短の subscription の 2 期間」までしか進められず、1 つの clock に顧客は 3 人まで [19]。`verify-installments.sh` は 31 日ずつ N+2 回進める。
- 残りの回数は顧客ごとに決まる: `12 − 回収済みの回数 − Stripe 以外で請求する回数`。値は非公開の台帳に書く（8 章）。
- 顧客が basic を解約しても、開発費の schedule は止めない（分割で払う約束の残り）。途中で解約したときに残りをどう扱うか（一括で請求するか）は契約書で決める（未決）。
- 顧客ポータルからは、schedule に管理された subscription を顧客が解約できない [14]。開発費を顧客が誤って止めることはない。今週はポータルを使わない。

## 4. 顧客の識別（Clerk の組織 ↔ Stripe の顧客 ↔ Access の許可 ↔ 製品側の組織）

4 つの記録を、Clerk の組織の id と顧客コード（英小文字・数字・ハイフン。XESM の申込票の「顧客コード」と同じ規則）で結ぶ。

| 記録 | 正本 | 入れるもの |
|---|---|---|
| 身元（会社と利用者） | Clerk の組織（Organization） | 組織の id（`org_…`）、利用者のメール、`privateMetadata.stripe_customer_id`（1A 章。Clerk の設定は寺田） |
| 契約者（会社） | Stripe の Customer | 社名、請求先のメールアドレス、`metadata.customer_code`、`metadata.clerk_org_id` |
| 使うサービスとプラン | Stripe の Subscription | 価格（lookup_key で分かる）、`metadata.customer_code`、`metadata.service`、`metadata.tenant` |
| 入口（利用者ごと） | Cloudflare Access のポリシーの許可メール | 利用者のメールアドレス（1 社に複数）。**Stripe には写さない**（利用者のメールを決済事業者へ複製しない） |
| 製品側 | business-dossier: お客様ごとの起動（`bd-<slug>`、bd-deploy の報告 2 章）。XESM: 組織（Tenant。組織名で探す） | `metadata.tenant` に、business-dossier なら slug（例の形: `c01`）、XESM なら組織名を入れる |

実際の行（どの顧客が、どのメールで、どの組織か）は、Stripe・Access・製品側にそれぞれあり、このリポジトリには書かない。突き合わせの手順は runbook C3。

## 5. 支払い → 入口を開ける（今週は手動）

入口（Access の許可）は支払いを確かめてから最後に開ける。それまでの作業は顧客から見えない。詳しい手順は runbook C1〜C8。

1. 契約書を交わし、非公開の台帳に 1 行足す（寺田）。
2. Stripe に Customer を作る（`subscribe.sh customer`）。
3. basic の subscription を作る（`subscribe.sh basic`）。`payment_behavior=default_incomplete`、`payment_settings[save_default_payment_method]=on_subscription`、`default_tax_rates` に消費税。最初の支払いが済むとカードが subscription の既定になる [15]。スクリプトは、最初の請求書の税込の額が plans.json と合うことを確かめてから支払いページの URL を出す。
4. 支払いページの URL を、寺田が顧客へ送る（送信は寺田）。**23 時間以内に払われないと subscription は `incomplete_expired` になる** [15]ので、顧客と時間を合わせてから 3 を実行する。
5. 支払いが済んだことを確かめる（`subscribe.sh status` で `status=active`・`card=保存済み`。通知の名前は `invoice.paid` [16]）。
6. 開発費があれば、開発費の schedule を作る（`subscribe.sh devfee`。3 章）。
7. 製品側の準備: XESM は `contract-to-use.md` の手順 3〜7、business-dossier は `docs/deploy/onboarding.md`。
8. Access の許可メールに、顧客の利用者を足す（**公開スイッチ。寺田のみ**）。初回のログインを見届ける。

## 6. 解約 → 入口を閉じる

1. 解約の申し出を受けたら、寺田が basic の subscription を期間末で止める（`subscribe.sh cancel`。`cancel_at_period_end=true` [20]）。スクリプトは basic 以外（開発費）を止めない。
2. 期間末に subscription が終わる（通知 `customer.subscription.deleted` [16]）。**先に Access の許可から利用者を外し**、入口を閉じる。
3. 製品側の利用者を無効にする。XESM はお客様用の無効化の手順がまだ無い（xesm の報告 W6）。データの書き出しと消去は契約書に従う。
4. 支払いが失敗したとき（通知 `invoice.payment_failed` [16]）: 再請求の設定と、何日で入口を閉じるかは寺田が決める（未決）。

## 7. 自動化の案（来週以降）

- 受け口: Cloudflare Worker で Stripe の通知（`invoice.paid`、`customer.subscription.deleted`、`invoice.payment_failed` [16]）を受け、署名を確かめる。
- 処理: subscription の `metadata.customer_code` と `metadata.service` から、開けるべき Access のポリシーを決める。利用者のメールは非公開の保管場所（KV か D1）から読む。足す・外す操作は、はじめは寺田の承認 1 回を挟む。
- 秘密: 通知の署名の鍵と Cloudflare の API token は、`register-secret-verified.sh` に査読済みの recipe が無い。recipe ができるまで手順に書かず、保留にする。
- 通知の受け口は作ったときの API の版で固定される [12]。作るときに `2026-10-28.endive` を選ぶ。

## 8. 過去の月の未回収分

顧客ごとの数字（どの月が、どの方法で請求済みか）は、非公開の台帳に書く。ここでは方法だけを比べる。

| 案 | 中身 | 向くとき |
|---|---|---|
| **a（推奨）** | すでに請求書（銀行振込）で請求した月は、その請求書のまま回収する。Stripe の請求は、カードを登録した後の月から始める | 請求書を出し済みの月。2 つの経路で同じ月を請求する事故を避ける |
| b | Stripe で 1 回だけの請求書を作り、支払いページでカードで払ってもらう | まだどこにも請求していない過去の月を、カードでまとめて払ってもらうとき |
| c | 分割の回数に足す（schedule の回数を増やす） | 使わない。開始月と回数の対応が崩れ、台帳と合わなくなる |

二重請求を防ぐ決まり: schedule の回数は「Stripe で請求する月」だけを数える。台帳には月ごとに「請求の方法・請求日・入金日」を書く。

## 9. テストモード → 本番

- 同じ `apply-plans.sh` を、`--mode test` で先に通し、そのあと `--mode live` で通す。商品 id と lookup_key は両方のモードで同じなので、手順のコマンドも同じになる。
- テストモードで作ったものが本番に写るかは確かめていない。写らない前提で、本番でも作る。
- `apply-plans.sh` は、書く前に `GET /v1/balance` の `livemode` を読む [17]。`--mode` と食い違えば、何も書かずに止まる（鍵の接頭辞では見分けない）。
- Stripe はテストモードの代わりにサンドボックスを勧めている [18]。寺田のアカウントがどちらを使うかは未確認。

## 10. 突合表

| 要求 | 設計書 | 宣言ファイル | 手順書 | 未確認の限界 |
|---|---|---|---|---|
| 商品 | 1 章 | `products` | T2〜T4・L2〜L3 | 商品名は寺田が確定 |
| プラン（basic / premium の枠） | 1 章 | `prices[].plan`・`enabled` | T2・C3 | premium の金額は未定 |
| 開発費の分割 | 3 章 | `prices[].installments` | T5・T6・C6 | 「ちょうど 12 回」は T5 の実測待ち（AI のレーンは偽の応答でしか通していない） |
| 税 | 2 章 | `tax_rate`・`tax_behavior` | T2・C3 の CHECK | 適格請求書の要件は未確認 |
| 顧客の識別 | 1A・4 章 | `services` | C1〜C3 | 実際の行は repo に書かない。台帳の置き場所が未決。Clerk の組織の metadata の文書は未確認 |
| 身元（Clerk）と入口の段階 | 1A・1B 章 | — | C0（Clerk の組織を作る） | Clerk のアプリの作成は寺田。段階 1・2 は設計だけ |
| 支払い → 入口を開ける | 5 章 | `services[].entry` | C2〜C7 | 支払いページにカードが出るかは T6 で確かめる |
| 解約 → 入口を閉じる | 6 章 | — | D1〜D4 | XESM の利用者の無効化手順が無い |
| 未回収分 | 8 章 | — | C8 | 顧客ごとの数字は非公開の台帳 |
| 特商法 | 別 PR | — | — | 文言は寺田が確定 |
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
20. subscription の更新（`cancel_at_period_end`）: https://docs.stripe.com/api/subscriptions/update
21. テスト用のカード（`pm_card_visa`、`4242 4242 4242 4242`）: https://docs.stripe.com/testing
22. Clerk Billing の概要（USD だけ、税と VAT に未対応、月払いか年払い、3DS に未対応、返金に未対応）: https://clerk.com/docs/billing/overview
23. Clerk Billing の組織のプラン（`has()`、既存の Stripe の商品と同期しない）: https://clerk.com/docs/nextjs/guides/billing/for-b2b
24. Clerk の料金（Billing の 0.7%、組織は 100 まで無料）: https://clerk.com/pricing
25. Clerk の metadata（public / private / unsafe、Stripe の顧客 id の例）: https://clerk.com/docs/users/metadata
26. Clerk を IdP にする（OAuth 2.0 / OIDC、スコープ `user:org:read` と `org_id`）: https://clerk.com/docs/advanced-usage/clerk-idp 、https://clerk.com/docs/guides/configure/auth-strategies/oauth/how-clerk-implements-oauth
27. Cloudflare Access の generic OIDC と、ポリシーの OIDC claim: https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/generic-oidc/ 、https://developers.cloudflare.com/cloudflare-one/access-controls/policies/

## 12. 確かめたい点（寺田）

1. 請求書に出る商品名（1 章の表）。
2. 適格請求書の要件を Stripe の請求書で満たすか。登録番号を `jp_trn` で載せるか。
3. 解約の申し出の期限、最低の利用期間、途中解約の日割り。
4. 開発費の途中解約のとき、残りを一括で請求するか。
5. 支払いが失敗してから入口を閉じるまでの日数。
6. 開始月から今月までの各月を、どの方法（請求書か Stripe か）で請求するか（8 章。顧客ごとの数字は非公開の台帳）。
