# 資料請求の社内通知: 手順書

対象は `POST /api/contact/document-request` の受付と、担当への社内通知です。受付は保存、通知は別の段階です。この手順書にある本番向けの操作は、実行していません。

## 決まっていること、決まっていないこと

寺田さん本人は 2026-11-12T09:21:21.565Z に、Codex のチャットで次の問いに答えました（記録: `統括/codex_fable_followup_20261112/evidence/user-decisions.json`）。問いは、申込みを保存し、社内の宛先（`cloudia@cor-jp.com`、CC は `company@cor-jp.com` と `nagisa.terada@cor-jp.com`）へ通知し、担当が手動で対応する、という案でした。資料は完了画面の公開リンクで渡し、申込者への自動返信は行わず、受付記録は 90 日保持します。回答の原文は「この案を採用。未達確認は寺田が毎営業日（推奨）」です。

- 決まっている: 上の運用方針、未達の確認は寺田さんが毎営業日に行うこと
- 決まっていない: 本番で通知を有効にすること、試しの送信。問いに「受入結果が揃ってから扱います」とあるので、この回答には含まれません

## 状態の読み方

状態は軸ごとに別です。ある軸の値を、別の軸の値として読まないでください。

| 軸 | 見る場所 | 値 | 読み替えてはいけないこと |
|---|---|---|---|
| 受付 | 応答の `status`、`submission_intake.status` | `stored` | 保存しただけです。資料を送った、担当が受け取った、とは読みません |
| 社内通知 | `notification_outbox`（`message_type='internal'`）の `status` / `delivery_status` / `last_error` | `queued`、`held`、`sending`、`accepted`、`failed` | `accepted` は送信器（Resend）が受け付けただけです。受信箱に届いた、担当が読んだ、とは読みません |
| 資料 | 応答の `delivered`（常に `false`）と結果画面のリンク | リンクを表示 | リンクを出しただけです。請求者が開いた、受け取った、とは読みません。Worker は開いたことを観測しません |
| 担当 | Worker は記録しません | メールの返信が証拠です | 通知の `accepted` を、担当が確認した、とは読みません |
| 案件同期 | `submission_intake.case_sync_status` | この段階では `''`（未接続） | 同期の状態は受付の状態ではありません |

社内通知の `delivery_status` の読み方です。

| `delivery_status` / `last_error` | 意味 | 次に起きること |
|---|---|---|
| `queued` / 空 | Queue に入れた。まだ処理していない | Queue が処理します。15 分以上残っていれば未達です |
| `queued` / `notify_not_enqueued` | 保存はできたが、Queue に入れられなかった。応答は `notification: 'pending'` | cron（15 分ごと）が、作成から 15 分たった行を Queue に入れ直します。1 回の cron で最大 50 件で、入れ直した行は後回しになり、順に回ります |
| `held` / `notify_not_released` | 送っていない。hold のまま、または解放時刻より前に作られた、解放時刻が無効 | 自動では送りません。「もう一度送らせる」の対象外です |
| `sending` | 処理中 | 完了か失敗に変わります。15 分以上 `sending` のまま残った行は、処理が途中で止まっています。自動では回収しません。「もう一度送らせる」で戻せます |
| `failed` / `provider_status_NNN` または `notification_failed` | 送信器が失敗した、または送信器を使えない（`RESEND_API_KEY` が無い） | Queue が最大 6 回（初回 + 再試行 5 回）まで試します。`attempts` が 6 になった行は DLQ に入り、cron も入れ直しません。「もう一度送らせる」で戻せます |
| `accepted`（`status='sent'`） | 送信器が受け付けた | 終わりです |

## 本番へ出す手順（人間ゲート）

どの手順も、寺田さんが Yes を出してから実行する操作です。作業ディレクトリは `workers/contact-chat` です。live にする 2 つの値は、専用の PR で `wrangler.toml` の本番側の `[vars]` に書きます。理由は 3 つです。解放時刻は設定値として仕様に書かれていること。`keep_vars` が無いので、dashboard で設定した値は次の配備で消えること。値が repo にあれば、切り替えが PR の差分として読めること。この PR（#530）には 2 つの値を足していません。

### 手順 1: preview の D1 に migration 0007 を当てる

0007 は `submission_intake` に `locale` 列を足すだけです。古いコードは列を無視するので、コードより先に当てても壊れません。

```bash
cd workers/contact-chat
npx wrangler d1 migrations apply cor-contact-chat-preview --remote --env preview
```

### 手順 2: 本番の D1 に migration 0007 を当てる

```bash
cd workers/contact-chat
npx wrangler d1 migrations apply cor-contact-chat-prod --remote
```

### 手順 3: 配備の前に、本番の D1 で未達の照会を実行する

