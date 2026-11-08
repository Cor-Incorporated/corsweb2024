import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../index';
import { buildDocumentRequestBody } from '../email';
import {
  DOCUMENT_DECK_URL,
  DOCUMENT_REQUEST_CONSENT_VERSION,
  DOCUMENT_REQUEST_ID,
  DOCUMENT_REQUEST_INDUSTRIES,
} from '../document-request';
import { DOCUMENT_REQUEST_COPY, type DocumentRequestCopy } from '../document-request-copy';
import { resetRateLimits } from '../security';
import { decryptText, purgeExpiredData, tokyoDayKey } from '../storage';
import type { Env, NotificationMessage } from '../types';

afterEach(() => {
  resetRateLimits();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const SECRET = 'storage-secret';
const HMAC = 'hmac-secret';

function openDatabase(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const migrationsDir = resolve(__dirname, '../../migrations');
  const files = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort();
  for (const file of files) db.exec(readFileSync(resolve(migrationsDir, file), 'utf8'));
  return db;
}

function asD1(db: DatabaseSync): D1Database {
  return {
    prepare(sql: string) {
      return {
        bind(...bindings: SQLInputValue[]) {
          return {
            sql,
            bindings,
            async first<T>() {
              const row = db.prepare(sql).get(...bindings) as T | undefined;
              return (row ?? null) as T;
            },
            async run() {
              const result = db.prepare(sql).run(...bindings);
              return { meta: { changes: Number(result.changes) } };
            },
          };
        },
      };
    },
    async batch(statements: Array<{ sql: string; bindings: SQLInputValue[] }>) {
      db.exec('BEGIN');
      try {
        for (const statement of statements) {
          db.prepare(statement.sql).run(...statement.bindings);
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      return [];
    },
  } as unknown as D1Database;
}

function envFor(db: DatabaseSync, extra: Record<string, unknown> = {}): { env: Env; sent: NotificationMessage[] } {
  const sent: NotificationMessage[] = [];
  const env = {
    LLM_PROVIDER: 'vertex-gemini',
    ANTHROPIC_API_KEY: '',
    RESEND_API_KEY: '',
    TURNSTILE_SECRET: '',
    CONTACT_TO_EMAIL: 'info@cor-jp.com',
    CONTACT_FROM_EMAIL: 'noreply@cor-jp.com',
    PII_ENCRYPTION_KEY: SECRET,
    PII_HMAC_KEY: HMAC,
    DB: asD1(db),
    CONTACT_NOTIFICATIONS: {
      send: async (message: NotificationMessage) => {
        sent.push(message);
      },
    },
    ...extra,
  } as unknown as Env;
  return { env, sent };
}

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://cor-jp.com/api/contact/document-request', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://cor-jp.com',
      'cf-connecting-ip': '198.51.100.40',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const valid = {
  name: '山田太郎',
  email: 'taro@example.com',
  company: '例株式会社',
  industry: 'medical',
  consent: true,
  website: '',
  locale: 'ja',
};

describe('document request intake', () => {
  it('東京の日付で重複の窓を切る', () => {
    expect(tokyoDayKey(new Date('2026-11-08T14:59:00Z'))).toBe('2026-11-08');
    expect(tokyoDayKey(new Date('2026-11-08T15:00:00Z'))).toBe('2026-11-09');
  });

  it('保存し、キューには ID だけを載せ、平文の連絡先は残さない', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const db = openDatabase();
    const { env, sent } = envFor(db);
    const res = await worker.fetch(post(valid), env);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toMatchObject({ ok: true, status: 'stored', notification: 'queued', duplicate: false, delivered: false });
    expect(body.receiptId).toMatch(/^COR-/);
    expect(JSON.stringify(body)).not.toContain('taro@example.com');
    expect(JSON.stringify(body)).not.toContain('山田');
    expect(sent).toEqual([{ submissionId: expect.any(String), messageType: 'internal' }]);
    expect(JSON.stringify(sent)).not.toContain('@');
    expect(fetchSpy).not.toHaveBeenCalled();

    const row = db.prepare('SELECT name_ciphertext, email_ciphertext, message_ciphertext, status, request_kind, industry, document_id, consent_version FROM submission_intake').get() as {
      name_ciphertext: string;
      email_ciphertext: string;
      message_ciphertext: string;
      status: string;
      request_kind: string;
      industry: string;
      document_id: string;
      consent_version: string;
    };
    expect(row.status).toBe('stored');
    expect(row.request_kind).toBe('document');
    expect(row.industry).toBe('medical');
    expect(row.document_id).toBe(DOCUMENT_REQUEST_ID);
    expect(row.consent_version).toBe(DOCUMENT_REQUEST_CONSENT_VERSION);
    expect(row.name_ciphertext).not.toContain('山田');
    expect(row.email_ciphertext).not.toContain('taro@example.com');
    await expect(decryptText(SECRET, row.name_ciphertext)).resolves.toBe('山田太郎');
    await expect(decryptText(SECRET, row.email_ciphertext)).resolves.toBe('taro@example.com');
    await expect(decryptText(SECRET, row.message_ciphertext)).resolves.toBe(DOCUMENT_REQUEST_ID);
    const types = db.prepare('SELECT message_type FROM notification_outbox').all() as Array<{ message_type: string }>;
    expect(types.map((item) => item.message_type)).toEqual(['internal']);
    const audit = db.prepare('SELECT metadata_json FROM audit_events').get() as { metadata_json: string };
    expect(audit.metadata_json).not.toContain('taro@example.com');
    expect(audit.metadata_json).not.toContain('山田');
  });

  it('同じ日の同じメールは同じ受付番号を返し、行は増えない', async () => {
    const db = openDatabase();
    const { env } = envFor(db);
    const first = await worker.fetch(post(valid, { 'cf-connecting-ip': '198.51.100.41' }), env);
    const second = await worker.fetch(post({ ...valid, company: '別の会社' }, { 'cf-connecting-ip': '198.51.100.41' }), env);
    expect(first.status).toBe(200);
    expect(second.status).toBe(202);
    const a = await first.json() as { receiptId: string; duplicate: boolean; delivered: boolean };
    const b = await second.json() as { receiptId: string; duplicate: boolean; status: string };
    expect(b.receiptId).toBe(a.receiptId);
    expect(a.duplicate).toBe(false);
    expect(b.duplicate).toBe(true);
    expect(b.status).toBe('stored');
    expect(a.delivered).toBe(false);
    const count = db.prepare('SELECT COUNT(*) AS n FROM submission_intake').get() as { n: number };
    expect(count.n).toBe(1);
  });

  it('キュー登録に失敗しても記録は残り、送付済みにも受付失敗にもしない', async () => {
    const errors: unknown[] = [];
    vi.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args.join(' '));
    });
    const db = openDatabase();
    const { env } = envFor(db, {
      CONTACT_NOTIFICATIONS: {
        send: async () => {
          throw new Error('queue down taro@example.com 山田太郎');
        },
      },
    });
    const res = await worker.fetch(post(valid, { 'cf-connecting-ip': '198.51.100.42' }), env);
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string; notification: string; delivered: boolean; receiptId: string };
    expect(body.status).toBe('stored');
    expect(body.notification).toBe('pending');
    expect(body.delivered).toBe(false);
    expect(body.receiptId).toMatch(/^COR-/);
    const row = db.prepare('SELECT status FROM submission_intake').get() as { status: string };
    expect(row.status).toBe('stored');
    expect(errors.join('\n')).toContain('notification_enqueue_failed');
    expect(errors.join('\n')).not.toContain('taro@example.com');
    expect(errors.join('\n')).not.toContain('山田');
  });

  it('未設定の通知モードでは Resend を呼ばず、記録は stored のまま', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const db = openDatabase();
    const { env, sent } = envFor(db);
    const res = await worker.fetch(post(valid, { 'cf-connecting-ip': '198.51.100.43' }), env);
    expect(res.status).toBe(200);
    const message = sent[0];
    expect(message).toBeDefined();
    let retried = false;
    await worker.queue({
      messages: [{
        body: message,
        ack() {},
        retry() {
          retried = true;
        },
      }],
    } as unknown as MessageBatch<NotificationMessage>, env);
    expect(retried).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    const submission = db.prepare('SELECT status FROM submission_intake').get() as { status: string };
    const outbox = db.prepare('SELECT status, delivery_status, last_error FROM notification_outbox').get() as {
      status: string;
      delivery_status: string;
      last_error: string;
    };
    expect(submission.status).toBe('stored');
    expect(outbox.delivery_status).toBe('held');
    expect(outbox.last_error).toBe('notify_not_released');
    expect(outbox.last_error).not.toContain('@');
  });

  it('mock 通知は本文に送付済みを書かず、HTTP をしない', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const db = openDatabase();
    const { env, sent } = envFor(db, { DOCUMENT_REQUEST_NOTIFY_MODE: 'mock' });
    await worker.fetch(post(valid, { 'cf-connecting-ip': '198.51.100.44' }), env);
    await worker.queue({
      messages: [{ body: sent[0], ack() {}, retry() { throw new Error('should not retry'); } }],
    } as unknown as MessageBatch<NotificationMessage>, env);
    expect(fetchSpy).not.toHaveBeenCalled();
    const submission = db.prepare('SELECT status FROM submission_intake').get() as { status: string };
    const outbox = db.prepare('SELECT provider_message_id, status FROM notification_outbox').get() as {
      provider_message_id: string;
      status: string;
    };
    expect(submission.status).toBe('stored');
    expect(outbox.status).toBe('sent');
    expect(outbox.provider_message_id).toBe('mock');
    const text = buildDocumentRequestBody({
      name: '山田太郎',
      email: 'taro@example.com',
      company: '例株式会社',
      industry: 'medical',
      documentId: DOCUMENT_REQUEST_ID,
      consentVersion: DOCUMENT_REQUEST_CONSENT_VERSION,
      receiptId: 'COR-20261108-ABCD1234',
    });
    expect(text).toContain('資料は送っていません');
    expect(text).not.toContain('送付しました');
    expect(text).not.toContain('お送りしました');
  });

  it('live の送信失敗でも行は残り、受付 status は stored のまま', async () => {
    const fetchSpy = vi.fn(async () => new Response('nope', { status: 502 }));
    vi.stubGlobal('fetch', fetchSpy);
    const db = openDatabase();
    const { env, sent } = envFor(db, {
      DOCUMENT_REQUEST_NOTIFY_MODE: 'live',
      RESEND_API_KEY: 're_test',
    });
    await worker.fetch(post(valid, { 'cf-connecting-ip': '198.51.100.45' }), env);
    let retried = false;
    await worker.queue({
      messages: [{
        body: sent[0],
        ack() {},
        retry() {
          retried = true;
        },
      }],
    } as unknown as MessageBatch<NotificationMessage>, env);
    expect(retried).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String((fetchSpy.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(payload.text).toContain('資料は送っていません');
    expect(payload.text).not.toContain('送付しました');
    expect(payload.to).toBe('info@cor-jp.com');
    const submission = db.prepare('SELECT status FROM submission_intake').get() as { status: string };
    expect(submission.status).toBe('stored');
  });

  it.each([
    [{ ...valid, name: ' ' }, 'name'],
    [{ ...valid, email: 'not-an-email' }, 'email'],
    [{ ...valid, consent: false }, 'consent'],
    [{ ...valid, industry: 'finance' }, 'industry'],
  ])('無効な入力 %j は 400 %s で保存しない', async (body, code) => {
    const db = openDatabase();
    const { env, sent } = envFor(db);
    const res = await worker.fetch(post(body, { 'cf-connecting-ip': '198.51.100.46' }), env);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: code });
    const count = db.prepare('SELECT COUNT(*) AS n FROM submission_intake').get() as { n: number };
    expect(count.n).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it('ハニーポットは保存せず、記録したとも送ったとも書かない', async () => {
    const db = openDatabase();
    const { env } = envFor(db);
    const res = await worker.fetch(post({ ...valid, website: 'https://spam.example' }, { 'cf-connecting-ip': '198.51.100.47' }), env);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.receiptId).toBeUndefined();
    expect(body.status).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('stored');
    const count = db.prepare('SELECT COUNT(*) AS n FROM submission_intake').get() as { n: number };
    expect(count.n).toBe(0);
  });

  it('JavaScript の無いフォーム送信は HTML で受付番号を返し、メールアドレスはエコーしない', async () => {
    const db = openDatabase();
    const { env } = envFor(db);
    const res = await worker.fetch(new Request('https://cor-jp.com/api/contact/document-request', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        origin: 'https://cor-jp.com',
        'cf-connecting-ip': '198.51.100.48',
      },
      body: new URLSearchParams({
        name: '山田太郎',
        email: 'taro@example.com',
        company: '',
        industry: '',
        consent: 'yes',
        locale: 'ja',
      }),
    }), env);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('資料は送っていません');
    expect(html).toContain('COR-');
    expect(html).not.toContain('taro@example.com');
    expect(html).not.toContain('送付しました');
    const row = db.prepare('SELECT industry FROM submission_intake').get() as { industry: string };
    expect(row.industry).toBe('');
  });

  it('期限が切れた資料請求は問い合わせと同じ purge で消える', async () => {
    const db = openDatabase();
    const { env } = envFor(db);
    await worker.fetch(post(valid, { 'cf-connecting-ip': '198.51.100.49' }), env);
    db.prepare('UPDATE submission_intake SET expires_at = ?').run(1);
    await purgeExpiredData(env);
    const count = db.prepare('SELECT COUNT(*) AS n FROM submission_intake').get() as { n: number };
    expect(count.n).toBe(0);
  });

  it('画面の文・業種・資料 URL がサイト側と一致する', () => {
    const root = resolve(__dirname, '../../../..');
    const config = readFileSync(resolve(root, 'src/config/document-request.ts'), 'utf8');
    const industries = [...config.match(/export const DOCUMENT_REQUEST_INDUSTRIES = \[([\s\S]*?)\] as const/)![1].matchAll(/'([^']+)'/g)].map((item) => item[1]);
    expect(industries).toEqual([...DOCUMENT_REQUEST_INDUSTRIES]);
    expect(config).toContain(`'${DOCUMENT_REQUEST_CONSENT_VERSION}'`);
    expect(config).toContain(`'${DOCUMENT_REQUEST_ID}'`);
    const site = readFileSync(resolve(root, 'src/config/site.ts'), 'utf8');
    expect(site).toContain(`'${DOCUMENT_DECK_URL}'`);
    for (const locale of ['ja', 'en', 'zh', 'ko', 'es'] as const) {
      const json = JSON.parse(readFileSync(resolve(root, `src/i18n/locales/${locale}.json`), 'utf8')) as {
        documentRequest: DocumentRequestCopy;
      };
      expect(json.documentRequest.success).toBe(DOCUMENT_REQUEST_COPY[locale].success);
      expect(json.documentRequest.duplicate).toBe(DOCUMENT_REQUEST_COPY[locale].duplicate);
      expect(json.documentRequest.notifyPending).toBe(DOCUMENT_REQUEST_COPY[locale].notifyPending);
      expect(json.documentRequest.errorConsent).toBe(DOCUMENT_REQUEST_COPY[locale].errorConsent);
      expect(json.documentRequest.deckNote).toBe(DOCUMENT_REQUEST_COPY[locale].deckNote);
      expect(json.documentRequest.success).not.toMatch(/送付しました|already sent|已寄出|보냈습니다|ya se envió/i);
    }
  });
});
