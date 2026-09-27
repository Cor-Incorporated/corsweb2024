import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../index';
import {
  GRIFT_MAX_RESPONSE_BYTES,
  GRIFT_MAX_PORTAL_TTL_MS,
  GRIFT_TIMEOUT_MS,
  handoffToGrift,
  normalizeHandoffConsent,
} from '../grift';
import { buildBody, buildReceiptBody, buildSubject } from '../email';
import {
  decryptText,
  encryptText,
  getSubmissionForNotification,
  type ContactSessionStorageSnapshot,
  type TrustedContactSession,
} from '../storage';
import { PREVIEW_CONTACT_ORIGIN, resetRateLimits } from '../security';
import type { ContactIntent, Env, NormalizedInquiry } from '../types';

const GRIFT_ORIGIN = 'https://internal.grift.example';
const PORTAL_ORIGIN = 'https://app.griftai.org';
const WORKER_RECEIVED_AT = new Date().toISOString();
const BROWSER_ACCEPTED_AT = new Date(Date.now() - 1_000).toISOString();
const EXCHANGE_CODE = 'Ma_XZhn01UsAfQRYmYxXD9KZVzK0bKQCSv0nZFbofUM';
const PORTAL_PATH = '/chat/portal';
const PORTAL_URL = `${PORTAL_ORIGIN}${PORTAL_PATH}#exchange_code=${EXCHANGE_CODE}`;
const EXPIRES_AT = new Date(Date.now() + 4 * 60 * 1000).toISOString();

const ENV: Env = {
  ANTHROPIC_API_KEY: '',
  RESEND_API_KEY: 're_test',
  TURNSTILE_SECRET: '',
  LLM_PROVIDER: 'anthropic',
  CONTACT_SITE_ENV: 'production',
  CONTACT_TO_EMAIL: 'cloudia@cor-jp.com',
  CONTACT_FROM_EMAIL: 'noreply@cor-jp.com',
  GRIFT_HANDOFF_ENABLED: 'true',
  GRIFT_API_ORIGIN: GRIFT_ORIGIN,
  GRIFT_PUBLIC_URL_ORIGINS: PORTAL_ORIGIN,
  CLOUDIA_HANDOFF_AUTH_TOKEN: 'service-secret-value',
};

const INQUIRY: NormalizedInquiry = {
  name: '山田太郎',
  email: 'taro@example.com',
  company: 'Example Inc.',
  message: '受発注システムの開発を相談したいです',
  summaryText: 'D1で検証済みの相談要約',
  conversationSummary: 'D1で検証済みの相談要約',
  classification: 'genuine',
  intent: 'contract-dev',
  source: 'browser-forged-source',
  structuredLead: {
    purpose: '受発注の効率化',
    industryRole: '製造業の情報システム担当',
    dataSensitivity: '社外秘',
    stage: '要件整理中',
    timingBudget: '3か月以内',
    discoverySource: '検索',
    contactReason: '開発相談',
  },
  utm: {},
  conversationExcerpt: '訪問者: 生会話全文をGriftへ送ってはいけない',
};

const SESSION_STORAGE_SNAPSHOT: ContactSessionStorageSnapshot = {
  intent: 'contract-dev',
  mode: 'intake',
  locale: 'ja',
  source: 'cloudia',
  stage: 'ready',
  turnCount: 2,
  structuredLeadJson: JSON.stringify(INQUIRY.structuredLead),
  missingFieldsJson: '[]',
  classification: 'genuine',
  summaryText: 'D1で検証済みの相談要約',
  conversationExcerptCiphertext: '',
  updatedAt: 1_700_000_000,
  expiresAt: 4_000_000_000,
};

const SESSION: TrustedContactSession = {
  sessionId: 'session-1',
  intent: 'contract-dev',
  locale: 'ja',
  source: 'cloudia',
  classification: 'genuine',
  summary: 'D1で検証済みの相談要約',
  structuredLead: INQUIRY.structuredLead,
  storageSnapshot: SESSION_STORAGE_SNAPSHOT,
};

const CONSENT = {
  accepted: true as const,
  version: 'cloudia-grift-v1' as const,
  acceptedAt: WORKER_RECEIVED_AT,
  browserAcceptedAt: BROWSER_ACCEPTED_AT,
  summaryConfirmed: true as const,
};

function successResponse(overrides: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({
      submission_id: 'submission-1',
      case_id: 'case-1',
      chat_url: PORTAL_URL,
      expires_at: EXPIRES_AT,
      duplicate: false,
      ...overrides,
    }),
    {
      status: 201,
      headers: { 'content-type': 'application/json' },
    }
  );
}

function successResponseForRequest(
  init?: RequestInit,
  overrides: Record<string, unknown> = {}
): Response {
  const submissionId = new Headers(init?.headers).get('idempotency-key') || '';
  return successResponse({ submission_id: submissionId, ...overrides });
}

