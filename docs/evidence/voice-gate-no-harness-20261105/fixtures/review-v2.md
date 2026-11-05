# 意味の確認（cor-voice-gate の記入表）

- 下書き: `../draft.md`（この記録のフォルダからの相対パス）
- ゲート: fast
- 読んだ下書きの sha256: 6d67baccbe06a99c3f229a1e10c6bc9b4ca959ec3dc37482ea1db7ec4280b646
- 下書きを直したら、読み直して記入し、上の sha256 を読んだ版の値（`shasum -a 256 <下書き>`）に書き換えます（違うと通りません）。
- 項目の中身は `.claude/skills/cor-voice-gate/SKILL.md` の同じ番号の節を読みます（ここには写しません）。
- 判定の欄には pass、fail、n/a のどれかを書きます。根拠の欄は空にしません。
- n/a は、その項目が当たらない理由を根拠に書きます。「n/a 不可」の項目は pass か fail だけです。
- fail が 1 つでもあれば、ゲートは通りません。直してから記入し直します。
- この表は fixtures/draft-v2.md に対して人が書いたものです（デモでは記入の手順を cp で置き換えます）。

| ID | 項目 | 判定 | 根拠 |
|---|---|---|---|
| T | Whole-post tone check (Step 6)（n/a 不可） | pass | 3 文とも会社の文章のです・ます調で、調子のずれた行が無い |
| S1 | Sentence completeness | pass | 1・2 文目は Grift CLI が主語。3 文目は会社が主語で、お知らせ欄の文として省いても読める |
| S2 | Habit / frequency implication | n/a | 「たびに」「毎回」「いつも」「例年」を使っていない |
| S3 | Motive from the reader’s seat | n/a | 宛先のある依頼の文ではなく、お知らせ欄の紹介文 |
| S4 | Relationship / debt | n/a | 読み手との関係や恩に触れる文ではない |
| S5 | Factual framing | pass | 資料の 3 点だけを書いた。点数・順位・推薦に読める言い方は無い |
| S6 | meaning_risk_count == 0（n/a 不可） | pass | check が yomiyasu run の meaning_risk を確かめる（0 でなければ check が止める） |
| S7 | Publish-path preview | n/a | デモで公開しない。予約投稿の画面を通さない |
| S8 | No duplicate / orphan posts | n/a | 投稿しない |
| S9 | Dialect | pass | 方言の語尾が無い |
| S10 | Mail extras (when email) | n/a | メールではない |
| S11 | No draft / edit URLs in body (hard stop before Postiz or any one-tap publish) | pass | URL を 1 つも書いていない |
| S12 | Security / architecture framing (when the piece touches trust boundary, edge, zero trust, cloud vs local, or “what we sell”) | n/a | 信頼境界、エッジ、クラウドとローカルに触れていない |
| S13 | State labeling (2026-10-29 reviewer report §7.1) — hard stop on conflation（n/a 不可） | pass | 「取り出す」「出しません」は CLI の説明、「用意しています」は提供の状態で、計画や顧客成果と混ぜていない |
| S14 | Numbers / comparison / safety minimums (§7.2) | pass | 数字、比較、保証を書いていない（v1 の「必ず速くなります」は消した） |
| S15 | P0 vocabulary (§要旨, §3, §4.1–4.5) — hard stop（n/a 不可） | pass | 「証拠は盛れない」「7倍」を使っていない |
| S16 | Story shape (§7.4) | n/a | 3 文の紹介文で、出来事から限界までを語る記事ではない |
| S17 | Personal vs company (§2.3) | pass | 会社の声だけで書き、代表個人の経験を混ぜていない |
| S18 | Boundary / stop-design articles (続稿① n083decbc281b 境界・安全停止 and successors; Terada decision 2026-10-29) | n/a | 境界・安全停止の記事ではない |
| S19 | note 編集UI反映（when reflecting into editor.note.com）— hard stop（寺田承認 2026-10-29） | n/a | note に反映しない |
| S20 | 公開済み note の更新＝同一 key（when the job is 更新／改稿／リライト of a published note）— hard stop（寺田承認 2026-10-29） | n/a | note の更新ではない |
| S21 | 技術・安全系の調査／検証レンズ（when the piece is a 技術・安全／フィジカルAI／機能安全／エッジ安全停止／検証記事, or claims 検証した・実証・試験済み）— hard stop on checks 1・2・5; checks 3・4・6 are Full-required（寺田承認 2026-10-29） | n/a | 技術・安全の検証記事ではなく、「検証した」とも書いていない |
