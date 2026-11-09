# 課金の手順書（寺田が実行する）

設計は [README.md](README.md)。この手順書のコマンドは、鍵を使うものも含めて寺田が実行する。AI のレーンは dry-run と `simulate` と、通信しない検査だけを実行する。

- 鍵は画面に出さない入力で受ける（スクリプトが聞く）。鍵をファイル・メモ・チャットに書かない。
- 先にコマンドを打ち、聞かれてから鍵をコピーして貼る（鍵をコピーしたあとにコマンドを貼ると、クリップボードが上書きされる）。
- Stripe の画面の名前・ボタンの名前は、確かめていないので書かない。書いたものには「未確認」と付けた。
- 顧客ごとの値（社名、メール、契約日、開発費の回数）は、この手順書にもリポジトリにも書かない。非公開の台帳に書く（C1）。
- `tee` で残すログには、顧客の社名とメールが入る。ログはホームの直下に置き、リポジトリに入れない。
- 請求の形は月末締め・翌月末払い（README 1C 章の作り方 B）。毎月末日に顧客ごとの請求書を 1 枚作り、カードの顧客は期限の日に保存したカードで当社が払う。
- 日付を出すコマンド（`date -v…`）は macOS の `date` の書き方。

## 寺田の手の一覧（順番・所要・前提）

所要はどれも見込みで、まだ測っていない。1 周目に実際の所要を書き足す。

| 順 | 手順 | 所要（見込み） | 前提 |
|---|---|---|---|
| 1 | P1・P5: Stripe と Clerk のアカウントを確かめる（画面） | 10 分 | なし |
| 2 | T1: テストモードの鍵を用意する（画面） | 5 分 | 1 |
| 3 | T2〜T4: テストモードに商品・価格・税率を作り、冪等を確かめる | 5 分 | 2、この PR の merge（または P3 の worktree） |
| 4 | T5〜T8: テストモードで顧客 1 社 → 契約 → カードの保存（ブラウザでテスト用カード）→ 請求書 | 20 分 | 3 |
| 5 | T9: テスト用カードで払う（テストモードだけ `--early-test` で期限前に払う） | 5 分 | 4 |
| 6 | T10: テストモードで解約を書く | 5 分 | 4 |
| 7 | L1〜L3: 本番の鍵を用意し、本番に商品・価格・税率を作る | 10 分 | 4〜6 が通った |
| 8 | C0: Clerk に顧客の組織を作る（画面） | 10 分 | 1 |
| 9 | C1: 契約書と台帳 | 契約の進み次第 | 台帳の置き場所（P4）が決まっている |
| 10 | C2〜C5: Customer と契約を書き、カードの顧客はカードを保存してもらう | 10 分 + 顧客の入力次第 | 7・8・9 |
| 11 | C6: 製品側の準備と Access の許可 | 製品側の手順書の所要（business-dossier は約 20 分、未計測） | 10 |
| 12 | M1〜M3: 毎月の請求（月末の翌日に invoice、期限の日に charge） | 1 社 5 分（見込み） | 10 |
| 13 | E1〜E4: 契約・解約のあとの `clerk-sync`、`hold` / `unhold`、毎月の `resync` | 1 社 5 分（見込み） | 10・12、Clerk のアプリ（P6） |
| 14 | E5: 支払い方法の変更（段階 5） | 1 社 10 分（見込み） | 13、顧客の同意 |

## 0. 前提

| # | 内容 | 実行者 | 状態（2026-11-07） |
|---|---|---|---|
| P1 | Stripe のアカウント（本人確認・入金先の口座を含む） | 寺田（画面の作業） | **未確認**。corsweb の特商法ページに「クレジットカード決済（Stripe）」の記載があり、アカウントはある見込み |
| P2 | 手元の Mac に `jq` と `curl` がある | — | 実測済み（2026-11-06 14:01）: `/usr/bin/jq`（jq-1.7.1-apple）、`/usr/bin/curl`（8.7.1） |
| P3 | 作業する場所 | 寺田 | PR の merge 前は下のコマンドで PR のブランチを取り出した worktree、merge 後は `~/Developer/corsweb`（develop） |
| P4 | 非公開の台帳の置き場所 | 寺田 | **未決**。列は C1 の表 |
| P5 | Clerk のアカウントとアプリケーション（組織の機能を有効にする） | 寺田（画面の作業） | **未確認**。Clerk Billing は使わない（README 1A 章）。Clerk の鍵はこのレーンが触らない |
| P6 | Clerk のアプリケーション（本番のインスタンス、Organizations、独自 claim `cor_svc`、Pro への変更） | 寺田（画面の作業） | **未確認**。ADR-0028 の決定 11（新しく作る。本番のドメインは `cor-jp.com`。Hobby から **Pro** にする。2 要素は Pro の機能で、決定 6 のため）。手順と値は非公開の報告（contract-billing レーン）の 2 章。画面の文言は未確認 |

P3 の場所を作って移る（merge 前。3 行を順に打つ）:

```bash
git -C ~/Developer/corsweb fetch origin feat/billing-invoice-model-20261107
```

```bash
git -C ~/Developer/corsweb worktree add ~/Developer/corsweb/.worktrees/claude/billing-invoice-20261107 FETCH_HEAD
```

```bash
cd ~/Developer/corsweb/.worktrees/claude/billing-invoice-20261107
```

鍵なしで動く検査を先に通す（通信しない）。順に `54 passed, 0 failed`、`235 passed, 0 failed`、`6 passed, 0 failed`、`ok: 最低利用期間を変えた plans.json では落ちる（反証）` が出ること:

```bash
bash docs/billing/tests/test-apply-plans.sh | tail -1
```

```bash
bash docs/billing/tests/test-subscribe.sh | tail -1
```

```bash
bash docs/billing/tests/test-gitleaksignore.sh | tail -1
```

```bash
bash docs/billing/tests/test-tokushoho-link.sh | tail -1
```

## T. テストモード

### T1. テストモードの鍵を用意する（画面の作業）

- テストモードの鍵を Stripe の画面で用意する。画面の場所と名前は**未確認**。
- 権限を絞った鍵（制限付きの鍵）にするなら、要る権限は次のとおり。**権限の画面での名前は未確認**。
  - 商品・価格・税率: 書き込み（T3）
  - 残高: 読み取り（全部のスクリプトがモードの確認に使う）
  - 顧客・請求書・請求書の明細: 書き込み（T5〜T10）
  - Checkout のページ（Checkout Session）: 書き込み。SetupIntent: 読み取り（T7）
  - 請求書の支払い（`invoices/pay`）に要る権限: **未確認**（T9 で 403 が出たら足す）
