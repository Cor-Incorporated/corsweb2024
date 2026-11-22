import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CHAT_DAILY_MODEL_CALL_LIMIT, chatDailyModelCallLimit, jstDay, reserveDailyModelCall } from '../daily-cap';
import worker from '../index';
import { resetRateLimits } from '../security';
import type { Env, NotificationMessage } from '../types';

// 1 日（JST の日付）に model を呼ぶ回数の上限。数は D1 の chat_daily_usage に置く。

afterEach(() => {
  resetRateLimits();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const MIGRATIONS_DIR = resolve(__dirname, '../../migrations');

function openDatabase(opts: { skip?: string } = {}): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const file of readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith('.sql')).sort()) {
    if (opts.skip && file.startsWith(opts.skip)) continue;
    db.exec(readFileSync(resolve(MIGRATIONS_DIR, file), 'utf8'));
  }
  return db;
}

function asD1(db: DatabaseSync): D1Database {
  const statement = (sql: string, bindings: SQLInputValue[]) => ({
    sql,
    bindings,
    async first<T>() {
      return (db.prepare(sql).get(...bindings) ?? null) as T;
    },
    async run() {
      return { meta: { changes: Number(db.prepare(sql).run(...bindings).changes) } };
    },
  });
  return {
    prepare: (sql: string) => ({ bind: (...bindings: SQLInputValue[]) => statement(sql, bindings) }),
    async batch(statements: Array<{ sql: string; bindings: SQLInputValue[] }>) {
      db.exec('BEGIN');
      try {
        for (const item of statements) db.prepare(item.sql).run(...item.bindings);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      return [];
    },
  } as unknown as D1Database;
}

/**
 * 同時の 2 要求を本当に重ねるための代役。chat_daily_usage に触る文は、もう 1 つが来るまで待ち、2 つそろったら
 * 来た順に流す（1 つしか来なければ 200ms で流す）。読む文と書く文を分けた作りなら、2 つの読む文が先にそろう。
 */
function asPairedD1(db: DatabaseSync): D1Database {
  let waiting: (() => void) | null = null;
  const gate = (sql: string) =>
    new Promise<void>((release) => {
      if (!sql.includes('chat_daily_usage')) {
        release();
        return;
      }
      if (waiting) {
        const first = waiting;
        waiting = null;
        first();
        release();
        return;
      }
      const done = () => {
        clearTimeout(timer);
        release();
      };
      const timer = setTimeout(() => {
        if (waiting === done) waiting = null;
        release();
      }, 200);
      waiting = done;
    });
  const statement = (sql: string, bindings: SQLInputValue[]) => ({
    sql,
    bindings,
    async first<T>() {
      await gate(sql);
      return (db.prepare(sql).get(...bindings) ?? null) as T;
    },
    async run() {
      await gate(sql);
      return { meta: { changes: Number(db.prepare(sql).run(...bindings).changes) } };
    },
  });
  return {
    prepare: (sql: string) => ({ bind: (...bindings: SQLInputValue[]) => statement(sql, bindings) }),
  } as unknown as D1Database;
}

function testEnv(db: DatabaseSync, limit?: string): Env {
  return {
    LLM_PROVIDER: 'vertex-gemini',
    VERTEX_GATEWAY_URL: 'https://gateway.example/generateContent',
    VERTEX_GATEWAY_SECRET: 'gateway-secret',
    ANTHROPIC_API_KEY: '',
    RESEND_API_KEY: 're_test',
    TURNSTILE_SECRET: '',
    CONTACT_TO_EMAIL: 'info@cor-jp.com',
    CONTACT_FROM_EMAIL: 'noreply@cor-jp.com',
    PII_ENCRYPTION_KEY: 'storage-secret',
    PII_HMAC_KEY: 'hmac-secret',
    DB: asD1(db),
    CONTACT_NOTIFICATIONS: { send: async (_message: NotificationMessage) => undefined },
    ...(limit === undefined ? {} : { CHAT_DAILY_MODEL_CALL_LIMIT: limit }),
  } as unknown as Env;
}

let ipCounter = 0;
function post(path: string, body: unknown): Request {
  ipCounter += 1;
  return new Request(`https://cor-jp.com${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://cor-jp.com',
      'cf-connecting-ip': `198.51.100.${ipCounter % 250}`,
    },
    body: JSON.stringify(body),
  });
}

const USER_TEXT = '業務の整理を相談したい';

/** model の代役。有料の API は呼ばない。呼ばれた回数を数える。 */
function stubModel() {
  const modelText = JSON.stringify({
    reply: '作業の種類を確認しました。時期の目安だけ教えてください。',
    summary: '業務の整理の相談',
    classification: 'genuine',
    readyForContact: false,
    structuredLead: { purpose: '業務の整理' },
  });
  const fetchMock = vi.fn(async (url: string) => {
    if (String(url).includes('generateContent')) {
      return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: modelText }] } }] }), { status: 200 });
    }
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return {
    calls: () => fetchMock.mock.calls.filter(([url]) => String(url).includes('generateContent')).length,
  };
}

type FetchWorker = { fetch: (request: Request, env: Env) => Promise<Response> };

async function chatTurn(env: Env, app: FetchWorker = worker as FetchWorker): Promise<Response> {
  const started = await app.fetch(post('/api/contact/chat/start', {
    start: true, event: 'intent_selected', intent: 'contract-dev', source: 'cloudia', locale: 'ja',
  }), env);
  const { sessionId } = await started.json() as { sessionId: string };
  return app.fetch(post('/api/contact/chat', {
    sessionId, intent: 'contract-dev', source: 'cloudia', locale: 'ja',
    messages: [{ role: 'user', content: USER_TEXT }],
  }), env);
}

function storedCalls(db: DatabaseSync, day: string): number {
  const row = db.prepare('SELECT model_calls FROM chat_daily_usage WHERE day = ?').get(day) as
    | { model_calls: number }
    | undefined;
  return row ? Number(row.model_calls) : 0;
}

function setStoredCalls(db: DatabaseSync, day: string, calls: number): void {
  db.prepare(
    `INSERT INTO chat_daily_usage (day, model_calls, updated_at) VALUES (?, ?, 0)
     ON CONFLICT(day) DO UPDATE SET model_calls = excluded.model_calls`,
  ).run(day, calls);
}

function fixClock(iso: string): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(iso));
}

const AI_UNAVAILABLE = 'AIが一時的に利用できません。時間をおいて再試行してください';

describe('1 日の model の呼び出しの上限', () => {
  it('上限の 1 つ下では model を 1 回呼び、その日の数が 1 増える', async () => {
    fixClock('2026-11-17T03:00:00.000Z');
    const db = openDatabase();
    setStoredCalls(db, '2026-11-17', 2);
    const model = stubModel();
    const response = await chatTurn(testEnv(db, '3'));
    expect(response.status).toBe(200);
    expect(model.calls()).toBe(1);
    expect(storedCalls(db, '2026-11-17')).toBe(3);
  });

  it('上限に達した日は、チャットの要求が来ても model を呼ばず、今の 503 を返す', async () => {
    fixClock('2026-11-17T03:00:00.000Z');
    const db = openDatabase();
    setStoredCalls(db, '2026-11-17', 3);
    const model = stubModel();
    const response = await chatTurn(testEnv(db, '3'));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: AI_UNAVAILABLE });
    expect(model.calls()).toBe(0);
  });

  it('その日の数が上限より大きい日（途中で上限を下げた日）は、model を呼ばず 503 で、数も増えない', async () => {
    fixClock('2026-11-17T03:00:00.000Z');
    const db = openDatabase();
    setStoredCalls(db, '2026-11-17', 5);
    const model = stubModel();
    const response = await chatTurn(testEnv(db, '3'));
    expect(response.status).toBe(503);
    expect(model.calls()).toBe(0);
    expect(storedCalls(db, '2026-11-17')).toBe(5);
  });

  it('形の悪い要求（400）と、回数の制限（429）で止まった要求は、その日の数を増やさない', async () => {
    fixClock('2026-11-17T03:00:00.000Z');
    const db = openDatabase();
    const model = stubModel();
    const env = testEnv(db, '100');
    const bad = await (worker as FetchWorker).fetch(post('/api/contact/chat', {
      intent: 'contract-dev', source: 'cloudia', locale: 'ja', messages: [],
    }), env);
    expect(bad.status).toBe(400);
    const sameIp = (path: string, body: unknown) => new Request(`https://cor-jp.com${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://cor-jp.com', 'cf-connecting-ip': '203.0.113.9' },
      body: JSON.stringify(body),
    });
    for (let i = 0; i < 20; i += 1) {
      const started = await (worker as FetchWorker).fetch(sameIp('/api/contact/chat/start', {
        start: true, event: 'intent_selected', intent: 'contract-dev', source: 'cloudia', locale: 'ja',
      }), env);
      expect(started.status).toBe(200);
    }
    const limited = await (worker as FetchWorker).fetch(sameIp('/api/contact/chat', {
      intent: 'contract-dev', source: 'cloudia', locale: 'ja', messages: [{ role: 'user', content: USER_TEXT }],
    }), env);
    expect(limited.status).toBe(429);
    expect(model.calls()).toBe(0);
    expect(storedCalls(db, '2026-11-17')).toBe(0);
  });

  it('上限で止めた要求は、その日の数を増やさない（数は model を呼んだ回数のまま）', async () => {
    fixClock('2026-11-17T03:00:00.000Z');
    const db = openDatabase();
    setStoredCalls(db, '2026-11-17', 3);
    stubModel();
    for (let i = 0; i < 3; i += 1) expect((await chatTurn(testEnv(db, '3'))).status).toBe(503);
    expect(storedCalls(db, '2026-11-17')).toBe(3);
  });

  it('上限の 1 つ手前で 2 つの要求が同時に来ても、model を呼ぶのは 1 回', async () => {
    fixClock('2026-11-17T03:00:00.000Z');
    const db = openDatabase();
    setStoredCalls(db, '2026-11-17', 2);
    const model = stubModel();
    const env = { ...testEnv(db, '3'), DB: asPairedD1(db) } as Env;
    const statuses = (await Promise.all([chatTurn(env), chatTurn(env)])).map((response) => response.status).sort();
    expect(statuses).toEqual([200, 503]);
    expect(model.calls()).toBe(1);
    expect(storedCalls(db, '2026-11-17')).toBe(3);
  });

  it('module を読み直した後（別の isolate の代わり）も、同じ D1 の数で止まる', async () => {
    fixClock('2026-11-17T03:00:00.000Z');
    const db = openDatabase();
    const model = stubModel();
    expect((await chatTurn(testEnv(db, '1'))).status).toBe(200);
    vi.resetModules();
    const fresh = (await import('../index')).default as FetchWorker;
    expect((await chatTurn(testEnv(db, '1'), fresh)).status).toBe(503);
    expect(model.calls()).toBe(1);
  });

  it('JST の日付で数える（23:59:59 と、次の日の 00:00:00 は別の日の数）', async () => {
    const db = openDatabase();
    const model = stubModel();
    const env = testEnv(db, '1');
    fixClock('2026-11-17T14:59:59.000Z'); // JST 2026-11-17 23:59:59
    expect((await chatTurn(env)).status).toBe(200);
    expect((await chatTurn(env)).status).toBe(503);
    vi.setSystemTime(new Date('2026-11-17T15:00:00.000Z')); // JST 2026-11-18 00:00:00
    expect((await chatTurn(env)).status).toBe(200);
    expect(model.calls()).toBe(2);
    expect(storedCalls(db, '2026-11-17')).toBe(1);
    expect(storedCalls(db, '2026-11-18')).toBe(1);
  });

  it('設定の値を変えると、当たる回数が変わる', async () => {
    fixClock('2026-11-17T03:00:00.000Z');
    for (const [limit, allowed] of [['1', 1], ['3', 3]] as const) {
      const db = openDatabase();
      const model = stubModel();
      const statuses: number[] = [];
      for (let i = 0; i < 4; i += 1) statuses.push((await chatTurn(testEnv(db, limit))).status);
      expect(statuses.filter((status) => status === 200)).toHaveLength(allowed);
      expect(model.calls()).toBe(allowed);
      vi.unstubAllGlobals();
    }
  });

  it('設定の値が 0 の日は、model を呼ばず、D1 にも書かない', async () => {
    fixClock('2026-11-17T03:00:00.000Z');
    const db = openDatabase();
    const model = stubModel();
    expect((await chatTurn(testEnv(db, '0'))).status).toBe(503);
    expect(model.calls()).toBe(0);
    expect(db.prepare('SELECT COUNT(*) AS n FROM chat_daily_usage').get()).toEqual({ n: 0 });
  });

  it('会話の始まり（start）は model を呼ばないので、数えない', async () => {
    fixClock('2026-11-17T03:00:00.000Z');
    const db = openDatabase();
    stubModel();
    const started = await (worker as FetchWorker).fetch(post('/api/contact/chat/start', {
      start: true, event: 'intent_selected', intent: 'contract-dev', source: 'cloudia', locale: 'ja',
    }), testEnv(db, '1'));
    expect(started.status).toBe(200);
    expect(storedCalls(db, '2026-11-17')).toBe(0);
  });

  it('数を置く表が無い D1（0006 を当てる前）では、model を呼ばず、今の 503 を返し、記録に印を 1 つ残す', async () => {
    fixClock('2026-11-17T03:00:00.000Z');
    const db = openDatabase({ skip: '0006_' });
    const model = stubModel();
    const lines: string[] = [];
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(' '));
    });
    const response = await chatTurn(testEnv(db, '3'));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: AI_UNAVAILABLE });
    expect(model.calls()).toBe(0);
    expect(lines).toEqual(['contact-chat:daily_cap_unavailable']);
  });

  it('model の呼び出しが失敗しても、予約した 1 は数に残る（呼んだ回数として数える）', async () => {
    fixClock('2026-11-17T03:00:00.000Z');
    const db = openDatabase();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('upstream error', { status: 500 })));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await chatTurn(testEnv(db, '3'));
    expect(response.status).toBe(503);
    expect(storedCalls(db, '2026-11-17')).toBe(1);
  });

  it('Vertex の途中終了は公開用の 503 を返し、予約を残して呼び直さない', async () => {
    fixClock('2026-11-17T03:00:00.000Z');
    const db = openDatabase();
    const fetchMock = vi.fn(async () => Response.json({
      candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"reply":"途中の応答' }] } }],
    }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await chatTurn(testEnv(db, '3'));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: AI_UNAVAILABLE, fallback: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(storedCalls(db, '2026-11-17')).toBe(1);
  });

  it('Anthropic の道でも、予約 1 つにつき model への HTTP の要求は 1 回だけ（失敗しても呼び直さない）', async () => {
    fixClock('2026-11-17T03:00:00.000Z');
    const db = openDatabase();
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'upstream' } }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const env = { ...testEnv(db, '3'), LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'test-key' } as Env;
    const response = await chatTurn(env);
    expect(response.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(storedCalls(db, '2026-11-17')).toBe(1);
  });

  it('D1 の binding が無い env では上限を掛けずに呼び、そのことを記録に 1 行残す（本文・IP・メールは出さない）', async () => {
    fixClock('2026-11-17T03:00:00.000Z');
    const db = openDatabase();
    const model = stubModel();
    const lines: string[] = [];
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(' '));
    });
    const { DB: _db, ...withoutDb } = testEnv(db, '0') as Env & { DB?: D1Database };
    const response = await chatTurn(withoutDb as Env);
    expect(response.status).toBe(200);
    expect(model.calls()).toBe(1);
    expect(lines).toEqual(['contact-chat:daily_cap_without_db']);
    expect(lines.join('\n')).not.toMatch(/業務の整理|198\.51\.100|@/);
  });

  it('上限に当たったことを記録に残す。記録に本文・IP・メールを出さない', async () => {
    fixClock('2026-11-17T03:00:00.000Z');
    const db = openDatabase();
    setStoredCalls(db, '2026-11-17', 1);
    stubModel();
    const lines: string[] = [];
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(' '));
    });
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(' '));
    });
    expect((await chatTurn(testEnv(db, '1'))).status).toBe(503);
    expect(lines).toContain('contact-chat:daily_cap_reached');
    expect(lines.join('\n')).not.toMatch(/業務の整理|198\.51\.100|@/);
  });
});

