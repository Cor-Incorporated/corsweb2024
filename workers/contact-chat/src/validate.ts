import type {
  ChatMessage,
  ChatRole,
  ChatLocale,
  Classification,
  ConversationSummaryV1,
  ContactIntent,
  InquiryInput,
  NormalizedInquiry,
  StructuredLead,
} from './types';
import { CONTACT_INTENTS } from './types';

// --- 入力サニタイズ（プロンプト注入・制御文字対策） ---
// NUL/制御文字を除去し、長さを制限する。yomimono の sanitizeText と同方針。
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

// チャット用サニタイズ: 改行(\n)は会話文として残し、それ以外の制御文字のみ除去する。
export function sanitizeMessage(s: unknown, maxLen: number): string {
  return String(s ?? '')
    .replace(CONTROL_CHARS, ' ')
    .replace(/\r\n?/g, '\n')
    .trim()
    .slice(0, maxLen);
}

// 単一行用サニタイズ: 改行も含む全制御文字を空白化（name/email/company 等）。
// eslint-disable-next-line no-control-regex
const ALL_CONTROL = /[\x00-\x1F\x7F]/g;
export function sanitizeLine(s: unknown, maxLen: number): string {
  return String(s ?? '')
    .replace(ALL_CONTROL, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

// --- /chat メッセージ配列の検証 ---
export const MAX_MESSAGES = 20;
export const MAX_MESSAGE_LEN = 2000;
export const VALID_ROLES: readonly ChatRole[] = ['user', 'assistant'];

export type ChatValidation =
  | { ok: true; messages: ChatMessage[] }
  | { ok: false; error: string; status: number };

// クライアント由来の messages を検証・正規化する。
// - 配列であること / 1件以上 / 上限件数 / role が user|assistant / content が文字列
// - 各メッセージは制御文字除去＋長さ制限（プロンプト注入の素材を最小化）
export function normalizeMessages(input: unknown): ChatValidation {
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, error: 'messages は1件以上の配列が必要です', status: 400 };
  }
  if (input.length > MAX_MESSAGES) {
    return { ok: false, error: `メッセージ数が多すぎます（最大${MAX_MESSAGES}件）`, status: 400 };
  }
  const messages: ChatMessage[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') {
      return { ok: false, error: 'messages の各要素はオブジェクトである必要があります', status: 400 };
    }
    const role = (raw as { role?: unknown }).role;
    const content = (raw as { content?: unknown }).content;
    if (typeof role !== 'string' || !VALID_ROLES.includes(role as ChatRole)) {
      return { ok: false, error: 'role は user か assistant のみ許可されます', status: 400 };
    }
    if (typeof content !== 'string') {
      return { ok: false, error: 'content は文字列である必要があります', status: 400 };
    }
    const clean = sanitizeMessage(content, MAX_MESSAGE_LEN);
    if (!clean) {
      return { ok: false, error: '空のメッセージは送れません', status: 400 };
    }
    messages.push({ role: role as ChatRole, content: clean });
  }
  return { ok: true, messages };
}

// PII is not supposed to be entered in /chat, but a browser cannot enforce that
// contract. Mask common contact/credential patterns before any external LLM call.
const PII_EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PII_PHONE_RE = /(?<!\d)(?:\+?\d{1,3}[ -]?)?(?:0\d{1,4}[-ー－ ]?)?\d{2,4}[-ー－ ]?\d{3,4}[-ー－ ]?\d{3,4}(?!\d)/g;
const PII_POSTAL_RE = /(?:〒\s*)?\d{3}[-ー－ ]?\d{4}/g;
const PII_CARD_RE = /(?<!\d)(?:\d[ -]?){13,19}(?!\d)/g;
const PII_OTP_RE = /(?:otp|one[- ]time|認証コード|確認コード|ワンタイム)[^\d]{0,20}\d{4,8}/gi;
const SECRET_TOKEN_RE = /(?:AIza[0-9A-Za-z_-]{20,}|(?:sk|ghp|xox[baprs]?)-[A-Za-z0-9_-]{16,}|-----BEGIN(?: [A-Z]+)* PRIVATE KEY-----)/g;

