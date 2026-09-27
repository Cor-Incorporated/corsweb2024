export interface Env {
  // secrets（wrangler secret put で登録）
  ANTHROPIC_API_KEY: string; // LLM_PROVIDER=anthropic のとき必須。未設定なら /chat を fail closed。
  RESEND_API_KEY: string; // /submit のメール送信に必須。未設定なら 503（本物の問い合わせを握り潰さない）。
  TURNSTILE_SECRET?: string; // Turnstile secret。TURNSTILE_REQUIRED=true のとき必須（値はログ禁止）。
  CLOUDIA_HANDOFF_AUTH_TOKEN?: string; // Cloudia→Grift Bearer token。値はsecretとしてのみ登録する。
  // vars（公開可・非シークレット）
  LLM_PROVIDER: string; // 既定 'vertex-gemini'。'anthropic' でロールバック可能。
  GOOGLE_CLOUD_PROJECT?: string;
  GOOGLE_CLOUD_LOCATION?: string;
  VERTEX_MODEL?: string;
  VERTEX_GATEWAY_URL?: string;
  VERTEX_GATEWAY_SECRET?: string;
  CONTACT_TO_EMAIL: string; // 問い合わせメールの宛先（社内インボックス）。
  /** 互換用の単一値。新規設定は CONTACT_CC_EMAILS を使う。 */
  CONTACT_CC_EMAIL?: string;
  /** カンマ区切りの社内CC宛先。コード側で配列へ正規化する。 */
  CONTACT_CC_EMAILS?: string;
  CONTACT_FROM_EMAIL: string; // 問い合わせメールの差出人。
  CONTACT_SITE_ENV: string; // exact 'production' / 'preview'。未知値は問い合わせAPIをfail closed。
  TURNSTILE_REQUIRED?: string; // 'true' で /submit を fail closed。未設定/'false' は後方互換。
  TURNSTILE_ALLOWED_HOSTNAMES?: string; // Siteverify hostname のカンマ区切り exact allowlist。
  GRIFT_HANDOFF_ENABLED?: string; // 'true' のときだけ対象4 intentの同期handoffを試行する。
  GRIFT_API_ORIGIN?: string; // Grift内部APIのHTTPS origin。pathや認証情報は含めない。
  GRIFT_PUBLIC_URL_ORIGINS?: string; // browserへ返せる公開portal originのカンマ区切りallowlist。
  CLOUDIA_RELEASE_ID?: string; // UAT release bundleの公開識別子。secretではない。
  CLOUDIA_CANDIDATE_SHA?: string; // このWorker artifactを生成したcorswebのfull commit SHA。
  CF_VERSION_METADATA?: { id: string; tag?: string; timestamp: string }; // Cloudflareが付与する実配信version metadata。
  // D1/Queue は本番・Previewで別バインディングを設定する。未設定時は従来の直送経路を維持。
  DB?: D1Database;
  CONTACT_NOTIFICATIONS?: Queue<NotificationMessage>;
  PII_ENCRYPTION_KEY?: string;
  PII_HMAC_KEY?: string;
}

export interface NotificationMessage {
  submissionId: string;
  /** 未指定は社内通知（旧Queue payloadとの後方互換）。 */
  messageType?: NotificationType;
}

export type NotificationType = 'internal' | 'receipt';

/** Explicit, versioned consent accepted at the Worker trust boundary. */
export interface HandoffConsent {
  accepted: true;
  version: 'cloudia-grift-v1';
  /** Worker receive time; authoritative for the Grift request and D1 audit. */
  acceptedAt: string;
  /** Browser timestamp retained only as non-authoritative audit evidence. */
  browserAcceptedAt: string;
  /** The visitor confirmed the exact editable summary submitted in summaryText.text. */
  summaryConfirmed: true;
}

