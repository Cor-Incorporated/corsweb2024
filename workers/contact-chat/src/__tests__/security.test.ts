import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  CHAT_LIMIT,
  SUBMIT_LIMIT,
  PREVIEW_CONTACT_CORS_HEADERS,
  PREVIEW_CONTACT_ORIGIN,
  ctEq,
  isRateLimited,
  isContactOriginAllowed,
  isValidPreviewContactPreflight,
  previewContactCorsHeaders,
  resetRateLimits,
  TURNSTILE_EXPECTED_ACTION,
  verifyTurnstile,
} from '../security';
import type { Env } from '../types';

afterEach(() => {
  resetRateLimits();
  vi.restoreAllMocks();
});

const reqWithHeaders = (headers: Record<string, string | null>, method = 'POST') => {
  const normalized = Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]),
  );
  return ({
    method,
    headers: {
      get: (name: string) => normalized[name.toLowerCase()] ?? null,
      has: (name: string) => normalized[name.toLowerCase()] !== undefined
        && normalized[name.toLowerCase()] !== null,
    },
  }) as unknown as Request;
};

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

describe('問い合わせAPI Origin / Preview CORS境界', () => {
  const production = { CONTACT_SITE_ENV: 'production' } as Env;
  const preview = { CONTACT_SITE_ENV: 'preview' } as Env;

  it('Origin が無ければ許可（同一オリジンfetch）', () => {
    expect(isContactOriginAllowed(reqWithHeaders({ origin: null }), production)).toBe(true);
    expect(isContactOriginAllowed(reqWithHeaders({ origin: null }), preview)).toBe(true);
  });
  it.each(['https://cor-jp.com', 'https://www.cor-jp.com'])('自オリジン(%s)を許可', (o) => {
    expect(isContactOriginAllowed(reqWithHeaders({ origin: o }), production)).toBe(true);
  });

  it('Previewはchecked-in exact originだけを許可して固定CORSを返す', () => {
    const request = reqWithHeaders({ origin: PREVIEW_CONTACT_ORIGIN });
    expect(isContactOriginAllowed(request, preview)).toBe(true);
    expect(previewContactCorsHeaders(request, preview)).toEqual(PREVIEW_CONTACT_CORS_HEADERS);
    expect(PREVIEW_CONTACT_CORS_HEADERS['access-control-allow-origin']).toBe(PREVIEW_CONTACT_ORIGIN);
    expect(PREVIEW_CONTACT_CORS_HEADERS).not.toHaveProperty('access-control-allow-credentials');
  });

  it.each([
    'https://evil.example',
    'https://cor-jp.com.evil.com',
    'http://cor-jp.com',
    'https://cor-jp.com:8443',
    'https://user@cor-jp.com',
    'https://cor-jp.com/path',
    'https://cor-jp.com?query=1',
    'https://cor-jp.com#fragment',
    '*',
    'null',
  ])(
    'productionは不正・別origin(%s)を拒否',
    (o) => {
      expect(isContactOriginAllowed(reqWithHeaders({ origin: o }), production)).toBe(false);
    },
  );

  it.each([
    'http://codex-cloudia-grift-uat.cloudia-contact.pages.dev',
    'https://user@codex-cloudia-grift-uat.cloudia-contact.pages.dev',
    'https://codex-cloudia-grift-uat.cloudia-contact.pages.dev:443',
    'https://codex-cloudia-grift-uat.cloudia-contact.pages.dev/path',
    'https://codex-cloudia-grift-uat.cloudia-contact.pages.dev?query=1',
    'https://codex-cloudia-grift-uat.cloudia-contact.pages.dev#fragment',
    'https://codex-cloudia-grift-uat.cloudia-contact.pages.dev.evil.example',
    'https://evil-codex-cloudia-grift-uat.cloudia-contact.pages.dev',
    'https://*.cloudia-contact.pages.dev',
    '*',
    'null',
  ])('Previewはexactでないorigin(%s)を拒否', (origin) => {
    const request = reqWithHeaders({ origin });
    expect(isContactOriginAllowed(request, preview)).toBe(false);
    expect(previewContactCorsHeaders(request, preview)).toBeNull();
  });

  it('productionはPreview originを無視しCORSを返さない', () => {
    const request = reqWithHeaders({ origin: PREVIEW_CONTACT_ORIGIN });
    expect(isContactOriginAllowed(request, production)).toBe(false);
    expect(previewContactCorsHeaders(request, production)).toBeNull();
  });

  it.each([undefined, '', 'staging', 'PREVIEW', 'production '])(
    'runtime環境が未知値(%s)ならOrigin有無にかかわらずfail closed',
    (value) => {
      const env = { CONTACT_SITE_ENV: value } as unknown as Env;
      expect(isContactOriginAllowed(reqWithHeaders({ origin: PREVIEW_CONTACT_ORIGIN }), env)).toBe(false);
      expect(isContactOriginAllowed(reqWithHeaders({ origin: null }), env)).toBe(false);
      expect(previewContactCorsHeaders(reqWithHeaders({ origin: PREVIEW_CONTACT_ORIGIN }), env)).toBeNull();
    },
  );

  it('Preview preflightはPOSTとContent-Typeだけを許可する', () => {
    const request = reqWithHeaders({
      origin: PREVIEW_CONTACT_ORIGIN,
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type',
    }, 'OPTIONS');
    expect(isValidPreviewContactPreflight(request, preview)).toBe(true);
  });

  it.each([
    { method: 'GET', headers: 'content-type' },
    { method: 'POST', headers: 'authorization' },
    { method: 'POST', headers: 'content-type, authorization' },
    { method: 'POST', headers: 'content-type, content-type' },
  ])('Preview preflightの追加権限を拒否: $method / $headers', ({ method, headers }) => {
    const request = reqWithHeaders({
      origin: PREVIEW_CONTACT_ORIGIN,
      'access-control-request-method': method,
      'access-control-request-headers': headers,
    }, 'OPTIONS');
    expect(isValidPreviewContactPreflight(request, preview)).toBe(false);
  });

  it('private-network preflightを拒否する', () => {
    const request = reqWithHeaders({
      origin: PREVIEW_CONTACT_ORIGIN,
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type',
      'access-control-request-private-network': 'true',
    }, 'OPTIONS');
    expect(isValidPreviewContactPreflight(request, preview)).toBe(false);
  });
});