export function maskSensitiveContent(content: string): string {
  return content
    .replace(SECRET_TOKEN_RE, '[redacted-secret]')
    .replace(PII_EMAIL_RE, '[redacted-email]')
    .replace(PII_OTP_RE, '[redacted-code]')
    .replace(PII_POSTAL_RE, '[redacted-postal]')
    .replace(PII_PHONE_RE, '[redacted-phone]')
    .replace(PII_CARD_RE, '[redacted-number]');
}

export function maskMessagesForLlm(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: maskSensitiveContent(message.content),
  }));
}

// Internal notifications may include a short conversation context, but never the
// browser transcript verbatim. Build it from already validated turns, mask common
// PII/credentials, and bound both each turn and the complete excerpt.
export const MAX_CONVERSATION_TURN_LEN = 600;
export const MAX_CONVERSATION_EXCERPT_LEN = 6000;

export function buildConversationExcerpt(messages: ChatMessage[]): string {
  let excerpt = '';
  for (const message of messages.slice(-MAX_MESSAGES)) {
    const content = sanitizeLine(maskSensitiveContent(message.content), MAX_CONVERSATION_TURN_LEN);
    if (!content) continue;
    const label = message.role === 'user' ? '訪問者' : 'Cloudia';
    const line = `${label}: ${content}`;
    const prefix = excerpt ? '\n' : '';
    const remaining = MAX_CONVERSATION_EXCERPT_LEN - excerpt.length - prefix.length;
    if (remaining <= 0) break;
    excerpt += prefix + line.slice(0, remaining);
    if (line.length > remaining) break;
  }
  return excerpt;
}

// --- /submit 問い合わせの検証 ---
export const MAX_NAME_LEN = 100;
export const MAX_EMAIL_LEN = 254; // RFC 5321 のローカル+ドメイン上限
export const MAX_COMPANY_LEN = 200;
export const MAX_INQUIRY_MESSAGE_LEN = 5000;
export const MAX_SUMMARY_LEN = 8000;
export const MAX_SOURCE_LEN = 100;
export const MAX_LEAD_FIELD_LEN = 500;
export const MAX_UTM_KEYS = 8;
export const MAX_UTM_VALUE_LEN = 200;

// RFC を厳密には実装せず、実用的で過剰拒否しない緩めのチェック。
// 1個の @、前後に空白なし、ドメインに少なくとも1つのドット。制御文字は既に除去済み前提。
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(email: string): boolean {
  return email.length <= MAX_EMAIL_LEN && EMAIL_RE.test(email);
}

const VALID_CLASSIFICATIONS: readonly Classification[] = ['genuine', 'sales', 'spam'];
function normalizeClassification(c: unknown): Classification | '' {
  return typeof c === 'string' && (VALID_CLASSIFICATIONS as readonly string[]).includes(c)
    ? (c as Classification)
    : '';
}

/** 7 キー以外は空（未知は 400 にせずフォールバック） */
export function normalizeIntent(raw: unknown): ContactIntent | '' {
  if (typeof raw !== 'string') return '';
  const v = raw.trim();
  return (CONTACT_INTENTS as readonly string[]).includes(v) ? (v as ContactIntent) : '';
}

export function normalizeSource(raw: unknown): string {
  return sanitizeLine(raw, MAX_SOURCE_LEN);
}

const LEAD_KEYS = [
  'purpose',
  'industryRole',
  'dataSensitivity',
  'stage',
  'timingBudget',
  'discoverySource',
  'contactReason',
] as const;

export function normalizeStructuredLead(raw: unknown): StructuredLead {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const src = raw as Record<string, unknown>;
  const out: StructuredLead = {};
  for (const key of LEAD_KEYS) {
    const v = sanitizeMessage(src[key], MAX_LEAD_FIELD_LEN);
    if (v) out[key] = v;
  }
  return out;
}

export function normalizeUtm(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const src = raw as Record<string, unknown>;
  const out: Record<string, string> = {};
  let n = 0;
  for (const [k, v] of Object.entries(src)) {
    if (n >= MAX_UTM_KEYS) break;
    const key = sanitizeLine(k, 40);
    if (!key || !/^utm_[a-z0-9_]+$/i.test(key)) continue;
    const val = sanitizeLine(v, MAX_UTM_VALUE_LEN);
    if (!val) continue;
    out[key] = val;
    n++;
  }
  return out;
}

