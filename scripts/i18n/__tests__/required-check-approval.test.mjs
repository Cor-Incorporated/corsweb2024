// @vitest-environment node
/**
 * 翻訳コミットの後に、人の承認なしで必須チェックがそろうことの照合（2026-10-25）。
 *
 * GITHUB_TOKEN で翻訳コミットを push すると、その上の pull_request の実行は承認待ち（action_required）になり、
 * develop の必須チェックがそろわず merge できない。translate-content.yml の approve-checks が、その実行を同じ
 * GITHUB_TOKEN で承認する。ここでは次を照合する。
 * 1. docs/i18n-translation.md に書いた develop の必須チェックは、どれも approve-checks が待つワークフロー
 *    （REQUIRED_WORKFLOWS）のジョブ名で、そのワークフローは develop 宛ての PR の pull_request で動く
 *    （paths で絞ると翻訳コミットの上で実行が作られず、approve-checks は 3 分待って赤になる）
 * 2. REQUIRED_WORKFLOWS に、必須チェックを出さないワークフローが残っていない
 * 3. 必須チェックを workflow_dispatch で起動し直さない。workflow_dispatch の実行のチェックは、success でも PR の
 *    必須チェックとして数えられない（GitHub Docs「Troubleshooting required status checks」。2026-10-25 に PR #405 で
 *    実測: dispatch した 4 本はすべて success だったが、PR は BLOCKED のままだった）
 * 4. approve-checks のスクリプトを、偽の gh で実際に動かす。承認するのは翻訳コミット（head_sha）・pull_request・
 *    このリポジトリ・この PR の head ブランチの承認待ちの実行だけで、外れた実行は承認しない。このワークフローの実行は
 *    最後に承認する（承認すると concurrency でこの実行が取り消されるため）。承認の失敗・一覧の取得の失敗・承認後も
 *    承認待ちのままの実行は赤にする。人が新しいコミットを積んでいたら承認しない
 * 5. 翻訳コミット（github-actions[bot] の push）の実行では訳さない（承認 → 翻訳 → push → 承認の繰り返しを止める）
 * 6. PR での翻訳の上限（I18N_MAX_ITEMS）が、全記事 × 4 言語より大きい（全記事を直す PR でも 1 回で訳せる）
 */
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { afterEach, describe, expect, it } from 'vitest';
import { COLLECTION_NAMES, CONTENT_ROOT, SOURCE_LANG, TARGET_LANGS } from '../config.mjs';
import { removeTempDir } from './helpers.mjs';

const root = path.resolve(import.meta.dirname, '../../..');
const readWorkflow = (file) => yaml.load(readFileSync(path.join(root, file), 'utf8'));

const TRANSLATE_WORKFLOW = '.github/workflows/translate-content.yml';
const translate = readWorkflow(TRANSLATE_WORKFLOW);
const approveJob = translate.jobs['approve-checks'];
const requiredWorkflows = (approveJob?.env?.REQUIRED_WORKFLOWS ?? '').split(/\s+/).filter(Boolean);

