import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  CHAT_LIMIT,
  SUBMIT_LIMIT,
  ctEq,
  isRateLimited,
  isSameOrigin,
  resetRateLimits,
  verifyTurnstile,
} from '../security';
import type { Env } from '../types';

afterEach(() => {
  resetRateLimits();
  vi.restoreAllMocks();
});

const reqWithHeaders = (headers: Record<string, string | null>, method = 'GET') =>
  ({
    method,
    headers: { get: (n: string) => headers[n.toLowerCase()] ?? null },
  }) as unknown as Request;

describe('ctEq — 定数時間比較', () => {
  it('一致', () => expect(ctEq('abc', 'abc')).toBe(true));
  it('不一致', () => expect(ctEq('abc', 'abd')).toBe(false));
  it('長さ違い', () => expect(ctEq('abc', 'abcd')).toBe(false));
});

describe('isRateLimited — IP単位レート制限', () => {
  it('上限まではブロックしない', () => {
    for (let i = 0; i < CHAT_LIMIT.max; i++) {
      expect(isRateLimited('chat:1.2.3.4', CHAT_LIMIT)).toBe(false);
    }
  });
  it('上限を超えるとブロックする', () => {
    for (let i = 0; i < SUBMIT_LIMIT.max; i++) {
      expect(isRateLimited('submit:9.9.9.9', SUBMIT_LIMIT)).toBe(false);
    }
    expect(isRateLimited('submit:9.9.9.9', SUBMIT_LIMIT)).toBe(true);
  });
  it('窓がリセットされると再びカウント0から', () => {
    const now = 1_000_000;
    for (let i = 0; i < SUBMIT_LIMIT.max; i++) {
      isRateLimited('submit:5.5.5.5', SUBMIT_LIMIT, now);
    }
    expect(isRateLimited('submit:5.5.5.5', SUBMIT_LIMIT, now)).toBe(true);
    // 窓を超えた時刻なら再び許可される
    expect(isRateLimited('submit:5.5.5.5', SUBMIT_LIMIT, now + SUBMIT_LIMIT.windowMs + 1)).toBe(
      false,
    );
  });
  it('IP（キー）が違えば独立してカウントされる', () => {
    for (let i = 0; i < SUBMIT_LIMIT.max + 1; i++) isRateLimited('submit:a', SUBMIT_LIMIT);
    expect(isRateLimited('submit:a', SUBMIT_LIMIT)).toBe(true);
    expect(isRateLimited('submit:b', SUBMIT_LIMIT)).toBe(false);
  });
});

describe('isSameOrigin — CORSを開けず cor-jp.com のみ許可', () => {
  it.each(['GET', 'HEAD'])('%s で Origin が無ければ許可', (method) => {
    expect(isSameOrigin(reqWithHeaders({ origin: null }, method))).toBe(true);
  });
  it.each(['POST', 'post', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])(
    '%s で Origin が無ければ拒否（#362）',
    (method) => {
      expect(isSameOrigin(reqWithHeaders({ origin: null }, method))).toBe(false);
    },
  );
  it.each(['', '   '])('POST の空の Origin（%j）は拒否', (origin) => {
    expect(isSameOrigin(reqWithHeaders({ origin }, 'POST'))).toBe(false);
  });
  it('メソッドが無いリクエストは Origin 無しを拒否する', () => {
    const req = {
      headers: { get: () => null },
    } as unknown as Request;
    expect(isSameOrigin(req)).toBe(false);
  });
  it.each(['https://cor-jp.com', 'https://www.cor-jp.com'])('POST の自オリジン(%s)を許可', (o) => {
    expect(isSameOrigin(reqWithHeaders({ origin: o }, 'POST'))).toBe(true);
  });
  it.each(['https://evil.example', 'https://cor-jp.com.evil.com', 'null', 'not a url'])(
    'POST の別オリジン(%s)を拒否',
    (o) => {
      expect(isSameOrigin(reqWithHeaders({ origin: o }, 'POST'))).toBe(false);
    },
  );
  it('GET でも別オリジンは拒否', () => {
    expect(isSameOrigin(reqWithHeaders({ origin: 'https://evil.example' }, 'GET'))).toBe(false);
  });
});

describe('verifyTurnstile', () => {
  const baseEnv = { TURNSTILE_SECRET: '' } as unknown as Env;

  it('TURNSTILE_SECRET 未設定なら検証スキップ（fail open・skipped:true）', async () => {
    const r = await verifyTurnstile(baseEnv, undefined, '1.2.3.4');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.skipped).toBe(true);
  });

  it('シークレットありでトークン欠落は 400', async () => {
    const env = { TURNSTILE_SECRET: 'secret' } as unknown as Env;
    const r = await verifyTurnstile(env, undefined, '1.2.3.4');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });

  it('siteverify success:true なら通過（fetchをモック）', async () => {
    const env = { TURNSTILE_SECRET: 'secret' } as unknown as Env;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 })),
    );
    const r = await verifyTurnstile(env, 'good-token', '1.2.3.4');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.skipped).toBe(false);
  });

  it('siteverify success:false なら 403（fail closed）', async () => {
    const env = { TURNSTILE_SECRET: 'secret' } as unknown as Env;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ success: false }), { status: 200 })),
    );
    const r = await verifyTurnstile(env, 'bad-token', '1.2.3.4');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it('siteverify が到達不能なら 503（fail closed）', async () => {
    const env = { TURNSTILE_SECRET: 'secret' } as unknown as Env;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );
    const r = await verifyTurnstile(env, 'token', '1.2.3.4');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(503);
  });

  it('過大トークンは外部呼び出し前に 400', async () => {
    const env = { TURNSTILE_SECRET: 'secret' } as unknown as Env;
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    const r = await verifyTurnstile(env, 'x'.repeat(5000), '1.2.3.4');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });
});
