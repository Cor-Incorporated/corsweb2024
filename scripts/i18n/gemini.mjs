/**
 * @google/genai（Gemini API）のアダプタ。翻訳ロジックは generate() の形にだけ依存し、
 * テストではこのアダプタの代わりにモックを注入する。
 *
 * SDK: @google/genai（旧 @google/generative-ai は 2025-11-30 でサポート終了）
 *   https://github.com/google-gemini/deprecated-generative-ai-js
 */

/**
 * @param {{ apiKey: string, model: string, thinkingLevel: string, timeoutMs: number,
 *           loadSdk?: () => Promise<{ GoogleGenAI: new (opts: object) => any }> }} options
 * @returns {Promise<{ model: string, generate: (req: { system: string, prompt: string, jsonSchema?: object })
 *           => Promise<{ text: string, finishReason?: string }> }>}
 */
export async function createGeminiClient({
  apiKey,
  model,
  thinkingLevel,
  timeoutMs,
  loadSdk = () => import('@google/genai'),
}) {
  if (!apiKey)
    throw new Error('GEMINI_API_KEY が未設定です（翻訳の書き込みには API キーが必要です）');
  const { GoogleGenAI } = await loadSdk();
  // SDK 側のリトライは使わない（retryOptions 未指定 = 1 回）。再試行は retry.mjs に一本化する。
  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: timeoutMs } });
  return Object.freeze({
    model,
    async generate({ system, prompt, jsonSchema }) {
      const config = {
        systemInstruction: system,
        ...(thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {}),
        ...(jsonSchema
          ? { responseMimeType: 'application/json', responseJsonSchema: jsonSchema }
          : {}),
      };
      const response = await ai.models.generateContent({ model, contents: prompt, config });
      return { text: response.text ?? '', finishReason: response.candidates?.[0]?.finishReason };
    },
  });
}
