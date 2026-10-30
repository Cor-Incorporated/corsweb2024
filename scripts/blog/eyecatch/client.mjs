/**
 * Gemini の画像生成モデルを呼ぶアダプタ（@google/genai の generateContent、responseModalities = IMAGE）。
 * CLI はこのアダプタの generate() の形にだけ依存し、テストではモックを注入する（scripts/i18n/gemini.mjs と同じ形）。
 *
 * モデル id は 2026-10-30 に models.list で確かめた、画像を返す GA のモデル。Imagen（generateImages）は
 * この鍵の一覧に出なかったので使わない。
 */

export const DEFAULT_EYECATCH_MODEL = 'gemini-3.1-flash-image';

/** 16:9 の 2K（長辺 2,000 px 台）で受け取り、1600×900 に縮める。1K（長辺 1,376 px 前後）では足りない。 */
export const IMAGE_CONFIG = Object.freeze({ aspectRatio: '16:9', imageSize: '2K' });

/**
 * @param {{ apiKey: string, model: string, timeoutMs?: number,
 *           loadSdk?: () => Promise<{ GoogleGenAI: new (opts: object) => any }> }} options
 * @returns {Promise<{ model: string, generate: (prompt: string) => Promise<{ mimeType: string, bytes: Buffer }> }>}
 */
export async function createEyecatchClient({
  apiKey,
  model,
  timeoutMs = 120_000,
  loadSdk = () => import('@google/genai'),
}) {
  if (!apiKey) throw new Error('GEMINI_API_KEY が未設定です');
  const { GoogleGenAI } = await loadSdk();
  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: timeoutMs } });
  return Object.freeze({
    model,
    async generate(prompt) {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseModalities: ['IMAGE'], imageConfig: IMAGE_CONFIG },
      });
      const candidate = response.candidates?.[0];
      const part = candidate?.content?.parts?.find((p) => p.inlineData?.data);
      if (!part) {
        throw new Error(`画像が返りませんでした（finishReason=${candidate?.finishReason ?? 'なし'}）`);
      }
      return {
        mimeType: part.inlineData.mimeType ?? 'image/png',
        bytes: Buffer.from(part.inlineData.data, 'base64'),
      };
    },
  });
}
