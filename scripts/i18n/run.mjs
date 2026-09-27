/**
 * --check / --write / --adopt の実行。ファイル I/O と LLM クライアントは ctx で受け取る。
 */
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ADOPTED_MODEL_LABEL, COLLECTIONS } from './config.mjs';
import { composeDocument, parseDocument } from './frontmatter.mjs';
import { computeSourceHash } from './hash.mjs';
import { classify, STATUSES } from './plan.mjs';
import { capPrunes, orphanDecision } from './prune.mjs';
import { mapWithConcurrency } from './retry.mjs';
import { validateTranslatedFrontmatter } from './schema.mjs';
import { buildTranslatedData, extractTranslatedValues, translateDocument } from './translate.mjs';
import { getPath } from './util.mjs';

export const HINTS = Object.freeze({
  missing: '翻訳ファイルがありません → npm run i18n:translate（GEMINI_API_KEY が必要）',
  stale: 'ja が更新されています → npm run i18n:translate で再翻訳',
  invalid: '翻訳ファイルの frontmatter が壊れています → npm run i18n:translate で再生成',
  untracked:
    '来歴（translationSourceHash）の無い既存翻訳 → 今の ja に対応した訳なら `node scripts/i18n/translate-content.mjs --adopt` で採用、' +
    'ja を変更した記事なら `npm run i18n:translate -- --retranslate-untracked` で訳し直す',
  'meta-drift':
    'pubDate / category / featured 等が ja とずれています → npm run i18n:translate で同期（API 不要）',
  orphan:
    'ja が無い翻訳です（ja を削除・改名した）→ npm run i18n:translate で削除（条件は docs/i18n-translation.md）',
  'source-error': 'ja の frontmatter を解釈できません → ja を修正してください',
});

/** --since の差分で ja が追加・変更された項目か（旧翻訳はその変更を反映していない）。 */
export const sourceChangedInDiff = (item) =>
  item.sourceDiff === 'added' || item.sourceDiff === 'modified';

/** 項目ごとの具体的な案内（状態ごとの HINTS より優先）。無ければ undefined。 */
export function itemHint(item) {
  if (item.status === 'untracked' && sourceChangedInDiff(item)) {
    // M3: 古い訳を「今の ja の訳」として確定させない。adopt ではなく再翻訳を案内する。
    return (
      'ja がこの差分で変更されているため、旧翻訳は採用できません → ' +
      `node scripts/i18n/translate-content.mjs --write --retranslate-untracked --only ${item.collection}/${item.slug}`
    );
  }
  if (item.status === 'orphan') {
    const decision = orphanDecision(item, { pruneUntracked: false });
    return decision.prune ? undefined : decision.reason;
  }
  return undefined;
}

/** 状態ごと → collection/slug ごとに言語をまとめた報告行（項目ごとの案内は ↳ で添える）。 */
export function formatReport(items) {
  const lines = [];
  for (const status of STATUSES.filter((s) => s !== 'ok')) {
    const group = items.filter((i) => i.status === status);
    if (group.length === 0) continue;
    lines.push(`[${status}] ${group.length} 件 — ${HINTS[status]}`);
    const bySlug = new Map();
    for (const item of group) {
      const key = `${item.collection}/${item.slug}`;
      bySlug.set(key, [...(bySlug.get(key) ?? []), item]);
    }
    for (const [key, slugItems] of bySlug) {
      const langs = slugItems.map((i) => i.lang + (i.reason ? `（${i.reason}）` : ''));
      lines.push(`  ${key} → ${langs.join(', ')}`);
      const hints = [...new Set(slugItems.map(itemHint).filter(Boolean))];
      hints.forEach((hint) => lines.push(`    ↳ ${hint}`));
    }
  }
  return lines;
}

function summaryLine(items) {
  const counts = STATUSES.map((s) => [s, items.filter((i) => i.status === s).length]).filter(
    ([, n]) => n > 0
  );
  return counts.length === 0 ? '対象なし' : counts.map(([s, n]) => `${s}=${n}`).join(' ');
}

export function runCheck({ plan, out }) {
  const problems = plan.items.filter((i) => i.status !== 'ok');
  out.info(`i18n check: ${plan.items.length} 組を検査（${summaryLine(plan.items)}）`);
  formatReport(problems).forEach((line) => out.info(line));
  if (problems.length === 0) out.info('✓ すべての翻訳が ja と同期しています');
  return problems.length === 0 ? 0 : 1;
}

export async function writeFileAtomic(file, text) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, text, 'utf8');
  await rename(temp, file);
}

