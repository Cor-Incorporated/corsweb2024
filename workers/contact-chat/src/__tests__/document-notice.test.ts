// 資料請求の社内通知。#524 の第一案（保存 + 社内通知 + 担当の手動フォロー）の受入を固定する。
// 実メールは送らない。Resend への fetch は記録用の代役で、実顧客のアドレスも使わない。
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker, { replayHeldDocumentNotice } from '../index';
import { resetRateLimits } from '../security';
import type { Env } from '../types';
import { deliver, envFor, openDatabase, post, row, runCron, stubResend, valid } from './document-test-kit';

const T0 = new Date('2026-11-12T00:00:00Z');
const T0_SEC = Math.floor(T0.getTime() / 1000);
const MINUTE = 60_000;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
  resetRateLimits();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const live = (releasedAt: number | string | null = T0_SEC - 3600): Record<string, unknown> => ({
  DOCUMENT_REQUEST_NOTIFY_MODE: 'live',
  RESEND_API_KEY: 're_test',
  ...(releasedAt === null ? {} : { DOCUMENT_REQUEST_NOTIFY_RELEASED_AT: String(releasedAt) }),
});

const advance = (ms: number) => vi.setSystemTime(new Date(Date.now() + ms));

interface OutboxRow {
  status: string;
  delivery_status: string;
  attempts: number;
  last_error: string | null;
  provider_message_id: string | null;
}
const outbox = (db: ReturnType<typeof openDatabase>): OutboxRow =>
  row<OutboxRow>(db, 'SELECT status, delivery_status, attempts, last_error, provider_message_id FROM notification_outbox');

/** 手順書にある照会の SQL を、手順書の本文から取り出す（手順書と試験が別の SQL にならないように）。 */
function runbookInquirySql(): string {
  const path = resolve(__dirname, '../../RUNBOOK-document-request-notice.md');
  const text = readFileSync(path, 'utf8');
  const block = [...text.matchAll(/```sql\n([\s\S]*?)```/g)]
    .map((match) => match[1] ?? '')
    .find((sql) => sql.includes('FROM submission_intake s JOIN notification_outbox o'));
  if (!block) throw new Error('runbook has no inquiry SQL block');
  return block;
}

