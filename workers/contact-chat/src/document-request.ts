import { DOCUMENT_REQUEST_ENTRY_PATHS, DOCUMENT_REQUEST_VERSION } from '../../../src/config/document-request';
import { readJsonBody, readLimitedBody, type JsonBodyFailure } from './body';
import {
  DOCUMENT_LOCALES,
  DOCUMENT_REQUEST_COPY,
  type DocumentLocale,
  type DocumentRequestCopy,
} from './document-request-copy';
import { isValidEmail, MAX_COMPANY_LEN, MAX_NAME_LEN, sanitizeLine } from './validate';

export const DOCUMENT_REQUEST_ID = 'company-deck';
export const DOCUMENT_REQUEST_CONSENT_VERSION = 'document-request-1';

export { DOCUMENT_REQUEST_VERSION };

/**
 * フォームを表示するたびに画面が発行する短い乱数（16 バイトを hex にした 32 文字）。
 * 静的な HTML には置かない（ビルドした瞬間に全員共通になるため）。送られてこなければ ''（トークンなし）。
 * 形が違うものは「無い」扱いにせず拒む（誤って従来の規則でまとめ直さないため）。
 */
export const DOCUMENT_FORM_TOKEN_PATTERN = /^[0-9a-f]{32}$/;

/** トークンを読む。無い・空は ''、形が違うものは null。 */
export function readDocumentFormToken(raw: unknown): string | null {
  if (raw === undefined || raw === null) return '';
  if (typeof raw !== 'string') return null;
  const token = raw.trim();
  if (!token) return '';
  return DOCUMENT_FORM_TOKEN_PATTERN.test(token) ? token : null;
}

