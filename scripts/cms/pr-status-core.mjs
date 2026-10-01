/**
 * CMS（Sveltia CMS、ADR-0018）が作った PR（ブランチが cms/ で始まる）の状態を、PR のコメントで知らせるための
 * 判定と文面。GitHub の API には触らない（scripts/cms/pr-status.mjs が取ってきた値を渡す）。
 *
 * GitHub は、PR に付いたコメントを PR の作成者（CMS で書いた人）にメールで知らせ、@メンションした人にも知らせる。
 * CMS の画面には、翻訳が付いたか・チェックが通ったかが出ないので、次の 3 つの場面でコメントする（2026-10-01 の CEO の指摘）。
 * - needs-approval: 見ているワークフローが action_required で止まっている（翻訳 CI が GITHUB_TOKEN で積んだコミット）
 * - failed:         見ているワークフローがすべて終わり、必須チェックか翻訳の検査（i18n-check）が失敗した
 * - ready:          見ているワークフローがすべて終わり、必須チェックと翻訳の検査が通った → 公開できる
 * ワークフローが動いている間（pending）は書かない（失敗をまとめて 1 回で知らせ、翻訳の途中で「公開できます」と書かないため）。
 * 最後に書いた状態・コミットと同じなら書かない（コメントに埋めた目印で判定する）。
 */

/** 終わるたびに状態を見直すワークフロー（cms-pr-status.yml の workflow_run.workflows と同じ。cms-pr-status.test.ts が照合する） */
export const WATCHED_WORKFLOWS = Object.freeze([
  'CI',
  'Responsive visual text',
  'H5 Admission',
  'Deploy to Firebase Hosting',
  'Translate content (i18n)',
]);
/** develop のブランチ保護の必須チェック（ジョブ名）。cms-pr-status.test.ts がワークフローの定義と照合する */
export const REQUIRED_CHECKS = Object.freeze(['h5-admission', 'verify', 'Chromium visual text audit']);
/**
 * 翻訳の検査（translate-content.yml の i18n-check ジョブ。PR で変えた記事の翻訳がそろい、ja の今の内容に合っているか）。
 * 翻訳の有無は PR の差分ではなくこの結果で決める（書式だけ直した記事では、翻訳は作り直されず差分に出ないため）。
 * 使うのは PR のイベントで動いた実行の結果だけ（translationRunOf）
 */
export const TRANSLATION_CHECK = 'i18n-check';
/** この下を変えた PR では翻訳 CI が動く（translate-content.yml の pull_request.paths。cms-pr-status.test.ts が照合する） */
export const CONTENT_PREFIX = 'src/content/';
/** PR ごとのプレビュー（deploy.yml の FirebaseExtended/action-hosting-deploy が作る check run） */
export const PREVIEW_CHECK = 'Deploy Preview';
/** プレビューのサイト（firebase.json の hosting.site。cms-pr-status.test.ts が照合する） */
export const PREVIEW_SITE = 'cor-jp-main';
/** develop に取り込める（CMS で「エントリーを公開」できる）アカウント。develop の push 制限と同じ */
export const PUBLISHERS = Object.freeze(['terisuke', 'cloudia-Cor']);
/** 翻訳先の言語（scripts/i18n/config.mjs の TARGET_LANGS と同じ。cms-pr-status.test.ts が照合する） */
export const TRANSLATION_LANGS = Object.freeze(['en', 'zh', 'ko', 'es']);
const LANG_LABELS = Object.freeze({ en: '英', zh: '中', ko: '韓', es: '西' });
const NOTIFY_STATES = new Set(['ready', 'needs-approval', 'failed']);
/** ブランチ保護と同じく、通ったとみなす結論 */
const PASSED = new Set(['success', 'neutral', 'skipped']);
const SUCCEEDED = new Set(['success']);
/** 失敗とみなす結論。cancelled は数えない（同じコミットで走り直したときに出る。人が止めたときも、次の実行で知らせる） */
const FAILED = new Set(['failure', 'timed_out', 'action_required', 'stale', 'startup_failure']);
const MARKER_RE = /<!-- cms-pr-status: ([a-z-]+) ([0-9a-f]{7,40}) -->/;
/** コメントにリンクとして載せる URL（GitHub の画面だけ） */
const GITHUB_URL_RE = /^https:\/\/github\.com\/[^\s()<>[\]]+$/;

