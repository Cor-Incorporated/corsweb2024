// @vitest-environment node
/**
 * ワークフローの静的検査（.github/workflows/ci.yml の verify の「Lint workflows」）が、関門として効いているかを照合する。
 *
 * - verify は develop と main の必須チェック。ここに置けば、ブランチ保護の設定を変えずに PR を止められる
 * - actionlint と shellcheck は、URL の版と sha256 を固定し、展開・実行の前に sha256sum -c で照合する
 *   （shellcheck を固定しないと、runner に入っている版で結果が変わる。2026-10-01 の #371 は手元の版でだけ見つかった）
 * - actionlint は -shellcheck のパスが無いと、何も言わずに shellcheck の検査を外す（exit 0 のまま）。そのため
 *   shellcheck を取り出せたことを確かめ、SC2016 を含むカナリアが落ちることも毎回確かめる
 * - run は部分一致ではなく、各行をそのまま照合する（|| echo・-ignore・1 ファイルだけの検査・URL の書き換えなど、
 *   関門を弱める書き方はどれも行が変わるので落ちる。#373 のレビューで、部分一致では 14 通りを見逃した）
 * - 握りつぶし（continue-on-error・if）、SHELLCHECK_OPTS（actionlint が shellcheck に渡す）、actionlint の設定ファイル
 *   （.github/actionlint.yaml の ignore）を入れない
 * sha256 の値そのものは、実行時に sha256sum -c が照合する（違えば verify が落ちる）。ここでは形と順序を照合する。
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

type Step = { name?: string; if?: unknown; run?: string; env?: Record<string, unknown>; 'continue-on-error'?: unknown };
type Job = { name?: string; env?: Record<string, unknown>; steps?: Step[] };
type Workflow = { env?: Record<string, unknown>; jobs: Record<string, Job> };

const ROOT = process.cwd();
const CI = path.join(ROOT, '.github/workflows/ci.yml');
const ACTIONLINT_CONFIGS = ['.github/actionlint.yaml', '.github/actionlint.yml'];
const STEP_NAME = 'Lint workflows (actionlint + shellcheck, pinned)';
const ENV_KEYS = ['ACTIONLINT_SHA256', 'ACTIONLINT_URL', 'SHELLCHECK_SHA256', 'SHELLCHECK_URL'];
const ACTIONLINT_URL_RE = /^https:\/\/github\.com\/rhysd\/actionlint\/releases\/download\/v(\d+\.\d+\.\d+)\/actionlint_(\d+\.\d+\.\d+)_linux_amd64\.tar\.gz$/;
const SHELLCHECK_URL_RE = /^https:\/\/github\.com\/koalaman\/shellcheck\/releases\/download\/v(\d+\.\d+\.\d+)\/shellcheck-v(\d+\.\d+\.\d+)\.linux\.x86_64\.tar\.xz$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
/** run の各行（前後の空白を除く）。この順序で、この行だけがある */
const EXPECTED_RUN = [
  'set -euo pipefail',
  'tools="$RUNNER_TEMP/lint-tools"',
  'mkdir -p "$tools"',
  'curl -fsSL --retry 3 --retry-all-errors -o "$tools/actionlint.tar.gz" "$ACTIONLINT_URL"',
  'echo "${ACTIONLINT_SHA256}  $tools/actionlint.tar.gz" | sha256sum -c -',
  'curl -fsSL --retry 3 --retry-all-errors -o "$tools/shellcheck.tar.xz" "$SHELLCHECK_URL"',
  'echo "${SHELLCHECK_SHA256}  $tools/shellcheck.tar.xz" | sha256sum -c -',
  'tar -xzf "$tools/actionlint.tar.gz" -C "$tools" actionlint',
  `tar -xJf "$tools/shellcheck.tar.xz" -C "$tools" --strip-components=1 --wildcards '*/shellcheck'`,
  // 取り出せていなければ、ここで止まる（actionlint は shellcheck が無いと黙って検査を外すため、消さない）
  '"$tools/shellcheck" --version',
  '"$tools/actionlint" -version',
  `printf '%s\\n' 'on: push' 'jobs:' '  canary:' '    runs-on: ubuntu-latest' '    steps:' "      - run: echo '\\$HOME'" > "$tools/canary.yml"`,
  'if "$tools/actionlint" -shellcheck "$tools/shellcheck" -pyflakes= "$tools/canary.yml" > /dev/null; then',
  'echo "::error title=actionlint::shellcheck の検査が効いていない（SC2016 を含むカナリアが通った）"',
  'exit 1',
  'fi',
  '"$tools/actionlint" -shellcheck "$tools/shellcheck" -pyflakes= -color',
];

