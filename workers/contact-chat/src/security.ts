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
// TURNSTILE_SECRET 未設定なら検証スキップ（turnstile のみ fail open。READMEに明記）。
// 設定済みなら token を siteverify へ送り、success:false なら拒否（fail closed）。
const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export type TurnstileResult =
  | { ok: true; skipped: boolean }
  | { ok: false; status: number; error: string };

export async function verifyTurnstile(
  env: Env,
  token: unknown,
  ip: string,
): Promise<TurnstileResult> {
  const secret = env.TURNSTILE_SECRET;
  if (!secret) {
    // 設定されていない場合は検証をスキップ（fail open。意図的・READMEに記載）。
    return { ok: true, skipped: true };
  }
  if (typeof token !== 'string' || !token) {
    return { ok: false, status: 400, error: 'Turnstile トークンが必要です' };
  }
  // 過大トークンを早期拒否（外部呼び出し前のガード）。
  if (token.length > 4096) {
    return { ok: false, status: 400, error: 'Turnstile トークンが不正です' };
  }
  const form = new URLSearchParams();
  form.set('secret', secret);
  form.set('response', token);
  if (ip && ip !== 'unknown') form.set('remoteip', ip);

  let data: { success?: boolean } = {};
  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    data = (await res.json()) as { success?: boolean };
  } catch {
    // 検証サービスに到達できない場合は fail closed（安全側）。
    return { ok: false, status: 503, error: 'Turnstile 検証に失敗しました。時間をおいて再試行してください' };
  }
  if (data.success !== true) {
    return { ok: false, status: 403, error: 'Turnstile 検証に失敗しました' };
  }
  return { ok: true, skipped: false };
}

// --- 同一オリジンチェック（CORSを開けず、cor-jp.com 上のウィジェットのみ許可） ---
// Fetch 標準では、ブラウザは GET / HEAD 以外に必ず Origin を付ける。
// 状態を変えるリクエストで Origin が無いものは curl などの非ブラウザなので拒否する（#362）。
// GET / HEAD は同一オリジンでも Origin を付けないことがある（死活確認など）。
const ALLOWED_HOSTS = new Set(['cor-jp.com', 'www.cor-jp.com']);
const METHODS_WITHOUT_ORIGIN = new Set(['GET', 'HEAD']);

export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get('Origin')?.trim() ?? '';
  if (!origin) return METHODS_WITHOUT_ORIGIN.has((req.method ?? '').toUpperCase());
  try {
    const host = new URL(origin).hostname;
    return ALLOWED_HOSTS.has(host);
  } catch {
    return false;
  }
}
