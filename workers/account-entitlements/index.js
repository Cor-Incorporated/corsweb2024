const QUERY_PATH = '/v1/entitlements/check';
const CONTRACT_QUERY_PATH = '/v2/entitlements/check';
const MAX_BODY = 2048;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;
const encoder = new TextEncoder();

const dayMs = 86_400_000;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function dateEpoch(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const epoch = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(epoch) && new Date(epoch).toISOString().slice(0, 10) === value ? epoch : NaN;
}

export function paidEntitlement(services, service, today) {
  const row = object(services) && Object.hasOwn(services, service) ? services[service] : null;
  if (!object(row) || typeof row.hold !== 'boolean') return 'closed';
  const now = dateEpoch(today);
  const from = dateEpoch(row.from);
  const until = row.until == null ? null : dateEpoch(row.until);
  if (!Number.isFinite(now) || !Number.isFinite(from) || (until !== null && !Number.isFinite(until)) || now < from) return 'closed';
  if (until !== null && now > until) return now <= until + 30 * dayMs ? 'read_export_only' : 'closed';
  return row.hold ? 'view_only' : 'open';
}

const accessByOperation = {
  open: ['view', 'edit', 'export'],
  view_only: ['view'],
  read_export_only: ['view', 'export'],
  closed: [],
};

function permits(access, operation) {
  return accessByOperation[access].includes(operation);
}

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
    const versioned = url.pathname === CONTRACT_QUERY_PATH;
    if ((!versioned && url.pathname !== QUERY_PATH) || url.search) return json({ error: 'not_found' }, 404);
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    const supplied = /^Bearer ([A-Za-z0-9_-]{43,128})$/i.exec(request.headers.get('Authorization') ?? '')?.[1];
    if (!supplied) return json({ error: 'unauthorized' }, 401);

    const body = await readRequest(request);
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== (versioned ? 6 : 4)) {
      return json({ error: 'invalid_input' }, 400);
    }
    const { service, issuer, subject, tenantId, organizationId, operation } = body;
    const credentials = {
      'business-dossier': env.BD_ENTITLEMENT_QUERY_TOKEN,
      xesm: env.XESM_ENTITLEMENT_QUERY_TOKEN,
      harbor: env.HARBOR_ENTITLEMENT_QUERY_TOKEN,
    };
    if (typeof service !== 'string' || !Object.hasOwn(credentials, service)
        || (versioned && service === 'harbor')
        || typeof issuer !== 'string' || issuer.length > 255
        || typeof subject !== 'string' || !/^user_[A-Za-z0-9_]{1,123}$/.test(subject)
        || typeof tenantId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(tenantId)
        || (versioned && (!['view', 'edit', 'export'].includes(operation)
          || (organizationId !== null && (typeof organizationId !== 'string'
            || !/^org_[A-Za-z0-9_]{1,123}$/.test(organizationId)))))) {
      return json({ error: 'invalid_input' }, 400);
    }

    const expected = credentials[service];
    if (!TOKEN_PATTERN.test(expected ?? '') || !isHttpsOrigin(env.CLERK_ISSUER)) {
      return json({ error: 'unavailable' }, 503);
    }
    for (const [otherService, token] of Object.entries(credentials)) {
      if (otherService !== service && token && await tokensMatch(expected, token)) {
        return json({ error: 'unavailable' }, 503);
      }
    }
    if (!(await tokensMatch(expected, supplied))) return json({ error: 'unauthorized' }, 401);
    const decision = access => json(versioned ? { allowed: permits(access, operation), access } : {
      allowed: access === 'open',
    }, 200);
    if (issuer !== env.CLERK_ISSUER) return decision('closed');

    try {
      // Bind to the primary. Every request rechecks grant validity and revocation.
      const db = env.ACCOUNT_GRANTS.withSession('first-primary');
      const row = await db.prepare(`
        SELECT EXISTS (
          SELECT 1 FROM account_grants
          WHERE issuer = ?1 AND subject = ?2 AND service = ?3 AND tenant_id = ?4
            AND revoked_at IS NULL
            AND starts_on <= date('now', '+9 hours') AND ends_on >= date('now', '+9 hours')
        ) AS allowed
      `).bind(issuer, subject, service, tenantId).first();
      if (row?.allowed !== 0 && row?.allowed !== 1) return json({ error: 'unavailable' }, 503);
      if (row.allowed === 1) return decision('open');
      if (!versioned || organizationId === null) return decision('closed');

      // The product authenticates its subject. Independently scope the paid
      // projection to an approved organization, subject and product tenant.
      const contract = await db.prepare(`
        SELECT s.services_json, date('now', '+9 hours') AS today
        FROM paid_contract_members AS m
        JOIN paid_contract_snapshots AS s
          ON s.issuer = m.issuer AND s.organization_id = m.organization_id
        WHERE m.issuer = ?1 AND m.subject = ?2 AND m.service = ?3 AND m.tenant_id = ?4
          AND m.organization_id = ?5 AND m.revoked_at IS NULL
          AND unixepoch(s.expires_at) > unixepoch('now')
      `).bind(issuer, subject, service, tenantId, organizationId).first();
      return decision(contract ? paidEntitlement(JSON.parse(contract.services_json), service, contract.today) : 'closed');
    } catch {
      return json({ error: 'unavailable' }, 503);
    }
  },
};