下の「未達の確認」のコマンドを実行します。#510 の受付がすでに本番に出ていた場合に、`held` の行があるかを確かめるためです。`held` の行があれば、live にする前に寺田さんへ知らせます（この波には、`held` の行を送る入口がありません）。

### 手順 4: 解放時刻を作り、専用の PR を出す

解放時刻は、配備が終わる予定より後の時刻にします。次のコマンドは、今から 2 時間後の 10 桁の unix 秒を出します（macOS）。

```bash
date -v+2H +%s
```

出力を `RELEASED_AT` として控えます。`wrangler.toml` の本番側の `[vars]`（`CONTACT_FROM_EMAIL` の下）に、次の 2 行だけを足す PR を出します。`[env.preview.vars]` には書きません。

| 変数 | 現在値 | 設定値 |
|---|---|---|
| `DOCUMENT_REQUEST_NOTIFY_MODE` | 未設定（hold） | `"live"` |
| `DOCUMENT_REQUEST_NOTIFY_RELEASED_AT` | 未設定 | `"<控えた RELEASED_AT>"` |

2 つの値の片方だけ、`[env.preview.vars]` に live、10 桁でない解放時刻は、`document-notice-config.test.ts` が、観測した値を両方挙げて落とします。`RESEND_API_KEY` は問い合わせと同じ secret を使います。新しい鍵は作りません。

### 手順 5: merge して配備し、直後に解放時刻が未来であることを確かめる

```bash
cd workers/contact-chat
npx wrangler deploy
```

配備が終わったら、すぐに次を実行します。`<RELEASED_AT>` は手順 4 で控えた値です。

```bash
test "$(date +%s)" -lt <RELEASED_AT> && echo "OK: 解放時刻より前です" || echo "NG: 解放時刻が過ぎています。手順 4 からやり直します"
```

`NG` が出たら、配備に時間がかかりすぎました。解放時刻より後に hold の状態で作られた行は、同じ日の再申込みで送られてしまうので、新しい解放時刻で手順 4 から PR をやり直してください。解放時刻の日時は `date -r <RELEASED_AT>` で読めます。

### 手順 6: 解放時刻が過ぎてから、社内の合成申込みを 1 件だけ送る

解放時刻の前に作られた受付は、live でも送りません。`date -r <RELEASED_AT>` の時刻が過ぎるのを待ちます。ブラウザで `https://cor-jp.com/contact/materials/` を開き、氏名 `受入テスト`、メール `company@cor-jp.com`、同意あり、で送ります。実顧客のアドレスは使いません。`company@cor-jp.com` は CC にも入っているので、通知は 3 つの宛先（`cloudia@cor-jp.com`、CC の 2 件）に届きます。先に関係者へ伝えます。確かめることは 3 つです。

1. 結果画面に受付番号（`COR-` で始まる）が出る
2. `cloudia@cor-jp.com` に件名 `[資料請求] 受付 COR-…` のメールが 1 通届き、本文で受付番号、氏名、メール、会社名、業種、ページの言語、返信の言語を読める
3. 次の「未達の確認」の結果に、その受付番号が出ない（`accepted` のため）

## 止め方・戻し方

止めるときは、手順 4 で足した 2 行を消す PR を出して配備します。`DOCUMENT_REQUEST_NOTIFY_MODE` が `hold`（未設定）に戻り、キューは送らず `held` に戻します。

再び live にするときは、解放時刻を必ず新しくします（手順 4 から、新しい `date -v+2H +%s` で）。古い値を使い回してはいけません。止めていた間に `held` になった行のうち、古い解放時刻より後に作られたものは、同じ日の再申込みで送られてしまいます。

限界: この境界は手順で閉じていて、コードでは閉じていません（行は、`held` になった理由を持ちません）。

## 未達の確認（寺田さんが毎営業日）

寺田さんが毎営業日に、次のコマンドを 1 本実行します。作業ディレクトリは `workers/contact-chat` です。コマンドは、この手順書の次の SQL ブロックをそのまま取り出して、本番の D1 `cor-contact-chat-prod` で読み取りだけを実行します。

```bash
cd workers/contact-chat && npx wrangler d1 execute cor-contact-chat-prod --remote --json --command "$(awk '/^```sql$/{f=1;next} /^```/{f=0} f' RUNBOOK-document-request-notice.md)"
```

実行される SQL です（氏名・メール・会社名の列は選びません）。

```sql
SELECT s.receipt_id, s.created_at, o.updated_at,
  CAST((strftime('%s', 'now') - o.updated_at) / 60 AS INTEGER) AS idle_minutes,
  s.industry, s.locale, s.status, o.delivery_status, o.attempts, o.last_error
FROM submission_intake s JOIN notification_outbox o ON o.submission_id = s.submission_id
WHERE s.request_kind = 'document' AND o.message_type = 'internal'
  AND NOT (o.status = 'sent' AND o.delivery_status = 'accepted')
ORDER BY s.created_at;
```

