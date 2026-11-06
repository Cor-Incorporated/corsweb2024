# 課金の手順書（寺田が実行する）

設計は [README.md](README.md)。この手順書のコマンドは、鍵を使うものも含めて寺田が実行する。AI のレーンは dry-run と、通信しない検査だけを実行する。

- 鍵は画面に出さない入力で受ける（スクリプトが聞く）。鍵をファイル・メモ・チャットに書かない。
- 先にコマンドを打ち、聞かれてから鍵をコピーして貼る（鍵をコピーしたあとにコマンドを貼ると、クリップボードが上書きされる）。
- Stripe の画面の名前・ボタンの名前は、確かめていないので書かない。書いたものは「未確認」と付けた。
- 顧客ごとの値（社名、メール、残りの回数）は、この手順書にもリポジトリにも書かない。非公開の台帳に書く（C3）。

## 0. 前提

| # | 内容 | 実行者 | 状態（2026-11-06） |
|---|---|---|---|
| P1 | Stripe のアカウント（本人確認・入金先の口座を含む） | 寺田（画面の作業） | **未確認**。corsweb の特商法ページに「クレジットカード決済（Stripe）」の記載があり、アカウントはある見込み |
| P2 | 手元の Mac に `jq` と `curl` がある | — | 実測済み（14:01）: `/usr/bin/jq`（jq-1.7.1-apple）、`/usr/bin/curl`（8.7.1） |
| P3 | 作業する場所 | 寺田 | PR の merge 前は `~/Developer/corsweb/.worktrees/claude/billing-20261106`、merge 後は `~/Developer/corsweb`（develop） |

P3 の場所へ移る（merge 前）:

```bash
cd ~/Developer/corsweb/.worktrees/claude/billing-20261106
```

## T. テストモードで商品・価格・税率を作る

### T1. テストモードの鍵を用意する（画面の作業）

- テストモードの鍵を Stripe の画面で用意する。画面の場所と名前は**未確認**。
- 推奨は権限を絞った鍵（制限付きの鍵）。要る権限は「商品・価格・税率の書き込み」と「残高の読み取り」（`GET /v1/balance` でモードを確かめるため）。**権限の画面での名前は未確認**。
- この時点では鍵をコピーしない（T3 でスクリプトに聞かれてからコピーする）。

### T2. dry-run（通信しない・鍵を読まない）

```bash
bash docs/billing/apply-plans.sh
```

次の行が出ること（2026-11-06 14:06 に AI のレーンで実行した出力の要点）:

```text
mode: dry-run（通信しない・鍵を読まない）
CHECK ok: plans.json の検査（products 4、prices 6（有効 4、枠 2）、tax_rate 1）
api_version: 2026-10-28.endive
PLAN price business_dossier_basic_monthly: 10,000 円（税別）/月、参考 税込 11,000 円/月、…
SKIP price business_dossier_premium_monthly: 枠だけ（enabled=false。…）
PLAN price xesm_basic_monthly: 10,000 円（税別）/月、参考 税込 11,000 円/月、…
SKIP price xesm_premium_monthly: 枠だけ（enabled=false。…）
PLAN price business_dossier_devfee_monthly: 8,000 円（税別）/月、参考 税込 8,800 円/月、…、× 12 回（税別の総額 96,000 円。…）
PLAN price xesm_devfee_monthly: 8,000 円（税別）/月、参考 税込 8,800 円/月、…、× 12 回（税別の総額 96,000 円。…）
DONE dry-run: 何も作っていない。…
```

金額が上と違えば、先へ進まない（plans.json を直す PR を出す）。

### T3. テストモードに作る

```bash
bash docs/billing/apply-plans.sh --apply --mode test 2>&1 | tee ~/billing-apply-test-$(date +%Y%m%d-%H%M%S).log
```

1. `test モードの鍵を貼り付けて Enter（画面には出ない）:` と出たら、T1 の鍵をコピーして貼り、Enter。
2. 次が出ること:
   - `CHECK ok: 鍵のモード = test（観測 livemode=false）`
   - 1 回目は `CREATED tax_rate …`、`CREATED product …` が 4 行、`CREATED price …` が 4 行
   - 最後に `DONE apply --mode test`
3. ログには鍵は書かれない（スクリプトは鍵を出力しない。`tests/test-apply-plans.sh` が検査している）。

### T4. もう一度実行して、何も作られないことを確かめる（冪等）

```bash
bash docs/billing/apply-plans.sh --apply --mode test 2>&1 | tee ~/billing-apply-test-$(date +%Y%m%d-%H%M%S).log | grep -c '^CREATED'
```

鍵を貼ったあと、最後に `0` が出ること（全部 `OK … 既存と一致`）。

### T5. 分割が 12 回で止まることを確かめる（test clock）

**準備中（17:00 の最終報告で入れる）**。テストモードの test clock で、開発費の schedule が N 回請求して N+1 回目を請求しないことを実測する。これが済むまで、本番で開発費の schedule を作らない。

## L. 本番に切り替える

T2〜T4 が通ってから行う。

### L1. 本番の鍵を用意する（画面の作業）

T1 と同じ権限の鍵を、本番で用意する。画面の場所と名前は**未確認**。

### L2. 本番に作る

```bash
bash docs/billing/apply-plans.sh --apply --mode live 2>&1 | tee ~/billing-apply-live-$(date +%Y%m%d-%H%M%S).log
```

