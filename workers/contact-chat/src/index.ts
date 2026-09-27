import type {
  ChatLocale,
  ChatMessage,
  ChatMode,
  ChatResult,
  Classification,
  ContactIntent,
  Env,
  InquiryInput,
  NormalizedInquiry,
  NotificationMessage,
  NotificationType,
  StructuredLead,
} from './types';
import { AUTO_HANDOFF_INTENTS } from './types';
import {
  normalizeInquiry,
  normalizeConfirmedSummaryText,
  normalizeIntent,
  normalizeMessages,
  buildDeterministicSummary,
  canonicalizeSummaryText,
  buildConversationExcerpt,
  maskMessagesForLlm,
  maskSensitiveContent,
  normalizeSource,
  normalizeStructuredLead,
} from './validate';
import {
  CHAT_LIMIT,
  SUBMIT_LIMIT,
  clientIp,
  isRateLimited,
  isContactOriginAllowed,
  isValidPreviewContactPreflight,
  previewContactCorsHeaders,
  verifyTurnstile,
} from './security';
import { buildSystemPrompt, getProvider } from './llm';
import { getEmailProvider, sendInquiryEmail, sendReceiptEmail } from './email';
import { handoffToGrift, normalizeHandoffConsent, type BrowserHandoff, type HandoffConsent } from './grift';
import {
  claimOutbox,
  createSubmission,
  getSubmissionForNotification,
  getTrustedContactSession,
  applyTrustedContactSession,
  applyUntrustedContactSessionFallback,
  markOutboxFailed,
  markOutboxSent,
  newSessionId,
  normalizeIdempotencyKey,
  normalizeSessionId,
  newReceiptId,
  purgeExpiredData,
  queueMessage,
  SubmissionConflictError,
  upsertContactSession,
  type TrustedContactSession,
} from './storage';

// 最大リクエストボディサイズ（DoS/暴走入力対策）。会話＋サマリでも十分な余裕。
const MAX_BODY_BYTES = 64 * 1024;

type WorkerFailureEvent =
  | 'contact_chat_session_store_failed'
  | 'contact_chat_llm_failed'
  | 'contact_chat_email_not_configured'
  | 'contact_chat_session_restore_failed'
  | 'contact_chat_submission_store_failed'
  | 'contact_chat_notification_queue_not_configured'
  | 'contact_chat_notification_enqueue_failed'
  | 'contact_chat_email_send_failed'
  | 'contact_chat_request_failed'
  | 'contact_chat_retention_cleanup_failed';

function logWorkerFailure(event: WorkerFailureEvent): void {
  // Fixed enums only. Never include exception messages, request fields, IDs,
  // provider bodies, URLs, PII, tokens, or secrets in production logs.
  console.error(JSON.stringify({ event }));
}

const json = (data: unknown, status = 200, additionalHeaders: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      // 認証なしの公開エンドポイントだがキャッシュさせない（応答に分類等が含まれるため）。
      'cache-control': 'no-store',
      ...additionalHeaders,
    },
  });

const CONTACT_BROWSER_API_PATHS = new Set([
  '/api/contact/chat',
  '/api/contact/chat/start',
  '/api/contact/submit',
]);

