// @vitest-environment node
/**
 * ワークフローの静的検査（.github/workflows/ci.yml の verify の「Lint workflows」）が、関門として効いているかを照合する。
 *
 * - verify は develop と main の必須チェック。ここに置けば、ブランチ保護の設定を変えずに PR を止められる
 * - actionlint と shellcheck は、URL の版と sha256 を固定し、展開・実行の前に sha256sum -c で照合する
 *   （shellcheck を固定しないと、runner に入っている版で結果が変わる。2026-10-01 の #371 は手元の版でだけ見つかった）
 * - actionlint に固定した shellcheck を渡し、pyflakes は使わない（runner にあるかどうかで結果が変わるため）
 * - 失敗を握りつぶす書き方（|| true・continue-on-error・if）を入れない
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

type Step = { name?: string; if?: unknown; run?: string; env?: Record<string, unknown>; 'continue-on-error'?: unknown };
type Workflow = { jobs: Record<string, { name?: string; steps?: Step[] }> };

const CI = path.join(process.cwd(), '.github/workflows/ci.yml');
const STEP_NAME = 'Lint workflows (actionlint + shellcheck, pinned)';
const ACTIONLINT_URL_RE = /^https:\/\/github\.com\/rhysd\/actionlint\/releases\/download\/v(\d+\.\d+\.\d+)\/actionlint_(\d+\.\d+\.\d+)_linux_amd64\.tar\.gz$/;
const SHELLCHECK_URL_RE = /^https:\/\/github\.com\/koalaman\/shellcheck\/releases\/download\/v(\d+\.\d+\.\d+)\/shellcheck-v(\d+\.\d+\.\d+)\.linux\.x86_64\.tar\.gz$/;
const SHA256_RE = /^[0-9a-f]{64}$/;

/** URL が固定の形で、タグと資産名の版が一致しているか */
function checkUrl(label: string, url: unknown, pattern: RegExp): string[] {
  const match = pattern.exec(String(url ?? ''));
  if (!match) return [`${label} が固定の形ではない: ${String(url)}`];
  return match[1] === match[2] ? [] : [`${label} のタグ（v${match[1]}）と資産名の版（${match[2]}）が違う`];
}

/** run の中で、照合（sha256sum -c）が展開・実行より前にあるか、shellcheck を渡しているか、失敗を握りつぶしていないか */
function checkRun(run: string): string[] {
  const at = (needle: string) => run.indexOf(needle);
  const verified = ['${ACTIONLINT_SHA256}', '${SHELLCHECK_SHA256}'].map((sha) => at(`echo "${sha}`));
  const firstUse = Math.min(...['tar -x', '"$tools/actionlint"', '"$tools/shellcheck"'].map(at).filter((i) => i >= 0));
  return [
    ...(run.includes('set -euo pipefail') ? [] : ['run に set -euo pipefail が無い']),
    ...(verified.every((i) => i >= 0) && (run.match(/sha256sum -c -/g) ?? []).length === 2
      ? []
      : ['actionlint と shellcheck の両方を sha256sum -c で照合していない']),
    ...(verified.some((i) => i > firstUse) ? ['sha256sum -c の前に展開・実行している'] : []),
    ...(run.includes('"$tools/actionlint" -shellcheck "$tools/shellcheck" -pyflakes=')
      ? []
      : ['actionlint に固定した shellcheck を渡していない（または pyflakes を切っていない）']),
    ...(/\|\|\s*(true|:)|;\s*true\b|exit 0/.test(run) ? ['run で失敗を握りつぶしている'] : []),
  ];
}

function check(text: string): string[] {
  const workflow = yaml.load(text) as Workflow;
  const verify = workflow.jobs.verify;
  const steps = (verify?.steps ?? []).filter((step) => step.name === STEP_NAME);
  if (verify?.name !== 'verify') return [`必須チェックのジョブ verify が無い（name: ${String(verify?.name)}）`];
  if (steps.length !== 1) return [`verify に「${STEP_NAME}」のステップがちょうど 1 つ無い（${steps.length} 個）`];
  const [step] = steps;
  const env = step.env ?? {};
  return [
    ...checkUrl('ACTIONLINT_URL', env.ACTIONLINT_URL, ACTIONLINT_URL_RE),
    ...checkUrl('SHELLCHECK_URL', env.SHELLCHECK_URL, SHELLCHECK_URL_RE),
    ...(['ACTIONLINT_SHA256', 'SHELLCHECK_SHA256'] as const)
      .filter((key) => !SHA256_RE.test(String(env[key] ?? '')))
      .map((key) => `${key} が 64 桁の小文字の 16 進数ではない: ${String(env[key])}`),
    ...(step['continue-on-error'] === undefined ? [] : ['continue-on-error で失敗を握りつぶしている']),
    ...(step.if === undefined ? [] : [`if で飛ばせるようになっている: ${String(step.if)}`]),
    ...checkRun(step.run ?? ''),
  ];
}

