import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../index';
import { CONTACT_LOG_EVENTS, logContactFailure, notificationFailureCode } from '../log';
import { resetRateLimits } from '../security';
import type { Env, NotificationMessage } from '../types';

afterEach(() => {
  resetRateLimits();
  vi.restoreAllMocks();
});

const LEAK = 'https://tenant.example/acme/cases/CASE-9 submission 11111111-1111-1111-1111-111111111111 sk-live-secret 山田太郎 yamada@example.com';

const ENV = {
  LLM_PROVIDER: 'vertex-gemini',
  ANTHROPIC_API_KEY: '',
  RESEND_API_KEY: 're_test',
  TURNSTILE_SECRET: '',
  CONTACT_TO_EMAIL: 'info@cor-jp.com',
  CONTACT_FROM_EMAIL: 'noreply@cor-jp.com',
  VERTEX_GATEWAY_URL: 'https://gateway.example/generateContent',
  VERTEX_GATEWAY_SECRET: 'secret',
  PII_ENCRYPTION_KEY: 'storage-secret',
  PII_HMAC_KEY: 'hmac-secret',
} as unknown as Env;

function posted(path: string, body: unknown, ip: string): Request {
  return new Request(`https://cor-jp.com${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://cor-jp.com',
      'cf-connecting-ip': ip,
    },
    body: JSON.stringify(body),
  });
}

function captureLogs(): { lines: () => string } {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  return {
    lines: () => spy.mock.calls.map((call) => call.map((part) => String(part)).join(' ')).join('\n'),
  };
}

function expectFixedLog(logged: string): void {
  expect(logged.length).toBeGreaterThan(0);
  for (const line of logged.split('\n')) {
    expect(line.startsWith('contact-chat:')).toBe(true);
    expect(CONTACT_LOG_EVENTS).toContain(line.slice('contact-chat:'.length));
  }
  expect(logged).not.toContain('tenant.example');
  expect(logged).not.toContain('CASE-9');
  expect(logged).not.toContain('11111111');
  expect(logged).not.toContain('sk-live');
  expect(logged).not.toContain('山田');
  expect(logged).not.toContain('yamada@example.com');
  expect(logged).not.toContain('http');
}

describe('ログは固定コードだけ', () => {
  it('notificationFailureCode は status 以外を捨てる', () => {
    expect(notificationFailureCode(new Error(`メール送信に失敗しました（status 502） ${LEAK}`))).toBe('provider_status_502');
    expect(notificationFailureCode(new Error(LEAK))).toBe('notification_failed');
    expect(notificationFailureCode('provider_status_404')).toBe('provider_status_404');
  });

  it('列挙以外は出さない', () => {
    const logs = captureLogs();
    logContactFailure('llm_failed');
    expect(logs.lines()).toBe('contact-chat:llm_failed');
  });

  it('LLM 失敗のログに本文を含めない', async () => {
    const logs = captureLogs();
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error(LEAK);
    }));
    const res = await worker.fetch(posted('/api/contact/chat', {
      messages: [{ role: 'user', content: '相談です' }],
    }, '198.51.100.41'), ENV);
    expect(res.status).toBe(503);
    expectFixedLog(logs.lines());
    expect(logs.lines()).toBe('contact-chat:llm_failed');
  });

  it('メール送信失敗のログに本文を含めない', async () => {
    const logs = captureLogs();
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error(LEAK);
    }));
    const res = await worker.fetch(posted('/api/contact/submit', {
      name: '太郎',
      email: 'taro@example.com',
      message: '相談です',
    }, '198.51.100.42'), ENV);
    expect(res.status).toBe(502);
    expectFixedLog(logs.lines());
    expect(logs.lines()).toBe('contact-chat:email_send_failed');
  });

  it('想定外の例外もコードだけ', async () => {
    const logs = captureLogs();
    const req = {
      method: 'POST',
      url: 'https://cor-jp.com/api/contact/chat',
      headers: {
        get: () => {
          throw new Error(LEAK);
        },
      },
    } as unknown as Request;
    const res = await worker.fetch(req, ENV);
    expect(res.status).toBe(500);
    expectFixedLog(logs.lines());
    expect(logs.lines()).toBe('contact-chat:unhandled');
  });

  it('保存失敗のログに D1 のメッセージを含めない', async () => {
    const logs = captureLogs();
    const db = {
      prepare() {
        return {
          bind() {
            return {
              run: async () => {
                throw new Error(LEAK);
              },
            };
          },
        };
      },
    };
    const res = await worker.fetch(posted('/api/contact/chat/start', {
      start: true,
      intent: 'contract-dev',
    }, '198.51.100.43'), { ...ENV, DB: db } as unknown as Env);
    expect(res.status).toBe(503);
    expectFixedLog(logs.lines());
    expect(logs.lines()).toBe('contact-chat:session_storage_failed');
  });

  it('キュー失敗のログと last_error に送信 ID や PII を出さない', async () => {
    const logs = captureLogs();
    let stored = '';
    const db = {
      prepare(sql: string) {
        return {
          bind(...bindings: unknown[]) {
            return {
              run: async () => {
                if (sql.includes('last_error')) {
                  stored = String(bindings[0]);
                  return { meta: { changes: 1 } };
                }
                throw new Error(`status 503 ${LEAK}`);
              },
              first: async () => null,
            };
          },
        };
      },
    };
    const message = {
      body: { submissionId: 'submission-1', messageType: 'internal' } as NotificationMessage,
      ack: vi.fn(),
      retry: vi.fn(),
    };
    await worker.queue({ messages: [message] } as unknown as MessageBatch<NotificationMessage>, {
      ...ENV,
      DB: db,
    } as unknown as Env);
    expect(message.retry).toHaveBeenCalled();
    expect(stored).toBe('provider_status_503');
    expectFixedLog(logs.lines());
    expect(logs.lines()).toBe('contact-chat:notification_failed');
  });

  it('保持期間の削除失敗もコードだけ', async () => {
    const logs = captureLogs();
    const db = {
      batch: async () => {
        throw new Error(LEAK);
      },
    };
    await worker.scheduled({} as ScheduledEvent, { ...ENV, DB: db } as unknown as Env);
    expectFixedLog(logs.lines());
    expect(logs.lines()).toBe('contact-chat:retention_cleanup_failed');
  });
});
