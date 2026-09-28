/**
 * ja と各言語ファイルの有無・鮮度を判定する。
 *
 * 状態（ja × 翻訳ファイル × translationSourceHash × コピー対象フィールド）:
 *   missing     ja あり / 翻訳なし                         → 翻訳する
 *   untracked   ja あり / 翻訳あり / ハッシュなし（旧来の翻訳）→ --adopt で採用 or 再翻訳
 *   stale       ja あり / 翻訳あり / ハッシュ不一致           → 再翻訳する
 *   meta-drift  ハッシュ一致だがコピー対象（pubDate 等）や lang がずれている → API なしで同期
 *   ok          ハッシュ一致・コピー対象も一致
 *   orphan      ja なし / 翻訳あり（ja を削除・改名した）      → 条件つきで翻訳を削除する（run.mjs）
 *   invalid     翻訳ファイルの frontmatter が壊れている・スキーマ違反 → 再翻訳する
 *   source-error ja の frontmatter が壊れている・スキーマ違反   → 何もしない（人が直す。API も呼ばない）
 *
 * frontmatter は分類の時点で src/content/config.ts の Zod ミラー（schema.mjs）で検証する。
 * ja が不正なまま翻訳して API を使ったあとで失敗したり、必須フィールドの消えた翻訳を ok と
 * 判定したりしないため。
 *
 * --since で差分を与えたときは、各項目に sourceDiff（ja ファイルがその差分で
 * 'added' / 'modified' / 'deleted' / 'unchanged' のどれか）を付ける。差分なしの実行では null。
 * orphan の削除可否（M1）と、旧翻訳の採用可否（M3）はこれを根拠に決める。
 */
import { execFileSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { COLLECTIONS, CONTENT_ROOT, META_KEYS, SOURCE_LANG, TARGET_LANGS } from './config.mjs';
import { parseDocument } from './frontmatter.mjs';
import { computeSourceHash } from './hash.mjs';
import { validateExistingTranslation, validateSourceFrontmatter } from './schema.mjs';
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
  const sourceIssues = validateSourceFrontmatter(collection, source.data);
  if (sourceIssues.length > 0) return { status: 'source-error', reason: sourceIssues.join(' / ') };
  if (!target) return { status: 'missing' };
  if (target.error) return { status: 'invalid', reason: target.error };
  const targetIssues = validateExistingTranslation(collection, target.data);
  if (targetIssues.length > 0) return { status: 'invalid', reason: targetIssues.join(' / ') };
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

/** 翻訳ファイルに来歴（translationSourceHash）があるか。壊れたファイル・旧翻訳は false。 */
export function hasProvenance(target) {
  const hash = target?.data?.translationSourceHash;
  return !target?.error && hash !== undefined && hash !== null;
}

async function planCollection({ root, collection, langs, only, sourceChanges }) {
  const base = path.join(root, CONTENT_ROOT, collection);
  const sourceSlugs = await listSlugs(path.join(base, SOURCE_LANG));
  const sources = new Map();
  const items = [];
  let targetCount = 0;
  for (const lang of langs) {
    const targetSlugs = await listSlugs(path.join(base, lang));
    targetCount += targetSlugs.length;
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
      const sourceDiff = sourceChanges
        ? sourceChanges.get(`${collection}/${slug}`) ?? 'unchanged'
        : null;
      if (verdict) {
        items.push({
          collection,
          slug,
          lang,
          ...verdict,
          sourceDiff,
          sourcePath,
          targetPath,
          source,
          target,
        });
      }
    }
  }
  return { items, sourceCount: sourceSlugs.length, targetCount };
}

/**
 * @param {{ root: string, collections: string[], langs: string[], only: Set<string> | null,
 *           sourceChanges?: Map<string, 'added' | 'modified' | 'deleted'> | null }} scope
 *   sourceChanges は --since の差分での ja ファイルの変化（collection/slug → 種類）。
 * @returns {Promise<{ items: object[], langs: string[], sourceCounts: Record<string, number>,
 *           targetCounts: Record<string, number> }>}
 *   targetCounts は対象言語の翻訳ファイル総数（--only / --since で絞る前）。削除比率の分母に使う。
 */
export async function buildPlan({
  root,
  collections,
  langs = TARGET_LANGS,
  only = null,
  sourceChanges = null,
}) {
  const items = [];
  const sourceCounts = {};
  const targetCounts = {};
  for (const collection of collections) {
    const result = await planCollection({ root, collection, langs, only, sourceChanges });
    items.push(...result.items);
    sourceCounts[collection] = result.sourceCount;
    targetCounts[collection] = result.targetCount;
  }
  return { items, langs: [...langs], sourceCounts, targetCounts };
}

const CONTENT_PATH_RE = new RegExp(`^${CONTENT_ROOT}/([^/]+)/([^/]+)/([^/]+)\\.md$`);

/** コンテンツのパスなら { collection, lang, slug }。それ以外は null。 */
function parseContentPath(file) {
  const known = new Set([SOURCE_LANG, ...TARGET_LANGS]);
  const m = file.match(CONTENT_PATH_RE);
  if (!m || !(m[1] in COLLECTIONS) || !known.has(m[2])) return null;
  if (!SLUG_RE.test(m[3])) throw new Error(`扱えないファイル名です: ${file}`);
  return { collection: m[1], lang: m[2], slug: m[3] };
}

/** git diff のパス一覧から「collection/slug」の集合を作る（コンテンツ以外は無視）。 */
export function targetsFromPaths(paths) {
  return new Set(
    paths
      .map(parseContentPath)
      .filter(Boolean)
      .map((p) => `${p.collection}/${p.slug}`)
  );
}

/** `git diff --name-status -z` の出力を [{ status, path }] にする（R/C は新しい側のパス）。 */
export function parseNameStatus(output) {
  const fields = output.split('\0');
  const entries = [];
  let i = 0;
  while (i < fields.length && fields[i] !== '') {
    const status = fields[i];
    const twoPaths = /^[RC]/.test(status);
    entries.push({ status: status[0], path: fields[i + (twoPaths ? 2 : 1)] });
    i += twoPaths ? 3 : 2;
  }
  return entries;
}

const SOURCE_CHANGE_KIND = Object.freeze({ A: 'added', D: 'deleted' });

/**
 * 差分から「対象にする記事」と「ja ファイルの変化」を作る。
 * @returns {{ targets: Set<string>, sourceChanges: Map<string, 'added' | 'modified' | 'deleted'> }}
 */
export function contentChangesFromNameStatus(output) {
  const entries = parseNameStatus(output);
  const targets = targetsFromPaths(entries.map((e) => e.path));
  const sourceChanges = new Map();
  for (const { status, path: file } of entries) {
    const p = parseContentPath(file);
    if (p?.lang === SOURCE_LANG) {
      sourceChanges.set(`${p.collection}/${p.slug}`, SOURCE_CHANGE_KIND[status] ?? 'modified');
    }
  }
  return { targets, sourceChanges };
}

/**
 * `<ref>...HEAD`（merge-base からの差分）で変更されたコンテンツ。
 * --no-renames なので ja の改名は「旧 slug の削除 + 新 slug の追加」として現れる。
 */
export function changedContent({ root, since, runGit = defaultRunGit }) {
  const out = runGit(root, [
    'diff',
    '--name-status',
    '--no-renames',
    '-z',
    `${since}...HEAD`,
    '--',
    CONTENT_ROOT,
  ]);
  return contentChangesFromNameStatus(out);
}

function defaultRunGit(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}