afterEach(() => {
  resetRateLimits();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('normalizeHandoffConsent', () => {
  it('accepted/version/acceptedAt が揃った明示同意だけを受理する', () => {
    expect(
      normalizeHandoffConsent(
        {
          accepted: true,
          version: 'cloudia-grift-v1',
          acceptedAt: BROWSER_ACCEPTED_AT,
          summaryConfirmed: true,
        },
        WORKER_RECEIVED_AT
      )
    ).toEqual(CONSENT);
    expect(normalizeHandoffConsent({ accepted: true }, WORKER_RECEIVED_AT)).toBeNull();
    expect(
      normalizeHandoffConsent(
        {
          accepted: true,
          version: 'cloudia-grift-v1',
          acceptedAt: BROWSER_ACCEPTED_AT,
          summaryConfirmed: false,
        },
        WORKER_RECEIVED_AT
      )
    ).toBeNull();
    expect(
      normalizeHandoffConsent(
        {
          accepted: false,
          version: 'cloudia-grift-v1',
          acceptedAt: BROWSER_ACCEPTED_AT,
        },
        WORKER_RECEIVED_AT
      )
    ).toBeNull();
    expect(
      normalizeHandoffConsent(
        {
          accepted: true,
          version: 'cloudia-grift-v1',
          acceptedAt: 'not-a-date',
        },
        WORKER_RECEIVED_AT
      )
    ).toBeNull();
    expect(
      normalizeHandoffConsent(
        {
          accepted: true,
          version: 'forged-version',
          acceptedAt: BROWSER_ACCEPTED_AT,
          summaryConfirmed: true,
        },
        WORKER_RECEIVED_AT
      )
    ).toBeNull();
    expect(
      normalizeHandoffConsent(
        {
          accepted: true,
          version: 'cloudia-grift-v1',
          acceptedAt: BROWSER_ACCEPTED_AT,
          summaryConfirmed: 'true',
        },
        WORKER_RECEIVED_AT
      )
    ).toBeNull();
  });
});

describe('handoffToGrift', () => {
  it('D1のcontract-dev sessionと明示同意がある場合だけBearerで同期呼出しする', async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
      async (_url, init) => successResponseForRequest(init)
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      handoffToGrift(ENV, {
        submissionId: 'submission-1',
        inquiry: INQUIRY,
        session: SESSION,
        consent: CONSENT,
      })
    ).resolves.toEqual({
      status: 'ready',
      url: PORTAL_URL,
      expiresAt: EXPIRES_AT,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    if (!init) throw new Error('Grift request init missing');
    expect(url).toBe(`${GRIFT_ORIGIN}/v1/internal/cloudia/intake-sessions`);
    expect(init.method).toBe('POST');
    expect(init.redirect).toBe('manual');
    expect((init.headers as Record<string, string>).authorization).toBe(
      'Bearer service-secret-value'
    );
    expect((init.headers as Record<string, string>)['idempotency-key']).toBe('submission-1');
    const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(payload).toEqual({
      schema_version: 'cloudia-grift-handoff.v1',
      intent: 'contract-dev',
      source: 'corsweb-contact-chat',
      locale: 'ja',
      contact: {
        name: INQUIRY.name,
        email: INQUIRY.email,
        company: INQUIRY.company,
      },
      inquiry: {
        message: INQUIRY.message,
        summary: SESSION.summary,
        structured_lead: {
          purpose: '受発注の効率化',
          industry_role: '製造業の情報システム担当',
          data_sensitivity: '社外秘',
          stage: '要件整理中',
          timing_budget: '3か月以内',
        },
      },
      consent: {
        version: 'cloudia-grift-v1',
        accepted_at: CONSENT.acceptedAt,
      },
    });
    expect(JSON.stringify(payload)).not.toContain('tenant_id');
    expect(JSON.stringify(payload)).not.toContain('生会話全文');
    expect(JSON.stringify(payload)).not.toContain('browser-forged-source');
  });

  it.each(['contract-dev', 'grift-team-beta', 'grift-paid-trial', 'estimate-audit'] as const)(
    'trusted D1 intent=%sは固定contract-dev payloadでhandoffする',
    async (intent) => {
      const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
        async (_url, init) => successResponseForRequest(init)
      );
      vi.stubGlobal('fetch', fetchMock);
      await expect(
        handoffToGrift(ENV, {
          submissionId: `submission-${intent}`,
          inquiry: { ...INQUIRY, intent },
          session: { ...SESSION, intent },
          consent: CONSENT,
        })
      ).resolves.toMatchObject({ status: 'ready' });
      const payload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as Record<
        string,
        unknown
      >;
      expect(payload.intent).toBe('contract-dev');
      expect(payload.source).toBe('corsweb-contact-chat');
    }
  );

  it.each(['confidential-ai-assessment', 'local-llm-poc', 'press-speaking-other'] as const)(
    '対象外intent=%sでは呼び出さず既存応答を維持する',
    async (intent) => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      await expect(
        handoffToGrift(ENV, {
          submissionId: 'submission-1',
          inquiry: { ...INQUIRY, intent },
          session: { ...SESSION, intent },
          consent: CONSENT,
        })
      ).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it('trusted session intentと正規化済みinquiry intentが不一致ならfallbackにする', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      handoffToGrift(ENV, {
        submissionId: 'submission-1',
        inquiry: { ...INQUIRY, intent: 'grift-team-beta' },
        session: { ...SESSION, intent: 'grift-paid-trial' },
        consent: CONSENT,
      })
    ).resolves.toEqual({ status: 'fallback' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('明示同意なしでは呼び出さず既存応答を維持する', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      handoffToGrift(ENV, {
        submissionId: 'submission-1',
        inquiry: INQUIRY,
        session: SESSION,
        consent: null,
      })
    ).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('contract-devの同意があっても信頼済みsessionなしではfallbackにする', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      handoffToGrift(ENV, {
        submissionId: 'submission-1',
        inquiry: INQUIRY,
        session: null,
        consent: CONSENT,
      })
    ).resolves.toEqual({ status: 'fallback' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('feature flagがexact trueでなければ呼び出さずfallbackにする', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      handoffToGrift(
        { ...ENV, GRIFT_HANDOFF_ENABLED: 'false' },
        {
          submissionId: 'submission-1',
          inquiry: INQUIRY,
          session: SESSION,
          consent: CONSENT,
        }
      )
    ).resolves.toEqual({ status: 'fallback' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['sales', 'spam'] as const)(
    '信頼済みsessionが%sなら呼び出さずfallbackにする',
    async (classification) => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      await expect(
        handoffToGrift(ENV, {
          submissionId: 'submission-1',
          inquiry: { ...INQUIRY, classification },
          session: { ...SESSION, classification },
          consent: CONSENT,
        })
      ).resolves.toEqual({ status: 'fallback' });
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it('partial structured leadを欠落補完せず契約どおり送る', async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
      async (_url, init) => successResponseForRequest(init)
    );
    vi.stubGlobal('fetch', fetchMock);
    await handoffToGrift(ENV, {
      submissionId: 'submission-partial',
      inquiry: INQUIRY,
      session: { ...SESSION, structuredLead: { purpose: 'PoC相談' } },
      consent: CONSENT,
    });
    const payload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as {
      inquiry?: { structured_lead?: Record<string, string> };
    };
    expect(payload.inquiry?.structured_lead).toEqual({ purpose: 'PoC相談' });
  });

  it('8秒でtimeoutしHTTPエラーにせずfallbackにする', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), {
            once: true,
          });
        })
    );
    vi.stubGlobal('fetch', fetchMock);
    const pending = handoffToGrift(ENV, {
      submissionId: 'submission-1',
      inquiry: INQUIRY,
      session: SESSION,
      consent: CONSENT,
    });
    await vi.advanceTimersByTimeAsync(GRIFT_TIMEOUT_MS);
    await expect(pending).resolves.toEqual({ status: 'fallback' });
  });

  it.each([400, 429, 500, 503])('Grift HTTP %i はfallbackにする', async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('provider error', { status }))
    );
    await expect(
      handoffToGrift(ENV, {
        submissionId: 'submission-1',
        inquiry: INQUIRY,
        session: SESSION,
        consent: CONSENT,
      })
    ).resolves.toEqual({ status: 'fallback' });
  });

  it('3xx redirectを追跡せずfallbackにする', async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'https://evil.example/steal' },
        })
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      handoffToGrift(ENV, {
        submissionId: 'submission-1',
        inquiry: INQUIRY,
        session: SESSION,
        consent: CONSENT,
      })
    ).resolves.toEqual({ status: 'fallback' });
    expect(fetchMock.mock.calls[0][1]?.redirect).toBe('manual');
  });

  it('invalid JSONはfallbackにする', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{invalid', { status: 200 }))
    );
    await expect(
      handoffToGrift(ENV, {
        submissionId: 'submission-1',
        inquiry: INQUIRY,
        session: SESSION,
        consent: CONSENT,
      })
    ).resolves.toEqual({ status: 'fallback' });
  });

  it('JSONでも必須fieldの型が契約外ならfallbackにする', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => successResponse({ duplicate: 'false' }))
    );
    await expect(
      handoffToGrift(ENV, {
        submissionId: 'submission-1',
        inquiry: INQUIRY,
        session: SESSION,
        consent: CONSENT,
      })
    ).resolves.toEqual({ status: 'fallback' });
  });

  it('Grift応答のsubmission_idが要求IDと不一致なら別case URLを返さない', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => successResponse({ submission_id: 'other-submission' }))
    );
    await expect(
      handoffToGrift(ENV, {
        submissionId: 'submission-1',
        inquiry: INQUIRY,
        session: SESSION,
        consent: CONSENT,
      })
    ).resolves.toEqual({ status: 'fallback' });
  });

  it('summaryTextとD1保存用summaryが一致しない場合はhandoffしない', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      handoffToGrift(ENV, {
        submissionId: 'submission-1',
        inquiry: { ...INQUIRY, conversationSummary: '別の要約' },
        session: SESSION,
        consent: CONSENT,
      })
    ).resolves.toEqual({ status: 'fallback' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('browserがsummaryTextとconversationSummaryを同時改ざんしてもD1要約を置換できない', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      handoffToGrift(ENV, {
        submissionId: 'submission-1',
        inquiry: {
          ...INQUIRY,
          summaryText: 'ブラウザで捏造した緊急案件',
          conversationSummary: 'ブラウザで捏造した緊急案件',
        },
        session: SESSION,
        consent: CONSENT,
      })
    ).resolves.toEqual({ status: 'fallback' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('応答上限を超えるContent-Lengthは本文を信用せずfallbackにする', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('{}', {
            status: 200,
            headers: { 'content-length': String(GRIFT_MAX_RESPONSE_BYTES + 1) },
          })
      )
    );
    await expect(
      handoffToGrift(ENV, {
        submissionId: 'submission-1',
        inquiry: INQUIRY,
        session: SESSION,
        consent: CONSENT,
      })
    ).resolves.toEqual({ status: 'fallback' });
  });

  it('Content-Lengthなしの巨大responseもstreaming上限でfallbackにする', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(GRIFT_MAX_RESPONSE_BYTES + 1));
        controller.close();
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(body, {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
      )
    );
    await expect(
      handoffToGrift(ENV, {
        submissionId: 'submission-1',
        inquiry: INQUIRY,
        session: SESSION,
        consent: CONSENT,
      })
    ).resolves.toEqual({ status: 'fallback' });
  });

  it('許可origin外の公開URLはブラウザへ返さない', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        successResponse({
          chat_url: `https://evil.example/chat/portal#exchange_code=${EXCHANGE_CODE}`,
        })
      )
    );
    await expect(
      handoffToGrift(ENV, {
        submissionId: 'submission-1',
        inquiry: INQUIRY,
        session: SESSION,
        consent: CONSENT,
      })
    ).resolves.toEqual({ status: 'fallback' });
  });

  it.each([
    {
      boundary: 'scheme/origin/userinfo/port',
      urls: [
        `http://app.griftai.org/chat/portal#exchange_code=${EXCHANGE_CODE}`,
        `https://app.griftai.org:443/chat/portal#exchange_code=${EXCHANGE_CODE}`,
        `https://app.griftai.org:444/chat/portal#exchange_code=${EXCHANGE_CODE}`,
        `https://user:password@app.griftai.org/chat/portal#exchange_code=${EXCHANGE_CODE}`,
        `https://user%3Apassword@app.griftai.org/chat/portal#exchange_code=${EXCHANGE_CODE}`,
        `https://app.griftai.org.evil.example/chat/portal#exchange_code=${EXCHANGE_CODE}`,
      ],
    },
    {
      boundary: 'exact path/query/raw URL',
      urls: [
        // Historical path-credential forms are retained only as rejection regressions.
        `${PORTAL_ORIGIN}${PORTAL_PATH}/${EXCHANGE_CODE}`,
        `${PORTAL_ORIGIN}${PORTAL_PATH}/#exchange_code=${EXCHANGE_CODE}`,
        `${PORTAL_ORIGIN}/other#exchange_code=${EXCHANGE_CODE}`,
        `${PORTAL_ORIGIN}/chat/%70ortal#exchange_code=${EXCHANGE_CODE}`,
        `${PORTAL_ORIGIN}/chat/portal?next=https://evil.example#exchange_code=${EXCHANGE_CODE}`,
        ` ${PORTAL_URL}`,
        `${PORTAL_URL} `,
      ],
    },
    {
      boundary: 'exact fragment key/count',
      urls: [
        `${PORTAL_ORIGIN}/chat/portal`,
        `${PORTAL_ORIGIN}/chat/portal#exchange_code=`,
        `${PORTAL_ORIGIN}/chat/portal#Exchange_code=${EXCHANGE_CODE}`,
        `${PORTAL_ORIGIN}/chat/portal#exchange%5Fcode=${EXCHANGE_CODE}`,
        `${PORTAL_ORIGIN}/chat/portal#unknown=${EXCHANGE_CODE}`,
        `${PORTAL_URL}&next=1`,
        `${PORTAL_URL}&exchange_code=${EXCHANGE_CODE}`,
      ],
    },
    {
      boundary: '32-byte canonical base64url code',
      urls: [
        `${PORTAL_ORIGIN}/chat/portal#exchange_code=${EXCHANGE_CODE.slice(0, 42)}`,
        `${PORTAL_URL}A`,
        `${PORTAL_ORIGIN}/chat/portal#exchange_code=${EXCHANGE_CODE.slice(0, 42)}.`,
        `${PORTAL_ORIGIN}/chat/portal#exchange_code=${EXCHANGE_CODE.slice(0, 42)}~`,
        `${PORTAL_ORIGIN}/chat/portal#exchange_code=${EXCHANGE_CODE.slice(0, 42)}+`,
        `${PORTAL_ORIGIN}/chat/portal#exchange_code=${EXCHANGE_CODE.slice(0, 42)}/`,
        `${PORTAL_URL}=`,
        `${PORTAL_ORIGIN}/chat/portal#exchange_code=%4Da_XZhn01UsAfQRYmYxXD9KZVzK0bKQCSv0nZFbofUM`,
        `${PORTAL_ORIGIN}/chat/portal#exchange_code=${EXCHANGE_CODE.slice(0, 42)}B`,
      ],
    },
  ])('$boundary契約外のURLをすべて拒否する', async ({ urls }) => {
    for (const chatUrl of urls) {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => successResponse({ chat_url: chatUrl }))
      );
      await expect(
        handoffToGrift(ENV, {
          submissionId: 'submission-1',
          inquiry: INQUIRY,
          session: SESSION,
          consent: CONSENT,
        }),
        chatUrl
      ).resolves.toEqual({ status: 'fallback' });
    }
  });

  it.each([
    new Date(Date.now() - 1).toISOString(),
    new Date(Date.now() + GRIFT_MAX_PORTAL_TTL_MS + 60_000).toISOString(),
  ])('期限が過去または5分超ならfallbackにする: %s', async (expiresAt) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => successResponse({ expires_at: expiresAt }))
    );
    await expect(
      handoffToGrift(ENV, {
        submissionId: 'submission-1',
        inquiry: INQUIRY,
        session: SESSION,
        consent: CONSENT,
      })
    ).resolves.toEqual({ status: 'fallback' });
  });

  it('公開origin設定もpath・userinfo・明示portなしのexact HTTPS originだけを受理する', async () => {
    for (const configuredOrigins of [
      `${PORTAL_ORIGIN}/`,
      'https://app.griftai.org:443',
      'https://app.griftai.org:444',
      'https://user@app.griftai.org',
      'https://*.griftai.org',
      `${PORTAL_ORIGIN}/chat/portal`,
    ]) {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      await expect(
        handoffToGrift(
          { ...ENV, GRIFT_PUBLIC_URL_ORIGINS: configuredOrigins },
          {
            submissionId: 'submission-1',
            inquiry: INQUIRY,
            session: SESSION,
            consent: CONSENT,
          }
        ),
        configuredOrigins
      ).resolves.toEqual({ status: 'fallback' });
      expect(fetchMock).not.toHaveBeenCalled();
    }
  });

  it.each([
    'http://internal.grift.example',
    'https://127.0.0.1',
    'https://2130706433',
    'https://0x7f000001',
    'https://[::1]',
    'https://metadata.google.internal',
    'https://internal.grift.example/path',
    'https://user@internal.grift.example',
  ])('SSRFになり得るAPI origin設定を拒否する: %s', async (apiOrigin) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      handoffToGrift(
        { ...ENV, GRIFT_API_ORIGIN: apiOrigin },
        {
          submissionId: 'submission-1',
          inquiry: INQUIRY,
          session: SESSION,
          consent: CONSENT,
        }
      )
    ).resolves.toEqual({ status: 'fallback' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([undefined, '', 'bad token', 'bad\nsecret'])(
    'Bearer token不足/不正はfallbackにする',
    async (token) => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      await expect(
        handoffToGrift(
          { ...ENV, CLOUDIA_HANDOFF_AUTH_TOKEN: token },
          {
            submissionId: 'submission-1',
            inquiry: INQUIRY,
            session: SESSION,
            consent: CONSENT,
          }
        )
      ).resolves.toEqual({ status: 'fallback' });
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it('duplicate成功も同じsubmission IDを冪等キーにしてreadyを返す', async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
      async (_url, init) => successResponseForRequest(init, { duplicate: true })
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      handoffToGrift(ENV, {
        submissionId: 'same-submission-id',
        inquiry: INQUIRY,
        session: SESSION,
        consent: CONSENT,
      })
    ).resolves.toMatchObject({ status: 'ready' });
    const [, init] = fetchMock.mock.calls[0];
    if (!init) throw new Error('Grift request init missing');
    expect((init.headers as Record<string, string>)['idempotency-key']).toBe('same-submission-id');
  });

  it('ログへPII・service secret・公開URLを出さない', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const rejectedUrl = `https://evil.example/chat/portal#exchange_code=${EXCHANGE_CODE}`;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => successResponse({ chat_url: rejectedUrl }))
    );
    await handoffToGrift(ENV, {
      submissionId: 'submission-1',
      inquiry: INQUIRY,
      session: SESSION,
      consent: CONSENT,
    });
    const output = JSON.stringify(log.mock.calls);
    expect(output).not.toContain(INQUIRY.email);
    expect(output).not.toContain(ENV.CLOUDIA_HANDOFF_AUTH_TOKEN);
    expect(output).not.toContain(rejectedUrl);
    expect(output).not.toContain('submission-1');
  });
});

