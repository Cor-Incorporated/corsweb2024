import type { TrustedContactSession } from './storage';
import { AUTO_HANDOFF_INTENTS } from './types';
import type { Env, HandoffConsent, NormalizedInquiry, StructuredLead } from './types';
import { maskSensitiveContent } from './validate';

export type { HandoffConsent } from './types';

export const GRIFT_TIMEOUT_MS = 8_000;
export const GRIFT_MAX_RESPONSE_BYTES = 32 * 1024;
export const GRIFT_MAX_PORTAL_TTL_MS = 5 * 60 * 1000;

const GRIFT_INTAKE_PATH = '/v1/internal/cloudia/intake-sessions';
const HANDOFF_SCHEMA_VERSION = 'cloudia-grift-handoff.v1';
const CONSENT_VERSION = 'cloudia-grift-v1';
const MAX_URL_LENGTH = 2_048;
const SAFE_OPAQUE_ID = /^[A-Za-z0-9._:-]{1,256}$/;
const GRIFT_PORTAL_PATH = '/chat/portal';
const GRIFT_EXCHANGE_FRAGMENT = /^#exchange_code=([A-Za-z0-9_-]{43})$/;
// A canonical no-padding base64url encoding of 32 bytes has 43 characters;
// its final character carries four data bits and two zero padding bits.
const GRIFT_32_BYTE_BASE64URL = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;

export type BrowserHandoff =
  | { status: 'ready'; url: string; expiresAt: string }
  | { status: 'fallback' };

interface GriftHandoffInput {
  submissionId: string;
  inquiry: NormalizedInquiry;
  session: TrustedContactSession | null;
  consent: HandoffConsent | null;
}

type FailureReason =
  | 'config'
  | 'timeout'
  | 'network'
  | 'http_4xx'
  | 'http_5xx'
  | 'http_other'
  | 'response_oversize'
  | 'response_not_json'
  | 'response_invalid'
  | 'url_not_allowed';

type BoundedJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: 'response_oversize' | 'response_not_json' };

interface GriftAuthContext {
  method: 'POST';
  pathname: string;
  body: string;
}

/** Authentication boundary kept replaceable so a future HMAC contract is local to this module. */
interface GriftAuthenticator {
  headers(context: GriftAuthContext): Promise<Record<string, string>>;
}

class BearerServiceSecretAuthenticator implements GriftAuthenticator {
  constructor(private readonly secret: string) {}

  async headers(_context: GriftAuthContext): Promise<Record<string, string>> {
    return { authorization: `Bearer ${this.secret}` };
  }
}

function getAuthenticator(env: Env): GriftAuthenticator | null {
  const secret = env.CLOUDIA_HANDOFF_AUTH_TOKEN;
  if (!secret || secret.length > 4_096 || /[\s\x00-\x1f\x7f]/.test(secret)) return null;
  return new BearerServiceSecretAuthenticator(secret);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeIsoTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || value.length < 1 || value.length > 64) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export function normalizeHandoffConsent(
  raw: unknown,
  workerReceivedAt: string = new Date().toISOString(),
): HandoffConsent | null {
  if (!isRecord(raw)) return null;
  if (
    raw.accepted !== true
    || raw.version !== CONSENT_VERSION
    || raw.summaryConfirmed !== true
  ) return null;
  const browserAcceptedAt = normalizeIsoTimestamp(raw.acceptedAt);
  const acceptedAt = normalizeIsoTimestamp(workerReceivedAt);
  if (!browserAcceptedAt || !acceptedAt) return null;
  return {
    accepted: true,
    version: CONSENT_VERSION,
    acceptedAt,
    browserAcceptedAt,
    summaryConfirmed: true,
  };
}

function logFailure(reason: FailureReason): void {
  // Fixed enums only: never log request data, IDs, tokens, service secrets, or portal URLs.
  console.error(JSON.stringify({ event: 'contact_chat_grift_handoff_failed', reason }));
}

function fallback(reason?: FailureReason): BrowserHandoff {
  if (reason) logFailure(reason);
  return { status: 'fallback' };
}

function isForbiddenNetworkHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (
    host === 'localhost'
    || host.endsWith('.localhost')
    || host.endsWith('.local')
    || host.endsWith('.internal')
  ) return true;
  // Configured service origins must use DNS names. Rejecting all IP literals
  // prevents loopback, link-local, private-range and alternate numeric SSRF forms.
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)
    || (host.startsWith('[') && host.endsWith(']'));
}

