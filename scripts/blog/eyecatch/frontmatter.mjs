/**
 * 記事の frontmatter の `image:`（src/config/blog-schema.ts の image = { url, alt }）だけを書き換える。
 * gray-matter で全体を書き直すと、ほかの欄の引用符や並びまで変わって差分が膨らむため、行で差し替える。
 * 書き換えたあとに読み直し、url と alt が意図どおりかを確かめる。
 */
import matter from 'gray-matter';

const FENCE = '---';

function splitFrontmatter(text) {
  const lines = text.split('\n');
  if (lines[0] !== FENCE) throw new Error('frontmatter が見つかりません（1 行目が --- ではない）');
  const end = lines.indexOf(FENCE, 1);
  if (end === -1) throw new Error('frontmatter の終わりの --- が見つかりません');
  return { head: lines.slice(1, end), rest: lines.slice(end) };
}

/** `image:` の行と、その下の字下げされた行の範囲。無ければ null。 */
function findImageBlock(head) {
  const start = head.findIndex((line) => /^image:/.test(line));
  if (start === -1) return null;
  let end = start + 1;
  while (end < head.length && /^\s+\S/.test(head[end])) end += 1;
  return { start, end };
}

/**
 * @param {string} text 記事の全文
 * @param {{ url: string, alt: string }} image
 * @returns {string} image を差し替えた全文
 */
export function setFrontmatterImage(text, { url, alt }) {
  const { head, rest } = splitFrontmatter(text);
  // JSON の文字列は YAML の二重引用符の文字列としてそのまま読める。
  const block = ['image:', `  url: ${JSON.stringify(url)}`, `  alt: ${JSON.stringify(alt)}`];
  const existing = findImageBlock(head);
  const langIndex = head.findIndex((line) => /^lang:/.test(line));
  const at = existing ? existing.start : langIndex === -1 ? head.length : langIndex;
  const removeCount = existing ? existing.end - existing.start : 0;
  const nextHead = [...head.slice(0, at), ...block, ...head.slice(at + removeCount)];
  const next = [FENCE, ...nextHead, ...rest].join('\n');

  const parsed = matter(next).data.image;
  if (parsed?.url !== url || parsed?.alt !== alt) {
    throw new Error('frontmatter の image を書き換えたあとの読み直しが一致しません');
  }
  return next;
}
