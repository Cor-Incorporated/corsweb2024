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
 * 4. approve-checks のスクリプトを、偽の gh で実際に動かす: 承認待ちの実行だけを承認し、このワークフローの実行は
 *    最後に承認する（承認すると concurrency でこの実行が取り消されるため）。承認に失敗したら赤になる
 * 5. PR での翻訳の上限（I18N_MAX_ITEMS）が、全記事 × 4 言語より大きい（全記事を直す PR でも 1 回で訳せる）
 */
import { spawnSync } from 'node:child_process';
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
      job.steps.filter((s) => s.run).map((s) => ({ job: name, dispatches: /gh workflow run/.test(s.run) }))
    );
    expect(scripts.filter((s) => s.dispatches)).toEqual([]);
  });
});

// ---- approve-checks のスクリプトを偽の gh で動かす ----------------------------------------------
const approveScript = approveJob?.steps.find((s) => s.name === 'Approve the pull_request runs of the translation commit')?.run;
const COMMIT = 'c'.repeat(40);
const HEAD_REF = 'feat/example';
const run = (id, workflow, conclusion, headBranch = HEAD_REF) => ({
  id,
  path: `.github/workflows/${workflow}`,
  conclusion,
  head_branch: headBranch,
});

// GET は呼ばれた回数目のフィクスチャ（最後のものを使い続ける）に --jq の式を jq で当てる。POST の approve は ID を記録し、
// FAIL_IDS の ID なら失敗する。sleep は待たず、date +%s は呼ぶたびに 60 秒進む
const FAKE_GH = `#!/usr/bin/env bash
set -euo pipefail
if [ "$1 $2 $3" = "api -X POST" ]; then
  id="$(basename "$(dirname "$4")")"
  echo "$id" >> "$WORK/approved"
  case " \${FAIL_IDS:-} " in *" $id "*) echo "HTTP 403: Resource not accessible by integration" >&2; exit 1 ;; esac
  exit 0
fi
[ "$1 $3" = "api --jq" ] || { echo "unexpected gh call: $*" >&2; exit 2; }
n=$(( $(cat "$WORK/gets" 2>/dev/null || echo 0) + 1 ))
echo "$n" > "$WORK/gets"
[ "$n" -le "$FIXTURES" ] || n="$FIXTURES"
jq -r "$4" "$WORK/runs-$n.json"
`;
const FAKE_SLEEP = '#!/usr/bin/env bash\nexit 0\n';
const FAKE_DATE = `#!/usr/bin/env bash
n=$(( $(cat "$WORK/clock" 2>/dev/null || echo 0) + 60 ))
echo "$n" > "$WORK/clock"
echo "$n"
`;

let work;
afterEach(async () => work && removeTempDir(work));

/** fixtures（GET の回数目ごとの実行の一覧）で approve-checks を動かし、終了コード・出力・承認した ID を返す */
async function runApprove(fixtures, { baseRef = 'develop', failIds = [] } = {}) {
  work = await mkdtemp(path.join(os.tmpdir(), 'i18n-approve-'));
  const bin = path.join(work, 'bin');
  await mkdir(bin);
  for (const [name, body] of [['gh', FAKE_GH], ['sleep', FAKE_SLEEP], ['date', FAKE_DATE]]) {
    await writeFile(path.join(bin, name), body);
    await chmod(path.join(bin, name), 0o755);
  }
  for (const [i, runs] of fixtures.entries()) {
    await writeFile(path.join(work, `runs-${i + 1}.json`), JSON.stringify({ workflow_runs: runs }));
  }
  const result = spawnSync('bash', ['-e', '-c', approveScript], {
    encoding: 'utf8',
    env: {
      PATH: `${bin}:${process.env.PATH}`,
      WORK: work,
      FIXTURES: String(fixtures.length),
      FAIL_IDS: failIds.join(' '),
      GITHUB_REPOSITORY: 'owner/repo',
      GH_TOKEN: 'test-token',
      ...approveJob.env,
      COMMIT,
      HEAD_REF,
      BASE_REF: baseRef,
      PR_NUMBER: '999',
    },
  });
  const log = path.join(work, 'approved');
  const approved = existsSync(log) ? (await readFile(log, 'utf8')).split('\n').filter(Boolean).map(Number) : [];
  return { status: result.status, out: `${result.stdout}${result.stderr}`, approved };
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

  it('承認待ちでない実行と、別のブランチの実行は承認しない', async () => {
    const runs = [
      run(1, 'translate-content.yml', 'action_required'),
      run(2, 'ci.yml', 'success'),
      run(3, 'visual-text.yml', null), // 実行中（conclusion がまだ無い）
      run(4, 'h5-admission.yml', 'action_required'),
      run(6, 'h5-admission.yml', 'action_required', 'other-branch'),
    ];
    const { status, approved } = await runApprove([runs]);
    expect({ status, approved }).toEqual({ status: 0, approved: [4, 1] });
  });

  it('必須チェックのワークフローの実行が出そろうまで待ってから承認する', async () => {
    const { status, approved } = await runApprove([[], ALL_PENDING.slice(0, 2), ALL_PENDING]);
    expect({ status, approved }).toEqual({ status: 0, approved: [2, 3, 4, 5, 1] });
  });

  it('必須チェックのワークフローの実行が 3 分待っても無ければ、何も承認せずに赤になる', async () => {
    const { status, out, approved } = await runApprove([ALL_PENDING.filter((r) => r.id !== 3)]);
    expect({ status, approved }).toEqual({ status: 1, approved: [] });
    expect(out).toContain('3 分待っても作られませんでした: .github/workflows/visual-text.yml');
  });

  it('base が develop / main 以外の PR では h5-admission.yml だけを待つ', async () => {
    const runs = [run(1, 'translate-content.yml', 'action_required'), run(4, 'h5-admission.yml', 'action_required')];
    const { status, approved } = await runApprove([runs], { baseRef: 'feat/parent' });
    expect({ status, approved }).toEqual({ status: 0, approved: [4, 1] });
  });

  it('承認に失敗した実行があれば赤になり、このワークフローの実行は承認しない', async () => {
    const { status, out, approved } = await runApprove([ALL_PENDING], { failIds: [3] });
    expect({ status, approved }).toEqual({ status: 1, approved: [2, 3, 4, 5] });
    expect(out).toContain('承認できなかった実行があります（run: 3）。PR #999 の Checks');
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
