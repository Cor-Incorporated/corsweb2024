const QUERY_PATH = '/v1/entitlements/check';
const MAX_BODY = 2048;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;
const encoder = new TextEncoder();

function json(body, status) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

async function readRequest(request) {
  if (!request.body || !/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') ?? '')) {
    return null;
  }
  const reader = request.body.getReader();
  const buffer = new Uint8Array(MAX_BODY);
  let offset = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (offset + value.length > MAX_BODY) {
        await reader.cancel();
        return null;
      }
      buffer.set(value, offset);
      offset += value.length;
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, offset)));
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

function isHttpsOrigin(value) {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && parsed.origin === value;
  } catch {
    return false;
  }
}

async function tokensMatch(expected, supplied) {
  const [expectedHash, suppliedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
    crypto.subtle.digest('SHA-256', encoder.encode(supplied)),
  ]);
  return crypto.subtle.timingSafeEqual(expectedHash, suppliedHash);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== QUERY_PATH || url.search) return json({ error: 'not_found' }, 404);
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    const supplied = /^Bearer ([A-Za-z0-9_-]{43,128})$/i.exec(request.headers.get('Authorization') ?? '')?.[1];
    if (!supplied) return json({ error: 'unauthorized' }, 401);

    const body = await readRequest(request);
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 4) {
      return json({ error: 'invalid_input' }, 400);
    }
    const { service, issuer, subject, tenantId } = body;
    if ((service !== 'business-dossier' && service !== 'xesm')
        || typeof issuer !== 'string' || issuer.length > 255
        || typeof subject !== 'string' || !/^user_[A-Za-z0-9_]{1,123}$/.test(subject)
        || typeof tenantId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(tenantId)) {
      return json({ error: 'invalid_input' }, 400);
    }

    const bd = env.BD_ENTITLEMENT_QUERY_TOKEN;
    const xesm = env.XESM_ENTITLEMENT_QUERY_TOKEN;
    const expected = service === 'business-dossier' ? bd : xesm;
    if (!TOKEN_PATTERN.test(expected ?? '') || !isHttpsOrigin(env.CLERK_ISSUER)
        || (bd && xesm && await tokensMatch(bd, xesm))) {
      return json({ error: 'unavailable' }, 503);
    }
    if (!(await tokensMatch(expected, supplied))) return json({ error: 'unauthorized' }, 401);
    if (issuer !== env.CLERK_ISSUER) return json({ allowed: false }, 200);

    try {
      // Bind to the primary. Every request rechecks grant validity and revocation.
      const row = await env.ACCOUNT_GRANTS.withSession('first-primary').prepare(`
        SELECT EXISTS (
          SELECT 1 FROM account_grants
          WHERE issuer = ?1 AND subject = ?2 AND service = ?3 AND tenant_id = ?4
            AND revoked_at IS NULL
            AND starts_on <= date('now', '+9 hours') AND ends_on >= date('now', '+9 hours')
        ) AS allowed
      `).bind(issuer, subject, service, tenantId).first();
      if (row?.allowed !== 0 && row?.allowed !== 1) return json({ error: 'unavailable' }, 503);
      return json({ allowed: row.allowed === 1 }, 200);
    } catch {
      return json({ error: 'unavailable' }, 503);
    }
  },
};
