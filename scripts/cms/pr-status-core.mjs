/**
 * CMS（Sveltia CMS、ADR-0018）が作った PR（ブランチが cms/ で始まる）の状態を、PR のコメントで知らせるための
 * 判定と文面。GitHub の API には触らない（scripts/cms/pr-status.mjs が取ってきた値を渡す）。
 *
 * GitHub は、PR に付いたコメントを PR の作成者（CMS で書いた人）にメールで知らせ、@メンションした人にも知らせる。
 * CMS の画面には、翻訳が付いたか・チェックが通ったかが出ないので、次の 3 つの場面でコメントする（2026-10-01 の CEO の指摘）。
 * - ready:          必須チェックがすべて成功し、プレビューができた → 公開できる
 * - needs-approval: 翻訳 CI が GITHUB_TOKEN で積んだコミットのワークフローが action_required で止まっている
 * - failed:         必須チェックのどれかが失敗した（下書きの間は * の欄が空だと失敗する）
 * 同じコミット・同じ状態では書かない（コメントに埋めた目印で判定する）。
 */

/** develop のブランチ保護の必須チェック（ジョブ名）。src/config/__tests__/cms-pr-status.test.ts がワークフローの定義と照合する */
export const REQUIRED_CHECKS = Object.freeze(['h5-admission', 'verify', 'Chromium visual text audit']);
/** PR ごとのプレビュー（deploy.yml の FirebaseExtended/action-hosting-deploy が作る check run） */
export const PREVIEW_CHECK = 'Deploy Preview';
/** develop に取り込める（CMS で「エントリーを公開」できる）アカウント。develop の push 制限と同じ */
export const PUBLISHERS = Object.freeze(['terisuke', 'cloudia-Cor']);
/** 翻訳先の言語（scripts/i18n/config.mjs の TARGET_LANGS と同じ。cms-pr-status.test.ts が照合する） */
export const TRANSLATION_LANGS = Object.freeze(['en', 'zh', 'ko', 'es']);
const LANG_LABELS = Object.freeze({ en: '英', zh: '中', ko: '韓', es: '西' });
const NOTIFY_STATES = new Set(['ready', 'needs-approval', 'failed']);
const FAILED_CONCLUSIONS = new Set(['failure', 'cancelled', 'timed_out', 'action_required', 'stale', 'startup_failure']);
const MARKER_RE = /<!-- cms-pr-status: ([a-z-]+) ([0-9a-f]{7,40}) -->/;
/** プレビューの URL として受け付ける形（PR ごとの Firebase Hosting のプレビューチャネル）。それ以外の URL は載せない */
const PREVIEW_URL_RE = /https:\/\/[a-z0-9-]+--[a-z0-9-]+\.web\.app/;

/** 同じ名前の check run が複数あるとき（再実行など）は、新しいもの（id が大きいもの）だけを残す */
export function latestByName(checkRuns) {
  return checkRuns.reduce((latest, run) => {
    const previous = latest.get(run.name);
    return previous && previous.id > run.id ? latest : new Map(latest).set(run.name, run);
  }, new Map());
}

/** Deploy Preview の check run の summary から、プレビューの URL を取り出す（形が違えば null） */
export function previewUrlOf(checkRun) {
  return PREVIEW_URL_RE.exec(checkRun?.output?.summary ?? '')?.[0] ?? null;
}

/**
 * PR の先頭のコミットの check run と workflow run から、状態を決める。
 * 失敗 > 承認待ち > 公開できる > 進行中 の順に見る。
 */
export function computeState({ checkRuns, workflowRuns }) {
  const latest = latestByName(checkRuns);
  const failed = REQUIRED_CHECKS.map((name) => latest.get(name)).filter(
    (run) => run?.status === 'completed' && FAILED_CONCLUSIONS.has(run.conclusion)
  );
  if (failed.length > 0) {
    return { state: 'failed', failed: failed.map(({ name, conclusion, html_url }) => ({ name, conclusion, url: html_url })) };
  }
  const waiting = workflowRuns.filter((run) => run.conclusion === 'action_required');
  if (waiting.length > 0) {
    return { state: 'needs-approval', waiting: waiting.map(({ name, html_url }) => ({ name, url: html_url })) };
  }
  const passed = REQUIRED_CHECKS.every((name) => {
    const run = latest.get(name);
    return run?.status === 'completed' && run.conclusion === 'success';
  });
  const preview = latest.get(PREVIEW_CHECK);
  const previewReady = preview?.status === 'completed' && preview.conclusion === 'success';
  return passed && previewReady ? { state: 'ready', previewUrl: previewUrlOf(preview) } : { state: 'pending' };
}

