import { describe, expect, it } from 'vitest';
import { MAX_BODY_BYTES, readJsonBody, readLimitedBody, type BodyReadLimits } from '../body';
import worker from '../index';
import type { Env } from '../types';

const fast: BodyReadLimits = {
  maxBytes: MAX_BODY_BYTES,
  idleTimeoutMs: 50,
  totalTimeoutMs: 200,
};

function asRequest(
  body: ReadableStream<Uint8Array> | null,
  headers: Record<string, string>,
  onBody?: () => void,
): Request {
  const bag = new Map(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  return {
    headers: { get: (name: string) => bag.get(name.toLowerCase()) ?? null },
    get body() {
      onBody?.();
      return body;
    },
  } as unknown as Request;
}

function jsonStream(chunks: Uint8Array[], hangAfter = false): { stream: ReadableStream<Uint8Array>; pulls: () => number } {
  let pulls = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls += 1;
      const next = chunks[pulls - 1];
      if (next) {
        controller.enqueue(next);
        if (pulls === chunks.length && !hangAfter) controller.close();
        return;
      }
      if (hangAfter) return new Promise(() => {});
      controller.close();
    },
  });
  return { stream, pulls: () => pulls };
}

describe('readJsonBody — 64KiB と遅い body', () => {
  it('Content-Length が上限を超えると body を読まない', async () => {
    const { stream } = jsonStream([], true);
    let reads = 0;
    const result = await readJsonBody(asRequest(stream, {
      'content-type': 'application/json',
      'content-length': String(MAX_BODY_BYTES + 1),
    }, () => { reads += 1; }));
    expect(result).toEqual({ ok: false, reason: 'too_large' });
    expect(reads).toBe(0);
  });

  it('64KiB を超えたチャンクで後続の完了を待たない', async () => {
    const { stream, pulls } = jsonStream([new Uint8Array(MAX_BODY_BYTES + 1)], true);
    const started = Date.now();
    const result = await readLimitedBody(stream, fast);
    expect(result).toEqual({ ok: false, reason: 'too_large' });
    expect(Date.now() - started).toBeLessThan(200);
    expect(pulls()).toBeLessThanOrEqual(2);
  });

  it('分割しても合計が 64KiB を超えた時点で打ち切る', async () => {
    const chunk = new Uint8Array(30 * 1024);
    const { stream, pulls } = jsonStream([chunk, chunk, chunk, chunk], true);
    const started = Date.now();
    const result = await readLimitedBody(stream, fast);
    expect(result).toEqual({ ok: false, reason: 'too_large' });
    expect(Date.now() - started).toBeLessThan(200);
    expect(pulls()).toBeLessThanOrEqual(4);
  });

  it('ちょうど 64KiB は読む', async () => {
    const result = await readLimitedBody(new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_BODY_BYTES));
        controller.close();
      },
    }), fast);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.bytes.byteLength).toBe(MAX_BODY_BYTES);
  });

  it('Content-Length が小さくても実体が上限を超えたら打ち切る', async () => {
    const { stream } = jsonStream([
      new Uint8Array(1024),
      new Uint8Array(MAX_BODY_BYTES),
    ], true);
    const started = Date.now();
    const result = await readJsonBody(asRequest(stream, {
      'content-type': 'application/json',
      'content-length': '1024',
    }), fast);
    expect(result).toEqual({ ok: false, reason: 'too_large' });
    expect(Date.now() - started).toBeLessThan(200);
  });

  it('チャンクが来ない body は待ち続けずに timeout になる', async () => {
    const { stream, pulls } = jsonStream([new TextEncoder().encode('{"a":')], true);
    const started = Date.now();
    const result = await readJsonBody(asRequest(stream, { 'content-type': 'application/json' }), {
      maxBytes: MAX_BODY_BYTES,
      idleTimeoutMs: 40,
      totalTimeoutMs: 500,
    });
    expect(result).toEqual({ ok: false, reason: 'timeout' });
    expect(Date.now() - started).toBeLessThan(400);
    expect(pulls()).toBeGreaterThanOrEqual(1);
  });

  it('読み始めからの総時間でも打ち切る', async () => {
    const { stream } = jsonStream([], true);
    const started = Date.now();
    const result = await readLimitedBody(stream, {
      maxBytes: MAX_BODY_BYTES,
      idleTimeoutMs: 10_000,
      totalTimeoutMs: 40,
    });
    expect(result).toEqual({ ok: false, reason: 'timeout' });
    expect(Date.now() - started).toBeLessThan(400);
  });

  it('上限内の分割 JSON はオブジェクトとして返す', async () => {
    const encoded = new TextEncoder().encode('{"messages":[{"role":"user","content":"hi"}]}');
    const { stream } = jsonStream([encoded.slice(0, 10), encoded.slice(10)]);
    const result = await readJsonBody(asRequest(stream, { 'content-type': 'application/json' }), fast);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('JSON でない content-type は読まずに not_json', async () => {
    const { stream } = jsonStream([new Uint8Array(8)], true);
    let reads = 0;
    const result = await readJsonBody(asRequest(stream, {
      'content-type': 'text/plain',
    }, () => { reads += 1; }), fast);
    expect(result).toEqual({ ok: false, reason: 'not_json' });
    expect(reads).toBe(0);
  });

  it('worker は 64KiB 超のストリームを待たずに 400 にする', async () => {
    let pulls = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        if (pulls === 1) {
          controller.enqueue(new Uint8Array(MAX_BODY_BYTES + 1));
          return;
        }
        return new Promise(() => {});
      },
    });
    const started = Date.now();
    const res = await worker.fetch(new Request('https://cor-jp.com/api/contact/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://cor-jp.com' },
      body: stream,
      duplex: 'half',
    } as RequestInit), {
      TURNSTILE_SECRET: '',
    } as unknown as Env);
    expect(res.status).toBe(400);
    expect(Date.now() - started).toBeLessThan(500);
  });
});