describe('verifyTurnstile', () => {
  const requiredOffEnv = {
    TURNSTILE_REQUIRED: 'false',
    TURNSTILE_SECRET: '',
    TURNSTILE_ALLOWED_HOSTNAMES: 'cor-jp.com',
  } as unknown as Env;
  const requiredEnv = {
    TURNSTILE_REQUIRED: 'true',
    TURNSTILE_SECRET: 'server-secret',
    TURNSTILE_ALLOWED_HOSTNAMES: 'cor-jp.com,www.cor-jp.com',
  } as unknown as Env;
  const successPayload = (overrides: Record<string, unknown> = {}) => ({
    success: true,
    challenge_ts: new Date().toISOString(),
    hostname: 'cor-jp.com',
    'error-codes': [],
    action: TURNSTILE_EXPECTED_ACTION,
    ...overrides,
  });
  const respond = (body: unknown, status = 200) => {
    const spy = vi.fn(async () => new Response(JSON.stringify(body), { status }));
    vi.stubGlobal('fetch', spy);
    return spy;
  };

  it('Cloudia explicit widget との action parity は contact-submit だけ', () => {
    expect(TURNSTILE_EXPECTED_ACTION).toBe('contact-submit');
  });

  it('TURNSTILE_REQUIRED=false かつ secret 未設定は後方互換でスキップ', async () => {
    const r = await verifyTurnstile(requiredOffEnv, undefined, '1.2.3.4');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.skipped).toBe(true);
  });

  it('TURNSTILE_REQUIRED 未設定も secret 未設定なら後方互換でスキップ', async () => {
    const r = await verifyTurnstile({ TURNSTILE_SECRET: '' } as unknown as Env, undefined, '1.2.3.4');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.skipped).toBe(true);
  });

  it('TURNSTILE_REQUIRED=false でも既存secretがあれば従来どおり検証する', async () => {
    const spy = respond(successPayload());
    const r = await verifyTurnstile({
      ...requiredEnv,
      TURNSTILE_REQUIRED: 'false',
    }, 'token', '1.2.3.4');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.skipped).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('TURNSTILE_REQUIRED=true で secret 欠落は 503 fail closed', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    const r = await verifyTurnstile({
      ...requiredEnv,
      TURNSTILE_SECRET: '',
    }, 'token', '1.2.3.4');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(503);
    expect(spy).not.toHaveBeenCalled();
  });

  it('TURNSTILE_REQUIRED の不正値は保護を無効化せず 503', async () => {
    const r = await verifyTurnstile({
      ...requiredEnv,
      TURNSTILE_REQUIRED: 'TRUE',
    }, 'token', '1.2.3.4');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(503);
  });

  it('required-on でトークン欠落は外部呼び出し前に 400', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    const r = await verifyTurnstile(requiredEnv, undefined, '1.2.3.4');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });

  it('success/action/hostname/freshness/error-codes がすべて正しければ通過', async () => {
    const spy = respond(successPayload());
    const r = await verifyTurnstile(requiredEnv, 'good-token', '1.2.3.4');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.skipped).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);
    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    const form = new URLSearchParams(String(init.body));
    expect(form.get('secret')).toBe('server-secret');
    expect(form.get('response')).toBe('good-token');
    expect(form.get('remoteip')).toBe('1.2.3.4');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    ['turnstile-spin-v1', '旧 Spin action'],
    ['contact_submit', '類似 action'],
    ['', 'action 欠落'],
  ])('action が contact-submit 以外なら 403: %s (%s)', async (action) => {
    respond(successPayload({ action }));
    const r = await verifyTurnstile(requiredEnv, 'token', '1.2.3.4');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it.each([
    ['evil.example', '別 hostname'],
    ['cor-jp.com.evil.example', 'suffix confusion'],
    ['WWW.cor-jp.com', '大文字違い'],
    ['', 'hostname 欠落'],
  ])('hostname exact allowlist 外は 403: %s (%s)', async (hostname) => {
    respond(successPayload({ hostname }));
    const r = await verifyTurnstile(requiredEnv, 'token', '1.2.3.4');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it('allowlist に列挙した www hostname は exact match で通過', async () => {
    respond(successPayload({ hostname: 'www.cor-jp.com' }));
    const r = await verifyTurnstile(requiredEnv, 'token', '1.2.3.4');
    expect(r.ok).toBe(true);
  });

  it.each([undefined, '', 'https://cor-jp.com', '*.cor-jp.com', 'cor-jp.com,cor-jp.com'])(
    'hostname allowlist 設定不正は 503: %s',
    async (allowed) => {
      const r = await verifyTurnstile({
        ...requiredEnv,
        TURNSTILE_ALLOWED_HOSTNAMES: allowed,
      }, 'token', '1.2.3.4');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.status).toBe(503);
    },
  );

  it('challenge_ts が300秒を超えた token は 400', async () => {
    respond(successPayload({ challenge_ts: new Date(Date.now() - 300_001).toISOString() }));
    const r = await verifyTurnstile(requiredEnv, 'token', '1.2.3.4');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });

  it.each(['not-a-date', undefined])('malformed challenge_ts は 503: %s', async (challenge_ts) => {
    respond(successPayload({ challenge_ts }));
    const r = await verifyTurnstile(requiredEnv, 'token', '1.2.3.4');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(503);
  });

  it('Date.parse可能でもRFC3339でない challenge_ts は503', async () => {
    respond(successPayload({ challenge_ts: new Date().toUTCString() }));
    const r = await verifyTurnstile(requiredEnv, 'token', '1.2.3.4');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(503);
  });

  it('許容clock skewを超える未来の challenge_ts は 503', async () => {
    // Keep a deterministic margin beyond the 60s boundary. A 1ms margin can
    // be consumed by the mocked fetch and make this release-gate test flaky.
    respond(successPayload({ challenge_ts: new Date(Date.now() + 61_000).toISOString() }));
    const r = await verifyTurnstile(requiredEnv, 'token', '1.2.3.4');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(503);
  });

  it.each([
    ['missing-input-response', 400],
    ['invalid-input-response', 400],
    ['timeout-or-duplicate', 400],
    ['missing-input-secret', 503],
    ['invalid-input-secret', 503],
    ['bad-request', 503],
    ['internal-error', 503],
    ['unknown-code', 503],
  ])('Siteverify error-code %s を検証して %i', async (code, status) => {
    respond({ success: false, 'error-codes': [code] });
    const r = await verifyTurnstile(requiredEnv, 'token', '1.2.3.4');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(status);
  });

  it.each([
    { success: false, 'error-codes': [] },
    { success: false },
    { success: 'true', 'error-codes': [] },
    { success: true, 'error-codes': ['internal-error'] },
    { success: true, 'error-codes': [123] },
  ])('矛盾・malformed Siteverify response は 503', async (payload) => {
    respond(payload);
    const r = await verifyTurnstile(requiredEnv, 'token', '1.2.3.4');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(503);
  });

  it('Siteverify HTTP error は 503 fail closed', async () => {
    respond({ success: false, 'error-codes': ['internal-error'] }, 500);
    const r = await verifyTurnstile(requiredEnv, 'token', '1.2.3.4');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(503);
  });

  it('Siteverify malformed JSON は 503 fail closed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{', { status: 200 })));
    const r = await verifyTurnstile(requiredEnv, 'token', '1.2.3.4');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(503);
  });

  it.each(['network', 'timeout'])('%s failure は 503 で submit を進めない', async (kind) => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      if (kind === 'timeout') throw new DOMException('timed out', 'TimeoutError');
      throw new Error('network down');
    }));
    const r = await verifyTurnstile(requiredEnv, 'token', '1.2.3.4');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(503);
  });

  it('Siteverify timeout は exact 8秒で構成し abort 時は503 fail closed', async () => {
    const timeoutSignal = AbortSignal.abort(new DOMException('timed out', 'TimeoutError'));
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeoutSignal);
    const fetchSpy = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.signal).toBe(timeoutSignal);
      throw new DOMException('timed out', 'TimeoutError');
    });
    vi.stubGlobal('fetch', fetchSpy);

    const r = await verifyTurnstile(requiredEnv, 'token', '1.2.3.4');

    expect(timeoutSpy).toHaveBeenCalledOnce();
    expect(timeoutSpy).toHaveBeenCalledWith(8_000);
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(503);
  });

  it('2048文字 token は Cloudflare 契約上の上限として検証する', async () => {
    const spy = respond(successPayload());
    const r = await verifyTurnstile(requiredEnv, 'x'.repeat(2048), '1.2.3.4');
    expect(r.ok).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('2049文字 token は外部呼び出し前に 400', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    const r = await verifyTurnstile(requiredEnv, 'x'.repeat(2049), '1.2.3.4');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });

  it('token/secret/remote IP と例外内容をログへ出さない', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('server-secret good-token 1.2.3.4');
    }));
    const r = await verifyTurnstile(requiredEnv, 'good-token', '1.2.3.4');
    expect(r.ok).toBe(false);
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
    expect(JSON.stringify(r)).not.toContain('server-secret');
    expect(JSON.stringify(r)).not.toContain('good-token');
    expect(JSON.stringify(r)).not.toContain('1.2.3.4');
  });
});
