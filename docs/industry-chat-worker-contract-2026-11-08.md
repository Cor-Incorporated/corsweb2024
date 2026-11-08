# Worker の業種契約（Cloudia 向け、2026-11-08）

Cloudia は変えていない。画面の業種案内と、この Worker の最初の返事が両方出ると、文が違ったまま2回見える。表示側で重ねない判断は Cloudia に依頼する。

文案は暫定（`provisional-2026-11-08`）。最終稿ではない。

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

患者の記録、依頼者名、図面、生徒の名前は聞かない。診断、法律・税務の結論、効果の保証はしない。営業分類や未知の source でも、この start は 200 で返す。
