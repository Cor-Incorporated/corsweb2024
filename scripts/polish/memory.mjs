/**
 * 推敲の学習と、人間の文体指示を、レビューできる Markdown として読む・書く。
 * モデルの内部状態は持たない。
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseDocument } from '../i18n/frontmatter.mjs';
import { excerptsFromBody } from './corpus.mjs';
import { PolishError } from './voice.mjs';

export const LEARNED_DIR = 'docs/polish/learned';
export const INSTRUCTION_DIR = 'docs/polish/instructions';
const NOTE_MAX = 400;

function yamlQuote(value) {
  return JSON.stringify(value);
}

/**
 * @param {string} repo
 * @param {'blog' | 'news'} collection
 * @param {string} slug
 */
export function learnedPath(repo, collection, slug) {
  return path.join(repo, LEARNED_DIR, collection, `${slug}.md`);
}

/**
 * @param {string} repo
 * @param {'blog' | 'news'} collection
 * @param {string} slug
 */
export function instructionPath(repo, collection, slug) {
  return path.join(repo, INSTRUCTION_DIR, collection, `${slug}.md`);
}

/**
 * @param {string} body
 */
export function instructionTextFromBody(body) {
  return body.replace(/^#\s*人間の指示\s*\n+/, '').replace(/\s+$/, '');
}

/**
 * @param {string} repo
 * @param {'blog' | 'news'} collection
 * @param {string} slug
 * @returns {{ text: string, issue: string | null, rel: string } | null}
 */
export function readInstruction(repo, collection, slug) {
  const abs = instructionPath(repo, collection, slug);
  if (!existsSync(abs)) return null;
  const raw = readFileSync(abs, 'utf8');
  const parsed = parseDocument(raw);
  if (parsed.data.kind !== 'polish-instruction') {
    throw new PolishError(`指示ファイルの kind が違います: ${abs}`, { exitCode: 1, code: 'INSTRUCTION' });
  }
  const issue = parsed.data.issue == null || parsed.data.issue === '' ? null : String(parsed.data.issue);
  return {
    text: instructionTextFromBody(parsed.body),
    issue,
    rel: path.relative(repo, abs).split(path.sep).join('/'),
  };
}

/**
 * @param {{ repo: string, collection: 'blog' | 'news', slug: string, text: string, issue?: string | null, recordedAt: string }} input
 */
export function writeInstruction(input) {
  const text = input.text.replace(/\s+$/, '');
  if (!text.trim()) {
    throw new PolishError('人間の指示文が空です', { exitCode: 2, code: 'INSTRUCTION' });
  }
  const abs = instructionPath(input.repo, input.collection, input.slug);
  mkdirSync(path.dirname(abs), { recursive: true });
  const issueLine = input.issue ? `issue: ${yamlQuote(String(input.issue))}\n` : '';
  const file = `---
kind: polish-instruction
collection: ${input.collection}
slug: ${yamlQuote(input.slug)}
recordedAt: ${JSON.stringify(input.recordedAt)}
${issueLine}---

# 人間の指示

${text}
`;
  writeFileSync(abs, file);
  return path.relative(input.repo, abs).split(path.sep).join('/');
}

/**
 * @param {string} repo
 * @param {'blog' | 'news'} collection
 * @param {string} slug
 * @returns {boolean} 消したか
 */
export function clearInstruction(repo, collection, slug) {
  const abs = instructionPath(repo, collection, slug);
  if (!existsSync(abs)) return false;
  rmSync(abs);
  return true;
}

function learnedAtOf(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  return String(value ?? '');
}

function listMarkdown(dir) {
  if (!existsSync(dir)) return [];
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...listMarkdown(abs));
    else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md') found.push(abs);
  }
  return found;
}

/**
 * @param {string} repo
 */
export function listLearned(repo) {
  const root = path.join(repo, LEARNED_DIR);
  const items = [];
  for (const abs of listMarkdown(root)) {
    let parsed;
    try {
      parsed = parseDocument(readFileSync(abs, 'utf8'));
    } catch {
      items.push({
        rel: path.relative(repo, abs).split(path.sep).join('/'),
        unreadable: true,
      });
      continue;
    }
    if (parsed.data.kind !== 'polish-example') continue;
    const noteMatch = parsed.body.match(/## 人間のメモ\n+([\s\S]*?)\s*$/);
    items.push({
      rel: path.relative(repo, abs).split(path.sep).join('/'),
      unreadable: false,
      collection: String(parsed.data.collection ?? ''),
      slug: String(parsed.data.slug ?? ''),
      scene: String(parsed.data.scene ?? ''),
      source: String(parsed.data.source ?? ''),
      learnedAt: learnedAtOf(parsed.data.learnedAt),
      note: (noteMatch?.[1] ?? '').trim(),
      body: parsed.body,
    });
  }
  return items;
}

/**
 * @param {{ repo: string, article: { collection: 'blog' | 'news', slug: string, rel: string }, scene: string, raw: string, note: string, learnedAt: string, approved: boolean }} input
 */
export function writeLearned(input) {
  if (!input.approved) {
    throw new PolishError('learn は、人間が採用した記事にだけ実行します。--approved を付けてください', {
      exitCode: 2,
      code: 'NOT_APPROVED',
    });
  }
  const note = input.note.trim();
  if ([...note].length > NOTE_MAX) {
    throw new PolishError(`人間のメモは ${NOTE_MAX} 字までです`, { exitCode: 2, code: 'NOTE' });
  }
  const parsed = parseDocument(input.raw);
  if (parsed.data.isDraft === true) {
    throw new PolishError('下書きは learn しません。採用した原稿だけを記録します', {
      exitCode: 1,
      code: 'DRAFT',
    });
  }
  const pieces = excerptsFromBody(parsed.body);
  if (!pieces.opening) {
    throw new PolishError('本文から抜粋できる段落がありません', { exitCode: 1, code: 'EXCERPT' });
  }
  const abs = learnedPath(input.repo, input.article.collection, input.article.slug);
  mkdirSync(path.dirname(abs), { recursive: true });
  const closing = pieces.closing
    ? `## 結び\n\n> ${pieces.closing}\n\n`
    : '';
  const file = `---
kind: polish-example
collection: ${input.article.collection}
slug: ${JSON.stringify(input.article.slug)}
scene: ${input.scene}
source: ${JSON.stringify(input.article.rel)}
learnedAt: ${JSON.stringify(input.learnedAt)}
---

# 採用した書き方

出典の全文は写さない。次の推敲は、この抜粋を文体の見本にする。事実と数値は写さない。

## 書き出し

> ${pieces.opening}

${closing}## 人間のメモ

${note || '（なし）'}
`;
  writeFileSync(abs, file);
  return path.relative(input.repo, abs).split(path.sep).join('/');
}

/**
 * 同じ場面の学習メモ。新しい learnedAt、同じ日ならパス順。
 * @param {ReturnType<typeof listLearned>} learned
 * @param {string} scene
 * @param {number} [limit]
 */
export function pickLearned(learned, scene, limit = 3) {
  return learned
    .filter((item) => !item.unreadable && item.scene === scene)
    .sort((a, b) => {
      if (a.learnedAt !== b.learnedAt) return a.learnedAt < b.learnedAt ? 1 : -1;
      return a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0;
    })
    .slice(0, limit);
}
