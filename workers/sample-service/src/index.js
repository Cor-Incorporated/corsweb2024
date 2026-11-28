import { verifyToken } from '@clerk/backend';

const CLERK_JS_VERSION = '6.46.3';
const ACCESS_BY_OPERATION = {
  open: ['view', 'edit', 'export'],
  view_only: ['view'],
  read_export_only: ['view', 'export'],
  closed: [],
};
const ACCESS_LABELS = {
  open: '利用できます',
  view_only: '閲覧のみ',
  read_export_only: '閲覧と書き出しのみ',
  closed: '利用できません',
};
const OPERATIONS = new Set(['view', 'edit', 'export']);
const SUBJECT_PATTERN = /^user_[A-Za-z0-9_]{1,123}$/;
const SESSION_PATTERN = /^sess_[A-Za-z0-9_]+$/;
const ORGANIZATION_PATTERN = /^org_[A-Za-z0-9_]+$/;
const TOKEN_PATTERN = /^[\w-]+\.[\w-]+\.[\w-]+$/;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const MAX_TOKEN_LENGTH = 8192;
const MAX_CENTRAL_BYTES = 4096;
const CENTRAL_TIMEOUT_MS = 2000;
const CLOCK_SKEW_MS = 60_000;
const CLOCK_SKEW_SECONDS = CLOCK_SKEW_MS / 1000;
const TIMEOUT = Symbol('timeout');

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Cookie, Authorization',
    },
  });
}

