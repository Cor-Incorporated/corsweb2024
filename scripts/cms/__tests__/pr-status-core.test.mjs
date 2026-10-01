// @vitest-environment node
/**
 * CMS の PR の状態通知（scripts/cms/pr-status-core.mjs）の判定と文面。
 * 実データでの確認: `node scripts/cms/pr-status.mjs --pr 367 --dry-run`（ready）と `--sha 226ce9a`（failed）。
 */
import { describe, expect, it } from 'vitest';
import {
  computeState,
  latestByName,
  previewUrlOf,
  renderComment,
  shouldNotify,
  translationsOf,
} from '../pr-status-core.mjs';

const PREVIEW = 'https://cor-jp-main--pr367-cms-blog-test-rqns7z21.web.app';
const check = (id, name, conclusion, extra = {}) => ({
  id,
  name,
  status: conclusion === null ? 'in_progress' : 'completed',
  conclusion,
  html_url: `https://github.com/o/r/runs/${id}`,
  ...extra,
});
const allGreen = [
  check(1, 'h5-admission', 'success'),
  check(2, 'verify', 'success'),
  check(3, 'Chromium visual text audit', 'success'),
  check(4, 'Deploy Preview', 'success', { output: { summary: `[${PREVIEW}](${PREVIEW})` } }),
];

describe('computeState', () => {
  it('必須チェックがすべて成功し、プレビューができたら ready（プレビューの URL 付き）', () => {
    expect(computeState({ checkRuns: allGreen, workflowRuns: [] })).toEqual({ state: 'ready', previewUrl: PREVIEW });
  });

  it('翻訳 CI のコミットで、チェックが無くワークフローが action_required なら needs-approval', () => {
    const workflowRuns = [{ name: 'CI', conclusion: 'action_required', html_url: 'https://github.com/o/r/actions/runs/9' }];
    expect(computeState({ checkRuns: [], workflowRuns })).toEqual({
      state: 'needs-approval',
      waiting: [{ name: 'CI', url: 'https://github.com/o/r/actions/runs/9' }],
    });
  });

  it('必須チェックが失敗していれば、承認待ちがあっても failed', () => {
    const checkRuns = [check(1, 'verify', 'failure')];
    const workflowRuns = [{ name: 'CI', conclusion: 'action_required', html_url: 'x' }];
    expect(computeState({ checkRuns, workflowRuns })).toEqual({
      state: 'failed',
      failed: [{ name: 'verify', conclusion: 'failure', url: 'https://github.com/o/r/runs/1' }],
    });
  });

  it('必須チェックの途中・プレビューが無いうちは pending', () => {
    expect(computeState({ checkRuns: [check(1, 'verify', null)], workflowRuns: [] })).toEqual({ state: 'pending' });
    expect(computeState({ checkRuns: allGreen.slice(0, 3), workflowRuns: [] })).toEqual({ state: 'pending' });
  });

  it('同じチェックが再実行で成功していれば、古い失敗は数えない', () => {
    const checkRuns = [check(10, 'verify', 'failure'), ...allGreen.map((run) => ({ ...run, id: run.id + 100 }))];
    expect(computeState({ checkRuns, workflowRuns: [] }).state).toBe('ready');
  });

  it('必須でないチェック（translate など）の失敗では failed にしない', () => {
    expect(computeState({ checkRuns: [...allGreen, check(9, 'translate', 'failure')], workflowRuns: [] }).state).toBe('ready');
  });
});

describe('latestByName と previewUrlOf', () => {
  it('同じ名前は id が大きいものを残す', () => {
    expect(latestByName([check(5, 'verify', 'success'), check(3, 'verify', 'failure')]).get('verify').id).toBe(5);
  });

  it('プレビューの URL は Firebase のプレビューチャネルの形だけを受け付ける', () => {
    expect(previewUrlOf({ output: { summary: `[${PREVIEW}](${PREVIEW})` } })).toBe(PREVIEW);
    expect(previewUrlOf({ output: { summary: 'https://evil.example/phish' } })).toBeNull();
    expect(previewUrlOf(undefined)).toBeNull();
  });
});

describe('translationsOf', () => {
  it('ja の記事ごとに、そろった翻訳の言語を返す', () => {
    const files = ['ja', 'en', 'zh', 'ko', 'es'].map((lang) => ({ filename: `src/content/blog/${lang}/test.md` }));
    expect(translationsOf([...files, { filename: 'public/images/blog/a.webp' }])).toEqual({
      'src/content/blog/ja/test.md': ['en', 'zh', 'ko', 'es'],
    });
    expect(translationsOf([{ filename: 'src/content/blog/ja/test.md' }, { filename: 'src/content/blog/en/test.md' }])).toEqual({
      'src/content/blog/ja/test.md': ['en'],
    });
  });
});

describe('shouldNotify', () => {
  const sha = '9006d1827e9bc06bd6d2d99596e0c0a41e21caef';
  const posted = [{ body: '<!-- cms-pr-status: ready 9006d1827e9b -->\n**公開できます**' }];

  it('pending は知らせない', () => {
    expect(shouldNotify([], 'pending', sha)).toBe(false);
  });

  it('同じコミット・同じ状態は 2 回知らせない。状態かコミットが変われば知らせる', () => {
    expect(shouldNotify(posted, 'ready', sha)).toBe(false);
    expect(shouldNotify(posted, 'failed', sha)).toBe(true);
    expect(shouldNotify(posted, 'ready', 'abcdef1234567890abcdef1234567890abcdef12')).toBe(true);
  });
});

describe('renderComment', () => {
  const sha = '9006d1827e9bc06bd6d2d99596e0c0a41e21caef';
  const translations = { 'src/content/blog/ja/test.md': ['en', 'zh', 'ko', 'es'] };

  it('ready: 目印・チェック・翻訳・プレビュー・公開できる人を書く', () => {
    const body = renderComment({ result: { state: 'ready', previewUrl: PREVIEW }, sha, translations, isDraft: false });
    expect(body.split('\n')[0]).toBe('<!-- cms-pr-status: ready 9006d1827e9b -->');
    expect(body).toContain('**公開できます**');
    expect(body).toContain('英・中・韓・西の 4 言語がそろっています');
    expect(body).toContain(`プレビュー: ${PREVIEW}`);
    expect(body).toContain('@terisuke @cloudia-Cor');
  });

  it('needs-approval: 公開できる人に承認を頼む', () => {
    const body = renderComment({ result: { state: 'needs-approval', waiting: [] }, sha, translations, isDraft: false });
    expect(body).toContain('Approve workflows to run');
    expect(body).toContain('@terisuke @cloudia-Cor');
  });

  it('failed: 失敗したチェックと、下書きなら空の欄の案内を書く', () => {
    const result = { state: 'failed', failed: [{ name: 'verify', conclusion: 'failure', url: 'https://github.com/o/r/runs/1' }] };
    const draft = renderComment({ result, sha, translations: {}, isDraft: true });
    expect(draft).toContain('- verify: failure（https://github.com/o/r/runs/1）');
    expect(draft).toContain('下書きの間は');
    expect(renderComment({ result, sha, translations: {}, isDraft: false })).not.toContain('下書きの間は');
  });
});
