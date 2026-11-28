// C-B（結び付け）と C-E7（裏の処理）は、この製品に DB と裏の処理が無いので、当たらない。
import assert from 'node:assert/strict';
import { createHmac, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { build } from 'esbuild';
import { convertV4MiniflareOptions, Miniflare } from 'miniflare';

const site = 'https://sample.example.invalid';
const issuer = 'https://clerk.example.invalid';
const centralUrl = 'https://entitlements.example.invalid';
const queryToken = randomBytes(32).toString('base64url');

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwtKey = publicKey.export({ type: 'spki', format: 'pem' });

const bundled = await build({
  entryPoints: [fileURLToPath(new URL('../src/index.js', import.meta.url))],
  bundle: true,
  conditions: ['worker', 'browser', 'import', 'default'],
  format: 'esm',
  logLevel: 'silent',
  mainFields: ['browser', 'module', 'main'],
  platform: 'browser',
  target: 'es2022',
  write: false,
});
const script = bundled.outputFiles[0].text;

const baseBindings = {
  SITE_ORIGIN: site,
  CLERK_ISSUER: issuer,
  ENTITLEMENTS_URL: centralUrl,
  SERVICE_ID: 'sample',
  TENANT_ID: 'sample',
  CLERK_JWT_KEY: jwtKey,
  SAMPLE_ENTITLEMENT_QUERY_TOKEN: queryToken,
};

function respond(body, status = 200, headers = {}) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function createCentral() {
  const state = {
    handler: () => respond({ allowed: true, access: 'open' }),
    requests: [],
  };
  async function outbound(request) {
    const record = {
      authorization: request.headers.get('Authorization'),
      body: null,
      contentType: request.headers.get('Content-Type'),
      method: request.method,
      url: request.url,
    };
    try {
      record.body = await request.clone().json();
    } catch {
      record.body = null;
    }
    state.requests.push(record);
    return state.handler(request, record);
  }
  return { outbound, state };
}

function createRuntime(t, bindings = {}) {
  const central = createCentral();
  const mf = new Miniflare(convertV4MiniflareOptions({
    bindings: { ...baseBindings, ...bindings },
    cf: false,
    compatibilityDate: '2026-10-26',
    modules: true,
    outboundService: central.outbound,
    script,
    telemetry: { enabled: false },
  }));
  t.after(() => mf.dispose());
  return { central, mf };
}

function session(overrides = {}, signingKey = privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'RS256', cat: 'cl_B7d4PD111AAA', kid: 'fixture', typ: 'JWT' });
  const payload = encode({
    iss: issuer,
    sub: 'user_Sample',
    azp: site,
    sid: 'sess_Fixture',
    v: 2,
    sts: 'active',
    iat: now - 1,
    nbf: now - 1,
    exp: now + 55,
    ...overrides,
  });
  const data = header + '.' + payload;
  return data + '.' + sign('sha256', Buffer.from(data), signingKey).toString('base64url');
}

function bearer(token) {
  return { Authorization: 'Bearer ' + token };
}

async function call(mf, path, init = {}) {
  const response = await mf.dispatchFetch(site + path, init);
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return { body, headers: response.headers, status: response.status, text };
}

async function access(mf, operation, headers = {}) {
  return call(mf, '/api/access?operation=' + operation, { headers });
}

test('C-T1 a valid RS256 token admits the access query (Bearer and __session)', async t => {
  const { central, mf } = createRuntime(t);
  const token = session();
  for (const headers of [bearer(token), { Cookie: '__session=' + token }]) {
    const result = await access(mf, 'view', headers);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { access: 'open', allowed: true });
    assert.equal(result.headers.get('cache-control'), 'private, no-store');
  }

  const second = createRuntime(t);
  const organizationToken = session({ o: { id: 'org_Fixture' } });
  const organization = await access(second.mf, 'view', bearer(organizationToken));
  assert.equal(organization.status, 200);
  assert.equal(second.central.state.requests.at(-1).body.organizationId, 'org_Fixture');
  assert.equal(central.state.requests[0].body.organizationId, null);
});

test('C-T2 a missing token is 401', async t => {
  const { mf } = createRuntime(t);
  for (const headers of [
    {},
    { Cookie: '__session=' },
    { Cookie: '__session=a.b.c; __session=d.e.f' },
    { Authorization: 'Bearer' },
    { Authorization: 'Basic abc' },
  ]) {
    assert.equal((await access(mf, 'view', headers)).status, 401);
  }
});