- この時点では鍵をコピーしない（スクリプトに聞かれてからコピーする）。

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

### T3. テストモードに商品・価格・税率を作る

```bash
bash docs/billing/apply-plans.sh --apply --mode test 2>&1 | tee ~/billing-apply-test-$(date +%Y%m%d-%H%M%S).log
```

1. `test モードの鍵を貼り付けて Enter（画面には出ない）:` と出たら、T1 の鍵をコピーして貼り、Enter。
2. 次が出ること:
   - `CHECK ok: 鍵のモード = test（観測 livemode=false）`
   - 1 回目は `CREATED tax_rate …`、`CREATED product …` が 4 行、`CREATED price …` が 4 行
   - 最後に `DONE apply --mode test`

請求書の消費税には、ここで作った税率を使う（`subscribe.sh invoice` が `metadata.plan_key` で探す）。

### T4. もう一度実行して、何も作られないことを確かめる（冪等）

ログのパスを決め、もう一度実行し、ログを数える（3 つとも同じ端末で続けて打つ）。

```bash
log=~/billing-apply-test-$(date +%Y%m%d-%H%M%S).log
```

```bash
bash docs/billing/apply-plans.sh --apply --mode test 2>&1 | tee "$log"
```

```bash
grep -c '^CREATED' "$log"; grep -c '^DONE apply --mode test' "$log"
```

`0` と `1` が出ること（作ったものは 0 件、最後まで通ったのが 1 件）。`DONE` が `0` なら、途中で止まっている（ログの `STOP:` の行を読む）。

### T5. 顧客を作る

テスト用の値: 顧客コード `cor-test`、社名 `Cor.株式会社（テスト）`、請求先のメール `company@cor-jp.com`、支払い方法 `card`、サービス `xesm`。テストモードでは請求書のメールは送られない（Stripe の文書。README 出典 [34]）。

```bash
bash docs/billing/subscribe.sh customer --code cor-test --name 'Cor.株式会社（テスト）' --email company@cor-jp.com --payment card --apply --mode test
```

`CREATED customer cus_…（customer_code=cor-test、payment=card、clerk_org_id=なし）` が出ること。`cus_…` の id を控える（台帳には書かない。テストだけ）。以下の `<cus_…>` はこの id。控え忘れたら次の `FOUND` の行で取れる（作った直後は 1 分ほど出ないことがある）:

```bash
bash docs/billing/subscribe.sh find --code cor-test --mode test
```

同じ customer のコマンドをすぐ（1 分以内に）もう一度実行し、出た行で次のように判定する（前回の結果の見分けが、実物の通信でも効くかの実測）。

| 出た行 | 判定 |
|---|---|
| `NOTE 顧客の作成: … 前回の結果が返った` のあとに、1 回目と同じ id の `CREATED customer` | 合格。前回の結果の見分けを実物の通信で測れた |
| `NOTE` の行が無いまま、1 回目と同じ id の `CREATED customer` | **不合格**。前回の結果の見分けが効いていない。本番（L）へ進まず、統括へ渡す |
| `OK customer cus_…`（検索で先に見つかった） | 測れていない。検索が追いついたため。前回の結果の見分けは「実物の通信では未測定」として記録する |
| 1 回目と違う id | **不合格**。同じ顧客が 2 つできた。本番へ進まず、統括へ渡す |

### T6. 契約を書く（開始日は先月の 15 日、開発費 12 回）

請求書を作れるのは今月か先月の分だけなので、テストでは契約の開始日を先月の 15 日にする。先に、毎月の額を通信せずに確かめる:

```bash
bash docs/billing/subscribe.sh simulate --service xesm --start "$(TZ=Asia/Tokyo date -v1d -v-1m '+%Y-%m')-15" --devfee-count 12 --months 2
```

`LINE <先月> usage_first 10000 <先月>-15〜<先月の末日> XESM 利用料 <先月>（初月。1 か月分）`、`LINE <先月> devfee 8000 … 1/12 回目`、`TOTAL <先月> 18000` が出ること（`<先月>` は `TZ=Asia/Tokyo date -v1d -v-1m '+%Y-%m'` の値）。

```bash
bash docs/billing/subscribe.sh contract --customer <cus_…> --service xesm --start "$(TZ=Asia/Tokyo date -v1d -v-1m '+%Y-%m')-15" --devfee-count 12 --apply --mode test
```

`CONTRACT <cus_…> xesm: start=<先月>-15 devfee_count=12 bill_from=なし` が出ること。もう一度実行すると `OK contract … 既に …（書かない）` が出る。

### T7. カードを保存する（ブラウザでテスト用カード）

```bash
bash docs/billing/subscribe.sh card-setup --customer <cus_…> --apply --mode test
```

1. `CREATED card-setup cs_…（期限 …）` と `SETUP_URL https://…` が出ること。
2. `SETUP_URL` をブラウザで開き、Stripe のテスト用カード番号（`4242 4242 4242 4242`、有効期限は未来の任意の月、CVC は任意の 3 桁。https://docs.stripe.com/testing ）を入れて終える。**ページの文言とボタンの名前は未確認**。終えると `https://cor-jp.com/` に戻る。
3. 状態を読む:

   ```bash
   bash docs/billing/subscribe.sh status --customer <cus_…> --mode test
   ```

   `CARD pm_…（card-setup（cs_… → seti_…））` が出ること。**Checkout の setup のあとカードが顧客に付くかは未実測**（この手順で確かめる）。`CARD なし（card-setup のページ: open）` のままなら、まだ入力が終わっていない。`complete` なのに `CARD なし` なら、統括へ渡す。

### T8. 先月分の請求書を作る

```bash
bash docs/billing/subscribe.sh invoice --customer <cus_…> --month "$(TZ=Asia/Tokyo date -v1d -v-1m '+%Y-%m')" --apply --mode test 2>&1 | tee ~/billing-invoice-test-$(date +%Y%m%d-%H%M%S).log
```

次の行が出ること:

