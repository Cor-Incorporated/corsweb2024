import { afterEach, describe, it, expect, vi } from 'vitest';
import worker, { extractJsonObject, normalizeCompanyNameReply, parseChatResult } from '../index';
import { resetRateLimits, TURNSTILE_EXPECTED_ACTION } from '../security';
import type { Env } from '../types';
import { decryptText, encryptText } from '../storage';
import { PRESS_FIXTURES, PRESS_INTENT } from './press-fixtures';

afterEach(() => {
  resetRateLimits();
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// parseChatResult — 反証可能テスト。
// 旧実装（フェンス正規表現のみ → 失敗時に raw blob を reply にする）に対して
// 「unfenced prose-wrapped JSON」「reply に ``` を含む」ケースは FAIL するはず。
// それを assert することで、新しい balanced-brace 抽出が効いていることを保証する。
// ─────────────────────────────────────────────────────────────────────────────
describe('extractJsonObject — 文字列リテラルを尊重した {} 抽出', () => {
  it('純粋なオブジェクトを抽出', () => {
    expect(extractJsonObject('{"a":1}')).toBe('{"a":1}');
  });
  it('散文に包まれても最初のトップレベルオブジェクトを抽出', () => {
    expect(extractJsonObject('Sure!\n{"a":1}\nthanks')).toBe('{"a":1}');
  });
  it('文字列リテラル内の } に惑わされない', () => {
    expect(extractJsonObject('{"reply":"a } b","x":1}')).toBe('{"reply":"a } b","x":1}');
  });
  it('エスケープされた引用符を正しく扱う', () => {
    expect(extractJsonObject('{"reply":"say \\"hi\\"","x":1}')).toBe(
      '{"reply":"say \\"hi\\"","x":1}',
    );
  });
  it('{ が無ければ null', () => {
    expect(extractJsonObject('no json here')).toBeNull();
  });
});

describe('parseChatResult', () => {
  it('クリーンなJSONをパースする', () => {
    const r = parseChatResult('{"reply":"こんにちは","classification":"genuine","readyForContact":false}');
    expect(r.reply).toBe('こんにちは');
    expect(r.classification).toBe('genuine');
    expect(r.readyForContact).toBe(false);
  });

  it('```json フェンスをパースする', () => {
    const r = parseChatResult('```json\n{"reply":"hi","classification":"sales","readyForContact":true}\n```');
    expect(r.reply).toBe('hi');
    expect(r.classification).toBe('sales');
    expect(r.readyForContact).toBe(true);
  });

  it('言語指定なしの ``` フェンスをパースする', () => {
    const r = parseChatResult('```\n{"reply":"hey","classification":"genuine","readyForContact":false}\n```');
    expect(r.reply).toBe('hey');
  });

  // ▼ 反証コア①: 散文に包まれた JSON。旧実装は parse 失敗で raw 全体を reply にするため
  //   reply に '{' が混入する。新実装は extractJsonObject で JSON を取り出すので混入しない。
  it('散文に包まれたJSON: reply に { を含まない（旧regex実装ではFAIL）', () => {
    const r = parseChatResult('Sure!\n{"reply":"承知しました","classification":"genuine","readyForContact":true}');
    expect(r.reply).toBe('承知しました');
    expect(r.reply).not.toContain('{');
    expect(r.readyForContact).toBe(true);
  });

  // ▼ 反証コア②: reply 値そのものに ``` を含む。旧フェンス正規表現は ``` を境界と誤認し
  //   JSON.parse が壊れ、raw blob を返す。新実装は構造化された reply を取り出す。
  it('reply 値に ``` を含む: 構造化 reply を取り出す（生 blob を返さない）（旧regex実装ではFAIL）', () => {
    const raw = '{"reply":"コードは ```js x``` です","classification":"genuine","readyForContact":false}';
    const r = parseChatResult(raw);
    expect(r.reply).toBe('コードは ```js x``` です');
    // 生の JSON blob（"classification" キー文字列）が reply に漏れていないこと
    expect(r.reply).not.toContain('"classification"');
  });

  it('プレーンな散文（JSONなし）は生出力を漏らさない', () => {
    const r = parseChatResult('ただのテキストです');
    expect(r.reply).toContain('もう一度');
    expect(r.classification).toBe('genuine');
    expect(r.readyForContact).toBe(false);
  });

  it('壊れたJSONは安全な定型文へフォールバック', () => {
    const r = parseChatResult('{"reply":"x", broken');
    expect(r.reply).toContain('もう一度');
    expect(r.classification).toBe('genuine');
  });

  it.each([
    ['null', 'null'],
    ['配列', '[1,2,3]'],
    ['数値', '42'],
  ])('object でない JSON(%s)はフォールバック扱い', (_n, raw) => {
    const r = parseChatResult(raw);
    expect(r.reply).toContain('もう一度');
    expect(r.classification).toBe('genuine');
  });

  it('空白のみ → 日本語フォールバック文言', () => {
    const r = parseChatResult('   ');
    expect(r.reply).toContain('もう一度');
  });

  it('英語localeの不正応答は英語定型文', () => {
    expect(parseChatResult('not json', '', 'en').reply).toContain('Sorry');
  });

  it('無効な classification は genuine に正規化', () => {
    const r = parseChatResult('{"reply":"x","classification":"evil","readyForContact":false}');
    expect(r.classification).toBe('genuine');
  });

  it('非PII summaryを返し、生トランスクリプトやPII summaryはfallbackに落とす', () => {
    const ok = parseChatResult('{"reply":"確認しました","summary":"目的と時期を確認済み","readyForContact":true}');
    expect(ok.summary).toBe('目的と時期を確認済み');
    const transcript = parseChatResult('{"reply":"確認しました","summary":"User: 090-1234-5678\\n続き","readyForContact":true}');
    expect(transcript.summary).not.toContain('090-1234-5678');
    const pii = parseChatResult('{"reply":"確認しました","summary":"user@example.comへ連絡","readyForContact":true}');
    expect(pii.summary).not.toContain('user@example.com');
  });

  it('空または1500文字超のsummaryは固定fallbackへ落とす', () => {
    const empty = parseChatResult('{"reply":"確認しました","summary":"   ","readyForContact":true}');
    expect(empty.summary).toContain('分類: genuine');
    const oversized = parseChatResult(JSON.stringify({
      reply: '確認しました',
      summary: 'a'.repeat(1501),
      readyForContact: true,
    }));
    expect(oversized.summary).toContain('分類: genuine');
    expect(oversized.summary.length).toBeLessThanOrEqual(1500);
  });

  it('structuredLeadにPIIが混入してもsummaryへ再出力しない', () => {
    const result = parseChatResult(JSON.stringify({
      reply: '確認しました',
      structuredLead: { purpose: 'user@example.comへ連絡' },
      readyForContact: false,
    }));
    expect(result.summary).not.toContain('user@example.com');
  });

  it('dash区切りのロール転記とAPIキー形式もsummaryへ採用しない', () => {
    const transcript = parseChatResult('{"reply":"確認しました","summary":"User - 目的を確認\nAssistant - 次の質問","readyForContact":true}');
    expect(transcript.summary).not.toContain('User -');
    const secret = parseChatResult('{"reply":"確認しました","summary":"AIzaSyA123456789012345678901234567890","readyForContact":true}');
    expect(secret.summary).not.toContain('AIzaSyA');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ハンドラレベル（worker.fetch）
// ─────────────────────────────────────────────────────────────────────────────
const ENV = {
  LLM_PROVIDER: 'anthropic',
  ANTHROPIC_API_KEY: '',
  RESEND_API_KEY: '',
  TURNSTILE_SECRET: '',
  CONTACT_SITE_ENV: 'production',
  CONTACT_TO_EMAIL: 'info@cor-jp.com',
  CONTACT_FROM_EMAIL: 'noreply@cor-jp.com',
} as unknown as Env;

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://cor-jp.com' + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

describe('worker.fetch — ハンドラレベル', () => {
  it('press chat returns the non-PII summary and ready stage contract', async () => {
    const fixture = PRESS_FIXTURES.find((candidate) => candidate.name === 'ja speaking ready');
    if (!fixture) throw new Error('press speaking fixture missing');
    const gatewayFetch = vi.fn(async () => new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: fixture.raw }] } }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', gatewayFetch);
    const env = {
      ...ENV,
      LLM_PROVIDER: 'vertex-gemini',
      VERTEX_GATEWAY_URL: 'https://gateway.example/generateContent',
      VERTEX_GATEWAY_SECRET: 'secret',
    } as Env;

    const res = await worker.fetch(post('/api/contact/chat', {
      mode: 'intake',
      locale: fixture.locale,
      intent: PRESS_INTENT,
      messages: [{ role: 'user', content: '登壇依頼の内容を整理しました。' }],
    }), env);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.intent).toBe(PRESS_INTENT);
    expect(body.readyForContact).toBe(true);
    expect(body.stage).toBe('ready');
    expect(body.summary).toContain('生成AI');
    expect(body.missingFields).toEqual([]);
    expect(gatewayFetch).toHaveBeenCalledTimes(1);
  });

  it('all structured intake fields trigger the contact step even if the model under-reports readiness', async () => {
    const gatewayFetch = vi.fn(async () => new Response(JSON.stringify({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              reply: '内容を確認しました。連絡先入力へ進めます。',
              summary: '社内向けAI基盤のPoCについて、目的・体制・機密性・時期を確認済み',
              classification: 'genuine',
              readyForContact: false,
              intent: 'local-llm-poc',
              structuredLead: {
                purpose: '社内向けAI基盤のPoC',
                industryRole: '広告会社の企画担当',
                dataSensitivity: '機密',
                stage: 'exploring',
                timingBudget: '3か月以内',
              },
            }),
          }],
        },
      }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', gatewayFetch);
    const env = {
      ...ENV,
      LLM_PROVIDER: 'vertex-gemini',
      VERTEX_GATEWAY_URL: 'https://gateway.example/generateContent',
      VERTEX_GATEWAY_SECRET: 'secret',
    } as Env;
    const res = await worker.fetch(post('/api/contact/chat', {
      mode: 'intake',
      locale: 'ja',
      intent: 'local-llm-poc',
      messages: [{ role: 'user', content: '必要な情報はまとめてお伝えします。' }],
    }), env);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.readyForContact).toBe(true);
    expect(body.stage).toBe('ready');
    expect(body.missingFields).toEqual([]);
  });

  it('VertexリクエストへPIIをそのまま渡さない', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: '{"reply":"ok","readyForContact":false}' }] } }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const env = {
      ...ENV,
      LLM_PROVIDER: 'vertex-gemini',
      VERTEX_GATEWAY_URL: 'https://gateway.example/generateContent',
      VERTEX_GATEWAY_SECRET: 'secret',
    } as Env;
    const res = await worker.fetch(post('/api/contact/chat', {
      messages: [{ role: 'user', content: '連絡先 user@example.com / 090-1234-5678 / OTP 123456' }],
    }), env);
    expect(res.status).toBe(200);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const body = String(init?.body || '');
    expect(body).not.toContain('user@example.com');
    expect(body).not.toContain('090-1234-5678');
    expect(body).not.toContain('123456');
    expect(body).toContain('[redacted-email]');
  });

  it('health は 200', async () => {
    const res = await worker.fetch(
      new Request('https://cor-jp.com/api/contact/health'),
      ENV,
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it('handoff有効時のhealthはcorsweb candidateと実Worker versionをbody/headerで一致させる', async () => {
    const env = {
      ...ENV,
      GRIFT_HANDOFF_ENABLED: 'true',
      CLOUDIA_CANDIDATE_SHA: '1e76662e149d448babe59c4353317bf3dbdf8e13',
      CLOUDIA_RELEASE_ID: 'cloudia-uat-20260714-r1',
      CF_VERSION_METADATA: {
        id: '72d7c891-dde3-4df6-9f40-d7f7ed950a77',
        timestamp: '2026-07-14T10:59:43.055Z',
      },
    } as Env;
    const res = await worker.fetch(new Request('https://cor-jp.com/api/contact/health'), env);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([
      'candidate_sha', 'generated_at', 'release_id', 'revision', 'service', 'status',
    ]);
    expect(body).toMatchObject({
      status: 'ok',
      service: 'contact-chat',
      candidate_sha: env.CLOUDIA_CANDIDATE_SHA,
      revision: env.CF_VERSION_METADATA?.id,
      release_id: env.CLOUDIA_RELEASE_ID,
      generated_at: env.CF_VERSION_METADATA?.timestamp,
    });
    expect(res.headers.get('x-cloudia-grift-candidate-sha')).toBe(body.candidate_sha);
    expect(res.headers.get('x-cloudia-grift-revision')).toBe(body.revision);
    expect(res.headers.get('x-cloudia-grift-generated-at')).toBe(body.generated_at);
    expect(res.headers.get('x-cloudia-grift-release-id')).toBe(body.release_id);
  });

  it.each([
    ['candidate SHA', { CLOUDIA_CANDIDATE_SHA: 'short' }],
    ['release ID', { CLOUDIA_RELEASE_ID: 'contains whitespace' }],
    ['version metadata', { CF_VERSION_METADATA: { id: 'not-a-version', timestamp: 'invalid' } }],
  ])('handoff有効時のhealthは不正な%sで503 fail-closed', async (_label, override) => {
    const env = {
      ...ENV,
      GRIFT_HANDOFF_ENABLED: 'true',
      CLOUDIA_CANDIDATE_SHA: '1e76662e149d448babe59c4353317bf3dbdf8e13',
      CLOUDIA_RELEASE_ID: 'cloudia-uat-20260714-r1',
      CF_VERSION_METADATA: {
        id: '72d7c891-dde3-4df6-9f40-d7f7ed950a77',
        timestamp: '2026-07-14T10:59:43.055Z',
      },
      ...override,
    } as Env;
    const res = await worker.fetch(new Request('https://cor-jp.com/api/contact/health'), env);
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: 'release metadata unavailable' });
    expect(res.headers.get('x-cloudia-grift-candidate-sha')).toBeNull();
  });

  it('JSON でない content-type は 400', async () => {
    const req = new Request('https://cor-jp.com/api/contact/chat', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'hello',
    });
    const res = await worker.fetch(req, ENV);
    expect(res.status).toBe(400);
  });

  it('過大ボディは 400（バイト基準）', async () => {
    // 64KB 超のJSON文字列（CJKでなくても確実に超えるサイズ）
    const big = JSON.stringify({ messages: [{ role: 'user', content: 'x'.repeat(70000) }] });
    const res = await worker.fetch(post('/api/contact/chat', big), ENV);
    expect(res.status).toBe(400);
  });

  it('クロスオリジンの Origin は 403', async () => {
    // undici/vitest 環境は Request 構築時に Origin を禁止ヘッダとして落とすため、
    // ヘッダを確実に持たせる最小モックで渡す（yomimono の Cookie モックと同方針）。
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      origin: 'https://evil.example',
    };
    const req = {
      method: 'POST',
      url: 'https://cor-jp.com/api/contact/chat',
      headers: { get: (n: string) => headers[n.toLowerCase()] ?? null },
      text: async () => JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    } as unknown as Request;
    const res = await worker.fetch(req, ENV);
    expect(res.status).toBe(403);
  });

  it('未知メソッド/パスは 404', async () => {
    const res = await worker.fetch(
      new Request('https://cor-jp.com/api/contact/unknown', { method: 'GET' }),
      ENV,
    );
    expect(res.status).toBe(404);
  });

  it('chat レート制限超過で 429', async () => {
    const ip = '203.0.113.7';
    const mk = () =>
      post('/api/contact/chat', { messages: [{ role: 'user', content: 'hi' }] }, {
        'cf-connecting-ip': ip,
      });
    // ANTHROPIC_API_KEY 未設定なので各回 503 になるが、レート制限はその手前で評価される。
    // 上限(20)+1 回叩いて最後が 429 になることを確認。
    let last = 200;
    for (let i = 0; i < 21; i++) {
      const res = await worker.fetch(mk(), ENV);
      last = res.status;
    }
    expect(last).toBe(429);
  });

  it('LLM 未設定（ANTHROPIC_API_KEY 空）は 503 fail closed', async () => {
    const res = await worker.fetch(
      post('/api/contact/chat', { messages: [{ role: 'user', content: 'hi' }] }, {
        'cf-connecting-ip': '198.51.100.9',
      }),
      ENV,
    );
    expect(res.status).toBe(503);
  });

  it.each([
    [{ mode: 'admin' }, 'mode'],
    [{ locale: 'fr' }, 'locale'],
  ])('不正な会話コンテキスを400で拒否: %s', async (extra, field) => {
    const res = await worker.fetch(post('/api/contact/chat', {
      messages: [{ role: 'user', content: 'hello' }], ...extra,
    }), ENV);
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toContain(field);
  });

  it('chat: TURNSTILE_SECRET 設定済みでもトークン無しで 403 にならない（Turnstileは/chatでは検証しない）', async () => {
    // Turnstile トークンは単回使用のため /chat では検証しない（複数ターン会話が壊れるのを防ぐ）。
    // TURNSTILE_SECRET を設定しても、トークン無しの /chat が 403 にならないことを保証する。
    // siteverify が呼ばれていないことも確認する（fetch をスパイ）。
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const envWithTurnstile = {
      ...ENV,
      TURNSTILE_REQUIRED: 'true',
      TURNSTILE_SECRET: 'secret',
      TURNSTILE_ALLOWED_HOSTNAMES: 'cor-jp.com',
    } as unknown as Env;
    const res = await worker.fetch(
      post('/api/contact/chat', { messages: [{ role: 'user', content: 'hi' }] }, {
        'cf-connecting-ip': '198.51.100.20',
      }),
      envWithTurnstile,
    );
    // ANTHROPIC_API_KEY 未設定なので 503（fail closed）になるが、重要なのは 403 でないこと。
    expect(res.status).not.toBe(403);
    expect(res.status).toBe(503);
    // siteverify(Turnstile) が呼ばれていないこと（/chat では検証しない）。
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('submit: required-on で secret 欠落は 503、email/Griftへ進まない', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const env = {
      ...ENV,
      RESEND_API_KEY: 're_test',
      TURNSTILE_REQUIRED: 'true',
      TURNSTILE_SECRET: '',
      TURNSTILE_ALLOWED_HOSTNAMES: 'cor-jp.com',
    } as unknown as Env;
    const res = await worker.fetch(post('/api/contact/submit', {
      name: '太郎',
      email: 'taro@example.com',
      message: '相談です',
      turnstileToken: 'token',
    }, { 'cf-connecting-ip': '198.51.100.31' }), env);
    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).toContain('Turnstile');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('submit: required-on で token 欠落は 400、Siteverify/email/Griftへ進まない', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const env = {
      ...ENV,
      RESEND_API_KEY: 're_test',
      TURNSTILE_REQUIRED: 'true',
      TURNSTILE_SECRET: 'secret',
      TURNSTILE_ALLOWED_HOSTNAMES: 'cor-jp.com',
    } as unknown as Env;
    const res = await worker.fetch(post('/api/contact/submit', {
      name: '太郎',
      email: 'taro@example.com',
      message: '相談です',
    }, { 'cf-connecting-ip': '198.51.100.32' }), env);
    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('submit: Cloudiaの旧action turnstile-spin-v1は受け入れない', async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      challenge_ts: new Date().toISOString(),
      hostname: 'cor-jp.com',
      'error-codes': [],
      action: 'turnstile-spin-v1',
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    const env = {
      ...ENV,
      RESEND_API_KEY: 're_test',
      TURNSTILE_REQUIRED: 'true',
      TURNSTILE_SECRET: 'secret',
      TURNSTILE_ALLOWED_HOSTNAMES: 'cor-jp.com',
    } as unknown as Env;
    const res = await worker.fetch(post('/api/contact/submit', {
      name: '太郎',
      email: 'taro@example.com',
      message: '相談です',
      turnstileToken: 'old-action-token',
    }, { 'cf-connecting-ip': '198.51.100.33' }), env);
    expect(res.status).toBe(403);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('submit: Turnstile拒否時はD1・Queue・メール・Griftを一切実行しない', async () => {
    const db = new Proxy({}, {
      get() {
        throw new Error('D1 must not be accessed before Turnstile succeeds');
      },
    });
    const queueSend = vi.fn(async () => {
      throw new Error('Queue must not be accessed before Turnstile succeeds');
    });
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();
      if (url !== 'https://challenges.cloudflare.com/turnstile/v0/siteverify') {
        throw new Error('email/Grift must not be accessed before Turnstile succeeds');
      }
      return new Response(JSON.stringify({
        success: true,
        challenge_ts: new Date().toISOString(),
        hostname: 'cor-jp.com',
        'error-codes': [],
        action: 'wrong-action',
      }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchSpy);
    const env = {
      ...ENV,
      DB: db,
      CONTACT_NOTIFICATIONS: { send: queueSend },
      RESEND_API_KEY: 're_test',
      TURNSTILE_REQUIRED: 'true',
      TURNSTILE_SECRET: 'server-secret',
      TURNSTILE_ALLOWED_HOSTNAMES: 'cor-jp.com',
      GRIFT_HANDOFF_ENABLED: 'true',
      GRIFT_API_ORIGIN: 'https://grift.example.test',
      CLOUDIA_HANDOFF_AUTH_TOKEN: 'handoff-secret',
    } as unknown as Env;

    const res = await worker.fetch(post('/api/contact/submit', {
      name: '太郎',
      email: 'taro@example.com',
      message: '相談です',
      turnstileToken: 'token',
    }, { 'cf-connecting-ip': '198.51.100.35' }), env);

    expect(res.status).toBe(403);
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(queueSend).not.toHaveBeenCalled();
  });

  it('submit: 同じtokenの重複送信はtimeout-or-duplicateで再メールしない', async () => {
    let siteverifyCalls = 0;
    let resendCalls = 0;
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();
      if (url.includes('/turnstile/v0/siteverify')) {
        siteverifyCalls += 1;
        return new Response(JSON.stringify(siteverifyCalls === 1 ? {
          success: true,
          challenge_ts: new Date().toISOString(),
          hostname: 'cor-jp.com',
          'error-codes': [],
          action: TURNSTILE_EXPECTED_ACTION,
        } : {
          success: false,
          'error-codes': ['timeout-or-duplicate'],
        }), { status: 200 });
      }
      if (url === 'https://api.resend.com/emails') {
        resendCalls += 1;
        return new Response(JSON.stringify({ id: `re_${resendCalls}` }), { status: 200 });
      }
      throw new Error('unexpected fetch target');
    });
    vi.stubGlobal('fetch', fetchSpy);
    const env = {
      ...ENV,
      RESEND_API_KEY: 're_test',
      TURNSTILE_REQUIRED: 'true',
      TURNSTILE_SECRET: 'secret',
      TURNSTILE_ALLOWED_HOSTNAMES: 'cor-jp.com',
    } as unknown as Env;
    const payload = {
      idempotencyKey: 'duplicate-turnstile-submit',
      name: '太郎',
      email: 'taro@example.com',
      message: '相談です',
      turnstileToken: 'single-use-token',
    };

    const first = await worker.fetch(post('/api/contact/submit', payload, {
      'cf-connecting-ip': '198.51.100.34',
    }), env);
    const duplicate = await worker.fetch(post('/api/contact/submit', payload, {
      'cf-connecting-ip': '198.51.100.34',
    }), env);

    expect(first.status).toBe(200);
    expect(duplicate.status).toBe(400);
    expect(siteverifyCalls).toBe(2);
    expect(resendCalls).toBe(2);
    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });

  it('submit: RESEND_API_KEY 未設定は 503 fail closed', async () => {
    const res = await worker.fetch(
      post(
        '/api/contact/submit',
        { name: '太郎', email: 'taro@example.com', message: '相談です' },
        { 'cf-connecting-ip': '198.51.100.10' },
      ),
      ENV,
    );
    expect(res.status).toBe(503);
  });

  it('submit: ハニーポット命中はサイレント 200（送信せず）', async () => {
    const res = await worker.fetch(
      post(
        '/api/contact/submit',
        {
          name: '太郎',
          email: 'taro@example.com',
          message: '相談です',
          website: 'http://spam.example',
        },
        { 'cf-connecting-ip': '198.51.100.11' },
      ),
      ENV,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok?: boolean };
    expect(body.ok).toBe(true);
  });

  it('submit: D1なしの互換経路でも社内通知と本人確認を別送する', async () => {
    const responses = [
      JSON.stringify({ id: 're_internal_1' }),
      JSON.stringify({ id: 're_receipt_1' }),
    ];
    const fetchMock = vi.fn(async () => new Response(responses.shift() || '{"id":"re_fallback"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const env = {
      ...ENV,
      RESEND_API_KEY: 're_test',
      CONTACT_CC_EMAILS: 'company@cor-jp.com,k.isayama@cor-jp.com,nagisa.terada@cor-jp.com',
    } as unknown as Env;
    const res = await worker.fetch(
      post('/api/contact/submit', {
        name: '太郎',
        email: 'taro@example.com',
        message: '相談です',
        conversationSummary: '要約',
      }, { 'cf-connecting-ip': '198.51.100.12' }),
      env,
    );
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstCall = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const secondCall = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    const first = JSON.parse(firstCall[1].body as string);
    const second = JSON.parse(secondCall[1].body as string);
    expect(first.to).toBe('info@cor-jp.com');
    expect(first.cc).toEqual(['company@cor-jp.com', 'k.isayama@cor-jp.com', 'nagisa.terada@cor-jp.com']);
    expect(second.to).toBe('taro@example.com');
    expect(second.cc).toBeUndefined();
    expect(second.reply_to).toBeUndefined();
    expect(second.text).toContain('要約');
    expect(second.text).toContain('相談です');
    expect((await res.json() as { receiptId?: string }).receiptId).toMatch(/^COR-/);
  });

  it('submit: 同意なしでもD1 sessionの要約・routing・structuredLeadを正本にする', async () => {
    const calls: Array<{ sql: string; bindings: unknown[] }> = [];
    const trustedLead = {
      purpose: '社内AI基盤のPoC',
      discoverySource: '検索',
      contactReason: '導入相談',
    };
    const encryptedEmptyExcerpt = await encryptText('storage-secret', '');
    const db = {
      prepare(sql: string) {
        return {
          bind(...bindings: unknown[]) {
            calls.push({ sql, bindings });
            return {
              first: async <T>() => {
                if (sql.includes('FROM contact_sessions') && sql.includes("status = 'active'")) {
                  return {
                    session_id: 'session-1',
                    intent: 'contract-dev',
                    mode: 'intake',
                    locale: 'ja',
                    source: 'cloudia',
                    stage: 'ready',
                    turn_count: 2,
                    classification: 'genuine',
                    summary_text: 'server summary',
                    structured_lead_json: JSON.stringify(trustedLead),
                    missing_fields_json: '[]',
                    conversation_excerpt_ciphertext: encryptedEmptyExcerpt,
                    updated_at: 1_700_000_000,
                    expires_at: 4_000_000_000,
                  } as T;
                }
                if (sql.includes('SELECT session_id, conversation_excerpt_ciphertext')) {
                  return { session_id: 'session-1', conversation_excerpt_ciphertext: encryptedEmptyExcerpt } as T;
                }
                return null as T;
              },
              run: async () => ({ meta: { changes: 1 } }),
            };
          },
        };
      },
      batch: async (statements: D1PreparedStatement[]) => statements.map(() => ({ meta: { changes: 1 } })),
    };
    const queueSend = vi.fn(async () => undefined);
    const env = {
      ...ENV,
      RESEND_API_KEY: 're_test',
      PII_ENCRYPTION_KEY: 'storage-secret',
      PII_HMAC_KEY: 'hmac-secret',
      DB: db,
      CONTACT_NOTIFICATIONS: { send: queueSend },
    } as unknown as Env;
    const res = await worker.fetch(post('/api/contact/submit', {
      sessionId: 'session-1',
      idempotencyKey: 'idempotency-session-lead',
      name: '太郎',
      email: 'taro@example.com',
      message: '相談です',
      intent: 'press-speaking-other',
      source: 'browser-forged-source',
      summaryText: 'browser confirmed summary',
      structuredLead: { discoverySource: 'browser', contactReason: 'forged' },
    }, { 'cf-connecting-ip': '198.51.100.21' }), env);
    expect(res.status).toBe(200);
    const insert = calls.find((call) => call.sql.includes('INSERT INTO submission_intake'));
    expect(insert).toBeDefined();
    expect(JSON.parse(String(insert?.bindings[14]))).toEqual(trustedLead);
    expect(insert?.bindings[12]).toBe('contract-dev');
    expect(insert?.bindings[13]).toBe('cloudia');
    expect(insert?.bindings[16]).toBe('genuine');
    await expect(decryptText('storage-secret', String(insert?.bindings[9])))
      .resolves.toBe('server summary');
    expect(queueSend).toHaveBeenCalledTimes(2);
  });
});

describe('parseChatResult — intent / structuredLead (#250)', () => {
  it('LLM の intent と structuredLead を取り出す', () => {
    const raw = JSON.stringify({
      reply: '承知しました',
      classification: 'genuine',
      readyForContact: true,
      intent: 'contract-dev',
      structuredLead: {
        purpose: '受託開発',
        stage: 'exploring',
        discoverySource: '検索',
        contactReason: '業務改善の相談',
      },
    });
    const r = parseChatResult(raw);
    expect(r.intent).toBe('contract-dev');
    expect(r.structuredLead?.purpose).toBe('受託開発');
    expect(r.structuredLead?.stage).toBe('exploring');
    expect(r.structuredLead?.discoverySource).toBe('検索');
    expect(r.structuredLead?.contactReason).toBe('業務改善の相談');
  });
  it('未知 intent は落とす（fallback を維持）', () => {
    const raw = '{"reply":"x","classification":"genuine","readyForContact":false,"intent":"evil"}';
    const r = parseChatResult(raw, 'local-llm-poc');
    expect(r.intent).toBe('local-llm-poc');
  });

  it('明示済み intent はモデル出力で上書きしない', () => {
    const raw = JSON.stringify({
      reply: '承知しました',
      classification: 'genuine',
      readyForContact: false,
      intent: 'contract-dev',
    });
    const result = parseChatResult(raw, 'grift-paid-trial');
    expect(result.intent).toBe('grift-paid-trial');
  });
  it('intent なし JSON では fallback を使う', () => {
    const raw = '{"reply":"x","classification":"genuine","readyForContact":false}';
    const r = parseChatResult(raw, 'grift-team-beta');
    expect(r.intent).toBe('grift-team-beta');
  });
});

describe('normalizeCompanyNameReply — 通常表示は短く、質問時だけ詳細', () => {
  it('通常の相談文に混ざった読み方・ブランド名の括弧を除去する', () => {
    const reply = 'Cor.株式会社（コー株式会社）の導入支援についてご案内します。';
    expect(normalizeCompanyNameReply(reply, [{ role: 'user', content: '導入方法を相談したいです' }]))
      .toBe('Cor.株式会社の導入支援についてご案内します。');
  });

  it('読み方を明示的に尋ねた場合は詳細を保持する', () => {
    const reply = 'Cor.株式会社（コー株式会社、ブランド名：Cor.inc）です。';
    expect(normalizeCompanyNameReply(reply, [{ role: 'user', content: '会社名の読み方とブランド名を教えてください。' }]))
      .toBe(reply);
  });
});
