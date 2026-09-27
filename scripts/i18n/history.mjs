/**
 * git の履歴から「来歴の無い旧翻訳を、今の ja の訳として採用してよいか」を判定する（--adopt の安全装置）。
 *
 * PR #339 再レビュー MEDIUM-2: --since の差分があるときだけ拒否していたため、mode=adopt や移行手順
 * （--since を渡さない）では、ja を編集した後の古い訳が「今の ja の訳」として確定していた。
 * ja の最後の変更が、翻訳の最後の変更の履歴に含まれている（同じコミットか祖先）なら採用してよい。
 * それ以外（ja が後から変わった・並行して変わった）や、判定できないとき（git の履歴が無い・浅い clone・
 * ja にコミットしていない変更がある・どちらかが未コミット）は拒否する。上書きは --force-adopt だけ。
 */
import { execFileSync } from 'node:child_process';

export function defaultRunGit(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
}

/**
 * @param {{ root: string, runGit?: (cwd: string, args: string[]) => string }} options
 * @returns {(item: { sourcePath: string, targetPath: string }) => string | null}
 *   採用を拒否する理由（採用してよければ null）を返す関数
 */
export function createAdoptionGuard({ root, runGit = defaultRunGit }) {
  const git = (...args) => runGit(root, args).trim();
  let repoProblem;
  const checkRepo = () => {
    if (repoProblem !== undefined) return repoProblem;
    try {
      repoProblem =
        git('rev-parse', '--is-shallow-repository') === 'true'
          ? '浅い clone（shallow）のため、ja と翻訳の新旧を判定できません（fetch-depth: 0 で取得してください）'
          : null;
    } catch {
      repoProblem = 'git の履歴を読めないため、ja と翻訳の新旧を判定できません';
    }
    return repoProblem;
  };
  const lastCommit = (file) => git('log', '-1', '--format=%H %cs', '--', file);
  const isAncestor = (ancestor, descendant) => {
    try {
      git('merge-base', '--is-ancestor', ancestor, descendant);
      return true;
    } catch (err) {
      if (err.status === 1) return false;
      throw err;
    }
  };

  return ({ sourcePath, targetPath }) => {
    const problem = checkRepo();
    if (problem) return problem;
    if (git('status', '--porcelain', '--', sourcePath) !== '') {
      return 'ja にコミットしていない変更があるため、翻訳との新旧を判定できません';
    }
    const [sourceCommit, sourceDate] = lastCommit(sourcePath).split(' ');
    const [targetCommit, targetDate] = lastCommit(targetPath).split(' ');
    if (!sourceCommit) return 'ja がまだコミットされていないため、翻訳との新旧を判定できません';
    if (!targetCommit) return '翻訳がまだコミットされていないため、ja との新旧を判定できません';
    if (sourceCommit === targetCommit || isAncestor(sourceCommit, targetCommit)) return null;
    return (
      `ja が翻訳より後に変更されています（ja: ${sourceCommit.slice(0, 7)} ${sourceDate}、` +
      `翻訳: ${targetCommit.slice(0, 7)} ${targetDate}）`
    );
  };
}