```text
LINE <先月> xesm usage_first 10000 <先月>-15〜<先月の末日> XESM 利用料 <先月>（初月。1 か月分）
LINE <先月> xesm devfee 8000 <先月>-01〜<先月の末日> XESM 設計開発費用（分割） 1/12 回目
TOTAL <先月> 18000 円（税別、明細 2 行）
CREATED invoice in_…（draft、<先月> 分）
ADDED xesm usage_first 10000 円（税別）
ADDED xesm devfee 8000 円（税別）
CHECK ok: 小計 18000 円（税別）・明細 2 行は計算と一致
INVOICE in_… <先月>: status=open 税込 19800 円（うち消費税 1800 円）支払期限 <今月の末日> 23:59 JST
INVOICE_URL https://…
```

- `<今月の末日>` は `TZ=Asia/Tokyo date -v1d -v+1m -v-1d '+%Y-%m-%d'` の値。
- 税込の額が 19800 円でなければ、統括へ渡す（消費税が付いていない、または端数の扱いが違う）。
- 同じコマンドをもう一度実行し、`OK invoice <cus_…>: <先月> 分の請求書 in_… は既にある（status=open、税込 19800 円）。作らない` が出ること（同じ月の 2 枚目を作らない）。
- `INVOICE_URL` をブラウザで開くと、顧客が見る請求書のページが出る（中身の文言は未確認）。**テストモードではメールは送られない**。本番の最初の 1 通（M1）を寺田が受け取り側で確かめる。

### T9. テスト用カードで払う（テストモードだけ期限前に払う）

`--early-test` を付けなければ、期限の日より前は止まる。先に、止まることを確かめる（通信しない）:

```bash
bash docs/billing/subscribe.sh charge --customer <cus_…> --month "$(TZ=Asia/Tokyo date -v1d -v-1m '+%Y-%m')"
```

`STOP: <先月> 分の支払期限は <今月の末日>。期限の日より前は払わない（今日: …）` が出て、終了コードが 64 であること（`echo $?` で `64`）。

次に、`--early-test` を付けて、テストモードで今日払う（寺田 2026-11-07 の決定。本番では `--early-test` は exit 64 で止まる）。下のコマンドは T8 と同じ `<先月>` を入れる。月をまたいだら、`--month` の `"$(…)"` を T8 のログの `INVOICE in_… <先月>` の値に書き換える。

```bash
bash docs/billing/subscribe.sh charge --customer <cus_…> --month "$(TZ=Asia/Tokyo date -v1d -v-1m '+%Y-%m')" --early-test --apply --mode test 2>&1 | tee ~/billing-charge-test-$(date +%Y%m%d-%H%M%S).log
```

- `PLAN charge: 請求書 in_…（<先月> 分、税込 19800 円、期限 <今月の末日>）を pm_…（card-setup（…））で払う` のあと、`PAID in_… <先月>: 税込 19800 円を pm_… で払った` が出ること。**`invoices/pay` の成功は未実測**（この手順で確かめる）。
- `STOP: API エラー（HTTP 402、…）` なら、カードが断られたか、追加の確認を求められた。ログを統括へ渡す。
- もう一度実行すると `OK charge … は支払い済み（払わない）` が出ること。

### T10. 解約を書く（テストモード）

受理日は今日にする（下のコマンドがそのまま入れる）。

```bash
bash docs/billing/subscribe.sh cancel --customer <cus_…> --service xesm --accepted "$(TZ=Asia/Tokyo date '+%Y-%m-%d')" --apply --mode test
```

- `CANCEL <cus_…> xesm: 受理日 <今日> → 終了日 <1 か月後の同じ日>。<終了の月> 分の請求書（<終了の月の翌月 1 日> に invoice）に、次の明細が入る` と、その月の `LINE` の行（`usage_prorated`、`devfee`、`remaining_usage`、`remaining_devfee`）が出ること。
- 額の検算は通信しない `simulate` でもできる（`--end` に終了日を入れる）。終了の月の請求書は終了の月の翌月 1 日まで作れない（作れるのは今月か先月の分だけ）ので、この T では作らない。
- `status` の `CONTRACT xesm start=… devfee_count=12 end=<終了日>` で、終了日が書けたことを確かめる。

## L. 本番に切り替える

T2〜T10 が通ってから行う。

### L1. 本番の鍵を用意する（画面の作業）

T1 と同じ権限の鍵を、本番で用意する。画面の場所と名前は**未確認**。

### L2. 本番に商品・価格・税率を作る

```bash
bash docs/billing/apply-plans.sh --apply --mode live 2>&1 | tee ~/billing-apply-live-$(date +%Y%m%d-%H%M%S).log
```

1. 鍵を聞かれたら、本番の鍵を貼って Enter。
2. `CHECK ok: 鍵のモード = live（観測 livemode=true）` が出ること。
3. `本番（live）に上の PLAN を実行します。続けるなら live と打って Enter:` と出たら、上の `PLAN` の金額を読み、`live` と打って Enter。
4. `CREATED` が 9 行（または既存の分は `OK`）と、`DONE apply --mode live` が出ること。

### L3. もう一度実行して、何も作られないことを確かめる

T4 と同じ形で、モードだけ live にする（`live` と打つ確認が出る）。

```bash
log=~/billing-apply-live-$(date +%Y%m%d-%H%M%S).log
```

```bash
bash docs/billing/apply-plans.sh --apply --mode live 2>&1 | tee "$log"
```

```bash
grep -c '^CREATED' "$log"; grep -c '^DONE apply --mode live' "$log"
```

`0` と `1` が出ること。

## C. 顧客 1 社: 契約 → 入口を開ける（本番）

### C0. Clerk に顧客の組織を作る（寺田、画面の作業）

- P5 の Clerk のアプリケーションに、顧客の会社の組織を作り、組織の id（`org_…`）を控える。**画面の場所と名前は未確認。**
- 今週は、入口は Access の許可メールのまま（README 1B 章の段階 1）。Clerk の組織は C2 で Stripe の顧客に紐づけるために作る。
- 組織の `public_metadata.services`（権利の写し）は、C3 のあとに `clerk-sync`（E1）が書く。寺田が画面で入れる作業は無い。Clerk の組織の id（`org_…`）だけを控える。
- Clerk の準備が間に合わないときは、C2 を `--clerk-org` なしで実行してよい。あとから紐づけるときは、Stripe の顧客の metadata に `clerk_org_id` を足す（このスクリプトは既存の顧客を書き換えないので、寺田が画面で足す。画面の文言は未確認）。

