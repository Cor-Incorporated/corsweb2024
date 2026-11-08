# 資料請求の受付（2026-11-08）

この文書は、今回 corsweb2024 に入れた受付と、まだ決めていないことを分ける。自動で cor-os に入った、資料を送った、とは書かない。

## 資料の実在

`COMPANY_DECK_URL`（`src/config/site.ts`）へ 2026-11-08 に GET した。応答の HTML の title は `Cor_紹介資料_2026.pptx - Google Slides` だった。本文は約 2.1MB。見つからない、という文は無かった。

これは、公開のプレビュー URL がそのファイル名のスライドを開く、という確認である。ファイルを複製したわけでも、メールで送ったわけでもない。請求画面の「申し込みなしで見る」は、この既存 URL へのリンクである。

## 今回の受付

`POST /api/contact/document-request`。保存は既存の `submission_intake`（AES-GCM、メールの HMAC、90日で消す `purgeExpiredData`）。通知の行は社内向けの outbox だけで、Queue の中身は submission ID と `internal` だけ。

画面は `/contact/materials/`（5言語）。JavaScript があるときは JSON。無いときは同じ URL へフォームを送り、Worker が HTML を返す。成功の文は、保存できたときだけ出す。通知が止まっても、その文は「記録は残っている」であり、「送れなかったので受付ではない」「資料を送った」にはしない。

業種は medical、shigyo、construction、manufacturing、education だけ。空欄は許す。それ以外は 400 で保存しない。同意が無いときも保存しない。`website` に値があると保存しない。

## 設定差分（既存の値は変えていない）

`workers/contact-chat/wrangler.toml` の `CONTACT_TO_EMAIL`、`CONTACT_CC_EMAILS`、`CONTACT_FROM_EMAIL` は変えていない。新しい変数は toml に書いていない。

| 名前 | いま | 意味 |
|---|---|---|
| `DOCUMENT_REQUEST_NOTIFY_MODE` 未設定 | コードの既定 | Resend を呼ばない。outbox は `held` / `notify_not_released`。行は残る |
| `mock` | テストだけ | HTTP をしない。受付 status は `stored` のまま |
| `live` | 未設定 | 既存の `CONTACT_TO_EMAIL` へ社内通知だけ。資料の送付メールではない |

保持期間の最終判断は未確定。いまの行は、問い合わせと同じ `SUBMISSION_TTL_SECONDS`（90日）で消える。これは新しい期間の決定ではなく、既存の削除に乗せた結果である。変えるなら、この列の期限と purge を一緒に変える。

請求者への自動返信は作っていない。送付済みと読まれるため。配布の方法（公開 URL の案内だけにするか、人がメールで送るか）は未確定。

`held` の行を、あとから `live` にしただけで自動再送はしない。再送が要るときは、同じ受付へのキュー再投入を別途決める。

## cor-os へは押し込まない

cor-os は社員向けの Cloudflare Access がある。匿名の公開 write API は作らない。今回の Worker は cor-os を呼ばない。社内通知を人が見て確認する段階であり、連携が完成したとは書かない。

将来、社員向けの reviewed connector で渡すときの最小契約は次のとおり。

- 認証は Cloudflare Access のサービストークン。公開インターネットからの匿名 POST はしない。
- `Idempotency-Key` は submission ID。同じ ID の再送は同じ結果にする。
- 本体は submission ID、受付番号、資料 ID `company-deck`、業種（5つのいずれかまたは空）、同意の版、記録時刻。氏名とメールは、cor-os が持つと決めるまで corsweb の暗号化列に残す。
- 失敗は指数バックオフで最大5回。それでも失敗した列は失敗キューに残し、受付の行は消さない。
- 予定化やメール返信は、cor-os にある承認の手順に乗せる。このリポジトリからは起動しない。

## 今回変えていないもの

予約、カレンダー、Meet、tl;dv、電話の表示フラグ、cloudia の応答と計測、特商法、ヘッダー。これらは別の実装か、別の設定である。
