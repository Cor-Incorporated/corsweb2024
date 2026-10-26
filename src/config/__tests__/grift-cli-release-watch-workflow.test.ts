// @vitest-environment node
/**
 * Grift CLI の版の照合（.github/workflows/grift-cli-release-watch.yml、ADR-0023）の形を照合し、Issue を開く run を
 * 取り出して実際に動かす（gh は偽物。Issue は作らず、呼ばれた引数を記録する。jq は本物）。
 *
 * - 起動は schedule と workflow_dispatch だけ（PR のコードを issues: write の権限で動かさない）
 * - 権限は job の contents: read と issues: write だけ。checkout は SHA で固定し、認証情報を残さない
 * - npm ci をしない（照合のスクリプトは Node の組み込みだけで動く）
 * - 同じ題の Issue が開いていれば、もう開かない。同じになったら閉じる。gh が失敗したら、黙って通さずに落ちる
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { afterAll, describe, expect, it } from 'vitest';

type Step = { name?: string; id?: string; if?: string; uses?: string; with?: Record<string, unknown>; run?: string; env?: Record<string, string> };
type Job = { permissions?: Record<string, string>; steps: Step[]; 'timeout-minutes'?: number };
type Workflow = { on: Record<string, unknown>; permissions?: unknown; jobs: Record<string, Job> };

const WORKFLOW = path.join(process.cwd(), '.github/workflows/grift-cli-release-watch.yml');
const raw = readFileSync(WORKFLOW, 'utf8');
const workflow = yaml.load(raw) as Workflow;
const job = workflow.jobs.watch;
const dir = mkdtempSync(path.join(tmpdir(), 'grift-cli-release-watch-wf-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const stepNamed = (name: string) => {
  const found = job.steps.filter((s) => s.name === name);
  expect(found, `ステップ「${name}」が 1 つだけある`).toHaveLength(1);
  return found[0];
};

/** 偽物の gh: issue list は ISSUES_JSON を返し（LIST_FAILS なら失敗し）、issue create は引数を記録する */
function fakeGh(): { binDir: string; log: string } {
  const binDir = mkdtempSync(path.join(dir, 'bin-'));
  const log = path.join(binDir, 'gh.log');
  writeFileSync(
    path.join(binDir, 'gh'),
    [
      '#!/usr/bin/env bash',
      `printf '%s\\n' "$*" >> "${log}"`,
      'if [ "$1 $2" = "issue list" ]; then',
      '  if [ -n "${LIST_FAILS:-}" ]; then echo "HTTP 502" >&2; exit 1; fi',
      '  printf "%s" "$ISSUES_JSON"',
      'fi',
      'exit 0',
      '',
    ].join('\n')
  );
  chmodSync(path.join(binDir, 'gh'), 0o755);
  return { binDir, log };
}

const TITLE_DRIFT = 'Grift CLI の版の正本（v0.8.0）が PyPI の最新（v0.9.0）と違う';
const TITLE_SAME = 'Grift CLI の版の正本（v0.9.0）が PyPI の最新（v0.9.0）と違う';
type Issue = { number: number; title: string };

/** Issue を開く・閉じる run を GitHub と同じく bash -e で動かす */
function runIssueStep({ drift, issues = [], listFails = false }: { drift: boolean; issues?: Issue[]; listFails?: boolean }) {
  const { run } = stepNamed('Open or close the issue');
  const script = path.join(dir, `issue-${Math.random().toString(36).slice(2)}.sh`);
  writeFileSync(script, run ?? '');
  const { binDir, log } = fakeGh();
  const result = spawnSync('bash', ['-e', script], {
    encoding: 'utf8',
    timeout: 10_000,
    env: {
      PATH: `${binDir}:${process.env.PATH}`,
      GH_TOKEN: 'dummy',
      GH_REPO: 'Cor-Incorporated/corsweb2024',
      DRIFT: String(drift),
      TITLE: drift ? TITLE_DRIFT : TITLE_SAME,
      PYPI_VERSION: '0.9.0',
      BODY_FILE: '/tmp/body.md',
      ISSUES_JSON: JSON.stringify(issues),
      ...(listFails ? { LIST_FAILS: '1' } : {}),
    },
  });
  const calls = existsSync(log) ? readFileSync(log, 'utf8').split('\n') : [];
  return {
    status: result.status,
    out: `${result.stdout}${result.stderr}`,
    created: calls.filter((l) => l.startsWith('issue create')),
    closed: calls.filter((l) => l.startsWith('issue close')),
  };
}

