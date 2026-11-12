export interface Env {
  // secrets（wrangler secret put で登録）
  ANTHROPIC_API_KEY: string; // LLM_PROVIDER=anthropic のとき必須。未設定なら /chat を fail closed。
  RESEND_API_KEY: string; // /submit のメール送信に必須。未設定なら 503（本物の問い合わせを握り潰さない）。
  TURNSTILE_SECRET: string; // Cloudflare Turnstile。任意。未設定なら検証スキップ（turnstileのみ fail open）。
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
  // D1/Queue は本番・Previewで別バインディングを設定する。未設定時は従来の直送経路を維持。
  DB?: D1Database;
  CONTACT_NOTIFICATIONS?: Queue<NotificationMessage>;
  PII_ENCRYPTION_KEY?: string;
  PII_HMAC_KEY?: string;
  /**
   * 資料請求の社内通知のモード。未設定 = hold = 送らない。この PR（#530）は wrangler.toml に書かない。
   * live にするときは、専用の PR で、本番側の [vars] に DOCUMENT_REQUEST_NOTIFY_RELEASED_AT と一緒に書く
   * （片方だけなら document-notice-config.test.ts が落ちる。preview の vars には書かない）。
   * 値は小文字の live だけ。LIVE や前後の空白つきは hold。
   * live のときだけ、解放時刻以降に作られた行の社内通知を送る。hold と mock は、キュー消費で送らず held に戻す。
   */
  DOCUMENT_REQUEST_NOTIFY_MODE?: string;
  /**
   * live の解放時刻（10 桁の unix 秒）。秘密ではない。これより前に作られた行は、
   * 重複の再申込みや cron では送らない（hold の時期の held を設定変更で流さない）。
   * 未設定・不正なら live でも送らない（fail closed）。
   * 配備が終わる予定より後の時刻を書く。止めて再び live にするときは、必ず新しい時刻にする
   * （行は held になった理由を持たないので、古い値を使い回すと、止めていた間の保留分が同日の再申込みで流れる）。
   */
  DOCUMENT_REQUEST_NOTIFY_RELEASED_AT?: string;
  /**
   * 案件同期。wrangler には書かない。mock 以外は binding があっても呼ばない。
   * 資格は PII の鍵とは別。未設定なら外部通信しない。
   */
  DOCUMENT_REQUEST_CASE_SYNC_MODE?: string;
  DOCUMENT_REQUEST_SYNC_PRINCIPAL_ID?: string;
  DOCUMENT_REQUEST_SYNC_TOKEN?: string;
  DOCUMENT_REQUEST_CASE_SYNC?: DocumentRequestCaseSyncBinding;
}

export type DocumentRequestSyncIndustry =
  | ''
  | 'medical'
  | 'shigyo'
  | 'construction'
  | 'manufacturing'
  | 'education';

/** 受信側の source。キーはこの6つ。未選択の業種は空文字。 */
export interface DocumentRequestSyncSource {
  receiptId: string;
  documentId: 'company-deck';
  industry: DocumentRequestSyncIndustry;
  consentVersion: string;
  /** 初回保存の UTC ISO。再送時刻ではない。 */
  recordedAt: string;
  intakeStatus: 'stored';
}

/** 受信側の authority。キーはこの2つ。syncToken は生のトークン。 */
export interface DocumentRequestSyncAuth {
  principalId: string;
  syncToken: string;
}

export type DocumentRequestSyncOutcome =
  | 'rejected'
  | 'not_connected'
  | 'recorded'
  | 'retry_scheduled'
  | 'quarantined'
  | 'conflict'
  | 'lease_held'
  | 'ack_unknown';

export type DocumentRequestSyncCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'unavailable'
  | 'invalid_envelope'
  | 'production_recording_not_connected'
  | 'recorded'
  | 'duplicate'
  | 'retry_scheduled'
  | 'quarantined'
  | 'conflict'
  | 'not_held'
  | 'invalid_source'
  | 'lease_held'
  | 'ack_unknown'
  | 'unconfigured';

export type DocumentRequestSyncWireStatus =
  | 'rejected'
  | 'not_connected'
  | 'recorded'
  | 'retry_scheduled'
  | 'quarantined'
  | 'leased'
  | 'ack_unknown';

/** 受信側の Result。disposition はない。 */
export interface DocumentRequestSyncResult {
  outcome: DocumentRequestSyncOutcome;
  code: DocumentRequestSyncCode;
  declaredIntakeStatus: 'stored' | 'not_accepted';
  syncStatus: DocumentRequestSyncWireStatus;
  attemptCount: number;
  duplicate: boolean;
  receiptId?: string;
  caseId?: string;
}

/** cor-os-workbench の DocumentRequestCaseSync。未接続のまま型だけ置く。 */
export interface DocumentRequestCaseSyncBinding {
  acceptStored(auth: DocumentRequestSyncAuth, source: DocumentRequestSyncSource): Promise<DocumentRequestSyncResult>;
  retry(auth: DocumentRequestSyncAuth, receiptId: string): Promise<DocumentRequestSyncResult>;
}

export interface NotificationMessage {
  submissionId: string;
  /** 未指定は社内通知（旧Queue payloadとの後方互換）。 */
  messageType?: NotificationType;
}

export type NotificationType = 'internal' | 'receipt';

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

/** Phase 3 (#259) で Grift 自動ハンドオフする intent。#250 では定数のみ。 */
export const AUTO_HANDOFF_INTENTS = ['contract-dev'] as const;

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

// /submit の受け取り。PII を含む。LLM には絶対に渡さない（メールにのみ送る）。
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
