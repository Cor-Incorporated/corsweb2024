# 業種からの獲得と受付（2026-11-08）

この文書は実装の範囲を分ける。全体が動いている、とは書かない。順位や問い合わせ数は保証しない。

## 今回 corsweb に入れたもの

ヘッダーから、既存の5業種ページを選べるようにした。パソコンは「業種別」のメニュー。スマホはメニューを開いた先頭の一覧。文言は各言語の `nav.industries` と `homeIndustries.rows`。リンク先は各言語の `/industries/{medical,shigyo,construction,manufacturing,education}`。5言語ともページがある。

先行の PR 509 にあるものは残している。ヒーロー直後の入口、業種ページから3つのサービスへのリンク、相談の `source=industry-*`、教育ページから公開済みの基幹移行の実績へのリンク、浮きボタンの当たりをボタン幅に限したこと。

## 検索の棚卸し（現状。順位は未測定）

本番の `robots` は `index, follow`（プレビューは noindex。ADR-0010）。業種パスは `src/config/indexing.ts` の noindex 一覧に無い。canonical は `Layout.astro` が `https://cor-jp.com` とパスから出す。hreflang は ja / en / zh / ko / es。

日本語の title / h1 / description は次のとおり。title と description は `meta.industry*`。h1 は `industry*.hero.title`。

| パス | title | h1 | description の主題 |
|---|---|---|---|
| `/industries/medical` | 医療・ヘルスケア向けAI伴走｜Cor.株式会社 | 医療の現場、こんな“進まない”はありませんか？ | 院内データ、患者対応、情報セキュリティ、AI活用方針 |
| `/industries/shigyo` | 士業向けAI伴走｜Cor.株式会社 | 士業の業務、“時間と神経”を使いすぎていませんか？ | 契約書精査、申請・登記、期日管理、補助金申請 |
| `/industries/construction` | 建設向けAI伴走｜Cor.株式会社 | 建設現場の“段取り”、紙とFAXで止まっていませんか？ | 労務管理、設計変更、安全確認、ノウハウ継承 |
| `/industries/manufacturing` | 製造向けAI伴走｜Cor.株式会社 | 製造現場の“知恵と段取り”、人に依存していませんか？ | 目視検査、ノウハウ継承、設備保全、在庫管理 |
| `/industries/education` | 教育向けAI伴走｜Cor.株式会社 | 教育の現場、“先生の時間”は足りていますか？ | テスト作業、保護者連絡、調査報告、ICT名簿管理 |

内部リンクは、ヘッダー、トップの業種入口、サービスページの業種一覧、業種ページのサービス3件と相談。検索意図に title を合わせ直す作業は、本人のコピー待ちで未着手。

## いま動いている受付（調査範囲を分けて書く）

corsweb2024 のこの作業で読んだ範囲。

- 業種の相談ボタンは `/contact?intent=confidential-ai-assessment|local-llm-poc&source=industry-<slug>`。
- JavaScript があるとき、`CloudiaContactEntry.astro` のスクリプトが、ページの `intent` と `source` を `/contact/chat/` のリンクへ写す。ローカルの Chrome で、医療は `source=industry-medical` と `intent=confidential-ai-assessment` がリンクに残った。これは URL の受け渡しまでである。
- JavaScript が無いとき、ビルド済み HTML のチャットリンクは `source=corsweb-contact-primary` のままで、訪問者のクエリは乗らない。
- 業種ページの浮きボタン iframe も `source=industry-*` を URL に付ける。これも URL までである。
- 添付の照合（cloudia の main を読んだ記録。このターンでは cloudia を開いていない）では、GA4 に送るのは `utm_source=grift` と `utm_medium=cta` と intent で、素の `source` は送らない。チャット開始の source は `'cloudia'` 固定で、業種の source を応答に使う箇所は見つかっていない。URL を渡しただけでは、業種に合わせた応答や計測は実装済みとしない。
- 電話は `CALL_CENTER_PHONE_VISIBLE = false`。`/contact` には tel を出さない。番号の定数と、フラグが真のときの AI 応対カード（`ContactInfo.astro`）はある。番号の掲示先、営業時間、既存の AI コールセンター番号をそのまま出してよいかは未確認なので、フラグは変えていない。番号を隠すだけでは営業電話は減らない。
- 通常フォームは `CLOUDIA_CONTACT_PRIMARY_ENABLED` が真のとき描画しない。フラグを戻すと `ContactForm` が戻る。非常口として残している。
- `Calendar.astro` は `PUBLIC_GCAL_ID` があるときの閲覧用 embed である。予約の作成、空きの確保、Meet の発行、tl;dv への参加は、このファイルには無い。
- 会社紹介資料は `COMPANY_DECK_URL` の直リンク（Google スライドの閲覧）。入力も通知も無い。