const completedWith = (conclusions) => (run) => run?.status === 'completed' && conclusions.has(run.conclusion);
const isPassed = completedWith(PASSED);
const isSucceeded = completedWith(SUCCEEDED);
const isFailed = completedWith(FAILED);
const linkOf = ({ name, conclusion, html_url }) => ({ name, conclusion, url: html_url });

/** key ごとに、id が最も大きい（新しい）ものを 1 つ残す */
const latestBy = (items, keyOf) =>
  items.reduce((latest, item) => {
    const previous = latest.get(keyOf(item));
    return previous && previous.id > item.id ? latest : new Map(latest).set(keyOf(item), item);
  }, new Map());

/** 同じ名前の check run が複数あるとき（再実行など）は、新しいものだけを残す */
export const latestByName = (checkRuns) => latestBy(checkRuns, (run) => run.name);

/**
 * 見ているワークフローの run を、ワークフロー × イベントごとに新しいものだけ残す。
 * PR の本文を編集すると H5 Admission が同じコミットで走り直し、古い action_required の run が残るため。
 * イベントは分ける（翻訳 CI が workflow_dispatch で起こす i18n-check の run が、pull_request の承認待ちを隠さないように）
 */
export const latestWatchedRuns = (workflowRuns) => [
  ...latestBy(
    workflowRuns.filter((run) => WATCHED_WORKFLOWS.includes(run.name)),
    (run) => `${run.workflow_id ?? run.name}:${run.event}`
  ).values(),
];

/** Deploy Preview の check run の summary から、この PR のプレビューチャネルの URL を取り出す（形が違えば null） */
export function previewUrlOf(checkRun, prNumber) {
  const pattern = new RegExp(`https://${PREVIEW_SITE}--pr${prNumber}-[a-z0-9-]+\\.web\\.app(?![\\w.-])`);
  return pattern.exec(checkRun?.output?.summary ?? '')?.[0] ?? null;
}

/**
 * i18n-check のうち、PR のイベント（pull_request）で動いた実行の最新のもの。check run の check_suite と workflow run の
 * check_suite_id で、どのイベントの実行かを決める。手で動かす mode=check は言語や記事を絞れるので、PR 全体・全言語の検査とは
 * 限らない（Codex のレビュー）。翻訳 CI が起こす再検査（dispatch-check）も使わない（承認したあとの pull_request の実行が同じ検査をする）
 */
function translationRunOf(checkRuns, workflowRuns) {
  const suites = new Set(workflowRuns.filter((run) => run.event === 'pull_request').map((run) => run.check_suite_id));
  const fromPullRequests = checkRuns.filter((run) => run.name === TRANSLATION_CHECK && suites.has(run.check_suite?.id));
  return latestByName(fromPullRequests).get(TRANSLATION_CHECK);
}

/** 翻訳の検査の状態: none（PR が src/content/ を変えていない）・ok・failed・pending */
function translationOf(run, files) {
  if (!files.some((file) => file.filename.startsWith(CONTENT_PREFIX))) return 'none';
  if (isSucceeded(run)) return 'ok';
  return isFailed(run) ? 'failed' : 'pending';
}

/** プレビューの状態（公開の条件には入れない。必須チェックではないため） */
function previewOf(run, prNumber) {
  if (!run || run.status !== 'completed') return { status: 'none' };
  if (!isSucceeded(run)) return { status: 'failed', check: linkOf(run) };
  return { status: 'ok', url: previewUrlOf(run, prNumber) };
}

/**
 * PR の先頭のコミットの check run・workflow run と PR のファイルから、状態を決める。
 * 承認待ち > 動いている > 失敗 > 公開できる の順に見る。
 */
export function computeState({ checkRuns, workflowRuns, files, prNumber }) {
  const runs = latestWatchedRuns(workflowRuns);
  const waiting = runs.filter((run) => run.conclusion === 'action_required');
  if (waiting.length > 0) return { state: 'needs-approval', waiting: waiting.map(linkOf) };
  if (runs.some((run) => run.event === 'pull_request' && run.status !== 'completed')) return { state: 'pending' };
  const latest = latestByName(checkRuns);
  const translationRun = translationRunOf(checkRuns, workflowRuns);
  const translation = translationOf(translationRun, files);
  const failed = [...REQUIRED_CHECKS.map((name) => latest.get(name)), ...(translation === 'none' ? [] : [translationRun])].filter(isFailed);
  if (failed.length > 0) return { state: 'failed', failed: failed.map(linkOf), translation };
  if (!REQUIRED_CHECKS.every((name) => isPassed(latest.get(name))) || translation === 'pending') return { state: 'pending' };
  return { state: 'ready', translation, preview: previewOf(latest.get(PREVIEW_CHECK), prNumber) };
}

