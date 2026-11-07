# 課金の手順書（寺田が実行する）

設計は [README.md](README.md)。この手順書のコマンドは、鍵を使うものも含めて寺田が実行する。AI のレーンは dry-run と、通信しない検査だけを実行する。

- 鍵は画面に出さない入力で受ける（スクリプトが聞く）。鍵をファイル・メモ・チャットに書かない。
- 先にコマンドを打ち、聞かれてから鍵をコピーして貼る（鍵をコピーしたあとにコマンドを貼ると、クリップボードが上書きされる）。
- Stripe の画面の名前・ボタンの名前は、確かめていないので書かない。書いたものには「未確認」と付けた。
- 顧客ごとの値（社名、メール、残りの回数）は、この手順書にもリポジトリにも書かない。非公開の台帳に書く（C1）。
- `tee` で残すログには、顧客の社名とメールが入る。ログはホームの直下に置き、リポジトリに入れない。

> **2026-11-07: 請求の形を月末締め・翌月末払いに変えた（README 1C 章）。** スクリプトはまだ前の形しか実装していないので、`subscribe.sh` の `basic`・`devfee`・`cancel` と `verify-installments.sh` は、何もせずに止まる（`STOP: plans.json の請求の形（billing.closing=month_end）は、このスクリプトがまだ実装していない…`、exit 3）。下の一覧の T5・T6・C3〜C6・D1 は、新しい形を実装してから行う。今も使えるのは P1〜P5、T1〜T4 と L1〜L3（`apply-plans.sh` で商品・価格・税率を作る）、C0〜C2（Clerk の組織、台帳、顧客）、`status`。

## 寺田の手の一覧（順番・所要・前提）

所要はどれも見込みで、まだ測っていない。1 周目に実際の所要を書き足す。

| 順 | 手順 | 所要（見込み） | 前提 |
|---|---|---|---|
| 1 | P1・P5: Stripe と Clerk のアカウントを確かめる（画面） | 10 分 | なし |
| 2 | T1: テストモードの鍵を用意する（画面） | 5 分 | 1 |
| 3 | T2〜T4: テストモードに商品・価格・税率を作り、冪等を確かめる | 5 分 | 2、この PR の merge（または P3 の worktree） |
| 4 | T5: 開発費が 12 回で止まることを、始め方 now と align の 2 回で実測する | 10 分（スクリプトの待ち 1 回 2〜3 分） | 3 |
| 5 | T6: 顧客 1 社をテストモードで 1 周する（ブラウザでテスト用カードを払う） | 15 分 | 3・4 |
| 6 | L1〜L3: 本番の鍵を用意し、本番に商品・価格・税率を作る | 10 分 | 4 が 2 回とも `VERIFY ok`、5 が通った |
| 7 | C0: Clerk に顧客の組織を作る（画面） | 10 分 | 1 |
| 8 | C1: 契約書と台帳 | 契約の進み次第 | 台帳の置き場所（P4）が決まっている |
| 9 | C2〜C3: Customer と basic を作り、支払いページの URL を受け取る | 5 分 | 6・7・8 |
| 10 | C4: URL を顧客へ送る（23 時間以内に払ってもらう） | 顧客の支払い次第 | 9 |
| 11 | C5〜C6: 支払いを確かめ、開発費の schedule を作る | 5 分 | 10、4 が 2 回とも `VERIFY ok`、台帳の回数と始め方 |
| 12 | C7: 製品側の準備と Access の許可（XESM は `contract-to-use.md`、business-dossier は `onboarding.md`） | 製品側の手順書の所要（business-dossier は約 20 分、未計測） | 11 |
| 13 | C8: 過去の月の未回収分を回収する | 依頼元との確認次第 | README 8 章の方法を寺田が決める |

## 0. 前提

