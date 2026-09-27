/**
 * ja と各言語ファイルの有無・鮮度を判定する。
 *
 * 状態（ja × 翻訳ファイル × translationSourceHash × コピー対象フィールド）:
 *   missing     ja あり / 翻訳なし                         → 翻訳する
 *   untracked   ja あり / 翻訳あり / ハッシュなし（旧来の翻訳）→ --adopt で採用 or 再翻訳
 *   stale       ja あり / 翻訳あり / ハッシュ不一致           → 再翻訳する
 *   meta-drift  ハッシュ一致だがコピー対象（pubDate 等）や lang がずれている → API なしで同期
 *   ok          ハッシュ一致・コピー対象も一致
 *   orphan      ja なし / 翻訳あり（ja を削除・改名した）      → 翻訳を削除する
 *   invalid     翻訳ファイルの frontmatter が壊れている        → 再翻訳する
 *   source-error ja の frontmatter が壊れている               → 何もしない（人が直す）
 */
import { execFileSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { COLLECTIONS, CONTENT_ROOT, META_KEYS, SOURCE_LANG, TARGET_LANGS } from './config.mjs';
import { parseDocument } from './frontmatter.mjs';
import { computeSourceHash } from './hash.mjs';
import { deepEqual, omitPath } from './util.mjs';

export const SLUG_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
export const STATUSES = Object.freeze([
  'missing',
  'untracked',
  'stale',
  'meta-drift',
  'orphan',
  'invalid',
  'source-error',
  'ok',
]);

/** ja からコピーされるべき部分（翻訳対象・lang・来歴を除いたもの）。 */
export function copiedPart(collection, data) {
  const spec = COLLECTIONS[collection];
  const excluded = [...spec.fields, ...META_KEYS, 'lang', ...(spec.translateTags ? ['tags'] : [])];
  return excluded.reduce((acc, p) => omitPath(acc, p), data);
}

/**
 * 1 組（ja × 1 言語）の状態を判定する純関数。
 * @param {{ collection: string, lang: string,
 *           source: null | { data: object, body: string } | { error: string },
 *           target: null | { data: object, body: string } | { error: string } }} args
 * @returns {null | { status: string, reason?: string }}
 */
export function classify({ collection, lang, source, target }) {
  if (!source) return target ? { status: 'orphan' } : null;
  if (source.error) return { status: 'source-error', reason: source.error };
  if (!target) return { status: 'missing' };
  if (target.error) return { status: 'invalid', reason: target.error };
  const recorded = target.data.translationSourceHash;
  if (recorded === undefined || recorded === null) return { status: 'untracked' };
  if (recorded !== computeSourceHash(collection, source.data, source.body))
    return { status: 'stale' };
  if (target.data.lang !== lang)
    return { status: 'meta-drift', reason: `lang=${String(target.data.lang)}` };
  if (!deepEqual(copiedPart(collection, source.data), copiedPart(collection, target.data))) {
    return { status: 'meta-drift', reason: 'ja からコピーするフィールドが一致しません' };
  }
  return { status: 'ok' };
}

export async function listSlugs(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .map((e) => e.name.slice(0, -'.md'.length))
      .sort();
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function readDocument(file) {
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
  try {
    return parseDocument(text);
  } catch (err) {
    return { error: err.message };
  }
}

function inScope(only, collection, slug) {
  return !only || only.has(`${collection}/${slug}`) || only.has(slug);
}

async function planCollection({ root, collection, langs, only }) {
  const base = path.join(root, CONTENT_ROOT, collection);
  const sourceSlugs = await listSlugs(path.join(base, SOURCE_LANG));
  const sources = new Map();
  const items = [];
  for (const lang of langs) {
    const targetSlugs = await listSlugs(path.join(base, lang));
    const slugs = [...new Set([...sourceSlugs, ...targetSlugs])]
      .filter((s) => inScope(only, collection, s))
      .sort();
    for (const slug of slugs) {
      const sourcePath = path.join(base, SOURCE_LANG, `${slug}.md`);
      if (!sources.has(slug)) sources.set(slug, await readDocument(sourcePath));
      const targetPath = path.join(base, lang, `${slug}.md`);
      const source = sources.get(slug);
      const target = await readDocument(targetPath);
      const verdict = classify({ collection, lang, source, target });
      if (verdict)
        items.push({ collection, slug, lang, ...verdict, sourcePath, targetPath, source, target });
    }
  }
  return { items, sourceCount: sourceSlugs.length };
}

/**
 * @param {{ root: string, collections: string[], langs: string[], only: Set<string> | null }} scope
 * @returns {Promise<{ items: object[], sourceCounts: Record<string, number> }>}
 */
export async function buildPlan({ root, collections, langs = TARGET_LANGS, only = null }) {
  const items = [];
  const sourceCounts = {};
  for (const collection of collections) {
    const result = await planCollection({ root, collection, langs, only });
    items.push(...result.items);
    sourceCounts[collection] = result.sourceCount;
  }
  return { items, sourceCounts };
}

const CONTENT_PATH_RE = new RegExp(`^${CONTENT_ROOT}/([^/]+)/([^/]+)/([^/]+)\\.md$`);

/** git diff のパス一覧から「collection/slug」の集合を作る（コンテンツ以外は無視）。 */
export function targetsFromPaths(paths) {
  const known = new Set([SOURCE_LANG, ...TARGET_LANGS]);
  const targets = new Set();
  for (const file of paths) {
    const m = file.match(CONTENT_PATH_RE);
    if (!m || !(m[1] in COLLECTIONS) || !known.has(m[2])) continue;
    if (!SLUG_RE.test(m[3])) throw new Error(`扱えないファイル名です: ${file}`);
    targets.add(`${m[1]}/${m[3]}`);
  }
  return targets;
}

/** `<ref>...HEAD` で変更されたコンテンツの「collection/slug」集合（PR の差分に絞る用）。 */
export function changedTargets({ root, since, runGit = defaultRunGit }) {
  const out = runGit(root, [
    'diff',
    '--name-only',
    '--no-renames',
    '-z',
    `${since}...HEAD`,
    '--',
    CONTENT_ROOT,
  ]);
  return targetsFromPaths(out.split('\0').filter(Boolean));
}

function defaultRunGit(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}
