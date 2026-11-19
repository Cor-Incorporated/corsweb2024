// 資料請求の通知の試験で共有する道具。実メール・実 D1・実 Queue は使わない。
// 送信器は global fetch を差し替えた記録用で、ネットワークには出ない。
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { vi } from 'vitest';
import worker from '../index';
import type { Env, NotificationMessage } from '../types';

export const SECRET = 'storage-secret';
export const HMAC = 'hmac-secret';

export function openDatabase(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const migrationsDir = resolve(__dirname, '../../migrations');
  const files = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort();
  for (const file of files) db.exec(readFileSync(resolve(migrationsDir, file), 'utf8'));
  return db;
}

export function asD1(db: DatabaseSync): D1Database {
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
            async all<T>() {
              return { results: db.prepare(sql).all(...bindings) as T[] };
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

export interface QueueRecorder {
  sent: NotificationMessage[];
  /** true の間、send が失敗する（Queue の障害を作る）。 */
  failing: boolean;
}

export function envFor(
  db: DatabaseSync,
  extra: Record<string, unknown> = {},
): { env: Env; queue: QueueRecorder } {
  const queue: QueueRecorder = { sent: [], failing: false };
  const env = {
    LLM_PROVIDER: 'vertex-gemini',
    ANTHROPIC_API_KEY: '',
    RESEND_API_KEY: '',
    TURNSTILE_SECRET: '',
    CONTACT_TO_EMAIL: 'info@cor-jp.com',
    CONTACT_CC_EMAILS: 'cc1@cor-jp.com,cc2@cor-jp.com',
    CONTACT_FROM_EMAIL: 'noreply@cor-jp.com',
    PII_ENCRYPTION_KEY: SECRET,
    PII_HMAC_KEY: HMAC,
    DB: asD1(db),
    CONTACT_NOTIFICATIONS: {
      send: async (message: NotificationMessage) => {
        if (queue.failing) throw new Error('queue down');
        queue.sent.push(message);
      },
    },
    ...extra,
  } as unknown as Env;
  return { env, queue };
}

export const post = (body: unknown, ip = '198.51.100.60') =>
  new Request('https://cor-jp.com/api/contact/document-request', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://cor-jp.com',
      'cf-connecting-ip': ip,
    },
    body: JSON.stringify(body),
  });

export const valid = {
  name: '山田太郎',
  email: 'taro@example.com',
  company: '例株式会社',
  industry: 'medical',
  consent: true,
  website: '',
  locale: 'ja',
};

export interface ResendCall {
  to: string;
  cc?: string[];
  reply_to?: string;
  subject: string;
  text: string;
  from: string;
}

/** Resend の API を呼ぶ fetch の記録用の代役。status が 2xx 以外なら失敗を返す。 */
export function stubResend(status = 200): { calls: ResendCall[]; setStatus(next: number): void } {
  const calls: ResendCall[] = [];
  let current = status;
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (current < 200 || current >= 300) return new Response('nope', { status: current });
    calls.push(JSON.parse(String(init?.body)) as ResendCall);
    return new Response(JSON.stringify({ id: `re_test_${calls.length}` }), { status: 200 });
  }));
  return { calls, setStatus: (next) => { current = next; } };
}

export interface Delivery {
  acked: number;
  retried: number;
}

/** Queue の 1 通を consumer へ渡す。retry は呼ばれた数を返す。 */
export async function deliver(env: Env, message: NotificationMessage): Promise<Delivery> {
  const result: Delivery = { acked: 0, retried: 0 };
  await worker.queue({
    messages: [{
      body: message,
      ack() { result.acked += 1; },
      retry() { result.retried += 1; },
    }],
  } as unknown as MessageBatch<NotificationMessage>, env);
  return result;
}

export async function runCron(env: Env): Promise<void> {
  await worker.scheduled({} as ScheduledEvent, env);
}

export function row<T>(db: DatabaseSync, sql: string): T {
  return db.prepare(sql).get() as T;
}