/** docs の「develop: required checks は `a` / `b` / `c`」から必須チェックの名前を読む */
function developRequiredChecks() {
  const docs = readFileSync(path.join(root, 'docs/i18n-translation.md'), 'utf8');
  const line = docs.split('\n').find((l) => /develop: required checks は/.test(l));
  if (!line) return [];
  const listed = line.split('required checks は')[1].split('、')[0];
  return [...listed.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
}

// js-yaml は `on:` を真偽値 true のキーとして読む
const triggersOf = (workflow) => workflow.on ?? workflow[true] ?? {};
const jobNames = (workflow) => Object.entries(workflow.jobs).map(([id, job]) => job.name ?? id);

/** develop 宛ての PR に push したとき（synchronize）に、paths で絞られずに動くか */
function runsOnDevelopSynchronize(workflow) {
  const pr = triggersOf(workflow).pull_request;
  if (pr === undefined) return { pullRequest: false };
  const filter = pr ?? {};
  return {
    pullRequest: true,
    branches: !filter.branches || filter.branches.includes('develop'),
    types: !filter.types || filter.types.includes('synchronize'),
    paths: !filter.paths && !filter['paths-ignore'],
  };
}

describe('翻訳コミットの後の必須チェック（approve-checks）', () => {
  const required = developRequiredChecks();

  it('docs に develop の必須チェックが書いてあり、approve-checks が待つワークフローがある', () => {
    expect(required.length).toBeGreaterThan(0);
    expect(requiredWorkflows.length).toBeGreaterThan(0);
  });

  it.each(required)('必須チェック「%s」を出すワークフローを approve-checks が待つ', (check) => {
    const owners = requiredWorkflows.filter((file) => jobNames(readWorkflow(file)).includes(check));
    expect({ check, owners }).not.toEqual({ check, owners: [] });
    for (const file of owners) {
      expect({ file, ...runsOnDevelopSynchronize(readWorkflow(file)) }).toEqual({
        file,
        pullRequest: true,
        branches: true,
        types: true,
        paths: true,
      });
    }
  });

  it.each(requiredWorkflows)('approve-checks が待つ %s は、必須チェックを出すワークフロー', (file) => {
    expect({ file, exists: existsSync(path.join(root, file)) }).toEqual({ file, exists: true });
    const owned = jobNames(readWorkflow(file)).filter((name) => required.includes(name));
    expect({ file, owned }).not.toEqual({ file, owned: [] });
  });

  it('必須チェックを workflow_dispatch で起動し直さない（その結果は PR の必須チェックに数えられない）', () => {
    const scripts = Object.entries(translate.jobs).flatMap(([name, job]) =>
      job.steps
        .filter((s) => s.run)
        .map((s) => ({ job: name, dispatches: /gh workflow run|\/dispatches\b/.test(s.run) }))
    );
    expect(scripts.filter((s) => s.dispatches)).toEqual([]);
  });

  it('翻訳コミット（github-actions[bot] の push）の実行では訳さない', () => {
    expect(translate.jobs.translate.if).toContain("github.actor != 'github-actions[bot]'");
  });

  it('approve-checks は translate-result の後に動く（自分の実行が取り消される前に、翻訳の失敗を知らせる）', () => {
    expect(approveJob.needs).toEqual(expect.arrayContaining(['push', 'translate-result']));
  });
});

// ---- approve-checks のスクリプトを偽の gh で動かす ----------------------------------------------
const approveScript = approveJob?.steps.find((s) => s.name === 'Approve the pull_request runs of the translation commit')?.run;
const COMMIT = 'c'.repeat(40);
const OTHER_COMMIT = 'd'.repeat(40);
const HEAD_REF = 'feat/example';
const REPOSITORY = 'owner/repo';
const run = (id, workflow, conclusion, overrides = {}) => ({
  id,
  path: `.github/workflows/${workflow}`,
  conclusion,
  head_sha: COMMIT,
  event: 'pull_request',
  head_branch: HEAD_REF,
  head_repository: { full_name: REPOSITORY },
  ...overrides,
});

// GET の問い合わせの URL を記録し、--jq の式を jq でフィクスチャに当てる。フィクスチャは、承認の前は呼ばれた回数目の
// 一覧（最後のものを使い続ける）、承認の後は after.json、PR の head ブランチの最新の実行の問い合わせ（branch=）は
// latest.json。FAIL_GET_AT 回目の GET は失敗する。POST の approve は ID を記録し、FAIL_IDS の ID なら失敗する。
// sleep は待たず、date +%s は呼ぶたびに 60 秒進む
const FAKE_GH = `#!/usr/bin/env bash
set -euo pipefail
if [ "$1 $2 $3" = "api -X POST" ]; then
  id="$(basename "$(dirname "$4")")"
  echo "$id" >> "$WORK/approved"
  case " \${FAIL_IDS:-} " in *" $id "*) echo "HTTP 403: Resource not accessible by integration" >&2; exit 1 ;; esac
  exit 0
fi
[ "$1 $3" = "api --jq" ] || { echo "unexpected gh call: $*" >&2; exit 2; }
echo "$2" >> "$WORK/gets"
n="$(wc -l < "$WORK/gets" | tr -d ' ')"
[ "$n" != "\${FAIL_GET_AT:-}" ] || { echo "HTTP 502: Bad Gateway" >&2; exit 1; }
case "$2" in
  *branch=*) fixture="$WORK/latest.json" ;;
  *)
    if [ -f "$WORK/approved" ]; then
      fixture="$WORK/after.json"
    else
      k="$(grep -vc 'branch=' "$WORK/gets")"
      [ "$k" -le "$FIXTURES" ] || k="$FIXTURES"
      fixture="$WORK/runs-$k.json"
    fi
    ;;
esac
jq -r "$4" "$fixture"
`;
const FAKE_SLEEP = '#!/usr/bin/env bash\nexit 0\n';
const FAKE_DATE = `#!/usr/bin/env bash
n=$(( $(cat "$WORK/clock" 2>/dev/null || echo 0) + 60 ))
echo "$n" > "$WORK/clock"
echo "$n"
`;

let work;
afterEach(async () => work && removeTempDir(work));

const readLines = async (file) =>
  existsSync(file) ? (await readFile(file, 'utf8')).split('\n').filter(Boolean) : [];

/**
 * bash でスクリプトを動かし、終了コードと出力を返す。spawnSync は使わない: 終わるまで vitest の worker の
 * event loop が止まり、負荷が高いと vitest の RPC が時間切れになる（2026-10-25 に `Timeout calling "onTaskUpdate"`）
 */
function runBash(script, env) {
  return new Promise((resolve, reject) => {
    const child = spawn('bash', ['-e', '-c', script], { env });
    let out = '';
    child.stdout.on('data', (chunk) => (out += chunk));
    child.stderr.on('data', (chunk) => (out += chunk));
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, out }));
  });
}