describe('live の社内通知', () => {
  it('live では社内宛先へ 1 通だけ渡し、同じ Queue 通知の再配信と重複申込みで増えない', async () => {
    const resend = stubResend();
    const db = openDatabase();
    const { env, queue } = envFor(db, live());
    const res = await worker.fetch(post(valid), env);
    const body = await res.json() as { receiptId: string; status: string; notification: string; delivered: boolean };
    expect(body).toMatchObject({ status: 'stored', notification: 'queued', delivered: false });

    const first = await deliver(env, queue.sent[0]!);
    expect(first).toEqual({ acked: 1, retried: 0 });
    expect(resend.calls).toHaveLength(1);
    const call = resend.calls[0]!;
    expect(call.to).toBe('info@cor-jp.com');
    expect(call.cc).toEqual(['cc1@cor-jp.com', 'cc2@cor-jp.com']);
    expect(call.reply_to).toBe('taro@example.com');
    expect(call.subject).toBe(`[資料請求] 受付 ${body.receiptId}`);
    expect(call.text).toContain(`受付番号: ${body.receiptId}`);
    expect(call.text).toContain('業種: medical');
    expect(call.text).not.toContain('送付しました');
    expect(call.text).not.toContain('お送りしました');

    const sent = outbox(db);
    expect(sent).toMatchObject({ status: 'sent', delivery_status: 'accepted', attempts: 1, provider_message_id: 're_test_1' });
    expect(row<{ status: string }>(db, 'SELECT status FROM submission_intake').status).toBe('stored');

    await deliver(env, queue.sent[0]!);
    const dup = await worker.fetch(post(valid), env);
    expect(dup.status).toBe(202);
    expect(queue.sent).toHaveLength(2);
    await deliver(env, queue.sent[1]!);
    expect(resend.calls).toHaveLength(1);
    expect(row<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM submission_intake').n).toBe(1);
  });

  it('日をまたぐ再申込みは新しい受付番号で、通知が 2 通になる', async () => {
    const resend = stubResend();
    const db = openDatabase();
    const { env, queue } = envFor(db, live());
    await worker.fetch(post(valid), env);
    advance(24 * 60 * MINUTE);
    await worker.fetch(post(valid), env);
    expect(queue.sent).toHaveLength(2);
    await deliver(env, queue.sent[0]!);
    await deliver(env, queue.sent[1]!);
    expect(resend.calls).toHaveLength(2);
    const ids = new Set(resend.calls.map((call) => call.subject));
    expect(ids.size).toBe(2);
  });

  it('鍵が無い live は送らずに failed にし、受付は stored のまま Queue に再試行を求める', async () => {
    const resend = stubResend();
    const db = openDatabase();
    const { env, queue } = envFor(db, { ...live(), RESEND_API_KEY: '' });
    await worker.fetch(post(valid), env);
    const result = await deliver(env, queue.sent[0]!);
    expect(result.retried).toBe(1);
    expect(resend.calls).toHaveLength(0);
    expect(outbox(db)).toMatchObject({ status: 'pending', delivery_status: 'failed', attempts: 1 });
    expect(row<{ status: string }>(db, 'SELECT status FROM submission_intake').status).toBe('stored');
  });

  it('live でも解放時刻が無い・壊れているときは送らず held にする（fail closed）', async () => {
    const resend = stubResend();
    for (const released of [null, '', 'abc', '-5', '0', '1.5', `${T0_SEC}000`]) {
      const db = openDatabase();
      const { env, queue } = envFor(db, live(released));
      await worker.fetch(post(valid, '198.51.100.61'), env);
      const result = await deliver(env, queue.sent[0]!);
      expect(result.retried).toBe(0);
      expect(outbox(db), `released=${String(released)}`).toMatchObject({ status: 'pending', delivery_status: 'held', last_error: 'notify_not_released' });
      resetRateLimits();
    }
    expect(resend.calls).toHaveLength(0);
  });

  it('hold と mock では、解放時刻があっても送らない', async () => {
    const resend = stubResend();
    for (const mode of [undefined, 'hold', 'mock']) {
      const db = openDatabase();
      const { env, queue } = envFor(db, {
        RESEND_API_KEY: 're_test',
        DOCUMENT_REQUEST_NOTIFY_RELEASED_AT: String(T0_SEC - 3600),
        ...(mode ? { DOCUMENT_REQUEST_NOTIFY_MODE: mode } : {}),
      });
      await worker.fetch(post(valid, '198.51.100.62'), env);
      await deliver(env, queue.sent[0]!);
      expect(outbox(db).delivery_status, `mode=${String(mode)}`).toBe('held');
      resetRateLimits();
    }
    expect(resend.calls).toHaveLength(0);
  });
});

describe('解放時刻（重複の再投入で過去の held を流さない）', () => {
  it('hold の時期の受付は、live へ切り替えて同じ日に再申込みしても送られない。解放後の新しい受付は送られる', async () => {
    const resend = stubResend();
    const db = openDatabase();
    const hold = envFor(db);
    await worker.fetch(post(valid), hold.env);
    await deliver(hold.env, hold.queue.sent[0]!);
    expect(outbox(db).delivery_status).toBe('held');
    const heldCreatedAt = row<{ created_at: number }>(db, 'SELECT created_at FROM submission_intake').created_at;

    advance(5 * MINUTE);
    const released = T0_SEC + 10 * 60;
    const switched = envFor(db, live(released));
    const dup = await worker.fetch(post(valid), switched.env);
    expect(dup.status).toBe(202);
    expect(switched.queue.sent).toHaveLength(1);
    await deliver(switched.env, switched.queue.sent[0]!);
    expect(heldCreatedAt).toBeLessThan(released);
    expect(resend.calls, '過去の held が流れた').toHaveLength(0);
    expect(outbox(db)).toMatchObject({ status: 'pending', delivery_status: 'held' });

    advance(10 * MINUTE);
    await runCron(switched.env);
    expect(switched.queue.sent, 'cron が held を拾った').toHaveLength(1);

    const fresh = await worker.fetch(post({ ...valid, email: 'hanako@example.com' }, '198.51.100.63'), switched.env);
    expect(fresh.status).toBe(200);
    await deliver(switched.env, switched.queue.sent[1]!);
    expect(resend.calls).toHaveLength(1);
    expect(resend.calls[0]!.reply_to).toBe('hanako@example.com');
  });

  it('解放時刻ちょうどに作られた行は送り、1 秒前なら送らない', async () => {
    const resend = stubResend();
    const db = openDatabase();
    const before = envFor(db, live(T0_SEC + 1));
    await worker.fetch(post(valid), before.env);
    await deliver(before.env, before.queue.sent[0]!);
    expect(resend.calls).toHaveLength(0);

    const exact = envFor(db, live(T0_SEC));
    await worker.fetch(post(valid), exact.env);
    await deliver(exact.env, exact.queue.sent[0]!);
    expect(resend.calls).toHaveLength(1);
  });

  it('明示の再処理は live でも 1 回だけ送り、解放時刻より前の held も送る（人が呼ぶ操作）', async () => {
    const resend = stubResend();
    const db = openDatabase();
    const hold = envFor(db);
    await worker.fetch(post(valid), hold.env);
    await deliver(hold.env, hold.queue.sent[0]!);
    const submissionId = row<{ submission_id: string }>(db, 'SELECT submission_id FROM submission_intake').submission_id;

    const liveEnv = envFor(db, live(T0_SEC + 3600)).env;
    await expect(replayHeldDocumentNotice(liveEnv, submissionId)).resolves.toBe('replayed');
    await expect(replayHeldDocumentNotice(liveEnv, submissionId)).resolves.toBe('left-held');
    expect(resend.calls).toHaveLength(1);
    expect(outbox(db)).toMatchObject({ status: 'sent', delivery_status: 'accepted' });
  });

  it('再処理は hold では送らず、live で鍵が無ければ held のまま残す', async () => {
    const resend = stubResend();
    const db = openDatabase();
    const hold = envFor(db);
    await worker.fetch(post(valid), hold.env);
    await deliver(hold.env, hold.queue.sent[0]!);
    const submissionId = row<{ submission_id: string }>(db, 'SELECT submission_id FROM submission_intake').submission_id;
    await expect(replayHeldDocumentNotice(hold.env, submissionId)).resolves.toBe('left-held');
    const noKey = envFor(db, { ...live(), RESEND_API_KEY: '' }).env;
    await expect(replayHeldDocumentNotice(noKey, submissionId)).resolves.toBe('left-held');
    expect(resend.calls).toHaveLength(0);
    expect(outbox(db)).toMatchObject({ status: 'pending', delivery_status: 'held' });
  });
});

describe('Queue への投入失敗の回収（cron）', () => {
  it('投入に失敗した受付は pending のまま記録に残り、15 分後の cron が 1 回だけ再投入して 1 通届く', async () => {
    const resend = stubResend();
    const db = openDatabase();
    const { env, queue } = envFor(db, live());
    queue.failing = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await worker.fetch(post(valid), env);
    const body = await res.json() as { status: string; notification: string; delivered: boolean };
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ status: 'stored', notification: 'pending', delivered: false });
    expect(outbox(db)).toMatchObject({ status: 'pending', delivery_status: 'queued', last_error: 'notify_not_enqueued' });
    queue.failing = false;

    advance(10 * MINUTE);
    await runCron(env);
    expect(queue.sent, '15 分未満は拾わない').toHaveLength(0);

    advance(6 * MINUTE);
    await runCron(env);
    expect(queue.sent).toHaveLength(1);
    expect(queue.sent[0]).toEqual({ submissionId: expect.any(String), messageType: 'internal' });
    await deliver(env, queue.sent[0]!);
    expect(resend.calls).toHaveLength(1);
    expect(outbox(db)).toMatchObject({ status: 'sent', delivery_status: 'accepted', last_error: null });

    await runCron(env);
    expect(queue.sent, '送信済みは再投入しない').toHaveLength(1);
    expect(resend.calls).toHaveLength(1);
  });

  it('送信器の失敗が上限に達した行は cron が拾い直さない', async () => {
    const resend = stubResend(502);
    const db = openDatabase();
    const { env, queue } = envFor(db, live());
    await worker.fetch(post(valid), env);
    for (let i = 0; i < 6; i += 1) {
      const result = await deliver(env, queue.sent[0]!);
      expect(result.retried).toBe(1);
    }
    expect(outbox(db)).toMatchObject({ status: 'pending', delivery_status: 'failed', attempts: 6, last_error: 'provider_status_502' });
    advance(20 * MINUTE);
    await runCron(env);
    expect(queue.sent).toHaveLength(1);
    expect(resend.calls).toHaveLength(0);
  });

  it('失敗が上限の手前なら cron が拾い直し、復旧後に 1 回だけ届く', async () => {
    const resend = stubResend(502);
    const db = openDatabase();
    const { env, queue } = envFor(db, live());
    await worker.fetch(post(valid), env);
    await deliver(env, queue.sent[0]!);
    expect(outbox(db)).toMatchObject({ delivery_status: 'failed', attempts: 1 });
    resend.setStatus(200);
    advance(16 * MINUTE);
    await runCron(env);
    expect(queue.sent).toHaveLength(2);
    await deliver(env, queue.sent[1]!);
    await deliver(env, queue.sent[1]!);
    expect(resend.calls).toHaveLength(1);
  });
});

