# 意味の確認（cor-voice-gate の記入表）

- 下書き: `../../../draft.md`（この記録のフォルダからの相対パス）
- ゲート: full
- 項目の中身は `.claude/skills/cor-voice-gate/SKILL.md` の同じ番号の節を読みます（ここには写しません）。
- 判定の欄には pass、fail、n/a のどれかを書きます。根拠の欄は空にしません。
- n/a は、その項目が当たらない理由を根拠に書きます。「n/a 不可」の項目は pass か fail だけです。
- fail が 1 つでもあれば、ゲートは通りません。直してから記入し直します。

| ID | 項目 | 判定 | 根拠 |
|---|---|---|---|
| T | Whole-post tone check (Step 6)（n/a 不可） | pass | 全3文を通読。会社のお知らせとしてです・ます調で一貫し、方言・冗談・感嘆・個人の体験はない。 |
| S1 | Sentence completeness | pass | 1文目はGrift CLIが事実を取り出す説明。2文目は同じCLIのライセンスと出力範囲。3文目は会社としてPoCの対象と用意状況を述べ、各文の対象と述語を追える。 |
| S2 | Habit / frequency implication | pass | たびに・毎回・いつも等の頻度や反復の主張はない。用意しているという資料の現在形を保持。 |
| S3 | Motive from the reader’s seat | pass | request.mdの会社のお知らせ欄という場面で、冒頭から製品名と得られるものを説明し、3文目で対象者を示す。紹介の依頼にない開始時期や告知理由は作らない。 |
| S4 | Relationship / debt | n/a | 関係や恩義を述べる紹介文ではなく、資料にも該当する事実がない。 |
| S5 | Factual framing | pass | material.mdの3項目を全て保持。MIT・OSS CLI・git履歴からの事実・点数と順位なし・PoCの3対象が対応し、新規開始・効果・合否・推薦等を加えていない。 |
| S6 | meaning_risk_count == 0（n/a 不可） | pass | 予備run 20261105T064722Z-9c7a3d0aのmeaning_risk=0。新規作成で原文はなく、依頼と資料は別々のmaterial指定。自動diffが選んだmaterial.mdと同じ3文を読み比べ、内容と否定と対象範囲を保持。後続checkでも0を必須とする。 |
| S7 | Publish-path preview | n/a | 非公開デモのローカル原稿作成であり、SNS・予約・公開画面の操作は依頼されていない。 |
| S8 | No duplicate / orphan posts | n/a | 投稿や削除を行わず、スレッドも作らない。 |
| S9 | Dialect | pass | 方言語尾は全3文にない。 |
| S10 | Mail extras (when email) | n/a | メールではなく、宛先・署名・添付・返信先を扱わない。 |
| S11 | No draft / edit URLs in body (hard stop before Postiz or any one-tap publish) | pass | 本文にURLはなく、編集用URLも含まない。 |
| S12 | Security / architecture framing (when the piece touches trust boundary, edge, zero trust, cloud vs local, or “what we sell”) | n/a | 信頼境界・エッジ・安全性・クラウド構成を説明する文ではない。 |
| S13 | State labeling (2026-10-29 reviewer report §7.1) — hard stop on conflation（n/a 不可） | pass | 1・2文目は資料にある現行仕様の説明、3文目は用意しているPoCの説明。検証済み・本番運用・顧客成果・今回の実装という状態を足していない。 |
| S14 | Numbers / comparison / safety minimums (§7.2) | pass | 測定値・比較・安全性保証はない。点数と順位を出さない説明はmaterial.md第2項そのままの範囲で、個人評価全般をしない等の広い約束へ拡張していない。製品実装の独立検証は今回の非公開作文の対象外。 |
| S15 | P0 vocabulary (§要旨, §3, §4.1–4.5) — hard stop（n/a 不可） | pass | 禁止コピー、7倍、最速等の保証・比較はない。Griftの説明を確かめられる事実と点数・順位を出さない範囲に保ち、見積もり・能力測定・真正性保証へ飛躍しない。 |
| S16 | Story shape (§7.4) | n/a | 3文の製品紹介で、調査や体験を語る記事ではない。出来事・問い・観測・判断は資料になく作らない。最後に資料のPoC案内を置く。 |
| S17 | Personal vs company (§2.3) | pass | 全文が会社としての製品と提供内容の説明。僕・私・個人の実験や成果を混ぜていない。 |
| S18 | Boundary / stop-design articles (続稿① n083decbc281b 境界・安全停止 and successors; Terada decision 2026-10-29) | n/a | 境界や停止設計の記事ではない。 |
| S19 | note 編集UI反映（when reflecting into editor.note.com）— hard stop（寺田承認 2026-10-29） | n/a | noteの編集UIへ反映しない。 |
| S20 | 公開済み note の更新＝同一 key（when the job is 更新／改稿／リライト of a published note）— hard stop（寺田承認 2026-10-29） | n/a | 公開済みnoteの更新ではない。 |
| S21 | 技術・安全系の調査／検証レンズ（when the piece is a 技術・安全／フィジカルAI／機能安全／エッジ安全停止／検証記事, or claims 検証した・実証・試験済み）— hard stop on checks 1・2・5; checks 3・4・6 are Full-required（寺田承認 2026-10-29） | n/a | 製品を紹介する3文であり、技術調査・安全検証の記事ではない。検証した・実証・試験済みという主張や規格参照もない。 |
| P1 | 現在地: 現行サービス・過去の記録・計画のどれかが分かる（n/a 不可） | pass | 資料が述べるCLIの現行説明と用意しているPoCとして記述。新規公開や開始予定とは書かない。 |
| P2 | 主張: タイトル・要約・OGP が本文より強くない（n/a 不可） | pass | 成果物は紹介本文3文のみ。タイトル・別要約・OGPを追加せず、資料より強い効能も書かない。 |
| P3 | 根拠: 数字の対象・条件・版・時点を追える（n/a 不可） | pass | 根拠はrequest.mdとmaterial.mdに限定。製品名・MIT・対象・PoCはmaterial.md各項と対応し、数字・版・日付を作っていない。 |
| P4 | 限界: 未検証・未観測・できないことを結果の近くに書く（n/a 不可） | pass | 1文目の事実抽出の説明の直後に、点数と順位を出さないことを2文目で明示。測定結果や未提供の制限は追加しない。 |
| P5 | 情報管理: 本文・画像・添付に秘密情報や無許可の顧客情報がない（画像のタブ・通知・パスも）（n/a 不可） | pass | 本文は資料の製品説明だけで、秘密情報・顧客名・認証情報を含まない。画像や添付もない。 |
| P6 | 主体: 自社開発・他者実装・検証協力・引用を区別（n/a 不可） | pass | Grift CLIの説明と、会社としてのPoCの用意に限定。依頼にない開発主体や他者実装・検証協力・顧客実績を作らない。 |
| P7 | 実態: 方針だけを実装済み・本番化済みと書いていない（n/a 不可） | pass | 資料の断定の範囲を保ち、動作検証済み・本番運用・導入成果・公開済みとは書かない。 |
| P8 | 読者: 誰の何の判断に役立つかを一文で言える（n/a 不可） | pass | 人材紹介会社・SESの会社・自社で採用する会社が、CLIの内容と自社がPoCの対象かを知る紹介。対象を自社開発企業等へ狭めない。 |
| P9 | 導線: その記事に合う一つの主な次の行動（n/a 不可） | pass | 3文目の案内をテスト導入（PoC）だけに絞り、検討する対象を明示。非公開の3文紹介としての確認で、資料にない申込先・URL・追加の勧誘文は作らない。公開導線の実装は行わない。 |
| P10 | 更新: 更新担当、再確認条件、原公開日・更新日が分かる（n/a 不可） | pass | 今回の作成・検査担当はCodex。依頼または資料が変われば再確認する。非公開デモの新規原稿なので原公開日・公開更新日は存在せず、本文に日付や公開後の担当者を作らない。公開用の更新体制を確認したという判定ではない。 |

## 適用範囲と資料の対応

- scene=company、doc-type=promo。Griftの製品表現かつAIの下書きなのでFullを選択。
- 第1文: material.md第1項のgit履歴から確かめられる事実を取り出す説明。
- 第2文: material.md第1項のMIT・OSS・CLIと第2項の点数・順位なし。
- 第3文: material.md第3項の対象3種とテスト導入（PoC）の用意。
- 依頼の3文を守り、資料の箇条書きをです・ます調の紹介文にした。予備runの構造・文末の候補3件はこの変更に対応し、主張や状態を変えない。
- 本文を通読し、間を作る読点、固有語の言い換え、対象の狭小化がないことを確認した。
- 初回の独立読者copy_reviewはrequest.md・material.md・draft.mdを読み、事実追加・意味の欠落・トーンについて指摘なし。記入後のreview.md再読と同一checkの再実行も同じ読者が担当する。
- 判定は非公開原稿と検査記録に限る。公開・送信・投稿・pushは行わない。公開画面や製品実装の動作確認をしたという記録ではない。
