#!/usr/bin/env node
/**
 * CMS（Sveltia CMS、ADR-0018）が作った PR の状態を、PR のコメントで知らせる。判定と文面は pr-status-core.mjs。
 * .github/workflows/cms-pr-status.yml（workflow_run）から、既定ブランチ（main）のこのファイルを動かす。
 * PR のコードは実行しない。PR からは、ブランチ名・チェックの結果・ファイル名・コメントだけを読む。
 *
 * 使い方:
 *   node scripts/cms/pr-status.mjs --branch cms/blog/<スラッグ>   # ワークフローから（GH_TOKEN と GITHUB_REPOSITORY を使う）
 *   node scripts/cms/pr-status.mjs --pr 367 --dry-run             # 手元で。コメントせず、判定と文面だけを表示する（gh のログインを使う）
 *   node scripts/cms/pr-status.mjs --pr 367 --dry-run --sha <コミット>  # 手元で、PR の過去のコミットの状態を見る（--dry-run のときだけ）
 */
import { execFile } from 'node:child_process';
import { parseArgs, promisify } from 'node:util';
import { computeState, renderComment, shouldNotify, translationsOf } from './pr-status-core.mjs';

const exec = promisify(execFile);
const REPO = process.env.GITHUB_REPOSITORY || 'Cor-Incorporated/corsweb2024';
const BOT = 'github-actions[bot]';
const out = (line) => process.stdout.write(`${line}\n`);

/** gh api を呼んで JSON を返す（引数はシェルを通さずに渡す） */
async function gh(args) {
  const { stdout } = await exec('gh', ['api', ...args], { maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(stdout);
}
/** 全ページを取得する（ページごとの結果の配列） */
const allPages = (path) => gh(['--paginate', '--slurp', path]);

async function findPull({ pr, branch }) {
  if (pr) return gh([`repos/${REPO}/pulls/${pr}`]);
  const owner = REPO.split('/')[0];
  const pulls = await gh([`repos/${REPO}/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}`]);
  return pulls[0] ?? null;
}

async function collect(pull, sha) {
  const [checkPages, runPages, filePages, commentPages] = await Promise.all([
    allPages(`repos/${REPO}/commits/${sha}/check-runs?per_page=100`),
    allPages(`repos/${REPO}/actions/runs?head_sha=${sha}&per_page=100`),
    allPages(`repos/${REPO}/pulls/${pull.number}/files?per_page=100`),
    allPages(`repos/${REPO}/issues/${pull.number}/comments?per_page=100`),
  ]);
  return {
    sha,
    checkRuns: checkPages.flatMap((page) => page.check_runs),
    workflowRuns: runPages.flatMap((page) => page.workflow_runs),
    files: filePages.flat(),
    // 目印の判定は、このワークフロー（github-actions[bot]）のコメントだけで行う（人が目印を書いても通知は止まらない）
    botComments: commentPages.flat().filter((comment) => comment.user?.login === BOT),
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      pr: { type: 'string' },
      branch: { type: 'string' },
      sha: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
  });
  if (values.sha && !values['dry-run']) throw new Error('--sha は --dry-run のときだけ使えます');
  if (!values.pr && !values.branch?.startsWith('cms/')) {
    throw new Error('--pr <番号> か、cms/ で始まる --branch を渡してください');
  }
  const pull = await findPull(values);
  if (!pull) return out(`${values.branch}: 開いている PR が無いので、何もしません`);
  if (pull.head.repo?.full_name !== REPO || !pull.head.ref.startsWith('cms/')) {
    return out(`#${pull.number}: CMS の PR（このリポジトリの cms/ ブランチ）ではないので、何もしません`);
  }
  const { sha, checkRuns, workflowRuns, files, botComments } = await collect(pull, values.sha ?? pull.head.sha);
  const result = computeState({ checkRuns, workflowRuns });
  const notify = shouldNotify(botComments, result.state, sha);
  out(`#${pull.number} ${sha.slice(0, 7)} state=${result.state} notify=${notify}`);
  if (!notify) return undefined;
  const isDraft = pull.labels.some((label) => label.name === 'sveltia-cms/draft');
  const body = renderComment({ result, sha, translations: translationsOf(files), isDraft });
  if (values['dry-run']) return out(body);
  await gh(['-X', 'POST', `repos/${REPO}/issues/${pull.number}/comments`, '-f', `body=${body}`]);
  return out(`#${pull.number} にコメントしました（${result.state}）`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