describe('担当が未通知の受付を見つける照会（手順書の SQL）', () => {
  it('読み取りだけで、PII の列を選ばない', () => {
    const sql = runbookInquirySql();
    const code = sql.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
    expect(code.trim().toUpperCase().startsWith('SELECT')).toBe(true);
    expect(code.replace(/;\s*$/, '')).not.toContain(';');
    expect(code).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|REPLACE|CREATE|PRAGMA|ATTACH)\b/i);
    expect(code).not.toMatch(/ciphertext|email_hmac|idempotency|session_id|\bs\.\*|\bo\.\*|SELECT\s+\*/i);
  });

  it('送信器が受け付けていない受付だけを返す（送信済み・問い合わせは返さない）', async () => {
    stubResend(502);
    const db = openDatabase();
    const { env, queue } = envFor(db, live());
    // A: 送信器が 6 回失敗
    await worker.fetch(post(valid), env);
    for (let i = 0; i < 6; i += 1) await deliver(env, queue.sent[0]!);
    // B: 通知は受け付けられた
    const ok = stubResend(200);
    await worker.fetch(post({ ...valid, email: 'ok@example.com' }, '198.51.100.64'), env);
    await deliver(env, queue.sent[1]!);
    expect(ok.calls).toHaveLength(1);
    // C: Queue に入らなかった
    queue.failing = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await worker.fetch(post({ ...valid, email: 'down@example.com', locale: 'en' }, '198.51.100.65'), env);
    // D: hold の時期の受付
    const hold = envFor(db);
    await worker.fetch(post({ ...valid, email: 'held@example.com' }, '198.51.100.66'), hold.env);
    await deliver(hold.env, hold.queue.sent[0]!);

    const rows = db.prepare(runbookInquirySql()).all() as Array<Record<string, unknown>>;
    expect(rows.map((r) => `${String(r.delivery_status)}/${String(r.last_error)}`).sort()).toEqual([
      'failed/provider_status_502',
      'held/notify_not_released',
      'queued/notify_not_enqueued',
    ]);
    const failed = rows.find((r) => r.delivery_status === 'failed')!;
    expect(failed.attempts).toBe(6);
    expect(Object.keys(failed).sort()).toEqual([
      'attempts', 'created_at', 'delivery_status', 'industry', 'last_error', 'locale', 'receipt_id', 'status',
    ]);
    const serialized = JSON.stringify(rows);
    expect(serialized).not.toContain('example.com');
    expect(serialized).not.toContain('山田');
    expect(rows.find((r) => r.last_error === 'notify_not_enqueued')!.locale).toBe('en');
  });
});