export type SummaryValidation =
  | { ok: true; text: string; schema?: ConversationSummaryV1 }
  | { ok: false; error: string; status: number };

// summaryText は会話全文ではなく、Cloudiaが確定した要約だけを受け付ける。
// 旧クライアントの文字列入力を壊さないため、明らかな role ラベル行だけを除去し、
// 全文トランスクリプトが渡された場合は空文字へ落として決定的fallbackへ進める。
const TRANSCRIPT_ROLE_LINE = /^(?:user|assistant|system|human|visitor|cloudia|ユーザー|あなた|訪問者|アシスタント|クラウディア)\s*(?:[:：]|[-—])\s*/i;
const SUMMARY_PREFIX_LINE = /^(?:you|ai\s+assistant|AI\s*アシスタント)\s*(?:[:：]|[-—])\s*/i;

export function canonicalizeSummaryText(raw: string): string {
  const clean = sanitizeMessage(raw, MAX_SUMMARY_LEN);
  if (!clean) return '';
  const lines = clean.split('\n').map((line) => line.trim()).filter(Boolean);
  // A transcript is not made safe by deleting only its role labels: continuation
  // lines can still contain the visitor's raw text. Reject the whole value and
  // let the deterministic structured fallback be used instead.
  if (lines.some((line) => TRANSCRIPT_ROLE_LINE.test(line))) return '';
  return lines.filter((line) => !SUMMARY_PREFIX_LINE.test(line)).join('\n').slice(0, MAX_SUMMARY_LEN).trim();
}

/** LLM要約が欠落・不正なときの正本。PIIや生本文を含めず、同じ入力から常に同じ値を作る。 */
export function buildDeterministicSummary(
  input: Pick<NormalizedInquiry, 'classification' | 'intent'> & { structuredLead?: StructuredLead },
): string {
  const parts: string[] = [];
  if (input.intent) parts.push(`相談目的: ${input.intent}`);
  if (input.classification) parts.push(`分類: ${input.classification}`);
  const lead = input.structuredLead || {};
  const safeLead = (value: string): string => maskSensitiveContent(value);
  if (lead.purpose) parts.push(`目的: ${safeLead(lead.purpose)}`);
  if (lead.industryRole) parts.push(`業種・役割: ${safeLead(lead.industryRole)}`);
  if (lead.dataSensitivity) parts.push(`データ感度: ${safeLead(lead.dataSensitivity)}`);
  if (lead.stage) parts.push(`進捗段階: ${safeLead(lead.stage)}`);
  if (lead.timingBudget) parts.push(`時期・予算: ${safeLead(lead.timingBudget)}`);
  if (lead.discoverySource) parts.push(`流入経路: ${safeLead(lead.discoverySource)}`);
  if (lead.contactReason) parts.push(`連絡理由: ${safeLead(lead.contactReason)}`);
  return parts.length ? parts.join(' / ') : '要約未生成（受付内容を担当者が確認します）';
}

/**
 * Accept the legacy plain-text transcript while validating the versioned summary
 * envelope used by newer clients. Unknown fields are ignored; invalid enums and
 * oversized turns are rejected rather than silently persisting malformed JSON.
 */
export function normalizeConversationSummary(raw: unknown): SummaryValidation {
  if (raw === undefined || raw === null || raw === '') return { ok: true, text: '' };
  if (typeof raw === 'string') {
    return { ok: true, text: canonicalizeSummaryText(raw) };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'conversationSummary は文字列またはversion 1のオブジェクトが必要です', status: 400 };
  }
  const input = raw as Record<string, unknown>;
  if (input.version !== 1) {
    return { ok: false, error: 'conversationSummary.version は1のみ許可されます', status: 400 };
  }
  const locale: ChatLocale = input.locale === 'en' ? 'en' : 'ja';
  if (input.locale !== undefined && input.locale !== 'ja' && input.locale !== 'en') {
    return { ok: false, error: 'conversationSummary.locale はjaかenのみ許可されます', status: 400 };
  }
  const classification = normalizeClassification(input.classification);
  if (input.classification !== undefined && input.classification !== '' && !classification) {
    return { ok: false, error: 'conversationSummary.classification が不正です', status: 400 };
  }
  const intent = normalizeIntent(input.intent);
  if (typeof input.intent === 'string' && input.intent && !intent) {
    return { ok: false, error: 'conversationSummary.intent が不正です', status: 400 };
  }
  const rawText = input.summaryText ?? input.text;
  if (typeof rawText !== 'string') {
    return { ok: false, error: 'conversationSummary.text は文字列である必要があります', status: 400 };
  }
  const text = canonicalizeSummaryText(rawText);
  if (!text) return { ok: false, error: 'conversationSummary.text は必須です', status: 400 };
  const stage = sanitizeLine(input.stage, 80);
  const structuredLead = normalizeStructuredLead(input.structuredLead);
  const schema: ConversationSummaryV1 = {
    version: 1,
    locale,
    intent,
    classification,
    readyForContact: input.readyForContact === true,
    stage,
    structuredLead,
    text,
  };
  return { ok: true, text, schema };
}

