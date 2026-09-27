import type { Env, NormalizedInquiry } from './types';
import {
  buildDeterministicSummary,
  canonicalizeSummaryText,
  isValidEmail,
  maskSensitiveContent,
  MAX_CONVERSATION_EXCERPT_LEN,
} from './validate';

// --- メール送信プロバイダ抽象化 ---
// 既定実装は Resend API。将来 SendGrid / SES 等を足すときは EmailProvider を実装するだけ。
// replyTo: 問い合わせ者のメール（担当者が「返信」で直接顧客に届くようにする）。
export interface EmailProvider {
  send(
    to: string,
    from: string,
    subject: string,
    text: string,
    replyTo?: string,
    cc?: readonly string[],
  ): Promise<EmailSendResult>;
}

export interface EmailSendResult {
  /** Resendが受付時に返すID。PIIではないためOutboxの相関にのみ利用する。 */
  messageId: string;
  /** Webhook未導入時点の意味は「Resend API受付済み」。最終配信とは区別する。 */
  deliveryStatus: 'accepted';
}

const RESEND_URL = 'https://api.resend.com/emails';

class ResendProvider implements EmailProvider {
  constructor(private readonly apiKey: string) {}

  async send(
    to: string,
    from: string,
    subject: string,
    text: string,
    replyTo?: string, cc?: readonly string[],
  ): Promise<EmailSendResult> {
    // 重要(セキュリティ): 本文は必ず `text` のみで送る。`html` は使わない。
    // reply は LLM 出力ではないが（ここは /submit のPII本文）、staff の webmail での
    // stored-XSS を構造的に防ぐため、HTMLレンダリングされる経路を作らない方針を徹底する。
    const payload: Record<string, unknown> = { from, to, subject, text };
    // reply_to は isValidEmail 済み（単一アドレス・CRLFなし）なのでヘッダ注入の心配なし。
    if (replyTo) payload.reply_to = replyTo;
    if (cc?.length) payload.cc = [...cc];
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      // 本文（鍵を含みうる）はログに出さず、ステータスのみ。
      throw new Error(`メール送信に失敗しました（status ${res.status}）`);
    }
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      throw new Error('メール送信の受付応答が不正です');
    }
    const messageId = data && typeof data === 'object' && typeof (data as { id?: unknown }).id === 'string'
      ? (data as { id: string }).id.trim()
      : '';
    // Resend IDs are opaque correlation values, not free-form text. Restrict
    // the stored value so an unexpected provider response cannot carry PII or
    // multiline/header content into D1.
    if (!/^[A-Za-z0-9._:-]{1,256}$/.test(messageId)) {
      throw new Error('メール送信の受付応答が不正です');
    }
    return { messageId, deliveryStatus: 'accepted' };
  }
}

export type EmailProviderResult =
  | { ok: true; provider: EmailProvider }
  | { ok: false; status: number; error: string };

// RESEND_API_KEY 未設定なら fail closed（503）。本物の問い合わせをサイレントに握り潰さない。
export function getEmailProvider(env: Env): EmailProviderResult {
  if (!env.RESEND_API_KEY) {
    return {
      ok: false,
      status: 503,
      error: 'お問い合わせの送信設定が未完了です。お手数ですが時間をおいて再度お試しください。',
    };
  }
  return { ok: true, provider: new ResendProvider(env.RESEND_API_KEY) };
}

const DEFAULT_INTERNAL_CC = [
  'company@cor-jp.com',
  'k.isayama@cor-jp.com',
  'nagisa.terada@cor-jp.com',
] as const;

/**
 * 社内通知のCC設定を配列へ正規化する。
 * CONTACT_CC_EMAIL は旧単一値として残し、既存Secret/Previewの段階移行を許容する。
 * 不正な設定値はヘッダへ渡さず、重複も除去する（CRLF/PIIのログ露出を防ぐ）。
 */
