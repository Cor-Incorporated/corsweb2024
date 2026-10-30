/**
 * アイキャッチ画像の生成プロンプト（docs/blog-style-guide.md「アイキャッチの方針」）。
 * 記事の frontmatter（title / summary / description / category）から、サイトの見た目に合う
 * 抽象・図解寄りの絵を頼む英語のプロンプトを組み立てる。日本語の題は「雰囲気の手がかり」として渡し、
 * 画像の中に文字として描かせない。
 */

/** プロンプトの書き方を変えたら上げる。記録（<slug>.eyecatch.json）に残し、どの版で作った絵かを追えるようにする。 */
export const PROMPT_VERSION = 1;

/** カテゴリごとのモチーフ。カテゴリは src/config/categories.ts の BLOG_CATEGORIES の id。 */
const CATEGORY_MOTIFS = {
  ai: 'abstract nodes connected by thin lines, two parallel paths being compared side by side, small geometric markers for checks and corrections',
  engineering: 'modular blocks and connectors arranged like a clean system diagram, a subtle timeline of versions',
  founder: 'a quiet path through simple geometric landscape shapes, warm morning light',
  lab: 'abstract laboratory bench made of simple geometric instruments, measured samples in neat rows',
};

const DEFAULT_MOTIF = 'simple abstract geometric shapes arranged like a calm diagram';

/** サイトの配色（tailwind.config.cjs の primary = stone）と、リンク・AI カテゴリの青に合わせる。 */
const STYLE = [
  'Minimal, calm editorial illustration for the blog of a small Japanese technology company.',
  'Flat geometric shapes and thin line-art diagrams, generous negative space, soft paper-like texture.',
  'Palette: warm stone grays (#fafaf9, #e7e5e4, #a8a29e, #57534e, #292524) with one muted blue accent (#2563eb).',
  'Wide 16:9 composition. Keep every important element inside the central 80% of the frame,',
  'because the same image is also cropped to 1200x630.',
];

/** 画像に入れないもの。公開前の確認項目（docs/blog-style-guide.md）と同じ並び。 */
export const PROHIBITED = [
  'any text, letters, numbers, Japanese or Chinese characters, captions or labels',
  'logos, brand marks, product names or watermarks',
  'human faces, realistic people or identifiable persons',
  'fake screenshots, user-interface mockups or chat windows',
  'charts or tables with readable values',
];

/** 改行と連続する空白を 1 つの空白にまとめ、長すぎる値を切る（frontmatter の複数行をプロンプトの 1 行に収める）。 */
function oneLine(value, maxLength) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

/**
 * @param {{ title: string, summary?: string, description?: string, category?: string }} post
 * @returns {string}
 */
export function buildEyecatchPrompt({ title, summary, description, category }) {
  const theme = oneLine(summary || description, 400);
  const motif = CATEGORY_MOTIFS[category] ?? DEFAULT_MOTIF;
  return [
    ...STYLE,
    `Visual motif: ${motif}.`,
    'The article is written in Japanese. Use its title and summary only to set the mood; never write them in the image.',
    `Title (mood only): ${oneLine(title, 200)}`,
    ...(theme ? [`Summary (mood only): ${theme}`] : []),
    `Do not include: ${PROHIBITED.join('; ')}.`,
  ].join('\n');
}