### C1. 契約と台帳（寺田）

契約書を交わし、申込票を受け取り、非公開の台帳（P4）に 1 行足す。台帳の列:

| 列 | 中身 | 使う手順 |
|---|---|---|
| 顧客コード | 英小文字・数字・ハイフン（40 文字まで。XESM の申込票の顧客コードと同じ規則） | C2 |
| Clerk の組織の id | C0 で控えた `org_…` | C2 |
| 社名・請求先のメール | 申込票から | C2 |
| 支払い方法 | `card`（期限の日に当社が保存したカードで払う）か `transfer`（請求書のとおり振り込んでもらう） | C2・M2 |
| サービス | `business-dossier` か `xesm` | C3 |
| 製品側の組織 | business-dossier は起動の slug（bd-deploy の報告 6 章の推奨は `c01`）、XESM は組織名（XESM の `contract-to-use.md` 手順 6 の取得コマンドの出力）。Stripe には入れない | C6 |
| 契約日 | 契約の開始日（YYYY-MM-DD）。開始の月が 1 か月目。前からの顧客は元の契約日 | C3 |
| 請求を始める月 | 前からの顧客だけ。この仕組みで請求を始める月（YYYY-MM、例 2026-11）。それより前の月は請求書払いで請求済み。新しい顧客は空欄 | C3 |
| 開発費の回数 | 0〜12 | C3 |
| 月ごとの請求の方法・請求日・入金日 | 二重請求を防ぐため。請求書払いで請求済みの月には M1 を実行しない | M1・C7 |
| 受理日・終了日・入口を閉じた日時 | 解約のとき | D1〜D5 |

### C2. Customer を作る

`<顧客コード>`・`<社名>`・`<請求先のメール>`・`<支払い方法>`・`<Clerk の組織の id>` は台帳の同じ名前の列。まず dry-run（`--apply` なし）で PLAN を読む。

```bash
bash docs/billing/subscribe.sh customer --code <顧客コード> --name '<社名>' --email <請求先のメール> --payment <支払い方法> --clerk-org <Clerk の組織の id>
```

```bash
bash docs/billing/subscribe.sh customer --code <顧客コード> --name '<社名>' --email <請求先のメール> --payment <支払い方法> --clerk-org <Clerk の組織の id> --apply --mode live 2>&1 | tee -a ~/billing-live-<顧客コード>.log
```

`CREATED customer cus_…（customer_code=…、payment=…、clerk_org_id=org_…）`（既にあれば `OK customer cus_…`）が出ること。既存の顧客の `clerk_org_id` か `payment` が違えば `STOP: … が違う（期待 …、観測 …）` で止まる。id は次で取り直せる（作った直後は 1 分ほど出ないことがある）:

```bash
bash docs/billing/subscribe.sh find --code <顧客コード> --mode live
```

### C3. 契約を書く

`<cus_…>` は C2 の id、`<サービス>`・`<契約日>`・`<開発費の回数>` は台帳の列。先に毎月の額を通信せずに確かめる（13 か月分。12 か月目に開発費の 12 回目が出て、13 か月目は利用料だけになる）:

```bash
bash docs/billing/subscribe.sh simulate --service <サービス> --start <契約日> --devfee-count <開発費の回数> --months 13
```

```bash
bash docs/billing/subscribe.sh contract --customer <cus_…> --service <サービス> --start <契約日> --devfee-count <開発費の回数> --apply --mode live 2>&1 | tee -a ~/billing-live-<顧客コード>.log
```

`CONTRACT <cus_…> <サービス>: start=<契約日> devfee_count=<開発費の回数> bill_from=なし` が出ること。違う値が既にあれば `STOP: … が違う（期待 …、観測 …）。書き換えない` で止まる（台帳と見比べて寺田が決める）。

前からの顧客（台帳の「請求を始める月」に値がある顧客）は、上の代わりに次を実行する。`<契約日>` は元の契約日:

```bash
bash docs/billing/subscribe.sh contract --customer <cus_…> --service <サービス> --start <契約日> --devfee-count <開発費の回数> --billing-from <請求を始める月> --apply --mode live 2>&1 | tee -a ~/billing-live-<顧客コード>.log
```

`CONTRACT <cus_…> <サービス>: start=<契約日> devfee_count=<開発費の回数> bill_from=<請求を始める月>` が出ること。このあと `invoice` は、`<請求を始める月>` より前の月を `STOP: … より前を請求しない` で止める（その月は請求書払いで請求済み）。先に `simulate --billing-from <請求を始める月>` で月ごとの明細を確かめてよい。

### C4. カードを保存してもらう（支払い方法が card の顧客だけ）

```bash
bash docs/billing/subscribe.sh card-setup --customer <cus_…> --apply --mode live 2>&1 | tee -a ~/billing-live-<顧客コード>.log
```

- `SETUP_URL https://…` を顧客へ送る（送る経路と文面は寺田が決める。このレーンは送らない）。ページの期限は `CREATED card-setup cs_…（期限 …）` の行。
- 期限が切れたら同じコマンドで作り直せる（開いているページがあれば、作らずに同じ URL を出す）。

### C5. カードが保存されたことを確かめる

```bash
bash docs/billing/subscribe.sh status --customer <cus_…> --mode live
```

`CUSTOMER … payment=card`、`CONTRACT <サービス> start=<契約日> devfee_count=<回数> end=`、`CARD pm_…` が出ること。`CARD なし（card-setup のページ: open）` なら、まだ入力が終わっていない（`SETUP_URL` の行の URL を送り直せる）。

### C6. 製品側の準備と、入口を開ける

- XESM: `contract-to-use.md` の手順 3〜7（利用者・組織・案件）→ 手順 8（Access の許可メール。**寺田のみ**）。
- business-dossier: `docs/deploy/onboarding.md`（Access は最後）。
- 入口は最後に開ける。台帳に、開けた日時を書く。最初の支払いは契約の月の翌月末日に来る（README 5 章、12 章の 10）。

### C7. 過去の月の未回収分

README の 8 章。請求書（銀行振込）で請求済みの月は、その請求書のまま回収する。台帳の「月ごとの請求の方法」に書く。その月には M1 を実行しない。

## M. 毎月の請求（本番）

### M1. 月末の翌日（毎月 1 日）: 先月分の請求書を作る

