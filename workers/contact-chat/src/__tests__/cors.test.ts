import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../index';
import {
  PREVIEW_CONTACT_CORS_HEADERS,
  PREVIEW_CONTACT_ORIGIN,
  resetRateLimits,
} from '../security';
import type { Env } from '../types';

const previewEnv = {
  CONTACT_SITE_ENV: 'preview',
  LLM_PROVIDER: 'anthropic',
  ANTHROPIC_API_KEY: '',
  RESEND_API_KEY: '',
  TURNSTILE_SECRET: '',
  CONTACT_TO_EMAIL: 'cloudia@cor-jp.com',
  CONTACT_FROM_EMAIL: 'noreply@cor-jp.com',
  TURNSTILE_REQUIRED: 'false',
} as unknown as Env;

const productionEnv = {
  ...previewEnv,
  CONTACT_SITE_ENV: 'production',
} as Env;

const browserPost = (path: string, body: unknown, origin = PREVIEW_CONTACT_ORIGIN): Request =>
  new Request(`https://contact-preview.example${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8',
      origin,
      'cf-connecting-ip': '198.51.100.83',
    },
    body: JSON.stringify(body),
  });

const preflight = (
  path: string,
  overrides: Record<string, string> = {},
): Request => new Request(`https://contact-preview.example${path}`, {
  method: 'OPTIONS',
  headers: {
    origin: PREVIEW_CONTACT_ORIGIN,
    'access-control-request-method': 'POST',
    'access-control-request-headers': 'content-type',
    ...overrides,
  },
});

function expectExactPreviewCors(response: Response): void {
  for (const [name, value] of Object.entries(PREVIEW_CONTACT_CORS_HEADERS)) {
    expect(response.headers.get(name)).toBe(value);
  }
  expect(response.headers.get('access-control-allow-credentials')).toBeNull();
}

function expectNoCors(response: Response): void {
  expect(response.headers.get('access-control-allow-origin')).toBeNull();
  expect(response.headers.get('access-control-allow-methods')).toBeNull();
  expect(response.headers.get('access-control-allow-headers')).toBeNull();
  expect(response.headers.get('access-control-max-age')).toBeNull();
  expect(response.headers.get('access-control-allow-credentials')).toBeNull();
}

afterEach(() => {
  resetRateLimits();
  vi.restoreAllMocks();
});

