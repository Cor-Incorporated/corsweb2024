// @vitest-environment node
/**
 * H5 の入場料の検査（scripts/h5-admission-check.sh）の判定を、スクリプトを実際に動かして照合する。
 *
 * レジャー（H6 台帳の配線）: 本文に guard-ledger.jsonl・aidd_ledger_append と書いてあるだけで、「配線は無い」
 * という否定の文でも通っていた（#371 のレビュー）。h5-admission を触る PR では、本文に「台帳」「ledger」と
 * 書くだけでも通っていた。コードの証拠も、ファイルにその文字があるだけ（コメントでも、検査のスクリプト自身でも）で
 * 通っていた（#375 のレビュー）。証拠として数えるのは、次の 3 つだけにする。
 * - H5-LEDGER: の行（同じ行に 20 文字以上。<...> のままのプレースホルダーは数えない）
 * - 台帳（ledger）の節（20 文字以上）
 * - 変更した hooks/** か scripts/h5* のファイルが、本当に台帳へ書き込むこと（aidd_ledger_append の呼び出しか、
 *   *LEDGER* のパスへの >> 追記。コメントの行は数えない）
 * マーカーの最低の長さは 3 つ（NEGATIVE・LEDGER・RETIRE）とも、節と同じ 20 文字。文字数で数える（ロケールによらない）。
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
/** スクリプトを動かすたびに python3 を数回起こすので、1 件に数秒かかることがある */
const SLOW = { timeout: 30_000 };
/** 日本語でちょうど n 文字の中身 */
const jaText = (n) => 'あいうえおかきくけこさしすせそたちつてとなにぬねの'.slice(0, n);

/** ガードの PR の本文（NEGATIVE・RETIRE・SUBTRACTION はそろえ、残りを足す） */
const body = (...lines) => [NEGATIVE, RETIRE, SUBTRACTION, ...lines].join('\n');

/**
 * スクリプトを動かす（ネットワークも gh も使わない: H5_DIFF_FILES を渡し、H5-RETIRE-PR は書かない）。
 * script を渡すと、そのコピーを動かす（ROOT はコピーの親。そこに置いたフックをコードの証拠として読む）
 */
function run(prBody, diffFiles = WORKFLOW, { script = SCRIPT, env = {} } = {}) {
  const result = spawnSync('bash', [script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      H5_PR_BODY: prBody,
      H5_DIFF_FILES: diffFiles,
      H5_LEDGER_PATH: path.join(dir, 'ledger.jsonl'),
      GITHUB_EVENT_PATH: '',
      H5_PR_NUMBER: '',
      ...env,
    },
  });
  return { status: result.status, out: `${result.stdout}${result.stderr}` };
}

/** スクリプトのコピーとファイルを置いた、リポジトリの形の一時ディレクトリを作る */
function fakeRepo(name, files, scriptText = readFileSync(SCRIPT, 'utf8')) {
  const root = path.join(dir, name);
  mkdirSync(path.join(root, 'scripts'), { recursive: true });
  writeFileSync(path.join(root, 'scripts/h5-admission-check.sh'), scriptText);
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), text);
  }
  return path.join(root, 'scripts/h5-admission-check.sh');
}

describe('H5: レジャー（台帳の配線）の証拠は、本文の言及だけでは通らない', SLOW, () => {
  it.each([
    ['guard-ledger.jsonl と書いてあるだけ（配線は無い、という否定の文）', 'この PR は guard-ledger.jsonl への配線は無い'],
    ['aidd_ledger_append と書いてあるだけ', 'aidd_ledger_append は使っていない'],
  ])('%s', (_, line) => {
    const { status, out } = run(body(line));
    expect(status).toBe(1);
    expect(out).toContain('ledger-wiring');
  });

  it('h5-admission を触る PR でも、本文に「ledger」と書くだけでは通らない', () => {
    const { status, out } = run(body('ledger の話をしているだけの行'), '.github/workflows/h5-admission.yml');
    expect(status).toBe(1);
    expect(out).toContain('ledger-wiring');
  });

  it('台帳の節の中身が 19 文字なら通らない（節も 20 文字以上）', () => {
    const { status, out } = run(body('## 台帳', jaText(19)));
    expect(status).toBe(1);
    expect(out).toContain('ledger-wiring');
  });

  it('陰性テストの節（Negative test）でも通る（節の名前は Python の正規表現で照合する）', () => {
    const noMarker = ['## Negative test', '直す前の入力では赤になり、直したあとは緑になることを、手元で 3 回くり返して確かめた', LEDGER, RETIRE, SUBTRACTION].join('\n');
    expect(run(noMarker).status).toBe(0);
  });

  it('H5-LEDGER: の行（20 文字以上）か、台帳の節（20 文字以上）があれば通る', () => {
    expect(run(body(LEDGER))).toMatchObject({ status: 0 });
    expect(run(body('## 台帳', '発火すると hooks/ledger/guard-ledger.jsonl に 1 行追記する（aidd_ledger_append）'))).toMatchObject({
      status: 0,
    });
  });
});