/**
 * Strict handoff contract: only body.summaryText.text from a versioned envelope
 * can be treated as the visitor-confirmed canonical summary. Legacy strings and
 * the nested summaryText alias remain email-compatible but cannot authorize Grift.
 */
export function normalizeConfirmedSummaryText(raw: unknown): SummaryValidation {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Grift引継ぎにはsummaryText.textの確認済み要約が必要です', status: 400 };
  }
  const input = raw as Record<string, unknown>;
  if (
    typeof input.text !== 'string'
    || input.text.length > MAX_SUMMARY_LEN
    || input.summaryText !== undefined
  ) {
    return { ok: false, error: 'summaryText.textが不正です', status: 400 };
  }
  const normalized = normalizeConversationSummary(input);
  if (!normalized.ok || !normalized.schema) return normalized;
  // A confirmed handoff summary is copied verbatim (after canonical whitespace
  // normalization) to D1, both email paths and Grift. Reject detected PII or
  // credentials here instead of letting those consumers apply divergent masks.
  if (normalized.text !== maskSensitiveContent(normalized.text)) {
    return { ok: false, error: 'summaryText.textに連絡先または秘密情報を含めることはできません', status: 400 };
  }
  return normalized;
}

export type InquiryValidation =
  | { ok: true; inquiry: NormalizedInquiry }
  | { ok: false; error: string; status: number; honeypot?: boolean };

// /submit ボディを検証・正規化する。
// ハニーポット(website)が埋まっていれば bot とみなし honeypot:true を返す（呼び出し側でサイレント200）。
export function normalizeInquiry(input: InquiryInput | undefined): InquiryValidation {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'リクエストボディが不正です', status: 400 };
  }

  // ハニーポット: 人間は website を空のまま送る。値があれば bot。
  const honeypot = sanitizeLine(input.website, 200);
  if (honeypot) {
    return { ok: false, error: 'dropped', status: 200, honeypot: true };
  }

  const name = sanitizeLine(input.name, MAX_NAME_LEN);
  const email = sanitizeLine(input.email, MAX_EMAIL_LEN);
  const company = sanitizeLine(input.company, MAX_COMPANY_LEN);
  const message = sanitizeMessage(input.message, MAX_INQUIRY_MESSAGE_LEN);
  // summaryText が正本。conversationSummary は段階移行中の旧クライアント専用。
  const summary = normalizeConversationSummary(input.summaryText ?? input.conversationSummary);
  if (!summary.ok) return summary;
  const classification = normalizeClassification(input.classification);
  const intent = normalizeIntent(input.intent);
  const source = normalizeSource(input.source);
  const structuredLead = normalizeStructuredLead(input.structuredLead);
  const utm = normalizeUtm(input.utm);
  const conversationSummary = summary.text || buildDeterministicSummary({ classification, intent, structuredLead });

  if (!name) {
    return { ok: false, error: 'お名前は必須です', status: 400 };
  }
  if (!email || !isValidEmail(email)) {
    return { ok: false, error: 'メールアドレスの形式が正しくありません', status: 400 };
  }
  if (!message) {
    return { ok: false, error: 'お問い合わせ内容は必須です', status: 400 };
  }

  return {
    ok: true,
    inquiry: {
      name,
      email,
      company,
      message,
      summaryText: conversationSummary,
      conversationSummary,
      classification,
      intent,
      source,
      structuredLead,
      utm,
    },
  };
}
