import type {
  ChatLocale,
  ChatMessage,
  ChatMode,
  ChatResult,
  Classification,
  ContactIntent,
  Env,
  InquiryInput,
  NotificationMessage,
  NotificationType,
  StructuredLead,
} from './types';
import {
  normalizeInquiry,
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
  isSameOrigin,
  verifyTurnstile,
} from './security';
import { buildSystemPrompt, getProvider } from './llm';
import { getEmailProvider, sendInquiryEmail, sendReceiptEmail } from './email';
import {
  claimOutbox,
  createSubmission,
  getSubmissionForNotification,
  markOutboxFailed,
  markOutboxSent,
  newSessionId,
  normalizeIdempotencyKey,
  normalizeSessionId,
  newReceiptId,
  purgeExpiredData,
  queueMessage,
  upsertContactSession,
} from './storage';

// 最大リクエストボディサイズ（DoS/暴走入力対策）。会話＋サマリでも十分な余裕。
const MAX_BODY_BYTES = 64 * 1024;

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      // 認証なしの公開エンドポイントだがキャッシュさせない（応答に分類等が含まれるため）。
      'cache-control': 'no-store',
    },
  });

// JSON ボディを上限つきで読む。Content-Type が JSON でない／不正JSON／過大は null。
async function readJsonBody(req: Request): Promise<Record<string, unknown> | null> {
  const ct = req.headers.get('content-type') || '';
  if (!/application\/json/i.test(ct)) return null;
  // Content-Length で早期に過大ボディを弾く（無い場合は読み取り後に長さ確認）。
  const len = Number(req.headers.get('content-length') || '0');
  if (len > MAX_BODY_BYTES) return null;
  let text: string;
  try {
    text = await req.text();
  } catch {
    return null;
  }
  // 読み取り後のサイズ確認はバイト数で行う（Content-Length はバイト、text.length は
  // UTF-16コード単位。CJKでは1文字3バイト等になり、文字数だと上限がザルになる）。
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return null;
  try {
    const data = JSON.parse(text);
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
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
    } catch (error) {
      console.error('contact-chat session storage error:', error instanceof Error ? error.message : 'unknown');
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
  } catch (e) {
    console.error('contact-chat llm error:', e instanceof Error ? e.message : String(e));
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
  } catch (error) {
    console.error('contact-chat session storage error:', error instanceof Error ? error.message : 'unknown');
    if (env.DB) return json({ error: 'チャットを保存できません。時間をおいて再試行してください' }, 503);
  }
  return json(result);
}