資料請求フォーム、予約、cor-os の案件記録を、全システムの不在とは書かない。このターンで見たのは corsweb2024 のページ、`src/config/site.ts`、`src/config/contact.ts`、`workers/contact-chat` の所在（問い合わせ通知の入口があることまで）。cor-os のリポジトリは開いていない。添付の照合は、corsweb2024 の develop と cloudia の main、および既定ブランチの code search で、資料請求と予約の URL は見当たらなかった、と書いている。code search の外や未読のリポジトリは要確認。

## まだ実装しないもの（設計）

公開の自動メール、本番の予約開始、外部サービスの設定変更は、別の承認が要る。

### 相談の逃げ道

チャットだけにすると、JavaScript が無い人、チャットが苦手な人、業種がどれでもない人が落ちる。

- 業種が決まっていれば、今の `source=industry-*` をチャットへ渡す。
- 決まっていなくても受け付ける。`source=header` か `source=contact` のまま人へ渡す。誤った業種でも、人が直せる欄を残す。
- 営業の提案は、顧客の相談と別の入口にする。同じフォームに混ぜない。電話番号の非表示は、この分離の代わりにしない。
- 特商法とプライバシーの表示は残す。本文は今回変えていない。

### 資料請求

必要なら、氏名、メール、会社名、業種（任意）、同意。それ以上は足さない。

- 同意の記録と、個人情報の利用目的は、既存のプライバシー方針の範囲で書く。新しい方針文は本人の確認が要る。
- 保存先の候補は cor-os。受口の有無は未読のため要確認。重複はメールと資料と時間の窓で抑える案。一意キーは要確認。
- 通知が失敗しても保存は残し、再送する。問い合わせ通知の入口は `workers/contact-chat` にある。資料請求用に流用できるかは要確認。宛先と再送の上限も要確認。
- 今回はフォームを作っていない。

### 予約

空きは freebusy で見て、同じ枠の二重予約を拒む。タイムゾーンは Asia/Tokyo を明示する。前後にバッファを置く。キャンセルは予約者と本人の両方からできる。

- Google の予約スケジュールと、Meet の録画、tl;dv の bot 参加は別物である。どれを使うかは本人の契約が要る。このターンではアカウント設定を見ていない。実現できるとは書かない。
- 要確認: Workspace のプラン、予約ページの有無、Calendar の書込、tl;dv のプランと同意の置換、録画を断ったときの扱い、要約が失敗したときの手動議事録。
- 録画や要約が失敗しても、予約自体は残す。失敗を本人に通知する。要確認: tl;dv の失敗通知。
- 顧客への確認メールの文面と送信開始は、別の承認。今回は送っていない。

### 触るリポジトリ

| 範囲 | リポジトリ | 今回 |
|---|---|---|
| ヘッダー、業種ページ、/contact の受け渡し | corsweb2024 | ヘッダーまで入れた。受付の新機能は未実装 |
| チャットの応答と GA4 | cloudia | 未着手。添付の読取では素の source は GA4 に載らず、開始 source は cloudia 固定。このターンは未変更 |
| 案件、資料請求の保存、通知の再送 | cor-os | 未着手。API は要確認 |
| Calendar、Meet、tl;dv | 外部サービス | 設定変更なし。契約と権限は要確認 |
