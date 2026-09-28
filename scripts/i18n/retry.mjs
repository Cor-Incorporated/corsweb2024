/**
 * レート制御・リトライ（指数バックオフ）・並列度制御。時計と sleep は注入可能（テストで即時実行）。
 */

export const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const RETRYABLE_MESSAGE_RE =
  /fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up|network|timed? ?out|RESOURCE_EXHAUSTED|UNAVAILABLE|DEADLINE_EXCEEDED/i;

/** 一時的な失敗（429 / 5xx / ネットワーク / タイムアウト）だけを再試行する。400/401/403/404 は即失敗。 */
export function isRetryableError(err) {
  if (typeof err?.status === 'number') return RETRYABLE_STATUS.has(err.status);
  if (err?.name === 'AbortError' || err?.name === 'TimeoutError') return true;
  return RETRYABLE_MESSAGE_RE.test(String(err?.message ?? ''));
}

/** 429 の本文に RetryInfo（"retryDelay": "37s"）があればその秒数（ms）。 */
export function serverRetryDelayMs(err) {
  const m = String(err?.message ?? '').match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  return m ? Math.ceil(Number(m[1]) * 1000) : 0;
}

/** equal jitter つき指数バックオフ: [exp/2, exp]、exp = min(max, base * 2^(attempt-1))。 */
export function backoffDelay(attempt, { baseDelayMs, maxDelayMs, random = Math.random }) {
  const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
  return Math.round(exp / 2 + (random() * exp) / 2);
}

/**
 * @template T
 * @param {(attempt: number) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withRetry(fn, options) {
  const { maxAttempts, isRetryable = isRetryableError, sleep = defaultSleep, onRetry } = options;
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (err) {
      if (attempt >= maxAttempts || !isRetryable(err)) throw err;
      const delay = Math.max(
        backoffDelay(attempt, options),
        Math.min(serverRetryDelayMs(err), 120_000)
      );
      onRetry?.({ attempt, delay, error: err });
      await sleep(delay);
    }
  }
}

/** 1 分あたり rpm 回を超えないよう、リクエスト開始時刻を等間隔に並べる。 */
export function createRateLimiter({ rpm, now = Date.now, sleep = defaultSleep }) {
  const intervalMs = Math.ceil(60_000 / rpm);
  let nextSlot = 0;
  return async function acquire() {
    const current = now();
    const slot = Math.max(current, nextSlot);
    nextSlot = slot + intervalMs;
    if (slot > current) await sleep(slot - current);
  };
}

/**
 * 生の LLM クライアントにレート制御とリトライを被せる。
 * @param {{ model: string, generate: (req: object) => Promise<{ text: string, finishReason?: string }> }} client
 */
export function withResilience(client, { limiter, retry }) {
  return Object.freeze({
    model: client.model,
    generate: (request) =>
      withRetry(async () => {
        await limiter();
        return client.generate(request);
      }, retry),
  });
}

/** items を最大 limit 並列で処理し、入力順の結果配列を返す（worker は例外を投げない前提）。 */
export async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}
