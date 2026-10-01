// @vitest-environment node
/**
 * CMS の PR の状態通知（scripts/cms/pr-status.mjs）の、GitHub とのやり取り。gh api は偽物に差し替える。
 * 判定と文面は pr-status-core.test.mjs。ここでは、どの PR を選ぶか・いつコメントしないかを照合する。
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseOptions, run } from '../pr-status.mjs';

const OLD = 'a'.repeat(40);
const NEW = 'b'.repeat(40);
const pullOf = (sha, { number = 42, ref = 'cms/blog/test', repo = 'o/r', ...extra } = {}) => ({
  number,
  state: 'open',
  labels: [],
  head: { ref, sha, repo: { full_name: repo } },
  base: { repo: { full_name: 'o/r' } },
  ...extra,
});
const completed = (id, name, extra = {}) => ({
  id,
  name,
  status: 'completed',
  conclusion: 'success',
  html_url: `https://github.com/o/r/actions/runs/${id}`,
  ...extra,
});
const TRANSLATE_SUITE = 77;
const CHECKS = [
  ...['h5-admission', 'verify', 'Chromium visual text audit'].map((name, i) => completed(i + 1, name)),
  completed(4, 'i18n-check', { check_suite: { id: TRANSLATE_SUITE } }),
];
const RUNS = [
  completed(10, 'CI', { event: 'pull_request', workflow_id: 1, check_suite_id: 70 }),
  completed(11, 'Translate content (i18n)', { event: 'pull_request', workflow_id: 2, check_suite_id: TRANSLATE_SUITE }),
];
const PREFIX = 'repos/{owner}/{repo}/';

/** gh api の偽物。エンドポイントで答えを選び、呼ばれた引数を残す。PR の取得（pulls/<番号>）には reads を順に返す */
function fakeGh({ reads = [pullOf(OLD)], open = [pullOf(OLD)], comments = [] } = {}) {
  const calls = [];
  const answer = (path) => {
    if (/^pulls\/\d+$/.test(path)) return reads[Math.min(calls.filter((args) => args.includes(`${PREFIX}${path}`)).length - 1, reads.length - 1)];
    if (path.startsWith('pulls?')) return [open];
    if (path.includes('/check-runs?')) return [{ check_runs: CHECKS }];
    if (path.startsWith('actions/runs?')) return [{ workflow_runs: RUNS }];
    if (path.includes('/files?')) return [[{ filename: 'src/content/blog/ja/test.md' }]];
    if (path.includes('/comments?')) return [comments];
    throw new Error(`想定していない呼び出し: ${path}`);
  };
  const gh = async (args) => {
    calls.push(args);
    if (args.includes('POST')) return { id: 1 };
    const path = args.find((arg) => arg.startsWith(PREFIX)).slice(PREFIX.length);
    // 一覧（クエリ付き）は全ページを 1 つにまとめて取る。1 件の取得には付けない
    if (path.includes('?') !== (args.includes('--paginate') && args.includes('--slurp'))) {
      throw new Error(`一覧は --paginate --slurp で取る: ${args.join(' ')}`);
    }
    return answer(path);
  };
  return { gh, posts: () => calls.filter((args) => args.includes('POST')) };
}

async function runWith(args, fake) {
  const lines = [];
  await run(args, { gh: fake.gh, out: (line) => lines.push(line) });
  return lines;
}