describe('Issue #283 Preview exact Origin/CORS', () => {
  it.each([
    '/api/contact/chat',
    '/api/contact/chat/start',
    '/api/contact/submit',
  ])('exact Preview originの%s preflightへ固定CORSを返す', async (path) => {
    const response = await worker.fetch(preflight(path), previewEnv);
    expect(response.status).toBe(204);
    expectExactPreviewCors(response);
    expect(await response.text()).toBe('');
  });

  it.each([
    {
      path: '/api/contact/chat/start',
      body: { start: true, event: 'intent_selected', intent: 'contract-dev', locale: 'ja' },
      status: 200,
    },
    {
      path: '/api/contact/chat',
      body: { messages: [{ role: 'user', content: '相談です' }] },
      status: 503,
    },
    {
      path: '/api/contact/submit',
      body: { name: 'テスト太郎', email: 'test@example.com', message: '相談です' },
      status: 503,
    },
  ])('exact Preview originのPOST応答へ固定CORSを返す: $path ($status)', async ({ path, body, status }) => {
    const response = await worker.fetch(browserPost(path, body), previewEnv);
    expect(response.status).toBe(status);
    expectExactPreviewCors(response);
  });

  it('メール受付成功＋Grift fallback応答にも同一CORSを返す', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: crypto.randomUUID() }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const env = {
      ...previewEnv,
      RESEND_API_KEY: 're_test',
      GRIFT_HANDOFF_ENABLED: 'true',
    } as Env;
    const acceptedAt = new Date().toISOString();
    const response = await worker.fetch(browserPost('/api/contact/submit', {
      name: 'テスト太郎',
      email: 'test@example.com',
      message: '受託開発の相談です',
      intent: 'contract-dev',
      locale: 'ja',
      source: 'cloudia',
      summaryText: {
        version: 1,
        locale: 'ja',
        intent: 'contract-dev',
        classification: 'genuine',
        readyForContact: true,
        stage: 'ready',
        structuredLead: { purpose: '見積もり相談' },
        text: '見積もり相談の要約',
      },
      handoffConsent: {
        accepted: true,
        version: 'cloudia-grift-v1',
        acceptedAt,
        summaryConfirmed: true,
      },
    }), env);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ handoff: { status: 'fallback' } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expectExactPreviewCors(response);
  });

  it('productionのCor同一origin POSTは許可するがCORSを一切返さない', async () => {
    const response = await worker.fetch(browserPost('/api/contact/chat/start', {
      start: true,
      intent: 'contract-dev',
    }, 'https://cor-jp.com'), productionEnv);
    expect(response.status).toBe(200);
    expectNoCors(response);
  });

  it('productionはPreview originを無視して403/CORSなしにする', async () => {
    const response = await worker.fetch(browserPost('/api/contact/chat/start', {
      start: true,
      intent: 'contract-dev',
    }), productionEnv);
    expect(response.status).toBe(403);
    expectNoCors(response);
  });

  it.each([
    'http://codex-cloudia-grift-uat.cloudia-contact.pages.dev',
    'https://user@codex-cloudia-grift-uat.cloudia-contact.pages.dev',
    'https://codex-cloudia-grift-uat.cloudia-contact.pages.dev:443',
    'https://codex-cloudia-grift-uat.cloudia-contact.pages.dev/path',
    'https://codex-cloudia-grift-uat.cloudia-contact.pages.dev?x=1',
    'https://codex-cloudia-grift-uat.cloudia-contact.pages.dev#fragment',
    'https://codex-cloudia-grift-uat.cloudia-contact.pages.dev.evil.example',
    'https://*.cloudia-contact.pages.dev',
    '*',
    'null',
  ])('Previewの不正・非exact originを403/CORSなしにする: %s', async (origin) => {
    const response = await worker.fetch(browserPost('/api/contact/chat/start', {
      start: true,
      intent: 'contract-dev',
    }, origin), previewEnv);
    expect(response.status).toBe(403);
    expectNoCors(response);
  });

  it.each([
    { header: 'access-control-request-method', value: 'GET' },
    { header: 'access-control-request-headers', value: 'authorization' },
    { header: 'access-control-request-headers', value: 'content-type, authorization' },
  ])('不正preflightを403/CORSなしにする: $header=$value', async ({ header, value }) => {
    const response = await worker.fetch(preflight('/api/contact/chat', { [header]: value }), previewEnv);
    expect(response.status).toBe(403);
    expectNoCors(response);
  });

  it('非exact originのpreflightを403/CORSなしにする', async () => {
    const response = await worker.fetch(preflight('/api/contact/chat', {
      origin: 'https://codex-cloudia-grift-uat.cloudia-contact.pages.dev.evil.example',
    }), previewEnv);
    expect(response.status).toBe(403);
    expectNoCors(response);
  });

  it('未知runtime環境は保護対象APIをfail closedにする', async () => {
    const response = await worker.fetch(browserPost('/api/contact/chat/start', { start: true }), {
      ...previewEnv,
      CONTACT_SITE_ENV: 'staging',
    });
    expect(response.status).toBe(403);
    expectNoCors(response);
  });

  it('health GETはPreview origin付きでも公開を維持しCORSを返さない', async () => {
    const response = await worker.fetch(new Request('https://contact-preview.example/api/contact/health', {
      headers: { origin: PREVIEW_CONTACT_ORIGIN },
    }), previewEnv);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expectNoCors(response);
  });
});
