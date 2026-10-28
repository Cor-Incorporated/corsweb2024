/**
 * 記事の文体（場面）を決める。
 *
 * 既定はコレクションとカテゴリから一通りに決まる。人間の指示文に明示の印が
 * あるときだけ、別の場面へ切り替える。印が無ければ、指示は言い回しの指定として
 * 残し、場面は既定のままにする。
 */

export const SCENES = ['company', 'founder', 'technical', 'story'];

/** cor-voice の「2. 場面ごとの文体」の見出し。本文は写さない。 */
export const SCENE_HEADINGS = {
  company: '会社として書く文章',
  founder: '代表の名前で書く文章',
  technical: '技術の記事',
  story: 'Grift のストーリー（架空の物語）',
};

/** yomiyasu_check.py に渡す値。cor-voice の「2. 進め方」に合わせる。 */
export const YOMIYASU_FOR_SCENE = {
  company: { docType: 'article', reader: 'informed', stance: '説明' },
  founder: { docType: 'article', reader: 'informed', stance: '説明' },
  technical: { docType: 'article', reader: 'expert', stance: '説明' },
  story: { docType: 'essay', reader: 'informed', stance: null },
};

const MARKERS = [
  { scene: 'company', source: 'scene:', test: (text) => /^scene:\s*company\s*$/m.test(text) },
  { scene: 'founder', source: 'scene:', test: (text) => /^scene:\s*founder\s*$/m.test(text) },
  { scene: 'technical', source: 'scene:', test: (text) => /^scene:\s*technical\s*$/m.test(text) },
  { scene: 'story', source: 'scene:', test: (text) => /^scene:\s*story\s*$/m.test(text) },
  { scene: 'company', source: 'phrase', test: (text) => text.includes('会社として書く') },
  { scene: 'founder', source: 'phrase', test: (text) => text.includes('代表の名前で書く') },
  { scene: 'technical', source: 'phrase', test: (text) => text.includes('技術の記事として書く') },
  { scene: 'story', source: 'phrase', test: (text) => text.includes('ストーリーとして書く') },
];

export class PolishError extends Error {
  /**
   * @param {string} message
   * @param {{ exitCode?: number, code?: string }} [options]
   */
  constructor(message, options = {}) {
    super(message);
    this.name = 'PolishError';
    this.exitCode = options.exitCode ?? 1;
    this.code = options.code ?? 'POLISH';
  }
}

/**
 * @param {'blog' | 'news'} collection
 * @param {string | undefined} category
 */
export function defaultScene(collection, category) {
  if (collection === 'news') {
    return { scene: 'company', sceneSource: 'default' };
  }
  if (collection !== 'blog') {
    throw new PolishError(`推敲ゲートの対象は blog と news です（${collection}）`, {
      exitCode: 2,
      code: 'COLLECTION',
    });
  }
  if (category === 'founder') return { scene: 'founder', sceneSource: 'default' };
  if (category === 'lab') return { scene: 'technical', sceneSource: 'default' };
  if (category === 'ai' || category === 'engineering') {
    return { scene: 'company', sceneSource: 'default' };
  }
  throw new PolishError(
    `blog のカテゴリが場面に対応しません: ${category ?? '（無し）'}。ai / engineering / founder / lab のいずれかです`,
    { exitCode: 2, code: 'CATEGORY' },
  );
}

/**
 * @param {string} text
 * @returns {string[]} 指示文が名指しした場面。重複は除く。並びは検出順。
 */
export function scenesInInstruction(text) {
  const found = [];
  for (const marker of MARKERS) {
    if (marker.test(text) && !found.includes(marker.scene)) found.push(marker.scene);
  }
  return found;
}

/**
 * @param {{ collection: 'blog' | 'news', category?: string, instructionText?: string | null }} input
 */
export function resolveVoice(input) {
  const base = defaultScene(input.collection, input.category);
  const text = (input.instructionText ?? '').trim();
  if (!text) {
    return {
      ...base,
      voiceSwitched: false,
      instructionEffect: 'none',
      namedScenes: [],
    };
  }
  const namedScenes = scenesInInstruction(text);
  if (namedScenes.length > 1) {
    throw new PolishError(
      `人間の指示が複数の場面を名指ししています: ${namedScenes.join(', ')}。1 つにしてください`,
      { exitCode: 1, code: 'VOICE_CONFLICT' },
    );
  }
  if (namedScenes.length === 0) {
    return {
      ...base,
      voiceSwitched: false,
      instructionEffect: 'wording',
      namedScenes: [],
    };
  }
  const scene = namedScenes[0];
  const voiceSwitched = scene !== base.scene;
  return {
    scene,
    sceneSource: voiceSwitched ? 'explicit' : 'explicit-same',
    voiceSwitched,
    instructionEffect: 'scene',
    namedScenes,
    defaultScene: base.scene,
  };
}
