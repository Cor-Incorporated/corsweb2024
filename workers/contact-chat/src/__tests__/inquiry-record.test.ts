import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { INDUSTRY_SLUGS as SITE_INDUSTRY_SLUGS, industrySlugFromPath } from '../../../../src/config/industry-context';
import { buildInquiryCaseCopy } from '../case-copy';
import { INDUSTRY_SLUGS } from '../industry-context';
import { INQUIRY_CLASSIFICATION_VERSION } from '../inquiry-classification';
import { industryPagePath } from '../inquiry-context';
import worker from '../index';
import { resetRateLimits } from '../security';
import { getInquiryCaseCopySource } from '../storage';
import type { Env, NotificationMessage } from '../types';

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

/** 2 往復目の応答を返す代役。有料の API は呼ばない。 */
function stubModel(modelText: string) {
  const fetchMock = vi.fn(async (url: string) => {
    if (String(url).includes('generateContent')) {
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: modelText }] } }] }), { status: 200 });
    }
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function modelJson(classification: unknown): string {
  return JSON.stringify({
    reply: '作業の種類を確認しました。時期の目安だけ教えてください。',
    summary: '業務の整理の相談',
    classification,
    readyForContact: false,
    structuredLead: { purpose: '業務の整理' },
  });
}

function testEnv(db: DatabaseSync): Env {
  const sent: NotificationMessage[] = [];
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
    CONTACT_NOTIFICATIONS: { send: async (message: NotificationMessage) => { sent.push(message); } },
  } as unknown as Env;
}

interface InquiryRow {
  receipt_id: string;
  industry: string;
  entry_path: string;
  machine_classification: string;
  classification_reason: string;
  classification_origin: string;
  classification_version: string;
  classification: string;
}

/** 画面と同じ順で start → chat → submit を流し、保存した行と 2 往復目の指示を返す。 */
async function runInquiry(env: Env, db: DatabaseSync, opts: {
  source: string;
  submitSource?: string;
  modelText: string;
  submitExtra?: Record<string, unknown>;
}) {
  const fetchMock = stubModel(opts.modelText);
  const started = await worker.fetch(post('/api/contact/chat/start', {
    start: true, event: 'intent_selected', intent: 'contract-dev', source: opts.source, locale: 'ja',
  }), env);
  const { sessionId } = await started.json() as { sessionId: string };
  const chatted = await worker.fetch(post('/api/contact/chat', {
    sessionId, intent: 'contract-dev', source: opts.source, locale: 'ja',
    messages: [{ role: 'user', content: '業務の整理を相談したい' }],
  }), env);
  expect(chatted.status).toBe(200);
  const gatewayCall = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  const system = JSON.parse(String(gatewayCall[1].body)).systemInstruction.parts[0].text as string;
  const submitted = await worker.fetch(post('/api/contact/submit', {
    sessionId, name: '山田太郎', email: 'taro@example.com', message: '相談です',
    intent: 'contract-dev', source: opts.submitSource ?? opts.source, ...opts.submitExtra,
  }), env);
  expect(submitted.status).toBe(200);
  const { receiptId } = await submitted.json() as { receiptId: string };
  const row = db.prepare(`SELECT receipt_id, industry, entry_path, machine_classification, classification_reason,
    classification_origin, classification_version, classification FROM submission_intake WHERE receipt_id = ?`)
    .get(receiptId) as unknown as InquiryRow;
  return { system, row, receiptId };
}

describe('業種の一覧は、サイトの業種の一覧と同じ', () => {
  it('Worker の業種の値と、サイトの業種の値が一致し、業種のページの path をサイトが同じ業種と読む', () => {
    expect([...INDUSTRY_SLUGS]).toEqual([...SITE_INDUSTRY_SLUGS]);
    for (const slug of INDUSTRY_SLUGS) {
      expect(industrySlugFromPath(industryPagePath(slug))).toBe(slug);
    }
  });
});

describe.each(INDUSTRY_SLUGS)('業種のページからの問い合わせ（%s）', (slug) => {
  it('2 往復目の指示に業種の行が入り、受付の記録に業種・path・分類・受付の番号が残る', async () => {
    const db = openDatabase();
    const { system, row } = await runInquiry(testEnv(db), db, {
      source: `industry-${slug}`,
      modelText: modelJson('genuine'),
    });
    expect(system).toContain(`Industry context is the trusted enum industry-${slug} only.`);
    expect(row.receipt_id).toMatch(/^COR-/);
    expect(row.industry).toBe(slug);
    expect(row.entry_path).toBe(`/industries/${slug}/`);
    expect(row.machine_classification).toBe('consult');
    expect(row.classification_reason).toBe('model_genuine');
    expect(row.classification_origin).toBe('model');
    expect(row.classification_version).toBe(INQUIRY_CLASSIFICATION_VERSION);
  });
});

