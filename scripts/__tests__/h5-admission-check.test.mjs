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
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
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
    timeout: CHILD_TIMEOUT,
    env: isolatedEnv({
      H5_PR_BODY: prBody,
      H5_DIFF_FILES: diffFiles,
      H5_LEDGER_PATH: path.join(dir, 'ledger.jsonl'),
      GITHUB_EVENT_PATH: '',
      H5_PR_NUMBER: '',
      ...env,
    }),
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

/** 一時ディレクトリの git（利用者の ~/.gitconfig・フック・署名の設定を読まない） */
const GIT_ENV = {
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'h5-test',
  GIT_AUTHOR_EMAIL: 'h5-test@example.com',
  GIT_COMMITTER_NAME: 'h5-test',
  GIT_COMMITTER_EMAIL: 'h5-test@example.com',
};
/**
 * 呼び出し元の GIT_*（git rebase -x やフックは GIT_DIR・GIT_WORK_TREE・GIT_INDEX_FILE を渡す）と H5_DIFF_FILES を
 * 引き継がない。引き継ぐと、cwd ではなく呼び出し元の repo にコミットや fetch をしてしまう（#378 のレビュー）
 */
const isolatedEnv = (extra = {}) => ({
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_') && key !== 'H5_DIFF_FILES')),
  ...GIT_ENV,
  ...extra,
});
/** 同期の子プロセスは vitest のタイムアウトで止められないので、自分で時間を切る */
const CHILD_TIMEOUT = 20_000;
function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', env: isolatedEnv(), timeout: CHILD_TIMEOUT });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} (${cwd}): ${result.stderr}`);
  return result.stdout.trim();
}
function commitFile(repo, file, text, message) {
  mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
  writeFileSync(path.join(repo, file), text);
  git(repo, 'add', file);
  git(repo, 'commit', '-q', '-m', message);
}

/**
 * 完全なクローン（CI の checkout は fetch-depth: 0。手元のクローンも完全）で、PR を分けたあとに origin の develop が
 * ワークフローを変えて進んだ形を作る。PR は prFile だけを変える。スクリプトのコピーをクローンに置いて返す。
 */
function cloneWithMovedBase(name, prFile) {
  const root = path.join(dir, name);
  const origin = path.join(root, 'origin.git');
  const work = path.join(root, 'work');
  const clone = path.join(root, 'clone');
  mkdirSync(root, { recursive: true });
  git(root, 'init', '-q', '--bare', '-b', 'develop', origin);
  git(root, 'init', '-q', '-b', 'develop', work);
  commitFile(work, 'README.md', 'base\n', 'base');
  git(work, 'push', '-q', `file://${origin}`, 'develop');
  git(root, 'clone', '-q', `file://${origin}`, clone);
  git(clone, 'switch', '-q', '-c', 'feature');
  commitFile(clone, prFile, 'change\n', 'pr');
  commitFile(work, '.github/workflows/moved-base.yml', 'name: moved\n', 'develop moved on');
  git(work, 'push', '-q', `file://${origin}`, 'develop');
  mkdirSync(path.join(clone, 'scripts'), { recursive: true });
  writeFileSync(path.join(clone, 'scripts/h5-admission-check.sh'), readFileSync(SCRIPT, 'utf8'));
  return { clone, work, script: path.join(clone, 'scripts/h5-admission-check.sh') };
}

/** H5_DIFF_FILES を渡さずに動かす（スクリプトが origin から base を取り、git diff で差分を出す） */
function runWithoutDiffFiles(script, extra = {}) {
  const result = spawnSync('bash', [script], {
    encoding: 'utf8',
    timeout: CHILD_TIMEOUT,
    env: isolatedEnv({
      H5_PR_BODY: '',
      H5_BASE_REF: 'origin/develop',
      H5_HEAD_REF: 'HEAD',
      H5_LEDGER_PATH: path.join(dir, 'ledger.jsonl'),
      GITHUB_EVENT_PATH: '',
      H5_PR_NUMBER: '',
      ...extra,
    }),
  });
  return { status: result.status, out: `${result.stdout}${result.stderr}` };
}
/** 台帳の行の rule の一覧（ファイルが無ければ空） */
function ledgerRules(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line).rule);
}
/** スクリプトを動かし、クローンが浅くなったか・origin/develop・結果をまとめて返す（赤のときに全部が出るように） */
function observe(clone, script, extra = {}) {
  const { status, out } = runWithoutDiffFiles(script, extra);
  let originDevelop = '(none)';
  try {
    originDevelop = git(clone, 'rev-parse', 'origin/develop');
  } catch {
    // --single-branch のクローンで base を取れなかったとき
  }
  return {
    shallow: git(clone, 'rev-parse', '--is-shallow-repository'),
    originDevelop,
    status,
    out,
  };
}

