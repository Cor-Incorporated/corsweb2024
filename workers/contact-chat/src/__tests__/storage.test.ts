import { describe, expect, it } from 'vitest';
import {
  createSubmission,
  decryptText,
  encryptText,
  getSubmissionForNotification,
  markOutboxFailed,
  newReceiptId,
  newSessionId,
  normalizeIdempotencyKey,
  queueMessage,
  upsertContactSession,
} from '../storage';
import type { Env, NormalizedInquiry } from '../types';
import type { SessionState } from '../storage';

interface DbCall {
  sql: string;
  bindings: unknown[];
}

function mockDb(first: (sql: string, bindings: unknown[]) => unknown = () => null) {
  const calls: DbCall[] = [];
  const db = {
    calls,
    prepare(sql: string) {
      return {
        bind(...bindings: unknown[]) {
          calls.push({ sql, bindings });
          return {
            first: async <T>() => first(sql, bindings) as T,
            run: async () => ({ meta: { changes: 1 } }),
          };
        },
      };
    },
    batch: async () => undefined,
  };
  return db as unknown as D1Database & { calls: DbCall[] };
}

describe('encrypted contact storage primitives', () => {
  it('encrypts and decrypts PII without retaining plaintext', async () => {
    const encoded = await encryptText('test-encryption-secret', '山田太郎 <user@example.com>');
    expect(encoded).not.toContain('山田太郎');
    expect(encoded).not.toContain('user@example.com');
    await expect(decryptText('test-encryption-secret', encoded)).resolves.toBe('山田太郎 <user@example.com>');
    await expect(decryptText('wrong-secret', encoded)).rejects.toThrow();
  });

  it('keeps identifiers opaque and queue payload PII-free', () => {
    const sessionId = newSessionId();
    expect(sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(normalizeIdempotencyKey('client-key-123')).toBe('client-key-123');
    expect(queueMessage('submission-id')).toEqual({ submissionId: 'submission-id' });
    expect(queueMessage('submission-id', 'internal')).toEqual({ submissionId: 'submission-id', messageType: 'internal' });
    expect(queueMessage('submission-id', 'receipt')).toEqual({ submissionId: 'submission-id', messageType: 'receipt' });
    expect(JSON.stringify(queueMessage('submission-id', 'receipt'))).not.toContain('@');
  });

  it('last_error は固定コードだけで、本文の URL や PII を残さない', async () => {
    const db = mockDb();
    const leak = 'status 502 https://tenant.example/acme/cases/CASE-9 token sk-live-secret 山田太郎 yamada@example.com submission 11111111-1111-1111-1111-111111111111';
    await markOutboxFailed({ DB: db } as unknown as Env, 'submission-1', 'internal', leak);
    const update = db.calls.find((call) => call.sql.includes('last_error'));
    expect(update?.bindings[0]).toBe('provider_status_502');
    expect(String(update?.bindings[0])).not.toContain('tenant.example');
    expect(String(update?.bindings[0])).not.toContain('山田');
    expect(String(update?.bindings[0])).not.toContain('sk-live');
  });

  it('creates a non-PII receipt identifier', () => {
    expect(newReceiptId()).toMatch(/^COR-\d{8}-[A-F0-9]{8}$/);
  });

  it('session excerpt is encrypted before the D1 write', async () => {
    const db = mockDb();
    const state: SessionState = {
      sessionId: 'session-1',
      intent: 'contract-dev',
      mode: 'intake',
      locale: 'ja',
      source: 'cloudia',
      stage: 'qualifying',
      turnCount: 2,
      missingFields: [],
      classification: 'genuine',
      summary: '相談目的: contract-dev',
      conversationExcerpt: '訪問者: 相談です [redacted-email]',
      structuredLead: {
        discoverySource: '検索',
        contactReason: '業務改善の相談',
      },
    };
    await upsertContactSession({ DB: db, PII_ENCRYPTION_KEY: 'secret' } as unknown as Env, state);
    const call = db.calls[0];
    expect(call.sql).toContain('conversation_excerpt_ciphertext');
    expect(call.sql).toContain('json_patch(contact_sessions.structured_lead_json, excluded.structured_lead_json)');
    await expect(decryptText('secret', String(call.bindings[11]))).resolves.toBe(state.conversationExcerpt);
  });

  it('submit copies encrypted session excerpt into submission storage', async () => {
    const excerpt = await encryptText('secret', '訪問者: 相談です');
    const db = mockDb((sql) => {
      if (sql.includes('SELECT session_id, conversation_excerpt_ciphertext')) {
        return { session_id: 'session-1', conversation_excerpt_ciphertext: excerpt };
      }
      return null;
    });
    const inquiry: NormalizedInquiry = {
      name: '山田太郎',
      email: 'taro@example.com',
      company: '',
      message: '相談です',
      conversationSummary: '要約',
      classification: 'genuine',
      intent: 'contract-dev',
      source: 'cloudia',
      structuredLead: {
        discoverySource: '紹介',
        contactReason: 'PoCの相談',
      },
      utm: {},
    };
    await createSubmission(
      { DB: db, PII_ENCRYPTION_KEY: 'secret', PII_HMAC_KEY: 'hmac' } as unknown as Env,
      inquiry,
      { idempotencyKey: 'idempotency-1', sessionId: 'session-1' },
    );
    const call = db.calls.find((entry) => entry.sql.includes('INSERT INTO submission_intake'));
    expect(call).toBeDefined();
    await expect(decryptText('secret', String(call?.bindings[9]))).resolves.toBe('訪問者: 相談です');
    expect(JSON.parse(String(call?.bindings[13]))).toEqual({
      discoverySource: '紹介',
      contactReason: 'PoCの相談',
    });
  });

  it('internal通知だけ会話抜粋を復号し、receiptでは復号しない', async () => {
    const secret = 'secret';
    const encrypted = {
      name: await encryptText(secret, '山田太郎'),
      email: await encryptText(secret, 'taro@example.com'),
      company: await encryptText(secret, ''),
      message: await encryptText(secret, '補足'),
      summary: await encryptText(secret, '要約'),
      excerpt: await encryptText(secret, '訪問者: 相談です'),
    };
    const row = {
      outbox_id: 'outbox-1',
      submission_id: 'submission-1',
      receipt_id: 'COR-20260713-ABCD1234',
      message_type: 'internal',
      name_ciphertext: encrypted.name,
      email_ciphertext: encrypted.email,
      company_ciphertext: encrypted.company,
      message_ciphertext: encrypted.message,
      summary_ciphertext: encrypted.summary,
      conversation_excerpt_ciphertext: encrypted.excerpt,
      intent: 'contract-dev',
      source: 'cloudia',
      // Unknown legacy keys must not reach either notification body.
      structured_lead_json: JSON.stringify({
        discoverySource: '検索',
        contactReason: '導入相談',
        legacyNote: 'attacker@example.com',
      }),
      utm_json: '{}',
      classification: 'genuine',
    };
    const db = mockDb((sql) => sql.includes('SELECT o.outbox_id') ? row : null);
    const env = { DB: db, PII_ENCRYPTION_KEY: secret } as unknown as Env;
    const internal = await getSubmissionForNotification(env, 'submission-1', 'internal');
    expect(internal?.inquiry.conversationExcerpt).toBe('訪問者: 相談です');
    expect(internal?.inquiry.structuredLead).toEqual({ discoverySource: '検索', contactReason: '導入相談' });
    const receipt = await getSubmissionForNotification(env, 'submission-1', 'receipt');
    expect(receipt?.inquiry.conversationExcerpt).toBeUndefined();
    expect(receipt?.inquiry.structuredLead).toEqual({ discoverySource: '検索', contactReason: '導入相談' });
  });
});