台帳の顧客のうち、先月に契約があった顧客（先月が終了の月の顧客を含む）ごとに実行する。`<先月>` は `TZ=Asia/Tokyo date -v1d -v-1m '+%Y-%m'` の値（下のコマンドがそのまま入れる）。今月の分は、締めの日（月の末日）より前は `STOP: 今月（…）の分は、締めの日（…）から作る` で止まる。

振込の顧客（台帳の支払い方法が `transfer`）がいる月は、先に同じ端末で振込先を入れる。値は当社の振込先（銀行名・支店・口座の種類・番号・名義）で、請求書の下に載る。リポジトリにもログにも書かない（ログには文字数だけが出る）:

```bash
printf '振込先（1 行。例: お振込先: ○○銀行 ○○支店 普通 1234567 カ）コア）: ' && read -r COR_BILLING_TRANSFER_FOOTER && export COR_BILLING_TRANSFER_FOOTER
```

入れ忘れると、振込の顧客の `invoice` は `STOP: … 振込先（環境変数 COR_BILLING_TRANSFER_FOOTER）が無い` で止まる（何も作らない）。カードの顧客の請求書には載らない。

```bash
bash docs/billing/subscribe.sh invoice --customer <cus_…> --month "$(TZ=Asia/Tokyo date -v1d -v-1m '+%Y-%m')" --apply --mode live 2>&1 | tee -a ~/billing-live-<顧客コード>.log
```

1. `LINE` の行と `TOTAL <先月> … 円（税別、明細 … 行）` が出る。額を台帳と見比べる。
2. `本番（live）に上の PLAN を実行します。続けるなら live と打って Enter:` と出たら、額が正しいときだけ `live` と打つ。
3. `CHECK ok: 小計 … 円（税別）・明細 … 行は計算と一致`、`INVOICE in_… <先月>: status=open 税込 … 円（うち消費税 … 円）支払期限 <今月の末日> 23:59 JST` が出ること。台帳に請求日と税込の額を書く。
4. 最初の月は、請求書のメールが顧客に届くかを寺田が確かめる（**未実測**。送り先は Customer の請求先のメール）。
5. `DONE invoice: … 分に請求するものが無い` は、契約の開始の月より前か、終了の月より後。何も作っていない。
6. 確定のあとの送付で止まったら（通信の失敗など）、同じコマンドをもう一度実行する。`NOTE … は確定済みだが、送った記録が無い … 送り直す` のあと `SENT in_… <先月>: 送り直した` が出ること。送った記録は Customer の metadata `invoice_sent` に残る。

### M2. 期限の日（毎月の末日）: カードの顧客の先月分を払う

台帳の支払い方法が `card` の顧客ごとに実行する。期限の日（今月の末日）は `TZ=Asia/Tokyo date -v1d -v+1m -v-1d '+%Y-%m-%d'` の値。

```bash
bash docs/billing/subscribe.sh charge --customer <cus_…> --month "$(TZ=Asia/Tokyo date -v1d -v-1m '+%Y-%m')" --apply --mode live 2>&1 | tee -a ~/billing-live-<顧客コード>.log
```

`PLAN charge: 請求書 in_…（…、税込 … 円、期限 …）を pm_…（…）で払う` を読み、`live` と打つ。`PAID in_… <先月>: 税込 … 円を pm_… で払った` が出ること。台帳に入金日を書く。顧客が請求書のページから先に払っていれば `OK charge … は支払い済み（払わない）` が出る。

### M3. 振込の顧客の入金を確かめる

- 支払い方法が `transfer` の顧客は、請求書の下の振込先へ、期限の日までに振り込んでもらう。`charge` は止まる（`STOP: … の支払い方法が card でない`）。
- 入金を通帳か銀行の画面で確かめたら、その入金がどの月の分かを台帳で決め、その月の請求書を支払い済みにする（引き落とさない。open のままだと、請求書のページから二重に払われうる）。`<請求の月>` は台帳の請求の月（YYYY-MM。日付から計算しない。期限は翌月末日なので、確かめる日は月をまたぐことが多い）、`<入金日>` は入金を確かめた日（YYYY-MM-DD）:

```bash
bash docs/billing/subscribe.sh mark-paid --customer <cus_…> --month <請求の月> --paid-on <入金日> --apply --mode live 2>&1 | tee -a ~/billing-live-<顧客コード>.log
```

- `<請求の月>` より前の月の請求書が open のまま残っていれば `STOP: … より前の open の請求書がある: …` で止まる（何もしていない）。古い月から順に実行する。

- `PLAN mark-paid: 請求書 in_…（<先月> 分、税込 … 円）を、入金日 <入金日> の振込で支払い済みにする` を読み、額が入金と同じときだけ `live` と打つ。`MARKED_PAID in_… <先月>: …` が出ること。台帳に入金日を書く。額が違うとき（振込手数料を引かれた、など）は実行せず、寺田が決める。

## D. 解約 → 入口を閉じる（本番）

### D1. 終了日を書く

特商法ページの解約条件のとおり、当社が解約のお申し出を受理した日の 1 か月後の同じ日（同じ日が無い月は末日）を終了日にする。`<受理日>` は、お申し出のメールを受理した日（YYYY-MM-DD。台帳に書いた日）。

```bash
bash docs/billing/subscribe.sh cancel --customer <cus_…> --service <サービス> --accepted <受理日> --apply --mode live 2>&1 | tee -a ~/billing-live-<顧客コード>.log
```

`CANCEL <cus_…> <サービス>: 受理日 <受理日> → 終了日 <終了日>。…` と、終了の月の `LINE` の行が出ること。例: 受理日 `2026-03-05` なら終了日 `2026-04-05`。額は `simulate --end <終了日>` でも確かめられる（README 1C 章の例と同じ: 11/15 開始なら 4 月の請求書は日割り 1,666 円、開発費 8,000 円、残りの期間分 68,334 円、開発費の残り 48,000 円、合計 126,000 円・税別）。終了日を台帳に書く。

- 終了の月の請求書が既にあれば止まる（`STOP: 終了日を含む月 … の請求書 … が既にある`）。終了の月が終わる前に D1 を行う。
- スクリプトは返金を作らない。Stripe に終了の予約もしない（subscription が無い）。

### D2. 終了日を書けたことを確かめる