describe('受付の分類はサーバーが決め、ブラウザの値で変わらない', () => {
  it('営業と判定した問い合わせは、相談と別の分類で保存し、submit で送った分類や source では変わらない', async () => {
    const db = openDatabase();
    const { row } = await runInquiry(testEnv(db), db, {
      source: 'industry-medical',
      submitSource: 'industry-education',
      modelText: modelJson('sales'),
      submitExtra: { classification: 'genuine', industry: 'education', entryPath: '/evil/' },
    });
    expect(row.machine_classification).toBe('sales');
    expect(row.classification_reason).toBe('model_sales');
    expect(row.classification).toBe('sales');
    expect(row.industry).toBe('medical');
    expect(row.entry_path).toBe('/industries/medical/');
  });

  it.each([
    ['解析できない応答', 'not json at all', 'model_unparsed', 'fallback'],
    ['未知の分類の値', modelJson('lead'), 'model_unparsed', 'fallback'],
    ['spam の判定', modelJson('spam'), 'model_spam', 'model'],
  ])('%s は相談に倒さず unknown にする', async (_label, modelText, reason, origin) => {
    const db = openDatabase();
    const { row } = await runInquiry(testEnv(db), db, { source: 'industry-shigyo', modelText });
    expect(row.machine_classification).toBe('unknown');
    expect(row.classification_reason).toBe(reason);
    expect(row.classification_origin).toBe(origin);
  });

  it('会話の途中で source が変わっても、最初の業種と path を保つ', async () => {
    const db = openDatabase();
    const env = testEnv(db);
    stubModel(modelJson('genuine'));
    const started = await worker.fetch(post('/api/contact/chat/start', {
      start: true, intent: 'contract-dev', source: 'industry-construction', locale: 'ja',
    }), env);
    const { sessionId } = await started.json() as { sessionId: string };
    await worker.fetch(post('/api/contact/chat', {
      sessionId, intent: 'contract-dev', source: 'industry-education', locale: 'ja',
      messages: [{ role: 'user', content: '相談です' }],
    }), env);
    const session = db.prepare('SELECT industry, entry_path FROM contact_sessions WHERE session_id = ?')
      .get(sessionId) as { industry: string; entry_path: string };
    expect(session).toEqual({ industry: 'construction', entry_path: '/industries/construction/' });
  });

  it('会話が見つからない submit は、業種なし・unknown（no_session）で受け付ける', async () => {
    const db = openDatabase();
    const response = await worker.fetch(post('/api/contact/submit', {
      sessionId: 'missing-session', name: '山田太郎', email: 'taro@example.com', message: '相談です',
      intent: 'contract-dev', source: 'industry-medical', classification: 'sales',
    }), testEnv(db));
    expect(response.status).toBe(200);
    const row = db.prepare('SELECT industry, entry_path, machine_classification, classification_reason FROM submission_intake')
      .get() as Record<string, string>;
    expect(row).toEqual({ industry: '', entry_path: '', machine_classification: 'unknown', classification_reason: 'no_session' });
  });
});

const CASE_COPY_FIELDS = ['receiptId', 'industry', 'entryPath', 'classification', 'classificationVersion', 'createdAt'];
const PII_LIKE = /name|mail|phone|tel|company|message|summary|excerpt|body|text|cipher|hmac/i;