/** URL が固定の形で、タグと資産名の版が一致しているか */
function checkUrl(label: string, url: unknown, pattern: RegExp): string[] {
  const match = pattern.exec(String(url ?? ''));
  if (!match) return [`${label} が固定の形ではない: ${String(url)}`];
  return match[1] === match[2] ? [] : [`${label} のタグ（v${match[1]}）と資産名の版（${match[2]}）が違う`];
}

/** run の各行を、期待する行とそのまま照合する。最初に食い違った行を、行の番号と両方の値で出す */
function checkRun(run: string): string[] {
  const actual = run.split('\n').map((line) => line.trim()).filter(Boolean);
  const index = EXPECTED_RUN.findIndex((line, i) => actual[i] !== line);
  if (index === -1 && actual.length === EXPECTED_RUN.length) return [];
  const at = index === -1 ? EXPECTED_RUN.length : index;
  return [`run の ${at + 1} 行目が違う（期待: ${EXPECTED_RUN[at] ?? '（行なし）'} / 実際: ${actual[at] ?? '（行なし）'}）`];
}

/** ステップの env: ちょうど 4 つのキー・URL の版の一致・sha256 の形 */
function checkEnv(env: Record<string, unknown>): string[] {
  const keys = Object.keys(env).sort();
  return [
    ...(JSON.stringify(keys) === JSON.stringify(ENV_KEYS) ? [] : [`env のキーが ${ENV_KEYS.join(', ')} ではない（実際: ${keys.join(', ')}）`]),
    ...checkUrl('ACTIONLINT_URL', env.ACTIONLINT_URL, ACTIONLINT_URL_RE),
    ...checkUrl('SHELLCHECK_URL', env.SHELLCHECK_URL, SHELLCHECK_URL_RE),
    ...(['ACTIONLINT_SHA256', 'SHELLCHECK_SHA256'] as const)
      .filter((key) => !SHA256_RE.test(String(env[key] ?? '')))
      .map((key) => `${key} が 64 桁の小文字の 16 進数ではない: ${String(env[key])}`),
  ];
}

function check(text: string, configFiles: readonly string[] = []): string[] {
  const workflow = yaml.load(text) as Workflow;
  const verify = workflow.jobs.verify;
  const steps = (verify?.steps ?? []).filter((step) => step.name === STEP_NAME);
  if (verify?.name !== 'verify') return [`必須チェックのジョブ verify が無い（name: ${String(verify?.name)}）`];
  if (steps.length !== 1) return [`verify に「${STEP_NAME}」のステップがちょうど 1 つ無い（${steps.length} 個）`];
  const [step] = steps;
  const silencers = [
    ...('SHELLCHECK_OPTS' in (workflow.env ?? {}) ? ['ワークフローの env'] : []),
    ...('SHELLCHECK_OPTS' in (verify.env ?? {}) ? ['verify の env'] : []),
  ];
  return [
    ...checkEnv(step.env ?? {}),
    ...(step['continue-on-error'] === undefined ? [] : ['continue-on-error で失敗を握りつぶしている']),
    ...(step.if === undefined ? [] : [`if で飛ばせるようになっている: ${String(step.if)}`]),
    ...silencers.map((where) => `${where}に SHELLCHECK_OPTS がある（actionlint が shellcheck に渡すので、検査を弱められる）`),
    ...configFiles.map((file) => `${file} がある（actionlint の ignore で検査を弱められる。使うならこのテストで中身を照合する）`),
    ...checkRun(step.run ?? ''),
  ];
}

const loadText = () => readFileSync(CI, 'utf8');
const existingConfigs = () => ACTIONLINT_CONFIGS.filter((file) => existsSync(path.join(ROOT, file)));

describe('ワークフローの静的検査（ci.yml の verify の actionlint）', () => {
  it('版と sha256 を固定して照合し、shellcheck が効いていることを確かめてから、全ワークフローを検査する', () => {
    expect(check(loadText(), existingConfigs())).toEqual([]);
  });
});