function withContactCors(
  response: Response,
  corsHeaders: Readonly<Record<string, string>> | null,
): Response {
  if (!corsHeaders) return response;
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(corsHeaders)) headers.set(name, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

const CANDIDATE_SHA_PATTERN = /^[0-9a-f]{40}$/;
const RELEASE_ID_PATTERN = /^[A-Za-z0-9._:-]{1,100}$/;
const WORKER_VERSION_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function healthResponse(env: Env): Response {
  if (env.GRIFT_HANDOFF_ENABLED !== 'true') return json({ ok: true });

  const candidateSha = env.CLOUDIA_CANDIDATE_SHA || '';
  const releaseId = env.CLOUDIA_RELEASE_ID || '';
  const revision = env.CF_VERSION_METADATA?.id || '';
  const timestamp = env.CF_VERSION_METADATA?.timestamp || '';
  const parsedTimestamp = Date.parse(timestamp);
  if (
    !CANDIDATE_SHA_PATTERN.test(candidateSha)
    || !RELEASE_ID_PATTERN.test(releaseId)
    || !WORKER_VERSION_PATTERN.test(revision)
    || !Number.isFinite(parsedTimestamp)
  ) {
    return json({ error: 'release metadata unavailable' }, 503);
  }

  const generatedAt = new Date(parsedTimestamp).toISOString();
  return json({
    status: 'ok',
    service: 'contact-chat',
    generated_at: generatedAt,
    candidate_sha: candidateSha,
    revision,
    release_id: releaseId,
  }, 200, {
    'x-cloudia-grift-candidate-sha': candidateSha,
    'x-cloudia-grift-revision': revision,
    'x-cloudia-grift-generated-at': generatedAt,
    'x-cloudia-grift-release-id': releaseId,
  });
}

// JSON ボディを上限つきで読む。Content-Type が JSON でない／不正JSON／過大は null。
async function readJsonBody(req: Request): Promise<Record<string, unknown> | null> {
  const ct = req.headers.get('content-type') || '';
  if (!/^application\/json(?:\s*;|$)/i.test(ct)) return null;
  // Content-Length is only an optimization. A missing or dishonest header must
  // still be bounded while streaming, before the complete body reaches memory.
  const declaredLength = req.headers.get('content-length');
  if (declaredLength !== null) {
    const length = Number(declaredLength);
    if (!Number.isSafeInteger(length) || length < 0 || length > MAX_BODY_BYTES) return null;
  }
  if (!req.body) return null;
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > MAX_BODY_BYTES) {
        try { await reader.cancel(); } catch { /* rejection path; best effort */ }
        return null;
      }
      chunks.push(chunk.value);
    }
  } catch {
    return null;
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes);
    const data = JSON.parse(text);
    return data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

// LLM の出力（JSON文字列のはず）を厳格にパースし、ChatResult へ正規化する。
// 形式が崩れていても安全側に倒す（reply はテキストとして扱い、分類は genuine 既定）。
const VALID_CLASS: readonly Classification[] = ['genuine', 'sales', 'spam'];
const MAX_CHAT_SUMMARY_LEN = 1500;
const EMPTY_SUMMARY = {
  ja: '要約未生成（受付内容を担当者が確認します）',
  en: 'Summary unavailable; the team will review the inquiry.',
} as const;
const SUMMARY_ROLE_LINE = /(?:^|\n)\s*(?:user|assistant|system|human|you|ai\s+assistant|ユーザー|あなた|アシスタント|AI\s*アシスタント|クラウディア)\s*(?:[:：]|[-—])\s*/im;
const SUMMARY_SECRET_RE = /(?:AIza[0-9A-Za-z_-]{20,}|(?:sk|ghp|xox[baprs]?)-[A-Za-z0-9_-]{16,}|-----BEGIN(?: [A-Z]+)* PRIVATE KEY-----)/;

function isSafeChatSummary(candidate: string): boolean {
  return candidate.length > 0
    && candidate.length <= MAX_CHAT_SUMMARY_LEN
    && !SUMMARY_ROLE_LINE.test(candidate)
    && !SUMMARY_SECRET_RE.test(candidate)
    && candidate === maskSensitiveContent(candidate);
}

const COMPANY_DETAIL_TERMS = /(?:コー株式会社|Cor\.inc|ブランド|読み|ふりがな|正式名称|read\s+as|pronounc|legal\s+name|brand)/i;
const COMPANY_DETAIL_QUESTION = /(?:[?？]|教えて|知りたい|とは|どう読む|読み方|what|how|which|tell me)/i;