/** PR のファイルから、ja の記事ごとに翻訳がそろった言語を数える（{ ja のパス: [言語] }） */
export function translationsOf(files) {
  const paths = files.map((file) => file.filename ?? file);
  const sources = paths.filter((p) => /^src\/content\/(blog|news|cases)\/ja\/[^/]+\.md$/.test(p));
  return Object.fromEntries(
    sources.map((source) => [
      source,
      TRANSLATION_LANGS.filter((lang) => paths.includes(source.replace('/ja/', `/${lang}/`))),
    ])
  );
}

/** 先頭のコミットについて、すでに同じ状態をコメントしたか（コメントの目印で判定する） */
export function alreadyNotified(comments, state, sha) {
  return comments.some((comment) => {
    const marker = MARKER_RE.exec(comment.body ?? '');
    return marker !== null && marker[1] === state && sha.startsWith(marker[2]);
  });
}

/** コメントするかどうか（知らせる状態で、まだ同じコミット・同じ状態で書いていない） */
export function shouldNotify(comments, state, sha) {
  return NOTIFY_STATES.has(state) && !alreadyNotified(comments, state, sha);
}

const translationLine = (translations) => {
  const entries = Object.values(translations);
  if (entries.length === 0) return '- 翻訳: この PR には日本語の記事の変更がありません';
  const complete = entries.every((langs) => langs.length === TRANSLATION_LANGS.length);
  const labels = TRANSLATION_LANGS.map((lang) => LANG_LABELS[lang]).join('・');
  return complete
    ? `- 翻訳: ${labels}の ${TRANSLATION_LANGS.length} 言語がそろっています`
    : `- 翻訳: まだそろっていません（${entries.map((langs) => langs.map((l) => LANG_LABELS[l]).join('・') || 'なし').join(' / ')}）`;
};

/** コメントの本文。PR から読んだ値は、チェックの名前・URL・言語の数だけを載せる */
export function renderComment({ result, sha, translations, isDraft }) {
  const marker = `<!-- cms-pr-status: ${result.state} ${sha.slice(0, 12)} -->`;
  const publishers = PUBLISHERS.map((login) => `@${login}`).join(' ');
  if (result.state === 'ready') {
    return [
      marker,
      '**公開できます**（CMS の記事のチェックがすべて通りました）',
      '',
      `- 必須チェック（${REQUIRED_CHECKS.join('・')}）: すべて成功`,
      translationLine(translations),
      `- プレビュー: ${result.previewUrl ?? 'CMS の「プレビューを見る」から開けます'}`,
      '',
      `公開するときは、CMS でこの記事のステータスを「公開可」にして「エントリーを公開」を押してください（${publishers}）。`,
    ].join('\n');
  }
  if (result.state === 'needs-approval') {
    return [
      marker,
      '**チェックの実行に承認が必要です**',
      '',
      '翻訳 CI が翻訳を PR に追加しました。このコミットは GitHub の標準のトークンで積んだため、続くチェックが自動では始まりません。',
      translationLine(translations),
      '',
      `${publishers} PR の画面の「Approve workflows to run」で承認してください。チェックが通ると、ここに「公開できます」と書きます。`,
    ].join('\n');
  }
  const lines = result.failed.map(({ name, conclusion, url }) => `- ${name}: ${conclusion}（${url}）`);
  const draftHint = isDraft
    ? ['', 'この記事は CMS で「下書き」です。下書きの間は、`*` の欄（タイトル・概要・カテゴリなど）が空でも保存できますが、チェックは失敗します。欄を埋めて保存し直してください。']
    : [];
  return [marker, '**チェックが失敗しました**', '', ...lines, ...draftHint].join('\n');
}