| # | 内容 | 実行者 | 状態（2026-11-06） |
|---|---|---|---|
| P1 | Stripe のアカウント（本人確認・入金先の口座を含む） | 寺田（画面の作業） | **未確認**。corsweb の特商法ページに「クレジットカード決済（Stripe）」の記載があり、アカウントはある見込み |
| P2 | 手元の Mac に `jq` と `curl` がある | — | 実測済み（14:01）: `/usr/bin/jq`（jq-1.7.1-apple）、`/usr/bin/curl`（8.7.1） |
| P3 | 作業する場所 | 寺田 | PR の merge 前は `~/Developer/corsweb/.worktrees/claude/billing-20261106`、merge 後は `~/Developer/corsweb`（develop） |
| P4 | 非公開の台帳の置き場所 | 寺田 | **未決**。列は C1 の表 |
| P5 | Clerk のアカウントとアプリケーション（組織の機能を有効にする） | 寺田（画面の作業） | **未確認**。Clerk Billing は使わない（README 1A 章）。Clerk の鍵はこのレーンが触らない |

P3 の場所へ移る（merge 前）:

```bash
cd ~/Developer/corsweb/.worktrees/claude/billing-20261106
```

鍵なしで動く検査を先に通す（通信しない。`52 passed, 0 failed`、`107 passed, 0 failed`、`6 passed, 0 failed` が出ること）:

```bash
bash docs/billing/tests/test-apply-plans.sh | tail -1
```

```bash
bash docs/billing/tests/test-subscribe.sh | tail -1
```

```bash
bash docs/billing/tests/test-gitleaksignore.sh | tail -1
```

## T. テストモード

### T1. テストモードの鍵を用意する（画面の作業）

- テストモードの鍵を Stripe の画面で用意する。画面の場所と名前は**未確認**。
- 権限を絞った鍵（制限付きの鍵）にするなら、要る権限は次のとおり。**権限の画面での名前は未確認**。
  - 商品・価格・税率: 書き込み（T3）
  - 残高: 読み取り（全部のスクリプトがモードの確認に使う）
  - 顧客・subscription・subscription schedule・請求書・支払い方法: 書き込み（T5・T6）
  - test clock: 書き込み（T5）
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

### T5. 分割が 12 回で止まることを確かめる（test clock）

C6 の 2 つの始め方（`now` と `align`）を、両方とも通す（どちらを使う顧客が来ても、本番の前に測ってある状態にする）。

```bash
bash docs/billing/verify-installments.sh --start now 2>&1 | tee ~/billing-verify-now-$(date +%Y%m%d-%H%M%S).log
```

```bash
bash docs/billing/verify-installments.sh --start align 2>&1 | tee ~/billing-verify-align-$(date +%Y%m%d-%H%M%S).log
```

- それぞれ鍵を聞かれたら、テストモードの鍵を貼る。所要は 1 回 2〜3 分（clock を 14 回進める。1 回ごとに 7 秒以上あける）。
- 要求の本体は `subscribe.sh` と同じ `lib.sh` の組み立てを使うので、本番の C6 で送る要求そのものを実測する。
- 2 回とも、最後に次の 2 行が出ること:
  - `VERIFY 開発費: 支払い済み 12 件（期待 12）、それ以外 0 件（期待 0）、額の違う請求書 0 件（期待 0。各回 税込 8800 円・税 800 円）、subscription=canceled（期待 canceled）`
  - `VERIFY ok: 開発費は 12 回請求して止まった（13 回目は無い）`
- 途中の `VERIFY basic …: status=active、保存されたカード=pm_…` は、basic の最初の支払いでカードが保存されたことの実測。
- `VERIFY NG` が出たら、本番で開発費の schedule を作らない。ログを統括へ渡す。
- 作った test clock は自動で消える（`VERIFY clock …（自動で消える日時: …）` の行）。スクリプトは何も消さない。

### T6. 顧客 1 社の流れをテストモードで 1 周する