/**
 * Keep ordinary model replies on the short company name even when the model
 * volunteers a parenthetical reading/brand explanation. Details remain
 * available when the visitor explicitly asks about the company name.
 */
export function normalizeCompanyNameReply(reply: string, messages: ChatMessage[]): string {
  const latestUser = [...messages].reverse().find((message) => message.role === 'user')?.content || '';
  const allowsDetail = COMPANY_DETAIL_TERMS.test(latestUser) && COMPANY_DETAIL_QUESTION.test(latestUser);
  if (allowsDetail) return reply;
  return reply.replace(/\bCor(?:\.株式会社|\.\s*Inc\.?)\s*[（(]([^）)]{0,180})[）)]/gi, (whole, detail: string) => {
    return COMPANY_DETAIL_TERMS.test(detail) ? 'Cor.株式会社' : whole;
  });
}

// 文字列リテラルを尊重しながら、最初のトップレベル `{...}` を抜き出す。
// 散文に包まれた JSON（"Sure!\n{...}"）や、reply 値に ``` を含むケースでも、
// JSON 部分だけを正しく取り出せる（フェンス正規表現では取りこぼす）。
export function extractJsonObject(s: string): string | null {
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return s.slice(start, i + 1);
  }
  return null;
}

// LLM の出力（JSON文字列のはず）を厳格にパースし、ChatResult へ正規化する。
// 形式が崩れていても安全側に倒す（生のモデル出力を reply として漏らさない）。
// 試行順: (a) フェンスブロック → (b) trim 全体 → (c) extractJsonObject。
// 全て失敗したときのみ素のテキストへフォールバックする。
export function parseChatResult(raw: string, fallbackIntent: ContactIntent | '' = '', locale: ChatLocale = 'ja'): ChatResult {
  if (new TextEncoder().encode(raw).length > 16 * 1024) raw = '';
  const trimmed = raw.trim();
  let classification: Classification = 'genuine';
  let readyForContact = false;
  let intent: ContactIntent | '' = fallbackIntent;
  let structuredLead: StructuredLead | undefined;
  let summary = '';

  // 候補を優先順で構築（最初に parse 成功したものを採用）。
  const candidates: string[] = [];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) candidates.push(fenced[1].trim());
  candidates.push(trimmed);
  const extracted = extractJsonObject(trimmed);
  if (extracted) candidates.push(extracted);

  let reply = '';
  let parsedOk = false;
  for (const candidate of candidates) {
    try {
      const obj = JSON.parse(candidate);
      // 配列/数値/null も JSON.parse は通すため、オブジェクトのみ採用する。
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) continue;
      const o = obj as Partial<ChatResult> & { intent?: unknown; structuredLead?: unknown };
      if (typeof o.reply === 'string') reply = o.reply.trim();
      if (typeof o.classification === 'string' && VALID_CLASS.includes(o.classification)) {
        classification = o.classification;
      }
      if (typeof o.readyForContact === 'boolean') readyForContact = o.readyForContact;
      if (typeof o.summary === 'string') {
        const candidate = canonicalizeSummaryText(o.summary);
        // A model-produced summary containing detected PII is discarded rather
        // than partially redacted; the deterministic structured fallback is safer.
        // Oversized and role-labelled values are rejected as untrusted transcripts.
        if (isSafeChatSummary(candidate)) {
          summary = candidate;
        }
      }
      // LLM が返した intent を正規化。空ならクライアント初期値を維持。
      const llmIntent = normalizeIntent(o.intent);
      // URL/UI で明示された intent はルーティングの正本。モデル推定で上書きしない。
      if (!fallbackIntent && llmIntent) intent = llmIntent;
      const lead = normalizeStructuredLead(o.structuredLead);
      if (Object.keys(lead).length > 0) structuredLead = lead;
      parsedOk = true;
      break;
    } catch {
      // 次の候補へ。
    }
  }

  // どの候補も object として parse できなければ、素の文章を reply とする（会話を止めない）。
  // ただし生の JSON ブロブをそのまま返さないよう、parse 成功時は reply のみを使う。
  if (!parsedOk) reply = '';
  if (!reply) reply = locale === 'en'
    ? 'Sorry, could you please tell me that again?'
    : '申し訳ありません、もう一度お聞かせいただけますか？';
  const result: ChatResult = { reply, classification, readyForContact, summary: '' };
  if (intent) result.intent = intent;
  if (structuredLead) result.structuredLead = structuredLead;
  if (summary) {
    result.summary = summary;
  } else {
    // Structured fields are model output too. Refuse a fallback that would
    // re-introduce PII or a transcript, and use a fixed non-sensitive message.
    const deterministic = canonicalizeSummaryText(buildDeterministicSummary({ classification, intent, structuredLead: structuredLead || {} }));
    const fallbackSummary = deterministic.startsWith('要約未生成')
      ? deterministic
      : `要約未生成（決定的fallback）: ${deterministic}`;
    result.summary = isSafeChatSummary(deterministic)
      ? fallbackSummary
      : EMPTY_SUMMARY[locale];
  }
  return result;
}

