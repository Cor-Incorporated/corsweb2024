import type { Env } from './types';

// --- IP単位の簡易レート制限（isolate内メモリ・ベストエフォート） ---
// yomimono のログイン失敗レート制限と同方針。確実な対策は Cloudflare WAF のレート制限ルール。
// 用途別に窓を分ける（chat は会話のため緩め、submit は厳しめ）。
interface Bucket {
  n: number;
  resetAt: number;
}
const buckets = new Map<string, Bucket>();

export interface RateLimitConfig {
  windowMs: number;
  max: number;
}

export const CHAT_LIMIT: RateLimitConfig = { windowMs: 60 * 1000, max: 20 }; // 1分20回
export const SUBMIT_LIMIT: RateLimitConfig = { windowMs: 10 * 60 * 1000, max: 5 }; // 10分5回

// true を返したらレート制限超過（429を返すべき）。
export function isRateLimited(key: string, cfg: RateLimitConfig, now: number = Date.now()): boolean {
  if (buckets.size > 10000) buckets.clear(); // 暴走防止（best-effort）
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { n: 1, resetAt: now + cfg.windowMs });
    return false;
  }
  b.n += 1;
  return b.n > cfg.max;
}

// テスト用にバケットを初期化。
export function resetRateLimits(): void {
  buckets.clear();
}

export function clientIp(req: Request): string {
  return req.headers.get('CF-Connecting-IP') || 'unknown';
}

// --- 定数時間比較（タイミング攻撃対策。yomimono session.ts と同実装） ---
export function ctEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// --- Cloudflare Turnstile 検証（reCAPTCHA 代替） ---
// TURNSTILE_REQUIRED=false/未設定は後方互換モード。secret が無ければ検証をスキップし、
// secret があれば従来どおり /submit を検証する。true は production 向け fail-closed モード。
const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_TIMEOUT_MS = 8_000;
const TURNSTILE_TOKEN_MAX_LENGTH = 2_048;
const TURNSTILE_TOKEN_MAX_AGE_MS = 5 * 60 * 1_000;
const TURNSTILE_MAX_FUTURE_SKEW_MS = 60 * 1_000;
const RFC3339_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

/** Cloudia explicit widget と Worker の単一 action 契約。旧 action は受け入れない。 */
export const TURNSTILE_EXPECTED_ACTION = 'contact-submit';

const CLIENT_ERROR_CODES = new Set([
  'missing-input-response',
  'invalid-input-response',
  'timeout-or-duplicate',
]);
const SERVER_ERROR_CODES = new Set([
  'missing-input-secret',
  'invalid-input-secret',
  'bad-request',
  'internal-error',
]);

interface SiteverifyResponse {
  success?: unknown;
  challenge_ts?: unknown;
  hostname?: unknown;
  action?: unknown;
  'error-codes'?: unknown;
}

export type TurnstileResult =
  | { ok: true; skipped: boolean }
  | { ok: false; status: number; error: string };

const turnstileUnavailable = (): TurnstileResult => ({
  ok: false,
  status: 503,
  error: 'Turnstile 検証を完了できませんでした。時間をおいて再試行してください',
});

const turnstileRejected = (status = 403): TurnstileResult => ({
  ok: false,
  status,
  error: 'Turnstile 検証に失敗しました。ウィジェットを再実行してください',
});

function requiredMode(value: string | undefined): boolean | null {
  if (value === undefined || value === '' || value === 'false') return false;
  if (value === 'true') return true;
  return null;
}

function allowedHostnames(value: string | undefined): Set<string> | null {
  if (typeof value !== 'string') return null;
  const hostnames = value.split(',').map((hostname) => hostname.trim());
  if (hostnames.length === 0 || hostnames.some((hostname) => !hostname)) return null;

  const unique = new Set<string>();
  for (const hostname of hostnames) {
    if (
      hostname.length > 253
      || hostname !== hostname.toLowerCase()
      || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(hostname)
      || hostname.includes('..')
      || hostname.split('.').some((label) => (
        !label || label.length > 63 || label.startsWith('-') || label.endsWith('-')
      ))
      || unique.has(hostname)
    ) {
      return null;
    }
    unique.add(hostname);
  }
  return unique;
}

function errorCodes(data: SiteverifyResponse): string[] | null {
  if (data['error-codes'] === undefined && data.success === true) return [];
  if (!Array.isArray(data['error-codes'])) return null;
  if (data['error-codes'].some((code) => typeof code !== 'string' || !code)) return null;
  return data['error-codes'] as string[];
}