/** github-actions[bot] が最後に書いたコメントの目印（状態とコミットの先頭）。無ければ null */
export function lastMarker(comments) {
  const last = comments.map((comment) => MARKER_RE.exec(comment.body ?? '')).filter(Boolean).at(-1);
  return last ? { state: last[1], sha: last[2] } : null;
}

/** コメントするかどうか（知らせる状態で、最後に書いた状態・コミットと違う。前の失敗が直ってまた失敗したときも知らせる） */
export function shouldNotify(comments, state, sha) {
  const last = lastMarker(comments);
  return NOTIFY_STATES.has(state) && !(last !== null && last.state === state && sha.startsWith(last.sha));
}

/** チェックやワークフローの 1 行。URL は Markdown のリンクにする（URL の直後の全角の括弧まで、リンクに含まれないように） */
const linkLine = ({ name, conclusion, url }) => {
  const label = GITHUB_URL_RE.test(url ?? '') ? `[${name}](${url})` : name;
  return conclusion ? `- ${label}: ${conclusion}` : `- ${label}`;
};

const LANGS = TRANSLATION_LANGS.map((lang) => LANG_LABELS[lang]).join('・');
const TRANSLATION_LINES = Object.freeze({
  none: '- 翻訳: この PR は記事（src/content/）を変えていません',
  ok: `- 翻訳: ${LANGS}の ${TRANSLATION_LANGS.length} 言語がそろっていて、日本語の今の内容に合っています（${TRANSLATION_CHECK}: 成功）`,
  pending: `- 翻訳: 確かめています（${TRANSLATION_CHECK} の結果を待っています）`,
  failed: `- 翻訳: 検査が通っていません（翻訳が無い・古い、または日本語の記事の * の欄が空。${TRANSLATION_CHECK} のログに記事と理由が出ています）`,
});

const previewLine = (preview) => {
  if (preview.status === 'ok') return `- プレビュー: ${preview.url ?? 'CMS の「プレビューを見る」から開けます'}`;
  if (preview.status === 'failed') return `- プレビュー: 作れませんでした（必須チェックではないので、公開はできます）\n  ${linkLine(preview.check)}`;
  return '- プレビュー: ありません';
};

const DRAFT_HINT =
  'この記事は CMS で「下書き」です。下書きの間は `*` の欄が空でも保存できますが、カテゴリ・タイトル・概要・公開日のどれかが空だとチェックが失敗します。欄を埋めて保存し直してください。';

/** コメントの本文。PR から読んだ値は、チェックとワークフローの名前（定数と一致したもの）・GitHub の URL・プレビューの URL だけを載せる */
export function renderComment({ result, sha, isDraft }) {
  const marker = `<!-- cms-pr-status: ${result.state} ${sha.slice(0, 12)} -->`;
  const publishers = PUBLISHERS.map((login) => `@${login}`).join(' ');
  if (result.state === 'ready') {
    return [
      marker,
      '**公開できます**（CMS の記事のチェックがすべて通りました）',
      '',
      `- 必須チェック（${REQUIRED_CHECKS.join('・')}）: すべて通過`,
      TRANSLATION_LINES[result.translation],
      previewLine(result.preview),
      '',
      `公開するときは、CMS でこの記事のステータスを「公開可」にして「エントリーを公開」を押してください（${publishers}）。`,
    ].join('\n');
  }
  if (result.state === 'needs-approval') {
    return [
      marker,
      '**チェックの実行に承認が必要です**',
      '',
      '翻訳 CI が GitHub の標準のトークンで積んだコミットでは、続くチェックが自動では始まりません。承認を待っているワークフロー:',
      ...result.waiting.map(({ name, url }) => linkLine({ name, url })),
      '',
      `${publishers} PR の画面の「Approve workflows to run」で承認してください。チェックがすべて終わると、ここに結果を書きます（承認のボタンが出ないときは docs/i18n-translation.md の 6 章）。`,
    ].join('\n');
  }
  return [
    marker,
    '**チェックが失敗しました**',
    '',
    ...result.failed.map(linkLine),
    ...(result.translation === 'none' ? [] : [TRANSLATION_LINES[result.translation]]),
    ...(isDraft ? ['', DRAFT_HINT] : []),
  ].join('\n');
}
