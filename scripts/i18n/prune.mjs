/**
 * ja の無い翻訳（orphan）を削除してよいかの判定（ADR-0019 / レビュー指摘 M1）。
 *
 * 1. --since（PR の差分）で実行したときは、その差分で ja の削除が確認できた記事だけを消す。
 *    PR で翻訳だけを追加した記事（ja が一度も無い）は消さない。
 * 2. 来歴（translationSourceHash）の無い翻訳は --prune-untracked を明示したときだけ消す。
 *    人が整えた旧翻訳を、ja の改名・削除だけで失わないため。
 * 3. コレクションごとの削除件数に上限を置く（翻訳ファイル数 × I18N_MAX_PRUNE_RATIO、
 *    最低でも記事 1 本分 = 対象言語数）。超えたらそのコレクションでは 1 件も消さない。
 *    ja ディレクトリが空のときも 1 件も消さない。
 * 消さなかった orphan は失敗として報告する（終了コード 1）。
 */
import { hasProvenance } from './plan.mjs';

export const PRUNE_REASONS = Object.freeze({
  notDeletedInDiff:
    'ja が無いのに翻訳があり、ja の削除が差分にありません（翻訳だけを追加した可能性）' +
    ' → ja を追加するか、この翻訳ファイルを削除してください',
  untracked:
    '来歴のない翻訳は自動では削除しません → 削除してよければ `npm run i18n:translate -- --prune-untracked`',
  emptySource: 'ja ディレクトリが空のため削除を中止しました（安全装置）',
});

/**
 * @param {{ sourceDiff: string | null, target: object }} item status が orphan の項目
 * @returns {{ prune: true } | { prune: false, reason: string }}
 */
export function orphanDecision(item, { pruneUntracked }) {
  if (item.sourceDiff !== null && item.sourceDiff !== 'deleted') {
    return { prune: false, reason: PRUNE_REASONS.notDeletedInDiff };
  }
  if (!hasProvenance(item.target) && !pruneUntracked) {
    return { prune: false, reason: PRUNE_REASONS.untracked };
  }
  return { prune: true };
}

/** コレクションで一度に消してよい件数。 */
export function pruneAllowance(targetCount, langCount, maxRatio) {
  return Math.max(langCount, Math.floor(targetCount * maxRatio));
}

/**
 * 削除候補をコレクションごとに上限と照合する。
 * @param {object[]} candidates orphanDecision が prune: true を返した項目
 * @param {{ langs: string[], sourceCounts: Record<string, number>, targetCounts: Record<string, number> }} plan
 * @returns {{ prune: object[], blocked: { item: object, reason: string }[] }}
 */
export function capPrunes(candidates, plan, maxRatio) {
  const prune = [];
  const blocked = [];
  const collections = [...new Set(candidates.map((i) => i.collection))];
  for (const collection of collections) {
    const group = candidates.filter((i) => i.collection === collection);
    const total = plan.targetCounts[collection] ?? 0;
    const allowance = pruneAllowance(total, plan.langs.length, maxRatio);
    let reason = null;
    if (!plan.sourceCounts[collection]) {
      reason = PRUNE_REASONS.emptySource;
    } else if (group.length > allowance) {
      reason =
        `削除が多すぎるため中止しました（${collection}: ${group.length} 件 / 翻訳 ${total} 件、` +
        `上限 ${allowance} 件）。意図した削除なら I18N_MAX_PRUNE_RATIO を上げて再実行してください`;
    }
    if (reason) blocked.push(...group.map((item) => ({ item, reason })));
    else prune.push(...group);
  }
  return { prune, blocked };
}
