-- 1 日（JST の日付）に model を呼んだ回数。チャットの API の 1 日の呼び出しの上限に使う。
-- 1 日 1 行。個人の情報は持たない。
CREATE TABLE IF NOT EXISTS chat_daily_usage (
  day TEXT PRIMARY KEY,
  model_calls INTEGER NOT NULL DEFAULT 0 CHECK (model_calls >= 0),
  updated_at INTEGER NOT NULL
);
