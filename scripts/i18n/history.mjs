/**
 * git の履歴から「来歴の無い旧翻訳を、今の ja の訳として採用してよいか」を判定する（--adopt の安全装置）。
 *
 * PR #339 再レビュー MEDIUM-2: --since の差分があるときだけ拒否していたため、mode=adopt や移行手順
 * （--since を渡さない）では、ja を編集した後の古い訳が「今の ja の訳」として確定していた。
 * ja の最後のコミットが、翻訳を最後に作成・訳し直したコミットの履歴に含まれている（同じコミットか祖先）なら
 * 採用してよい。それ以外（ja が後から変わった・並行して変わった）や、判定できないとき（git の履歴が無い・
 * 浅い clone・ja にコミットしていない変更がある・どちらかが未コミット）は拒否する。上書きは --force-adopt だけ。
 *
 * #339 最終レビュー LOW-3: 以前は「翻訳への最後の変更」と比べていたため、ja を編集した後に翻訳へ触るだけの
 * コミットがあると、古い訳を採用していた。次の変更は訳し直しとみなさない（その前の作成・訳し直しと比べる）:
 *   - 改名（ja と翻訳を同じコミットで改名した場合を含む）
 *   - 社名の表記と空白だけの変更（旧表記の一括置換。Issue #350）
 * 「翻訳を追加したコミット」とだけ比べると、ja の更新の後に実際に訳し直した旧翻訳（2026-09-28 時点で
 * blog の en 7 件。2025-08-02 f7c382e の ja 更新の後、2025-09-25 fd41f30 で訳し直し）まで拒否するため、
 * 中身の変わった変更は訳し直しとして扱う。安全側に倒すので、ja の改名（中身は同じ）は「ja の変更」として拒否する
 * （確かめたうえで --force-adopt）。
 */
import { execFileSync } from 'node:child_process';
import { OUTPUT_NAME_PATTERN } from './glossary.mjs';

export function defaultRunGit(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** 訳し直しかどうかを比べる形: 社名の表記（正式・表記ゆれ）と空白の違いを無視する。 */
function comparable(text) {
  return text.replace(OUTPUT_NAME_PATTERN, '⟦ORG⟧').replace(/\s+/g, ' ').trim();
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
  const contentAt = (rev, file) => {
    try {
      return runGit(root, ['show', `${rev}:${file}`]);
    } catch {
      return null; // その時点に無い（比べられないので、訳し直しとして扱う）
    }
  };
  /**
   * 翻訳を最後に作成・訳し直したコミット（"<sha> <date>"。見つからなければ ''）。
   * 新しい順にたどり、改名（R）と、社名の表記・空白だけの変更は読み飛ばす。作成（A）と複製（C）で止める:
   * --follow は同じ内容の別ファイルを複製元とみなしてその履歴へ移るので、C もこのファイルの作成として扱う。
   */
  const translatedCommit = (file) => {
    const log = git('log', '--follow', '--name-status', '--format=%x00%H %cs', '--', file);
    for (const entry of log.split('\0').filter(Boolean)) {
      const [header, ...changes] = entry.split('\n').filter(Boolean);
      const change = changes.at(-1);
      if (!change) continue; // マージ（変更の行が無い）
      const [status, from, to = from] = change.split('\t');
      if (status === 'A' || status.startsWith('C')) return header;
      const sha = header.split(' ')[0];
      const before = contentAt(`${sha}^`, from);
      const after = contentAt(sha, to);
      if (before === null || after === null || comparable(before) !== comparable(after)) return header;
    }
    return '';
  };
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
    const [targetCommit, targetDate] = translatedCommit(targetPath).split(' ');
    if (!sourceCommit) return 'ja がまだコミットされていないため、翻訳との新旧を判定できません';
    if (!targetCommit) return '翻訳がまだコミットされていないため、ja との新旧を判定できません';
    if (sourceCommit === targetCommit || isAncestor(sourceCommit, targetCommit)) return null;
    return (
      `ja が翻訳より後に変更されています（ja の最後のコミット: ${sourceCommit.slice(0, 7)} ${sourceDate}、` +
      `翻訳を最後に作成・訳し直したコミット: ${targetCommit.slice(0, 7)} ${targetDate}）`
    );
  };
}
