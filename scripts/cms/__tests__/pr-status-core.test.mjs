// @vitest-environment node
/**
 * CMS の PR の状態通知（scripts/cms/pr-status-core.mjs）の判定と文面。
 * 実データでの確認: `node scripts/cms/pr-status.mjs --pr 367 --dry-run`（ready）と `--sha <226ce9a の SHA>`（failed）。
 */
import { describe, expect, it } from 'vitest';
import {
  computeState,
  lastMarker,
  latestByName,
  latestWatchedRuns,
  previewUrlOf,
  renderComment,
  shouldNotify,
} from '../pr-status-core.mjs';

const PR = 367;
const PREVIEW = 'https://cor-jp-main--pr367-cms-blog-test-rqns7z21.web.app';
const SHA = '9006d1827e9bc06bd6d2d99596e0c0a41e21caef';
const status = (conclusion) => (conclusion === null ? 'in_progress' : 'completed');
const check = (id, name, conclusion, extra = {}) => ({
  id,
  name,
  status: status(conclusion),
  conclusion,
  html_url: `https://github.com/o/r/actions/runs/1/job/${id}`,
  ...extra,
});
const WATCHED = ['CI', 'Responsive visual text', 'H5 Admission', 'Deploy to Firebase Hosting', 'Translate content (i18n)'];
const run = (id, name, conclusion, extra = {}) => ({
  id,
  name,
  workflow_id: WATCHED.includes(name) ? 1000 + WATCHED.indexOf(name) : 1999,
  event: 'pull_request',
  status: status(conclusion),
  conclusion,
  html_url: `https://github.com/o/r/actions/runs/${id}`,
  ...extra,
});
const greenChecks = [
  check(1, 'h5-admission', 'success'),
  check(2, 'verify', 'success'),
  check(3, 'Chromium visual text audit', 'success'),
  check(4, 'i18n-check', 'success'),
  check(5, 'Deploy Preview', 'success', { output: { summary: `[${PREVIEW}](${PREVIEW})` } }),
];
const greenRuns = WATCHED.map((name, i) => run(100 + i, name, 'success'));
const ARTICLE = [{ filename: 'src/content/blog/ja/test.md' }];
const stateOf = (overrides = {}) =>
  computeState({ checkRuns: greenChecks, workflowRuns: greenRuns, files: ARTICLE, prNumber: PR, ...overrides });
const without = (items, name) => items.filter((item) => item.name !== name);

describe('computeState: 承認待ちと、ワークフローが終わるまで', () => {
  it('見ているワークフローがすべて終わり、必須チェックと翻訳の検査が通れば ready（この PR のプレビューの URL 付き）', () => {
    expect(stateOf()).toEqual({ state: 'ready', translation: 'ok', preview: { status: 'ok', url: PREVIEW } });
  });

  it('翻訳 CI のコミットで、ワークフローが action_required なら needs-approval（承認を待つ run へのリンク付き）', () => {
    expect(stateOf({ checkRuns: [], workflowRuns: [run(200, 'CI', 'action_required')] })).toEqual({
      state: 'needs-approval',
      waiting: [{ name: 'CI', conclusion: 'action_required', url: 'https://github.com/o/r/actions/runs/200' }],
    });
  });

  it('PR の本文の編集で H5 Admission が走り直したら、同じコミットの古い action_required の run は数えない', () => {
    const workflowRuns = [...without(greenRuns, 'H5 Admission'), run(90, 'H5 Admission', 'action_required'), run(300, 'H5 Admission', 'success')];
    expect(stateOf({ workflowRuns }).state).toBe('ready');
  });

  it('workflow_dispatch の新しい run（翻訳 CI が起こす i18n-check）があっても、pull_request の承認待ちは隠れない', () => {
    const translate = 'Translate content (i18n)';
    const workflowRuns = [...without(greenRuns, translate), run(90, translate, 'action_required'), run(300, translate, 'success', { event: 'workflow_dispatch' })];
    expect(stateOf({ workflowRuns }).state).toBe('needs-approval');
  });

  it('ワークフローが動いている間は、チェックが緑でも pending（翻訳の途中で「公開できます」と書かない）', () => {
    const workflowRuns = [...without(greenRuns, 'Translate content (i18n)'), run(300, 'Translate content (i18n)', null)];
    expect(stateOf({ workflowRuns })).toEqual({ state: 'pending' });
  });

  it('見ていないワークフローは数えない（動いていても、承認待ちでも）', () => {
    const workflowRuns = [...greenRuns, run(400, 'Claude Code', null), run(401, 'Guard base branch', 'action_required')];
    expect(stateOf({ workflowRuns }).state).toBe('ready');
  });
});

