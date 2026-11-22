import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

const PROJECT = 'cor-jp-web';
const LOCATION = 'global';
// Worker（workers/contact-chat の VERTEX_MODEL）と対で増やす。厳密な一致だけを通し、
// 許可以外のモデルは署名が正しくても 400 にして、Vertex への外向通信を起こさない。
// gemini-3.5-flash は、Gateway を先に配備するときの旧 Worker 版と、Worker を旧モデルへ
// 戻すときの受付を維持するための値。
const ALLOWED_MODELS = new Set(['gemini-3.5-flash', 'gemini-4-hydrogen']);
const MAX_BODY = 64 * 1024;
const MAX_SKEW_MS = 30_000;
const usedNonces = new Map();
let accessToken;

const json = (res, status, value) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(value));
};

export function computeSignature(secret, timestamp, nonce, body) {
  return createHmac('sha256', secret).update(`${timestamp}.${nonce}.${body}`).digest('hex');
}

export function verifySignature({ secret, timestamp, nonce, signature, body, now = Date.now() }) {
  if (!secret || !timestamp || !nonce || !signature || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const time = Number(timestamp);
  if (!Number.isFinite(time) || Math.abs(now - time) > MAX_SKEW_MS || usedNonces.has(nonce)) return false;
  const expected = Buffer.from(computeSignature(secret, timestamp, nonce, body), 'hex');
  const supplied = Buffer.from(signature, 'hex');
  if (!timingSafeEqual(expected, supplied)) return false;
  usedNonces.set(nonce, now + MAX_SKEW_MS);
  for (const [key, expiry] of usedNonces) if (expiry < now) usedNonces.delete(key);
  return true;
}

export function resetNonces() { usedNonces.clear(); }

async function getAccessToken() {
  if (accessToken?.expiresAt > Date.now() + 60_000) return accessToken.value;
  const response = await fetch('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', {
    headers: { 'metadata-flavor': 'Google' },
  });
  if (!response.ok) throw new Error(`metadata token failed (${response.status})`);
  const data = await response.json();
  if (!data.access_token) throw new Error('metadata token missing');
  accessToken = { value: data.access_token, expiresAt: Date.now() + Math.max(60, data.expires_in || 3600) * 1000 };
  return accessToken.value;
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error('body too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function createHandler({ allowedModels = ALLOWED_MODELS } = {}) {
  // allowedModels を差し替えられる工場。旧構成（gemini-3.5-flash だけ）の Gateway に対して
  // Worker が明示指定した新モデルを送ると 400 になることを、試験がこの工場で再現する。
  return async function handle(req, res) {
    if (req.method === 'GET' && req.url === '/health') return json(res, 200, { ok: true });
    if (req.method !== 'POST' || req.url !== '/generateContent') return json(res, 404, { error: 'not found' });
    let body;
    try { body = await readBody(req); } catch { return json(res, 413, { error: 'invalid request' }); }
    const valid = verifySignature({
      secret: process.env.VERTEX_GATEWAY_SECRET,
      timestamp: req.headers['x-cloudia-timestamp'], nonce: req.headers['x-cloudia-nonce'],
      signature: req.headers['x-cloudia-signature'], body,
    });
    if (!valid) return json(res, 401, { error: 'unauthorized' });
    let input;
    try { input = JSON.parse(body); } catch { return json(res, 400, { error: 'invalid request' }); }
    if (!input || typeof input !== 'object' || Array.isArray(input)) return json(res, 400, { error: 'invalid request' });
    if (input.project !== PROJECT || input.location !== LOCATION || !allowedModels.has(input.model)) return json(res, 400, { error: 'invalid model configuration' });
    const vertexBody = {
      systemInstruction: input.systemInstruction, contents: input.contents,
      generationConfig: input.generationConfig,
    };
    try {
      const token = await getAccessToken();
      const url = `https://aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/${input.model}:generateContent`;
      const response = await fetch(url, {
        method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(vertexBody),
      });
      if (!response.ok) return json(res, 503, { error: 'vertex unavailable' });
      return json(res, 200, await response.json());
    } catch { return json(res, 503, { error: 'vertex unavailable' }); }
  };
}

export const handle = createHandler();

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createServer(handle).listen(Number(process.env.PORT || 8080));
}