テスト用の値: 顧客コード `cor-test`、社名 `Cor.株式会社（テスト）`、請求先のメール `company@cor-jp.com`、サービス `xesm`、組織 `テスト`。テストモードでメールが送られるかは**未確認**（送られても宛先は自社のアドレス）。

1. Customer を作る。`CREATED customer cus_…` の id を控える（台帳には書かない。テストだけ）。

   ```bash
   bash docs/billing/subscribe.sh customer --code cor-test --name 'Cor.株式会社（テスト）' --email company@cor-jp.com --apply --mode test
   ```

   同じコマンドをすぐ（1 分以内に）もう一度実行し、出た行で次のように判定する（前回の結果の見分けが、実物の通信でも効くかの実測）。

   | 出た行 | 判定 |
   |---|---|
   | `NOTE 顧客の作成: … 前回の結果が返った` のあとに、1 と同じ id の `CREATED customer` | 合格。前回の結果の見分けを実物の通信で測れた |
   | `NOTE` の行が無いまま、1 と同じ id の `CREATED customer` | **不合格**。前回の結果の見分けが効いていない。本番（L）へ進まず、統括へ渡す |
   | `OK customer cus_…`（検索で先に見つかった） | 測れていない。検索が追いついたため。前回の結果の見分けは「実物の通信では未測定」として記録する |
   | 1 と違う id | **不合格**。同じ顧客が 2 つできた。本番へ進まず、統括へ渡す |

2. basic を作る。`<cus_…>` は 1 の出力の id。控え忘れたら `bash docs/billing/subscribe.sh find --code cor-test --mode test` の `FOUND` の行で取れる。

   ```bash
   bash docs/billing/subscribe.sh basic --customer <cus_…> --service xesm --tenant テスト --apply --mode test
   ```

   `CHECK ok: 最初の請求書 税込 11000 円（うち消費税 1000 円）` と `PAY_URL https://…` が出ること。
3. `PAY_URL` をブラウザで開き、Stripe のテスト用カード番号（`4242 4242 4242 4242`、有効期限は未来の任意の月、CVC は任意の 3 桁。https://docs.stripe.com/testing ）で払う。**支払いページにカードが出るかは未確認**（この手順で確かめる）。
4. 状態を読む。`SUB … plan=basic status=active … card=保存済み` が出ること。

   ```bash
   bash docs/billing/subscribe.sh status --customer <cus_…> --mode test
   ```

5. 開発費を作る（回数 2、すぐ始める）。`CREATED schedule … 2 回` が出ること。

   ```bash
   bash docs/billing/subscribe.sh devfee --customer <cus_…> --service xesm --count 2 --start now --apply --mode test
   ```

6. basic に終了日時を付ける。`<sub_…>` は 4 の `SUB` の行のうち `plan=basic` の id。受理日は今日の日付にする（下のコマンドがそのまま入れる）。`CANCEL_AT … に終わる（受理日 <今日> → 終了日 <1 か月後の同じ日> の終わり）` が出ること。

   ```bash
   bash docs/billing/subscribe.sh cancel --subscription <sub_…> --accepted "$(TZ=Asia/Tokyo date '+%Y-%m-%d')" --apply --mode test
   ```

7. 4 をもう一度実行し、basic の行が `cancel_at=<6 の終了日時の epoch 秒>`・`cancel_at_period_end=false`、開発費の `SCHEDULE` の行が残っていることを確かめる。終了日を含む期間の日割りの請求額は、この T では測れない（終了日まで 1 か月かかる）。test clock で測る手順はまだ無い（README 6 章）。

## L. 本番に切り替える

T2〜T6 が通ってから行う。

### L1. 本番の鍵を用意する（画面の作業）

