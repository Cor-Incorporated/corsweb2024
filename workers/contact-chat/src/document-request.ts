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
export const DOCUMENT_REQUEST_INDUSTRIES = [
  'medical',
  'shigyo',
  'construction',
  'manufacturing',
  'education',
] as const;
export type DocumentRequestIndustry = (typeof DOCUMENT_REQUEST_INDUSTRIES)[number];

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

export function materialsPath(locale: DocumentLocale): string {
  return locale === 'ja' ? '/contact/materials/' : `/${locale}/contact/materials/`;
}

export type DocumentRequestErrorCode = 'name' | 'email' | 'consent' | 'industry' | 'invalid';

export interface ValidDocumentRequest {
  name: string;
  email: string;
  company: string;
  industry: DocumentRequestIndustry | '';
  locale: DocumentLocale;
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

  return {
    ok: true,
    value: {
      name,
      email,
      company: sanitizeLine(input.company, MAX_COMPANY_LEN),
      industry,
      locale: asLocale(input.locale),
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
