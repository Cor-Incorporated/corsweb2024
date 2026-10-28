/**
 * 公開済みの ja 記事から、文体の見本を選ぶ。
 * 見本はファイルパスと短い抜粋だけを返し、埋め込みや別のモデルは使わない。
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { parseDocument } from '../i18n/frontmatter.mjs';
import { PolishError, defaultScene } from './voice.mjs';

export const EXCERPT_OPEN = 400;
export const EXCERPT_CLOSE = 240;

const COLLECTIONS = ['blog', 'news'];

/**
 * @param {string} rel posix path
 * @returns {{ collection: 'blog' | 'news', slug: string, rel: string } | null}
 */
export function identifyContentFile(rel) {
  const norm = rel.replace(/\\/g, '/').replace(/^\.\//, '');
  const match = norm.match(/(?:^|\/)src\/content\/(blog|news)\/ja\/([^/]+)\.md$/);
  if (!match) return null;
  return {
    collection: match[1],
    slug: match[2],
    rel: `src/content/${match[1]}/ja/${match[2]}.md`,
  };
}

/**
 * @param {string} repo
 * @param {string} file absolute or repo-relative
 */
export function locateArticle(repo, file) {
  const abs = path.resolve(repo, file);
  const rel = path.relative(repo, abs).split(path.sep).join('/');
  if (rel.startsWith('..')) {
    throw new PolishError(`リポジトリの外のファイルです: ${file}`, { exitCode: 2, code: 'PATH' });
  }
  const translated = rel.match(/^src\/content\/(blog|news)\/(en|zh|ko|es)\//);
  if (translated) {
    throw new PolishError('翻訳ファイルは翻訳 CI のものです。ja の原稿を直してください', {
      exitCode: 2,
      code: 'TRANSLATION',
    });
  }
  if (rel.startsWith('src/content/cases/')) {
    throw new PolishError('cases はこの推敲ゲートの対象外です。対象は blog と news の ja です', {
      exitCode: 2,
      code: 'COLLECTION',
    });
  }
  const id = identifyContentFile(rel);
  if (!id) {
    throw new PolishError(
      `ja の blog か news の Markdown ではありません: ${rel}`,
      { exitCode: 2, code: 'PATH' },
    );
  }
  return { ...id, abs };
}

/** コードフェンスとインラインコードを除いた本文。 */
export function stripCode(text) {
  return text.replace(/```[\s\S]*?```/g, '\n').replace(/`[^`\n]+`/g, '');
}

/** URL を除く。リンクの文字は残す。 */
export function stripUrls(text) {
  return text.replace(/!\[[^\]]*]\([^)]*\)/g, '').replace(/\[([^\]]+)]\([^)]*\)/g, '$1').replace(/https?:\/\/\S+/g, '');
}

/**
 * @param {string} body
 * @returns {string[]}
 */
export function proseParagraphs(body) {
  const stripped = stripUrls(stripCode(body));
  return stripped
    .split(/\n\s*\n/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter((part) => part && !part.startsWith('#') && !part.startsWith('|') && !/^[-*]\s/.test(part));
}

/**
 * @param {string} text
 * @param {number} max
 */
export function clip(text, max) {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max).trim()}…`;
}

/**
 * @param {string} body
 */
export function excerptsFromBody(body) {
  const paragraphs = proseParagraphs(body);
  const opening = clip(paragraphs[0] ?? '', EXCERPT_OPEN);
  const last = paragraphs.length > 1 ? paragraphs[paragraphs.length - 1] : '';
  const closing = clip(last, EXCERPT_CLOSE);
  return {
    opening,
    closing: closing && closing !== opening ? closing : '',
  };
}

function dateKey(data) {
  const value = data.pubDate ?? data.publishedAt;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'string' && value.length >= 10) return value.slice(0, 10);
  return '0000-00-00';
}

/**
 * @param {string} repo
 * @returns {Array<{ rel: string, collection: string, slug: string, category: string, scene: string, date: string, title: string, opening: string, closing: string, isDraft: boolean }>}
 */
export function listCorpus(repo) {
  const items = [];
  for (const collection of COLLECTIONS) {
    const dir = path.join(repo, 'src/content', collection, 'ja');
    let names = [];
    try {
      names = readdirSync(dir);
    } catch (error) {
      if (error && error.code === 'ENOENT') continue;
      throw error;
    }
    for (const name of names) {
      if (!name.endsWith('.md')) continue;
      const abs = path.join(dir, name);
      if (!statSync(abs).isFile()) continue;
      const rel = `src/content/${collection}/ja/${name}`;
      const raw = readFileSync(abs, 'utf8');
      let parsed;
      try {
        parsed = parseDocument(raw);
      } catch {
        continue;
      }
      const category = typeof parsed.data.category === 'string' ? parsed.data.category : '';
      let scene;
      try {
        scene = defaultScene(collection, category).scene;
      } catch {
        continue;
      }
      const pieces = excerptsFromBody(parsed.body);
      items.push({
        rel,
        collection,
        slug: name.slice(0, -3),
        category,
        scene,
        date: dateKey(parsed.data),
        title: typeof parsed.data.title === 'string' ? parsed.data.title : '',
        opening: pieces.opening,
        closing: pieces.closing,
        isDraft: parsed.data.isDraft === true,
      });
    }
  }
  return items;
}

/**
 * 同じ場面の公開記事から、新しい順に見本を選ぶ。対象のファイル自身と下書きは除く。
 * 同じカテゴリを先にする。場面が違う記事では埋めない。
 *
 * @param {{ corpus: ReturnType<typeof listCorpus>, targetRel: string, scene: string, category?: string, limit?: number }} input
 */
export function pickExemplars(input) {
  const limit = input.limit ?? 3;
  const candidates = input.corpus.filter(
    (item) => item.rel !== input.targetRel && !item.isDraft && item.scene === input.scene && item.opening,
  );
  candidates.sort((a, b) => {
    const categoryRank = (item) => (item.category && item.category === input.category ? 0 : 1);
    const byCategory = categoryRank(a) - categoryRank(b);
    if (byCategory !== 0) return byCategory;
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0;
  });
  return candidates.slice(0, limit);
}
