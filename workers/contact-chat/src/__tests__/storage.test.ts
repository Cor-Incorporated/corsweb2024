import { describe, expect, it } from 'vitest';
import {
  createSubmission,
  decryptText,
  encryptText,
  applyUntrustedContactSessionFallback,
  getTrustedContactSession,
  getSubmissionForNotification,
  newReceiptId,
  newSessionId,
  normalizeIdempotencyKey,
  queueMessage,
  SubmissionConflictError,
  upsertContactSession,
} from '../storage';
import type { Env, NormalizedInquiry } from '../types';
import type {
  ContactSessionStorageSnapshot,
  SessionState,
  TrustedContactSession,
} from '../storage';

interface DbCall {
  sql: string;
  bindings: unknown[];
}

const TEST_STORAGE_SNAPSHOT: ContactSessionStorageSnapshot = {
  intent: 'contract-dev',
  mode: 'intake',
  locale: 'ja',
  source: 'cloudia',
  stage: 'ready',
  turnCount: 2,
  structuredLeadJson: '{}',
  missingFieldsJson: '[]',
  classification: 'genuine',
  summaryText: 'D1で確認済みの正本要約',
  conversationExcerptCiphertext: '',
  updatedAt: 1_700_000_000,
  expiresAt: 4_000_000_000,
};

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
    batch: async (statements: D1PreparedStatement[]) => statements.map(() => ({ meta: { changes: 1 } })),
  };
  return db as unknown as D1Database & { calls: DbCall[] };
}