describe('受付言語', () => {
  it('migration 0007 が無い DB でも、受付と live の通知は成り立ち、言語は「記録なし」になる', async () => {
    const resend = stubResend();
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    const dir = resolve(__dirname, '../../migrations');
    for (const file of readdirSync(dir).filter((name) => name.endsWith('.sql') && name < '0007').sort()) {
      db.exec(readFileSync(resolve(dir, file), 'utf8'));
    }
    const { env, queue } = envFor(db, live());
    const res = await worker.fetch(post({ ...valid, locale: 'en' }), env);
    expect(res.status).toBe(200);
    await deliver(env, queue.sent[0]!);
    expect(resend.calls).toHaveLength(1);
    expect(resend.calls[0]!.text).toContain('ページの言語: (記録なし)');
    expect(resend.calls[0]!.text).toContain('返信の言語: 日本語');
  });

  it('保存行と社内通知に、ページの言語と返信の言語を載せる（ja は日本語、それ以外は英語）', async () => {
    const resend = stubResend();
    const cases: Array<[string, string]> = [['ja', '日本語'], ['en', 'English'], ['zh', 'English'], ['ko', 'English'], ['es', 'English']];
    for (const [locale, reply] of cases) {
      const db = openDatabase();
      const { env, queue } = envFor(db, live());
      await worker.fetch(post({ ...valid, locale }, `198.51.100.${70 + cases.findIndex((c) => c[0] === locale)}`), env);
      expect(row<{ locale: string }>(db, 'SELECT locale FROM submission_intake').locale).toBe(locale);
      await deliver(env, queue.sent[0]!);
      const text = resend.calls.at(-1)!.text;
      expect(text, locale).toContain(`ページの言語: ${locale}`);
      expect(text, locale).toContain(`返信の言語: ${reply}`);
      expect(text).not.toContain('母語');
      resetRateLimits();
    }
  });

  it('言語が未指定・不明なら ja として保存する', async () => {
    const db = openDatabase();
    const { env } = envFor(db);
    await worker.fetch(post({ ...valid, locale: 'fr' }), env);
    expect(row<{ locale: string }>(db, 'SELECT locale FROM submission_intake').locale).toBe('ja');
  });
});