// LLM の設定が欠けた env では、1 日の上限の数を予約する前に止める（設定を直した後も、その日の数が残るように）。
describe('LLM の設定が無い env と 1 日の上限', () => {
  it.each([
    ['vertex-gemini で Gateway の URL が無い', { VERTEX_GATEWAY_URL: '' }],
    ['vertex-gemini で Gateway の秘密が無い', { VERTEX_GATEWAY_SECRET: '' }],
    ['vertex-gemini で Gateway の URL と秘密が空白だけ', { VERTEX_GATEWAY_URL: ' ', VERTEX_GATEWAY_SECRET: ' ' }],
    ['anthropic で鍵が無い', { LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: '' }],
    ['anthropic で鍵が空白だけ', { LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: ' \t' }],
  ])('%s: 503 で、その日の数は増えず、記録は llm_not_configured の 1 行、model への HTTP は 0', async (_label, overrides) => {
    fixClock('2026-11-17T03:00:00.000Z');
    const db = openDatabase();
    const model = stubModel();
    const lines: string[] = [];
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(' '));
    });
    const env = { ...testEnv(db, '3'), ...overrides } as Env;

    const response = await chatTurn(env);

    expect(response.status).toBe(503);
    expect((await response.json() as { error: string }).error).toBe(AI_UNAVAILABLE);
    expect(storedCalls(db, '2026-11-17')).toBe(0);
    expect(lines).toEqual(['contact-chat:llm_not_configured']);
    expect(model.calls()).toBe(0);
  });

  it('設定を直した後は、同じ日に model を呼べる（欠けていた間の要求で数を使っていない）', async () => {
    fixClock('2026-11-17T03:00:00.000Z');
    const db = openDatabase();
    const model = stubModel();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const missing = { ...testEnv(db, '1'), VERTEX_GATEWAY_SECRET: '' } as Env;
    expect((await chatTurn(missing)).status).toBe(503);
    expect((await chatTurn(missing)).status).toBe(503);

    expect((await chatTurn(testEnv(db, '1'))).status).toBe(200);
    expect(storedCalls(db, '2026-11-17')).toBe(1);
    expect(model.calls()).toBe(1);
  });
});