T1 と同じ権限の鍵を、本番で用意する（test clock の権限は要らない）。画面の場所と名前は**未確認**。

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
- 今週は、入口は Access の許可メールのまま（README 1B 章の段階 0）。Clerk の組織は C2 で Stripe の顧客に紐づけるために作る。
- Clerk の組織の `privateMetadata.stripe_customer_id` に C2 の `cus_…` を入れる作業は、Clerk の鍵が要るので寺田が行う。やり方（画面か API か）は**未確認**。
- Clerk の準備が間に合わないときは、C2 を `--clerk-org` なしで実行してよい。あとから紐づけるときは、Stripe の顧客の metadata に `clerk_org_id` を足す（このスクリプトは既存の顧客を書き換えないので、寺田が画面で足す。画面の文言は未確認）。

### C1. 契約と台帳（寺田）

契約書を交わし、申込票を受け取り、非公開の台帳（P4）に 1 行足す。台帳の列:

| 列 | 中身 | 使う手順 |
|---|---|---|
| 顧客コード | 英小文字・数字・ハイフン（40 文字まで。XESM の申込票の顧客コードと同じ規則） | C2・C3 |
| Clerk の組織の id | C0 で控えた `org_…` | C2 |
| 社名・請求先のメール | 申込票から | C2 |
| サービス | `business-dossier` か `xesm` | C3・C5 |
| 製品側の組織 | business-dossier は起動の slug（bd-deploy の報告 6 章の推奨は `c01`）、XESM は組織名（XESM の `contract-to-use.md` 手順 6 の取得コマンドの出力） | C3 |
| 開発費の Stripe で請求する回数 | `12 − 回収済み − Stripe 以外で請求する回数`（README 8 章） | C6 |
| 月ごとの請求の方法・請求日・入金日 | 二重請求を防ぐため。カードで払う最初の月で C6 の `<開始>` が決まる | C6・C8 |

### C2. Customer を作る

`<顧客コード>`・`<社名>`・`<請求先のメール>`・`<Clerk の組織の id>` は台帳の同じ名前の列。まず dry-run（`--apply` なし）で PLAN を読む。

```bash
bash docs/billing/subscribe.sh customer --code <顧客コード> --name '<社名>' --email <請求先のメール> --clerk-org <Clerk の組織の id>
```

```bash
bash docs/billing/subscribe.sh customer --code <顧客コード> --name '<社名>' --email <請求先のメール> --clerk-org <Clerk の組織の id> --apply --mode live 2>&1 | tee -a ~/billing-live-<顧客コード>.log
```

`CREATED customer cus_…（customer_code=…、clerk_org_id=org_…）`（既にあれば `OK customer cus_…`）が出ること。既存の顧客の `clerk_org_id` が違えば `STOP: … の clerk_org_id が違う（期待 …、観測 …）` で止まる。id は次で取り直せる（作った直後は 1 分ほど出ないことがある）:

```bash
bash docs/billing/subscribe.sh find --code <顧客コード> --mode live
```

### C3. basic を作り、支払いページの URL を受け取る

`<cus_…>` は C2 の id、`<サービス>` と `<製品側の組織>` は台帳の列。

```bash
bash docs/billing/subscribe.sh basic --customer <cus_…> --service <サービス> --tenant '<製品側の組織>' --apply --mode live 2>&1 | tee -a ~/billing-live-<顧客コード>.log
```

- `CHECK ok: 最初の請求書 税込 11000 円（うち消費税 1000 円）` と `PAY_URL https://…` が出ること。
- `STOP: 最初の請求書の税込の額が違う` が出たら、URL を送らない（払われなければ 23 時間で失効する）。統括へ渡す。

### C4. 支払いページの URL を顧客へ送る（寺田）

- **23 時間以内に払ってもらう**（過ぎると subscription が `incomplete_expired` になり、C3 からやり直し）。先に顧客と時間を合わせてから C3 を実行する。
- 送る経路と文面は寺田が決める（このレーンは送らない）。

### C5. 支払いを確かめる

```bash
bash docs/billing/subscribe.sh status --customer <cus_…> --mode live
```

