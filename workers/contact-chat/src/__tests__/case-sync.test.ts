import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../index';
import {
  retryStoredDocumentRequest,
  syncSourceDigest,
  syncStoredDocumentRequest,
} from '../case-sync';
import { createDocumentRequest, readDocumentRequestSyncSource } from '../storage';
import { resetRateLimits } from '../security';
import type { DocumentRequestCaseSyncBinding, DocumentRequestSyncSource, Env } from '../types';

afterEach(() => {
  resetRateLimits();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function openDatabase(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const dir = resolve(__dirname, '../../migrations');
  for (const file of readdirSync(dir).filter((name) => name.endsWith('.sql')).sort()) {
    db.exec(readFileSync(resolve(dir, file), 'utf8'));
  }
  return db;
}

function asD1(db: DatabaseSync, sqlLog: string[]): D1Database {
  return {
    prepare(sql: string) {
      sqlLog.push(sql);
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
        for (const statement of statements) db.prepare(statement.sql).run(...statement.bindings);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      return [];
    },
  } as unknown as D1Database;
}

function baseEnv(db: DatabaseSync, sqlLog: string[] = []): Env {
  return {
    LLM_PROVIDER: 'vertex-gemini',
    ANTHROPIC_API_KEY: '',
    RESEND_API_KEY: '',
    TURNSTILE_SECRET: '',
    CONTACT_TO_EMAIL: 'info@cor-jp.com',
    CONTACT_FROM_EMAIL: 'noreply@cor-jp.com',
    PII_ENCRYPTION_KEY: 'storage-secret',
    PII_HMAC_KEY: 'hmac-secret',
    DB: asD1(db, sqlLog),
  } as unknown as Env;
}

const record = {
  name: '山田太郎',
  email: 'taro@example.com',
  company: '例株式会社',
  industry: 'medical',
  documentId: 'company-deck',
  consentVersion: 'document-request-1',
};

describe('document request case sync', () => {
  it('create の戻りは ID だけで、同期元は保存行から PII を復号せず読む', async () => {
    const sqlLog: string[] = [];
    const db = openDatabase();
    const env = baseEnv(db, sqlLog);
    const created = await createDocumentRequest(env, record, new Date('2026-11-08T01:00:00Z'));
    expect(Object.keys(created).sort()).toEqual(['duplicate', 'receiptId', 'submissionId']);
    sqlLog.length = 0;
    const source = await readDocumentRequestSyncSource(env, created.receiptId);
    expect(source).toMatchObject({
      receiptId: created.receiptId,
      documentId: 'company-deck',
      industry: 'medical',
      consentVersion: 'document-request-1',
      intakeStatus: 'stored',
      recordedAt: '2026-11-08T01:00:00.000Z',
    });
    expect(JSON.stringify(source)).not.toContain('taro@example.com');
    expect(JSON.stringify(source)).not.toContain('山田');
    expect(sqlLog.some((sql) => sql.includes('ciphertext') || sql.includes('email_hmac'))).toBe(false);
  });

  it('未選択の業種は null。再送で業種を変えても初回の行のまま', async () => {
    const db = openDatabase();
    const env = baseEnv(db);
    const first = await createDocumentRequest(env, { ...record, industry: '' }, new Date('2026-11-08T02:00:00Z'));
    const again = await createDocumentRequest(
      env,
      { ...record, industry: 'education', email: 'Taro@Example.COM' },
      new Date('2026-11-08T03:00:00Z'),
    );
    expect(again.duplicate).toBe(true);
    expect(again.receiptId).toBe(first.receiptId);
    const source = await readDocumentRequestSyncSource(env, first.receiptId);
    expect(source?.industry).toBeNull();
    expect(source?.recordedAt).toBe('2026-11-08T02:00:00.000Z');
  });

  it('日付をまたぐと別の受付になり、それぞれの初回時刻を読む', async () => {
    const db = openDatabase();
    const env = baseEnv(db);
    const day = await createDocumentRequest(env, record, new Date('2026-11-08T14:00:00Z'));
    const next = await createDocumentRequest(env, record, new Date('2026-11-08T16:00:00Z'));
    expect(next.receiptId).not.toBe(day.receiptId);
    const first = await readDocumentRequestSyncSource(env, day.receiptId);
    const second = await readDocumentRequestSyncSource(env, next.receiptId);
    expect(first?.recordedAt).toBe('2026-11-08T14:00:00.000Z');
    expect(second?.recordedAt).toBe('2026-11-08T16:00:00.000Z');
  });

  it('binding と資格があっても mock 以外は呼ばない', async () => {
    const db = openDatabase();
    const binding: DocumentRequestCaseSyncBinding = {
      acceptStored: vi.fn(async () => {
        throw new Error('must not call taro@example.com');
      }),
      retry: vi.fn(async () => {
        throw new Error('must not retry');
      }),
    };
    const env = {
      ...baseEnv(db),
      DOCUMENT_REQUEST_CASE_SYNC_MODE: 'live',
      DOCUMENT_REQUEST_SYNC_PRINCIPAL_ID: 'case-sync-principal',
      DOCUMENT_REQUEST_SYNC_TOKEN: 'case-sync-token',
      DOCUMENT_REQUEST_CASE_SYNC: binding,
    } as Env;
    const created = await createDocumentRequest(env, record);
    await syncStoredDocumentRequest(env, created.receiptId);
    expect(binding.acceptStored).not.toHaveBeenCalled();
    expect(binding.retry).not.toHaveBeenCalled();
    const row = db.prepare('SELECT status, case_sync_status FROM submission_intake').get() as {
      status: string;
      case_sync_status: string;
    };
    expect(row.status).toBe('stored');
    expect(row.case_sync_status).toBe('');
  });

  it('PII 鍵の流用では同期しない', async () => {
    const db = openDatabase();
    const binding: DocumentRequestCaseSyncBinding = {
      acceptStored: vi.fn(async () => ({ disposition: 'accepted' as const })),
      retry: vi.fn(async () => ({ disposition: 'accepted' as const })),
    };
    const env = {
      ...baseEnv(db),
      DOCUMENT_REQUEST_CASE_SYNC_MODE: 'mock',
      DOCUMENT_REQUEST_SYNC_PRINCIPAL_ID: 'case-sync-principal',
      DOCUMENT_REQUEST_SYNC_TOKEN: 'hmac-secret',
      DOCUMENT_REQUEST_CASE_SYNC: binding,
    } as Env;
    const created = await createDocumentRequest(env, record);
    await syncStoredDocumentRequest(env, created.receiptId);
    expect(binding.acceptStored).not.toHaveBeenCalled();
  });

  it('同期失敗でも受付は stored のまま。ログにメールは出ない', async () => {
    const errors: string[] = [];
    vi.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args.join(' '));
    });
    const db = openDatabase();
    const binding: DocumentRequestCaseSyncBinding = {
      acceptStored: vi.fn(async () => {
        throw new Error('sync down taro@example.com 山田太郎 sk-secret');
      }),
      retry: vi.fn(async () => ({ disposition: 'accepted' as const })),
    };
    const env = {
      ...baseEnv(db),
      DOCUMENT_REQUEST_CASE_SYNC_MODE: 'mock',
      DOCUMENT_REQUEST_SYNC_PRINCIPAL_ID: 'case-sync-principal',
      DOCUMENT_REQUEST_SYNC_TOKEN: 'case-sync-token',
      DOCUMENT_REQUEST_CASE_SYNC: binding,
      CONTACT_NOTIFICATIONS: { send: async () => undefined },
    } as unknown as Env;
    const res = await worker.fetch(new Request('https://cor-jp.com/api/contact/document-request', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://cor-jp.com',
        'cf-connecting-ip': '198.51.100.80',
      },
      body: JSON.stringify({
        name: record.name,
        email: record.email,
        company: record.company,
        industry: 'medical',
        consent: true,
        locale: 'ja',
      }),
    }), env);
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string; receiptId: string; delivered: boolean };
    expect(body.status).toBe('stored');
    expect(body.delivered).toBe(false);
    expect(body.receiptId).toMatch(/^COR-/);
    const row = db.prepare('SELECT status, case_sync_status FROM submission_intake').get() as {
      status: string;
      case_sync_status: string;
    };
    expect(row.status).toBe('stored');
    expect(row.case_sync_status).toBe('sync_failed');
    expect(binding.retry).not.toHaveBeenCalled();
    expect(errors.join('\n')).toContain('document_case_sync_failed');
    expect(errors.join('\n')).not.toContain('taro@example.com');
    expect(errors.join('\n')).not.toContain('山田');
    expect(errors.join('\n')).not.toContain('sk-secret');
  });

  it('認証拒否と不正な応答では retry を呼ばない', async () => {
    const db = openDatabase();
    const binding: DocumentRequestCaseSyncBinding = {
      acceptStored: vi.fn(async () => ({ disposition: 'auth_rejected' as const })),
      retry: vi.fn(async () => ({ disposition: 'accepted' as const })),
    };
    const env = {
      ...baseEnv(db),
      DOCUMENT_REQUEST_CASE_SYNC_MODE: 'mock',
      DOCUMENT_REQUEST_SYNC_PRINCIPAL_ID: 'case-sync-principal',
      DOCUMENT_REQUEST_SYNC_TOKEN: 'case-sync-token',
      DOCUMENT_REQUEST_CASE_SYNC: binding,
    } as Env;
    const created = await createDocumentRequest(env, record);
    await syncStoredDocumentRequest(env, created.receiptId);
    await expect(retryStoredDocumentRequest(env, created.receiptId)).resolves.toBe('left');
    expect(binding.retry).not.toHaveBeenCalled();
    const bad = {
      ...binding,
      acceptStored: vi.fn(async () => ({ disposition: 'not-a-status' })),
    } as unknown as DocumentRequestCaseSyncBinding;
    const second = await createDocumentRequest(env, { ...record, email: 'other@example.com' });
    await syncStoredDocumentRequest({ ...env, DOCUMENT_REQUEST_CASE_SYNC: bad }, second.receiptId);
    const status = db.prepare('SELECT case_sync_status FROM submission_intake WHERE receipt_id = ?').get(second.receiptId) as {
      case_sync_status: string;
    };
    expect(status.case_sync_status).toBe('sync_failed');
    expect(bad.retry).not.toHaveBeenCalled();
  });

  it('retry_scheduled だけ明示 retry し、ack_unknown では再送しない', async () => {
    const db = openDatabase();
    const seen: DocumentRequestSyncSource[] = [];
    const binding: DocumentRequestCaseSyncBinding = {
      acceptStored: vi.fn(async (_auth, source) => {
        seen.push(source);
        return { disposition: 'retry_scheduled' as const };
      }),
      retry: vi.fn(async () => ({ disposition: 'ack_unknown' as const })),
    };
    const env = {
      ...baseEnv(db),
      DOCUMENT_REQUEST_CASE_SYNC_MODE: 'mock',
      DOCUMENT_REQUEST_SYNC_PRINCIPAL_ID: 'case-sync-principal',
      DOCUMENT_REQUEST_SYNC_TOKEN: 'case-sync-token',
      DOCUMENT_REQUEST_CASE_SYNC: binding,
    } as Env;
    const created = await createDocumentRequest(env, record, new Date('2026-11-08T04:00:00Z'));
    await syncStoredDocumentRequest(env, created.receiptId);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual({
      receiptId: created.receiptId,
      documentId: 'company-deck',
      industry: 'medical',
      consentVersion: 'document-request-1',
      recordedAt: '2026-11-08T04:00:00.000Z',
      intakeStatus: 'stored',
    });
    expect(JSON.stringify(seen[0])).not.toContain('taro@');
    const digest = await syncSourceDigest(seen[0]);
    const auth = (binding.acceptStored as ReturnType<typeof vi.fn>).mock.calls[0][0] as { digest: string; syncToken: string };
    expect(auth.digest).toBe(digest);
    expect(auth.syncToken).toBe('case-sync-token');
    await expect(retryStoredDocumentRequest(env, created.receiptId)).resolves.toBe('retried');
    expect(binding.retry).toHaveBeenCalledTimes(1);
    expect((binding.retry as ReturnType<typeof vi.fn>).mock.calls[0][1]).toBe(created.receiptId);
    await expect(retryStoredDocumentRequest(env, created.receiptId)).resolves.toBe('left');
    expect(binding.retry).toHaveBeenCalledTimes(1);
    const row = db.prepare('SELECT status FROM submission_intake').get() as { status: string };
    expect(row.status).toBe('stored');
  });

  it('同じ受付の並行同期は acceptStored を1回だけ呼ぶ', async () => {
    const db = openDatabase();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolveGate) => {
      release = resolveGate;
    });
    let entered: () => void = () => undefined;
    const enteredGate = new Promise<void>((resolveEntered) => {
      entered = resolveEntered;
    });
    let calls = 0;
    const binding: DocumentRequestCaseSyncBinding = {
      acceptStored: vi.fn(async () => {
        calls += 1;
        entered();
        await gate;
        return { disposition: 'accepted' as const };
      }),
      retry: vi.fn(async () => ({ disposition: 'accepted' as const })),
    };
    const env = {
      ...baseEnv(db),
      DOCUMENT_REQUEST_CASE_SYNC_MODE: 'mock',
      DOCUMENT_REQUEST_SYNC_PRINCIPAL_ID: 'case-sync-principal',
      DOCUMENT_REQUEST_SYNC_TOKEN: 'case-sync-token',
      DOCUMENT_REQUEST_CASE_SYNC: binding,
    } as Env;
    const created = await createDocumentRequest(env, record);
    const first = syncStoredDocumentRequest(env, created.receiptId);
    await enteredGate;
    await syncStoredDocumentRequest(env, created.receiptId);
    release();
    await first;
    expect(calls).toBe(1);
    const row = db.prepare('SELECT status, case_sync_status FROM submission_intake').get() as {
      status: string;
      case_sync_status: string;
    };
    expect(row.status).toBe('stored');
    expect(row.case_sync_status).toBe('accepted');
  });

  it('wrangler の service binding はコメントのまま', () => {
    const text = readFileSync(resolve(__dirname, '../../wrangler.toml'), 'utf8');
    const active = text.split('\n').filter((line) => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith('#') && trimmed.includes('DOCUMENT_REQUEST_CASE_SYNC');
    });
    expect(active).toEqual([]);
  });
});
