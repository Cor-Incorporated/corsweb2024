// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  backoffDelay,
  createRateLimiter,
  isRetryableError,
  mapWithConcurrency,
  serverRetryDelayMs,
  withResilience,
  withRetry,
} from '../retry.mjs';

const apiError = (status, message = `status ${status}`) =>
  Object.assign(new Error(message), { status });

describe('isRetryableError', () => {
  it.each([408, 429, 500, 502, 503, 504])('retries HTTP %i', (status) => {
    expect(isRetryableError(apiError(status))).toBe(true);
  });
  it.each([400, 401, 403, 404])('does not retry HTTP %i', (status) => {
    expect(isRetryableError(apiError(status))).toBe(false);
  });
  it('retries network failures and timeouts without a status', () => {
    expect(isRetryableError(new TypeError('fetch failed'))).toBe(true);
    expect(isRetryableError(Object.assign(new Error('x'), { name: 'AbortError' }))).toBe(true);
    expect(isRetryableError(new Error('schema mismatch'))).toBe(false);
  });
});

describe('backoff', () => {
  it('grows exponentially with equal jitter and is capped', () => {
    const opts = { baseDelayMs: 1000, maxDelayMs: 8000 };
    expect(backoffDelay(1, { ...opts, random: () => 0 })).toBe(500);
    expect(backoffDelay(1, { ...opts, random: () => 1 })).toBe(1000);
    expect(backoffDelay(3, { ...opts, random: () => 1 })).toBe(4000);
    expect(backoffDelay(10, { ...opts, random: () => 1 })).toBe(8000);
  });

  it('reads RetryInfo.retryDelay from a 429 body', () => {
    expect(serverRetryDelayMs(apiError(429, '{"retryDelay": "37s"}'))).toBe(37_000);
    expect(serverRetryDelayMs(apiError(429, 'no info'))).toBe(0);
  });
});

describe('withRetry', () => {
  const noSleep = [];
  const options = {
    maxAttempts: 4,
    baseDelayMs: 100,
    maxDelayMs: 1000,
    random: () => 1,
    sleep: async (ms) => noSleep.push(ms),
  };

  it('retries 429 then succeeds, sleeping with backoff', async () => {
    noSleep.length = 0;
    let calls = 0;
    const result = await withRetry(async () => {
      calls += 1;
      if (calls < 3) throw apiError(429);
      return 'ok';
    }, options);
    expect(result).toBe('ok');
    expect(calls).toBe(3);
    expect(noSleep).toEqual([100, 200]);
  });

  it('fails fast on a non-retryable error', async () => {
    let calls = 0;
    await expect(
      withRetry(async () => {
        calls += 1;
        throw apiError(400);
      }, options)
    ).rejects.toThrow('status 400');
    expect(calls).toBe(1);
  });

  it('gives up after maxAttempts', async () => {
    let calls = 0;
    await expect(
      withRetry(async () => {
        calls += 1;
        throw apiError(503);
      }, options)
    ).rejects.toThrow('status 503');
    expect(calls).toBe(4);
  });
});

describe('rate limiter and resilient client', () => {
  it('spaces request starts to respect the RPM limit', async () => {
    let clock = 0;
    const waits = [];
    const acquire = createRateLimiter({
      rpm: 30,
      now: () => clock,
      sleep: async (ms) => {
        waits.push(ms);
        clock += ms;
      },
    });
    await acquire();
    await acquire();
    await acquire();
    expect(waits).toEqual([2000, 2000]);
  });

  it('wraps a client with limiter + retry', async () => {
    let calls = 0;
    const raw = {
      model: 'm',
      generate: async () => {
        calls += 1;
        if (calls === 1) throw apiError(503);
        return { text: 'x' };
      },
    };
    const client = withResilience(raw, {
      limiter: async () => {},
      retry: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 1, sleep: async () => {} },
    });
    expect(await client.generate({})).toEqual({ text: 'x' });
    expect(client.model).toBe('m');
    expect(calls).toBe(2);
  });
});

describe('mapWithConcurrency', () => {
  it('keeps input order and never runs more than the limit at once', async () => {
    let running = 0;
    let peak = 0;
    const results = await mapWithConcurrency([30, 10, 20, 5], 2, async (ms, i) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, ms));
      running -= 1;
      return i;
    });
    expect(results).toEqual([0, 1, 2, 3]);
    expect(peak).toBe(2);
  });
});