function leadMissingFields(lead: StructuredLead | undefined): string[] {
  const fields: Array<keyof StructuredLead> = ['purpose', 'industryRole', 'dataSensitivity', 'stage', 'timingBudget'];
  return fields.filter((field) => !lead?.[field]);
}

function resultStage(result: ChatResult): string {
  if (result.readyForContact) return 'ready';
  return result.structuredLead && Object.keys(result.structuredLead).length > 0 ? 'qualifying' : 'intent';
}

function startReply(mode: ChatMode, locale: ChatLocale, intent: ContactIntent | '' = ''): string {
  if (intent === 'press-speaking-other') {
    return locale === 'en'
      ? 'Thanks. This is a press, speaking, or other public-outreach request. What type of opportunity (interview, article, speaking, event participation, or something else) and topic would you like to discuss?'
      : 'ありがとうございます。取材・登壇・その他の対外相談ですね。まず、ご希望の種類（取材・記事、登壇、イベント参加など）とテーマを教えてください。';
  }
  if (mode === 'ambassador') {
    return locale === 'en'
      ? 'Hello. I am Cloudia from Cor. This is the casual conversation mode. Please ask about our services or technology, and I can guide you to the formal inquiry flow when a concrete project comes up.'
      : 'こんにちは。Cor.株式会社のCloudiaです。こちらは雑談モードです。会社やAI技術についてご質問があればお聞かせください。具体的なご相談になった場合は、受付モードへご案内します。';
  }
  return locale === 'en'
    ? 'Thank you. I will ask a few quick questions so we can understand your request. What would you like to achieve?'
    : 'ありがとうございます。ご相談内容を正確に把握するため、いくつか質問します。まず、今回実現したいことを教えてください。';
}