`SUB … service=<サービス> plan=basic status=active … card=保存済み` が出ること。`status=incomplete` のままなら、まだ払われていない。そのときは `PAY_URL <sub_…> https://…` の行に支払いページの URL が出る（送り直すときはこの URL を使う）。

### C6. 開発費の schedule を作る（開発費がある顧客だけ。T5 の now と align が両方合格してから）

`<回数>` は台帳の「開発費の Stripe で請求する回数」。`<開始>` は台帳の「月ごとの請求の方法」で決める。

| 台帳で、カードで払う最初の月が | `<開始>` | 動き |
|---|---|---|
| basic の最初の支払いと同じ月 | `now`（C5 で basic の支払いを確かめた直後、同じ日に実行する） | 開発費の 1 回目をすぐ請求する。2 回目からは basic とほぼ同じ日に毎月 |
| basic の次の請求の月 | `align` | basic の次の請求日から始める（同じ日に 2 つの請求が出る） |

`align` で始めると、basic の最初の月の開発費はカードで請求されない。その月を請求書で回収しないなら `now` にする。

```bash
bash docs/billing/subscribe.sh devfee --customer <cus_…> --service <サービス> --count <回数> --start <開始>
```

```bash
bash docs/billing/subscribe.sh devfee --customer <cus_…> --service <サービス> --count <回数> --start <開始> --apply --mode live 2>&1 | tee -a ~/billing-live-<顧客コード>.log
```

`CREATED schedule … <回数> 回` と `CHECK phases[0]: 開始 … → 終了 …` が出ること。開始と終了の日付を台帳に書く。

### C7. 製品側の準備と、入口を開ける

- XESM: `contract-to-use.md` の手順 3〜7（利用者・組織・案件）→ 手順 8（Access の許可メール。**寺田のみ**）。
- business-dossier: `docs/deploy/onboarding.md`（Access は最後）。
- 入口は最後に開ける。台帳に、開けた日時を書く。

### C8. 過去の月の未回収分

README の 8 章。請求書（銀行振込）で請求済みの月は、その請求書のまま回収する。台帳の「月ごとの請求の方法」に書く。

## D. 解約 → 入口を閉じる（本番）

> 2026-11-07 の請求の形（README 1C 章）では、D1 の `cancel` は止まる（exit 3）。新しい形の解約は、終了日（受理日の 1 か月後の同じ日、最後の月は日割り）は同じで、終了日が契約から 1 年未満なら、解約手数料（契約から 1 年間の利用料の総額 − 終了日までの利用料）と開発費の残りの一括を、最後の請求書に足す。その手順とコマンドは、README 1C 章の問いの答えが出てから書く。下の D1 は前の形の手順。

### D1. basic に終了日時を付ける

特商法ページの解約条件のとおり、当社が解約のお申し出を受理した日の 1 か月後の同じ日（同じ日が無い月は月末）を終了日にする。`<sub_…>` は C5 の `status` の出力のうち `plan=basic` の `SUB` の id。`<受理日>` は、お申し出のメールを受理した日（YYYY-MM-DD。台帳に書いた日）。

```bash
bash docs/billing/subscribe.sh cancel --subscription <sub_…> --accepted <受理日> --apply --mode live 2>&1 | tee -a ~/billing-live-<顧客コード>.log
```

`CANCEL_AT <sub_…>: <終了日の翌日> 00:00 JST に終わる（受理日 <受理日> → 終了日 <終了日> の終わり）。…` が出ること。例: 受理日 `2026-11-05` なら終了日 `2026-12-05`、`2026-12-06 00:00 JST に終わる`。終了日を台帳に書く。開発費の subscription を渡すと `basic でない` で止まる（開発費は止めない）。