// 上限は D1 の binding（DB）が在る env で掛かる。本番と preview の設定に DB と、本番に上限の値が在ることを固定する。
describe('wrangler.toml の上限の設定', () => {
  const toml = readFileSync(resolve(__dirname, '../../wrangler.toml'), 'utf8');
  const section = (header: string): string => {
    const start = toml.indexOf(`${header}\n`);
    if (start < 0) throw new Error(`wrangler.toml に ${header} が無い`);
    const rest = toml.slice(start + header.length + 1);
    const next = rest.search(/^\[/m);
    return next < 0 ? rest : rest.slice(0, next);
  };

  it.each([
    ['本番（最上位）', '[[d1_databases]]'],
    ['preview', '[[env.preview.d1_databases]]'],
  ])('%s に D1 の binding DB が在る', (env, header) => {
    const found = toml.includes(`${header}\n`) && /^binding = "DB"$/m.test(section(header));
    expect(found, `wrangler.toml の ${env}（${header}）に binding = "DB" が無い`).toBe(true);
  });

  it.each([
    ['本番（最上位）', '[vars]'],
    ['preview', '[env.preview.vars]'],
  ])('%s の vars の上限の値は、上限として読める数', (env, header) => {
    const match = section(header).match(/^CHAT_DAILY_MODEL_CALL_LIMIT = "([^"]*)"$/m);
    expect(match, `wrangler.toml の ${env}（${header}）に CHAT_DAILY_MODEL_CALL_LIMIT が無い`).not.toBeNull();
    expect(match?.[1], `wrangler.toml の ${env} の CHAT_DAILY_MODEL_CALL_LIMIT が整数でない`).toMatch(/^\d+$/);
    expect(chatDailyModelCallLimit(match?.[1])).toBe(Number(match?.[1]));
  });
});