export function getInternalCcRecipients(env: Env): string[] {
  const configured = env.CONTACT_CC_EMAILS?.trim()
    || env.CONTACT_CC_EMAIL?.trim()
    || DEFAULT_INTERNAL_CC.join(',');
  return [...new Set(configured.split(',').map((address) => address.trim().toLowerCase()).filter(isValidEmail))];
}

// 件名: 分類・intent を含め、社内でトリアージしやすくする。
export function buildSubject(inquiry: NormalizedInquiry): string {
  const tags: string[] = [];
  if (inquiry.classification) tags.push(inquiry.classification);
  if (inquiry.intent) tags.push(inquiry.intent);
  const prefix = tags.length ? `[${tags.join('][')}] ` : '';
  return `${prefix}お問い合わせ: ${inquiry.name}`;
}

/** メールへ載せる要約の正本。旧fixtureのconversationSummaryも一度だけ正規化する。 */
export function getSummaryText(inquiry: NormalizedInquiry): string {
  const canonical = canonicalizeSummaryText(inquiry.summaryText || inquiry.conversationSummary || '');
  if (canonical && canonical === maskSensitiveContent(canonical)) return canonical;
  return `要約未生成（決定的fallback）: ${buildDeterministicSummary(inquiry)}`;
}

/** 本人向けには社内分類を出さない。要約が無い場合も構造化リードだけを使う。 */
export function getReceiptSummaryText(inquiry: NormalizedInquiry): string {
  const canonical = canonicalizeSummaryText(inquiry.summaryText || inquiry.conversationSummary || '');
  // A visitor-confirmed handoff summary is already PII/secret checked at the
  // Worker boundary. Preserve it byte-for-byte after canonical normalization,
  // even when ordinary prose contains words such as "intent" or "相談目的".
  if (inquiry.summaryConfirmed && canonical && canonical === maskSensitiveContent(canonical)) return canonical;
  const containsInternalLabel = /\b(?:genuine|sales|spam|classification|intent|source|utm)\b|(?:分類|相談目的)\s*[:：]/i.test(canonical);
  if (canonical && !containsInternalLabel && canonical === maskSensitiveContent(canonical)) return canonical;
  const lead = inquiry.structuredLead || {};
  const parts = [lead.purpose, lead.contactReason, lead.industryRole, lead.stage, lead.timingBudget, lead.discoverySource]
    .filter((value): value is string => Boolean(value))
    .map(maskSensitiveContent);
  return parts.length ? parts.join(' / ') : '要約未生成（受付内容を担当者が確認します）';
}

/** Internal-only context. Apply a final mask at the email boundary as defense in depth. */
export function getConversationExcerptText(inquiry: NormalizedInquiry): string {
  const raw = typeof inquiry.conversationExcerpt === 'string' ? inquiry.conversationExcerpt : '';
  return maskSensitiveContent(raw.replace(/\r\n?/g, '\n').trim())
    .slice(0, MAX_CONVERSATION_EXCERPT_LEN)
    .trim();
}

