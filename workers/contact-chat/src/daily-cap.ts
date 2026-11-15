// 1 日（JST の日付）に model を呼ぶ回数の上限。数は D1 の chat_daily_usage（migration 0006）に置く。
// model を呼ぶ前に、その日の数を 1 文で 1 つ足し、上限に達していれば足さずに止める。
// 数は model を呼んだ回数だけを表す（止めた要求は数えない）。

/** 設定の値（`CHAT_DAILY_MODEL_CALL_LIMIT`）が無い・読めないときの上限。決めるのは配備の時の設定の値。 */
export const DEFAULT_CHAT_DAILY_MODEL_CALL_LIMIT = 300;

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 0 以上の整数の文字列だけを上限として受ける。ほかは既定の値。0 はその日は呼ばない。 */
export function chatDailyModelCallLimit(raw: string | undefined): number {
  const text = (raw ?? '').trim();
  if (!/^\d+$/.test(text)) return DEFAULT_CHAT_DAILY_MODEL_CALL_LIMIT;
  const value = Number(text);
  return Number.isSafeInteger(value) ? value : DEFAULT_CHAT_DAILY_MODEL_CALL_LIMIT;
}

/** JST の日付（YYYY-MM-DD）。 */
export function jstDay(nowMs: number): string {
  return new Date(nowMs + JST_OFFSET_MS).toISOString().slice(0, 10);
}

export type DailyModelCallDecision = 'reserved' | 'limited';

const RESERVE_SQL = `INSERT INTO chat_daily_usage (day, model_calls, updated_at) VALUES (?1, 1, ?3)
  ON CONFLICT(day) DO UPDATE SET model_calls = chat_daily_usage.model_calls + 1, updated_at = excluded.updated_at
  WHERE chat_daily_usage.model_calls < ?2
  RETURNING model_calls`;

/**
 * その日の数を 1 つ足せたら 'reserved'（model を 1 回呼んでよい）。上限に達していたら足さずに 'limited'。
 * 足すのと比べるのを 1 文で行うので、同時の要求でも上限を越えない。D1 の誤りはそのまま投げる（呼ぶ側が止める）。
 */
export async function reserveDailyModelCall(
  db: D1Database,
  limit: number,
  nowMs: number,
): Promise<DailyModelCallDecision> {
  if (limit <= 0) return 'limited';
  const row = await db
    .prepare(RESERVE_SQL)
    .bind(jstDay(nowMs), limit, Math.floor(nowMs / 1000))
    .first<{ model_calls: number }>();
  return row ? 'reserved' : 'limited';
}
