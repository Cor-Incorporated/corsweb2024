// @vitest-environment node
/**
 * H5 の入場料の検査（scripts/h5-admission-check.sh）の判定を、スクリプトを実際に動かして照合する。
 *
 * レジャー（H6 台帳の配線）: 本文に guard-ledger.jsonl・aidd_ledger_append と書いてあるだけで、「配線は無い」
 * という否定の文でも通っていた（#371 のレビュー）。h5-admission を触る PR では、本文に「台帳」「ledger」と
 * 書くだけでも通っていた。証拠として数えるのは、次の 3 つだけにする。
 * - H5-LEDGER: の行（20 文字以上）
 * - 台帳（ledger）の節（20 文字以上）
 * - 変更したフック・H5 のスクリプトのコードが、実際に台帳へ書き込むこと
 * マーカーの最低の長さは 3 つ（NEGATIVE・LEDGER・RETIRE）とも、節と同じ 20 文字にそろえる。
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const SCRIPT = path.join(process.cwd(), 'scripts/h5-admission-check.sh');
const dir = mkdtempSync(path.join(tmpdir(), 'h5-admission-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const NEGATIVE = 'H5-NEGATIVE: the known-bad input was red before the fix (exit 1) and green after';
const LEDGER = 'H5-LEDGER: 発火の記録は GitHub Actions の実行履歴と PR のコメントに残る';
const RETIRE = 'H5-RETIRE: the workflow is retired, or 90 days pass without a single fire';
const SUBTRACTION = 'H5-SUBTRACTION: N/A';
const WORKFLOW = '.github/workflows/example.yml';

/** ガードの PR の本文（NEGATIVE・RETIRE・SUBTRACTION はそろえ、残りを足す） */
const body = (...lines) => [NEGATIVE, RETIRE, SUBTRACTION, ...lines].join('\n');

/** スクリプトを動かす（ネットワークも gh も使わない: H5_DIFF_FILES を渡し、H5-RETIRE-PR は書かない） */
function run(prBody, diffFiles = WORKFLOW) {
  const result = spawnSync('bash', [SCRIPT], {
    encoding: 'utf8',
    env: {
      ...process.env,
      H5_PR_BODY: prBody,
      H5_DIFF_FILES: diffFiles,
      H5_LEDGER_PATH: path.join(dir, 'ledger.jsonl'),
      GITHUB_EVENT_PATH: '',
      H5_PR_NUMBER: '',
    },
  });
  return { status: result.status, out: `${result.stdout}${result.stderr}` };
}

describe('H5: レジャー（台帳の配線）の証拠', () => {
  it.each([
    ['guard-ledger.jsonl と書いてあるだけ（配線は無い、という否定の文）', 'この PR は guard-ledger.jsonl への配線は無い'],
    ['aidd_ledger_append と書いてあるだけ', 'aidd_ledger_append は使っていない'],
  ])('%s では通らない', (_, line) => {
    const { status, out } = run(body(line));
    expect(status).toBe(1);
    expect(out).toContain('ledger-wiring');
  });

  it('h5-admission を触る PR でも、本文に「ledger」と書くだけでは通らない', () => {
    const { status, out } = run(body('ledger の話をしているだけの行'), '.github/workflows/h5-admission.yml');
    expect(status).toBe(1);
    expect(out).toContain('ledger-wiring');
  });

  it('H5-LEDGER: の行（20 文字以上）があれば通る', () => {
    expect(run(body(LEDGER))).toMatchObject({ status: 0 });
  });

  it('H5-LEDGER: の中身が 20 文字未満なら通らない', () => {
    const { status, out } = run(body('H5-LEDGER: CI の実行履歴に残る'));
    expect(status).toBe(1);
    expect(out).toContain('ledger-wiring');
  });

  it('台帳の節（20 文字以上）があれば通る', () => {
    expect(run(body('## 台帳', '発火すると hooks/ledger/guard-ledger.jsonl に 1 行追記する（aidd_ledger_append）'))).toMatchObject({
      status: 0,
    });
  });

  it('変更した H5 のスクリプトが台帳へ書き込むなら、本文に無くても通る（コードの証拠）', () => {
    expect(run(body(), 'scripts/h5-admission-check.sh')).toMatchObject({ status: 0 });
  });
});

describe('H5: ほかの判定（変えていないこと）とマーカーの長さ', () => {
  it('構造パスを触らず、ガードとも名乗らない PR は対象外', () => {
    const { status, out } = run('ふつうの PR', 'src/pages/index.astro');
    expect(status).toBe(0);
    expect(out).toContain('not a guard/verifier PR');
  });

  it('NEGATIVE・LEDGER・RETIRE・SUBTRACTION がそろえば通る', () => {
    expect(run(body(LEDGER))).toMatchObject({ status: 0 });
  });

  it('H5-NEGATIVE の中身が 20 文字未満なら通らない（3 つのマーカーで同じ長さ）', () => {
    const short = ['H5-NEGATIVE: exit 1 で確認', LEDGER, RETIRE, SUBTRACTION].join('\n');
    const { status, out } = run(short);
    expect(status).toBe(1);
    expect(out).toContain('negative-test-evidence');
  });
});