/** 自社の会社情報・業種ページの標準パスだけ保存する。 */
export function sanitizeDocumentEntryPath(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const path = raw.split(/[?#]/, 1)[0] ?? '';
  if (!path) return '';
  const canonicalPath = path.endsWith('/') ? path : path + '/';
  return DOCUMENT_REQUEST_ENTRY_PATHS.includes(canonicalPath) ? canonicalPath : '';
}
export const DOCUMENT_REQUEST_INDUSTRIES = [
  'medical',
  'shigyo',
  'construction',
  'manufacturing',
  'education',
] as const;
export type DocumentRequestIndustry = (typeof DOCUMENT_REQUEST_INDUSTRIES)[number];

/**
 * どこで知ったか（任意）。GA4 には送らず、受付の記録にだけ残す。
 * src/config/document-request.ts の同名定数とパリティテストで揃える。
 */
export const DOCUMENT_REQUEST_DISCOVERY_SOURCES = [
  'x',
  'linkedin',
  'note',
  'qiita',
  'search',
  'referral',
  'event',
  'other',
] as const;
export const DOCUMENT_REQUEST_DISCOVERY_OTHER_MAX = 100;
export type DocumentRequestDiscoverySource = (typeof DOCUMENT_REQUEST_DISCOVERY_SOURCES)[number];

/** 公開スライド。src/config/site.ts の COMPANY_DECK_URL とパリティテストで揃える。 */
export const DOCUMENT_DECK_URL =
  'https://docs.google.com/presentation/d/1bl7eyuHc_pohcdyzWzOWibWisz-IQFe3/preview';

export type DocumentNotifyMode = 'hold' | 'mock' | 'live';

export function documentNotifyMode(value: string | undefined): DocumentNotifyMode {
  switch (value) {
    case 'mock':
    case 'live':
      return value;
    default:
      return 'hold';
  }
}

/**
 * Queue が資料請求の社内通知を最大何回 claim するか。wrangler.toml の max_retries（5）+ 最初の 1 回。
 * 超えた行は DLQ に入り、cron も拾い直さない。照会 SQL だけが見つける。
 * wrangler.toml との一致は document-notice-config.test.ts が照合する。
 */
export const NOTICE_MAX_ATTEMPTS = 6;

/** cron が「投入できなかった」と見なす、作成からの経過（秒）。 */
export const NOTICE_REQUEUE_AFTER_SECONDS = 15 * 60;

/**
 * 解放時刻は 10 桁の unix 秒だけ（2001〜2286 年）。空・0・負・小数・文字混じり、
 * そしてミリ秒（13 桁）は未設定と同じ扱い（送らない）。ミリ秒を秒と読むと遠い未来になり、黙って送られなくなるため、拒否する。
 */
export function parseNotifyReleasedAt(value: string | undefined): number | null {
  if (typeof value !== 'string' || !/^[1-9]\d{9}$/.test(value.trim())) return null;
  return Number(value.trim());
}

export type DocumentNoticeDecision = 'send' | 'hold';

/**
 * キュー到着で送るかどうか。live で、解放時刻があり、行がそれ以降に作られたときだけ send。
 * 重複の再申込みは古い行をもう一度 Queue に入れるので、ここで過去の held を止める。
 */
export function decideDocumentNotice(
  mode: DocumentNotifyMode,
  releasedAtRaw: string | undefined,
  createdAt: number,
): DocumentNoticeDecision {
  if (mode !== 'live') return 'hold';
  const releasedAt = parseNotifyReleasedAt(releasedAtRaw);
  if (releasedAt === null || !Number.isFinite(createdAt)) return 'hold';
  return createdAt >= releasedAt ? 'send' : 'hold';
}

/** 担当の返信の言語。ja は日本語、それ以外は英語。zh / ko / es で母語の返信は約束しない。 */
export function documentReplyLanguage(locale: string): '日本語' | 'English' {
  return locale === '' || locale === 'ja' ? '日本語' : 'English';
}

export function materialsPath(locale: DocumentLocale): string {
  return locale === 'ja' ? '/contact/materials/' : `/${locale}/contact/materials/`;
}

export type DocumentRequestErrorCode = 'name' | 'email' | 'consent' | 'industry' | 'discovery' | 'invalid';

export interface ValidDocumentRequest {
  name: string;
  email: string;
  company: string;
  industry: DocumentRequestIndustry | '';
  discoverySource: DocumentRequestDiscoverySource | '';
  discoveryOther: string;
  locale: DocumentLocale;
  /** フォームを表示するたびに発行される乱数。JS 無し・既存のクライアントは ''（トークンなし）。 */
  formToken: string;
  /** 元のページの path（自社の同一 origin だけ）。分からない・保存できないものは ''（記録なし）。 */
  entryPath: string;
}

export type DocumentRequestValidation =
  | { ok: true; value: ValidDocumentRequest }
  | { ok: false; code: DocumentRequestErrorCode; honeypot?: boolean };

export function documentLocaleFrom(input: Record<string, unknown> | undefined): DocumentLocale {
  return asLocale(input?.locale);
}

function asLocale(value: unknown): DocumentLocale {
  return typeof value === 'string' && (DOCUMENT_LOCALES as readonly string[]).includes(value)
    ? (value as DocumentLocale)
    : 'ja';
}

export function validateDocumentRequest(input: Record<string, unknown> | undefined): DocumentRequestValidation {
  if (!input) return { ok: false, code: 'invalid' };
  const website = sanitizeLine(input.website, 200);
  if (website) return { ok: false, code: 'invalid', honeypot: true };

  const name = sanitizeLine(input.name, MAX_NAME_LEN);
  if (!name) return { ok: false, code: 'name' };

  const email = sanitizeLine(input.email, 254);
  if (!email || !isValidEmail(email)) return { ok: false, code: 'email' };

  const consent = input.consent === true || input.consent === 'yes';
  if (!consent) return { ok: false, code: 'consent' };

  const industryRaw = sanitizeLine(input.industry, 40);
  let industry: DocumentRequestIndustry | '' = '';
  if (industryRaw) {
    if (!(DOCUMENT_REQUEST_INDUSTRIES as readonly string[]).includes(industryRaw)) {
      return { ok: false, code: 'industry' };
    }
    industry = industryRaw as DocumentRequestIndustry;
  }

  const discoveryRaw = sanitizeLine(input.discoverySource, 40);
  let discoverySource: DocumentRequestDiscoverySource | '' = '';
  if (discoveryRaw) {
    if (!(DOCUMENT_REQUEST_DISCOVERY_SOURCES as readonly string[]).includes(discoveryRaw)) {
      return { ok: false, code: 'discovery' };
    }
    discoverySource = discoveryRaw as DocumentRequestDiscoverySource;
  }

  // 自由記述は「その他」の時だけ。それ以外で送られても捨てる。
  let discoveryOther = '';
  if (discoverySource === 'other') {
    const normalized = sanitizeLine(input.discoveryOther, 10000);
    if (normalized.length > DOCUMENT_REQUEST_DISCOVERY_OTHER_MAX) {
      return { ok: false, code: 'discovery' };
    }
    discoveryOther = normalized;
  }

  // トークンは既存の欄の検査のあとに読む（既存のクライアントの応答を変えないため）。
  const formToken = readDocumentFormToken(input.formToken);
  if (formToken === null) return { ok: false, code: 'invalid' };

  return {
    ok: true,
    value: {
      name,
      email,
      company: sanitizeLine(input.company, MAX_COMPANY_LEN),
      industry,
      discoverySource,
      discoveryOther,
      locale: asLocale(input.locale),
      formToken,
      entryPath: sanitizeDocumentEntryPath(input.pagePath),
    },
  };
}

export type DocumentBodyResult =
  | { ok: true; data: Record<string, unknown>; form: boolean }
  | { ok: false; reason: JsonBodyFailure };

export async function readDocumentRequestBody(req: Request): Promise<DocumentBodyResult> {
  const contentType = req.headers.get('content-type') || '';
  if (/application\/json/i.test(contentType)) {
    const parsed = await readJsonBody(req);
    if (!parsed.ok) return parsed;
    return { ok: true, data: parsed.data, form: false };
  }
  if (!/application\/x-www-form-urlencoded/i.test(contentType)) {
    return { ok: false, reason: 'not_json' };
  }
  const declared = req.headers.get('content-length');
  if (declared) {
    const len = Number(declared);
    if (Number.isFinite(len) && len > 64 * 1024) return { ok: false, reason: 'too_large' };
  }
  const read = await readLimitedBody(req.body);
  if (!read.ok) return { ok: false, reason: read.reason };
  const params = new URLSearchParams(new TextDecoder().decode(read.bytes));
  const data: Record<string, unknown> = {};
  for (const [key, value] of params.entries()) {
    if (!(key in data)) data[key] = value;
  }
  return { ok: true, data, form: true };
}

export interface DocumentRequestResultBody {
  ok: true;
  receiptId: string;
  status: 'stored';
  notification: 'queued' | 'pending';
  duplicate: boolean;
  delivered: false;
}

export function documentResultBody(input: {
  receiptId: string;
  notification: 'queued' | 'pending';
  duplicate: boolean;
}): DocumentRequestResultBody {
  return {
    ok: true,
    receiptId: input.receiptId,
    status: 'stored',
    notification: input.notification,
    duplicate: input.duplicate,
    delivered: false,
  };
}

const HTML_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  '\'': '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPE[char] ?? char);
}

function htmlPage(locale: DocumentLocale, title: string, body: string): string {
  return `<!DOCTYPE html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title></head><body><main>${body}</main></body></html>`;
}

export function documentErrorCopy(locale: DocumentLocale, code: DocumentRequestErrorCode): string {
  const copy = DOCUMENT_REQUEST_COPY[locale];
  switch (code) {
    case 'name':
      return copy.errorName;
    case 'email':
      return copy.errorEmail;
    case 'consent':
      return copy.errorConsent;
    case 'industry':
      return copy.errorIndustry;
    case 'discovery':
      return copy.errorDiscovery;
    case 'invalid':
      return copy.errorInvalid;
    default: {
      const unexpected: never = code;
      return unexpected;
    }
  }
}

export function renderDocumentHtml(input: {
  locale: DocumentLocale;
  code?: DocumentRequestErrorCode | 'storage' | 'rate';
  result?: DocumentRequestResultBody;
}): string {
  const copy: DocumentRequestCopy = DOCUMENT_REQUEST_COPY[input.locale];
  const back = `<p><a href="${materialsPath(input.locale)}">${escapeHtml(copy.title)}</a></p>`;
  const deck = `<p><a href="${escapeHtml(DOCUMENT_DECK_URL)}" rel="noopener noreferrer">${escapeHtml(copy.deckLink)}</a></p><p>${escapeHtml(copy.deckNote)}</p>`;
  if (input.code === 'rate') {
    return htmlPage(input.locale, copy.title, `<h1>${escapeHtml(copy.errorRate)}</h1>${back}`);
  }
  if (input.result) {
    const lead = input.result.duplicate ? copy.duplicate : copy.success;
    const pending = input.result.notification === 'pending' ? `<p>${escapeHtml(copy.notifyPending)}</p>` : '';
    return htmlPage(
      input.locale,
      copy.title,
      `<h1>${escapeHtml(lead)}</h1><p>${escapeHtml(copy.receiptLabel)}</p><p>${escapeHtml(input.result.receiptId)}</p>${pending}${deck}${back}`,
    );
  }
  const message = input.code === 'storage'
    ? copy.errorStorage
    : documentErrorCopy(input.locale, input.code || 'invalid');
  return htmlPage(input.locale, copy.title, `<h1>${escapeHtml(message)}</h1>${back}`);
}

export function renderHoneypotHtml(locale: DocumentLocale): string {
  return htmlPage(locale, DOCUMENT_REQUEST_COPY[locale].title, '');
}

export function htmlResponse(html: string, status: number): Response {
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'cache-control': 'no-store',
    },
  });
}