describe('encrypted contact storage primitives', () => {
  it('untrusted session fallbackは非会話フィールドだけから決定的要約を作り確認印と抜粋を除去する', () => {
    const fallback = applyUntrustedContactSessionFallback({
      name: '山田太郎',
      email: 'taro@example.com',
      company: '',
      message: '相談本文',
      summaryText: 'browser supplied confirmed summary',
      summaryConfirmed: true,
      conversationSummary: 'browser supplied confirmed summary',
      conversationExcerpt: '訪問者: browser raw transcript',
      classification: 'genuine',
      intent: 'contract-dev',
      source: 'cloudia',
      structuredLead: { purpose: '受託開発相談', stage: '要件整理中' },
      utm: {},
    });

    expect(fallback.summaryText).toBe('相談目的: contract-dev / 分類: genuine / 目的: 受託開発相談 / 進捗段階: 要件整理中');
    expect(fallback.conversationSummary).toBe(fallback.summaryText);
    expect(fallback.summaryConfirmed).toBeUndefined();
    expect(fallback.conversationExcerpt).toBeUndefined();
    expect(JSON.stringify(fallback)).not.toContain('browser supplied confirmed summary');
    expect(JSON.stringify(fallback)).not.toContain('browser raw transcript');
  });

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

  it('creates a non-PII receipt identifier', () => {
    expect(newReceiptId()).toMatch(/^COR-\d{8}-[A-F0-9]{8}$/);
  });

  it('trusted session queryはactiveかつ現在時刻より後のexpiryだけを許可する', async () => {
    const db = mockDb();
    await expect(getTrustedContactSession({ DB: db } as unknown as Env, 'session-1')).resolves.toBeNull();
    expect(db.calls[0].sql).toContain("status = 'active'");
    expect(db.calls[0].sql).toContain('expires_at > ?');
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
    const trustedSession: TrustedContactSession = {
      sessionId: 'session-1',
      intent: 'contract-dev',
      locale: 'ja',
      source: 'cloudia',
      classification: 'genuine',
      summary: 'D1で確認済みの正本要約',
      structuredLead: inquiry.structuredLead,
      storageSnapshot: { ...TEST_STORAGE_SNAPSHOT, conversationExcerptCiphertext: excerpt },
    };
    await createSubmission(
      { DB: db, PII_ENCRYPTION_KEY: 'secret', PII_HMAC_KEY: 'hmac' } as unknown as Env,
      inquiry,
      { idempotencyKey: 'idempotency-1', sessionId: 'session-1', trustedSession },
    );
    const call = db.calls.find((entry) => entry.sql.includes('INSERT INTO submission_intake'));
    expect(call).toBeDefined();
    expect(call?.sql).toContain('FROM contact_sessions');
    expect(call?.sql).toContain("status = 'active'");
    expect(call?.sql).toContain('structured_lead_json = ?');
    expect(call?.sql).toContain('classification = ?');
    expect(call?.sql).toContain('summary_text = ?');
    expect(call?.sql).toContain('conversation_excerpt_ciphertext = ?');
    expect(call?.sql).toContain('updated_at = ?');
    expect(call?.sql).toContain('expires_at = ?');
    expect(call?.bindings[2]).toMatch(/^[a-f0-9]{64}$/);
    expect(String(call?.bindings[2])).not.toContain(inquiry.email);
    await expect(decryptText('secret', String(call?.bindings[9])))
      .resolves.toBe('D1で確認済みの正本要約');
    await expect(decryptText('secret', String(call?.bindings[10]))).resolves.toBe('訪問者: 相談です');
    expect(JSON.parse(String(call?.bindings[14]))).toEqual({
      discoverySource: '紹介',
      contactReason: 'PoCの相談',
    });
    expect(call?.bindings.slice(-13)).toEqual([
      TEST_STORAGE_SNAPSHOT.intent,
      TEST_STORAGE_SNAPSHOT.mode,
      TEST_STORAGE_SNAPSHOT.locale,
      TEST_STORAGE_SNAPSHOT.source,
      TEST_STORAGE_SNAPSHOT.stage,
      TEST_STORAGE_SNAPSHOT.turnCount,
      TEST_STORAGE_SNAPSHOT.structuredLeadJson,
      TEST_STORAGE_SNAPSHOT.missingFieldsJson,
      TEST_STORAGE_SNAPSHOT.classification,
      TEST_STORAGE_SNAPSHOT.summaryText,
      excerpt,
      TEST_STORAGE_SNAPSHOT.updatedAt,
      TEST_STORAGE_SNAPSHOT.expiresAt,
    ]);
    const dependentWrites = db.calls.filter((entry) =>
      entry.sql.includes('INSERT INTO notification_outbox') || entry.sql.includes('INSERT INTO audit_events')
    );
    expect(dependentWrites).toHaveLength(3);
    expect(dependentWrites.every((entry) => entry.sql.includes('WHERE EXISTS'))).toBe(true);
  });

  it('trusted sessionが同じならbrowser要約の差分は冪等fingerprintを変えない', async () => {
    const trustedSession: TrustedContactSession = {
      sessionId: 'session-1',
      intent: 'contract-dev',
      locale: 'ja',
      source: 'cloudia',
      classification: 'genuine',
      summary: 'D1で確認済みの正本要約',
      structuredLead: { purpose: '受託開発相談' },
      storageSnapshot: TEST_STORAGE_SNAPSHOT,
    };
    const baseInquiry: NormalizedInquiry = {
      name: '山田太郎',
      email: 'taro@example.com',
      company: '',
      message: '相談です',
      summaryText: 'browser summary A',
      conversationSummary: 'browser summary A',
      classification: 'genuine',
      intent: 'contract-dev',
      source: 'browser',
      structuredLead: {},
      utm: {},
    };
    const firstDb = mockDb((sql) => sql.includes('SELECT session_id, conversation_excerpt_ciphertext')
      ? { session_id: trustedSession.sessionId, conversation_excerpt_ciphertext: '' }
      : null);
    await createSubmission(
      { DB: firstDb, PII_ENCRYPTION_KEY: 'secret', PII_HMAC_KEY: 'hmac' } as unknown as Env,
      baseInquiry,
      { idempotencyKey: 'trusted-replay', sessionId: trustedSession.sessionId, trustedSession },
    );
    const insert = firstDb.calls.find((entry) => entry.sql.includes('INSERT INTO submission_intake'));
    const existing = {
      submission_id: String(insert?.bindings[0]),
      receipt_id: String(insert?.bindings[4]),
      payload_fingerprint: String(insert?.bindings[2]),
      metadata_json: null,
    };
    const replayDb = mockDb((sql) => {
      if (sql.includes('SELECT session_id, conversation_excerpt_ciphertext')) {
        return { session_id: trustedSession.sessionId, conversation_excerpt_ciphertext: '' };
      }
      return sql.includes('FROM submission_intake s') ? existing : null;
    });
    const replay = await createSubmission(
      { DB: replayDb, PII_ENCRYPTION_KEY: 'secret', PII_HMAC_KEY: 'hmac' } as unknown as Env,
      {
        ...baseInquiry,
        summaryText: 'browser summary B',
        conversationSummary: 'browser summary B',
      },
      { idempotencyKey: 'trusted-replay', sessionId: trustedSession.sessionId, trustedSession },
    );
    expect(replay.duplicate).toBe(true);
  });

  it('handoff同意はWorker受信時刻を正本、browser時刻を監査参考として保存する', async () => {
    const db = mockDb((sql) => sql.includes('SELECT session_id, conversation_excerpt_ciphertext')
      ? { session_id: 'session-1', conversation_excerpt_ciphertext: '' }
      : null);
    const inquiry: NormalizedInquiry = {
      name: '山田太郎',
      email: 'taro@example.com',
      company: '',
      message: '相談です',
      conversationSummary: '要約',
      classification: 'genuine',
      intent: 'contract-dev',
      source: 'cloudia',
      structuredLead: {},
      utm: {},
    };
    const trustedSession: TrustedContactSession = {
      sessionId: 'session-1',
      intent: 'contract-dev',
      locale: 'ja',
      source: 'cloudia',
      classification: 'genuine',
      summary: '要約',
      structuredLead: {},
      storageSnapshot: TEST_STORAGE_SNAPSHOT,
    };
    await createSubmission(
      { DB: db, PII_ENCRYPTION_KEY: 'secret', PII_HMAC_KEY: 'hmac' } as unknown as Env,
      inquiry,
      {
        idempotencyKey: 'idempotency-consent',
        sessionId: trustedSession.sessionId,
        trustedSession,
        handoffConsent: {
          accepted: true,
          version: 'cloudia-grift-v1',
          acceptedAt: '2026-07-14T00:00:01.234Z',
          browserAcceptedAt: '2026-07-14T00:00:00.000Z',
          summaryConfirmed: true,
        },
      },
    );
    const audit = db.calls.find((entry) => entry.sql.includes('INSERT INTO audit_events'));
    expect(JSON.parse(String(audit?.bindings[3]))).toEqual({
      handoff_consent: {
        accepted: true,
        version: 'cloudia-grift-v1',
        accepted_at: '2026-07-14T00:00:01.234Z',
        browser_accepted_at: '2026-07-14T00:00:00.000Z',
        summary_confirmed: true,
      },
    });
  });

  it('完全一致replayだけを許可し、最初のWorker同意時刻を復元する', async () => {
    const inquiry: NormalizedInquiry = {
      name: '山田太郎',
      email: 'taro@example.com',
      company: '',
      message: '相談です',
      summaryText: '画面で確認した要約',
      conversationSummary: '画面で確認した要約',
      classification: 'genuine',
      intent: 'contract-dev',
      source: 'cloudia',
      structuredLead: {},
      utm: {},
    };
    const firstConsent = {
      accepted: true as const,
      version: 'cloudia-grift-v1' as const,
      acceptedAt: '2026-07-14T00:00:01.234Z',
      browserAcceptedAt: '2026-07-14T00:00:00.000Z',
      summaryConfirmed: true as const,
    };
    const trustedSession: TrustedContactSession = {
      sessionId: 'session-1',
      intent: 'contract-dev',
      locale: 'ja',
      source: 'cloudia',
      classification: 'genuine',
      summary: inquiry.conversationSummary,
      structuredLead: {},
      storageSnapshot: TEST_STORAGE_SNAPSHOT,
    };
    const firstDb = mockDb((sql) => sql.includes('SELECT session_id, conversation_excerpt_ciphertext')
      ? { session_id: trustedSession.sessionId, conversation_excerpt_ciphertext: '' }
      : null);
    await createSubmission(
      { DB: firstDb, PII_ENCRYPTION_KEY: 'secret', PII_HMAC_KEY: 'hmac' } as unknown as Env,
      inquiry,
      {
        idempotencyKey: 'exact-replay',
        sessionId: trustedSession.sessionId,
        trustedSession,
        handoffConsent: firstConsent,
      },
    );
    const insert = firstDb.calls.find((entry) => entry.sql.includes('INSERT INTO submission_intake'));
    const audit = firstDb.calls.find((entry) => entry.sql.includes('INSERT INTO audit_events'));
    const existing = {
      submission_id: String(insert?.bindings[0]),
      receipt_id: String(insert?.bindings[4]),
      payload_fingerprint: String(insert?.bindings[2]),
      metadata_json: String(audit?.bindings[3]),
    };
    const replayDb = mockDb((sql) => {
      if (sql.includes('SELECT session_id, conversation_excerpt_ciphertext')) {
        return { session_id: trustedSession.sessionId, conversation_excerpt_ciphertext: '' };
      }
      return sql.includes('FROM submission_intake s') ? existing : null;
    });
    const replay = await createSubmission(
      { DB: replayDb, PII_ENCRYPTION_KEY: 'secret', PII_HMAC_KEY: 'hmac' } as unknown as Env,
      inquiry,
      {
        idempotencyKey: 'exact-replay',
        sessionId: trustedSession.sessionId,
        trustedSession,
        handoffConsent: { ...firstConsent, acceptedAt: '2026-07-14T00:05:00.000Z' },
      },
    );
    expect(replay.duplicate).toBe(true);
    expect(replay.handoffConsent?.acceptedAt).toBe(firstConsent.acceptedAt);
  });

  it.each(['session', 'email', 'consent'] as const)(
    '同じidempotency keyで%sが異なるpayloadはtyped conflictにする',
    async (variant) => {
      const inquiry: NormalizedInquiry = {
        name: '山田太郎',
        email: 'taro@example.com',
        company: '',
        message: '相談です',
        summaryText: '画面で確認した要約',
        conversationSummary: '画面で確認した要約',
        classification: 'genuine',
        intent: 'contract-dev',
        source: 'cloudia',
        structuredLead: {},
        utm: {},
      };
      const consent = {
        accepted: true as const,
        version: 'cloudia-grift-v1' as const,
        acceptedAt: '2026-07-14T00:00:01.234Z',
        browserAcceptedAt: '2026-07-14T00:00:00.000Z',
        summaryConfirmed: true as const,
      };
      const baseTrustedSession: TrustedContactSession = {
        sessionId: 'session-1',
        intent: 'contract-dev',
        locale: 'ja',
        source: 'cloudia',
        classification: 'genuine',
        summary: inquiry.conversationSummary,
        structuredLead: {},
        storageSnapshot: TEST_STORAGE_SNAPSHOT,
      };
      const firstDb = mockDb((sql) => sql.includes('SELECT session_id, conversation_excerpt_ciphertext')
        ? { session_id: baseTrustedSession.sessionId, conversation_excerpt_ciphertext: '' }
        : null);
      await createSubmission(
        { DB: firstDb, PII_ENCRYPTION_KEY: 'secret', PII_HMAC_KEY: 'hmac' } as unknown as Env,
        inquiry,
        {
          idempotencyKey: 'conflict-key',
          sessionId: baseTrustedSession.sessionId,
          trustedSession: baseTrustedSession,
          handoffConsent: consent,
        },
      );
      const insert = firstDb.calls.find((entry) => entry.sql.includes('INSERT INTO submission_intake'));
      const audit = firstDb.calls.find((entry) => entry.sql.includes('INSERT INTO audit_events'));
      const existing = {
        submission_id: String(insert?.bindings[0]),
        receipt_id: String(insert?.bindings[4]),
        payload_fingerprint: String(insert?.bindings[2]),
        metadata_json: String(audit?.bindings[3]),
      };
      const trustedSession: TrustedContactSession = {
        sessionId: 'different-session',
        intent: 'contract-dev',
        locale: 'ja',
        source: 'cloudia',
        classification: 'genuine',
        summary: 'unused session summary',
        structuredLead: {},
        storageSnapshot: TEST_STORAGE_SNAPSHOT,
      };
      const replayDb = mockDb((sql) => {
        if (sql.includes('SELECT session_id, conversation_excerpt_ciphertext')) {
          const session = variant === 'session' ? trustedSession : baseTrustedSession;
          return { session_id: session.sessionId, conversation_excerpt_ciphertext: '' };
        }
        return sql.includes('FROM submission_intake s') ? existing : null;
      });
      const changedInquiry = {
        ...inquiry,
        ...(variant === 'email' ? { email: 'other@example.com' } : {}),
      };
      await expect(createSubmission(
        { DB: replayDb, PII_ENCRYPTION_KEY: 'secret', PII_HMAC_KEY: 'hmac' } as unknown as Env,
        changedInquiry,
        {
          idempotencyKey: 'conflict-key',
          sessionId: variant === 'session' ? trustedSession.sessionId : baseTrustedSession.sessionId,
          trustedSession: variant === 'session' ? trustedSession : baseTrustedSession,
          handoffConsent: variant === 'consent'
            ? { ...consent, browserAcceptedAt: '2026-07-14T00:00:02.000Z' }
            : consent,
        },
      )).rejects.toBeInstanceOf(SubmissionConflictError);
    },
  );

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
      metadata_json: JSON.stringify({
        handoff_consent: {
          accepted: true,
          version: 'cloudia-grift-v1',
          accepted_at: '2026-07-14T00:00:01.234Z',
          browser_accepted_at: '2026-07-14T00:00:00.000Z',
          summary_confirmed: true,
        },
      }),
    };
    const db = mockDb((sql) => sql.includes('SELECT o.outbox_id') ? row : null);
    const env = { DB: db, PII_ENCRYPTION_KEY: secret } as unknown as Env;
    const internal = await getSubmissionForNotification(env, 'submission-1', 'internal');
    expect(internal?.inquiry.conversationExcerpt).toBe('訪問者: 相談です');
    expect(internal?.inquiry.structuredLead).toEqual({ discoverySource: '検索', contactReason: '導入相談' });
    expect(internal?.inquiry.summaryConfirmed).toBe(true);
    const receipt = await getSubmissionForNotification(env, 'submission-1', 'receipt');
    expect(receipt?.inquiry.conversationExcerpt).toBeUndefined();
    expect(receipt?.inquiry.structuredLead).toEqual({ discoverySource: '検索', contactReason: '導入相談' });
    expect(receipt?.inquiry.summaryConfirmed).toBe(true);
  });
});