export async function verifyTurnstile(
  env: Env,
  token: unknown,
  ip: string,
): Promise<TurnstileResult> {
  const required = requiredMode(env.TURNSTILE_REQUIRED);
  if (required === null) return turnstileUnavailable();

  const secret = env.TURNSTILE_SECRET;
  if (!secret) {
    if (required) return turnstileUnavailable();
    // 後方互換: required-off かつ secret 未設定時だけ検証をスキップする。
    return { ok: true, skipped: true };
  }
  if (typeof token !== 'string' || !token) {
    return { ok: false, status: 400, error: 'Turnstile トークンが必要です' };
  }
  // Cloudflare 契約は最大 2048 文字。過大入力は外部呼び出し前に拒否する。
  if (token.length > TURNSTILE_TOKEN_MAX_LENGTH) {
    return { ok: false, status: 400, error: 'Turnstile トークンが不正です' };
  }
  const hostnames = allowedHostnames(env.TURNSTILE_ALLOWED_HOSTNAMES);
  if (!hostnames) return turnstileUnavailable();

  const form = new URLSearchParams();
  form.set('secret', secret);
  form.set('response', token);
  if (ip && ip !== 'unknown') form.set('remoteip', ip);

  let data: SiteverifyResponse;
  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      signal: AbortSignal.timeout(TURNSTILE_TIMEOUT_MS),
    });
    if (!res.ok) return turnstileUnavailable();
    const parsed: unknown = await res.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return turnstileUnavailable();
    data = parsed as SiteverifyResponse;
  } catch {
    // timeout・到達不能・malformed JSON はすべて fail closed。値はログへ出さない。
    return turnstileUnavailable();
  }

  const codes = errorCodes(data);
  if (!codes) return turnstileUnavailable();
  if (data.success !== true) {
    if (data.success !== false || codes.length === 0) return turnstileUnavailable();
    if (codes.some((code) => SERVER_ERROR_CODES.has(code))) return turnstileUnavailable();
    if (codes.every((code) => CLIENT_ERROR_CODES.has(code))) return turnstileRejected(400);
    return turnstileUnavailable();
  }

  // success と error-codes が矛盾する応答は受け入れない。
  if (codes.length > 0) return turnstileUnavailable();
  if (data.action !== TURNSTILE_EXPECTED_ACTION) return turnstileRejected();
  if (typeof data.hostname !== 'string' || !hostnames.has(data.hostname)) return turnstileRejected();
  if (typeof data.challenge_ts !== 'string' || !RFC3339_TIMESTAMP.test(data.challenge_ts)) {
    return turnstileUnavailable();
  }
  const challengeTime = Date.parse(data.challenge_ts);
  if (!Number.isFinite(challengeTime)) return turnstileUnavailable();
  const age = Date.now() - challengeTime;
  if (age < -TURNSTILE_MAX_FUTURE_SKEW_MS) return turnstileUnavailable();
  if (age > TURNSTILE_TOKEN_MAX_AGE_MS) return turnstileRejected(400);

  return { ok: true, skipped: false };
}

// --- 問い合わせAPIのOrigin / Preview CORS境界 ---
// productionは従来どおりCor.の同一originだけを許可し、CORS応答を返さない。
// PreviewだけはUAT用Pages originをソースに固定し、runtime変数からallowlistを注入しない。
const PRODUCTION_CONTACT_ORIGINS = new Set(['https://cor-jp.com', 'https://www.cor-jp.com']);
export const PREVIEW_CONTACT_ORIGIN = 'https://codex-cloudia-grift-uat.cloudia-contact.pages.dev';

export const PREVIEW_CONTACT_CORS_HEADERS = Object.freeze({
  'access-control-allow-origin': PREVIEW_CONTACT_ORIGIN,
  vary: 'Origin',
  'access-control-allow-methods': 'POST',
  'access-control-allow-headers': 'Content-Type',
  'access-control-max-age': '600',
} as const);

type ContactSiteEnvironment = 'production' | 'preview';

function contactSiteEnvironment(value: string | undefined): ContactSiteEnvironment | null {
  if (value === 'production' || value === 'preview') return value;
  return null;
}

/**
 * Origin is a serialized origin, not a general URL. Direct exact comparison
 * rejects HTTP, ports, userinfo, paths, queries, fragments, wildcard, null,
 * suffix confusion and multiple-origin values without parser normalization.
 */
export function isContactOriginAllowed(req: Request, env: Env): boolean {
  const siteEnvironment = contactSiteEnvironment(env.CONTACT_SITE_ENV);
  if (!siteEnvironment) return false;

  const origin = req.headers.get('Origin');
  // Origin is not an authentication mechanism. Origin-less non-browser calls
  // remain compatible, while an unknown runtime environment still fails closed.
  if (!origin) return true;
  if (siteEnvironment === 'production') return PRODUCTION_CONTACT_ORIGINS.has(origin);
  return origin === PREVIEW_CONTACT_ORIGIN;
}

/** CORS is emitted only for the checked-in Preview origin and exact Preview mode. */
export function previewContactCorsHeaders(
  req: Request,
  env: Env,
): Readonly<Record<string, string>> | null {
  if (env.CONTACT_SITE_ENV !== 'preview') return null;
  if (req.headers.get('Origin') !== PREVIEW_CONTACT_ORIGIN) return null;
  return PREVIEW_CONTACT_CORS_HEADERS;
}

/** Validate the browser preflight contract without accepting extra capabilities. */
export function isValidPreviewContactPreflight(req: Request, env: Env): boolean {
  if (req.method !== 'OPTIONS') return false;
  if (!isContactOriginAllowed(req, env) || !previewContactCorsHeaders(req, env)) return false;
  if (req.headers.get('Access-Control-Request-Method') !== 'POST') return false;
  if (req.headers.has('Access-Control-Request-Private-Network')) return false;

  const requestedHeaders = req.headers.get('Access-Control-Request-Headers');
  if (requestedHeaders === null) return true;
  const normalizedHeaders = requestedHeaders
    .split(',')
    .map((header) => header.trim().toLowerCase());
  return normalizedHeaders.length > 0
    && normalizedHeaders.every((header) => header === 'content-type')
    && new Set(normalizedHeaders).size === normalizedHeaders.length;
}