出る行は、送信器が受理していない通知のすべてです。`held`、`failed`、再試行の上限に達した行（`attempts` が 6）、`sending` のまま `idle_minutes` が 15 以上の行、`queued` のまま 15 以上の行が含まれます。15 分に満たない `queued` と `sending` は処理中の行です。結果が 0 行なら、未達はありません。

出力には、受付番号、時刻、業種があり、申込みと結び付きます。チャット、GitHub、ログへ貼りません。

行が出たときの対応は、その申込みを手動で対応することです。

| 出た行 | 対応 |
|---|---|
| `failed` で `attempts` が 5 以下 | 待ちます。Queue と cron が再試行します。翌営業日にも残っていれば、「問題が起きたら」の表を見ます |
| `failed` で `attempts` が 6 以上、`sending` のまま `idle_minutes` が 15 以上 | 通知メールが担当に届いていません。下の「もう一度送らせる」で、同じ通知をもう一度送らせます。担当は、届いた通知の「返信」で申込者へ連絡します |
| `held` | この手順の対象外です。解放時刻より前に受け付けた申込みで、通知は送られません。扱いは寺田さんが決めます。申込者の連絡先を人が読む入口は作りません |
| `queued` のまま 15 分以上 | cron が入れ直します。残り続けるときは「問題が起きたら」の表を見ます |

## もう一度送らせる（本番の D1 への書き込み。人間ゲート）

届かなかった通知の行を、D1 の `notification_outbox` で「投入待ち」に戻します。既存の cron（15 分ごと）が、作成から 15 分以上たった `pending` の行（`queued` か `failed`、`attempts` が 6 未満）を Queue に入れ、consumer が 1 回だけ送ります。新しい入口は足していません。通知が担当に届くと、担当は通知の「返信」で申込者へ連絡します。

実行できるのは、寺田さん、または寺田さんの直接の Yes を受けた担当だけです。本番の D1 への書き込みです。

SQL の WHERE が、次の行だけを更新します。ほかの行には当たらず、更新は 0 行になります。

| 当たる行 | 当たらない行 |
|---|---|
| `failed` で `attempts` が 6 以上（再試行を使い切った行、DLQ に入った行） | `held`（解放時刻より前の受付） |
| `sending` のまま、更新から 15 分以上たった行 | `accepted`（送信済み） |
| | `failed` で `attempts` が 5 以下（Queue が自動で再試行中） |
| | `sending` で更新から 15 分未満（処理中） |
| | `queued`（cron が自動で入れ直す） |

1 回に 1 件、受付番号で指定します。

1. 受付番号を決めます。直前の「未達の確認」の出力の `receipt_id` 列の値（`COR-` で始まる）を写します。
2. 前の確認: 次のコマンドで、その行の `delivery_status` と `attempts` が上の表の「当たる行」であることを確かめます。`<受付番号>` を、手順 1 の値に置き換えます。

   ```bash
   cd workers/contact-chat && RECEIPT_ID=<受付番号> && npx wrangler d1 execute cor-contact-chat-prod --remote --json --command "$(awk '/^```sql-check$/{f=1;next} /^```/{f=0} f' RUNBOOK-document-request-notice.md | sed "s/__RECEIPT_ID__/$RECEIPT_ID/")"
   ```

3. 実行: 受付番号の形（`COR-` + 8 桁の日付 + `-` + 16 進 8 桁）を確かめてから、書き込みます。形が違うと、書き込まずに止まります。`<受付番号>` を、手順 1 の値に置き換えます。

   ```bash
   cd workers/contact-chat && RECEIPT_ID=<受付番号> && case "$RECEIPT_ID" in COR-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-[0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F]) ;; *) echo "受付番号の形が違います" >&2; false;; esac && npx wrangler d1 execute cor-contact-chat-prod --remote --json --command "$(awk '/^```sql-resend$/{f=1;next} /^```/{f=0} f' RUNBOOK-document-request-notice.md | sed "s/__RECEIPT_ID__/$RECEIPT_ID/")"
   ```

   更新した行数は、出力から読めるとは限りません。戻せたかどうかは、手順 4 の確認で判断します。対象外の行なら、何も変わりません。

4. 直後の確認: 手順 2 と同じコマンドで、`status` が `pending`、`delivery_status` が `queued`、`attempts` が 0 になっていることを確かめます。変わっていなければ、対象外の行です。次の手順へ進みません。
5. 15 分から 30 分待ち、手順 2 と同じコマンドで、`status` が `sent`、`delivery_status` が `accepted` になっていることを確かめます。`cloudia@cor-jp.com` に通知が 1 通届きます。同じ受付番号に、もう一度この手順を実行しません。

