// @vitest-environment node
/**
 * main へは develop からの PR だけを通すガード（.github/workflows/guard-base-branch.yml）を、run のスクリプトを
 * 取り出して実際に動かして照合する（gh は偽物。コメントは書かず、呼ばれた引数を記録する）。
 *
 * github.head_ref はブランチ名だけなので、フォークのブランチが develop という名前なら通っていた（#374 のレビュー。
 * このリポジトリは公開）。head のリポジトリ（github.event.pull_request.head.repo.full_name）も照合する。
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { afterAll, describe, expect, it } from 'vitest';

type Step = { name?: string; run?: string; env?: Record<string, string> };
type Workflow = { jobs: { guard: { steps: Step[] } } };

const WORKFLOW = path.join(process.cwd(), '.github/workflows/guard-base-branch.yml');
const dir = mkdtempSync(path.join(tmpdir(), 'guard-base-branch-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const step = () => {
  const workflow = yaml.load(readFileSync(WORKFLOW, 'utf8')) as Workflow;
  const steps = workflow.jobs.guard.steps.filter((s) => s.run);
  expect(steps).toHaveLength(1);
  return steps[0];
};

/** 偽物の gh: pr view（既出のコメントの数）には 0 を返し、pr comment は引数を記録するだけ */
function fakeGh(): { binDir: string; log: string } {
  const binDir = mkdtempSync(path.join(dir, 'bin-'));
  const log = path.join(binDir, 'gh.log');
  writeFileSync(
    path.join(binDir, 'gh'),
    `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> "${log}"\nif [ "$1 $2" = "pr view" ]; then echo 0; fi\nexit 0\n`
  );
  chmodSync(path.join(binDir, 'gh'), 0o755);
  return { binDir, log };
}

/** run を GitHub と同じく bash -eo pipefail で動かす */
function runGuard({ head, headRepo, repo = 'Cor-Incorporated/corsweb2024' }: { head: string; headRepo: string; repo?: string }) {
  const { run } = step();
  const script = path.join(dir, `guard-${Math.random().toString(36).slice(2)}.sh`);
  writeFileSync(script, run ?? '');
  const { binDir, log } = fakeGh();
  const result = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', script], {
    encoding: 'utf8',
    env: { PATH: `${binDir}:${process.env.PATH}`, GH_TOKEN: 'dummy', REPO: repo, HEAD: head, HEAD_REPO: headRepo, PR: '42' },
  });
  const calls = existsSync(log) ? readFileSync(log, 'utf8') : '';
  return { status: result.status, out: `${result.stdout}${result.stderr}`, commented: calls.includes('pr comment') };
}

describe('main へのガード（guard-base-branch.yml）', () => {
  it('head のリポジトリを env で渡す（run に ${{ }} を埋めない）', () => {
    const { env, run } = step();
    expect(env?.HEAD_REPO).toBe('${{ github.event.pull_request.head.repo.full_name }}');
    expect(run).not.toMatch(/\$\{\{/);
  });

  it('このリポジトリの develop からの PR は通す（コメントしない）', () => {
    expect(runGuard({ head: 'develop', headRepo: 'Cor-Incorporated/corsweb2024' })).toMatchObject({ status: 0, commented: false });
  });

  it('フォークの develop という名前のブランチからの PR は止める（読み取り専用のトークンなのでコメントはしない）', () => {
    const { status, out, commented } = runGuard({ head: 'develop', headRepo: 'someone/corsweb2024' });
    expect(status).toBe(1);
    expect(out).toContain('::error title=フォークの develop です::');
    expect(out).toContain('head は someone/corsweb2024:develop');
    expect(commented).toBe(false);
  });

  it('head のリポジトリが分からない（フォークが消えた）PR も止める', () => {
    const { status, out } = runGuard({ head: 'develop', headRepo: '' });
    expect(status).toBe(1);
    expect(out).toContain('head は （不明）:develop');
  });

  it('このリポジトリの develop 以外のブランチからの PR は、今までどおり誘導のコメントを書いて止める', () => {
    const { status, out, commented } = runGuard({ head: 'feature/x', headRepo: 'Cor-Incorporated/corsweb2024' });
    expect(status).toBe(1);
    expect(out).toContain('::error title=base が main です::');
    expect(commented).toBe(true);
  });
});