describe('案件へ渡す写し', () => {
  it('写しの欄は 6 つだけで、個人情報の欄は 0', async () => {
    const db = openDatabase();
    const env = testEnv(db);
    const { receiptId } = await runInquiry(env, db, { source: 'industry-manufacturing', modelText: modelJson('genuine') });
    const source = await getInquiryCaseCopySource(env, receiptId);
    expect(source).not.toBeNull();
    const copy = buildInquiryCaseCopy(source!);
    expect(Object.keys(copy)).toEqual(CASE_COPY_FIELDS);
    expect(Object.keys(copy).filter((key) => PII_LIKE.test(key))).toEqual([]);
    expect(Object.keys(source!).filter((key) => PII_LIKE.test(key))).toEqual([]);
    expect(copy).toMatchObject({
      receiptId,
      industry: 'manufacturing',
      entryPath: '/industries/manufacturing/',
      classification: 'consult',
      classificationVersion: INQUIRY_CLASSIFICATION_VERSION,
    });
    // 作った時刻は、保存した created_at（秒）と同じ時刻の ISO の文字列。秒をミリ秒に直さないと 1970 年になる。
    const stored = db.prepare('SELECT created_at FROM submission_intake WHERE receipt_id = ?').get(receiptId) as { created_at: number };
    expect(copy.createdAt).toBe(new Date(stored.created_at * 1000).toISOString());
    expect(Math.abs(Date.parse(copy.createdAt) - Date.now())).toBeLessThan(5 * 60 * 1000);
    expect(JSON.stringify(copy)).not.toContain('taro@example.com');
    expect(JSON.stringify(copy)).not.toContain('山田');
  });

  it('写しを作る file は送る口を持たない（fetch・binding・Queue を使わない）', () => {
    const code = readFileSync(resolve(__dirname, '../case-copy.ts'), 'utf8');
    expect(code).not.toMatch(/\bfetch\s*\(|\.send\s*\(|env\.|Queue|binding/);
  });
});

async function startSession(env: Env, source: string, sessionId?: string): Promise<string> {
  const started = await worker.fetch(post('/api/contact/chat/start', {
    start: true, intent: 'contract-dev', source, locale: 'ja', ...(sessionId ? { sessionId } : {}),
  }), env);
  expect(started.status).toBe(200);
  return (await started.json() as { sessionId: string }).sessionId;
}

async function chatOnce(env: Env, sessionId: string, source: string, modelText: string): Promise<void> {
  stubModel(modelText);
  const chatted = await worker.fetch(post('/api/contact/chat', {
    sessionId, intent: 'contract-dev', source, locale: 'ja',
    messages: [{ role: 'user', content: '相談です' }],
  }), env);
  expect(chatted.status).toBe(200);
}

async function submitOnce(env: Env, sessionId: string, source: string, extra: Record<string, unknown> = {}) {
  const submitted = await worker.fetch(post('/api/contact/submit', {
    sessionId, name: '山田太郎', email: 'taro@example.com', message: '相談です', intent: 'contract-dev', source, ...extra,
  }), env);
  return submitted;
}

function submissionRow(db: DatabaseSync): InquiryRow & { source: string } {
  return db.prepare(`SELECT receipt_id, source, industry, entry_path, machine_classification, classification_reason,
    classification_origin, classification_version, classification FROM submission_intake`).get() as unknown as InquiryRow & { source: string };
}

describe('会話の分類は、モデルの判定でない値で上書きしない', () => {
  it('start → chat(sales) → start → submit で sales が残る（旧い列も）', async () => {
    const db = openDatabase();
    const env = testEnv(db);
    const sessionId = await startSession(env, 'industry-medical');
    await chatOnce(env, sessionId, 'industry-medical', modelJson('sales'));
    await startSession(env, 'industry-medical', sessionId);
    expect((await submitOnce(env, sessionId, 'industry-medical', { classification: 'genuine' })).status).toBe(200);
    const row = submissionRow(db);
    expect(row).toMatchObject({ machine_classification: 'sales', classification_reason: 'model_sales', classification_origin: 'model', classification: 'sales' });
  });

  it('chat(sales) → chat(解析できない応答) → submit で sales が残る', async () => {
    const db = openDatabase();
    const env = testEnv(db);
    const sessionId = await startSession(env, 'industry-shigyo');
    await chatOnce(env, sessionId, 'industry-shigyo', modelJson('sales'));
    await chatOnce(env, sessionId, 'industry-shigyo', 'not json at all');
    expect((await submitOnce(env, sessionId, 'industry-shigyo')).status).toBe(200);
    expect(submissionRow(db)).toMatchObject({ machine_classification: 'sales', classification_reason: 'model_sales', classification: 'sales' });
  });

  it('モデルの有効な判定どうしは後の値を使う（sales → genuine）', async () => {
    const db = openDatabase();
    const env = testEnv(db);
    const sessionId = await startSession(env, 'industry-education');
    await chatOnce(env, sessionId, 'industry-education', modelJson('sales'));
    await chatOnce(env, sessionId, 'industry-education', modelJson('genuine'));
    expect((await submitOnce(env, sessionId, 'industry-education')).status).toBe(200);
    expect(submissionRow(db)).toMatchObject({ machine_classification: 'consult', classification_reason: 'model_genuine', classification: 'genuine' });
  });

  it('start だけの会話の submit は unknown（no_model_turn）で受け付ける', async () => {
    const db = openDatabase();
    const env = testEnv(db);
    const sessionId = await startSession(env, 'industry-construction');
    expect((await submitOnce(env, sessionId, 'industry-construction', { classification: 'genuine' })).status).toBe(200);
    expect(submissionRow(db)).toMatchObject({
      industry: 'construction', machine_classification: 'unknown', classification_reason: 'no_model_turn', classification_origin: 'fallback',
    });
  });
});

describe('業種は、会話で最初に来た空でない業種の値を採り、その後は変えない', () => {
  it('業種でない入口で始めた会話は、後の業種の source で業種を採り、その後に別の業種を送っても変わらない', async () => {
    const db = openDatabase();
    const env = testEnv(db);
    const sessionId = await startSession(env, 'corsweb-launcher');
    const session = () => db.prepare('SELECT industry, entry_path FROM contact_sessions WHERE session_id = ?').get(sessionId);
    expect(session()).toEqual({ industry: '', entry_path: '' });
    await chatOnce(env, sessionId, 'industry-education', modelJson('genuine'));
    expect(session()).toEqual({ industry: 'education', entry_path: '/industries/education/' });
    await chatOnce(env, sessionId, 'industry-medical', modelJson('genuine'));
    expect(session()).toEqual({ industry: 'education', entry_path: '/industries/education/' });
    expect((await submitOnce(env, sessionId, 'corsweb-launcher')).status).toBe(200);
    // source の列は最後の要求の入口、industry と entry_path は最初の業種の入口。
    expect(submissionRow(db)).toMatchObject({ source: 'corsweb-launcher', industry: 'education', entry_path: '/industries/education/' });
  });

  it.each(['corsweb-launcher', 'corsweb-contact-primary', 'corsweb-launcher-fallback', 'cloudia'])(
    '業種でない入口（%s）だけの会話は、業種も path も空',
    async (source) => {
      const db = openDatabase();
      const env = testEnv(db);
      const sessionId = await startSession(env, source);
      await chatOnce(env, sessionId, source, modelJson('genuine'));
      expect((await submitOnce(env, sessionId, source)).status).toBe(200);
      expect(submissionRow(db)).toMatchObject({ industry: '', entry_path: '' });
    },
  );
});

describe('保存した行の読み戻しは、壊れた値を写しに入れない', () => {
  async function storedReceipt(db: DatabaseSync, env: Env): Promise<string> {
    const { receiptId } = await runInquiry(env, db, { source: 'industry-medical', modelText: modelJson('sales') });
    return receiptId;
  }

  it.each([
    ['業種と合わない path', { entry_path: '/evil/' }, { industry: 'medical', entryPath: '' }],
    ['知らない業種', { industry: 'evil', entry_path: '/industries/evil/' }, { industry: '', entryPath: '' }],
    ['版の違う分類', { classification_version: 'inquiry-classification-v0' }, { classification: 'unknown' }],
    ['知らない分類', { machine_classification: 'vip' }, { classification: 'unknown' }],
  ] as const)('%s', async (_label, broken, expected) => {
    const db = openDatabase();
    const env = testEnv(db);
    const receiptId = await storedReceipt(db, env);
    const [column, value] = Object.entries(broken)[0];
    for (const [key, val] of Object.entries(broken)) {
      db.prepare(`UPDATE submission_intake SET ${key} = ? WHERE receipt_id = ?`).run(val, receiptId);
    }
    expect(column).toBeTruthy();
    expect(value).toBeTruthy();
    const copy = buildInquiryCaseCopy((await getInquiryCaseCopySource(env, receiptId))!);
    expect(copy).toMatchObject(expected);
  });

  it('写しの元は、決めた 8 列だけを読む（ブラウザ由来の列も個人情報の列も読まない）', async () => {
    const db = openDatabase();
    const env = testEnv(db);
    const receiptId = await storedReceipt(db, env);
    const source = await getInquiryCaseCopySource(env, receiptId);
    expect(Object.keys(source ?? {})).toEqual([
      'receipt_id', 'industry', 'entry_path', 'machine_classification',
      'classification_reason', 'classification_origin', 'classification_version', 'created_at',
    ]);
  });
});

describe('migration を当てる前の D1 では、submit も 503 にそろえる', () => {
  it('会話の行が在っても、新しい列が無ければ 503', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    const dir = resolve(__dirname, '../../migrations');
    for (const file of readdirSync(dir).filter((name) => name.endsWith('.sql') && name < '0005').sort()) {
      db.exec(readFileSync(resolve(dir, file), 'utf8'));
    }
    db.prepare(`INSERT INTO contact_sessions (session_id, created_at, updated_at, expires_at) VALUES ('s-old', 0, 0, 9999999999)`).run();
    const response = await submitOnce(testEnv(db), 's-old', 'industry-medical');
    expect(response.status).toBe(503);
  });
});