決済事業者側の設定: スクリプトはこの終了日時を subscription の `cancel_at` に入れるだけで、`cancel_at_period_end` も `proration_behavior` も送らない。終了日時が次の期間に入るので、Stripe はその期間を必ず日割り（秒単位の按分）で請求し、自動では返金しない（README 6 章、出典 [10] [28] [29]）。終了日時が支払い済みの期間の中に来るとき（受理日を記録したのが遅れたとき、または請求日が 29〜31 日の顧客で短い月の末日の更新の直後に受理したとき。README 6 章）だけ、差額が顧客の残高に戻るので、スクリプトは止まる。

### D2. 終了日時を過ぎたら入口を閉じる

D1 の終了日時を過ぎたら、状態を読む。

```bash
bash docs/billing/subscribe.sh status --customer <cus_…> --mode live
```

basic の行が `status=canceled` になっていたら、**先に** Access の許可から利用者を外す（XESM は `contract-to-use.md` 手順 8 の逆。business-dossier は `onboarding.md` の Access の節の逆。**寺田のみ**）。

### D3. 製品側の利用者を無効にする

XESM はお客様用の無効化の手順がまだ無い（xesm の報告 W6）。データの書き出しと消去は契約書に従う。

### D4. 台帳に書く

受理日、終了日、入口を閉じた日時。開発費の schedule は契約書の定めに従い、止めない。

## 問題が起きたら