```bash
bash docs/billing/subscribe.sh status --customer <cus_…> --mode live
```

`CONTRACT <サービス> … end=<終了日>` が出ること。

### D3. 終了日を過ぎたら入口を閉じる

終了日の翌日から 30 日は、権利の判定が「読む・書き出すだけ」になる（決定 1。ADR-0028 の 3 節）。

- **製品が `services` を判定している段階（bd は段階 2、XESM は段階 3）**: 30 日は製品の判定（読む・書き出すだけ）が残す。**Access は Clerk の認証が入った時点で既に外れている**（README 1B の段階 2。決定 5）ので、ここで Access の作業はしない。Access をこの時点まで残していたなら、Clerk の認証を入れたときに外す
- **いまの段階 1（製品はまだ Clerk を見ていない。入口は Access だけ）**: 30 日を残す手段が無い（Access を残すと、書き込みもそのまま通る）。だから**終了日の翌日に Access から外す**（XESM は `contract-to-use.md` 手順 8 の逆。business-dossier は `onboarding.md` の Access の節の逆。**寺田のみ**）。段階 2・3 に移ったら、上の扱いに切り替える

台帳に閉じた日時と、どちらの扱いで閉じたかを書く。

### D4. 終了の月の請求書（M1 で作る）

終了の月の翌月 1 日の M1 では、いつもの `invoice` が終了日までの日割りと、終了日が最低利用期間の中なら残りの期間分の利用料と開発費の残りを入れる。期限は翌月末日で、カードの顧客は M2 で払う。その次の月からは `DONE invoice: … 分に請求するものが無い` になる。

### D5. 製品側の利用者を無効にする

XESM はお客様用の無効化の手順がまだ無い（xesm の報告 W6）。データの書き出しと消去は契約書に従う。無効にする時期は、D3 と同じ（段階 2・3 では 30 日が過ぎてから。段階 1 では終了日の翌日）。

## E. 権利を Clerk に写す・hold・照合・支払い方法（テストモード → 本番）

[README 1A 章](README.md)の権利（`services`）を Clerk の組織に写す手順と、支払いが遅れたときの止め方（ADR-0028 の 2 節と決定 1）。**本物の Clerk の API ではまだ確かめていない（未確認）。** 下の値は例で、実際の値は台帳から入れる。

Clerk の鍵は環境変数 `COR_CLERK_SECRET_KEY`。無ければスクリプトが表示しない入力で聞く（Stripe の鍵と同じ扱い。表示しない・ファイルに書かない・引数に載せない）。既定は dry-run で、書くのは `--apply --mode test|live` のとき。`live` は端末で `live` と打つ確認がある。

**`--mode` は Clerk を守らない。** `--mode` が確かめるのは Stripe の鍵のモード（`livemode`）だけで、Clerk の鍵が test 用か live 用かは API では分からない（未確認。README 12 章の 13）。だから `--mode test` でも、貼った Clerk の鍵の組織にそのまま PATCH する。**試験は開発用のインスタンスの鍵と組織で行い、`--apply` の前に dry-run の `PLAN services.…` と、顧客の `clerk_org_id` が開発用の `org_…` であることを確かめる。** 本番の組織に試験の `services` を書かない。

### E1. 契約・解約のあとに Clerk へ写す（`clerk-sync`）

1. dry-run。顧客を読むだけで、Clerk には送らない（Clerk の鍵も読まない）。

   ```bash
   bash docs/billing/subscribe.sh clerk-sync --customer cus_XXXXXXXXXXXX --mode test
   ```

   サービスごとに `PLAN services.<サービス> from=2026-12-01 until=null hold=false`、最後に `JSON {"public_metadata":{"services":{…}}}` が出る。`null` のサービスは Clerk から消える。
2. 送る。

   ```bash
   bash docs/billing/subscribe.sh clerk-sync --customer cus_XXXXXXXXXXXX --mode test --apply
   ```

   `SENT clerk org_XXXXXXXXXX: services を送った（…）` が出れば写った。本番は `--mode live --apply`。
3. `STOP:` が出たら、その文を台帳に残す。送る前の検査で止まったとき（実在しない日付、空の開始日、`clerk_org_id` が無い）は何も変わらない。応答が送った値と違うときは、送ったあとで戻せない。`clerk-sync` の dry-run か Clerk の画面で今の metadata を確かめる。
4. 契約・解約・`hold` のあとに**自動では走らない**。変えたら 1 回だけ実行する。写し忘れは E4 の `resync` が直す。

### E2. 支払いが遅れたら止める（`hold`）

期限の 14 日後を過ぎても払われていないサービスを止める（決定 1）。書き込みだけが止まり、閲覧は残る。

```bash
bash docs/billing/subscribe.sh hold --customer cus_XXXXXXXXXXXX --service xesm --apply --mode live
```

`HOLD cus_XXXXXXXXXXXX xesm: metadata に印を書いた。Clerk の組織に写す` が出る。Stripe の metadata と Clerk の両方に書くので、書き始める前に両方の鍵を読む（片方だけ書いた状態を作らない）。`clerk_org_id` の無い顧客と、契約の無いサービスは書かない。

### E3. 払われたら外す（`unhold`）

```bash
bash docs/billing/subscribe.sh unhold --customer cus_XXXXXXXXXXXX --service xesm --apply --mode live
```

`UNHOLD cus_XXXXXXXXXXXX xesm: metadata の印を消した。Clerk の組織に写す` が出る。metadata の key を消し（空の値にする）、Clerk の `services` の `hold` を `false` にする。

### E4. 毎月の照合（`resync`）

毎月、M1（請求書）のあとに 1 回。全件を送り直し、同じ回で hold を判定する（ADR-0028 の 2 節・決定 1）。

```bash
bash docs/billing/subscribe.sh resync --mode live --apply
```

`RESYNC 顧客 N 件を見る` のあと、顧客ごとに `RESYNC cus_…: Clerk の組織 org_… に services と resync_at を送った`、最後に `RESYNC 完了: 顧客 N 件、hold を書き直した顧客 M 件、Clerk へ送った顧客 K 件（resync_at …）` が出る。

- hold の判定: 請求書の支払いの期限の 14 日後を過ぎても open のものがあれば、そのサービスに hold を書く。無ければ外す。**期限の 14 日後ちょうどの日は、まだ過ぎていない**（その日の翌日から hold）。
- 顧客の一覧と請求書の一覧は 100 件ずつページを送る（`starting_after`）。
- `clerk_org_id` の無い顧客は Clerk へ送らない（`NOTE … clerk_org_id が無い（Clerk へは送らない）`）。