describe('computeState: 失敗と公開できる', () => {
  const failing = [
    check(11, 'verify', 'failure'),
    check(12, 'Chromium visual text audit', 'failure'),
    check(13, 'i18n-check', 'failure'),
    check(14, 'h5-admission', 'success'),
  ];

  it('失敗は、ワークフローがすべて終わってから、まとめて 1 回で知らせる', () => {
    const running = [...without(greenRuns, 'Responsive visual text'), run(300, 'Responsive visual text', null)];
    expect(stateOf({ checkRuns: failing, workflowRuns: running }).state).toBe('pending');
    const result = stateOf({ checkRuns: failing });
    expect(result.state).toBe('failed');
    expect(result.translation).toBe('failed');
    expect(result.failed.map(({ name }) => name)).toEqual(['verify', 'Chromium visual text audit', 'i18n-check']);
  });

  it('cancelled は失敗にしない（同じコミットで走り直したとき）。新しい run の結果で決める', () => {
    const cancelled = [...without(greenChecks, 'verify'), check(20, 'verify', 'cancelled')];
    expect(stateOf({ checkRuns: cancelled }).state).toBe('pending');
    expect(stateOf({ checkRuns: [...cancelled, check(21, 'verify', 'success')] }).state).toBe('ready');
  });

  it('ブランチ保護と同じく、必須チェックの skipped と neutral は通過とみなす', () => {
    const checkRuns = [...greenChecks.slice(2), check(30, 'h5-admission', 'skipped'), check(31, 'verify', 'neutral')];
    expect(stateOf({ checkRuns }).state).toBe('ready');
  });

  it('書式だけ直した記事（PR の差分は ja だけで、翻訳は作り直されない）でも、i18n-check が通れば翻訳はそろっている', () => {
    const result = stateOf({ files: [{ filename: 'src/content/blog/ja/existing-post.md' }] });
    expect(result.translation).toBe('ok');
    expect(renderComment({ result, sha: SHA, isDraft: false })).toContain('英・中・韓・西の 4 言語がそろっていて');
  });

  it('src/content/ を変える PR で、i18n-check がまだ無いうちは pending', () => {
    expect(stateOf({ checkRuns: without(greenChecks, 'i18n-check') })).toEqual({ state: 'pending' });
  });

  it('src/content/ を変えない PR は、i18n-check を待たない', () => {
    const result = stateOf({ checkRuns: without(greenChecks, 'i18n-check'), files: [{ filename: 'public/images/blog/a.webp' }] });
    expect(result).toMatchObject({ state: 'ready', translation: 'none' });
  });

  it('プレビューの配信が失敗しても止まらず、公開できると知らせる（プレビューが作れなかったことも書く）', () => {
    const checkRuns = [...without(greenChecks, 'Deploy Preview'), check(40, 'Deploy Preview', 'failure')];
    expect(stateOf({ checkRuns }).preview).toEqual({
      status: 'failed',
      check: { name: 'Deploy Preview', conclusion: 'failure', url: 'https://github.com/o/r/actions/runs/1/job/40' },
    });
  });

  it('同じチェックが再実行で成功していれば、古い失敗は数えない', () => {
    expect(stateOf({ checkRuns: [check(10, 'verify', 'failure'), ...greenChecks.map((c) => ({ ...c, id: c.id + 100 }))] }).state).toBe('ready');
  });

  it('必須でないチェック（translate など）の失敗では failed にしない', () => {
    expect(stateOf({ checkRuns: [...greenChecks, check(9, 'translate', 'failure')] }).state).toBe('ready');
  });
});

describe('latestByName・latestWatchedRuns・previewUrlOf', () => {
  it('同じ名前の check run は id が大きいものを残す', () => {
    expect(latestByName([check(5, 'verify', 'success'), check(3, 'verify', 'failure')]).get('verify').id).toBe(5);
  });

  it('workflow run は、見ているワークフローだけを、ワークフロー × イベントごとに新しいものだけ残す', () => {
    const runs = [run(1, 'CI', 'failure'), run(2, 'CI', 'success'), run(3, 'CI', 'success', { event: 'workflow_dispatch' }), run(4, 'Claude Code', 'success')];
    expect(latestWatchedRuns(runs).map(({ id }) => id).sort()).toEqual([2, 3]);
  });

  it('プレビューの URL は、このサイトの、この PR のプレビューチャネルの形だけを受け付ける', () => {
    const of = (summary) => previewUrlOf({ output: { summary } }, PR);
    expect(of(`[${PREVIEW}](${PREVIEW})`)).toBe(PREVIEW);
    expect(of('https://cor-jp-main--pr368-cms-blog-other-abc123.web.app')).toBeNull();
    expect(of('https://attacker-proj--pr367-phish.web.app')).toBeNull();
    expect(of(`${PREVIEW}.evil.example/`)).toBeNull();
    expect(of('https://evil.example/phish')).toBeNull();
    expect(previewUrlOf(undefined, PR)).toBeNull();
  });
});