// 予約できたかは、書いた行の数（meta.changes）で読む。数が読めない結果は、予約できなかった側に倒す。
describe('予約の結果の読み方', () => {
  const answering = (result: unknown): D1Database =>
    ({
      prepare: () => ({ bind: () => ({ run: async () => result }) }),
    }) as unknown as D1Database;

  it.each([
    ['meta が無い', {}],
    ['meta が無く success だけの', { success: true }],
    ['meta に changes が無い', { success: true, meta: {} }],
    ['changes が 0 の', { success: true, meta: { changes: 0 } }],
  ])('%s結果は、上限（limited）と読む', async (_label, result) => {
    expect(await reserveDailyModelCall(answering(result), 3, Date.parse('2026-11-17T03:00:00.000Z'))).toBe('limited');
  });

  it('changes が 1 の結果は、予約できた（reserved）と読む', async () => {
    const result = { success: true, meta: { changes: 1 } };
    expect(await reserveDailyModelCall(answering(result), 3, Date.parse('2026-11-17T03:00:00.000Z'))).toBe('reserved');
  });
});

describe('上限の設定の値と日付', () => {
  it('既定の値は 1 日 300 回', () => {
    expect(DEFAULT_CHAT_DAILY_MODEL_CALL_LIMIT).toBe(300);
  });

  it('整数として安全に扱えないほど大きい値は、既定の値にする', () => {
    expect(chatDailyModelCallLimit('99999999999999999999')).toBe(300);
  });

  it.each([
    [undefined, DEFAULT_CHAT_DAILY_MODEL_CALL_LIMIT],
    ['', DEFAULT_CHAT_DAILY_MODEL_CALL_LIMIT],
    ['abc', DEFAULT_CHAT_DAILY_MODEL_CALL_LIMIT],
    ['-1', DEFAULT_CHAT_DAILY_MODEL_CALL_LIMIT],
    ['1.5', DEFAULT_CHAT_DAILY_MODEL_CALL_LIMIT],
    ['0', 0],
    ['25', 25],
    [' 40 ', 40],
  ])('設定の値 %j は %d 回', (raw, expected) => {
    expect(chatDailyModelCallLimit(raw)).toBe(expected);
  });

  it.each([
    ['2026-11-16T15:00:00.000Z', '2026-11-17'],
    ['2026-11-17T14:59:59.999Z', '2026-11-17'],
    ['2026-11-17T15:00:00.000Z', '2026-11-18'],
  ])('%s は JST の %s', (iso, day) => {
    expect(jstDay(Date.parse(iso))).toBe(day);
  });
});