test('C-T3 a broken signature, alg=none, HS256 and RS512 are 401', async t => {
  const { mf } = createRuntime(t);
  const token = session();
  const pieces = token.split('.');
  const tampered = [pieces[0], pieces[1], (pieces[2][0] === 'A' ? 'B' : 'A') + pieces[2].slice(1)].join('.');
  assert.equal((await access(mf, 'view', bearer(tampered))).status, 401);

  const now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const payload = encode({
    iss: issuer, sub: 'user_Sample', azp: site, sid: 'sess_Fixture', v: 2,
    iat: now - 1, nbf: now - 1, exp: now + 55,
  });
  const none = encode({ alg: 'none', cat: 'cl_B7d4PD111AAA', typ: 'JWT' }) + '.' + payload + '.x';
  assert.equal((await access(mf, 'view', bearer(none))).status, 401);

  const hsHeader = encode({ alg: 'HS256', cat: 'cl_B7d4PD111AAA', typ: 'JWT' });
  const hsData = hsHeader + '.' + payload;
  const hs256 = hsData + '.' + createHmac('sha256', 'fixture').update(hsData).digest('base64url');
  assert.equal((await access(mf, 'view', bearer(hs256))).status, 401);

  const rs512Header = encode({ alg: 'RS512', cat: 'cl_B7d4PD111AAA', kid: 'fixture', typ: 'JWT' });
  const rs512Data = rs512Header + '.' + payload;
  const rs512 = rs512Data + '.' + sign('sha512', Buffer.from(rs512Data), privateKey).toString('base64url');
  assert.equal((await access(mf, 'view', bearer(rs512))).status, 401);
});

test('C-T4 wrong iss/azp, expired, sts=pending, v!=2 and future nbf are 401', async t => {
  const { mf } = createRuntime(t);
  const now = Math.floor(Date.now() / 1000);
  const cases = [
    { iss: 'https://other.example.invalid' },
    { azp: 'https://other.example.invalid' },
    { exp: now - 120, nbf: now - 120 },
    { sts: 'pending' },
    { v: 1 },
    { v: '2' },
    { nbf: now + 120 },
    { sub: 'not-a-subject' },
    { sid: 'not-a-session' },
    { exp: 'soon' },
    { nbf: null },
    { o: { id: 'not-an-organization' } },
    { o: {} },
    { o: 'org_Fixture' },
  ];
  for (const overrides of cases) {
    assert.equal((await access(mf, 'view', bearer(session(overrides)))).status, 401, JSON.stringify(overrides));
  }
});

test('C-T5 a clock skew within 60 seconds is accepted', async t => {
  const { mf } = createRuntime(t);
  const now = Math.floor(Date.now() / 1000);
  assert.equal((await access(mf, 'view', bearer(session({ exp: now - 30, nbf: now - 60 })))).status, 200);
  assert.equal((await access(mf, 'view', bearer(session({ nbf: now + 30, exp: now + 55 })))).status, 200);
});

test('C-T6 a token signed with a removed key is 401', async t => {
  const { mf } = createRuntime(t);
  const removed = generateKeyPairSync('rsa', { modulusLength: 2048 });
  assert.equal((await access(mf, 'view', bearer(session({}, removed.privateKey)))).status, 401);
  assert.equal((await access(mf, 'view', bearer(session()))).status, 200);
});

test('C-E1 open allows view, edit and export', async t => {
  const { mf } = createRuntime(t);
  for (const operation of ['view', 'edit', 'export']) {
    const result = await access(mf, operation, bearer(session()));
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { access: 'open', allowed: true });
  }
});

test('C-E2 view_only allows view only', async t => {
  const { central, mf } = createRuntime(t);
  central.state.handler = (request, record) => respond({
    access: 'view_only',
    allowed: record.body.operation === 'view',
  });
  assert.deepEqual((await access(mf, 'view', bearer(session()))).body, { access: 'view_only', allowed: true });
  assert.deepEqual((await access(mf, 'edit', bearer(session()))).body, { access: 'view_only', allowed: false });
  assert.deepEqual((await access(mf, 'export', bearer(session()))).body, { access: 'view_only', allowed: false });
});

test('C-E3 read_export_only allows view and export only', async t => {
  const { central, mf } = createRuntime(t);
  central.state.handler = (request, record) => respond({
    access: 'read_export_only',
    allowed: record.body.operation !== 'edit',
  });
  assert.deepEqual((await access(mf, 'view', bearer(session()))).body, { access: 'read_export_only', allowed: true });
  assert.deepEqual((await access(mf, 'edit', bearer(session()))).body, { access: 'read_export_only', allowed: false });
  assert.deepEqual((await access(mf, 'export', bearer(session()))).body, { access: 'read_export_only', allowed: true });
});

test('C-E4 closed, unknown access, allowed mismatch and string allowed close', async t => {
  const cases = [
    ['view', { allowed: false, access: 'closed' }],
    ['view', { allowed: true, access: 'admin' }],
    ['edit', { allowed: true, access: 'view_only' }],
    ['view', { allowed: false, access: 'open' }],
    ['view', { allowed: 'true', access: 'open' }],
    ['view', { allowed: true, access: 'closed' }],
    ['view', { access: 'open' }],
    ['view', { allowed: true }],
    ['view', 'open'],
    ['view', null],
  ];
  for (const [operation, body] of cases) {
    const { central, mf } = createRuntime(t);
    central.state.handler = () => respond(body);
    const result = await access(mf, operation, bearer(session()));
    assert.equal(result.status, 200, JSON.stringify(body));
    assert.deepEqual(result.body, { access: 'closed', allowed: false }, JSON.stringify(body));
  }
});