describe('Grift CLI の版の照合（grift-cli-release-watch.yml）', () => {
  it('起動は毎日の schedule と手動だけ', () => {
    expect(Object.keys(workflow.on).sort()).toEqual(['schedule', 'workflow_dispatch']);
    expect(workflow.on.schedule).toEqual([{ cron: '17 0 * * *' }]);
    expect(workflow.on.workflow_dispatch).toBeNull();
  });

  it('権限は job の contents: read と issues: write だけ', () => {
    expect(workflow.permissions).toEqual({});
    expect(Object.keys(workflow.jobs)).toEqual(['watch']);
    expect(job.permissions).toEqual({ contents: 'read', issues: 'write' });
    expect(job['timeout-minutes']).toBeLessThanOrEqual(10);
  });

  it('checkout は SHA で固定し、認証情報を残さない。npm ci をしない', () => {
    const checkout = stepNamed('Checkout');
    expect(checkout.uses).toMatch(/^actions\/checkout@[0-9a-f]{40}$/);
    expect(checkout.with).toEqual({ 'persist-credentials': false });
    // コメントではなく、ステップの uses と run を見る
    expect(job.steps.map((s) => `${s.uses ?? ''} ${s.run ?? ''}`).join('\n')).not.toMatch(/npm (ci|install)|setup-node/);
  });

  it('照合のスクリプトを、Issue の本文と出力のファイルを渡して動かす', () => {
    const compare = stepNamed('Compare the release with PyPI');
    expect(compare.id).toBe('compare');
    expect(compare.run).toBe('node scripts/grift-cli-release-watch.mjs --body-file "$BODY_FILE" --github-output "$GITHUB_OUTPUT"');
    const issue = stepNamed('Open or close the issue');
    // 同じになったときに閉じるため、drift に関わらず動かす
    expect(issue.if).toBeUndefined();
    expect(issue.env?.DRIFT).toBe('${{ steps.compare.outputs.drift }}');
    expect(issue.env?.TITLE).toBe('${{ steps.compare.outputs.title }}');
    expect(issue.env?.PYPI_VERSION).toBe('${{ steps.compare.outputs.pypi_version }}');
    expect(issue.env?.BODY_FILE).toBe(compare.env?.BODY_FILE);
    // 題などの値は env で渡し、run に ${{ }} を埋めない
    expect(issue.run).not.toMatch(/\$\{\{/);
  });

  it('違っていて、同じ題の Issue が無ければ開く（ほかの Issue は触らない）', () => {
    const { status, created, closed } = runIssueStep({ drift: true, issues: [{ number: 7, title: '別の Issue' }] });
    expect(status).toBe(0);
    expect(created).toEqual([`issue create --title ${TITLE_DRIFT} --body-file /tmp/body.md`]);
    expect(closed).toEqual([]);
  });

  it('違っていて、同じ題の Issue が開いていれば、もう開かない', () => {
    const { status, out, created, closed } = runIssueStep({ drift: true, issues: [{ number: 430, title: TITLE_DRIFT }] });
    expect(status).toBe(0);
    expect(out).toContain('#430');
    expect(created).toEqual([]);
    expect(closed).toEqual([]);
  });

  it('違う組み合わせの古い Issue は閉じて、新しい Issue を開く', () => {
    const old = 'Grift CLI の版の正本（v0.8.0）が PyPI の最新（v0.8.1）と違う';
    const { status, created, closed } = runIssueStep({ drift: true, issues: [{ number: 431, title: old }] });
    expect(status).toBe(0);
    expect(closed).toEqual([`issue close 431 --comment 照合の結果が変わったので閉じます（新しい結果: ${TITLE_DRIFT}）`]);
    expect(created).toHaveLength(1);
  });

  it('同じになったら、開いている照合の Issue を閉じ、新しく開かない', () => {
    const { status, created, closed } = runIssueStep({
      drift: false,
      issues: [
        { number: 430, title: TITLE_DRIFT },
        { number: 7, title: '別の Issue' },
      ],
    });
    expect(status).toBe(0);
    expect(closed).toEqual(['issue close 430 --comment 正本と PyPI の最新が v0.9.0 で同じになったので閉じます']);
    expect(created).toEqual([]);
  });

  it('同じで、照合の Issue も無ければ何もしない', () => {
    expect(runIssueStep({ drift: false, issues: [{ number: 7, title: '別の Issue' }] })).toMatchObject({
      status: 0,
      created: [],
      closed: [],
    });
  });

  it('Issue の一覧が取れなければ落ちる（開いたことにも、閉じたことにもしない）', () => {
    const { status, created, closed } = runIssueStep({ drift: true, listFails: true });
    expect(status).not.toBe(0);
    expect(created).toEqual([]);
    expect(closed).toEqual([]);
  });
});