// POST /api/contact/chat — 会話による問い合わせの絞り込み。PIIは扱わない。
// Turnstile は付与しない（トークンは単回使用で、複数ターン会話では2ターン目以降に
// 新しいトークンが無く 403 になってしまうため）。/chat の悪用対策は
// レート制限＋同一オリジン＋（必須の）Cloudflare WAF レート制限ルールで担保する。
// PII を扱う本命の濫用点である /submit でのみ Turnstile を要求する。
async function handleChat(req: Request, env: Env, forceStart = false): Promise<Response> {
  const body = await readJsonBody(req);
  if (!body) return json({ error: 'リクエストボディが不正なJSONです' }, 400);

  // intent/source はサーバ側で正規化して system に注入（messages は改ざんしない）。
  // 未知キーは空に落とす（400 にしない = 後方互換）。
  const initialIntent = normalizeIntent(body.intent);
  const source = normalizeSource(body.source);
  const mode: ChatMode = body.mode === 'ambassador' ? 'ambassador' : 'intake';
  if (body.mode !== undefined && body.mode !== 'intake' && body.mode !== 'ambassador') {
    return json({ error: 'mode は intake か ambassador のみ許可されます' }, 400);
  }
  const locale: ChatLocale = body.locale === 'en' ? 'en' : 'ja';
  if (body.locale !== undefined && body.locale !== 'ja' && body.locale !== 'en') {
    return json({ error: 'locale は ja か en のみ許可されます' }, 400);
  }

  // Intent選択直後は、まだユーザー発話がないため空の会話をLLMへ送らない。
  // UIがこの応答を最初のCloudiaメッセージとして表示し、続く発話から通常の
  // /chat 経路へ入る。外部プロバイダ障害でもヒアリング導線を止めない。
  const isStart = forceStart || body.start === true || body.event === 'intent_selected';
  if (isStart) {
    const reply = startReply(mode, locale, initialIntent);
    const sessionId = normalizeSessionId(body.sessionId) || newSessionId();
    const result: ChatResult = {
      reply,
      classification: 'genuine',
      readyForContact: false,
      summary: initialIntent
        ? (locale === 'en' ? `Inquiry intent: ${initialIntent}` : `相談目的: ${initialIntent}`)
        : EMPTY_SUMMARY[locale],
      ...(initialIntent ? { intent: initialIntent } : {}),
      sessionId,
      stage: 'intent',
      missingFields: ['purpose'],
    };
    try {
      await upsertContactSession(env, {
        sessionId,
        intent: initialIntent,
        mode,
        locale,
        source,
        stage: 'intent',
        turnCount: 0,
        structuredLead: {},
        missingFields: ['purpose'],
        classification: 'genuine',
        summary: result.summary,
        conversationExcerpt: '',
      });
    } catch {
      logWorkerFailure('contact_chat_session_store_failed');
      if (env.DB) return json({ error: 'チャットを開始できません。時間をおいて再試行してください' }, 503);
    }
    return json(result);
  }

  const norm = normalizeMessages(body.messages);
  if (!norm.ok) return json({ error: norm.error }, norm.status);

  // fail closed: LLM 未設定なら 503（getProvider が投げる）。
  let provider;
  try {
    provider = getProvider(env);
  } catch {
    return json({ error: 'AIが一時的に利用できません。時間をおいて再試行してください' }, 503);
  }

  const system = buildSystemPrompt({ intent: initialIntent, source, mode, locale });

  let raw: string;
  try {
    // The UI warns against PII, but the server remains the final boundary. Send
    // only masked messages to Vertex/Anthropic; the original browser transcript
    // is never persisted by the chat endpoint.
    raw = await provider.chat(system, maskMessagesForLlm(norm.messages));
  } catch {
    logWorkerFailure('contact_chat_llm_failed');
    return json({ error: 'AIが一時的に利用できません。時間をおいて再試行してください', fallback: true }, 503);
  }

  const result = parseChatResult(raw, initialIntent, locale);
  result.reply = normalizeCompanyNameReply(result.reply, norm.messages);
  const sessionId = normalizeSessionId(body.sessionId) || newSessionId();
  result.sessionId = sessionId;
  result.missingFields = leadMissingFields(result.structuredLead);
  // Keep the model free to choose its questioning path, but do not leave the
  // visitor stranded when every non-PII intake field is already present and
  // the model under-reports readiness. This is a completeness gate, not a
  // fixed question count; press-specific flows can still hand off earlier.
  if (
    !result.readyForContact
    && Boolean(initialIntent)
    && Boolean(result.structuredLead && Object.keys(result.structuredLead).length > 0)
    && result.missingFields.length === 0
  ) {
    result.readyForContact = true;
  }
  result.stage = resultStage(result);
  try {
    await upsertContactSession(env, {
      sessionId,
      intent: initialIntent,
      mode,
      locale,
      source,
      stage: result.stage,
      turnCount: norm.messages.length,
      structuredLead: result.structuredLead || {},
      missingFields: result.missingFields,
      classification: result.classification,
      summary: result.summary,
      conversationExcerpt: buildConversationExcerpt(norm.messages),
    });
  } catch {
    logWorkerFailure('contact_chat_session_store_failed');
    if (env.DB) return json({ error: 'チャットを保存できません。時間をおいて再試行してください' }, 503);
  }
  return json(result);
}