1. 鍵を聞かれたら、本番の鍵を貼って Enter。
2. `CHECK ok: 鍵のモード = live（観測 livemode=true）` が出ること。
3. `本番（live）に上の PLAN を作ります。続けるなら live と打って Enter:` と出たら、上の `PLAN` の金額を読み、`live` と打って Enter。
4. `CREATED` が 9 行（または既存の分は `OK`）と、`DONE apply --mode live` が出ること。

### L3. もう一度実行して、何も作られないことを確かめる

T4 の `--mode test` を `--mode live` に変えて実行し、`0` が出ること。

```bash
bash docs/billing/apply-plans.sh --apply --mode live 2>&1 | tee ~/billing-apply-live-$(date +%Y%m%d-%H%M%S).log | grep -c '^CREATED'
```

## C. 顧客 1 社: 契約 → 入口を開ける

**C4・C5・C7 のスクリプト（`docs/billing/subscribe.sh`）は準備中（17:00 の最終報告で入れる）**。それまでは本番で顧客を作らない。

| # | 内容 | 実行者 |
|---|---|---|
| C1 | 契約書を交わす（サービス、プラン、開発費の有無と残りの回数、解約の条件） | 寺田 |
| C2 | 申込票を受け取る: 顧客コード（英小文字・数字・ハイフン）、社名、請求先のメール、サービス、利用者のメール | 寺田 |
| C3 | 非公開の台帳に 1 行足す: 顧客コード、サービス、プラン、開発費の残りの回数、月ごとの請求の方法。**台帳の置き場所は未決（寺田）** | 寺田 |
| C4 | Stripe に Customer と basic の subscription を作る（準備中のスクリプト） | 寺田 |
| C5 | 開発費があれば、開発費の schedule を作る（準備中のスクリプト。T5 の後） | 寺田 |
| C6 | 最初の請求書の支払いページの URL を顧客へ送る | 寺田（送信） |
| C7 | 支払いが済んだことを確かめる（請求書の状態が paid） | 寺田 |
| C8 | 製品側の準備と、Access の許可メールの追加（XESM: `contract-to-use.md` の手順 3〜8。business-dossier: `docs/deploy/onboarding.md`）。Access は最後に開ける | 寺田（Access）／ Claude（製品側の準備） |
| C9 | 過去の月の未回収分は、README の 8 章の方法で回収する（顧客ごとの数字は台帳） | 寺田 |

## D. 解約 → 入口を閉じる

| # | 内容 | 実行者 |
|---|---|---|
| D1 | basic の subscription を期間末で止める（`cancel_at_period_end=true`。準備中のスクリプト） | 寺田 |
| D2 | 期間末に subscription が終わったら、**先に** Access の許可から利用者を外す | 寺田 |
| D3 | 製品側の利用者を無効にする（XESM はお客様用の手順がまだ無い。xesm の報告 W6） | 寺田 ／ Claude |
| D4 | 台帳に解約日を書く。開発費の schedule は止めない（契約書の定めに従う） | 寺田 |

## 問題が起きたら

| 出たもの | 原因 | 対処 |
|---|---|---|
| `STOP: plans.json の検査で不合格` と `NG: …` の行（exit 2） | plans.json の誤り（税込で書いた、100 倍、小数、税率を内税にした、回数が無い など） | `NG:` の行を読み、plans.json を直す PR を出す。何も作られていない |
| `STOP: 鍵のモードが --mode と違う（--mode test、観測 livemode=true）`（exit 3） | テストのつもりで本番の鍵を貼った（またはその逆） | 正しいモードの鍵で、同じコマンドをもう一度。何も作られていない |
| `STOP: 既存の価格 … が plans.json と違う: unit_amount 期待 10000 観測 …`（exit 3） | 前に違う金額で作った価格が残っている | 上書きはしない。新しい lookup_key で作るか、古い価格を使わないようにするかを寺田が決める |
| `STOP: 既存の税率 … が plans.json と違う`（exit 3） | 前に違う率・国で作った税率が残っている | 率と国は変えられない。作り直すかを寺田が決める |
| `STOP: API エラー（HTTP 401、…）`（exit 4） | 鍵の誤り、取り消された鍵、貼ったときに前後へ空白が入った | 鍵を貼り直す。スクリプトは鍵の形を検査しない（形は提供元が決める） |
| `STOP: API エラー（HTTP 403、…）`（exit 4） | 制限付きの鍵に権限が足りない | T1 の権限を足す（権限の画面の名前は未確認） |
| `STOP: 本番は端末から実行する`（exit 64） | 本番をパイプや自動実行で動かした | 端末から直接実行する（`live` と打つ確認が要る） |
| `STOP: 鍵が無い`（exit 64） | 端末でない場所から、鍵の環境変数なしで実行した | 端末から実行する |

## 実行者テスト（この文書だけで実行できるか）

| 手順 | この文書だけで実行できるか | 足りないもの |
|---|---|---|
| T2〜T4、L2〜L3 | できる（コマンドと出るべき行がある） | 鍵の用意（T1・L1）は画面の作業で、画面の文言は未確認 |
| T5、C4・C5・C7、D1 | **できない** | スクリプトが準備中（17:00 の最終で入れる） |
| C3 | **できない** | 台帳の置き場所が未決（寺田） |
