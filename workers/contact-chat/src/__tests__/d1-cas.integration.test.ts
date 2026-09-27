import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Miniflare } from 'miniflare';
import {
  createSubmission,
  getTrustedContactSession,
  SubmissionConflictError,
  upsertContactSession,
} from '../storage';
import type { Env, NormalizedInquiry } from '../types';
import type { SessionState, TrustedContactSession } from '../storage';

const migrationsDir = resolve(process.cwd(), 'migrations');

const inquiry: NormalizedInquiry = {
  name: 'D1 CAS QA',
  email: 'qa@example.com',
  company: 'Cor. Inc.',
  message: 'CAS integration verification',
  summaryText: 'browser supplied summary',
  summaryConfirmed: true,
  conversationSummary: 'browser supplied summary',
  classification: 'genuine',
  intent: 'contract-dev',
  source: 'cloudia',
  structuredLead: { purpose: '受託開発相談' },
  utm: {},
};

const state: SessionState = {
  sessionId: 'qa-session',
  intent: 'contract-dev',
  mode: 'intake',
  locale: 'ja',
  source: 'cloudia',
  stage: 'ready',
  turnCount: 3,
  structuredLead: { purpose: '受託開発相談' },
  missingFields: [],
  classification: 'genuine',
  summary: 'D1 confirmed summary',
  conversationExcerpt: '訪問者: CAS QA',
};

const consent = {
  accepted: true as const,
  version: 'cloudia-grift-v1' as const,
  acceptedAt: '2026-07-14T10:00:00.000Z',
  browserAcceptedAt: '2026-07-14T09:59:59.000Z',
  summaryConfirmed: true as const,
};

interface Counts {
  submissions: number;
  outbox: number;
  audit: number;
}

