import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer, request as httpRequest } from 'node:http';
import { computeSignature, createHandler, resetNonces, verifySignature } from '../src/server.js';

test.beforeEach(() => resetNonces());

process.env.VERTEX_GATEWAY_SECRET = 'test-secret';

// 署名済みのローカルリクエストを、実際の HTTP サーバ経由で handler に流す。
// fetch は試験が差し替え、Gateway から外へ出る通信（metadata token と Vertex REST）をすべて捕捉する。
function postJson(port, path, headers, body) {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      // Connection: close で keep-alive を切る。server.close() を試験後すぐに終えられるように。
      { host: '127.0.0.1', port, path, method: 'POST', headers: { 'content-type': 'application/json', connection: 'close', ...headers } },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      },
    );
    req.on('error', reject);
    req.end(body);
  });
}

function listen(handler) {
  return new Promise((resolve, reject) => {
    const server = createServer(handler);
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

function signedHeaders(body) {
  const timestamp = String(Date.now());
  const nonce = randomUUID();
  return {
    'x-cloudia-timestamp': timestamp,
    'x-cloudia-nonce': nonce,
    'x-cloudia-signature': computeSignature(process.env.VERTEX_GATEWAY_SECRET, timestamp, nonce, body),
  };
}

function modelRequestBody(model) {
  return JSON.stringify({
    project: 'cor-jp-web',
    location: 'global',
    model,
    systemInstruction: { parts: [{ text: 'system' }] },
    contents: [{ role: 'user', parts: [{ text: 'hello' }] }],
    generationConfig: {
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
      ...(model === 'gemini-4-hydrogen'
        ? { thinkingConfig: { thinkingLevel: 'LOW' } }
        : { temperature: 0.3 }),
    },
  });
}

test('forwards signed requests for both allowed models to the matching Vertex URL', async (t) => {
  const outbound = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    outbound.push({ url: String(url), init });
    if (String(url).includes('metadata.google.internal')) {
      return Response.json({ access_token: 'test-token', expires_in: 3600 });
    }
    return Response.json({ candidates: [{ finishReason: 'STOP' }] });
  };
  t.after(() => { globalThis.fetch = realFetch; });
  const { server, port } = await listen(createHandler());
  t.after(() => server.close());

  for (const model of ['gemini-3.5-flash', 'gemini-4-hydrogen']) {
    const body = modelRequestBody(model);
    const response = await postJson(port, '/generateContent', signedHeaders(body), body);
    assert.equal(response.status, 200);
    const vertexCall = outbound.find((call) => call.url.includes('aiplatform.googleapis.com'));
    assert.ok(vertexCall, 'gateway should call the Vertex REST endpoint');
    assert.match(vertexCall.url, new RegExp(`/v1/projects/cor-jp-web/locations/global/publishers/google/models/${model}:generateContent$`));
    assert.equal(vertexCall.init.headers.authorization, 'Bearer test-token');
    const forwarded = JSON.parse(vertexCall.init.body);
    assert.deepEqual(Object.keys(forwarded).sort(), ['generationConfig', 'contents', 'systemInstruction'].sort());
    assert.deepEqual(forwarded.contents, [{ role: 'user', parts: [{ text: 'hello' }] }]);
    assert.deepEqual(forwarded.generationConfig.thinkingConfig, model === 'gemini-4-hydrogen' ? { thinkingLevel: 'LOW' } : undefined);
    assert.equal(forwarded.generationConfig.temperature, model === 'gemini-3.5-flash' ? 0.3 : undefined);
    outbound.length = 0;
  }
});

test('rejects unknown model, project or location without outbound traffic', async (t) => {
  const outbound = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    outbound.push(String(url));
    return Response.json({ access_token: 'test-token', expires_in: 3600 });
  };
  t.after(() => { globalThis.fetch = realFetch; });
  const { server, port } = await listen(createHandler());
  t.after(() => server.close());

  const valid = JSON.parse(modelRequestBody('gemini-4-hydrogen'));
  for (const invalid of [{ model: 'gemini-9-unknown' }, { project: 'other-project' }, { location: 'us' }]) {
    const body = JSON.stringify({ ...valid, ...invalid });
    const response = await postJson(port, '/generateContent', signedHeaders(body), body);
    assert.equal(response.status, 400);
    assert.deepEqual(JSON.parse(response.body), { error: 'invalid model configuration' });
  }
  assert.equal(outbound.length, 0);
});

test('rejects a modified signature or oversized body before outgoing fetch', async (t) => {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => { calls.push(String(url)); throw new Error('unexpected outgoing fetch'); };
  t.after(() => { globalThis.fetch = realFetch; });
  const { server, port } = await listen(createHandler());
  t.after(() => server.close());
  const body = modelRequestBody('gemini-4-hydrogen');

  const headers = signedHeaders(body);
  const signature = headers['x-cloudia-signature'];
  headers['x-cloudia-signature'] = (signature[0] === 'a' ? 'b' : 'a') + signature.slice(1);
  assert.equal((await postJson(port, '/generateContent', headers, body)).status, 401);
  const oversized = body.padEnd(64 * 1024 + 1, ' ');
  assert.equal((await postJson(port, '/generateContent', signedHeaders(oversized), oversized)).status, 413);
  assert.deepEqual(calls, []);
});

test('production and preview Worker configurations keep using Gemini 3.5 Flash', async () => {
  const source = await readFile(new URL('../../../workers/contact-chat/wrangler.toml', import.meta.url), 'utf8');
  const models = [...source.matchAll(/^VERTEX_MODEL = "([^"]+)"/gm)].map((match) => match[1]);
  assert.deepEqual(models, ['gemini-3.5-flash', 'gemini-3.5-flash']);
});

test('a worker-only model swap fails closed against a legacy single-model gateway', async (t) => {
  // 旧構成（gemini-3.5-flash だけ）の Gateway に、Worker の既定を差し替えただけの
  // gemini-4-hydrogen 要求を送ると、署名が正しくても 400 で止まる。
  const outbound = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    outbound.push(String(url));
    return Response.json({ access_token: 'test-token', expires_in: 3600 });
  };
  t.after(() => { globalThis.fetch = realFetch; });
  const legacyHandler = createHandler({ allowedModels: new Set(['gemini-3.5-flash']) });
  const { server, port } = await listen(legacyHandler);
  t.after(() => server.close());

  const body = modelRequestBody('gemini-4-hydrogen');
  const response = await postJson(port, '/generateContent', signedHeaders(body), body);
  assert.equal(response.status, 400);
  assert.deepEqual(JSON.parse(response.body), { error: 'invalid model configuration' });
  assert.equal(outbound.length, 0);
});

test('accepts a current correctly signed request once', () => {
  const now = 1_700_000_000_000;
  const input = { secret: 'test-secret', timestamp: String(now), nonce: 'unique', body: '{}' };
  const signature = computeSignature(input.secret, input.timestamp, input.nonce, input.body);
  assert.equal(verifySignature({ ...input, signature, now }), true);
  assert.equal(verifySignature({ ...input, signature, now }), false);
});

test('rejects stale or tampered requests', () => {
  const now = 1_700_000_000_000;
  const timestamp = String(now - 31_000);
  const signature = computeSignature('secret', timestamp, 'nonce', '{}');
  assert.equal(verifySignature({ secret: 'secret', timestamp, nonce: 'nonce', signature, body: '{}', now }), false);
  assert.equal(verifySignature({ secret: 'secret', timestamp: String(now), nonce: 'nonce2', signature, body: '{"x":1}', now }), false);
});
