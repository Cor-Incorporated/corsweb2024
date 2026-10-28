// リクエストボディは全量をバッファしてから長さを見ない。
// Content-Length が上限を超える場合は本文を読まず、ストリームは 64KiB を超えたチャンクで打ち切る。
// チャンク間隔と読み始めからの経過時間が上限を超えたら、遅い body も打ち切る。

export const MAX_BODY_BYTES = 64 * 1024;
export const BODY_IDLE_TIMEOUT_MS = 5_000;
export const BODY_TOTAL_TIMEOUT_MS = 8_000;

export interface BodyReadLimits {
  maxBytes: number;
  idleTimeoutMs: number;
  totalTimeoutMs: number;
}

export const DEFAULT_BODY_LIMITS: BodyReadLimits = {
  maxBytes: MAX_BODY_BYTES,
  idleTimeoutMs: BODY_IDLE_TIMEOUT_MS,
  totalTimeoutMs: BODY_TOTAL_TIMEOUT_MS,
};

export type JsonBodyFailure = 'not_json' | 'too_large' | 'timeout' | 'invalid';

export type JsonBodyResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; reason: JsonBodyFailure };

type ByteRead =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; reason: 'too_large' | 'timeout' | 'invalid' };

function readChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  waitMs: number,
): Promise<ReadableStreamReadResult<Uint8Array> | 'timeout'> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve('timeout');
    }, waitMs);
    reader.read().then(
      (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function safeCancel(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
  try {
    await reader.cancel();
  } catch {
    // すでに閉じている producer は無視する。
  }
}

export async function readLimitedBody(
  stream: ReadableStream<Uint8Array> | null,
  limits: BodyReadLimits = DEFAULT_BODY_LIMITS,
): Promise<ByteRead> {
  if (!stream) return { ok: true, bytes: new Uint8Array(0) };
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  const started = Date.now();
  try {
    while (true) {
      const remaining = limits.totalTimeoutMs - (Date.now() - started);
      if (remaining <= 0) {
        await safeCancel(reader);
        return { ok: false, reason: 'timeout' };
      }
      const waitMs = Math.min(limits.idleTimeoutMs, remaining);
      const next = await readChunk(reader, waitMs);
      if (next === 'timeout') {
        await safeCancel(reader);
        return { ok: false, reason: 'timeout' };
      }
      if (next.done) break;
      const value = next.value;
      if (!value || value.byteLength === 0) continue;
      if (received + value.byteLength > limits.maxBytes) {
        await safeCancel(reader);
        return { ok: false, reason: 'too_large' };
      }
      chunks.push(value);
      received += value.byteLength;
    }
  } catch {
    await safeCancel(reader);
    return { ok: false, reason: 'invalid' };
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes };
}

export async function readJsonBody(
  req: Request,
  limits: BodyReadLimits = DEFAULT_BODY_LIMITS,
): Promise<JsonBodyResult> {
  const ct = req.headers.get('content-type') || '';
  if (!/application\/json/i.test(ct)) return { ok: false, reason: 'not_json' };

  const declared = req.headers.get('content-length');
  if (declared !== null && declared !== '') {
    const len = Number(declared);
    if (Number.isFinite(len) && len > limits.maxBytes) return { ok: false, reason: 'too_large' };
  }

  const read = await readLimitedBody(req.body, limits);
  if (!read.ok) return { ok: false, reason: read.reason };

  let data: unknown;
  try {
    data = JSON.parse(new TextDecoder().decode(read.bytes));
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, reason: 'invalid' };
  return { ok: true, data: data as Record<string, unknown> };
}