describe('full-row CAS against a real local D1', () => {
  let mf: Miniflare;
  let db: D1Database;
  let env: Env;

  beforeEach(async () => {
    mf = new Miniflare({
      modules: true,
      script: 'export default { fetch() { return new Response("ok") } }',
      compatibilityDate: '2026-07-14',
      d1Databases: { DB: `qa-${crypto.randomUUID()}` },
    });
    db = await mf.getD1Database('DB');
    for (const migration of readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort()) {
      const sql = readFileSync(resolve(migrationsDir, migration), 'utf8')
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('--'))
        .join('\n');
      for (const statement of sql.split(';').map((value) => value.trim()).filter(Boolean)) {
        if (statement.startsWith('PRAGMA ')) continue;
        await db.prepare(statement).run();
      }
    }
    env = {
      DB: db,
      PII_ENCRYPTION_KEY: 'qa-encryption-key',
      PII_HMAC_KEY: 'qa-hmac-key',
    } as unknown as Env;
    await upsertContactSession(env, state);
  });

  afterEach(async () => {
    await mf.dispose();
  });

  async function trusted(): Promise<TrustedContactSession> {
    const value = await getTrustedContactSession(env, state.sessionId);
    expect(value).not.toBeNull();
    return value as TrustedContactSession;
  }

  async function counts(): Promise<Counts> {
    const [submissions, outbox, audit] = await Promise.all([
      db.prepare('SELECT COUNT(*) AS count FROM submission_intake').first<{ count: number }>(),
      db.prepare('SELECT COUNT(*) AS count FROM notification_outbox').first<{ count: number }>(),
      db.prepare('SELECT COUNT(*) AS count FROM audit_events WHERE submission_id IS NOT NULL').first<{ count: number }>(),
    ]);
    return {
      submissions: Number(submissions?.count || 0),
      outbox: Number(outbox?.count || 0),
      audit: Number(audit?.count || 0),
    };
  }

  it('matching snapshot commits one submission, two outbox rows, and one audit row', async () => {
    const result = await createSubmission(env, inquiry, {
      idempotencyKey: 'qa-match',
      sessionId: state.sessionId,
      trustedSession: await trusted(),
      handoffConsent: consent,
    });

    expect(result.duplicate).toBe(false);
    expect(await counts()).toEqual({ submissions: 1, outbox: 2, audit: 1 });
    const row = await db.prepare(
      'SELECT session_id, intent, source FROM submission_intake WHERE submission_id = ?',
    ).bind(result.submissionId).first<{ session_id: string; intent: string; source: string }>();
    expect(row).toEqual({ session_id: state.sessionId, intent: 'contract-dev', source: 'cloudia' });
  });

  it('snapshot mismatch writes zero trusted dependent rows before the safe fallback', async () => {
    const snapshot = await trusted();
    await db.prepare('UPDATE contact_sessions SET summary_text = ? WHERE session_id = ?')
      .bind('concurrently updated summary', state.sessionId)
      .run();

    const observations: Counts[] = [];
    let batchCall = 0;
    const observedDb = {
      prepare: (sql: string) => db.prepare(sql),
      batch: async (statements: D1PreparedStatement[]) => {
        const results = await db.batch(statements);
        batchCall += 1;
        if (batchCall === 1) observations.push(await counts());
        return results;
      },
    } as unknown as D1Database;

    const result = await createSubmission({ ...env, DB: observedDb }, inquiry, {
      idempotencyKey: 'qa-cas-miss',
      sessionId: state.sessionId,
      trustedSession: snapshot,
      handoffConsent: consent,
    });

    expect(observations).toEqual([{ submissions: 0, outbox: 0, audit: 0 }]);
    expect(batchCall).toBe(2);
    expect(await counts()).toEqual({ submissions: 1, outbox: 2, audit: 1 });
    const row = await db.prepare('SELECT session_id FROM submission_intake WHERE submission_id = ?')
      .bind(result.submissionId)
      .first<{ session_id: string | null }>();
    expect(row?.session_id).toBeNull();
    expect(result.handoffConsent).toBeNull();
  });

  it('a late statement failure rolls the entire trusted D1 batch back', async () => {
    await db.prepare(
      "INSERT INTO audit_events (event_id, event_type, metadata_json, created_at) VALUES ('qa-duplicate', 'qa_seed', '{}', 0)",
    ).run();
    const snapshot = await trusted();
    let rollbackObservation: Counts | null = null;
    let batchCall = 0;
    const failingDb = {
      prepare: (sql: string) => db.prepare(sql),
      batch: async (statements: D1PreparedStatement[]) => {
        batchCall += 1;
        if (batchCall !== 1) return db.batch(statements);
        const duplicate = db.prepare(
          "INSERT INTO audit_events (event_id, event_type, metadata_json, created_at) VALUES ('qa-duplicate', 'qa_failure', '{}', 1)",
        );
        try {
          return await db.batch([...statements, duplicate]);
        } catch (error) {
          rollbackObservation = await counts();
          throw error;
        }
      },
    } as unknown as D1Database;

    const result = await createSubmission({ ...env, DB: failingDb }, inquiry, {
      idempotencyKey: 'qa-rollback',
      sessionId: state.sessionId,
      trustedSession: snapshot,
      handoffConsent: consent,
    });

    expect(rollbackObservation).toEqual({ submissions: 0, outbox: 0, audit: 0 });
    expect(batchCall).toBe(2);
    expect(await counts()).toEqual({ submissions: 1, outbox: 2, audit: 1 });
    const row = await db.prepare('SELECT session_id FROM submission_intake WHERE submission_id = ?')
      .bind(result.submissionId)
      .first<{ session_id: string | null }>();
    expect(row?.session_id).toBeNull();
    expect(result.handoffConsent).toBeNull();
  });

  it('read-error fallback followed by same-key trusted retry is a stable 409 without duplicates', async () => {
    let failSessionRead = true;
    const transientDb = {
      prepare: (sql: string) => {
        const statement = db.prepare(sql);
        if (!failSessionRead || !sql.includes('FROM contact_sessions')) return statement;
        return {
          bind: (...bindings: unknown[]) => {
            const bound = statement.bind(...bindings);
            return {
              first: async () => {
                failSessionRead = false;
                throw new Error('qa transient D1 read failure');
              },
              run: () => bound.run(),
            };
          },
        } as unknown as D1PreparedStatement;
      },
      batch: (statements: D1PreparedStatement[]) => db.batch(statements),
    } as unknown as D1Database;
    const transientEnv = { ...env, DB: transientDb };

    await expect(getTrustedContactSession(transientEnv, state.sessionId))
      .rejects.toThrow('qa transient D1 read failure');
    const fallback = await createSubmission(transientEnv, inquiry, {
      idempotencyKey: 'qa-read-retry',
      sessionId: state.sessionId,
      trustedSession: null,
      handoffConsent: null,
    });
    expect(fallback.handoffConsent).toBeNull();

    await expect(createSubmission(env, inquiry, {
      idempotencyKey: 'qa-read-retry',
      sessionId: state.sessionId,
      trustedSession: await trusted(),
      handoffConsent: consent,
    })).rejects.toBeInstanceOf(SubmissionConflictError);

    expect(await counts()).toEqual({ submissions: 1, outbox: 2, audit: 1 });
    const row = await db.prepare('SELECT session_id FROM submission_intake WHERE submission_id = ?')
      .bind(fallback.submissionId)
      .first<{ session_id: string | null }>();
    expect(row?.session_id).toBeNull();
  });
});