/**
 * fixtures（承認の前の GET の回数目ごとの実行の一覧）で approve-checks を動かし、終了コード・出力・承認した ID・
 * GET の URL を返す。after（承認の後の一覧）を省くと、最後の一覧の承認待ちのうち FAIL_IDS 以外を、承認済み
 * （conclusion なし）にしたものにする
 */
async function runApprove(fixtures, { baseRef = 'develop', failIds = [], failGetAt = '', latestSha = COMMIT, after } = {}) {
  work = await mkdtemp(path.join(os.tmpdir(), 'i18n-approve-'));
  const bin = path.join(work, 'bin');
  await mkdir(bin);
  for (const [name, body] of [['gh', FAKE_GH], ['sleep', FAKE_SLEEP], ['date', FAKE_DATE]]) {
    await writeFile(path.join(bin, name), body);
    await chmod(path.join(bin, name), 0o755);
  }
  const write = (name, runs) => writeFile(path.join(work, name), JSON.stringify({ workflow_runs: runs }));
  for (const [i, runs] of fixtures.entries()) await write(`runs-${i + 1}.json`, runs);
  const last = fixtures.at(-1);
  const approvedAfter = last.map((r) =>
    r.conclusion === 'action_required' && !failIds.includes(r.id) ? { ...r, conclusion: null } : r
  );
  await write('after.json', after ?? approvedAfter);
  await write('latest.json', [{ head_sha: latestSha }]);
  const result = await runBash(approveScript, {
    PATH: `${bin}:${process.env.PATH}`,
    WORK: work,
    FIXTURES: String(fixtures.length),
    FAIL_IDS: failIds.join(' '),
    FAIL_GET_AT: String(failGetAt),
    GITHUB_REPOSITORY: REPOSITORY,
    GH_TOKEN: 'test-token',
    ...approveJob.env,
    COMMIT,
    HEAD_REF,
    BASE_REF: baseRef,
    PR_NUMBER: '999',
  });
  return {
    status: result.status,
    out: result.out,
    approved: (await readLines(path.join(work, 'approved'))).map(Number),
    gets: await readLines(path.join(work, 'gets')),
  };
}