/** 書き込む前に、生成したテキストを読み戻して判定が ok になることを確かめる（書き手と検査の食い違い防止）。 */
async function writeChecked(item, text, ctx) {
  const verdict = classify({
    collection: item.collection,
    lang: item.lang,
    source: item.source,
    target: parseDocument(text),
  });
  if (verdict?.status !== 'ok')
    throw new Error(`自己検査に失敗しました（${verdict?.status}: ${verdict?.reason ?? ''}）`);
  if (!ctx.dryRun) await ctx.writeFile(item.targetPath, text);
}

function rebuild(item, meta) {
  const data = buildTranslatedData(
    item.collection,
    item.source.data,
    extractTranslatedValues(item.collection, item.target.data),
    item.lang,
    meta
  );
  const errors = validateTranslatedFrontmatter(item.collection, data, item.lang);
  if (errors.length > 0) throw new Error(errors.join(' / '));
  return composeDocument(data, item.target.body);
}

function resyncText(item) {
  const { translationSourceHash, translatedAt, translationModel } = item.target.data;
  return rebuild(item, { hash: translationSourceHash, translatedAt, model: translationModel });
}

/** --adopt の前提: ja にある翻訳対象フィールドが翻訳側にもすべて揃っていること。 */
function adoptErrors(item) {
  const spec = COLLECTIONS[item.collection];
  const missing = spec.fields.filter((p) => {
    const src = getPath(item.source.data, p);
    const dst = getPath(item.target.data, p);
    return (
      typeof src === 'string' && src.trim() !== '' && (typeof dst !== 'string' || dst.trim() === '')
    );
  });
  const errors = missing.map((p) => `${p} が翻訳されていません`);
  const srcTags = item.source.data.tags ?? [];
  const dstTags = item.target.data.tags ?? [];
  if (spec.translateTags && srcTags.length !== dstTags.length)
    errors.push('tags の要素数が ja と一致しません');
  return errors;
}

function adoptText(item, now) {
  const errors = adoptErrors(item);
  if (errors.length > 0) throw new Error(errors.join(' / '));
  const hash = computeSourceHash(item.collection, item.source.data, item.source.body);
  return rebuild(item, { hash, translatedAt: now().toISOString(), model: ADOPTED_MODEL_LABEL });
}

async function applySync(item, action, ctx) {
  try {
    const text = action === 'adopt' ? adoptText(item, ctx.now) : resyncText(item);
    await writeChecked(item, text, ctx);
    return { item, action, ok: true };
  } catch (err) {
    return { item, action, ok: false, error: err.message };
  }
}

/** 削除してよいかは planWrite（prune.mjs）で判定済み。ここでは消すだけ。 */
async function applyPrune(item, ctx) {
  try {
    if (!ctx.dryRun) await ctx.removeFile(item.targetPath);
    return { item, action: 'prune', ok: true };
  } catch (err) {
    return { item, action: 'prune', ok: false, error: err.message };
  }
}

async function applyTranslate(item, ctx) {
  ctx.out.info(`… 翻訳中 ${item.collection}/${item.slug} [${item.lang}]（${item.status}）`);
  try {
    const { text } = await translateDocument({
      collection: item.collection,
      lang: item.lang,
      source: item.source,
      client: ctx.client,
      now: ctx.now,
      attempts: ctx.config.maxValidationAttempts,
    });
    await writeChecked(item, text, ctx);
    return { item, action: 'translate', ok: true };
  } catch (err) {
    return { item, action: 'translate', ok: false, error: ctx.redact(err.message) };
  }
}

function reportResults(results, skipped, out) {
  for (const r of results) {
    const where = `${r.item.collection}/${r.item.slug} [${r.item.lang}]`;
    if (r.ok) out.info(`✓ ${r.action} ${where}`);
    else out.error(`✗ ${r.action} ${where}: ${r.error}`);
  }
  for (const { item, reason } of skipped)
    out.error(`- skip ${item.collection}/${item.slug} [${item.lang}]（${item.status}）: ${reason}`);
  const failed = results.filter((r) => !r.ok).length;
  out.info(`結果: 成功 ${results.length - failed} / 失敗 ${failed} / 未処理 ${skipped.length}`);
  return failed === 0 && skipped.length === 0 ? 0 : 1;
}

const skipOf = (item) => ({ item, reason: itemHint(item) ?? HINTS[item.status] });

/**
 * --write の作業計画。skipped は { item, reason }（処理しなかった理由つき。終了コード 1 になる）。
 * @param {{ items: object[], langs: string[], sourceCounts: object, targetCounts: object }} plan
 */
