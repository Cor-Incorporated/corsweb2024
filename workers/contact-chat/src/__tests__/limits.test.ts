import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../index';
import { MAX_OUTPUT_TOKENS } from '../llm';
import { GRIFT_HTTP_CALL_CAP, SUBMIT_LIMIT, resetRateLimits } from '../security';
import type { Env } from '../types';

afterEach(() => {
  resetRateLimits();
  vi.restoreAllMocks();
});

const ENV = {
  LLM_PROVIDER: 'vertex-gemini',
  VERTEX_GATEWAY_URL: 'https://gateway.example/generateContent',
  VERTEX_GATEWAY_SECRET: 'secret',
  RESEND_API_KEY: '',
  TURNSTILE_SECRET: '',
  CONTACT_TO_EMAIL: 'info@cor-jp.com',
  CONTACT_FROM_EMAIL: 'noreply@cor-jp.com',
} as unknown as Env;

describe('コードが持つ呼び出し上限', () => {
  it('Grift intent の会話は Grift を呼ばず、LLM の出力上限は 1024 token', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      urls.push(String(input));
      const body = JSON.parse(String(init?.body || '{}')) as {
        generationConfig?: { maxOutputTokens?: number };
      };
      expect(body.generationConfig?.maxOutputTokens).toBe(MAX_OUTPUT_TOKENS);
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: '{"reply":"確認しました","classification":"genuine","readyForContact":false,"summary":"目的を確認"}' }] } }],
      }), { status: 200 });
    }));
    const res = await worker.fetch(new Request('https://cor-jp.com/api/contact/chat', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://cor-jp.com',
        'cf-connecting-ip': '198.51.100.77',
      },
      body: JSON.stringify({
        intent: 'grift-paid-trial',
        messages: [{ role: 'user', content: 'Grift のテスト導入について聞きたい' }],
      }),
    }), ENV);
    expect(res.status).toBe(200);
    expect(MAX_OUTPUT_TOKENS).toBe(1024);
    expect(GRIFT_HTTP_CALL_CAP).toBe(0);
    const griftCalls = urls.filter((url) => {
      const host = new URL(url).hostname;
      return host === 'griftai.org' || host.endsWith('.griftai.org');
    });
    expect(griftCalls).toHaveLength(GRIFT_HTTP_CALL_CAP);
    expect(urls).toEqual(['https://gateway.example/generateContent']);
  });

  it('submit の超過は 429 と Retry-After', async () => {
    const ip = '198.51.100.78';
    let lastStatus = 0;
    let retryAfter = '';
    for (let i = 0; i < SUBMIT_LIMIT.max + 1; i++) {
      const res = await worker.fetch(new Request('https://cor-jp.com/api/contact/submit', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://cor-jp.com',
          'cf-connecting-ip': ip,
        },
        body: JSON.stringify({ name: '太郎', email: 'taro@example.com', message: '相談です' }),
      }), ENV);
      lastStatus = res.status;
      retryAfter = res.headers.get('retry-after') || '';
    }
    expect(lastStatus).toBe(429);
    const seconds = Number(retryAfter);
    expect(seconds).toBeGreaterThanOrEqual(1);
    expect(seconds).toBeLessThanOrEqual(SUBMIT_LIMIT.windowMs / 1000);
  });

  it('TURNSTILE_SECRET が空ならトークン無しの submit を Turnstile では拒まない', async () => {
    const res = await worker.fetch(new Request('https://cor-jp.com/api/contact/submit', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://cor-jp.com',
        'cf-connecting-ip': '198.51.100.79',
      },
      body: JSON.stringify({ name: '太郎', email: 'taro@example.com', message: '相談です' }),
    }), { ...ENV, TURNSTILE_SECRET: '' } as unknown as Env);
    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).not.toContain('Turnstile');
  });
});
