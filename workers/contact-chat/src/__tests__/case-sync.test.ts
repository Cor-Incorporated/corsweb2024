import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../index';
import {
  retryStoredDocumentRequest,
  syncStoredDocumentRequest,
} from '../case-sync';
import { createDocumentRequest, readDocumentRequestSyncSource } from '../storage';
import { resetRateLimits } from '../security';
import type {
  DocumentRequestCaseSyncBinding,
  DocumentRequestSyncResult,
  DocumentRequestSyncSource,
  Env,
} from '../types';

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

const FIXTURE_PRINCIPAL = '30000000-0000-4000-8000-000000000003';
const FIXTURE_TOKEN = 'TEST_ONLY_NOT_A_SECRET_coros_sync_fixture_20261108';
const FIXTURE_TOKEN_SHA256 = '1af03a5ec40c6dcc9cbd86b2712fc7783d1918f4dc3b6102797cd0f7d716e647';

function wire(partial: Partial<DocumentRequestSyncResult> & Pick<DocumentRequestSyncResult, 'outcome' | 'code' | 'syncStatus'>): DocumentRequestSyncResult {
  return {
    declaredIntakeStatus: partial.outcome === 'recorded' || partial.outcome === 'retry_scheduled' || partial.outcome === 'quarantined' || partial.outcome === 'lease_held' || partial.outcome === 'ack_unknown' || partial.outcome === 'conflict' ? 'stored' : 'not_accepted',
    attemptCount: 1,
    duplicate: false,
    ...partial,
  };
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function mockReady(db: DatabaseSync, binding: DocumentRequestCaseSyncBinding): Env {
  return {
    ...baseEnv(db),
    DOCUMENT_REQUEST_CASE_SYNC_MODE: 'mock',
    DOCUMENT_REQUEST_SYNC_PRINCIPAL_ID: FIXTURE_PRINCIPAL,
    DOCUMENT_REQUEST_SYNC_TOKEN: FIXTURE_TOKEN,
    DOCUMENT_REQUEST_CASE_SYNC: binding,
  } as Env;
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
    expect(source?.industry).toBe('');
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
      acceptStored: vi.fn(async () => wire({ outcome: 'recorded', code: 'recorded', syncStatus: 'recorded' })),
      retry: vi.fn(async () => wire({ outcome: 'recorded', code: 'recorded', syncStatus: 'recorded' })),
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
      retry: vi.fn(async () => wire({ outcome: 'recorded', code: 'recorded', syncStatus: 'recorded' })),
    };
    const env = {
      ...mockReady(db, binding),
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
      acceptStored: vi.fn(async () => wire({ outcome: 'rejected', code: 'unauthenticated', syncStatus: 'rejected', attemptCount: 0 })),
      retry: vi.fn(async () => wire({ outcome: 'recorded', code: 'recorded', syncStatus: 'recorded' })),
    };
    const env = mockReady(db, binding);
    const created = await createDocumentRequest(env, record);
    await syncStoredDocumentRequest(env, created.receiptId);
    await expect(retryStoredDocumentRequest(env, created.receiptId)).resolves.toBe('left');
    expect(binding.retry).not.toHaveBeenCalled();
    const statusAfterReject = db.prepare('SELECT status, case_sync_status FROM submission_intake WHERE receipt_id = ?').get(created.receiptId) as {
      status: string;
      case_sync_status: string;
    };
    expect(statusAfterReject.status).toBe('stored');
    expect(statusAfterReject.case_sync_status).toBe('rejected');
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

  it('共有フィクスチャの authority は2キーで、生トークンの SHA256 が一致する', async () => {
    expect(await sha256Hex(FIXTURE_TOKEN)).toBe(FIXTURE_TOKEN_SHA256);
    const db = openDatabase();
    const seen: DocumentRequestSyncSource[] = [];
    const binding: DocumentRequestCaseSyncBinding = {
      acceptStored: vi.fn(async (auth, source) => {
        expect(Object.keys(auth).sort()).toEqual(['principalId', 'syncToken']);
        expect(auth.syncToken).toBe(FIXTURE_TOKEN);
        expect(auth.syncToken).not.toBe(FIXTURE_TOKEN_SHA256);
        seen.push(source);
        return wire({
          outcome: 'recorded',
          code: 'recorded',
          syncStatus: 'recorded',
          declaredIntakeStatus: 'stored',
          receiptId: source.receiptId,
          caseId: '40000000-0000-4000-8000-000000000004',
        });
      }),
      retry: vi.fn(async () => wire({ outcome: 'recorded', code: 'recorded', syncStatus: 'recorded' })),
    };
    const env = mockReady(db, binding);
    const created = await createDocumentRequest(env, { ...record, industry: '' }, new Date('2026-11-08T01:00:00Z'));
    await syncStoredDocumentRequest(env, created.receiptId);
    expect(seen[0]?.industry).toBe('');
    expect(seen[0]?.recordedAt).toBe('2026-11-08T01:00:00.000Z');
    expect(Object.keys(seen[0] || {}).sort()).toEqual([
      'consentVersion',
      'documentId',
      'industry',
      'intakeStatus',
      'receiptId',
      'recordedAt',
    ]);
    const stored = db.prepare('SELECT status, case_sync_status FROM submission_intake').get() as {
      status: string;
      case_sync_status: string;
    };
    expect(stored.status).toBe('stored');
    expect(stored.case_sync_status).toBe('recorded');
    await syncStoredDocumentRequest(env, created.receiptId);
    expect(binding.acceptStored).toHaveBeenCalledTimes(1);
    expect(binding.retry).not.toHaveBeenCalled();
  });

  it('通常の重複は再送せず、明示 retry のあと ack_unknown では止める', async () => {
    const db = openDatabase();
    const binding: DocumentRequestCaseSyncBinding = {
      acceptStored: vi.fn(async () => wire({
        outcome: 'retry_scheduled',
        code: 'duplicate',
        syncStatus: 'retry_scheduled',
        duplicate: true,
      })),
      retry: vi.fn(async () => wire({
        outcome: 'ack_unknown',
        code: 'ack_unknown',
        syncStatus: 'ack_unknown',
      })),
    };
    const env = mockReady(db, binding);
    const created = await createDocumentRequest(env, record, new Date('2026-11-08T04:00:00Z'));
    await syncStoredDocumentRequest(env, created.receiptId);
    expect(binding.retry).not.toHaveBeenCalled();
    await expect(retryStoredDocumentRequest(env, created.receiptId)).resolves.toBe('retried');
    expect(binding.retry).toHaveBeenCalledTimes(1);
    const retryAuth = (binding.retry as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, string>;
    expect(Object.keys(retryAuth).sort()).toEqual(['principalId', 'syncToken']);
    expect((binding.retry as ReturnType<typeof vi.fn>).mock.calls[0][1]).toBe(created.receiptId);
    await expect(retryStoredDocumentRequest(env, created.receiptId)).resolves.toBe('left');
    expect(binding.retry).toHaveBeenCalledTimes(1);
    const row = db.prepare('SELECT status, case_sync_status FROM submission_intake').get() as {
      status: string;
      case_sync_status: string;
    };
    expect(row.status).toBe('stored');
    expect(row.case_sync_status).toBe('ack_unknown');
  });

  it('conflict は recorded の syncStatus より優先し、not_connected は recorded にしない', async () => {
    const db = openDatabase();
    const binding: DocumentRequestCaseSyncBinding = {
      acceptStored: vi.fn()
        .mockResolvedValueOnce(wire({
          outcome: 'conflict',
          code: 'conflict',
          syncStatus: 'recorded',
          declaredIntakeStatus: 'stored',
        }))
        .mockResolvedValueOnce(wire({
          outcome: 'not_connected',
          code: 'unconfigured',
          syncStatus: 'not_connected',
          declaredIntakeStatus: 'not_accepted',
          attemptCount: 0,
        })),
      retry: vi.fn(async () => wire({ outcome: 'recorded', code: 'recorded', syncStatus: 'recorded' })),
    };
    const env = mockReady(db, binding);
    const conflicted = await createDocumentRequest(env, record);
    await syncStoredDocumentRequest(env, conflicted.receiptId);
    const conflictRow = db.prepare('SELECT status, case_sync_status FROM submission_intake WHERE receipt_id = ?').get(conflicted.receiptId) as {
      status: string;
      case_sync_status: string;
    };
    expect(conflictRow.status).toBe('stored');
    expect(conflictRow.case_sync_status).toBe('conflict');
    await expect(retryStoredDocumentRequest(env, conflicted.receiptId)).resolves.toBe('left');
    const closed = await createDocumentRequest(env, { ...record, email: 'closed@example.com' });
    await syncStoredDocumentRequest(env, closed.receiptId);
    const closedRow = db.prepare('SELECT status, case_sync_status FROM submission_intake WHERE receipt_id = ?').get(closed.receiptId) as {
      status: string;
      case_sync_status: string;
    };
    expect(closedRow.status).toBe('stored');
    expect(closedRow.case_sync_status).toBe('not_connected');
    expect(binding.retry).not.toHaveBeenCalled();
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
        return wire({ outcome: 'recorded', code: 'recorded', syncStatus: 'recorded' });
      }),
      retry: vi.fn(async () => wire({ outcome: 'recorded', code: 'recorded', syncStatus: 'recorded' })),
    };
    const env = mockReady(db, binding);
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
    expect(row.case_sync_status).toBe('recorded');
  });

  it('migration 0006 が無い DB でも、無効な同期は SQL も RPC も触らない', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    const dir = resolve(__dirname, '../../migrations');
    for (const file of readdirSync(dir).filter((name) => name.endsWith('.sql') && name < '0006').sort()) {
      db.exec(readFileSync(resolve(dir, file), 'utf8'));
    }
    const sqlLog: string[] = [];
    const binding: DocumentRequestCaseSyncBinding = {
      acceptStored: vi.fn(async () => {
        throw new Error('rpc');
      }),
      retry: vi.fn(async () => {
        throw new Error('rpc');
      }),
    };
    const env = {
      ...baseEnv(db, sqlLog),
      DOCUMENT_REQUEST_CASE_SYNC: binding,
      CONTACT_NOTIFICATIONS: { send: async () => undefined },
    } as unknown as Env;
    const res = await worker.fetch(new Request('https://cor-jp.com/api/contact/document-request', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://cor-jp.com',
        'cf-connecting-ip': '198.51.100.81',
      },
      body: JSON.stringify({
        name: record.name,
        email: 'pre0006@example.com',
        consent: true,
        locale: 'ja',
      }),
    }), env);
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string; receiptId: string };
    expect(body.status).toBe('stored');
    expect(sqlLog.some((sql) => sql.includes('case_sync_status'))).toBe(false);
    expect(binding.acceptStored).not.toHaveBeenCalled();
    expect(binding.retry).not.toHaveBeenCalled();
    const row = db.prepare('SELECT status, request_kind FROM submission_intake WHERE receipt_id = ?').get(body.receiptId) as {
      status: string;
      request_kind: string;
    };
    expect(row.status).toBe('stored');
    expect(row.request_kind).toBe('document');
    await syncStoredDocumentRequest({ ...env, DOCUMENT_REQUEST_CASE_SYNC_MODE: 'live' }, body.receiptId);
    expect(sqlLog.some((sql) => sql.includes('case_sync_status'))).toBe(false);
  });

  it.each([
    ['forbidden', 'rejected', 'rejected'],
    ['unavailable', 'rejected', 'rejected'],
    ['invalid_envelope', 'rejected', 'rejected'],
    ['invalid_source', 'rejected', 'rejected'],
    ['not_held', 'rejected', 'rejected'],
    ['production_recording_not_connected', 'not_connected', 'not_connected'],
    ['quarantined', 'quarantined', 'quarantined'],
    ['lease_held', 'lease_held', 'lease_held'],
  ] as const)('応答 %s は受付を stored のまま %s で残し、retry しない', async (code, outcome, stored) => {
    const db = openDatabase();
    const binding: DocumentRequestCaseSyncBinding = {
      acceptStored: vi.fn(async () => wire({
        outcome,
        code,
        syncStatus: outcome === 'lease_held' ? 'leased' : outcome === 'not_connected' ? 'not_connected' : outcome === 'quarantined' ? 'quarantined' : 'rejected',
        attemptCount: outcome === 'not_connected' ? 0 : 1,
      })),
      retry: vi.fn(async () => wire({ outcome: 'recorded', code: 'recorded', syncStatus: 'recorded' })),
    };
    const env = mockReady(db, binding);
    const created = await createDocumentRequest(env, { ...record, email: `${code}@example.com` });
    await syncStoredDocumentRequest(env, created.receiptId);
    const row = db.prepare('SELECT status, case_sync_status FROM submission_intake WHERE receipt_id = ?').get(created.receiptId) as {
      status: string;
      case_sync_status: string;
    };
    expect(row.status).toBe('stored');
    expect(row.case_sync_status).toBe(stored);
    await expect(retryStoredDocumentRequest(env, created.receiptId)).resolves.toBe('left');
    expect(binding.retry).not.toHaveBeenCalled();
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
