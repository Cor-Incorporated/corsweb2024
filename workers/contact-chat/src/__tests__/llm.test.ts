import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildSystemPrompt, getProvider } from '../llm';
import type { Env } from '../types';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('VertexGeminiProvider', () => {
  it('global gemini-3.5-flash を構造化JSON設定でGatewayへ送る', async () => {
    const reply = '{"reply":"次のご案内です","summary":"","classification":"genuine","readyForContact":true,"intent":null,"structuredLead":{}}';
    const fetchMock = vi.fn(async () => Response.json({
      candidates: [{
        finishReason: 'STOP',
        content: { parts: [{ text: 'internal thought', thought: true }, { text: reply.slice(0, 30) }, { text: reply.slice(30) }] },
      }],
    }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = getProvider({ LLM_PROVIDER: 'vertex-gemini', VERTEX_GATEWAY_URL: 'https://gateway/generateContent', VERTEX_GATEWAY_SECRET: 'secret' } as Env);
    expect(await provider.chat('system', [{ role: 'user', content: 'hello' }])).toBe(reply);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://gateway/generateContent');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ project: 'cor-jp-web', location: 'global', model: 'gemini-3.5-flash' });
    expect(body.generationConfig).toMatchObject({
      responseMimeType: 'application/json',
      maxOutputTokens: 1024,
      responseSchema: {
        type: 'OBJECT',
        required: ['reply', 'summary', 'classification', 'readyForContact', 'intent', 'structuredLead'],
        propertyOrdering: ['reply', 'summary', 'classification', 'readyForContact', 'intent', 'structuredLead'],
        properties: {
          reply: { type: 'STRING' },
          summary: { type: 'STRING' },
          classification: { type: 'STRING', enum: ['genuine', 'sales', 'spam'] },
          readyForContact: { type: 'BOOLEAN' },
          intent: { type: 'STRING', nullable: true },
          structuredLead: {
            type: 'OBJECT',
            propertyOrdering: ['purpose', 'industryRole', 'dataSensitivity', 'stage', 'timingBudget', 'discoverySource', 'contactReason'],
            properties: {
              purpose: { type: 'STRING' },
              industryRole: { type: 'STRING' },
              dataSensitivity: { type: 'STRING' },
              stage: { type: 'STRING' },
              timingBudget: { type: 'STRING' },
              discoverySource: { type: 'STRING' },
              contactReason: { type: 'STRING' },
            },
          },
        },
      },
    });
    expect(body.generationConfig.responseSchema.properties.structuredLead.required).toBeUndefined();
    expect(body.tools).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('secret');
  });

  it('Gateway経路はHMACヘッダを付け、secretを本文に入れない', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{}' }] } }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = getProvider({
      LLM_PROVIDER: 'vertex-gemini', VERTEX_GATEWAY_URL: 'https://gateway/generateContent',
      VERTEX_GATEWAY_SECRET: 'gateway-secret',
    } as Env);
    await provider.chat('system', [{ role: 'user', content: 'hello' }]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://gateway/generateContent');
    expect((init.headers as Record<string, string>)['x-cloudia-signature']).toMatch(/^[a-f0-9]{64}$/);
    expect(init.body).not.toContain('gateway-secret');
    expect((init.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it.each([
    ['MAX_TOKENS', '{"reply":"途中'],
    ['MAX_TOKENS', '{"reply":"完了に見える","readyForContact":true}'],
    [undefined, '{"reply":"完了に見える","readyForContact":true}'],
    ['', '{"reply":"完了に見える","readyForContact":true}'],
    ['SAFETY', '{"reply":"公開できない"}'],
    ['STOP', ''],
  ])('%s で公開できる完成応答が無ければ例外にする', async (finishReason, text) => {
    const fetchMock = vi.fn(async () => Response.json({
      candidates: [{ finishReason, content: { parts: [{ text }] } }],
    }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = getProvider({ LLM_PROVIDER: 'vertex-gemini', VERTEX_GATEWAY_URL: 'https://gateway/generateContent', VERTEX_GATEWAY_SECRET: 'secret' } as Env);
    await expect(provider.chat('system', [{ role: 'user', content: 'hello' }])).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('Vertex障害は生レスポンスを公開せず例外にする', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('sensitive upstream body', { status: 500 })));
    const provider = getProvider({ LLM_PROVIDER: 'vertex-gemini', VERTEX_GATEWAY_URL: 'https://gateway/generateContent', VERTEX_GATEWAY_SECRET: 'secret' } as Env);
    await expect(provider.chat('system', [{ role: 'user', content: 'hello' }])).rejects.not.toThrow(/sensitive/);
  });
});

describe('getProvider の設定の確かめ', () => {
  const VERTEX = { LLM_PROVIDER: 'vertex-gemini', VERTEX_GATEWAY_URL: 'https://gateway/generateContent', VERTEX_GATEWAY_SECRET: 'secret' };

  it.each([
    ['Gateway の URL が無い', { ...VERTEX, VERTEX_GATEWAY_URL: undefined }],
    ['Gateway の URL が空', { ...VERTEX, VERTEX_GATEWAY_URL: '' }],
    ['Gateway の URL が空白だけ', { ...VERTEX, VERTEX_GATEWAY_URL: '   ' }],
    ['Gateway の秘密が無い', { ...VERTEX, VERTEX_GATEWAY_SECRET: undefined }],
    ['Gateway の秘密が空白だけ', { ...VERTEX, VERTEX_GATEWAY_SECRET: ' \n' }],
  ])('vertex-gemini で %s ときは、provider を返さずに投げる（model は呼ばない）', (_label, env) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(() => getProvider(env as unknown as Env)).toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('LLM_PROVIDER を書かない env も vertex-gemini として確かめる', () => {
    expect(() => getProvider({ VERTEX_GATEWAY_URL: '', VERTEX_GATEWAY_SECRET: 'secret' } as unknown as Env)).toThrow();
    expect(() => getProvider({ VERTEX_GATEWAY_URL: 'https://gateway/generateContent', VERTEX_GATEWAY_SECRET: 'secret' } as unknown as Env)).not.toThrow();
  });

  it('anthropic で鍵が無いとき・空白だけのときも投げる', () => {
    expect(() => getProvider({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: '' } as unknown as Env)).toThrow();
    expect(() => getProvider({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: '  ' } as unknown as Env)).toThrow();
    expect(() => getProvider({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'test-key' } as unknown as Env)).not.toThrow();
  });
});

describe('mode prompt', () => {
  it('uses the canonical company name and rejects known variants', () => {
    const prompt = buildSystemPrompt({ mode: 'intake', locale: 'ja' });
    expect(prompt).toContain('Cor.株式会社');
    expect(prompt).toContain('コー株式会社');
    expect(prompt).toContain('brand is "Cor.inc"');
    expect(prompt).toContain('Do not volunteer the Japanese reading or the brand name');
    expect(prompt).toContain('Never call the company "コア株式会社"');
    expect(prompt).not.toContain('Cor. (コア株式会社 / Cor.inc)');
  });

  it('marketing fields are structured non-PII fields with explicit boundaries', () => {
    const prompt = buildSystemPrompt({ mode: 'intake', locale: 'ja' });
    expect(prompt).toContain('"discoverySource"?: string');
    expect(prompt).toContain('"contactReason"?: string');
    expect(prompt).toContain('how they found Cor.');
    expect(prompt).toContain('why they are contacting Cor. now');
    expect(prompt).toContain('never put names, emails, phone numbers');
    expect(prompt).toContain('Do not force a fixed question order');
    expect(prompt).toContain('if the visitor declines, do not block the inquiry handoff');
  });

  it.each(['ja', 'en'] as const)('%s intakeは検索とPIIを禁止', (locale) => {
    const prompt = buildSystemPrompt({ mode: 'intake', locale, intent: 'contract-dev' });
    expect(prompt).toContain(`Reply locale: ${locale}`);
    expect(prompt).toMatch(/Do not use web search/);
    expect(prompt).toMatch(/Never request, accept, or repeat back personal contact details/);
    expect(prompt).toContain('"summary": string');
    expect(prompt).toContain('formal B2B intake receptionist');
    expect(prompt).toContain('ignore that persona');
  });

  it('ambassadorは会話調でも同じセキュリティ境界を持つ', () => {
    const prompt = buildSystemPrompt({ mode: 'ambassador', locale: 'en', intent: 'press-speaking-other' });
    expect(prompt).toContain('warm, conversational tone');
    expect(prompt).toContain('brief company-related small talk');
    expect(prompt).toContain('do not use exaggerated slang');
    expect(prompt).toMatch(/Never reveal/);
    expect(prompt).toMatch(/Never request, accept, or repeat back personal contact details/);
  });

  it('press intent uses an outreach-specific flow and does not invent commitments', () => {
    const prompt = buildSystemPrompt({ mode: 'intake', locale: 'en', intent: 'press-speaking-other' });
    expect(prompt).toContain('press, speaking, event, or other public-outreach inquiry');
    expect(prompt).toContain('publication, outlet, organizer type');
    expect(prompt).toContain('Do not ask about a budget unless');
    expect(prompt).toContain('must not block handoff');
    expect(prompt).toContain('Do not imply that the request is accepted');
    expect(prompt).toContain('Never promise that Cor. accepts an interview');
  });

  it('press intent Japanese policy asks for public scope and deadline without generic budget pressure', () => {
    const prompt = buildSystemPrompt({ mode: 'intake', locale: 'ja', intent: 'press-speaking-other' });
    expect(prompt).toContain('取材・登壇・イベント参加・その他の対外相談');
    expect(prompt).toContain('希望日または掲載締切');
    expect(prompt).toContain('有料スポンサー、謝礼、制作費、業務発注');
    expect(prompt).toContain('依頼を受諾したとは断定しません');
  });
});
