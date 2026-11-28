import { verifyToken } from '@clerk/backend';
import { paidEntitlement } from './index.js';
import { services } from './services.js';

export { paidEntitlement };

const dayMs = 86_400_000;
const subjectPattern = /^user_[A-Za-z0-9_]{1,123}$/;
function httpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

function response(body, status) {
  return Response.json(body, { status, headers: {
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Cookie, Authorization',
  } });
}

export async function fetchServicePicker(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== '/api/account/services' || url.search) return response({ error: 'not_found' }, 404);
  if (request.method !== 'GET') return response({ error: 'method_not_allowed' }, 405);
  const fetchSite = request.headers.get('Sec-Fetch-Site');
  if (fetchSite && fetchSite !== 'same-origin') return response({ error: 'forbidden' }, 403);

  const site = httpsUrl(env.ACCOUNT_SITE_ORIGIN);
  const issuer = httpsUrl(env.CLERK_ISSUER);
  const signIn = httpsUrl(env.CLERK_SIGN_IN_URL);
  if (!site || url.origin !== site.origin || !issuer || issuer.origin !== env.CLERK_ISSUER || !signIn || !env.CLERK_JWT_KEY) {
    return response({ error: 'unavailable' }, 503);
  }
  signIn.searchParams.set('redirect_url', new URL('/account/services/', site).href);
  const unauthorized = () => response({ error: 'sign_in_required', signInUrl: signIn.href }, 401);
  const tokens = (request.headers.get('Cookie') ?? '').split(';').map(value => value.trim()).filter(value => value.startsWith('__session='));
  const authorization = request.headers.get('Authorization');
  const token = authorization === null
    ? (tokens.length === 1 ? tokens[0].slice('__session='.length) : '')
    : (/^Bearer ([\w.-]+)$/.exec(authorization)?.[1] ?? '');

  if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token) || token.length > 8192) return unauthorized();

  let claims;
  try {
    claims = await verifyToken(token, {
      jwtKey: env.CLERK_JWT_KEY, issuer: issuer.origin, authorizedParties: [site.origin], clockSkewInMs: 0,
    });
  } catch {
    return unauthorized();
  }
  if (claims.iss !== issuer.origin || claims.azp !== site.origin || !subjectPattern.test(claims.sub ?? '')
      || !/^sess_[A-Za-z0-9_]+$/.test(claims.sid ?? '') || claims.v !== 2 || claims.sts === 'pending'
      || !Number.isInteger(claims.exp) || !Number.isInteger(claims.nbf)
      || claims.exp <= Math.floor(Date.now() / 1000)) return unauthorized();

  const organizationId = claims.o?.id;
  if (claims.o != null && (typeof organizationId !== 'string' || !/^org_[A-Za-z0-9_]+$/.test(organizationId))) {
    return unauthorized();
  }

  try {
    const today = new Date(Date.now() + 9 * dayMs / 24).toISOString().slice(0, 10);
    const db = env.ACCOUNT_GRANTS.withSession('first-primary');
    const accessByService = new Map();
    if (organizationId) {
      // Product roots resolve the user's existing workspace. An organization subscription
      // can list a product only when this user is enrolled in one of its product tenants.
      const { results } = await db.prepare(`
        SELECT m.service, s.services_json, MAX(g.id IS NOT NULL) AS personal_access
        FROM paid_contract_members AS m
        LEFT JOIN paid_contract_snapshots AS s
          ON s.issuer = m.issuer AND s.organization_id = m.organization_id
          AND unixepoch(s.expires_at) > unixepoch('now')
        LEFT JOIN account_grants AS g
          ON g.issuer = m.issuer AND g.subject = m.subject AND g.service = m.service AND g.tenant_id = m.tenant_id
          AND g.revoked_at IS NULL AND g.starts_on <= ?4 AND g.ends_on >= ?4
        WHERE m.issuer = ?1 AND m.subject = ?2 AND m.organization_id = ?3 AND m.revoked_at IS NULL
        GROUP BY m.service, s.services_json
      `).bind(issuer.origin, claims.sub, organizationId, today).all();
      for (const row of results) {
        const access = row.personal_access ? 'open' : paidEntitlement(JSON.parse(row.services_json), row.service, today);
        accessByService.set(row.service, access);
      }
    } else {
      const { results } = await db.prepare(`
        SELECT DISTINCT service FROM account_grants
        WHERE issuer = ?1 AND subject = ?2 AND kind IN ('staff', 'legacy')
          AND revoked_at IS NULL AND starts_on <= ?3 AND ends_on >= ?3
      `).bind(issuer.origin, claims.sub, today).all();
      for (const row of results) accessByService.set(row.service, 'open');
    }
    const entries = [];
    for (const product of services) {
      if (product.status !== 'active' || !product.listed || !product.entryUrlVar) continue;
      const access = accessByService.get(product.id) ?? 'closed';
      if (access === 'closed') continue;
      const target = httpsUrl(env[product.entryUrlVar]);
      if (!target || target.port || !target.hostname.endsWith('.cor-jp.com') || target.hostname === site.hostname) {
        return response({ error: 'unavailable' }, 503);
      }
      entries.push({ id: product.id, label: product.label, href: target.href, access });
    }
    return response({ services: entries }, 200);
  } catch {
    return response({ error: 'unavailable' }, 503);
  }
}