// 本文: 構造化した問い合わせ＋会話サマリ＋分類メモ。
// PII（name/email/company/message）はこのメール本文にのみ載る。LLM には絶対に渡さない。
export function buildBody(inquiry: NormalizedInquiry): string {
  const lines = [
    'cor-jp.com のお問い合わせフォーム（AIチャット）から新しい問い合わせが届きました。',
    '',
    '── お問い合わせ内容 ──',
    `お名前　: ${inquiry.name}`,
    `メール　: ${inquiry.email}`,
    `会社名　: ${inquiry.company || '(未記入)'}`,
    `intent　: ${inquiry.intent || '(未指定)'}`,
    `source　: ${inquiry.source || '(未指定)'}`,
    '',
    '── 本文 ──',
    inquiry.message,
  ];
  const lead = inquiry.structuredLead || {};
  const leadLines: string[] = [];
  if (lead.purpose) leadLines.push(`目的　　: ${lead.purpose}`);
  if (lead.industryRole) leadLines.push(`業種・役割: ${lead.industryRole}`);
  if (lead.dataSensitivity) leadLines.push(`データ感度: ${lead.dataSensitivity}`);
  if (lead.stage) leadLines.push(`進捗段階: ${lead.stage}`);
  if (lead.timingBudget) leadLines.push(`時期・予算: ${lead.timingBudget}`);
  if (lead.discoverySource) leadLines.push(`流入経路: ${lead.discoverySource}`);
  if (lead.contactReason) leadLines.push(`連絡理由: ${lead.contactReason}`);
  if (leadLines.length) {
    lines.push('', '── 構造化リード（非PII） ──', ...leadLines);
  }
  const utmEntries = Object.entries(inquiry.utm || {});
  if (utmEntries.length) {
    lines.push('', '── UTM ──');
    for (const [k, v] of utmEntries) lines.push(`${k}: ${v}`);
  }
  const conversationExcerpt = getConversationExcerptText(inquiry);
  if (conversationExcerpt) {
    lines.push(
      '',
      '── 安全化会話抜粋（社内通知のみ） ──',
      conversationExcerpt,
      '※会話抜粋はサーバー側でマスキング・文字数制限済みです。',
    );
  }
  lines.push('', '── AI要約（AIチャットの会話サマリ / summaryText） ──', getSummaryText(inquiry));
  lines.push(
    '',
    '── AIによる分類（参考） ──',
    inquiry.classification || '(未分類)',
    '',
    '※この分類はAIの自動判定です。最終判断は担当者が行ってください。',
  );
  return lines.join('\n');
}

// 問い合わせメールを社内インボックスへ送る。
// 差出人は CONTACT_FROM_EMAIL 固定（なりすまし防止）だが、reply_to に問い合わせ者の
// メールを入れることで、担当者が「返信」すると顧客へ直接届く（contact flow を壊さない）。
export async function sendInquiryEmail(
  env: Env,
  provider: EmailProvider,
  inquiry: NormalizedInquiry,
): Promise<EmailSendResult> {
  return provider.send(
    env.CONTACT_TO_EMAIL || 'cloudia@cor-jp.com',
    env.CONTACT_FROM_EMAIL,
    buildSubject(inquiry),
    buildBody(inquiry),
    inquiry.email, // reply_to: isValidEmail 済みの単一アドレス
    getInternalCcRecipients(env),
  );
}

/** 社内情報・分類・会話本文を含めない、問い合わせ者本人向けの受付確認本文。 */
export function buildReceiptSubject(): string {
  return 'お問い合わせを受け付けました | cor-jp.com';
}

export function buildReceiptBody(inquiry: NormalizedInquiry, receiptId: string): string {
  return [
    `${inquiry.name} 様`,
    '',
    'お問い合わせを受け付けました。担当者が内容を確認のうえ、改めてご連絡します。',
    '',
    '── ご相談の要約 ──',
    getReceiptSummaryText(inquiry),
    '',
    '── ご入力の補足 ──',
    inquiry.message || '（補足なし）',
    '',
    '受付内容は担当者が確認します。追加情報がある場合は、cor-jp.comのお問い合わせフォームからお知らせください。',
    '返信目安: 2営業日以内',
    '',
    `受付番号: ${receiptId}`,
    '',
    'このメールは自動送信です。心当たりがない場合は、このメールに返信せず破棄してください。',
  ].join('\n');
}

/** 問い合わせ者本人へ送る受付確認。社内CC・返信先・社内分類は付与しない。 */
export async function sendReceiptEmail(
  env: Env,
  provider: EmailProvider,
  inquiry: NormalizedInquiry,
  receiptId: string,
): Promise<EmailSendResult> {
  return provider.send(
    inquiry.email,
    env.CONTACT_FROM_EMAIL,
    buildReceiptSubject(),
    buildReceiptBody(inquiry, receiptId),
  );
}