// POST /api/contact/submit — 最終送信。PIIはここで扱い、LLMには絶対渡さずメールにのみ送る。
async function handleSubmit(req: Request, env: Env): Promise<Response> {
  const body = await readJsonBody(req);
  if (!body) return json({ error: 'リクエストボディが不正なJSONです' }, 400);

  // Turnstile（シークレットがあれば検証）。
  const ip = clientIp(req);
  const ts = await verifyTurnstile(env, body.turnstileToken, ip);
  if (!ts.ok) return json({ error: ts.error }, ts.status);

  const norm = normalizeInquiry(body as InquiryInput);
  if (!norm.ok) {
    // ハニーポット命中時は bot に成功を装って 200（実際には送信しない）。
    if (norm.honeypot) return json({ ok: true });
    return json({ error: norm.error }, norm.status);
  }

  // fail closed: メール未設定なら 503（本物の問い合わせを握り潰さない）。
  const emailProvider = getEmailProvider(env);
  if (!emailProvider.ok) {
    console.error('contact-chat email not configured (RESEND_API_KEY unset)');
    return json({ error: emailProvider.error }, emailProvider.status);
  }

  // The server-side session summary is the email source of truth. Do not let a
  // stale or forged browser payload replace it; when the session is unavailable,
  // fall back to structured fields only. Structured lead fields are restored
  // from the same server-side session so the browser cannot replace them at
  // submit time (including discoverySource/contactReason).
  let inquiry = norm.inquiry;
  if (env.DB) {
    const sessionId = normalizeSessionId(body.sessionId);
    let trustedSummary = '';
    let trustedStructuredLead: StructuredLead | undefined;
    if (sessionId) {
      const session = await env.DB.prepare(
        'SELECT summary_text, structured_lead_json FROM contact_sessions WHERE session_id = ? AND status = \'active\' LIMIT 1',
      ).bind(sessionId).first<{ summary_text?: string; structured_lead_json?: string }>();
      trustedSummary = typeof session?.summary_text === 'string' ? session.summary_text.trim() : '';
      if (typeof session?.structured_lead_json === 'string') {
        try {
          trustedStructuredLead = normalizeStructuredLead(JSON.parse(session.structured_lead_json));
        } catch {
          trustedStructuredLead = {};
        }
      }
    }
    if (!trustedSummary) {
      trustedSummary = buildDeterministicSummary({
        classification: norm.inquiry.classification,
        intent: norm.inquiry.intent,
        structuredLead: norm.inquiry.structuredLead,
      });
    }
    inquiry = {
      ...norm.inquiry,
      summaryText: trustedSummary,
      conversationSummary: trustedSummary,
      ...(trustedStructuredLead ? { structuredLead: trustedStructuredLead } : {}),
    };
  }

  // 本番（D1 bindingあり）は、PIIを暗号化してD1へ保存し、QueueのID payload
  // だけを発行する。メール送信はqueue consumerだけが行う。
  if (env.DB) {
    const sessionId = normalizeSessionId(body.sessionId);
    const idempotencyKey = normalizeIdempotencyKey(body.idempotencyKey);
    let created;
    try {
      created = await createSubmission(env, inquiry, { idempotencyKey, sessionId });
    } catch (error) {
      console.error('contact-chat submission storage error:', error instanceof Error ? error.message : 'unknown');
      return json({ error: 'お問い合わせを受け付けられません。時間をおいて再試行してください' }, 503);
    }
    if (!env.CONTACT_NOTIFICATIONS) {
      console.error('contact-chat notification queue not configured');
      return json({ error: 'お問い合わせを受け付けられません。時間をおいて再試行してください' }, 503);
    }
    try {
      // 重複リクエストも同じIDを再送する。consumer側のclaimで送信済みを無害化する。
      // queue payload は submission ID と種別だけで、名前・メール・本文は含めない。
      await Promise.all([
        env.CONTACT_NOTIFICATIONS.send(queueMessage(created.submissionId, 'internal')),
        env.CONTACT_NOTIFICATIONS.send(queueMessage(created.submissionId, 'receipt')),
      ]);
    } catch (error) {
      console.error('contact-chat notification enqueue error:', error instanceof Error ? error.message : 'unknown');
      return json({ error: 'お問い合わせをキューへ登録できません。時間をおいて再試行してください' }, 503);
    }
    return json({ ok: true, receiptId: created.receiptId, status: 'queued', duplicate: created.duplicate });
  }

  try {
    await sendInquiryEmail(env, emailProvider.provider, inquiry);
    const receiptId = newReceiptId();
    await sendReceiptEmail(env, emailProvider.provider, inquiry, receiptId);
    return json({ ok: true, receiptId, status: 'sent' });
  } catch (e) {
    console.error('contact-chat email send error:', e instanceof Error ? e.message : String(e));
    return json({ error: 'お問い合わせの送信に失敗しました。時間をおいて再試行してください' }, 502);
  }

  return json({ ok: true });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    // 死活確認（認証不要・PIIなし）。
    if (req.method === 'GET' && path === '/api/contact/health') {
      return json({ ok: true });
    }

    try {
      // 同一オリジン強制（CORSは開けない。cor-jp.com 上のウィジェットのみ）。
      // POST など状態を変えるメソッドは Origin が無いと拒否する（#362）。
      if (!isSameOrigin(req)) {
        return json({ error: 'origin not allowed' }, 403);
      }

      if (req.method === 'POST' && (path === '/api/contact/chat' || path === '/api/contact/chat/start')) {
        const ip = clientIp(req);
        if (isRateLimited(`chat:${ip}`, CHAT_LIMIT)) {
          return json({ error: 'リクエストが多すぎます。少し待ってから再試行してください' }, 429);
        }
        return await handleChat(req, env, path === '/api/contact/chat/start');
      }

      if (req.method === 'POST' && path === '/api/contact/submit') {
        const ip = clientIp(req);
        if (isRateLimited(`submit:${ip}`, SUBMIT_LIMIT)) {
          return json({ error: 'リクエストが多すぎます。少し待ってから再試行してください' }, 429);
        }
        return await handleSubmit(req, env);
      }

      return json({ error: 'Not Found' }, 404);
    } catch (e: unknown) {
      // 詳細はサーバー側ログのみ。クライアントには汎用メッセージ（内部情報の漏洩防止）。
      console.error('contact-chat error:', e instanceof Error ? e.message : String(e));
      return json({ error: '処理中にエラーが発生しました' }, 500);
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
    } catch (error) {
      console.error('contact-chat retention cleanup error:', error instanceof Error ? error.message : 'unknown');
    }
  },
};