async function safeGriftHandoff(
  env: Env,
  input: {
    submissionId: string;
    inquiry: NormalizedInquiry;
    session: TrustedContactSession | null;
    consent: HandoffConsent | null;
  },
): Promise<BrowserHandoff | null> {
  try {
    return await handoffToGrift(env, input);
  } catch {
    // Email/outbox work has already completed. Never turn an unexpected Grift
    // integration error into a failed contact submission or expose its details.
    console.error(JSON.stringify({ event: 'contact_chat_grift_handoff_failed', reason: 'unexpected' }));
    const requested = input.consent
      && (AUTO_HANDOFF_INTENTS as readonly string[]).includes(input.inquiry.intent);
    return requested ? { status: 'fallback' } : null;
  }
}

// POST /api/contact/submit — 最終送信。PIIはここで扱い、LLMには絶対渡さない。
async function handleSubmit(req: Request, env: Env): Promise<Response> {
  // Browser時刻は監査参考に留め、Griftへ渡す同意時刻はWorker受信時刻を正本とする。
  const workerReceivedAt = new Date().toISOString();
  const body = await readJsonBody(req);
  if (!body) return json({ error: 'リクエストボディが不正なJSONです' }, 400);

  // Turnstile は normalize/storage/email/Grift より前に完了させる。required-on では
  // Siteverify の success + action + hostname + freshness を満たさない限り先へ進めない。
  const ip = clientIp(req);
  const ts = await verifyTurnstile(env, body.turnstileToken, ip);
  if (!ts.ok) return json({ error: ts.error }, ts.status);

  const handoffConsent = normalizeHandoffConsent(body.handoffConsent, workerReceivedAt);
  const norm = normalizeInquiry(body as InquiryInput);
  if (!norm.ok) {
    // ハニーポット命中時は bot に成功を装って 200（実際には送信しない）。
    if (norm.honeypot) return json({ ok: true });
    return json({ error: norm.error }, norm.status);
  }
  let confirmedSummaryText: string | null = null;
  if (handoffConsent) {
    const confirmedSummary = normalizeConfirmedSummaryText(body.summaryText);
    if (!confirmedSummary.ok) return json({ error: confirmedSummary.error }, confirmedSummary.status);
    confirmedSummaryText = confirmedSummary.text;
  }

  // fail closed: メール未設定なら 503（本物の問い合わせを握り潰さない）。
  const emailProvider = getEmailProvider(env);
  if (!emailProvider.ok) {
    logWorkerFailure('contact_chat_email_not_configured');
    return json({ error: emailProvider.error }, emailProvider.status);
  }

  // Browser content is normalized before comparison, but an active D1 contact
  // session remains authoritative for routing, lead fields, and summary text.
  // This keeps encrypted storage, both notification paths, and Grift on one
  // server-confirmed structured summary.
  let inquiry: NormalizedInquiry = {
    ...norm.inquiry,
    ...(confirmedSummaryText ? {
      summaryText: confirmedSummaryText,
      conversationSummary: confirmedSummaryText,
      summaryConfirmed: true as const,
    } : {}),
  };
  // Intentionally browser-intent only: this controls the fallback response
  // shape when D1 trust is later lost; it never authorizes a Grift call.
  const handoffRequested = handoffConsent !== null
    && (AUTO_HANDOFF_INTENTS as readonly string[]).includes(inquiry.intent);
  let effectiveHandoffConsent = handoffConsent;
  let trustedSession: TrustedContactSession | null = null;
  if (env.DB) {
    const sessionId = normalizeSessionId(body.sessionId);
    try {
      trustedSession = await getTrustedContactSession(env, sessionId);
    } catch {
      // Session復元だけの障害では既存メール受付を止めない。
      logWorkerFailure('contact_chat_session_restore_failed');
    }
    if (trustedSession) {
      if (confirmedSummaryText !== null && confirmedSummaryText !== trustedSession.summary) {
        return json({
          error: '確認済み要約が現在のセッション内容と一致しません。画面を更新して再確認してください',
          code: 'CONTACT_SESSION_SUMMARY_MISMATCH',
        }, 409);
      }
      inquiry = applyTrustedContactSession(inquiry, trustedSession, handoffConsent !== null);
    } else {
      // Browser summary text is authoritative only while its active D1 session
      // can be restored, regardless of whether the consent envelope itself was
      // valid. Email/queue acceptance continues with a deterministic structured
      // fallback, but consent and transcript are removed so neither storage nor
      // Grift can treat browser text as trusted.
      inquiry = applyUntrustedContactSessionFallback(inquiry);
      effectiveHandoffConsent = null;
    }
  }

  // 本番（D1 bindingあり）は、PIIを暗号化してD1へ保存し、QueueのID payload
  // だけを発行する。メール送信はqueue consumerだけが行う。
  if (env.DB) {
    const idempotencyKey = normalizeIdempotencyKey(body.idempotencyKey);
    let created;
    try {
      created = await createSubmission(env, inquiry, {
        idempotencyKey,
        sessionId: trustedSession?.sessionId || null,
        trustedSession,
        handoffConsent: effectiveHandoffConsent,
      });
    } catch (error) {
      if (error instanceof SubmissionConflictError) {
        return json({
          error: '同じidempotency keyに異なる送信内容は使用できません',
          code: error.code,
        }, 409);
      }
      logWorkerFailure('contact_chat_submission_store_failed');
      return json({ error: 'お問い合わせを受け付けられません。時間をおいて再試行してください' }, 503);
    }
    if (!env.CONTACT_NOTIFICATIONS) {
      logWorkerFailure('contact_chat_notification_queue_not_configured');
      return json({ error: 'お問い合わせを受け付けられません。時間をおいて再試行してください' }, 503);
    }
    try {
      // Griftの成否に先立って既存2通知を必ず登録する。重複Queueはconsumer claimで無害化する。
      await Promise.all([
        env.CONTACT_NOTIFICATIONS.send(queueMessage(created.submissionId, 'internal')),
        env.CONTACT_NOTIFICATIONS.send(queueMessage(created.submissionId, 'receipt')),
      ]);
    } catch {
      logWorkerFailure('contact_chat_notification_enqueue_failed');
      return json({ error: 'お問い合わせをキューへ登録できません。時間をおいて再試行してください' }, 503);
    }
    const handoff: BrowserHandoff | null = !created.handoffConsent
      ? (handoffRequested ? { status: 'fallback' } : null)
      : await safeGriftHandoff(env, {
          submissionId: created.submissionId,
          inquiry,
          session: trustedSession,
          consent: created.handoffConsent,
        });
    return json({
      ok: true,
      receiptId: created.receiptId,
      status: 'queued',
      duplicate: created.duplicate,
      ...(handoff ? { handoff } : {}),
    });
  }

  try {
    await sendInquiryEmail(env, emailProvider.provider, inquiry);
    const receiptId = newReceiptId();
    await sendReceiptEmail(env, emailProvider.provider, inquiry, receiptId);
    const handoff = await safeGriftHandoff(env, {
      submissionId: receiptId,
      inquiry,
      session: null,
      consent: handoffConsent,
    });
    return json({ ok: true, receiptId, status: 'sent', ...(handoff ? { handoff } : {}) });
  } catch {
    logWorkerFailure('contact_chat_email_send_failed');
    return json({ error: 'お問い合わせの送信に失敗しました。時間をおいて再試行してください' }, 502);
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    // 死活確認（認証不要・PIIなし）。
    if (req.method === 'GET' && path === '/api/contact/health') {
      return healthResponse(env);
    }

    const corsEligible = CONTACT_BROWSER_API_PATHS.has(path)
      && (req.method === 'POST' || req.method === 'OPTIONS');
    const corsHeaders = corsEligible ? previewContactCorsHeaders(req, env) : null;
    const respond = (response: Response): Response => withContactCors(response, corsHeaders);

    if (req.method === 'OPTIONS' && CONTACT_BROWSER_API_PATHS.has(path)) {
      if (!isValidPreviewContactPreflight(req, env)) {
        return json({ error: 'preflight not allowed' }, 403);
      }
      return respond(new Response(null, {
        status: 204,
        headers: {
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
          'referrer-policy': 'no-referrer',
        },
      }));
    }

    try {
      // productionはCor同一originのみ。Previewだけchecked-in exact originへCORSを返す。
      if (!isContactOriginAllowed(req, env)) {
        return json({ error: 'origin not allowed' }, 403);
      }

      if (req.method === 'POST' && (path === '/api/contact/chat' || path === '/api/contact/chat/start')) {
        const ip = clientIp(req);
        if (isRateLimited(`chat:${ip}`, CHAT_LIMIT)) {
          return respond(json({ error: 'リクエストが多すぎます。少し待ってから再試行してください' }, 429));
        }
        return respond(await handleChat(req, env, path === '/api/contact/chat/start'));
      }

      if (req.method === 'POST' && path === '/api/contact/submit') {
        const ip = clientIp(req);
        if (isRateLimited(`submit:${ip}`, SUBMIT_LIMIT)) {
          return respond(json({ error: 'リクエストが多すぎます。少し待ってから再試行してください' }, 429));
        }
        return respond(await handleSubmit(req, env));
      }

      return json({ error: 'Not Found' }, 404);
    } catch {
      // 詳細はサーバー側ログのみ。クライアントには汎用メッセージ（内部情報の漏洩防止）。
      logWorkerFailure('contact_chat_request_failed');
      return respond(json({ error: '処理中にエラーが発生しました' }, 500));
    }
  },

  async queue(batch: MessageBatch<NotificationMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const submissionId = typeof message.body?.submissionId === 'string'
        ? normalizeSessionId(message.body.submissionId)
        : null;
      if (!submissionId || !env.DB) {
        message.ack();
        continue;
      }
      const messageType: NotificationType = message.body?.messageType === 'receipt' ? 'receipt' : 'internal';
      try {
        if (!await claimOutbox(env, submissionId, messageType)) {
          message.ack();
          continue;
        }
        const stored = await getSubmissionForNotification(env, submissionId, messageType);
        if (!stored) {
          message.ack();
          continue;
        }
        const emailProvider = getEmailProvider(env);
        if (!emailProvider.ok) throw new Error('email provider unavailable');
        const sent = messageType === 'receipt'
          ? await sendReceiptEmail(env, emailProvider.provider, stored.inquiry, stored.receiptId)
          : await sendInquiryEmail(env, emailProvider.provider, stored.inquiry);
        await markOutboxSent(env, submissionId, messageType, sent.messageId, sent.deliveryStatus);
        message.ack();
      } catch (error) {
        await markOutboxFailed(
          env,
          submissionId,
          messageType,
          error instanceof Error ? error.message : 'notification failed',
        );
        // Queue controls exponential retry and eventually routes to the configured DLQ.
        message.retry();
      }
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    try {
      await purgeExpiredData(env);
    } catch {
      logWorkerFailure('contact_chat_retention_cleanup_failed');
    }
  },
};