test('C-E5 503, timeout, broken JSON, oversized body and redirect close', async t => {
  {
    const { central, mf } = createRuntime(t);
    central.state.handler = () => respond({ error: 'unavailable' }, 503);
    assert.deepEqual((await access(mf, 'view', bearer(session()))).body, { access: 'closed', allowed: false });
  }
  {
    const { central, mf } = createRuntime(t);
    central.state.handler = request => new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(respond({ access: 'open', allowed: true })), 2200);
      request.signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new Error('aborted'));
      }, { once: true });
      if (request.signal.aborted) {
        clearTimeout(timer);
        reject(new Error('aborted'));
      }
    });
    const started = Date.now();
    assert.deepEqual((await access(mf, 'view', bearer(session()))).body, { access: 'closed', allowed: false });
    assert.ok(Date.now() - started < 2199, 'the 2 second timeout must close before the stub answers');
  }
  {
    const { central, mf } = createRuntime(t);
    central.state.handler = () => respond('{"allowed":true', 200);
    assert.deepEqual((await access(mf, 'view', bearer(session()))).body, { access: 'closed', allowed: false });
  }
  {
    const { central, mf } = createRuntime(t);
    central.state.handler = () => respond({
      access: 'open',
      allowed: true,
      padding: 'x'.repeat(5000),
    });
    assert.deepEqual((await access(mf, 'view', bearer(session()))).body, { access: 'closed', allowed: false });
  }
  {
    const { central, mf } = createRuntime(t);
    central.state.handler = () => new Response(null, {
      status: 302,
      headers: { Location: 'https://other.example.invalid/' },
    });
    assert.deepEqual((await access(mf, 'view', bearer(session()))).body, { access: 'closed', allowed: false });
  }
  {
    const { central, mf } = createRuntime(t);
    central.state.handler = () => new Response(null, { status: 200 });
    assert.deepEqual((await access(mf, 'view', bearer(session()))).body, { access: 'closed', allowed: false });
  }
});

test('C-E6 every request reaches the central with the expected body', async t => {
  const { central, mf } = createRuntime(t);
  central.state.handler = () => respond({ access: 'open', allowed: true });
  central.state.requests.length = 0;

  for (const operation of ['view', 'edit', 'export', 'view']) {
    assert.equal((await access(mf, operation, bearer(session()))).status, 200);
  }
  assert.equal(central.state.requests.length, 4);

  assert.deepEqual(central.state.requests.map(request => request.body.operation), ['view', 'edit', 'export', 'view']);
  for (const request of central.state.requests) {
    assert.equal(request.url, centralUrl + '/v2/entitlements/check');
    assert.equal(request.method, 'POST');
    assert.equal(request.authorization, 'Bearer ' + queryToken);
    assert.match(request.contentType, /^application\/json/);
    assert.deepEqual(request.body, {
      service: 'sample',
      issuer,
      subject: 'user_Sample',
      tenantId: 'sample',
      organizationId: null,
      operation: request.body.operation,
    });
  }

  const organizationToken = session({ o: { id: 'org_Fixture' } });
  assert.equal((await access(mf, 'view', bearer(organizationToken))).status, 200);
  assert.equal(central.state.requests.at(-1).body.organizationId, 'org_Fixture');
});

test('C-G1 every path without a token is 401 or 404 except GET /', async t => {
  const { mf } = createRuntime(t);

  const page = await call(mf, '/');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /^text\/html/);
  const policy = page.headers.get('content-security-policy');
  assert.match(policy, /script-src 'self' 'nonce-[0-9a-f]{32}' https:\/\/clerk\.example\.invalid/);
  assert.match(policy, /connect-src 'self' https:\/\/clerk\.example\.invalid/);
  assert.ok(page.text.includes(issuer + '/npm/@clerk/clerk-js@6.46.3/dist/clerk.browser.js'));
  assert.ok(page.text.includes('redirect_url=https%3A%2F%2Fsample.example.invalid%2F'));
  assert.ok(!page.text.includes(queryToken), 'the central token must not reach the page');

  for (const path of [
    '/api/access?operation=view',
    '/api/access',
    '/api/access?operation=view&extra=1',
    '/docs',
    '/redoc',
    '/openapi.json',
    '/auth/login',
    '/auth/setup',
    '/sign-in',
    '/callback',
    '/api/access/extra',
  ]) {
    const result = await call(mf, path);
    assert.ok([401, 404].includes(result.status), path + ' returned ' + result.status);
  }

  assert.equal((await call(mf, '/', { method: 'POST' })).status, 405);
  assert.equal((await call(mf, '/', { method: 'HEAD' })).status, 405);
  assert.equal((await call(mf, '/api/access', { method: 'POST' })).status, 405);
  assert.equal((await call(mf, '/api/access', { method: 'DELETE' })).status, 405);
});

test('C-G3 docs, redoc and openapi.json are 404', async t => {
  const { mf } = createRuntime(t);
  for (const path of ['/docs', '/docs/', '/redoc', '/openapi.json', '/api/docs', '/swagger']) {
    assert.equal((await call(mf, path)).status, 404, path);
    assert.equal((await call(mf, path, { headers: bearer(session()) })).status, 404, path + ' with a token');
  }
});