const loadText = () => readFileSync(CI, 'utf8');

describe('ワークフローの静的検査（ci.yml の verify の actionlint）', () => {
  it('版と sha256 を固定し、照合してから、固定した shellcheck で全ワークフローを検査する', () => {
    expect(check(loadText())).toEqual([]);
  });
});

describe('F3 変異: 固定を外す・握りつぶすと落ちる', () => {
  const mutate = (from: string | RegExp, to: string) => {
    const text = loadText();
    const changed = text.replace(from, to);
    expect(changed).not.toBe(text);
    return check(changed).join('\n');
  };

  it('actionlint のタグと資産名の版を食い違わせる', () => {
    expect(mutate('download/v1.7.12/actionlint_1.7.12_', 'download/v1.7.13/actionlint_1.7.12_')).toContain(
      'ACTIONLINT_URL のタグ（v1.7.13）と資産名の版（1.7.12）が違う'
    );
  });

  it('shellcheck を latest にする（版を固定しない）', () => {
    expect(mutate('download/v0.11.0/shellcheck-v0.11.0.', 'latest/download/shellcheck-v0.11.0.')).toContain(
      'SHELLCHECK_URL が固定の形ではない'
    );
  });

  it('sha256 を大文字にする・桁を欠く', () => {
    expect(mutate("ACTIONLINT_SHA256: '8aca8db9", "ACTIONLINT_SHA256: '8ACA8DB9")).toContain('ACTIONLINT_SHA256 が 64 桁の小文字の 16 進数ではない');
    expect(mutate(/SHELLCHECK_SHA256: '([0-9a-f]{63})[0-9a-f]'/, "SHELLCHECK_SHA256: '$1'")).toContain('SHELLCHECK_SHA256 が 64 桁');
  });

  it('shellcheck の sha256 の照合を消す', () => {
    expect(mutate(/\n\s*echo "\$\{SHELLCHECK_SHA256\}[^\n]*/, '')).toContain('両方を sha256sum -c で照合していない');
  });

  it('照合の前に展開する', () => {
    const text = loadText();
    const extract = text.match(/\n\s*tar -xzf "\$tools\/actionlint\.tar\.gz"[^\n]*/)?.[0] ?? '';
    const moved = text.replace(extract, '').replace('          curl -fsSL --retry 3 -o "$tools/actionlint.tar.gz"', `${extract.trimStart().padStart(extract.trimStart().length + 10)}\n          curl -fsSL --retry 3 -o "$tools/actionlint.tar.gz"`);
    expect(moved).not.toBe(text);
    expect(check(moved).join('\n')).toContain('sha256sum -c の前に展開・実行している');
  });

  it('runner の shellcheck を使う（-shellcheck を外す）', () => {
    expect(mutate('"$tools/actionlint" -shellcheck "$tools/shellcheck" -pyflakes= -color', '"$tools/actionlint" -color')).toContain(
      'actionlint に固定した shellcheck を渡していない'
    );
  });

  it('失敗を握りつぶす（|| true・continue-on-error・if）', () => {
    expect(mutate('-pyflakes= -color', '-pyflakes= -color || true')).toContain('run で失敗を握りつぶしている');
    expect(mutate('      - name: Lint workflows (actionlint + shellcheck, pinned)\n', '      - name: Lint workflows (actionlint + shellcheck, pinned)\n        continue-on-error: true\n')).toContain(
      'continue-on-error で失敗を握りつぶしている'
    );
    expect(mutate('      - name: Lint workflows (actionlint + shellcheck, pinned)\n', '      - name: Lint workflows (actionlint + shellcheck, pinned)\n        if: false\n')).toContain(
      'if で飛ばせるようになっている'
    );
  });

  it('ステップの名前を変える（照合が空回りしない）', () => {
    expect(mutate('- name: Lint workflows (actionlint + shellcheck, pinned)', '- name: Lint workflows')).toContain(
      'verify に「Lint workflows (actionlint + shellcheck, pinned)」のステップがちょうど 1 つ無い（0 個）'
    );
  });
});
