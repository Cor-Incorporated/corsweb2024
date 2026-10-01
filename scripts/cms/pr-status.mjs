#!/usr/bin/env node
/**
 * CMS（Sveltia CMS、ADR-0018）が作った PR の状態を、PR のコメントで知らせる。判定と文面は pr-status-core.mjs。
 * .github/workflows/cms-pr-status.yml（workflow_run と、手で知らせ直す workflow_dispatch）から、既定ブランチ（main）の
 * このファイルを動かす。PR のコードは実行しない。PR からは、ブランチ名・チェックと workflow run の結果・ファイル名・
 * コメントだけを読む。リポジトリは gh が決める（GH_REPO、無ければカレントディレクトリの git remote）。
 *
 * 使い方:
 *   node scripts/cms/pr-status.mjs --branch cms/blog/<スラッグ>   # ワークフローから（GH_TOKEN と GH_REPO を使う）
 *   node scripts/cms/pr-status.mjs --pr 367                      # ワークフローの手動実行から
 *   node scripts/cms/pr-status.mjs --pr 367 --dry-run            # 手元で。コメントせず、判定と文面だけを表示する（gh のログインを使う）
 *   node scripts/cms/pr-status.mjs --pr 367 --dry-run --sha <コミット>  # 過去のコミットの状態（ファイルとラベルは今の PR のもの）
 *     翻訳 CI が翻訳を push したコミットの 1 つ前は、i18n-check が新しいコミットに検査を任せて成功で終わるので、翻訳が
 *     そろっていると出る（本番では HEAD だけを判定し、そのコミットはもう HEAD ではないので起きない）
 */
import { execFile } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { parseArgs, promisify } from 'node:util';
import { computeState, renderComment, shouldNotify } from './pr-status-core.mjs';

const exec = promisify(execFile);
const BOT = 'github-actions[bot]';
/** gh が {owner}/{repo} を GH_REPO（無ければ git remote）の値に置き換える */
const REPO_PATH = 'repos/{owner}/{repo}';

/** gh api を呼んで JSON を返す（引数はシェルを通さずに渡す） */
async function ghApi(args) {
  const { stdout } = await exec('gh', ['api', ...args], { maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(stdout);
}

/** リポジトリの API（gh はテストで差し替える）。all は全ページを 1 つの配列にする（--slurp はページの配列を返す） */
const apiOf = (gh) => ({
  get: (path) => gh([`${REPO_PATH}/${path}`]),
  all: async (path, itemsOf = (page) => page) =>
    (await gh(['--paginate', '--slurp', `${REPO_PATH}/${path}`])).flatMap(itemsOf),
  comment: (number, body) => gh(['-X', 'POST', `${REPO_PATH}/issues/${number}/comments`, '-f', `body=${body}`]),
});

const isSameRepo = (pull) => pull.head.repo?.full_name === pull.base.repo.full_name;

/** 開いている PR のうち、このリポジトリのそのブランチのもの（head= の絞り込みは、形が違うと黙って全件を返すので使わない） */
async function findPull(api, { pr, branch }) {
  if (pr) return api.get(`pulls/${pr}`);
  const pulls = await api.all('pulls?state=open&per_page=100');
  return pulls.find((pull) => pull.head.ref === branch && isSameRepo(pull)) ?? null;
}

async function collect(api, pull, sha) {
  const [checkRuns, workflowRuns, files, comments] = await Promise.all([
    api.all(`commits/${sha}/check-runs?per_page=100`, (page) => page.check_runs),
    api.all(`actions/runs?head_sha=${sha}&per_page=100`, (page) => page.workflow_runs),
    api.all(`pulls/${pull.number}/files?per_page=100`),
    api.all(`issues/${pull.number}/comments?per_page=100`),
  ]);
  // 目印の判定は、このワークフロー（github-actions[bot]）のコメントだけで行う（人が目印を書いても通知は止まらない）
  return { checkRuns, workflowRuns, files, botComments: comments.filter((comment) => comment.user?.login === BOT) };
}

/** 判定のあいだに CMS で保存し直されていないか（まだ開いていて、HEAD が同じか）。変わっていれば新しいコミットの実行が知らせる */
async function isStillHead(api, pull, sha) {
  const latest = await api.get(`pulls/${pull.number}`);
  return latest.state === 'open' && latest.head.sha === sha;
}

export function parseOptions(args) {
  const { values } = parseArgs({
    args,
    options: {
      pr: { type: 'string' },
      branch: { type: 'string' },
      sha: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
  });
  if (values.sha && !values['dry-run']) throw new Error('--sha は --dry-run のときだけ使えます');
  if (values.pr !== undefined && !/^[1-9][0-9]*$/.test(values.pr)) throw new Error(`--pr には PR の番号を渡してください（${values.pr}）`);
  if (!values.pr && !values.branch) throw new Error('--pr <番号> か --branch <ブランチ名> を渡してください');
  return values;
}

/** 1 つの PR の状態を判定し、知らせる場面ならコメントする（--dry-run では表示だけ）。進み具合は out に 1 行ずつ渡す */
export async function run(args, { gh = ghApi, out = (line) => process.stdout.write(`${line}\n`) } = {}) {
  const options = parseOptions(args);
  const api = apiOf(gh);
  const pull = await findPull(api, options);
  if (!pull) return out(`${options.branch}: 開いている PR が無いので、何もしません`);
  if (!isSameRepo(pull) || !pull.head.ref.startsWith('cms/') || (pull.state !== 'open' && !options['dry-run'])) {
    return out(`#${pull.number}: 開いている CMS の PR（このリポジトリの cms/ ブランチ）ではないので、何もしません`);
  }
  const sha = options.sha ?? pull.head.sha;
  const { botComments, ...observed } = await collect(api, pull, sha);
  const result = computeState({ ...observed, prNumber: pull.number });
  const notify = shouldNotify(botComments, result.state, sha);
  out(`#${pull.number} ${sha.slice(0, 7)} state=${result.state} notify=${notify}`);
  if (!notify) return undefined;
  const body = renderComment({ result, sha, isDraft: pull.labels.some((label) => label.name === 'sveltia-cms/draft') });
  if (options['dry-run']) return out(body);
  if (!(await isStillHead(api, pull, sha))) {
    return out(`#${pull.number}: 判定のあいだに PR が更新されたので、コメントしません（新しいコミットのチェックが終わったときに知らせます）`);
  }
  await api.comment(pull.number, body);
  return out(`#${pull.number} にコメントしました（${result.state}）`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.stack ?? error}\n`);
    process.exitCode = 1;
  });
}