const ALL_PENDING = [
  run(1, 'translate-content.yml', 'action_required'),
  run(2, 'ci.yml', 'action_required'),
  run(3, 'visual-text.yml', 'action_required'),
  run(4, 'h5-admission.yml', 'action_required'),
  run(5, 'deploy.yml', 'action_required'),
];

describe('approve-checks のスクリプト（偽の gh で実行）', () => {
  it('ワークフローの定義からスクリプトを取り出せる', () => {
    expect(approveScript).toEqual(expect.any(String));
  });

  it('承認待ちの実行をすべて承認し、このワークフローの実行は最後に承認する', async () => {
    const { status, out, approved } = await runApprove([ALL_PENDING]);
    expect({ status, approved }).toEqual({ status: 0, approved: [2, 3, 4, 5, 1] });
    expect(out).toContain(`翻訳コミット ${COMMIT} の承認待ちの実行を承認しました（run: 2 3 4 5、最後に 1）`);
  });

  it('実行の一覧は、翻訳コミットの head_sha と pull_request で問い合わせる', async () => {
    const { gets } = await runApprove([ALL_PENDING]);
    const lists = gets.filter((url) => !url.includes('branch='));
    expect(lists.length).toBeGreaterThan(0);
    for (const url of lists) {
      expect({ url, headSha: url.includes(`head_sha=${COMMIT}`), event: url.includes('event=pull_request') }).toEqual({
        url,
        headSha: true,
        event: true,
      });
    }
    expect(gets.filter((url) => url.includes('branch='))).toEqual([
      expect.stringContaining(`branch=${HEAD_REF}&event=pull_request`),
    ]);
  });

  // 陰性テスト: 問い合わせの条件が外れて、ほかの実行が一覧に混ざっても、翻訳コミットの実行だけを承認する
  it('別のコミット・別のイベント・fork・別のブランチの承認待ちの実行は承認しない', async () => {
    const runs = [
      ...ALL_PENDING,
      run(11, 'ci.yml', 'action_required', { head_sha: OTHER_COMMIT }),
      run(12, 'visual-text.yml', 'action_required', { event: 'pull_request_target' }),
      run(13, 'h5-admission.yml', 'action_required', { head_repository: { full_name: 'someone/fork' } }),
      run(14, 'deploy.yml', 'action_required', { head_branch: 'other-branch' }),
      run(15, 'translate-content.yml', 'action_required', { head_sha: OTHER_COMMIT }),
    ];
    const { status, approved } = await runApprove([runs]);
    expect({ status, approved }).toEqual({ status: 0, approved: [2, 3, 4, 5, 1] });
  });

  it('承認待ちでない実行は承認しない', async () => {
    const runs = [
      run(1, 'translate-content.yml', 'action_required'),
      run(2, 'ci.yml', 'success'),
      run(3, 'visual-text.yml', null), // 実行中（conclusion がまだ無い）
      run(4, 'h5-admission.yml', 'action_required'),
    ];
    const { status, approved } = await runApprove([runs]);
    expect({ status, approved }).toEqual({ status: 0, approved: [4, 1] });
  });

  it('必須チェックとこのワークフローの実行が出そろうまで待ってから承認する', async () => {
    // 偽の date は呼ぶたびに 60 秒進むので、3 分の待ちの間に一覧を 3 回読む。3 回目でこのワークフローの実行が出る
    const { status, approved } = await runApprove([[], ALL_PENDING.slice(1), ALL_PENDING]);
    expect({ status, approved }).toEqual({ status: 0, approved: [2, 3, 4, 5, 1] });
  });

  it('必須チェックのワークフローの実行が 3 分待っても無ければ、何も承認せずに赤になる', async () => {
    const { status, out, approved } = await runApprove([ALL_PENDING.filter((r) => r.id !== 3)]);
    expect({ status, approved }).toEqual({ status: 1, approved: [] });
    expect(out).toContain('3 分待っても作られませんでした: .github/workflows/visual-text.yml');
  });

  it('このワークフローの実行が 3 分待っても無ければ、何も承認せずに赤になる', async () => {
    const { status, out, approved } = await runApprove([ALL_PENDING.filter((r) => r.id !== 1)]);
    expect({ status, approved }).toEqual({ status: 1, approved: [] });
    expect(out).toContain('3 分待っても作られませんでした: .github/workflows/translate-content.yml');
  });

  it('base が develop / main 以外の PR では h5-admission.yml とこのワークフローだけを待つ', async () => {
    const runs = [run(1, 'translate-content.yml', 'action_required'), run(4, 'h5-admission.yml', 'action_required')];
    const { status, approved } = await runApprove([runs], { baseRef: 'feat/parent' });
    expect({ status, approved }).toEqual({ status: 0, approved: [4, 1] });
  });

  it('承認に失敗した実行があれば赤になり、このワークフローの実行は承認しない', async () => {
    const { status, out, approved } = await runApprove([ALL_PENDING], { failIds: [3] });
    expect({ status, approved }).toEqual({ status: 1, approved: [2, 3, 4, 5] });
    expect(out).toContain('承認できなかった実行があります（run: 3 .github/workflows/visual-text.yml）。PR #999 の Checks');
  });

  it('承認する前の一覧の取得に失敗したら、何も承認せずに赤になる', async () => {
    // 1 回目は待つ間の一覧、2 回目は承認に使う一覧
    const { status, approved } = await runApprove([ALL_PENDING], { failGetAt: 2 });
    expect({ failed: status !== 0, approved }).toEqual({ failed: true, approved: [] });
  });

  it('承認の API が成功しても実行が承認待ちのままなら赤になり、このワークフローの実行は承認しない', async () => {
    const { status, out, approved } = await runApprove([ALL_PENDING], { after: ALL_PENDING });
    expect({ status, approved }).toEqual({ status: 1, approved: [2, 3, 4, 5] });
    expect(out).toContain(
      '承認できなかった実行があります（run: .github/workflows/ci.yml .github/workflows/visual-text.yml .github/workflows/h5-admission.yml）'
    );
  });

  it('PR に人が新しいコミットを積んでいたら、何も承認しない', async () => {
    const { status, out, approved } = await runApprove([ALL_PENDING], { latestSha: OTHER_COMMIT });
    expect({ status, approved }).toEqual({ status: 0, approved: [] });
    expect(out).toContain(`PR #999 に新しいコミット（${OTHER_COMMIT}）が積まれたので`);
  });
});

describe('PR での翻訳の上限', () => {
  const step = translate.jobs.translate.steps.find((s) => s.env && 'I18N_MAX_ITEMS' in s.env);
  const limit = Number(step.env.I18N_MAX_ITEMS);
  const articles = COLLECTION_NAMES.reduce(
    (sum, collection) =>
      sum + readdirSync(path.join(root, CONTENT_ROOT, collection, SOURCE_LANG)).filter((f) => f.endsWith('.md')).length,
    0
  );

  it('全記事 × 翻訳先の言語数より大きい（全記事を直す PR でも 1 回で訳せる）', () => {
    expect({ limit, needed: articles * TARGET_LANGS.length }).toEqual({
      limit,
      needed: Math.min(articles * TARGET_LANGS.length, limit),
    });
  });
});