describe('pr-status.mjs: コメントするとき・しないとき', () => {
  it('HEAD が同じなら、目印付きでコメントする', async () => {
    const fake = fakeGh();
    const lines = await runWith(['--pr', '42'], fake);
    expect(fake.posts()).toHaveLength(1);
    const [, , endpoint, , body] = fake.posts()[0];
    expect(endpoint).toBe(`${PREFIX}issues/42/comments`);
    expect(body.split('\n')[0]).toBe(`body=<!-- cms-pr-status: ready ${OLD.slice(0, 12)} -->`);
    expect(lines.at(-1)).toBe('#42 にコメントしました（ready）');
  });

  it('判定のあいだに CMS で保存し直されて HEAD が変わったら、古いコミットの結果ではコメントしない', async () => {
    const fake = fakeGh({ reads: [pullOf(OLD), pullOf(NEW)] });
    const lines = await runWith(['--pr', '42'], fake);
    expect(fake.posts()).toEqual([]);
    expect(lines.at(-1)).toContain('判定のあいだに PR が更新されたので、コメントしません');
  });

  it('判定のあいだに PR が閉じられたら、コメントしない', async () => {
    const fake = fakeGh({ reads: [pullOf(OLD), pullOf(OLD, { state: 'closed' })] });
    await runWith(['--pr', '42'], fake);
    expect(fake.posts()).toEqual([]);
  });

  it('最後に同じ状態を書いていればコメントしない。人が書いた目印では止まらない', async () => {
    const marker = `<!-- cms-pr-status: ready ${OLD.slice(0, 12)} -->`;
    const byBot = fakeGh({ comments: [{ user: { login: 'github-actions[bot]' }, body: marker }] });
    expect(await runWith(['--pr', '42'], byBot)).toEqual([`#42 ${OLD.slice(0, 7)} state=ready notify=false`]);
    expect(byBot.posts()).toEqual([]);
    const byHuman = fakeGh({ comments: [{ user: { login: 'terisuke' }, body: marker }] });
    await runWith(['--pr', '42'], byHuman);
    expect(byHuman.posts()).toHaveLength(1);
  });

  it('--dry-run ではコメントせず、文面を表示する', async () => {
    const fake = fakeGh();
    const lines = await runWith(['--pr', '42', '--dry-run'], fake);
    expect(fake.posts()).toEqual([]);
    expect(lines[1]).toContain('**公開できます**');
  });
});

describe('pr-status.mjs: 対象の PR を選ぶ', () => {
  it('--branch: 開いている PR から、同じリポジトリのそのブランチの PR を選ぶ（フォークの同じ名前のブランチは選ばない）', async () => {
    const open = [
      pullOf(OLD, { number: 7, ref: 'cms/blog/other' }),
      pullOf(OLD, { number: 8, repo: 'someone/fork' }),
      pullOf(OLD),
    ];
    const fake = fakeGh({ open });
    await runWith(['--branch', 'cms/blog/test'], fake);
    expect(fake.posts().map((args) => args[2])).toEqual([`${PREFIX}issues/42/comments`]);
  });

  it('--branch に合う、開いている PR が無ければ何もしない', async () => {
    const fake = fakeGh({ open: [pullOf(OLD, { number: 8, repo: 'someone/fork' })] });
    expect(await runWith(['--branch', 'cms/blog/test'], fake)).toEqual(['cms/blog/test: 開いている PR が無いので、何もしません']);
    expect(fake.posts()).toEqual([]);
  });

  it.each([
    ['cms/ 以外のブランチ', pullOf(OLD, { ref: 'feat/x' })],
    ['フォークの PR', pullOf(OLD, { repo: 'someone/fork' })],
    ['閉じた PR', pullOf(OLD, { state: 'closed' })],
  ])('--pr: %sには何もしない', async (_, pull) => {
    const fake = fakeGh({ reads: [pull] });
    expect(await runWith(['--pr', '42'], fake)).toEqual([
      '#42: 開いている CMS の PR（このリポジトリの cms/ ブランチ）ではないので、何もしません',
    ]);
    expect(fake.posts()).toEqual([]);
  });
});

describe('node で直接動かす', () => {
  it('シンボリックリンクを通したパス（macOS の /tmp など）で動かしても、黙って終わらない', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'cms-pr-status-'));
    try {
      const link = path.join(dir, 'pr-status.mjs');
      symlinkSync(path.join(process.cwd(), 'scripts/cms/pr-status.mjs'), link);
      const result = spawnSync(process.execPath, [link, '--pr', 'oops'], { encoding: 'utf8' });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('--pr には PR の番号を渡してください（oops）');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('parseOptions', () => {
  it.each([
    [['--pr', '42; rm -rf /'], '--pr には PR の番号を渡してください'],
    [['--pr', '0'], '--pr には PR の番号を渡してください'],
    [['--pr', '42', '--sha', OLD], '--sha は --dry-run のときだけ使えます'],
    [[], '--pr <番号> か --branch <ブランチ名> を渡してください'],
  ])('%j は止める', (args, message) => {
    expect(() => parseOptions(args)).toThrow(message);
  });
});