function post(body: Record<string, unknown>, ip: string, origin?: string): Request {
  return new Request('https://cor-jp.com/api/contact/submit', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': ip,
      ...(origin ? { origin } : {}),
    },
    body: JSON.stringify(body),
  });
}

function confirmedHandoffFields(intent: ContactIntent = 'contract-dev') {
  return {
    intent,
    summaryText: {
      version: 1,
      locale: 'ja',
      intent,
      classification: 'genuine',
      readyForContact: true,
      stage: 'ready',
      structuredLead: INQUIRY.structuredLead,
      text: 'D1で検証済みの相談要約',
    },
    handoffConsent: {
      accepted: true,
      version: 'cloudia-grift-v1',
      acceptedAt: CONSENT.browserAcceptedAt,
      summaryConfirmed: true,
    },
  };
}

interface CreateDbOptions {
  active?: boolean;
  classification?: 'genuine' | 'sales' | 'spam';
  intent?: ContactIntent;
  restoreError?: boolean;
  restoredSessionId?: string;
  excerptSessionId?: string;
  excerptReadError?: boolean;
  concurrentSessionUpdate?: boolean;
  events?: string[];
}

async function createDb(options: CreateDbOptions = {}) {
  const excerpt = await encryptText('storage-secret', '暗号化済み会話抜粋');
  const calls: Array<{ sql: string; bindings: unknown[] }> = [];
  let submissionBindings: unknown[] | null = null;
  let auditMetadata = '{}';
  let pendingExisting: {
    submission_id: string;
    receipt_id: string;
    payload_fingerprint: string;
    metadata_json: string | null;
  } | null = null;
  let existing: {
    submission_id: string;
    receipt_id: string;
    payload_fingerprint: string;
    metadata_json: string | null;
  } | null = null;
  return {
    calls,
    prepare(sql: string) {
      return {
        bind(...bindings: unknown[]) {
          calls.push({ sql, bindings });
          if (sql.includes('INSERT INTO submission_intake')) {
            submissionBindings = bindings;
            pendingExisting = {
              submission_id: String(bindings[0]),
              receipt_id: String(bindings[4]),
              payload_fingerprint: String(bindings[2]),
              metadata_json: null,
            };
          }
          if (sql.includes('INSERT INTO audit_events') && pendingExisting) {
            pendingExisting.metadata_json = String(bindings[3]);
            auditMetadata = String(bindings[3]);
          }
          return {
            __sql: sql,
            first: async <T>() => {
              if (sql.includes('FROM contact_sessions') && sql.includes("status = 'active'")) {
                options.events?.push('session-read');
                if (options.active === false) return null as T;
                if (options.restoreError)
                  throw new Error('synthetic D1 read failure with private detail');
                return {
                  session_id: options.restoredSessionId || 'session-1',
                  intent: options.intent || 'contract-dev',
                  mode: 'intake',
                  locale: 'ja',
                  source: 'cloudia',
                  stage: 'ready',
                  turn_count: 2,
                  classification: options.classification || 'genuine',
                  summary_text: 'D1で検証済みの相談要約',
                  structured_lead_json: JSON.stringify(INQUIRY.structuredLead),
                  missing_fields_json: '[]',
                  conversation_excerpt_ciphertext: excerpt,
                  updated_at: 1_700_000_000,
                  expires_at: 4_000_000_000,
                } as T;
              }
              if (sql.includes('SELECT o.outbox_id') && submissionBindings) {
                return {
                  outbox_id: `outbox-${String(bindings[1])}`,
                  submission_id: String(submissionBindings[0]),
                  receipt_id: String(submissionBindings[4]),
                  message_type: String(bindings[1]),
                  name_ciphertext: String(submissionBindings[5]),
                  email_ciphertext: String(submissionBindings[6]),
                  company_ciphertext: String(submissionBindings[7]),
                  message_ciphertext: String(submissionBindings[8]),
                  summary_ciphertext: String(submissionBindings[9]),
                  conversation_excerpt_ciphertext: String(submissionBindings[10]),
                  intent: String(submissionBindings[12]),
                  source: String(submissionBindings[13]),
                  structured_lead_json: String(submissionBindings[14]),
                  utm_json: String(submissionBindings[15]),
                  classification: String(submissionBindings[16]),
                  metadata_json: auditMetadata,
                } as T;
              }
              if (sql.includes('FROM submission_intake s')) return existing as T;
              return null as T;
            },
            run: async () => ({ meta: { changes: 1 } }),
          };
        },
      };
    },
    batch: async (statements: Array<{ __sql?: string }>) => {
      options.events?.push('storage-batch');
      const trustedInsert = statements[0]?.__sql?.includes('FROM contact_sessions') === true;
      if (trustedInsert && options.excerptReadError) {
        options.excerptReadError = false;
        throw new Error('synthetic D1 CAS read failure');
      }
      const casMiss = trustedInsert && (
        options.concurrentSessionUpdate === true
        || (options.excerptSessionId !== undefined && options.excerptSessionId !== 'session-1')
      );
      const changes = casMiss ? 0 : 1;
      if (changes > 0 && pendingExisting) existing = { ...pendingExisting };
      return statements.map(() => ({ meta: { changes } }));
    },
  } as unknown as D1Database & { calls: Array<{ sql: string; bindings: unknown[] }> };
}