// /chat のメッセージ。role は user|assistant のみ（system はサーバ側が付与）。
export type ChatRole = 'user' | 'assistant';
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** Versioned, non-PII summary envelope accepted by /submit. */
export interface ConversationSummaryV1 {
  version: 1;
  locale: ChatLocale;
  intent: ContactIntent | '';
  classification: Classification | '';
  readyForContact: boolean;
  stage: string;
  structuredLead: StructuredLead;
  text: string;
  /** Alias accepted from clients that name the canonical field summaryText. */
  summaryText?: string;
}

// 問い合わせの分類。LLM が会話から判定する。
export type Classification = 'genuine' | 'sales' | 'spam';
export type ChatMode = 'intake' | 'ambassador';
export type ChatLocale = 'ja' | 'en';

/**
 * ADR-0014 intent 正本（7 キー）。
 * src/config/site.ts の CONTACT_INTENTS と同値（parity テストで一致を担保）。
 */
export const CONTACT_INTENTS = [
  'confidential-ai-assessment',
  'local-llm-poc',
  'grift-team-beta',
  'grift-paid-trial',
  'estimate-audit',
  'contract-dev',
  'press-speaking-other',
] as const;

export type ContactIntent = (typeof CONTACT_INTENTS)[number];

/** Cloudia/Grift横断契約でGrift handoff対象となるintent。 */
export const AUTO_HANDOFF_INTENTS = [
  'contract-dev',
  'grift-team-beta',
  'grift-paid-trial',
  'estimate-audit',
] as const satisfies readonly ContactIntent[];

// 構造化リード（PII ではない。具体データ本文は入れない）
export interface StructuredLead {
  purpose?: string;
  industryRole?: string;
  dataSensitivity?: string;
  stage?: string;
  timingBudget?: string;
  /** サイトを知った経路（検索、紹介、SNS等）。内部タグsourceとは別物。 */
  discoverySource?: string;
  /** 今回連絡する理由・期待する支援。 */
  contactReason?: string;
}

// /chat のレスポンス。PII は一切含まない（会話のみ）。
export interface ChatResult {
  reply: string;
  classification: Classification;
  readyForContact: boolean;
  /** 非PIIの短い要約。メール本文の正本候補。 */
  summary: string;
  /** 確定または推定された intent（未知は落とす） */
  intent?: ContactIntent | '';
  structuredLead?: StructuredLead;
  /** D1セッションを有効化した場合に返す会話識別子。PIIは含まない。 */
  sessionId?: string;
  stage?: string;
  missingFields?: string[];
}

// /submit の受け取り。PII を含む。LLMには渡さず、メールと明示同意済みGrift handoffだけで扱う。
export interface InquiryInput {
  sessionId?: unknown;
  idempotencyKey?: unknown;
  name?: unknown;
  email?: unknown;
  company?: unknown;
  message?: unknown;
  /** 新規クライアントの正本。version 1 envelope（textが要約本文）。 */
  summaryText?: unknown;
  /** 旧クライアント互換。summaryTextが無い場合だけ参照する。 */
  conversationSummary?: unknown;
  classification?: unknown;
  intent?: unknown;
  source?: unknown;
  structuredLead?: unknown;
  utm?: unknown;
  handoffConsent?: unknown;
  turnstileToken?: unknown;
  website?: unknown; // ハニーポット（人間は空のまま）。値が入っていれば bot とみなす。
}

// 検証・正規化済みの問い合わせ（メール本文に使う）。
export interface NormalizedInquiry {
  name: string;
  email: string;
  company: string;
  message: string;
  /** 正規化済みの要約本文。メール・D1はこの値だけを要約として扱う。 */
  summaryText?: string;
  /** 画面で確認された要約は D1・両メール・Grift で同一文面を保持する。 */
  summaryConfirmed?: true;
  /** 旧クライアント互換の入力名。新規コードは summaryText を使う。 */
  conversationSummary: string;
  classification: Classification | '';
  intent: ContactIntent | '';
  source: string;
  structuredLead: StructuredLead;
  utm: Record<string, string>;
  /** サーバー生成・マスキング済みの社内通知用会話抜粋。receiptには使用しない。 */
  conversationExcerpt?: string;
}