| 出たもの | 原因 | 対処 |
|---|---|---|
| `NG: …` の行と `STOP: plans.json の検査で不合格`（exit 2） | plans.json の誤り（税込で書いた、100 倍、小数、税率を内税にした、回数が無い など） | `NG:` の行を読み、plans.json を直す PR を出す。何も作られていない |
| `STOP: 鍵のモードが --mode と違う（--mode test、観測 livemode=true）`（exit 3） | テストのつもりで本番の鍵を貼った（またはその逆） | 正しいモードの鍵で、同じコマンドをもう一度。何も作られていない |
| `STOP: 既存の価格 … が plans.json と違う: unit_amount 期待 10000 観測 …`（exit 3） | 前に違う金額で作った価格が残っている | 上書きはしない。新しい lookup_key で作るか、古い価格を使わないようにするかを寺田が決める |
| `STOP: 既存の税率 … が plans.json と違う`（exit 3） | 前に違う率・国で作った税率が残っている | 率と国は変えられない。作り直すかを寺田が決める |
| `STOP: 価格 … が無い。先に apply-plans.sh …`（exit 3） | そのモードで T3（または L2）をまだ実行していない | T3（L2）を先に実行する |
| `STOP: この顧客には … の basic が既にある`（exit 3） | 同じ顧客・同じサービスに basic がある | `status` で状態を読む。`incomplete` のままなら、`status` の `PAY_URL` の行の URL を送り直す。失効（`incomplete_expired`）していれば C3 からやり直す |
| `NOTE …: 24 時間以内に同じ内容で送った要求の、前回の結果が返った` のあと `STOP: … 今の状態が期待と違う`（exit 3） | 24 時間以内に同じ内容で作り直そうとした（失効した basic の作り直し、取り消した解約のやり直し、消した商品の作り直し） | 何も変わっていない。24 時間以上あけて同じコマンドを実行するか、`status` で今の状態を確かめる |
| `NOTE …: … 前回の結果が返った` のあと、そのまま `CREATED` や `CANCEL_AT` が出る | 前回の作成や解約がまだ生きている（読み直して確かめた） | そのまま進めてよい |
| `STOP: plans.json の請求の形（billing.closing=month_end）は、このスクリプトがまだ実装していない`（exit 3） | 2026-11-07 に請求の形を月末締め・翌月末払いに決めたが、スクリプトは前の形しか作れない | 何もしていない。新しい形の実装（README 1C 章の問いの答えの後）を待つ。前の形で作り直さない |
| `STOP: 終了日時 … が支払い済みの期間（… まで）の中にある`（exit 3） | 受理日を入れたのが遅れ、終了日が今の期間（もう払われた期間）の中に来た。または請求日が 29〜31 日の顧客で、短い月の末日に更新された直後に受理した（例: 請求日 31 日、2 月 28 日に受理 → 終了日 3 月 28 日、支払い済みは 3 月 31 日まで） | 何も変えていない。そのまま止めると差額が顧客の残高に戻る。どう扱うかは寺田が決める |
| `STOP: … には既に別の終了日時がある` / `期間末で止まる設定（cancel_at_period_end=true）`（exit 3） | 前に別の受理日で実行した、または Stripe の画面で解約を設定した | 書き換えていない。`status` の `cancel_at=` と台帳の受理日を見比べて、寺田が決める |
| `STOP: --accepted に未来の日付は使わない` / `終了日 … は既に過ぎている`（exit 64） | 受理日の打ち間違い、または受理から 1 か月以上たってから実行した | 台帳の受理日を確かめる。終了日が過ぎていたら寺田が決める |
| `STOP: curl が失敗した（POST …）。POST なら書き込みが届いた可能性がある`（exit 4） | 通信が途中で切れた、30 秒で時間切れ | 同じコマンドを続けて実行しない。`status`（顧客の作成なら `find`）で今の状態を確かめてから決める |
| `STOP: curl 7.84 以上が要る`（exit 64） | 手元の curl が古い | `curl --version` で版を確かめる。2026-11-06 の手元の Mac は 8.7.1 |
| `STOP: set -x（bash -x）では鍵がトレースに出るので実行しない`（exit 64） | `bash -x` で動かした | `-x` を付けずに実行する |
| `STOP: … の basic が active でない` / `カードが保存されていない`（exit 3） | 最初の支払いがまだ | C5 で `status=active`・`card=保存済み` になってから C6 |
| `STOP: 最初の請求書の税込の額が違う`（exit 3） | 消費税が付いていない、または価格が違う | URL を送らない。統括へ渡す |
| `STOP: --start に過去の日付は使わない`（exit 64） | 過去の日付を渡した（過去の日付は遡って請求される） | `align` か今日以降の日付にする |
| `VERIFY NG: …`（exit 5） | 開発費が 12 回で止まらない、額が違う、カードが保存されない | 本番で開発費の schedule を作らない。ログを統括へ渡す |
| `STOP: API エラー（HTTP 401、…）`（exit 4） | 鍵の誤り、取り消された鍵、貼ったときに前後へ空白が入った | 鍵を貼り直す。スクリプトは鍵の形を検査しない（形は提供元が決める） |
| `STOP: API エラー（HTTP 403、…）`（exit 4） | 制限付きの鍵に権限が足りない | T1 の権限を足す（権限の画面の名前は未確認） |
| `STOP: 本番は端末から実行する`（exit 64） | 本番をパイプや自動実行で動かした | 端末から直接実行する（`live` と打つ確認が要る） |
| `STOP: 鍵が無い`（exit 64） | 端末でない場所から、鍵の環境変数なしで実行した | 端末から実行する |

## 実行者テスト（この文書だけで実行できるか）

| 手順 | この文書だけで実行できるか | 足りないもの |
|---|---|---|
| T2〜T6、L2〜L3 | できる（コマンド、テスト用の値、出るべき行がある） | 鍵の用意（T1・L1）は画面の作業で、画面の文言は未確認。支払いページにカードが出るかは T6 で確かめる |
| C2〜C6、D1〜D2 | できる（`<…>` は台帳の同じ名前の列、`cus_…` と `sub_…` は取得コマンドがある） | 台帳の置き場所（P4）が未決。開発費の回数は台帳の値で、10 月以降の扱い（統括への報告の J4）が決まるまで決まらない |
| C7、D2 の Access | 製品側の手順書へ渡す | Access の画面の文言は製品側の手順書でも未確認 |
| C0 | **できない** | Clerk の画面の文言と、組織の private metadata の書き方が未確認 |
| D3 | **できない** | XESM のお客様用の無効化の手順が無い（xesm の W6） |
