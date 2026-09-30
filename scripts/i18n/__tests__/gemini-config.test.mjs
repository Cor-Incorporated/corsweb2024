// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL, readRuntimeConfig } from '../config.mjs';
import { createGeminiClient } from '../gemini.mjs';

/** @google/genai の代わりに、受け取ったリクエストを記録する偽 SDK（実 API は呼ばない）。 */
function fakeSdk(response) {
  const seen = { constructed: [], requests: [] };
  class GoogleGenAI {
    constructor(options) {
      seen.constructed.push(options);
      this.models = {
        generateContent: async (request) => {
          seen.requests.push(request);
          return response;
        },
      };
    }
  }
  return { seen, loadSdk: async () => ({ GoogleGenAI }) };
}

describe('createGeminiClient (request shape for @google/genai)', () => {
  it('sends systemInstruction, thinkingLevel and a JSON schema when requested', async () => {
    const { seen, loadSdk } = fakeSdk({
      text: '{"title":"T"}',
      candidates: [{ finishReason: 'STOP' }],
    });
    const client = await createGeminiClient({
      apiKey: 'k',
      model: 'gemini-x',
      thinkingLevel: 'LOW',
      timeoutMs: 1000,
      loadSdk,
    });
    const result = await client.generate({
      system: 'SYS',
      prompt: '{"title":"タ"}',
      jsonSchema: { type: 'object' },
    });
    expect(result).toEqual({ text: '{"title":"T"}', finishReason: 'STOP' });
    expect(seen.constructed[0]).toEqual({ apiKey: 'k', httpOptions: { timeout: 1000 } });
    expect(seen.requests[0]).toEqual({
      model: 'gemini-x',
      contents: '{"title":"タ"}',
      config: {
        systemInstruction: 'SYS',
        thinkingConfig: { thinkingLevel: 'LOW' },
        responseMimeType: 'application/json',
        responseJsonSchema: { type: 'object' },
      },
    });
  });

  it('omits thinkingConfig when disabled and tolerates an empty response', async () => {
    const { seen, loadSdk } = fakeSdk({ text: undefined, candidates: [] });
    const client = await createGeminiClient({
      apiKey: 'k',
      model: 'm',
      thinkingLevel: '',
      timeoutMs: 1000,
      loadSdk,
    });
    expect(await client.generate({ system: 's', prompt: 'p' })).toEqual({
      text: '',
      finishReason: undefined,
    });
    expect(seen.requests[0].config).toEqual({ systemInstruction: 's' });
  });

  it('refuses to start without an API key (before loading the SDK)', async () => {
    let loaded = false;
    await expect(
      createGeminiClient({
        apiKey: '',
        model: 'm',
        thinkingLevel: '',
        timeoutMs: 1,
        loadSdk: async () => {
          loaded = true;
        },
      })
    ).rejects.toThrow(/GEMINI_API_KEY/);
    expect(loaded).toBe(false);
  });
});

describe('readRuntimeConfig', () => {
  it('uses the documented defaults', () => {
    expect(readRuntimeConfig({})).toMatchObject({
      model: DEFAULT_MODEL,
      thinkingLevel: 'LOW',
      rpm: 10,
      concurrency: 2,
      maxApiAttempts: 5,
      maxValidationAttempts: 2,
    });
    expect(DEFAULT_MODEL).toBe('gemini-3.8-flash');
  });

  it('accepts overrides and "NONE" to disable thinking config', () => {
    expect(
      readRuntimeConfig({
        GEMINI_MODEL: 'gemini-3.5-flash-lite',
        GEMINI_THINKING_LEVEL: 'none',
        I18N_CONCURRENCY: '1',
      })
    ).toMatchObject({ model: 'gemini-3.5-flash-lite', thinkingLevel: '', concurrency: 1 });
  });

  it.each([
    [{ GEMINI_MODEL: 'Gemini Flash' }, /GEMINI_MODEL/],
    [{ I18N_CONCURRENCY: '3' }, /I18N_CONCURRENCY/],
    [{ I18N_RPM: 'fast' }, /I18N_RPM/],
    [{ GEMINI_THINKING_LEVEL: 'ultra' }, /GEMINI_THINKING_LEVEL/],
  ])('rejects %j', (env, pattern) => {
    expect(() => readRuntimeConfig(env)).toThrow(pattern);
  });
});