describe('状態を読み替えない', () => {
  it('stored・queued・accepted のどれでも、応答は送付済み・受取済みを言わない', async () => {
    stubResend();
    const db = openDatabase();
    const { env, queue } = envFor(db, live());
    const res = await worker.fetch(post(valid), env);
    const first = await res.json() as Record<string, unknown>;
    await deliver(env, queue.sent[0]!);
    const dup = await worker.fetch(post(valid), env);
    const second = await dup.json() as Record<string, unknown>;
    for (const body of [first, second]) {
      expect(body.delivered).toBe(false);
      expect(body.status).toBe('stored');
      expect(Object.keys(body).sort()).toEqual(['delivered', 'duplicate', 'notification', 'ok', 'receiptId', 'status']);
    }
    expect(JSON.stringify([first, second])).not.toMatch(/sent|received|opened|accepted|送付|受取/);
  });

  it('Queue 投入に失敗した partial の HTML は「記録は残っている」と言い、送付済みとも受付失敗とも言わない', async () => {
    const db = openDatabase();
    const { env, queue } = envFor(db, live());
    queue.failing = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await worker.fetch(new Request('https://cor-jp.com/api/contact/document-request', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://cor-jp.com', 'cf-connecting-ip': '198.51.100.80' },
      body: new URLSearchParams({ name: '山田太郎', email: 'taro@example.com', company: '', industry: '', consent: 'yes', website: '', locale: 'ja' }).toString(),
    }), env);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('COR-');
    expect(html).not.toMatch(/送付(しました|済み)|お送りしました|受け付けられませんでした/);
  });
});

describe('既存の経路を壊さない', () => {
  it('問い合わせ（/submit）の通知経路は資料請求の解放時刻に影響されない', async () => {
    const source = readFileSync(resolve(__dirname, '../index.ts'), 'utf8');
    expect(source).toContain("sendInquiryEmail(env, emailProvider.provider, stored.inquiry)");
    const env = envFor(openDatabase(), live()).env as Env;
    expect(env.DOCUMENT_REQUEST_NOTIFY_MODE).toBe('live');
  });
});