function parseHttpsOrigin(raw: string | undefined): string | null {
  if (!raw || raw.length > MAX_URL_LENGTH) return null;
  try {
    const url = new URL(raw);
    if (
      url.protocol !== 'https:'
      || url.username
      || url.password
      || (url.pathname !== '/' && url.pathname !== '')
      || url.search
      || url.hash
      || isForbiddenNetworkHost(url.hostname)
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function parseAllowedOrigins(raw: string | undefined): Set<string> | null {
  if (!raw || raw.length > 4_096) return null;
  const values = raw.split(',').map((value) => value.trim()).filter(Boolean);
  if (values.length < 1 || values.length > 16) return null;
  const origins = new Set<string>();
  for (const value of values) {
    if (value.includes('*')) return null;
    const origin = parseHttpsOrigin(value);
    let hasExplicitPort = false;
    try {
      hasExplicitPort = Boolean(new URL(value).port);
    } catch {
      return null;
    }
    // Public origins are exact configuration values. Equality rejects a
    // trailing slash, explicit default port, path aliases, and normalization.
    if (!origin || hasExplicitPort || value !== origin) return null;
    origins.add(origin);
  }
  return origins;
}

function safeLeadValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const safe = maskSensitiveContent(value).trim();
  return safe || undefined;
}

function buildStructuredLead(lead: StructuredLead): Record<string, string> {
  const entries: Array<[string, string | undefined]> = [
    ['purpose', safeLeadValue(lead.purpose)],
    ['industry_role', safeLeadValue(lead.industryRole)],
    ['data_sensitivity', safeLeadValue(lead.dataSensitivity)],
    ['stage', safeLeadValue(lead.stage)],
    ['timing_budget', safeLeadValue(lead.timingBudget)],
  ];
  return Object.fromEntries(entries.filter((entry): entry is [string, string] => Boolean(entry[1])));
}

function buildPayload(input: GriftHandoffInput): Record<string, unknown> {
  const session = input.session;
  if (!session || !input.consent) throw new Error('handoff precondition missing');
  return {
    schema_version: HANDOFF_SCHEMA_VERSION,
    intent: 'contract-dev',
    source: 'corsweb-contact-chat',
    locale: session.locale,
    contact: {
      name: input.inquiry.name,
      email: input.inquiry.email,
      company: input.inquiry.company,
    },
    inquiry: {
      message: input.inquiry.message,
      // Use the D1-restored session value directly. The inquiry copy is checked
      // below as defense in depth, but it is never the authority for handoff.
      summary: session.summary,
      structured_lead: buildStructuredLead(session.structuredLead),
    },
    consent: {
      version: input.consent.version,
      accepted_at: input.consent.acceptedAt,
    },
  };
}

async function cancelReader(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
  try {
    await reader.cancel();
  } catch {
    // Best effort only; the caller is already rejecting the response.
  }
}

async function readBoundedJson(response: Response): Promise<BoundedJsonResult> {
  const declaredLength = response.headers.get('content-length');
  if (declaredLength !== null) {
    const length = Number(declaredLength);
    if (!Number.isSafeInteger(length) || length < 0) {
      return { ok: false, reason: 'response_not_json' };
    }
    if (length > GRIFT_MAX_RESPONSE_BYTES) {
      return { ok: false, reason: 'response_oversize' };
    }
  }
  const contentType = response.headers.get('content-type') || '';
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    return { ok: false, reason: 'response_not_json' };
  }
  if (!response.body) return { ok: false, reason: 'response_not_json' };

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    total += chunk.value.byteLength;
    if (total > GRIFT_MAX_RESPONSE_BYTES) {
      await cancelReader(reader);
      return { ok: false, reason: 'response_oversize' };
    }
    chunks.push(chunk.value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes);
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, reason: 'response_not_json' };
  }
}

