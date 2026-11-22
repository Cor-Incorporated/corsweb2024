import { verifyToken } from '@clerk/backend';

const products = {
  'business-dossier': 'BD_SERVICE_URL',
  xesm: 'XESM_SERVICE_URL',
};
const dayMs = 86_400_000;
const subjectPattern = /^user_[A-Za-z0-9_]{1,123}$/;
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
    const individualServices = new Set();
    if (!organizationId) {
      const { results } = await env.ACCOUNT_GRANTS.withSession('first-primary').prepare(`
        SELECT DISTINCT service FROM account_grants
        WHERE issuer = ?1 AND subject = ?2 AND kind IN ('staff', 'legacy')
          AND revoked_at IS NULL AND starts_on <= ?3 AND ends_on >= ?3
      `).bind(issuer.origin, claims.sub, today).all();
      for (const row of results) individualServices.add(row.service);
    }
    // cor_svc = the selected organization's public_metadata.services, set by the Clerk session template.
    // Cap willingness to use paid metadata at the ADR's 60-second refresh window.
    const freshPaidClaim = organizationId && Number.isInteger(claims.iat) && Date.now() < (claims.iat + 60) * 1000;
    const organizationServices = freshPaidClaim ? claims.cor_svc : undefined;
    const services = [];
    for (const [id, binding] of Object.entries(products)) {
      const access = individualServices.has(id) ? 'open' : paidEntitlement(organizationServices, id, today);
      if (access === 'closed') continue;
      const target = httpsUrl(env[binding]);
      if (!target || target.port || !target.hostname.endsWith('.cor-jp.com') || target.hostname === site.hostname) {
        return response({ error: 'unavailable' }, 503);
      }
      services.push({ id, href: target.href, access });
    }
    return response({ services }, 200);
  } catch {
    return response({ error: 'unavailable' }, 503);
  }
}
