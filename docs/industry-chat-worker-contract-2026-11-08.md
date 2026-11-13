# Worker の業種契約（Cloudia 向け、2026-11-08）

文の状態は言語ごと（ja は `page-body-checked-2026-11-13`、5 業種のページの掲載用本文と照らした。en は `provisional-2026-11-08`、まだ確かめていない訳）。最初の一文（「〇〇のページから開いています。」）は照合の目印なので変えない。業種の一覧と最初の一文は、Cloudia の repo と同じ fixture（`industry-reception-contract.v1.json`）で照らす。

## source

Worker は `source` を trim し、改行を空白にしてから、完全一致だけで分類する。

業種（この5つだけ）:

- `industry-medical`
- `industry-shigyo`
- `industry-construction`
- `industry-manufacturing`
- `industry-education`

業種ではない既知のタグ:

- `corsweb-contact-primary`
- `corsweb-launcher`
- `corsweb-launcher-fallback`
- `cloudia`

それ以外は業種にしない。モデルへ渡す文に、その文字列は入れない。受付は続ける。

`/api/contact/chat/start`、`/api/contact/chat`、`/api/contact/submit` は、毎回同じ `source` を付ける。start の body に `start: true` か `event: "intent_selected"` がある。

## 最初の返事

`POST /api/contact/chat/start` の JSON。

- `reply`: 文字列。業種が5つのどれかなら、その業種の境界と、intent に応じた1問。業種でなければ、従来の汎用文か取材の文。
- `classification`: `"genuine"`
- `readyForContact`: `false`
- `summary`: 文字列。intent があれば `相談目的: <intent>`。
- `intent`: 渡した intent。未知ならフィールド無し。
- `sessionId`: 文字列
- `stage`: `"intent"`
- `missingFields`: `["purpose"]`

最初は業務の概要だけで足りると伝え、業種ごとの実データや機密資料は書かないよう案内する。秘密の中身は聞かない。診断、法律・税務の結論、効果の保証はしない。営業分類や未知の source でも、この start は 200 で返す。