function parseSuccessResponse(
  value: unknown,
  allowedOrigins: Set<string>,
  expectedSubmissionId: string,
): BrowserHandoff | 'response_invalid' | 'url_not_allowed' {
  if (!isRecord(value)) return 'response_invalid';
  if (
    typeof value.submission_id !== 'string'
    || !SAFE_OPAQUE_ID.test(value.submission_id)
    || value.submission_id !== expectedSubmissionId
    || typeof value.case_id !== 'string'
    || !SAFE_OPAQUE_ID.test(value.case_id)
    || typeof value.duplicate !== 'boolean'
    || typeof value.chat_url !== 'string'
    || value.chat_url.length < 1
    || value.chat_url.length > MAX_URL_LENGTH
  ) {
    return 'response_invalid';
  }
  const expiresAt = normalizeIsoTimestamp(value.expires_at);
  const now = Date.now();
  const expiresAtMs = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  if (
    !expiresAt
    || expiresAtMs <= now
    || expiresAtMs > now + GRIFT_MAX_PORTAL_TTL_MS
  ) return 'response_invalid';
  try {
    const portalUrl = new URL(value.chat_url);
    if (
      portalUrl.protocol !== 'https:'
      || portalUrl.username
      || portalUrl.password
      || portalUrl.port
      || portalUrl.search
      || !allowedOrigins.has(portalUrl.origin)
      || portalUrl.pathname !== GRIFT_PORTAL_PATH
    ) {
      return 'url_not_allowed';
    }
    const fragment = GRIFT_EXCHANGE_FRAGMENT.exec(portalUrl.hash);
    if (!fragment || !GRIFT_32_BYTE_BASE64URL.test(fragment[1])) return 'url_not_allowed';
    const canonical = `${portalUrl.origin}${GRIFT_PORTAL_PATH}#exchange_code=${fragment[1]}`;
    if (value.chat_url !== canonical) return 'url_not_allowed';
    return { status: 'ready', url: value.chat_url, expiresAt };
  } catch {
    return 'response_invalid';
  }
}

export async function handoffToGrift(env: Env, input: GriftHandoffInput): Promise<BrowserHandoff | null> {
  if (!input.consent) return null;

  const handoffRequested = (AUTO_HANDOFF_INTENTS as readonly string[]).includes(input.inquiry.intent);
  if (!handoffRequested) return null;
  if (
    !input.session
    || !(AUTO_HANDOFF_INTENTS as readonly string[]).includes(input.session.intent)
    || input.session.intent !== input.inquiry.intent
    || input.session.classification !== 'genuine'
    || !input.session.summary
    || !input.inquiry.summaryText
    || input.inquiry.summaryText !== input.inquiry.conversationSummary
    || input.inquiry.summaryText !== input.session.summary
  ) {
    return fallback();
  }
  if (env.GRIFT_HANDOFF_ENABLED !== 'true') return fallback();

  const apiOrigin = parseHttpsOrigin(env.GRIFT_API_ORIGIN);
  const allowedOrigins = parseAllowedOrigins(env.GRIFT_PUBLIC_URL_ORIGINS);
  const authenticator = getAuthenticator(env);
  if (!apiOrigin || !allowedOrigins || !authenticator) return fallback('config');

  const endpoint = new URL(GRIFT_INTAKE_PATH, apiOrigin);
  const body = JSON.stringify(buildPayload(input));
  const authContext: GriftAuthContext = { method: 'POST', pathname: endpoint.pathname, body };
  const authHeaders = await authenticator.headers(authContext);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GRIFT_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetch(endpoint.toString(), {
        method: 'POST',
        redirect: 'manual',
        headers: {
          ...authHeaders,
          'content-type': 'application/json',
          'idempotency-key': input.submissionId,
        },
        body,
        signal: controller.signal,
      });
    } catch {
      return fallback(controller.signal.aborted ? 'timeout' : 'network');
    }

    if (!response.ok) {
      if (response.status >= 400 && response.status < 500) return fallback('http_4xx');
      if (response.status >= 500) return fallback('http_5xx');
      return fallback('http_other');
    }

    let parsed: BoundedJsonResult;
    try {
      parsed = await readBoundedJson(response);
    } catch {
      return fallback(controller.signal.aborted ? 'timeout' : 'response_not_json');
    }
    if (!parsed.ok) return fallback(parsed.reason);
    const result = parseSuccessResponse(parsed.value, allowedOrigins, input.submissionId);
    return typeof result === 'string' ? fallback(result) : result;
  } finally {
    clearTimeout(timeout);
  }
}