### E5. 支払い方法を変える（`set-payment`。段階 5）

請求書払い（振込）の顧客を、保存したカードでの引き落としに移す。

```bash
bash docs/billing/subscribe.sh set-payment --customer cus_XXXXXXXXXXXX --payment card --apply --mode live
```

`SET_PAYMENT cus_XXXXXXXXXXXX: transfer→card。発行済みの請求書は変えない（次の締めから効く）` が出る。

- `card` に変えるには、保存したカードが要る（`status` の `CARD pm_…`）。無ければ exit 3 で止まり、何も書かない。先に C4 でカードを保存してもらう。
- 発行済みの請求書は変えない。振込のまま払ってもらう（ADR-0028 の段階 5）。
- `transfer` へ戻すのは 1 行（カードの確認は要らない）。

### E6. Clerk の画面の作業（人間ゲート。**未確認**）

どれも寺田の手で、画面の文言は確かめていない。

| # | 作業 | 状態 |
|---|---|---|
| K2・K8 | Clerk のアプリケーションを新しく作る（ADR-0028 の決定 11。本番のドメインは `cor-jp.com`） | 未確認 |
| K2b | プランを Hobby から **Pro** に上げる（決定 6 の 2 要素を使うため。決定 11） | 未確認 |
| K3 | Organizations を有効にし、個人のアカウントを許さない（決定 2） | 未確認 |
| K4 | セッショントークンに独自 claim `cor_svc` = `{{org.public_metadata.services}}` を足す | 未確認 |
| K4b | U1〜U13 の実測用の OAuth アプリを作る | 未確認 |
| K4c | U12（承認者の段階認証）の準備 | 未確認 |
| K5〜K7 | 本番のインスタンスとドメイン、公開の値（Frontend API の URL・JWKS Public Key） | 未確認 |

手順と値は非公開の報告（contract-billing レーン、2 章）に置く。画面の文言を確かめたら、この表に書き足す。

## 問題が起きたら