describe('F3 変異: 固定を外す・弱める・握りつぶすと落ちる', () => {
  const mutate = (from: string | RegExp, to: string) => {
    const text = loadText();
    const changed = text.replace(from, to);
    expect(changed).not.toBe(text);
    return check(changed).join('\n');
  };
  const LINT_ALL = '"$tools/actionlint" -shellcheck "$tools/shellcheck" -pyflakes= -color\n';

  it('actionlint のタグと資産名の版を食い違わせる', () => {
    expect(mutate('download/v1.7.12/actionlint_1.7.12_', 'download/v1.7.13/actionlint_1.7.12_')).toContain(
      'ACTIONLINT_URL のタグ（v1.7.13）と資産名の版（1.7.12）が違う'
    );
  });

  it('shellcheck を latest にする・.tar.gz（後から手で足された資産）にする', () => {
    expect(mutate('download/v0.11.0/shellcheck-v0.11.0.', 'latest/download/shellcheck-v0.11.0.')).toContain('SHELLCHECK_URL が固定の形ではない');
    expect(mutate('shellcheck-v0.11.0.linux.x86_64.tar.xz', 'shellcheck-v0.11.0.linux.x86_64.tar.gz')).toContain('SHELLCHECK_URL が固定の形ではない');
  });

  it('sha256 を大文字にする・桁を欠く', () => {
    expect(mutate("ACTIONLINT_SHA256: '8aca8db9", "ACTIONLINT_SHA256: '8ACA8DB9")).toContain('ACTIONLINT_SHA256 が 64 桁の小文字の 16 進数ではない');
    expect(mutate(/SHELLCHECK_SHA256: '([0-9a-f]{63})[0-9a-f]'/, "SHELLCHECK_SHA256: '$1'")).toContain('SHELLCHECK_SHA256 が 64 桁');
  });

  it.each([
    ['shellcheck の sha256 の照合を消す', /\n\s*echo "\$\{SHELLCHECK_SHA256\}[^\n]*/, ''],
    ['shellcheck を取り出せたことの確かめを消す（黙って検査が外れる）', /\n\s*"\$tools\/shellcheck" --version/, ''],
    ['カナリアを消す', /\n\s*if "\$tools\/actionlint"[\s\S]*?\n\s*fi/, ''],
    ['失敗を || echo で握りつぶす', '-pyflakes= -color\n', '-pyflakes= -color || echo lint-failed\n'],
    ['-ignore ですべて無視する', LINT_ALL, `"$tools/actionlint" -shellcheck "$tools/shellcheck" -pyflakes= -ignore '.*' -color\n`],
    ['ci.yml だけを検査する', LINT_ALL, '"$tools/actionlint" -shellcheck "$tools/shellcheck" -pyflakes= -color .github/workflows/ci.yml\n'],
    ['pyflakes を使う', LINT_ALL, '"$tools/actionlint" -shellcheck "$tools/shellcheck" -pyflakes=pyflakes -color\n'],
    ['runner の shellcheck を使う', LINT_ALL, '"$tools/actionlint" -color\n'],
    ['curl の URL を書き換える', '"$tools/actionlint.tar.gz" "$ACTIONLINT_URL"', '"$tools/actionlint.tar.gz" "${ACTIONLINT_URL//1.7.12/1.6.0}"'],
    ['set +e を足す', 'set -euo pipefail\n', 'set -euo pipefail\n          set +e\n'],
  ])('%s', (_, from, to) => {
    expect(mutate(from, to)).toMatch(/run の \d+ 行目が違う（期待: .* \/ 実際: .*）/);
  });

  it('照合の前に展開する（行の順序が変わる）', () => {
    const text = loadText();
    const extract = `          tar -xzf "$tools/actionlint.tar.gz" -C "$tools" actionlint\n`;
    const moved = text.replace(extract, '').replace('          echo "${ACTIONLINT_SHA256}', `${extract}          echo "\${ACTIONLINT_SHA256}`);
    expect(moved).not.toBe(text);
    expect(check(moved).join('\n')).toContain('run の 5 行目が違う');
  });

  it('SHELLCHECK_OPTS で検査を弱める（ステップ・ジョブ・ワークフローの env）', () => {
    expect(mutate("          SHELLCHECK_SHA256: '", "          SHELLCHECK_OPTS: '-e SC2016'\n          SHELLCHECK_SHA256: '")).toContain('env のキーが');
    expect(mutate('    timeout-minutes: 20\n', "    timeout-minutes: 20\n    env:\n      SHELLCHECK_OPTS: '-e SC2016'\n")).toContain(
      'verify の envに SHELLCHECK_OPTS がある'
    );
    expect(mutate('permissions:\n  contents: read\n', "permissions:\n  contents: read\n\nenv:\n  SHELLCHECK_OPTS: '-e SC2016'\n")).toContain(
      'ワークフローの envに SHELLCHECK_OPTS がある'
    );
  });

  it('actionlint の設定ファイル（ignore を書ける）を置く', () => {
    expect(check(loadText(), ['.github/actionlint.yaml']).join('\n')).toContain('.github/actionlint.yaml がある');
  });

  it('握りつぶす（continue-on-error・if）・ステップの名前を変える', () => {
    const header = `      - name: ${STEP_NAME}\n`;
    expect(mutate(header, `${header}        continue-on-error: true\n`)).toContain('continue-on-error で失敗を握りつぶしている');
    expect(mutate(header, `${header}        if: false\n`)).toContain('if で飛ばせるようになっている');
    expect(mutate(`- name: ${STEP_NAME}`, '- name: Lint workflows')).toContain(`verify に「${STEP_NAME}」のステップがちょうど 1 つ無い（0 個）`);
  });
});