戻す SQL（`__RECEIPT_ID__` を受付番号に置き換えて実行されます）です。

```sql-resend
UPDATE notification_outbox
SET status = 'pending', delivery_status = 'queued', attempts = 0, last_error = NULL,
  updated_at = CAST(strftime('%s', 'now') AS INTEGER)
WHERE message_type = 'internal'
  AND submission_id IN (SELECT submission_id FROM submission_intake WHERE receipt_id = '__RECEIPT_ID__' AND request_kind = 'document')
  AND ((status = 'pending' AND delivery_status = 'failed' AND attempts >= 6)
    OR (status = 'processing' AND delivery_status = 'sending' AND updated_at <= CAST(strftime('%s', 'now') AS INTEGER) - 900));
```

前後の確認の SQL です（氏名・メール・会社名の列は選びません）。

```sql-check
SELECT s.receipt_id, o.status, o.delivery_status, o.attempts, o.last_error, o.updated_at
FROM submission_intake s JOIN notification_outbox o ON o.submission_id = s.submission_id
WHERE s.receipt_id = '__RECEIPT_ID__' AND s.request_kind = 'document' AND o.message_type = 'internal';
```

## 問題が起きたら

| 症状 | 原因 | 対応 |
|---|---|---|
| 合成申込みのあと、メールが届かず、照会に `held` / `notify_not_released` が出る | `DOCUMENT_REQUEST_NOTIFY_MODE` が `live` でない。または解放時刻が 10 桁の秒でない（ミリ秒の 13 桁、空、文字混じり）。または行が解放時刻より前に作られた | 手順 4 の値を確かめ、直して配備し直します。解放時刻より前の行は自動では送りません |
| 照会に `failed` / `notification_failed`、`attempts` が 1 から 5 | `RESEND_API_KEY` が無い、または送信器を使えない | secret を確かめます。Queue が自動で再試行します |
| 照会に `failed` / `provider_status_4xx` | 送信器が拒否した（鍵が無効、差出人 `noreply@cor-jp.com` が未検証など） | Resend の設定を確かめます |
| 照会に `failed`、`attempts` が 6 | Queue の再試行を使い切った（DLQ） | 自動では回収しません。「もう一度送らせる」で、同じ通知をもう一度送らせます |
| 照会に `queued` / `notify_not_enqueued` が 15 分より長く残る | Queue が止まっている | Cloudflare の Queue の状態を確かめます。cron は 15 分ごとに入れ直します |
| 照会に `sending` が 15 分より長く残る | 処理が途中で止まった | 自動では回収しません。「もう一度送らせる」で、同じ通知をもう一度送らせます |
| 照会に `locale` が空の行がある | migration 0007 の前に作られた行、または 0007 が未適用 | 手順 2 を確かめます。担当は返信の言語を日本語として扱います |

## 限界

- 送信器が受理した後、記録の書き込みが落ちると、同じ通知が 2 通届くことがあります。対応は 1 回でかまいません。受付番号で見分けます。この型は、#510 と問い合わせの経路も同じです。3 つの経路に共通の改善として、別に扱います
- 送信器が受理しているのに、記録が `sending` のまま残った行に「もう一度送らせる」を使うと、同じ通知が 2 通届きます（上の二重通知と同じ性質です）。対応は 1 回でかまいません。受付番号で見分けます
- 解放時刻と hold の境界は、手順で閉じています。コードでは閉じていません（「止め方・戻し方」を参照）
- 解放時刻より前に hold で作られた行は、重複の再申込みでも cron でも「もう一度送らせる」でも送られません

## 保持

受付の行、通知の行、監査の行は、90 日で消えます（問い合わせと同じ。既存の `purgeExpiredData`、`SUBMISSION_TTL_SECONDS`）。90 日は、寺田さん本人が 2026-11-12T09:21:21.565Z に Codex のチャットで「この案を採用」と答えた案の一部です（問いに「受付記録は90日保持」）。変える場合は、`SUBMISSION_TTL_SECONDS` と purge を一緒に変えます。

## この手順書で未確認のこと

- 本番の D1 への実行、本番の実送信、担当の実受信（手順 6 の 2）は、実行していません
- `wrangler d1 execute --remote` の実行は、していません。「未達の確認」と「もう一度送らせる」の同じコマンドを local の D1（`--local --persist-to`）で実行し、結果が返ることは確かめました。「もう一度送らせる」が本番の cron と Queue でどう動くかは、確認していません
- `https://cor-jp.com/contact/materials/` が本番で開くかは、PR #510 のフロント側が配備されているかによります。確認していません
- 公開スライドのリンク先の最新版、ダウンロードできるかどうかは、確認していません