describe('H5: コードの証拠は、本当に台帳へ書き込むときだけ', SLOW, () => {
  it('コメントにしか書いていないフックは通らない（本文と同じ否定の文）', () => {
    const hook = [
      '#!/usr/bin/env bash',
      '# この hook は guard-ledger.jsonl への配線は無い（aidd_ledger_append も使わない）',
      '# check && aidd_ledger_append "g" "block"',
      '# echo x >>"$LEDGER_PATH"',
      'echo ok',
      '',
    ].join('\n');
    const script = fakeRepo('comment-only', { 'hooks/comment-only.sh': hook });
    const { status, out } = run(body(), 'hooks/comment-only.sh', { script });
    expect(status).toBe(1);
    expect(out).toContain('ledger-wiring');
  });

  it('大きなフック（パイプが途中で閉じても）でも、先頭の本当の呼び出しを数える', () => {
    const big = ['#!/usr/bin/env bash', 'aidd_ledger_append "guard" "block"', ...Array.from({ length: 4000 }, (_, i) => `echo line-${i} padding-padding-padding`)].join('\n');
    const script = fakeRepo('big-hook', { 'hooks/big.sh': `${big}\n` });
    expect(run(body(), 'hooks/big.sh', { script })).toMatchObject({ status: 0 });
  });

  it('aidd_ledger_append を呼ぶフックは通る', () => {
    const script = fakeRepo('real-call', { 'hooks/real-call.sh': '#!/usr/bin/env bash\naidd_ledger_append "guard" "block"\n' });
    expect(run(body(), 'hooks/real-call.sh', { script })).toMatchObject({ status: 0 });
  });

  it('検査のスクリプト自身は、台帳へ >> 追記する行があるので通り、その行を消すと通らない', () => {
    expect(run(body(), 'scripts/h5-admission-check.sh')).toMatchObject({ status: 0 });
    // 台帳への追記先だけを /dev/null に替える（行を消すと、行末の \ で続く printf の構文が壊れる）
    const withoutWrite = readFileSync(SCRIPT, 'utf8').replace('>>"$LEDGER_PATH"', '>/dev/null');
    expect(withoutWrite).not.toBe(readFileSync(SCRIPT, 'utf8'));
    const script = fakeRepo('no-write', {}, withoutWrite);
    const { status, out } = run(body(), 'scripts/h5-admission-check.sh', { script });
    expect(status).toBe(1);
    expect(out).toContain('ledger-wiring');
  });
});

describe('H5: マーカーの長さ（文字数で 20 文字以上・同じ行・ロケールによらない）', SLOW, () => {
  it.each([
    ['LEDGER', 19, 1],
    ['LEDGER', 20, 0],
    ['RETIRE', 19, 1],
    ['RETIRE', 20, 0],
  ])('H5-%s: の中身が日本語で %i 文字なら exit %i', (key, length, expected) => {
    const lines = { NEGATIVE, LEDGER, RETIRE, [key]: `H5-${key}: ${jaText(length)}` };
    expect(run([lines.NEGATIVE, lines.LEDGER, lines.RETIRE, SUBTRACTION].join('\n')).status).toBe(expected);
  });

  it('C ロケールでも、バイトではなく文字で数える（19 文字は通らない）', () => {
    const short = body(`H5-LEDGER: ${jaText(19)}`);
    expect(run(short, WORKFLOW, { env: { LC_ALL: 'C', LANG: 'C' } }).status).toBe(1);
    expect(run(body(`H5-LEDGER: ${jaText(20)}`), WORKFLOW, { env: { LC_ALL: 'C', LANG: 'C' } }).status).toBe(0);
  });

  it('中身が次の行にあるマーカーは数えない', () => {
    expect(run(body(`H5-LEDGER:\n${jaText(25)}`)).status).toBe(1);
  });

  it('コロンのあとの全角の空白は許す', () => {
    expect(run(body(`H5-LEDGER:　${jaText(25)}`)).status).toBe(0);
  });

  it('<...> のままのプレースホルダーは数えない', () => {
    expect(run(body('H5-LEDGER: <発火がaidd_ledger_appendまたはguard-ledger.jsonlへ届く経路>')).status).toBe(1);
  });

  it('H5-NEGATIVE の中身が 20 文字未満なら通らない', () => {
    const { status, out } = run(['H5-NEGATIVE: exit 1 で確認', LEDGER, RETIRE, SUBTRACTION].join('\n'));
    expect(status).toBe(1);
    expect(out).toContain('negative-test-evidence');
  });
});

describe('H5: 失敗のメッセージと、変えていない判定', SLOW, () => {
  it('失敗したら、見つかったマーカーの長さを出す（期待値だけでなく観測値も）', () => {
    const { status, out } = run([NEGATIVE, LEDGER, `H5-RETIRE: ${jaText(18)}`, SUBTRACTION].join('\n'));
    expect(status).toBe(1);
    expect(out).toContain('retirement-condition');
    expect(out).toContain('H5-RETIRE: longest 18 chars');
    expect(out).toContain('each needs >= 20 chars on the same line');
  });

  it('構造パスを触らず、ガードとも名乗らない PR は対象外', () => {
    const { status, out } = run('ふつうの PR', 'src/pages/index.astro');
    expect(status).toBe(0);
    expect(out).toContain('not a guard/verifier PR');
  });
});