function submitEnv(db: D1Database, queueSend: (message: unknown) => Promise<void>): Env {
  return {
    ...ENV,
    DB: db,
    CONTACT_NOTIFICATIONS: { send: queueSend } as unknown as Queue,
    PII_ENCRYPTION_KEY: 'storage-secret',
    PII_HMAC_KEY: 'hmac-secret',
  };
}

describe('POST /api/contact/submit Grift integration', () => {
  it('non-Grift pathではbrowserの要約・routing・lead改ざんをD1正本で置換し、通知も同じ値を使う', async () => {
    const db = await createDb({ intent: 'press-speaking-other' });
    const queueSend = vi.fn(async (_message: unknown) => undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const forgedLead = {
      purpose: 'ブラウザで捏造した緊急案件',
      contactReason: '今すぐ最優先で対応',
    };
    const response = await worker.fetch(
      post(
        {
          sessionId: 'session-1',
          idempotencyKey: 'non-grift-browser-tampering',
          name: INQUIRY.name,
          email: INQUIRY.email,
          company: INQUIRY.company,
          message: INQUIRY.message,
          summaryText: 'ブラウザで捏造した要約',
          intent: 'contract-dev',
          source: 'browser-forged-source',
          classification: 'spam',
          structuredLead: forgedLead,
        },
        '198.51.100.70'
      ),
      submitEnv(db, queueSend)
    );

    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(queueSend.mock.calls.map(([message]) => message)).toEqual([
      expect.objectContaining({ messageType: 'internal' }),
      expect.objectContaining({ messageType: 'receipt' }),
    ]);
    const outboxInserts = db.calls.filter((call) =>
      call.sql.includes('INSERT INTO notification_outbox')
    );
    expect(outboxInserts).toHaveLength(2);
    expect(JSON.stringify(outboxInserts)).not.toContain('ブラウザで捏造した');
    const insert = db.calls.filter((call) => call.sql.includes('INSERT INTO submission_intake')).at(-1);
    expect(insert).toBeDefined();
    await expect(decryptText('storage-secret', String(insert?.bindings[9]))).resolves.toBe(
      'D1で検証済みの相談要約'
    );
    expect(insert?.bindings[12]).toBe('press-speaking-other');
    expect(insert?.bindings[13]).toBe('cloudia');
    expect(insert?.bindings[16]).toBe('genuine');
    expect(JSON.parse(String(insert?.bindings[14]))).toEqual(INQUIRY.structuredLead);
    expect(JSON.stringify(insert?.bindings)).not.toContain('ブラウザで捏造した');

    const readbackDb = {
      prepare(sql: string) {
        return {
          bind(...bindings: unknown[]) {
            return {
              first: async <T>() =>
                sql.includes('SELECT o.outbox_id')
                  ? ({
                      outbox_id: `outbox-${String(bindings[1])}`,
                      submission_id: String(insert?.bindings[0]),
                      receipt_id: String(insert?.bindings[4]),
                      message_type: String(bindings[1]),
                      name_ciphertext: String(insert?.bindings[5]),
                      email_ciphertext: String(insert?.bindings[6]),
                      company_ciphertext: String(insert?.bindings[7]),
                      message_ciphertext: String(insert?.bindings[8]),
                      summary_ciphertext: String(insert?.bindings[9]),
                      conversation_excerpt_ciphertext: String(insert?.bindings[10]),
                      intent: String(insert?.bindings[12]),
                      source: String(insert?.bindings[13]),
                      structured_lead_json: String(insert?.bindings[14]),
                      utm_json: String(insert?.bindings[15]),
                      classification: String(insert?.bindings[16]),
                      metadata_json: null,
                    } as T)
                  : (null as T),
            };
          },
        };
      },
    } as unknown as D1Database;
    const readbackEnv = { DB: readbackDb, PII_ENCRYPTION_KEY: 'storage-secret' } as unknown as Env;
    const internal = await getSubmissionForNotification(
      readbackEnv,
      String(insert?.bindings[0]),
      'internal'
    );
    const receipt = await getSubmissionForNotification(
      readbackEnv,
      String(insert?.bindings[0]),
      'receipt'
    );
    expect(buildBody(internal!.inquiry)).toContain('D1で検証済みの相談要約');
    expect(buildSubject(internal!.inquiry)).toContain('[genuine][press-speaking-other]');
    expect(buildReceiptBody(receipt!.inquiry, receipt!.receiptId)).toContain(
      'D1で検証済みの相談要約'
    );
    expect(
      `${buildBody(internal!.inquiry)}\n${buildReceiptBody(receipt!.inquiry, receipt!.receiptId)}`
    ).not.toContain('ブラウザで捏造した');

    const replay = await worker.fetch(
      post(
        {
          sessionId: 'session-1',
          idempotencyKey: 'non-grift-browser-tampering',
          name: INQUIRY.name,
          email: INQUIRY.email,
          company: INQUIRY.company,
          message: INQUIRY.message,
          summaryText: '再送時に別のbrowser要約へ改ざん',
          intent: 'estimate-audit',
          source: 'second-forged-source',
          classification: 'sales',
          structuredLead: { purpose: '再送時の捏造' },
        },
        '198.51.100.74'
      ),
      submitEnv(db, queueSend)
    );
    expect(replay.status).toBe(200);
    await expect(replay.json()).resolves.toMatchObject({ duplicate: true });
    expect(
      db.calls.filter((call) => call.sql.includes('INSERT INTO submission_intake'))
    ).toHaveLength(1);
    expect(queueSend).toHaveBeenCalledTimes(4);

    const changedPayload = await worker.fetch(
      post(
        {
          sessionId: 'session-1',
          idempotencyKey: 'non-grift-browser-tampering',
          name: INQUIRY.name,
          email: INQUIRY.email,
          company: INQUIRY.company,
          message: '実際の問い合わせ本文を変更',
          summaryText: '再送時に別のbrowser要約へ改ざん',
        },
        '198.51.100.75',
        PREVIEW_CONTACT_ORIGIN
      ),
      { ...submitEnv(db, queueSend), CONTACT_SITE_ENV: 'preview' }
    );
    expect(changedPayload.status).toBe(409);
    expect(changedPayload.headers.get('access-control-allow-origin')).toBe(PREVIEW_CONTACT_ORIGIN);
    expect(changedPayload.headers.get('vary')).toBe('Origin');
    expect(changedPayload.headers.get('access-control-allow-methods')).toBe('POST');
    expect(changedPayload.headers.get('access-control-allow-headers')).toBe('Content-Type');
    expect(changedPayload.headers.get('access-control-max-age')).toBe('600');
    expect(changedPayload.headers.get('access-control-allow-credentials')).toBeNull();
    await expect(changedPayload.json()).resolves.toMatchObject({
      code: 'IDEMPOTENCY_PAYLOAD_CONFLICT',
    });
    expect(queueSend).toHaveBeenCalledTimes(4);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['contract-dev', 'grift-team-beta', 'grift-paid-trial', 'estimate-audit'] as const)(
    'eligible intent=%sではbrowserのrouting・lead改ざんをD1正本で置換する',
    async (intent) => {
      const db = await createDb({ intent });
      const queueSend = vi.fn(async () => undefined);
      const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
        async (_url, init) => successResponseForRequest(init)
      );
      vi.stubGlobal('fetch', fetchMock);
      const fields = confirmedHandoffFields(intent);
      const forgedLead = { purpose: 'ブラウザで捏造した緊急案件', contactReason: '最優先対応' };
      const response = await worker.fetch(
        post(
          {
            sessionId: 'session-1',
            idempotencyKey: `eligible-routing-tampering-${intent}`,
            name: INQUIRY.name,
            email: INQUIRY.email,
            company: INQUIRY.company,
            message: INQUIRY.message,
            ...fields,
            intent: 'press-speaking-other',
            source: 'browser-forged-source',
            classification: 'spam',
            structuredLead: forgedLead,
            summaryText: {
              ...fields.summaryText,
              intent: 'press-speaking-other',
              classification: 'spam',
              structuredLead: forgedLead,
            },
          },
          '198.51.100.71'
        ),
        submitEnv(db, queueSend)
      );

      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
      expect(payload.intent).toBe('contract-dev');
      expect(payload.source).toBe('corsweb-contact-chat');
      expect(payload.inquiry.summary).toBe('D1で検証済みの相談要約');
      expect(payload.inquiry.structured_lead).toEqual({
        purpose: INQUIRY.structuredLead.purpose,
        industry_role: INQUIRY.structuredLead.industryRole,
        data_sensitivity: INQUIRY.structuredLead.dataSensitivity,
        stage: INQUIRY.structuredLead.stage,
        timing_budget: INQUIRY.structuredLead.timingBudget,
      });
      expect(JSON.stringify(payload)).not.toContain('ブラウザで捏造した');
      expect(JSON.stringify(payload)).not.toContain('browser-forged-source');
      expect(JSON.stringify(payload)).not.toContain('生会話全文');
      const insert = db.calls.find((call) => call.sql.includes('INSERT INTO submission_intake'));
      await expect(decryptText('storage-secret', String(insert?.bindings[9]))).resolves.toBe(
        'D1で検証済みの相談要約'
      );
      expect(insert?.bindings[12]).toBe(intent);
      expect(insert?.bindings[13]).toBe('cloudia');
      expect(insert?.bindings[16]).toBe('genuine');
      expect(JSON.parse(String(insert?.bindings[14]))).toEqual(INQUIRY.structuredLead);
    }
  );

  it.each(['contract-dev', 'grift-team-beta', 'grift-paid-trial', 'estimate-audit'] as const)(
    'eligible intent=%sで確認要約を改ざんすると副作用前にstable 409',
    async (intent) => {
      const db = await createDb({ intent });
      const queueSend = vi.fn(async () => undefined);
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      const fields = confirmedHandoffFields(intent);
      const response = await worker.fetch(
        post(
          {
            sessionId: 'session-1',
            idempotencyKey: `eligible-summary-tampering-${intent}`,
            name: INQUIRY.name,
            email: INQUIRY.email,
            message: INQUIRY.message,
            ...fields,
            summaryText: { ...fields.summaryText, text: 'ブラウザで改ざんした確認要約' },
          },
          '198.51.100.72'
        ),
        submitEnv(db, queueSend)
      );

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual({
        error: '確認済み要約が現在のセッション内容と一致しません。画面を更新して再確認してください',
        code: 'CONTACT_SESSION_SUMMARY_MISMATCH',
      });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(queueSend).not.toHaveBeenCalled();
      expect(db.calls.some((call) => call.sql.includes('INSERT INTO submission_intake'))).toBe(
        false
      );
      expect(db.calls.some((call) => call.sql.includes('INSERT INTO notification_outbox'))).toBe(
        false
      );
    }
  );

  it('Grift accepted_atはbrowser時刻ではなくWorker受信時刻を送る', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(WORKER_RECEIVED_AT));
    const db = await createDb();
    const queueSend = vi.fn(async () => undefined);
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
      async (_url, init) => successResponseForRequest(init)
    );
    vi.stubGlobal('fetch', fetchMock);
    const response = await worker.fetch(
      post(
        {
          sessionId: 'session-1',
          idempotencyKey: 'worker-consent-time',
          name: INQUIRY.name,
          email: INQUIRY.email,
          message: INQUIRY.message,
          ...confirmedHandoffFields(),
        },
        '198.51.100.30'
      ),
      submitEnv(db, queueSend)
    );

    expect(response.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0];
    if (!init) throw new Error('Grift request init missing');
    const payload = JSON.parse(String(init.body)) as {
      consent?: { accepted_at?: string; browser_accepted_at?: string };
      inquiry?: { summary?: string };
    };
    expect(payload.consent?.accepted_at).toBe(WORKER_RECEIVED_AT);
    expect(payload.consent?.accepted_at).not.toBe(BROWSER_ACCEPTED_AT);
    expect(payload.consent?.browser_accepted_at).toBeUndefined();
    expect(payload.inquiry?.summary).toBe('D1で検証済みの相談要約');
    const insert = db.calls.find((call) => call.sql.includes('INSERT INTO submission_intake'));
    await expect(decryptText('storage-secret', String(insert?.bindings[9]))).resolves.toBe(
      'D1で検証済みの相談要約'
    );
  });

  it.each(['success', 'failure'] as const)(
    'Grift %sでもD1要約をoutbox・両通知・handoffの共通正本にする',
    async (outcome) => {
      const db = await createDb();
      const queueSend = vi.fn(async () => undefined);
      const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
        outcome === 'success'
          ? successResponseForRequest(init)
          : new Response('failure', { status: 503 })
      );
      vi.stubGlobal('fetch', fetchMock);
      const response = await worker.fetch(
        post(
          {
            sessionId: 'session-1',
            idempotencyKey: `email-maintained-${outcome}`,
            name: INQUIRY.name,
            email: INQUIRY.email,
            company: INQUIRY.company,
            message: INQUIRY.message,
            ...confirmedHandoffFields(),
          },
          outcome === 'success' ? '198.51.100.31' : '198.51.100.32'
        ),
        submitEnv(db, queueSend)
      );

      expect(response.status).toBe(200);
      expect(queueSend).toHaveBeenCalledTimes(2);
      expect(queueSend).toHaveBeenCalledWith(expect.objectContaining({ messageType: 'internal' }));
      expect(queueSend).toHaveBeenCalledWith(expect.objectContaining({ messageType: 'receipt' }));
      const body = (await response.json()) as {
        handoff?: { status?: string; url?: string; expiresAt?: string };
      };
      expect(body.handoff?.status).toBe(outcome === 'success' ? 'ready' : 'fallback');
      if (outcome === 'success') {
        expect(body.handoff).toEqual({ status: 'ready', url: PORTAL_URL, expiresAt: EXPIRES_AT });
        expect(JSON.stringify(body)).not.toContain('case-1');
        expect(body).not.toHaveProperty('case_id');
        expect(body).not.toHaveProperty('submission_id');
        expect(body).not.toHaveProperty('tenant_id');
        expect(body).not.toHaveProperty('share_link');
        expect(body).not.toHaveProperty('session_cookie');
      }
      const insert = db.calls.find((call) => call.sql.includes('INSERT INTO submission_intake'));
      await expect(decryptText('storage-secret', String(insert?.bindings[9]))).resolves.toBe(
        'D1で検証済みの相談要約'
      );
      const [, init] = fetchMock.mock.calls[0];
      const payload = JSON.parse(String(init?.body)) as { inquiry?: { summary?: string } };
      expect(payload.inquiry?.summary).toBe('D1で検証済みの相談要約');
    }
  );

  it('既存submissionの再送は同じsubmission IDでGriftを冪等呼出しする', async () => {
    const db = await createDb();
    const queueSend = vi.fn(async () => undefined);
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
      async (_url, init) => successResponseForRequest(init, { duplicate: true })
    );
    vi.stubGlobal('fetch', fetchMock);
    const requestBody = {
      sessionId: 'session-1',
      idempotencyKey: 'duplicate-client-key',
      name: INQUIRY.name,
      email: INQUIRY.email,
      message: INQUIRY.message,
      ...confirmedHandoffFields(),
    };
    const env = submitEnv(db, queueSend);
    const firstResponse = await worker.fetch(post(requestBody, '198.51.100.33'), env);
    const response = await worker.fetch(post(requestBody, '198.51.100.35'), env);

    expect(firstResponse.status).toBe(200);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { duplicate?: boolean; handoff?: { status?: string } };
    expect(body.duplicate).toBe(true);
    expect(body.handoff?.status).toBe('ready');
    const [, init] = fetchMock.mock.calls[1];
    if (!init) throw new Error('Grift request init missing');
    expect((init.headers as Record<string, string>)['idempotency-key']).toBe(
      (fetchMock.mock.calls[0][1]?.headers as Record<string, string>)['idempotency-key']
    );
  });

  it('確認済みsummaryがD1と異なれば409にして保存・Queue・handoffを行わない', async () => {
    const db = await createDb();
    const queueSend = vi.fn(async () => undefined);
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
      async (_url, init) => successResponseForRequest(init)
    );
    vi.stubGlobal('fetch', fetchMock);
    const env = submitEnv(db, queueSend);
    const base = {
      sessionId: 'session-1',
      idempotencyKey: 'summary-conflict-key',
      name: INQUIRY.name,
      email: INQUIRY.email,
      message: INQUIRY.message,
      ...confirmedHandoffFields(),
    };
    const response = await worker.fetch(
      post(
        {
          ...base,
          summaryText: {
            ...(base.summaryText as Record<string, unknown>),
            text: '編集後の別要約',
          },
        },
        '198.51.100.37'
      ),
      env
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'CONTACT_SESSION_SUMMARY_MISMATCH',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(queueSend).not.toHaveBeenCalled();
    expect(db.calls.some((call) => call.sql.includes('INSERT INTO submission_intake'))).toBe(false);
  });

  it.each([undefined, false])(
    'summaryConfirmed=%sかつmissing D1 sessionではbrowser要約を破棄しメールQueueだけ維持する',
    async (summaryConfirmed) => {
      const db = await createDb({ active: false });
      const queueSend = vi.fn(async () => undefined);
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      const fields = confirmedHandoffFields();
      const response = await worker.fetch(
        post(
          {
            sessionId: 'session-1',
            idempotencyKey: `unconfirmed-${String(summaryConfirmed)}`,
            name: INQUIRY.name,
            email: INQUIRY.email,
            message: INQUIRY.message,
            ...fields,
            handoffConsent:
              summaryConfirmed === undefined
                ? {
                    accepted: fields.handoffConsent.accepted,
                    version: fields.handoffConsent.version,
                    acceptedAt: fields.handoffConsent.acceptedAt,
                  }
                : { ...fields.handoffConsent, summaryConfirmed },
          },
          summaryConfirmed === undefined ? '198.51.100.38' : '198.51.100.39'
        ),
        submitEnv(db, queueSend)
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as { handoff?: unknown };
      expect(body.handoff).toBeUndefined();
      expect(queueSend).toHaveBeenCalledTimes(2);
      expect(fetchMock).not.toHaveBeenCalled();
      const insert = db.calls.find((call) => call.sql.includes('INSERT INTO submission_intake'));
      await expect(decryptText('storage-secret', String(insert?.bindings[9]))).resolves.toBe(
        '相談目的: contract-dev'
      );
      expect(String(insert?.bindings[3])).toBe('null');
      const audit = db.calls.find((call) => call.sql.includes('INSERT INTO audit_events'));
      expect(JSON.parse(String(audit?.bindings[3]))).toEqual({});
    }
  );

  it.each([
    undefined,
    'legacy summary string',
    { version: 1, locale: 'ja', intent: 'contract-dev', classification: 'genuine', text: '' },
    {
      version: 1,
      locale: 'ja',
      intent: 'contract-dev',
      classification: 'genuine',
      summaryText: 'alias only',
    },
    {
      version: 1,
      locale: 'ja',
      intent: 'contract-dev',
      classification: 'genuine',
      text: 'user@example.comへ連絡',
    },
    {
      version: 1,
      locale: 'ja',
      intent: 'contract-dev',
      classification: 'genuine',
      text: 'token: sk-abcdefghijklmnop',
    },
  ])('確認同意があってもsummaryText.text厳格契約外なら400: %j', async (summaryText) => {
    const db = await createDb();
    const queueSend = vi.fn(async () => undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const fields = confirmedHandoffFields();
    const response = await worker.fetch(
      post(
        {
          sessionId: 'session-1',
          idempotencyKey: `invalid-summary-${typeof summaryText}`,
          name: INQUIRY.name,
          email: INQUIRY.email,
          message: INQUIRY.message,
          intent: fields.intent,
          summaryText,
          handoffConsent: fields.handoffConsent,
        },
        '198.51.100.40'
      ),
      submitEnv(db, queueSend)
    );
    expect(response.status).toBe(400);
    expect(queueSend).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    {
      condition: 'missing',
      intent: 'contract-dev',
      sessionId: undefined,
      db: {},
      ip: '198.51.100.60',
    },
    {
      condition: 'expired',
      intent: 'contract-dev',
      sessionId: 'session-1',
      db: { active: false },
      ip: '198.51.100.64',
    },
    {
      condition: 'mismatched',
      intent: 'contract-dev',
      sessionId: 'session-1',
      db: { restoredSessionId: 'session-other' },
      ip: '198.51.100.65',
    },
    {
      condition: 'read-error',
      intent: 'contract-dev',
      sessionId: 'session-1',
      db: { restoreError: true },
      ip: '198.51.100.66',
    },
    {
      condition: 'missing',
      intent: 'press-speaking-other',
      sessionId: undefined,
      db: {},
      ip: '198.51.100.67',
    },
    {
      condition: 'expired',
      intent: 'press-speaking-other',
      sessionId: 'session-1',
      db: { active: false },
      ip: '198.51.100.68',
    },
    {
      condition: 'mismatched',
      intent: 'press-speaking-other',
      sessionId: 'session-1',
      db: { restoredSessionId: 'session-other' },
      ip: '198.51.100.69',
    },
    {
      condition: 'read-error',
      intent: 'press-speaking-other',
      sessionId: 'session-1',
      db: { restoreError: true },
      ip: '198.51.100.76',
    },
  ] as const)(
    '$condition D1 session / intent=$intent は決定的fallbackだけを暗号化・通知し同意とtranscriptを破棄する',
    async ({ condition, intent, sessionId, db: dbOptions, ip }) => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const db = await createDb(dbOptions);
      const queueSend = vi.fn(async () => undefined);
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      const browserSummary = `browser confirmed summary (${condition}/${intent})`;
      const response = await worker.fetch(
        post(
          {
            sessionId,
            idempotencyKey: `${condition}-${intent}-session`,
            name: INQUIRY.name,
            email: INQUIRY.email,
            company: INQUIRY.company,
            message: INQUIRY.message,
            ...confirmedHandoffFields(intent),
            classification: 'genuine',
            structuredLead: { purpose: '受託開発相談', stage: '要件整理中' },
            conversationExcerpt: '訪問者: browser raw transcript must never persist',
            summaryText: {
              ...confirmedHandoffFields(intent).summaryText,
              text: browserSummary,
            },
          },
          ip
        ),
        submitEnv(db, queueSend)
      );

      expect(response.status).toBe(200);
      const responseBody = (await response.json()) as { handoff?: { status?: string } };
      if (intent === 'contract-dev') expect(responseBody.handoff).toEqual({ status: 'fallback' });
      else expect(responseBody.handoff).toBeUndefined();
      expect(queueSend).toHaveBeenCalledTimes(2);
      expect(fetchMock).not.toHaveBeenCalled();

      const fallbackSummary = `相談目的: ${intent} / 分類: genuine / 目的: 受託開発相談 / 進捗段階: 要件整理中`;
      const insert = db.calls.find((call) => call.sql.includes('INSERT INTO submission_intake'));
      expect(insert).toBeDefined();
      await expect(decryptText('storage-secret', String(insert?.bindings[9]))).resolves.toBe(
        fallbackSummary
      );
      await expect(decryptText('storage-secret', String(insert?.bindings[10]))).resolves.toBe('');
      expect(String(insert?.bindings[3])).toBe('null');
      const audit = db.calls.find((call) => call.sql.includes('INSERT INTO audit_events'));
      expect(JSON.parse(String(audit?.bindings[3]))).toEqual({});

      const readbackEnv = { DB: db, PII_ENCRYPTION_KEY: 'storage-secret' } as unknown as Env;
      const internal = await getSubmissionForNotification(
        readbackEnv,
        String(insert?.bindings[0]),
        'internal'
      );
      const receipt = await getSubmissionForNotification(
        readbackEnv,
        String(insert?.bindings[0]),
        'receipt'
      );
      expect(internal?.inquiry.conversationSummary).toBe(fallbackSummary);
      expect(internal?.inquiry.summaryConfirmed).toBeUndefined();
      expect(internal?.inquiry.conversationExcerpt).toBeUndefined();
      expect(receipt?.inquiry.conversationSummary).toBe(fallbackSummary);
      expect(receipt?.inquiry.summaryConfirmed).toBeUndefined();
      const notificationText = `${buildBody(internal!.inquiry)}\n${buildReceiptBody(
        receipt!.inquiry,
        receipt!.receiptId
      )}`;
      expect(notificationText).toContain(fallbackSummary);
      expect(notificationText).not.toContain(browserSummary);
      expect(notificationText).not.toContain('browser raw transcript');
      expect(JSON.stringify(db.calls)).not.toContain('browser raw transcript');
      if (condition === 'read-error') {
        expect(JSON.stringify(log.mock.calls)).not.toContain('synthetic D1 read failure');
      }
    }
  );

  it('invalid D1 sessionのbrowser要約だけを変えた再送は同一fallbackへ収束し重複行を作らない', async () => {
    const db = await createDb({ active: false });
    const queueSend = vi.fn(async () => undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const base = {
      sessionId: 'session-1',
      idempotencyKey: 'invalid-session-deterministic-replay',
      name: INQUIRY.name,
      email: INQUIRY.email,
      message: INQUIRY.message,
      ...confirmedHandoffFields(),
      classification: 'genuine',
      structuredLead: { purpose: '受託開発相談' },
    };
    const first = await worker.fetch(
      post(
        {
          ...base,
          summaryText: { ...base.summaryText, text: 'browser summary A' },
        },
        '198.51.100.77'
      ),
      submitEnv(db, queueSend)
    );
    const replay = await worker.fetch(
      post(
        {
          ...base,
          summaryText: { ...base.summaryText, text: 'browser summary B' },
        },
        '198.51.100.78'
      ),
      submitEnv(db, queueSend)
    );

    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    await expect(replay.json()).resolves.toMatchObject({
      duplicate: true,
      handoff: { status: 'fallback' },
    });
    expect(
      db.calls.filter((call) => call.sql.includes('INSERT INTO submission_intake'))
    ).toHaveLength(1);
    expect(queueSend).toHaveBeenCalledTimes(4);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('D1 restore error時もsession読取→暗号化batch→両Queueの順でfallbackしGriftへ進まない', async () => {
    const events: string[] = [];
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const db = await createDb({ restoreError: true, events });
    const queueSend = vi.fn(async (message: unknown) => {
      events.push(`queue-${String((message as { messageType?: string }).messageType)}`);
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await worker.fetch(
      post(
        {
          sessionId: 'session-1',
          idempotencyKey: 'restore-error-order',
          name: INQUIRY.name,
          email: INQUIRY.email,
          message: INQUIRY.message,
          ...confirmedHandoffFields(),
        },
        '198.51.100.79'
      ),
      submitEnv(db, queueSend)
    );

    expect(response.status).toBe(200);
    expect(events[0]).toBe('session-read');
    expect(events.indexOf('storage-batch')).toBeGreaterThan(events.indexOf('session-read'));
    expect(events.indexOf('queue-internal')).toBeGreaterThan(events.indexOf('storage-batch'));
    expect(events.indexOf('queue-receipt')).toBeGreaterThan(events.indexOf('storage-batch'));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain('synthetic D1 read failure');
  });

  it('sessionが復元後のstorage再確認でID不一致なら同意を破棄して決定的fallbackを保存する', async () => {
    const db = await createDb({ excerptSessionId: 'session-other' });
    const queueSend = vi.fn(async () => undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await worker.fetch(
      post(
        {
          sessionId: 'session-1',
          idempotencyKey: 'storage-race-session-mismatch',
          name: INQUIRY.name,
          email: INQUIRY.email,
          message: INQUIRY.message,
          ...confirmedHandoffFields(),
          classification: 'genuine',
          structuredLead: { purpose: '受託開発相談' },
        },
        '198.51.100.80'
      ),
      submitEnv(db, queueSend)
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ handoff: { status: 'fallback' } });
    const insert = db.calls.filter((call) => call.sql.includes('INSERT INTO submission_intake')).at(-1);
    await expect(decryptText('storage-secret', String(insert?.bindings[9]))).resolves.toBe(
      '相談目的: contract-dev / 分類: genuine / 目的: 受発注の効率化 / 業種・役割: 製造業の情報システム担当 / データ感度: 社外秘 / 進捗段階: 要件整理中 / 時期・予算: 3か月以内 / 流入経路: 検索 / 連絡理由: 開発相談'
    );
    expect(String(insert?.bindings[3])).toBe('null');
    const audit = db.calls.filter((call) => call.sql.includes('INSERT INTO audit_events')).at(-1);
    expect(JSON.parse(String(audit?.bindings[3]))).toEqual({});
    expect(queueSend).toHaveBeenCalledTimes(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('session復元後に同じIDの内容が並行更新されたら正本snapshotを保存せずfallbackしてGriftを呼ばない', async () => {
    const db = await createDb({ concurrentSessionUpdate: true });
    const queueSend = vi.fn(async () => undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await worker.fetch(
      post(
        {
          sessionId: 'session-1',
          idempotencyKey: 'storage-race-session-content-update',
          name: INQUIRY.name,
          email: INQUIRY.email,
          message: INQUIRY.message,
          ...confirmedHandoffFields(),
          classification: 'genuine',
          structuredLead: { purpose: '受託開発相談' },
        },
        '198.51.100.82'
      ),
      submitEnv(db, queueSend)
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ handoff: { status: 'fallback' } });
    const insert = db.calls.filter((call) => call.sql.includes('INSERT INTO submission_intake')).at(-1);
    await expect(decryptText('storage-secret', String(insert?.bindings[9]))).resolves.toBe(
      '相談目的: contract-dev / 分類: genuine / 目的: 受発注の効率化 / 業種・役割: 製造業の情報システム担当 / データ感度: 社外秘 / 進捗段階: 要件整理中 / 時期・予算: 3か月以内 / 流入経路: 検索 / 連絡理由: 開発相談'
    );
    await expect(decryptText('storage-secret', String(insert?.bindings[10]))).resolves.toBe('');
    expect(String(insert?.bindings[3])).toBe('null');
    const audit = db.calls.filter((call) => call.sql.includes('INSERT INTO audit_events')).at(-1);
    expect(JSON.parse(String(audit?.bindings[3]))).toEqual({});
    expect(queueSend).toHaveBeenCalledTimes(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('session復元後のstorage再読取例外でも受付を失わず同意なしfallbackをQueueする', async () => {
    const db = await createDb({ excerptReadError: true });
    const queueSend = vi.fn(async () => undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await worker.fetch(
      post(
        {
          sessionId: 'session-1',
          idempotencyKey: 'storage-race-session-read-error',
          name: INQUIRY.name,
          email: INQUIRY.email,
          message: INQUIRY.message,
          ...confirmedHandoffFields(),
        },
        '198.51.100.81'
      ),
      submitEnv(db, queueSend)
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ handoff: { status: 'fallback' } });
    const insert = db.calls.filter((call) => call.sql.includes('INSERT INTO submission_intake')).at(-1);
    await expect(decryptText('storage-secret', String(insert?.bindings[9]))).resolves.toBe(
      '相談目的: contract-dev / 分類: genuine / 目的: 受発注の効率化 / 業種・役割: 製造業の情報システム担当 / データ感度: 社外秘 / 進捗段階: 要件整理中 / 時期・予算: 3か月以内 / 流入経路: 検索 / 連絡理由: 開発相談'
    );
    expect(String(insert?.bindings[3])).toBe('null');
    const audit = db.calls.filter((call) => call.sql.includes('INSERT INTO audit_events')).at(-1);
    expect(JSON.parse(String(audit?.bindings[3]))).toEqual({});
    expect(queueSend).toHaveBeenCalledTimes(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('internal→receiptのQueue登録を開始し、両方完了するまでGriftを呼ばない', async () => {
    const db = await createDb();
    const resolvers: Array<() => void> = [];
    const queueSend = vi.fn(
      (_message: unknown) => new Promise<void>((resolve) => resolvers.push(resolve))
    );
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
      async (_url, init) => successResponseForRequest(init)
    );
    vi.stubGlobal('fetch', fetchMock);
    const pending = worker.fetch(
      post(
        {
          sessionId: 'session-1',
          idempotencyKey: 'queue-barrier',
          name: INQUIRY.name,
          email: INQUIRY.email,
          message: INQUIRY.message,
          ...confirmedHandoffFields(),
        },
        '198.51.100.61'
      ),
      submitEnv(db, queueSend)
    );
    await vi.waitFor(() => expect(queueSend).toHaveBeenCalledTimes(2));
    expect(
      queueSend.mock.calls.map(([message]) => (message as { messageType?: string }).messageType)
    ).toEqual(['internal', 'receipt']);
    expect(fetchMock).not.toHaveBeenCalled();
    resolvers[1]();
    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();
    resolvers[0]();
    expect((await pending).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('Queue例外のmessageにPII/tokenがあってもログへ出さずGriftを呼ばない', async () => {
    const secretError = `${INQUIRY.email} ${ENV.CLOUDIA_HANDOFF_AUTH_TOKEN}`;
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const db = await createDb();
    const queueSend = vi.fn(async () => {
      throw new Error(secretError);
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await worker.fetch(
      post(
        {
          sessionId: 'session-1',
          idempotencyKey: 'queue-error-log',
          name: INQUIRY.name,
          email: INQUIRY.email,
          message: INQUIRY.message,
          ...confirmedHandoffFields(),
        },
        '198.51.100.62'
      ),
      submitEnv(db, queueSend)
    );
    expect(response.status).toBe(503);
    const output = JSON.stringify(log.mock.calls);
    expect(output).not.toContain(INQUIRY.email);
    expect(output).not.toContain(ENV.CLOUDIA_HANDOFF_AUTH_TOKEN);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Content-Lengthなし64KiB超request bodyをstreaming拒否する', async () => {
    const db = await createDb();
    const queueSend = vi.fn(async () => undefined);
    const request = post(
      {
        name: INQUIRY.name,
        email: INQUIRY.email,
        message: 'x'.repeat(70 * 1024),
      },
      '198.51.100.63'
    );
    expect(request.headers.get('content-length')).toBeNull();
    const response = await worker.fetch(request, submitEnv(db, queueSend));
    expect(response.status).toBe(400);
    expect(queueSend).not.toHaveBeenCalled();
  });

  it('honeypot spamはGriftも通知Queueも呼ばず従来どおり200を返す', async () => {
    const db = await createDb();
    const queueSend = vi.fn(async () => undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await worker.fetch(
      post(
        {
          sessionId: 'session-1',
          name: INQUIRY.name,
          email: INQUIRY.email,
          message: INQUIRY.message,
          website: 'https://spam.example',
          ...confirmedHandoffFields(),
        },
        '198.51.100.34'
      ),
      submitEnv(db, queueSend)
    );

    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(queueSend).not.toHaveBeenCalled();
  });
});
