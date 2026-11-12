# 資料請求の社内通知: 手順書

対象は `POST /api/contact/document-request` の受付と、担当への社内通知です。受付は保存、通知は別の段階です。この手順書にある本番向けの操作は、実行していません（寺田さんの Yes が要る人間ゲートです）。実行したコマンドと結果は、PR とレポートに別に書きます。

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
| `queued` / 空 | Queue に入れた。まだ処理していない | Queue が処理します |
| `queued` / `notify_not_enqueued` | 保存はできたが、Queue に入れられなかった。応答は `notification: 'pending'` | cron（15 分ごと）が、作成から 15 分たった行を Queue に入れ直します |
| `held` / `notify_not_released` | 送っていない。hold のまま、解放時刻より前に作られた、または解放時刻が無効 | 自動では送りません。明示の再処理だけが送ります |
| `sending` | 処理中 | 完了か失敗に変わります |
| `failed` / `provider_status_NNN` または `notification_failed` | 送信器が失敗した、または送信器を使えない（`RESEND_API_KEY` が無い） | Queue が最大 6 回（初回 + 再試行 5 回）まで試します。`attempts` が 6 になった行は、Queue の DLQ に入り、cron も入れ直しません |
| `accepted`（`status='sent'`） | 送信器が受け付けた | 終わりです |

## 本番へ出す手順（人間ゲート）

どの手順も、寺田さんが Yes を出してから実行する操作です。作業ディレクトリは `workers/contact-chat` です。

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

### 手順 3: 変数を設定する（現在値 → 設定値）

| 変数 | 現在値 | 設定値 |
|---|---|---|
| `DOCUMENT_REQUEST_NOTIFY_MODE` | 未設定（hold） | `live` |
| `DOCUMENT_REQUEST_NOTIFY_RELEASED_AT` | 未設定 | 次のコマンドの出力（10 桁の数字） |

```bash
date +%s
```

`wrangler.toml` の `[vars]` に 2 行を足し、その差分を PR にします。値は、上のコマンドが出した数字を引用符で囲んで書きます（例の形: `DOCUMENT_REQUEST_NOTIFY_RELEASED_AT = "1788000000"`）。この時刻より前に作られた受付は、`live` にしても自動では送りません。`RESEND_API_KEY` は問い合わせと同じ secret を使います。新しい鍵は作りません。

### 手順 4: 配備する

```bash
cd workers/contact-chat
npx wrangler deploy
```

### 手順 5: 社内の合成申込みを 1 件だけ送る

ブラウザで `https://cor-jp.com/contact/materials/` を開き、氏名 `受入テスト`、メール `company@cor-jp.com`、同意あり、で送ります。実顧客のアドレスは使いません。確かめることは 3 つです。

1. 結果画面に受付番号（`COR-` で始まる）が出る
2. `cloudia@cor-jp.com` に件名 `[資料請求] 受付 COR-…` のメールが 1 通届き、本文で受付番号、氏名、メール、会社名、業種、ページの言語、返信の言語を読める
3. 次の照会の結果に、その受付番号が出ない（`accepted` のため）

## 届かなかった通知の照会（読み取りだけ）

週 1 回、次の SQL を実行します。PII（氏名・メール・会社名）の列は選びません。結果が 0 行なら、未通知の受付はありません。

```sql
-- 資料請求で、社内通知が送信器に受け付けられていないもの（PII 列は SELECT しない）
SELECT s.receipt_id, s.created_at, s.industry, s.locale, s.status, o.delivery_status, o.attempts, o.last_error
FROM submission_intake s JOIN notification_outbox o ON o.submission_id = s.submission_id
WHERE s.request_kind = 'document' AND o.message_type = 'internal'
  AND NOT (o.status = 'sent' AND o.delivery_status = 'accepted')
ORDER BY s.created_at;
```

この手順書から SQL を取り出して、本番に実行するコマンドです。

```bash
cd workers/contact-chat
Q="$(mktemp)"
awk '/^```sql/{f=1;next} /^```/{f=0} f' RUNBOOK-document-request-notice.md > "$Q"
npx wrangler d1 execute cor-contact-chat-prod --remote --json --file "$Q"
rm -f "$Q"
```

`created_at` は unix 秒です。人が読むときは `date -r <created_at>` で変換します。

## 問題が起きたら

| 症状 | 原因 | 対応 |
|---|---|---|
| 合成申込みのあと、メールが届かず、照会に `held` / `notify_not_released` が出る | `DOCUMENT_REQUEST_NOTIFY_MODE` が `live` でない。または解放時刻が 10 桁の秒でない（ミリ秒の 13 桁、空、文字混じり）。または行が解放時刻より前に作られた | 手順 3 の値を確かめ、直して配備し直します。解放時刻より前の行は自動では送りません |
| 照会に `failed` / `notification_failed`、`attempts` が 1 から 5 | `RESEND_API_KEY` が無い、または送信器を使えない | secret を確かめます。Queue が自動で再試行します |
| 照会に `failed` / `provider_status_4xx` | 送信器が拒否した（鍵が無効、差出人 `noreply@cor-jp.com` が未検証など） | Resend の設定を確かめます |
| 照会に `failed`、`attempts` が 6 | Queue の再試行を使い切った（DLQ） | 自動では回収しません。原因を直したあとの再処理は、現時点で呼ぶ手段がありません（`replayHeldDocumentNotice` は HTTP にも CLI にも出していません） |
| 照会に `queued` / `notify_not_enqueued` が 15 分より長く残る | Queue が止まっている | Cloudflare の Queue の状態を確かめます。cron は 15 分ごとに入れ直します |
| 照会に `locale` が空の行がある | migration 0007 の前に作られた行、または 0007 が未適用 | 手順 2 を確かめます。担当は返信の言語を日本語として扱います |

## 保持

受付の行、通知の行、監査の行は、問い合わせと同じ 90 日で消えます（既存の `purgeExpiredData`）。最終判断は寺田さんが決めていません。変える場合は、`SUBMISSION_TTL_SECONDS` と purge を一緒に変えます。

## この手順書で未確認のこと

- 本番の D1 への実行、本番の実送信、担当の実受信（手順 5 の 2）は、実行していません
- `https://cor-jp.com/contact/materials/` が本番で開くかは、PR #510 のフロント側が配備されているかによります。確認していません
- 公開スライドのリンク先の最新版、ダウンロードできるかどうかは、確認していません