export function planWrite(plan, { retranslateUntracked, pruneUntracked, maxPruneRatio }) {
  const { items } = plan;
  const translateStatuses = new Set([
    'missing',
    'stale',
    'invalid',
    ...(retranslateUntracked ? ['untracked'] : []),
  ]);
  const orphans = items
    .filter((i) => i.status === 'orphan')
    .map((item) => ({ item, ...orphanDecision(item, { pruneUntracked }) }));
  const { prune, blocked } = capPrunes(
    orphans.filter((o) => o.prune).map((o) => o.item),
    plan,
    maxPruneRatio
  );
  return {
    translate: items.filter((i) => translateStatuses.has(i.status)),
    resync: items.filter((i) => i.status === 'meta-drift'),
    prune,
    skipped: [
      ...items.filter((i) => i.status === 'untracked' && !retranslateUntracked).map(skipOf),
      ...items.filter((i) => i.status === 'source-error').map(skipOf),
      ...orphans.filter((o) => !o.prune).map(({ item, reason }) => ({ item, reason })),
      ...blocked,
    ],
  };
}

function printPlan(work, out) {
  const rows = [
    ...work.resync.map((i) => ['resync', i]),
    ...work.prune.map((i) => ['prune', i]),
    ...work.translate.map((i) => ['translate', i]),
  ];
  rows.forEach(([action, i]) =>
    out.info(`(dry-run) ${action} ${i.collection}/${i.slug} [${i.lang}]（${i.status}）`)
  );
  work.skipped.forEach(({ item: i, reason }) =>
    out.info(`(dry-run) skip ${i.collection}/${i.slug} [${i.lang}]（${i.status}）: ${reason}`)
  );
  out.info(
    `(dry-run) 翻訳 ${work.translate.length} / 同期 ${work.resync.length} / 削除 ${work.prune.length} / 未処理 ${work.skipped.length}`
  );
}

/**
 * @param {{ plan: { items: object[], langs: string[], sourceCounts: object, targetCounts: object },
 *           retranslateUntracked: boolean, pruneUntracked: boolean,
 *           ctx: { dryRun: boolean, out: object, now: () => Date, config: object, redact: (s: string) => string,
 *                  createClient: () => Promise<object>, writeFile: Function, removeFile: Function } }} args
 */
export async function runWrite({ plan, retranslateUntracked, pruneUntracked = false, ctx }) {
  const work = planWrite(plan, {
    retranslateUntracked,
    pruneUntracked,
    maxPruneRatio: ctx.config.maxPruneRatio,
  });
  if (ctx.dryRun) {
    printPlan(work, ctx.out);
    return 0;
  }
  // API キー不足などはファイルに触る前に失敗させる。
  const client = work.translate.length > 0 ? await ctx.createClient() : null;
  const synced = [];
  for (const item of work.resync) synced.push(await applySync(item, 'resync', ctx));
  for (const item of work.prune) synced.push(await applyPrune(item, ctx));
  const translated = await mapWithConcurrency(work.translate, ctx.config.concurrency, (item) =>
    applyTranslate(item, { ...ctx, client })
  );
  return reportResults([...synced, ...translated], work.skipped, ctx.out);
}

/**
 * 来歴の無い旧翻訳を「今の ja の訳」として採用する。--since の差分で ja が変わった記事は拒否する
 * （旧翻訳は変更前の ja の訳なので、採用すると古い訳が最新扱いで確定してしまう。M3）。
 */
export async function runAdopt({ plan, ctx }) {
  const untracked = plan.items.filter((i) => i.status === 'untracked');
  const targets = untracked.filter((i) => !sourceChangedInDiff(i));
  const refused = untracked.filter(sourceChangedInDiff).map(skipOf);
  const others = plan.items.filter((i) => i.status !== 'untracked' && i.status !== 'ok');
  if (ctx.dryRun) {
    targets.forEach((i) => ctx.out.info(`(dry-run) adopt ${i.collection}/${i.slug} [${i.lang}]`));
    refused.forEach(({ item: i, reason }) =>
      ctx.out.info(`(dry-run) refuse ${i.collection}/${i.slug} [${i.lang}]: ${reason}`)
    );
    ctx.out.info(`(dry-run) 採用 ${targets.length} 件 / 拒否 ${refused.length} 件`);
    return 0;
  }
  const results = [];
  for (const item of targets) results.push(await applySync(item, 'adopt', ctx));
  if (others.length > 0) ctx.out.info(`（--adopt の対象外で未解決: ${summaryLine(others)}）`);
  return reportResults(results, refused, ctx.out);
}

export const removeFile = (file) => rm(file);