| 出たもの | 原因 | 対処 |
|---|---|---|
| `NG: …` の行と `STOP: plans.json の検査で不合格`（exit 2） | plans.json の誤り（税込で書いた、100 倍、小数、税率を内税にした、回数が無い など） | `NG:` の行を読み、plans.json を直す PR を出す。何も作られていない |
| `STOP: plans.json の請求の形（billing.closing=…）は、このスクリプトの実装（month_end。…）と違う`（exit 3） | plans.json の `billing` を前の形（`same_day_advance`）にした、または `--plans` に古い写しを渡した | 何もしていない。plans.json を `month_end` に戻すか、`--plans` を外す |
| `STOP: 鍵のモードが --mode と違う（--mode test、観測 livemode=true）`（exit 3） | テストのつもりで本番の鍵を貼った（またはその逆） | 正しいモードの鍵で、同じコマンドをもう一度。何も作られていない |
| `STOP: 既存の価格 … が plans.json と違う: unit_amount 期待 10000 観測 …`（exit 3） | 前に違う金額で作った価格が残っている | 上書きはしない。新しい lookup_key で作るか、古い価格を使わないようにするかを寺田が決める |
| `STOP: 既存の税率 … が plans.json と違う`（exit 3） | 前に違う率・国で作った税率が残っている | 率と国は変えられない。作り直すかを寺田が決める |
| `STOP: metadata.plan_key=… の税率が 0 件（1 件のはず）。先に apply-plans.sh …`（exit 3） | そのモードで T3（または L2）をまだ実行していない | T3（L2）を先に実行する |
| `STOP: --month に未来の月は使わない` / `--month は今月か先月（…）だけ`（exit 64） | 月の打ち間違い、または先々月より前の月を作ろうとした | 先月か今月を入れる。それより前の月は寺田が画面で扱う（README 8 章の b） |
| `OK invoice …: … 分の請求書 in_… は既にある`（exit 0） | 同じ月の請求書を前に作った | 何も作っていない。`status` で状態を確かめる |
| `NOTE … 分の下書き in_… がある（前回が途中で止まった）。続きから行う` | 前回の invoice が通信の失敗などで途中で止まった | そのまま進めてよい。明細の無い下書きなら明細を足し、計算と合えば確定して送る |
| `STOP: 請求書 … の小計か明細の数が計算と違う（期待 …、観測 …）。確定しない`（exit 3） | 下書きに明細が途中までしか付いていない、または手で明細を足した | 確定していない。Stripe の画面で下書きを確かめて消し（画面の文言は未確認）、同じコマンドをもう一度 |
| `STOP: … 分の請求書 in_… は status=void。作り直さない`（exit 3） | その月の請求書を画面で取り消した | 作り直すかは寺田が決める（スクリプトは同じ月の 2 枚目を作らない） |
| `STOP: … 分の請求書が 2 件ある`（exit 3） | 同じ月の請求書が 2 枚ある（画面で作った、など） | どちらを残すかを寺田が決める。何も作っていない |
| `STOP: … に契約が無い（metadata に contract_<サービス>_start が無い。contract を先に）`（exit 3） | C3（T6）をまだ実行していない | C3 を先に実行する |
| `DONE invoice: … 分に請求するものが無い` | 契約の開始の月より前か、終了の月より後 | 何も作っていない。台帳の契約日と終了日を確かめる |
| `STOP: … 分の支払期限は …。期限の日より前は払わない`（exit 64） | 期限の日（その月の翌月の末日）より前に charge を実行した | 期限の日に実行する（M2） |
| `STOP: … の支払い方法が card でない（観測 payment=transfer）`（exit 3） | 振込の顧客に charge を実行した | 振込を待つ（M3）。`payment=なし` なら、Customer の metadata に `payment` が無い（C2 より前に作った顧客。足すかは寺田、画面の文言は未確認） |
| `STOP: … に保存したカードが無い（card-setup のページ: …）`（exit 3） | 顧客がカードの保存のページを終えていない、またはページを作っていない | C4 の URL を送り直す（`status` の `SETUP_URL` の行）。期限が切れていたら C4 をもう一度 |
| `STOP: 請求書 … の支払期限が計算と違う`（exit 3） | 請求書を画面で作った、または期限を画面で変えた | 払っていない。どうするかを寺田が決める |
| `STOP: API エラー（HTTP 402、…）`（exit 4。charge のとき） | カードが断られた、または追加の確認を求められた（日本のカードでの動きは未実測） | 払えていない。顧客に連絡するか、請求書のページから払ってもらうかを寺田が決める（README 6 章の 5） |
| `STOP: 請求書 … が支払い済みにならなかった`（exit 3） | 支払いの応答が paid でない | `status` で状態を確かめる。ログを統括へ渡す |
| `STOP: … の contract_… が違う（期待 …、観測 …）。書き換えない`（exit 3） | 前に別の値で contract を実行した | 台帳と見比べて寺田が決める |
| `STOP: 終了日 … が契約の開始日 … より前`（exit 64） | 受理日の打ち間違い | 台帳の受理日を確かめる |
| `STOP: … に別の終了日がある（期待 …、観測 …）。書き換えない`（exit 3） | 前に別の受理日で cancel を実行した | 台帳の受理日と見比べて寺田が決める |
| `STOP: 終了日を含む月 … の請求書 … が既にある`（exit 3） | 終了の月の請求書を作ったあとに cancel を実行した | 書いていない。その月の日割りと残りの扱いを寺田が決める |
| `STOP: …: 応答の metadata が期待と違う`（exit 3） | 書いたはずの値が応答に無い | `status` で今の値を確かめる。ログを統括へ渡す |
| `NOTE …: 24 時間以内に同じ内容で送った要求の、前回の結果が返った` のあと `STOP: … 今の状態が期待と違う`（exit 3） | 24 時間以内に同じ内容で作り直そうとした（消した下書き・取り消した請求書の作り直しなど） | 何も変わっていない。24 時間以上あけて同じコマンドを実行するか、`status` で今の状態を確かめる |
| `NOTE …: … 前回の結果が返った` のあと、そのまま `CREATED` や `PAID` が出る | 前回の作成や支払いがまだ生きている（読み直して確かめた） | そのまま進めてよい |
| `STOP: curl が失敗した（POST …）。POST なら書き込みが届いた可能性がある`（exit 4） | 通信が途中で切れた、30 秒で時間切れ | 同じコマンドを続けて実行しない。`status`（顧客の作成なら `find`）で今の状態を確かめてから決める。invoice なら、もう一度実行すると下書きの続きから行う |
| `STOP: curl 7.84 以上が要る`（exit 64） | 手元の curl が古い | `curl --version` で版を確かめる。2026-11-06 の手元の Mac は 8.7.1 |
| `STOP: set -x（bash -x）では鍵がトレースに出るので実行しない`（exit 64） | `bash -x` で動かした | `-x` を付けずに実行する |
| `STOP: API エラー（HTTP 400、…）`（exit 4） | Stripe が要求の項目を受け付けなかった。invoice item の `customer` と invoice の `currency` は、確かめた API の一覧に入っていない（README 1C 章） | ログを統括へ渡す |
| `STOP: API エラー（HTTP 401、…）`（exit 4） | 鍵の誤り、取り消された鍵、貼ったときに前後へ空白が入った | 鍵を貼り直す。スクリプトは鍵の形を検査しない（形は提供元が決める） |
| `STOP: API エラー（HTTP 403、…）`（exit 4） | 制限付きの鍵に権限が足りない | T1 の権限を足す（権限の画面の名前は未確認） |
| `STOP: 本番は端末から実行する`（exit 64） | 本番をパイプや自動実行で動かした | 端末から直接実行する（`live` と打つ確認が要る） |
| `STOP: 鍵が無い`（exit 64） | 端末でない場所から、鍵の環境変数なしで実行した | 端末から実行する |
| `STOP: … に clerk_org_id が無い（customer --clerk-org で作った顧客を使う）。Clerk に送らない`（exit 3） | Clerk の組織と結んでいない顧客 | C0・C2 で `--clerk-org org_…` を付けて顧客を作る。既存の顧客に足すかは寺田（画面） |
| `STOP: clerk_org_id の形が違う`（exit 3） | 組織の id の打ち間違い | 台帳の `org_…` を確かめる。何も送っていない |
| `STOP: contract_<サービス>_start が空（形が違う）。Clerk に送らない` / `… が実在する日付ではない`（exit 3） | Customer の metadata の契約の日付が壊れている | 送っていない。`status` で metadata を確かめ、寺田が直す方法を決める |
| `STOP: … に保存したカードが無い（…）。card にしない（期限の日に払えない）`（exit 3、set-payment） | カードを保存していない | C4 でカードを保存してもらってから、もう一度 |
| `STOP: Clerk の応答の services が送った値と違う（観測: …）。送ったあとなので戻せない`（exit 3） | Clerk が送った値と違うものを返した | 送ったあとは戻せない。`clerk-sync` の dry-run か Clerk の画面で今の metadata を確かめ、ログを統括へ渡す |
| `STOP: Clerk の鍵が無い: COR_CLERK_SECRET_KEY …`（exit 64） | 端末でない場所から、Clerk の鍵の環境変数なしで実行した | 端末から実行する（表示しない入力で受ける） |

## 実行者テスト（この文書だけで実行できるか）

| 手順 | この文書だけで実行できるか | 足りないもの |
|---|---|---|
| T2〜T10、L2〜L3 | できる（コマンド、テスト用の値、日付を出すコマンド、出るべき行がある） | 鍵の用意（T1・L1）は画面の作業で、画面の文言は未確認。Checkout のページの文言は未確認 |
| C2〜C5、M1〜M3、D1〜D2 | できる（`<…>` は台帳の同じ名前の列、`cus_…` は取得コマンドがある） | 台帳の置き場所（P4）が未決 |
| M3 の「支払い済み」にする操作 | **できない** | Stripe の画面の操作が未確認 |
| C6、D3 の Access | 製品側の手順書へ渡す | Access の画面の文言は製品側の手順書でも未確認 |
| E1〜E5 | できる（コマンドと出るべき行がある。値は台帳の列） | Clerk のアプリ（P6）が未確認。本物の Clerk では未実測 |
| E6・C0 | **できない** | Clerk の画面の文言（アプリケーションの作成・Organizations・独自 claim・Pro への変更）が未確認 |
| D5 | **できない** | XESM のお客様用の無効化の手順が無い（xesm の W6） |