function text(body, status) {
  return new Response(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function methodNotAllowed(allow) {
  return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
    status: 405,
    headers: {
      Allow: allow,
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function httpsOrigin(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    return url.origin === value && url.pathname === '/' ? url : null;
  } catch {
    return null;
  }
}

function identifier(value) {
  return typeof value === 'string' && IDENTIFIER_PATTERN.test(value) ? value : null;
}

function configuration(env) {
  const site = httpsOrigin(env.SITE_ORIGIN);
  const issuer = httpsOrigin(env.CLERK_ISSUER);
  const central = httpsOrigin(env.ENTITLEMENTS_URL);
  const service = identifier(env.SERVICE_ID);
  const tenant = identifier(env.TENANT_ID);
  if (!site || !issuer || !central || !service || !tenant) return null;
  if (typeof env.CLERK_JWT_KEY !== 'string' || env.CLERK_JWT_KEY.length === 0) return null;
  if (typeof env.SAMPLE_ENTITLEMENT_QUERY_TOKEN !== 'string' || env.SAMPLE_ENTITLEMENT_QUERY_TOKEN.length === 0) return null;
  return {
    site,
    issuer,
    central,
    service,
    tenant,
    jwtKey: env.CLERK_JWT_KEY,
    queryToken: env.SAMPLE_ENTITLEMENT_QUERY_TOKEN,
  };
}

function tokenFrom(request) {
  const authorization = request.headers.get('Authorization');
  if (authorization !== null) {
    const supplied = /^Bearer ([\w.-]+)$/i.exec(authorization)?.[1];
    return supplied ?? '';
  }
  const cookies = (request.headers.get('Cookie') ?? '')
    .split(';')
    .map(value => value.trim())
    .filter(value => value.startsWith('__session='));
  return cookies.length === 1 ? cookies[0].slice('__session='.length) : '';
}

async function authenticated(request, config) {
  const token = tokenFrom(request);
  if (!TOKEN_PATTERN.test(token) || token.length > MAX_TOKEN_LENGTH) return null;

  let claims;
  try {
    claims = await verifyToken(token, {
      jwtKey: config.jwtKey,
      issuer: config.issuer.origin,
      authorizedParties: [config.site.origin],
      clockSkewInMs: CLOCK_SKEW_MS,
    });
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== config.issuer.origin) return null;
  if (claims.azp !== config.site.origin) return null;
  if (!SUBJECT_PATTERN.test(claims.sub ?? '')) return null;
  if (!SESSION_PATTERN.test(claims.sid ?? '')) return null;
  if (claims.v !== 2) return null;
  if (claims.sts === 'pending') return null;
  if (!Number.isInteger(claims.exp) || !Number.isInteger(claims.nbf)) return null;
  if (claims.exp <= now - CLOCK_SKEW_SECONDS) return null;
  if (claims.nbf > now + CLOCK_SKEW_SECONDS) return null;

  let organizationId = null;
  if (claims.o != null) {
    if (typeof claims.o !== 'object' || Array.isArray(claims.o)) return null;
    organizationId = claims.o.id;
    if (typeof organizationId !== 'string' || !ORGANIZATION_PATTERN.test(organizationId)) return null;
  }

  return { subject: claims.sub, organizationId };
}

async function readLimited(response) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_CENTRAL_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function closed() {
  return { access: 'closed', allowed: false };
}

function consistent(allowed, access, operation) {
  return allowed === ACCESS_BY_OPERATION[access].includes(operation);
}

async function askCentral(config, subject, organizationId, operation) {
  const controller = new AbortController();
  let timer;
  const expired = new Promise(resolve => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(TIMEOUT);
    }, CENTRAL_TIMEOUT_MS);
  });

  let response;
  try {
    response = await Promise.race([
      fetch(new URL('/v2/entitlements/check', config.central.origin), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${config.queryToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service: config.service,
          issuer: config.issuer.origin,
          subject,
          tenantId: config.tenant,
          organizationId,
          operation,
        }),
        redirect: 'manual',
        signal: controller.signal,
      }),
      expired,
    ]);
  } catch {
    return closed();
  } finally {
    clearTimeout(timer);
  }

  if (response === TIMEOUT) return closed();
  if (response.status !== 200) {
    try {
      await response.body?.cancel();
    } catch {
      // The answer is closed regardless.
    }
    return closed();
  }

  let raw;
  try {
    raw = await readLimited(response);
  } catch {
    return closed();
  }
  if (raw === null) return closed();

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return closed();
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return closed();
  if (typeof body.allowed !== 'boolean') return closed();
  if (typeof body.access !== 'string' || !Object.hasOwn(ACCESS_BY_OPERATION, body.access)) return closed();
  if (!consistent(body.allowed, body.access, operation)) return closed();
  return { access: body.access, allowed: body.allowed };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function base64url(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// The page does not receive a publishable key from wrangler. The key is public
// and only encodes the Frontend API host, so build it from CLERK_ISSUER.
function publishableKeyFor(issuer) {
  const instance = issuer.host.endsWith('.clerk.accounts.dev') ? 'pk_test_' : 'pk_live_';
  return instance + base64url(issuer.host + '$');
}

function nonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function page(config) {
  const clerkScript = new URL(
    `/npm/@clerk/clerk-js@${CLERK_JS_VERSION}/dist/clerk.browser.js`,
    config.issuer.origin,
  ).href;
  const signIn = new URL('/sign-in', config.issuer.origin);
  signIn.searchParams.set('redirect_url', config.site.origin + '/');
  const scriptNonce = nonce();
  const publishableKey = publishableKeyFor(config.issuer);

  const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>見本のサービス</title>
<style>
:root { color-scheme: light dark; font-family: system-ui, sans-serif; }
body { margin: 0; }
main { max-width: 40rem; margin: 0 auto; padding: 2rem 1rem; }
h1 { font-size: 1.5rem; }
#status { min-height: 1.5em; }
#sign-in { display: inline-block; margin-top: 1rem; }
#result[hidden], #sign-in[hidden] { display: none; }
ul { padding-left: 1.25rem; }
</style>
</head>
<body>
<main>
<h1>見本のサービス</h1>
<p>この頁は、Clerk の session と中央の利用権の照会を確かめる見本です。</p>
<p id="status" role="status">利用権を確認しています。</p>
<a id="sign-in" href="${escapeHtml(signIn.href)}" hidden>ログイン</a>
<section id="result" hidden>
<p>結果: <strong id="access">-</strong></p>
<ul>
<li>閲覧: <span id="operation-view">-</span></li>
<li>編集: <span id="operation-edit">-</span></li>
<li>書き出し: <span id="operation-export">-</span></li>
</ul>
</section>
<noscript>この頁の確認には JavaScript が必要です。</noscript>
</main>
<script src="${escapeHtml(clerkScript)}"></script>
<script nonce="${scriptNonce}">
const PUBLISHABLE_KEY = ${JSON.stringify(publishableKey)};
const LABELS = ${JSON.stringify(ACCESS_LABELS)};
const OPERATIONS = ['view', 'edit', 'export'];
const status = document.getElementById('status');
const signIn = document.getElementById('sign-in');
const result = document.getElementById('result');
const access = document.getElementById('access');
const cells = Object.fromEntries(OPERATIONS.map(operation => [operation, document.getElementById('operation-' + operation)]));

async function sessionToken() {
  try {
    if (!window.Clerk) return null;
    const clerk = new window.Clerk(PUBLISHABLE_KEY);
    await clerk.load();
    if (!clerk.session) return null;
    return await clerk.session.getToken({ skipCache: true });
  } catch {
    return null;
  }
}

async function read(operation, token) {
  const response = await fetch('/api/access?operation=' + operation, {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: token ? { Authorization: 'Bearer ' + token } : {},
  });
  if (response.status === 401) return { unauthorized: true };
  if (!response.ok) return { invalid: true };
  const body = await response.json();
  if (typeof body.allowed !== 'boolean' || typeof body.access !== 'string' || !LABELS[body.access]) {
    return { invalid: true };
  }
  return body;
}

(async () => {
  const token = await sessionToken();
  const answers = await Promise.all(OPERATIONS.map(operation => read(operation, token).catch(() => ({ invalid: true }))));
  if (answers.some(answer => answer.unauthorized)) {
    status.textContent = 'ログインしてください。';
    signIn.hidden = false;
    return;
  }
  if (answers.some(answer => answer.invalid)) {
    status.textContent = '利用権を確認できませんでした。時間をおいて再読み込みしてください。';
    return;
  }
  const value = answers.every(answer => answer.access === answers[0].access) ? answers[0].access : 'closed';
  access.textContent = LABELS[value];
  for (const [index, operation] of OPERATIONS.entries()) {
    cells[operation].textContent = answers[index].allowed ? '可' : '不可';
  }
  result.hidden = false;
  status.textContent = '';
})();
</script>
</body>
</html>`;

  const policy = [
    "default-src 'none'",
    `script-src 'self' 'nonce-${scriptNonce}' ${config.issuer.origin}`,
    `style-src 'self' 'unsafe-inline' ${config.issuer.origin}`,
    `connect-src 'self' ${config.issuer.origin}`,
    `img-src 'self' data: ${config.issuer.origin}`,
    `font-src 'self' ${config.issuer.origin}`,
    "base-uri 'none'",
    `form-action 'self' ${config.issuer.origin}`,
    "frame-ancestors 'none'",
  ].join('; ');

  return new Response(html, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Security-Policy': policy,
      'Content-Type': 'text/html; charset=utf-8',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function access(request, env) {
  const config = configuration(env);
  if (!config) return json({ error: 'unavailable' }, 503);

  const principal = await authenticated(request, config);
  if (!principal) return json({ error: 'unauthorized' }, 401);

  const url = new URL(request.url);
  const operations = url.searchParams.getAll('operation');
  if (operations.length !== 1 || !OPERATIONS.has(operations[0])) {
    return json({ error: 'invalid_request' }, 400);
  }
  for (const key of url.searchParams.keys()) {
    if (key !== 'operation') return json({ error: 'invalid_request' }, 400);
  }

  const decision = await askCentral(config, principal.subject, principal.organizationId, operations[0]);
  return json(decision, 200);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/') {
      if (request.method !== 'GET') return methodNotAllowed('GET');
      const config = configuration(env);
      if (!config) return text('unavailable', 503);
      return page(config);
    }
    if (url.pathname === '/api/access') {
      if (request.method !== 'GET') return methodNotAllowed('GET');
      return access(request, env);
    }
    return json({ error: 'not_found' }, 404);
  },
};
