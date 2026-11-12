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
| `live` | 未設定。設定してもキューは送らない | 過去の held を自動送信しない。再処理の HTTP は無い |

## 通知を出さない理由

キューが資料請求を受け取ると、outbox を `pending` / `held` / `notify_not_released` に戻して ack する。`mock` でも `live` でもここでは送らない。行は期限まで D1 に残る。消えるのは既存の90日 purge だけである。

擬似の再処理は `replayHeldDocumentNotice`。fetch のルートには無い。`DOCUMENT_REQUEST_NOTIFY_MODE=mock` のときだけ擬似送信し、受付の status は `stored` のまま。復号に失敗したら再び `held` に戻し、行は消さない。`live` や未設定ではこの関数も送らない。

## 別サイトからの投稿

資料請求の POST は、問い合わせと同じ `isSameOrigin` を先に通る。ブラウザは POST に Origin を付ける。`https://evil.example` は 403 で、保存しない。`https://cor-jp.com` のフォームは通る。Origin が無い POST も 403。

この受付はクッキーでログインしない。CSRF nonce を HTML に埋め込んでも、静的なページでは使い回せない。Turnstile を必須にすると、ウィジェットの無い非JS送信が落ちる。Origin を自分で付けた直接呼び出しは、ブラウザの別サイト投稿とは別で、既存の IP 窓とハニーポットで扱う。

## 資料の開き方

会社紹介スライドの URL は、フォームを通さなくても開く。About とブログの CTA は、その URL へ直接リンクしている。フォーム必須にはしていない。

請求フォームへは、`/contact` の「会社紹介資料の請求」から `/contact/materials/` へ進む。業種ページの相談ボタンは `/contact` へ行き、そのページに同じリンクがある。請求の結果ページにも、公開スライドへのリンクが残る。これは送付済みの表示ではない。

保持期間の最終判断は未確定。いまの行は、問い合わせと同じ `SUBMISSION_TTL_SECONDS`（90日）で消える。これは新しい期間の決定ではなく、既存の削除に乗せた結果である。変えるなら、この列の期限と purge を一緒に変える。

請求者への自動返信は作っていない。送付済みと読まれるため。配布の方法（公開 URL の案内だけにするか、人がメールで送るか）は未確定。

キューへ同じ ID を再投入しても、また `held` に戻るだけである。送る処理は HTTP に出していない。

## 案件同期（送信側だけ。未接続）

`createDocumentRequest` の戻りは `submissionId`、`receiptId`、`duplicate` だけである。同期の中身は、その受付番号で保存済みの行を読み直す。読む列は資料 ID、業種、同意の版、初回の `created_at`、状態である。暗号文の列は SELECT しない。

業種が空の行は `industry: ''` として扱う。同じ日の再送で別の業種が来ても、行は更新しないので、読む値は初回のままである。日付をまたぐと別の受付になる。準備ができていない同期は、同期用の列を読む前に戻る。

cor-os の D1 への永続化は、相手側がまだ実装中である。こちらは service binding を wrangler に有効な形では書いていない。`mock` 以外では binding があっても呼ばない。専用の principal と token が PII の鍵と同じときは呼ばない。同期が失敗しても、受付の status は `stored` のまま、受付番号も維持する。`retry_scheduled` 以外では `retry` を呼ばない。

authority は `{ principalId, syncToken }` だけを送る。syncToken は生のトークンで、digest は送らない。`recordedAt` は保存行の UTC ISO 文字列である。応答は受信側の outcome / code / syncStatus を読む。conflict は syncStatus が recorded でも成功にしない。not_connected は recorded にしない。

## cor-os の公開入口は作らない

cor-os は社員向けの Cloudflare Access がある。匿名の公開 write API は、こちらには作っていない。上の案件同期は、未接続の service binding である。本番の設定では呼ばない。連携が完成したとは書かない。

氏名、メール、本文は、この Worker の暗号化列に残す。同期先へは出さない。

## 今回変えていないもの

予約、カレンダー、Meet、tl;dv、電話の表示フラグ、cloudia の応答と計測、特商法、ヘッダー。これらは別の実装か、別の設定である。