/**
 * 2026-10-01 まで、スクリプトは base をいつも git fetch --depth=1 で取っていた。完全なクローンでもその先端が
 * .git/shallow に入り、(1) 手元では、同じ .git を使う全 worktree の履歴が途中で切れて見えた (2) base の先端が、HEAD の
 * 元になったコミット（CI ではテスト用のマージコミットの 1 つ目の親。手元では PR を分けた点）と違うと merge base が
 * 見つからず、2 点の diff に落ちて、develop 側のワークフローの変更を PR の変更と取り違えていた。
 */
describe('H5: 完全なクローンでは、base を浅く取らない（H5_DIFF_FILES を渡さないとき）', SLOW, () => {
  it('develop が進んでも、クローンは浅くならず、PR の変更だけを見る（develop 側のワークフローの変更で落ちない）', () => {
    const { clone, work, script } = cloneWithMovedBase('moved-base-docs', 'docs/note.md');
    expect(observe(clone, script)).toMatchObject({
      shallow: 'false',
      originDevelop: git(work, 'rev-parse', 'HEAD'),
      status: 0,
      out: expect.stringContaining('not a guard/verifier PR'),
    });
  });

  it('develop を取り込んだ PR（update-branch のあと）でも、develop 側の変更を数えない', () => {
    // PR のコミットが 1 つだけだと、3 点の diff と HEAD~1...HEAD の代わりの diff が同じになり、見分けられない
    const { clone, script } = cloneWithMovedBase('moved-base-updated', 'docs/note.md');
    git(clone, 'fetch', '-q', 'origin');
    git(clone, 'merge', '-q', '--no-edit', 'origin/develop');
    expect(observe(clone, script)).toMatchObject({ shallow: 'false', status: 0, out: expect.stringContaining('not a guard/verifier PR') });
  });

  it('CI の形（develop に PR を重ねたテスト用のマージコミットに detached。その後に develop が進んだ）でも、PR の変更だけを見る', () => {
    // クローンの origin/develop は、PR を分けたときの先端のまま（スクリプトが進んだ先端を fetch する）
    const { clone, script } = cloneWithMovedBase('moved-base-merge-ref', 'docs/note.md');
    git(clone, 'switch', '-q', '--detach', 'origin/develop');
    git(clone, 'merge', '-q', '--no-ff', '--no-edit', 'feature');
    expect(observe(clone, script)).toMatchObject({ shallow: 'false', status: 0, out: expect.stringContaining('not a guard/verifier PR') });
  });

  it('--single-branch のクローンでも base を取り、PR の前のコミットのワークフローの変更を見落とさない', () => {
    // ブランチ名だけの fetch は --single-branch では FETCH_HEAD しか動かさず、origin/develop が無いまま
    // HEAD~1...HEAD（最後のコミットだけ）を見て、前のコミットのワークフローの変更を見落としていた
    const { clone: full } = cloneWithMovedBase('single-branch', '.github/workflows/pr.yml');
    commitFile(full, 'docs/note.md', 'more\n', 'docs');
    git(full, 'push', '-q', 'origin', 'feature');
    const single = path.join(dir, 'single-branch', 'single');
    git(dir, 'clone', '-q', '--single-branch', '-b', 'feature', `file://${path.join(dir, 'single-branch', 'origin.git')}`, single);
    mkdirSync(path.join(single, 'scripts'), { recursive: true });
    writeFileSync(path.join(single, 'scripts/h5-admission-check.sh'), readFileSync(SCRIPT, 'utf8'));
    expect(observe(single, path.join(single, 'scripts/h5-admission-check.sh'))).toMatchObject({
      status: 1,
      out: expect.stringContaining('H5: structural paths in the diff: .github/workflows/pr.yml'),
    });
  });

  it('merge base が無く 2 点の diff に落ちるときは、そのことを警告する（誤検知とログで見分けるため）', () => {
    const { clone, script } = cloneWithMovedBase('no-merge-base', 'docs/note.md');
    git(clone, 'switch', '-q', '--orphan', 'unrelated');
    commitFile(clone, 'docs/other.md', 'other\n', 'unrelated history');
    expect(observe(clone, script).out).toContain('three-dot diff origin/develop...HEAD failed (no merge base?): falling back to a two-dot diff');
  });

  it('差分をどちらの形でも取れないときは、ガードの PR でないとして通さず止める（fail closed）', () => {
    // 空の差分は「構造パスを触らない PR」と同じに見え、どの PR も通ってしまう（例: H5_HEAD_REF の打ち間違い）
    const { clone, script } = cloneWithMovedBase('bad-head-ref', '.github/workflows/pr.yml');
    const ledger = path.join(dir, 'bad-head-ref.jsonl');
    expect(observe(clone, script, { H5_HEAD_REF: 'no-such-ref', H5_LEDGER_PATH: ledger })).toMatchObject({
      status: 1,
      out: expect.stringContaining('cannot diff origin/develop against no-such-ref'),
    });
    // 止めたことは台帳にも残す（ほかの止め方と同じ）
    expect(ledgerRules(ledger)).toEqual(['diff-unavailable']);
  });

  it('base を解決できないときも止める（H5_BASE_REF の打ち間違い。HEAD~1...HEAD は最後のコミットしか見ない）', () => {
    // PR の前のコミットでワークフローを変え、あとのコミットで docs を足す。最後のコミットだけを見ると、ガードの PR と気づかない
    const { clone, script } = cloneWithMovedBase('bad-base-ref', '.github/workflows/pr.yml');
    commitFile(clone, 'docs/note.md', 'more\n', 'docs');
    const ledger = path.join(dir, 'bad-base-ref.jsonl');
    expect(observe(clone, script, { H5_BASE_REF: 'origin/no-such-base', H5_LEDGER_PATH: ledger })).toMatchObject({
      status: 1,
      out: expect.stringContaining('cannot resolve origin/no-such-base'),
    });
    expect(ledgerRules(ledger)).toEqual(['diff-unavailable']);
  });

  it('H5_DIFF_FILES はグロブとして展開しない（hooks/[x].sh を hooks/x.sh と読まない）', () => {
    const script = fakeRepo('glob-literal', { 'hooks/x.sh': '#!/usr/bin/env bash\naidd_ledger_append "guard" "block"\n' });
    // 展開すると、存在しない hooks/[x].sh の代わりに hooks/x.sh を台帳の証拠として読んでしまう
    expect(run(body(), 'hooks/[x].sh', { script })).toMatchObject({ status: 1, out: expect.stringContaining('ledger-wiring') });
  });

  it('呼び出し元の GIT_DIR を引き継がない（git rebase -x などで渡されても、その repo を書き換えない）', () => {
    const sentinel = path.join(dir, 'sentinel');
    git(dir, 'init', '-q', '-b', 'main', sentinel);
    commitFile(sentinel, 'keep.txt', 'keep\n', 'sentinel');
    const before = git(sentinel, 'log', '--format=%H %s');
    const saved = process.env.GIT_DIR;
    process.env.GIT_DIR = path.join(sentinel, '.git');
    let result;
    try {
      // ワークフローを変える PR にして、スクリプトの結果も照合する。漏れた GIT_DIR でスクリプトが番兵の repo を
      // 見ると、差分が空になって exit 0 で通ってしまう（番兵の log は変わらないので、log だけでは捕まらない）
      const { script } = cloneWithMovedBase('git-dir-inherited', '.github/workflows/pr.yml');
      result = runWithoutDiffFiles(script);
    } finally {
      if (saved === undefined) delete process.env.GIT_DIR;
      else process.env.GIT_DIR = saved;
    }
    expect({ sentinelLog: git(sentinel, 'log', '--format=%H %s'), status: result.status, out: result.out }).toMatchObject({
      sentinelLog: before,
      status: 1,
      out: expect.stringContaining('H5: structural paths in the diff: .github/workflows/pr.yml'),
    });
  });

  it('PR 自身がワークフローを変えたときは、ガードの PR として照合する（差分が空にならない）', () => {
    const { clone, script } = cloneWithMovedBase('moved-base-workflow', '.github/workflows/pr.yml');
    expect(observe(clone, script)).toMatchObject({
      shallow: 'false',
      status: 1,
      out: expect.stringContaining('H5: structural paths in the diff: .github/workflows/pr.yml'),
    });
  });

  it('CI の checkout は完全なクローン（h5-admission.yml の fetch-depth: 0）。浅いと merge base が無く、2 点の diff に落ちる', () => {
    const workflow = yaml.load(readFileSync(path.join(process.cwd(), '.github/workflows/h5-admission.yml'), 'utf8'));
    const steps = Object.values(workflow.jobs).flatMap((job) => job.steps ?? []);
    const checkout = steps.find((step) => /^actions\/checkout@/.test(step.uses ?? ''));
    expect(
      checkout?.with?.['fetch-depth'],
      '.github/workflows/h5-admission.yml の checkout の fetch-depth（scripts/h5-admission-check.sh は完全な履歴の merge base で差分を取る）'
    ).toBe(0);
  });
});
