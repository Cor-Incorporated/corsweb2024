import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { purgeExpiredData, SESSION_TTL_SECONDS, SUBMISSION_TTL_SECONDS } from '../storage';
import type { Env } from '../types';

const DAY_SECONDS = 24 * 60 * 60;
const PLACEHOLDER = 'x';

class BoundStatement {
  constructor(
    readonly sql: string,
    readonly bindings: SQLInputValue[],
  ) {}
}

/**
 * D1 の batch と同じく、文を 1 つのトランザクションで流す。
 * 1 文でも失敗すれば全体を戻す（Cloudflare D1 の batch）。
 */
function asD1(db: DatabaseSync): D1Database {
  return {
    prepare(sql: string) {
      return {
        bind(...bindings: SQLInputValue[]) {
          return new BoundStatement(sql, bindings);
        },
      };
    },
    async batch(statements: unknown[]) {
      db.exec('BEGIN');
      try {
        for (const statement of statements) {
          if (!(statement instanceof BoundStatement)) {
            throw new Error('batch received a statement that was not prepared here');
          }
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

function openDatabase(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const migrationsDir = resolve(__dirname, '../../migrations');
  const files = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort();
  expect(files).toEqual([
    '0001_contact_intake.sql',
    '0002_notification_receipts.sql',
    '0003_contact_session_summary.sql',
    '0004_conversation_excerpt.sql',
  ]);
  for (const file of files) {
    db.exec(readFileSync(resolve(migrationsDir, file), 'utf8'));
  }
  expect(db.prepare('PRAGMA foreign_keys').get()?.foreign_keys).toBe(1);
  return db;
}

function insertSession(db: DatabaseSync, sessionId: string, expiresAt: number): void {
  db.prepare(
    'INSERT INTO contact_sessions (session_id, created_at, updated_at, expires_at) VALUES (?, 0, 0, ?)',
  ).run(sessionId, expiresAt);
}

function insertSubmission(
  db: DatabaseSync,
  submissionId: string,
  sessionId: string | null,
  expiresAt: number,
): void {
  db.prepare(
    `INSERT INTO submission_intake (
      submission_id, idempotency_key, session_id, receipt_id,
      name_ciphertext, email_ciphertext, company_ciphertext, message_ciphertext, summary_ciphertext,
      email_hmac, created_at, updated_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`,
  ).run(
    submissionId,
    `key-${submissionId}`,
    sessionId,
    `receipt-${submissionId}`,
    PLACEHOLDER,
    PLACEHOLDER,
    PLACEHOLDER,
    PLACEHOLDER,
    PLACEHOLDER,
    'h',
    expiresAt,
  );
}

function insertOutbox(db: DatabaseSync, submissionId: string): void {
  db.prepare(
    `INSERT INTO notification_outbox (
      outbox_id, submission_id, message_type, available_at, created_at, updated_at
    ) VALUES (?, ?, 'internal', 0, 0, 0)`,
  ).run(`outbox-${submissionId}`, submissionId);
}

function insertAudit(db: DatabaseSync, submissionId: string, sessionId: string | null): void {
  db.prepare(
    `INSERT INTO audit_events (event_id, event_type, submission_id, session_id, created_at)
     VALUES (?, 'submit', ?, ?, 0)`,
  ).run(`audit-${submissionId}`, submissionId, sessionId);
}

function ids(db: DatabaseSync, kind: 'sessions' | 'submissions' | 'outbox' | 'audit'): string[] {
  const sql = {
    sessions: 'SELECT session_id AS id FROM contact_sessions ORDER BY session_id',
    submissions: 'SELECT submission_id AS id FROM submission_intake ORDER BY submission_id',
    outbox: 'SELECT outbox_id AS id FROM notification_outbox ORDER BY outbox_id',
    audit: 'SELECT event_id AS id FROM audit_events ORDER BY event_id',
  }[kind];
  return db.prepare(sql).all().map((row) => {
    if (typeof row.id !== 'string') throw new Error(`expected text id in ${kind}`);
    return row.id;
  });
}

describe('purgeExpiredData（外部キーを強制する SQLite）', () => {
  const databases: DatabaseSync[] = [];

  afterEach(() => {
    for (const db of databases) db.close();
    databases.length = 0;
  });

  it('30日を過ぎた会話を、期限内の送信が参照していても削除は失敗せず、参照されていない期限切れだけ消える', async () => {
    expect(SESSION_TTL_SECONDS).toBe(30 * DAY_SECONDS);
    expect(SUBMISSION_TTL_SECONDS).toBe(90 * DAY_SECONDS);
    expect(SESSION_TTL_SECONDS).toBeLessThan(SUBMISSION_TTL_SECONDS);

    const now = Math.floor(Date.now() / 1000);
    // 最後のやり取りからセッション期限は過ぎ、同じ時刻に受けた送信は 90 日の内側。
    const referencedTouch = now - (SESSION_TTL_SECONDS + DAY_SECONDS);
    const referencedSessionExpires = referencedTouch + SESSION_TTL_SECONDS;
    const liveSubmissionExpires = referencedTouch + SUBMISSION_TTL_SECONDS;
    // 送信期限も過ぎている組。会話の削除が外部キーで落ちると、こちらも batch ごと残る。
    const spentTouch = now - (SUBMISSION_TTL_SECONDS + DAY_SECONDS);
    const spentSessionExpires = spentTouch + SESSION_TTL_SECONDS;
    const spentSubmissionExpires = spentTouch + SUBMISSION_TTL_SECONDS;

    expect(referencedSessionExpires).toBeLessThan(now);
    expect(liveSubmissionExpires).toBeGreaterThan(now);
    expect(spentSessionExpires).toBeLessThan(now);
    expect(spentSubmissionExpires).toBeLessThan(now);

    const db = openDatabase();
    databases.push(db);
    insertSession(db, 'session-referenced', referencedSessionExpires);
    insertSubmission(db, 'submission-live', 'session-referenced', liveSubmissionExpires);
    insertOutbox(db, 'submission-live');
    insertAudit(db, 'submission-live', 'session-referenced');

    insertSession(db, 'session-alone', referencedSessionExpires);

    insertSession(db, 'session-spent', spentSessionExpires);
    insertSubmission(db, 'submission-spent', 'session-spent', spentSubmissionExpires);
    insertOutbox(db, 'submission-spent');
    insertAudit(db, 'submission-spent', 'session-spent');

    insertSession(db, 'session-fresh', now + SESSION_TTL_SECONDS);
    insertSubmission(db, 'submission-fresh', 'session-fresh', now + SUBMISSION_TTL_SECONDS);
    insertOutbox(db, 'submission-fresh');
    insertAudit(db, 'submission-fresh', 'session-fresh');

    await expect(purgeExpiredData({ DB: asD1(db) } as Env)).resolves.toBeUndefined();

    // 識別子だけを見る。暗号文の列は読まない。
    expect(ids(db, 'sessions')).toEqual(['session-fresh', 'session-referenced']);
    expect(ids(db, 'submissions')).toEqual(['submission-fresh', 'submission-live']);
    expect(ids(db, 'outbox')).toEqual(['outbox-submission-fresh', 'outbox-submission-live']);
    expect(ids(db, 'audit')).toEqual(['audit-submission-fresh', 'audit-submission-live']);
  });

  it('参照していた送信が期限を迎えると、残していた会話も次の削除で消える', async () => {
    const now = Math.floor(Date.now() / 1000);
    const touch = now - (SESSION_TTL_SECONDS + DAY_SECONDS);
    const db = openDatabase();
    databases.push(db);
    insertSession(db, 'session-referenced', touch + SESSION_TTL_SECONDS);
    insertSubmission(db, 'submission-live', 'session-referenced', touch + SUBMISSION_TTL_SECONDS);
    insertOutbox(db, 'submission-live');
    insertAudit(db, 'submission-live', 'session-referenced');

    const env = { DB: asD1(db) } as Env;
    await purgeExpiredData(env);
    expect(ids(db, 'sessions')).toEqual(['session-referenced']);

    db.prepare('UPDATE submission_intake SET expires_at = ? WHERE submission_id = ?').run(now - 1, 'submission-live');
    await expect(purgeExpiredData(env)).resolves.toBeUndefined();

    expect(ids(db, 'sessions')).toEqual([]);
    expect(ids(db, 'submissions')).toEqual([]);
    expect(ids(db, 'outbox')).toEqual([]);
    expect(ids(db, 'audit')).toEqual([]);
  });
});