describe('shouldNotify と lastMarker', () => {
  const marker = (state, sha = SHA) => ({ body: `<!-- cms-pr-status: ${state} ${sha.slice(0, 12)} -->\n本文` });

  it('pending は知らせない', () => {
    expect(shouldNotify([], 'pending', SHA)).toBe(false);
  });

  it('最後に書いた状態・コミットと同じなら知らせない。状態かコミットが違えば知らせる', () => {
    expect(shouldNotify([marker('ready')], 'ready', SHA)).toBe(false);
    expect(shouldNotify([marker('ready')], 'failed', SHA)).toBe(true);
    expect(shouldNotify([marker('ready')], 'ready', 'abcdef1234567890abcdef1234567890abcdef12')).toBe(true);
  });

  it('失敗 → 公開できる → 再実行でまた失敗、は知らせる（最後の目印とだけ比べる）', () => {
    expect(shouldNotify([marker('failed'), marker('ready')], 'failed', SHA)).toBe(true);
  });

  it('目印の無いコメントは飛ばし、最後の目印を返す', () => {
    expect(lastMarker([marker('failed'), { body: '人のコメント' }, marker('ready'), { body: null }])).toEqual({ state: 'ready', sha: SHA.slice(0, 12) });
    expect(lastMarker([{ body: '人のコメント' }])).toBeNull();
  });
});

describe('renderComment', () => {
  const failed = [
    { name: 'verify', conclusion: 'failure', url: 'https://github.com/o/r/actions/runs/1/job/2' },
    { name: 'i18n-check', conclusion: 'failure', url: 'https://github.com/o/r/actions/runs/1/job/3' },
  ];

  it('ready: 目印・チェック・翻訳・プレビュー・公開できる人を書く', () => {
    const body = renderComment({ result: stateOf(), sha: SHA, isDraft: false });
    expect(body.split('\n')[0]).toBe('<!-- cms-pr-status: ready 9006d1827e9b -->');
    expect(body).toContain('**公開できます**');
    expect(body).toContain('i18n-check: 成功');
    expect(body).toContain(`- プレビュー: ${PREVIEW}`);
    expect(body).toContain('@terisuke @cloudia-Cor');
  });

  it('リンクは Markdown のリンクにする（URL の直後に全角の括弧を置くと、GitHub はそこまでリンクにする）', () => {
    const body = renderComment({ result: { state: 'failed', failed, translation: 'failed' }, sha: SHA, isDraft: false });
    expect(body).toContain('- [verify](https://github.com/o/r/actions/runs/1/job/2): failure');
    expect(body).not.toMatch(/https:\/\/[^\s)]*[（）]/);
  });

  it('GitHub 以外の URL はリンクにしない', () => {
    const body = renderComment({ result: { state: 'failed', failed: [{ name: 'verify', conclusion: 'failure', url: 'https://evil.example/x' }], translation: 'none' }, sha: SHA, isDraft: false });
    expect(body).toContain('- verify: failure');
    expect(body).not.toContain('evil.example');
  });

  it('needs-approval: 承認を待つワークフローへのリンクと、公開できる人への依頼を書く', () => {
    const waiting = [{ name: 'CI', conclusion: 'action_required', url: 'https://github.com/o/r/actions/runs/200' }];
    const body = renderComment({ result: { state: 'needs-approval', waiting }, sha: SHA, isDraft: false });
    expect(body).toContain('- [CI](https://github.com/o/r/actions/runs/200)');
    expect(body).toContain('@terisuke @cloudia-Cor');
    expect(body).toContain('Approve workflows to run');
    expect(body).toContain('docs/i18n-translation.md の 6 章');
  });

  it('failed: 失敗したチェック・翻訳の状態と、下書きなら空にできない欄の案内を書く', () => {
    const result = { state: 'failed', failed, translation: 'failed' };
    const draft = renderComment({ result, sha: SHA, isDraft: true });
    expect(draft).toContain('- 翻訳: 検査が通っていません');
    expect(draft).toContain('カテゴリ・タイトル・概要・公開日のどれかが空だと');
    expect(renderComment({ result, sha: SHA, isDraft: false })).not.toContain('下書き');
  });

  it('プレビューが作れなかったときは、そのことと、失敗したチェックへのリンクを書く', () => {
    const checkRuns = [...without(greenChecks, 'Deploy Preview'), check(40, 'Deploy Preview', 'failure')];
    const body = renderComment({ result: stateOf({ checkRuns }), sha: SHA, isDraft: false });
    expect(body).toContain('- プレビュー: 作れませんでした（必須チェックではないので、公開はできます）');
    expect(body).toContain('[Deploy Preview](https://github.com/o/r/actions/runs/1/job/40): failure');
  });
});
