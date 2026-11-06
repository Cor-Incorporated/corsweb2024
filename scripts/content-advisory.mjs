/**
 * 記事の変更を advisory で検査する。pull_request_target の信頼する既定ブランチ checkout から動かす。
 * PR からは Git blob をデータとして読む。PR のスクリプト・package.json は実行しない。
 * 実行: GH_REPO=owner/repo PR_NUMBER=123 HEAD_SHA=<sha> node scripts/content-advisory.mjs
 * 既存の共用スキルと blog:check を使う。cor-voice の人による確認を置き換えない。
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { scanForViolations } from './blog-guardrails.mjs';

export const MARKER = '<!-- cor-content-advisory -->';
const MAX_BYTES = 256 * 1024;
const MAX_FILES = 100;
const escape = (value) => String(value).replace(/[&<>@`\r\n]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '@': '＠', '`': '&#96;', '\r': ' ', '\n': ' ' })[c]).slice(0, 240);
export const isTarget = (name) => /^src\/content\/[^/]+\/ja\/.+/.test(name);

/** ファイルは記事データだけ。CLI はベースの共用スキルを実際に呼ぶ。 */
export function inspectMarkdown(text, { execute = spawnSync } = {}) {
  if (JSON.parse(readFileSync('package.json', 'utf8')).scripts?.['blog:check'] !== 'node scripts/blog-guardrails.mjs') throw new Error('blog-command-changed');
  const dir = mkdtempSync(join(tmpdir(), 'content-advisory-'));
  const file = join(dir, 'article.md');
  try {
    writeFileSync(file, text);
    const lint = execute('python3', ['-I', '.claude/skills/yomiyasu/scripts/yomiyasu_lint.py', '--json', '--doc-type', 'article', '--fail-on', 'warn', file], { encoding: 'utf8', timeout: 30_000, maxBuffer: 4 * 1024 * 1024 });
    const blog = execute(process.execPath, ['scripts/blog-guardrails.mjs', file], { encoding: 'utf8', timeout: 30_000, maxBuffer: 1024 * 1024 });
    if (lint.error || blog.error || ![0, 1].includes(lint.status) || ![0, 1].includes(blog.status)) throw new Error('tool-failed');
    let parsed;
    try { parsed = JSON.parse(lint.stdout); } catch { throw new Error('lint-json-invalid'); }
    if (parsed.format !== 'yomiyasu-lint' || !Array.isArray(parsed.findings)) throw new Error('lint-json-invalid');
    return [
      ...parsed.findings.map((finding) => ({ tool: 'yomiyasu', line: finding.line, rule: finding.rule })),
      ...scanForViolations(text).map((finding) => ({ tool: 'blog:check', line: finding.line, rule: finding.name })),
    ];
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

export function renderReport(result) {
  const rows = result.files.flatMap((file) => file.findings.map((finding) => ({ ...finding, path: file.path })));
  const lines = [MARKER, '### 日本語記事の検査（advisory）', '', `対象コミット: \`${result.sha}\``, '', `検査 ${result.files.length} ファイル / 見直し候補 ${rows.length} 件 / 検査エラー ${result.errors.length} 件。PR のマージは止めません。`, ''];
  if (result.stale) lines.push('PR は更新済みです。この結果は最新コミットの検査結果ではありません。');
  if (result.checker_sha) lines.push(`検査コード: \`${result.checker_sha}\``, '');
  for (const finding of rows.slice(0, 50)) lines.push(`- <code>${escape(finding.path)}</code> L${Number.isInteger(finding.line) ? finding.line : '?'} [${escape(finding.tool)}] ${escape(finding.rule)}`);
  if (rows.length > 50) lines.push('- 表示は先頭50件です。全件は実行の artifact を確認してください。');
  for (const error of result.errors.slice(0, 20)) lines.push(`- 検査できませんでした: <code>${escape(error.path ?? '全体')}</code> (${escape(error.code)})`);
  if (!rows.length && !result.errors.length && !result.stale) lines.push('見直し候補はありません。以前の指摘は解消しました。');
  lines.push('', '共用参照: `.claude/skills/yomiyasu/`、`.claude/skills/cor-voice/`、`npm run blog:check`。意味の保持と cor-voice の文体は、この機械検査だけでは判定しません。');
  return lines.join('\n');
}

const ghApi = (args, input) => JSON.parse(execFileSync('gh', ['api', ...args], { encoding: 'utf8', input, timeout: 30_000, maxBuffer: 16 * 1024 * 1024 }));

/** gh を差し替えると、同じ収集・検査・コメント経路を外部書き込みなしで再現できる。 */
export async function run({ env = process.env, gh = ghApi, inspect = inspectMarkdown, out = console.log, now = Date.now } = {}) {
  const repo = env.GH_REPO;
  const number = env.PR_NUMBER;
  const sha = env.HEAD_SHA;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo ?? '') || !/^[1-9]\d*$/.test(number ?? '') || !/^[a-f0-9]{40}$/.test(sha ?? '')) throw new Error('invalid-environment');
  const deadline = now() + 5 * 60_000;
  const checkDeadline = () => { if (now() >= deadline) throw new Error('processing-deadline-exceeded'); };
  const root = `repos/${repo}`;
  const get = (path) => { checkDeadline(); return gh([`${root}/${path}`]); };
  const all = async (path) => { checkDeadline(); return (await gh(['--paginate', '--slurp', `${root}/${path}`])).flat(); };
  const result = { sha, checker_sha: /^[a-f0-9]{40}$/.test(env.BASE_SHA ?? '') ? env.BASE_SHA : null, files: [], errors: [], stale: false, comment: 'none' };
  const outputDir = env.ADVISORY_OUTPUT_DIR ?? '.content-advisory';
  try {
    const pull = await get(`pulls/${number}`);
    if (pull.state !== 'open' || pull.head.sha !== sha) { result.stale = true; return result; }
    const sourceRepo = pull.head.repo?.full_name;
    if (!/^[\w.-]+\/[\w.-]+$/.test(sourceRepo ?? '')) throw new Error('head-repository-invalid');
    const files = await all(`pulls/${number}/files?per_page=100`);
    if (pull.changed_files !== files.length) result.errors.push({ code: 'file-list-incomplete' });
    const targets = files.filter((file) => isTarget(file.filename) && file.status !== 'removed');
    if (targets.length > MAX_FILES) result.errors.push({ code: 'file-limit-exceeded' });
    for (const file of targets.slice(0, MAX_FILES)) {
      checkDeadline();
      try {
        if (!/^[a-f0-9]{40}$/.test(file.sha)) throw new Error('blob-sha-invalid');
        const blob = await gh([`repos/${sourceRepo}/git/blobs/${file.sha}`]);
        if (blob.encoding !== 'base64' || !Number.isInteger(blob.size) || blob.size > MAX_BYTES || blob.size < 0 || typeof blob.content !== 'string' || blob.content.length > MAX_BYTES * 2) throw new Error('blob-invalid-or-too-large');
        const bytes = Buffer.from(blob.content, 'base64');
        if (bytes.length !== blob.size || bytes.includes(0)) throw new Error('blob-invalid');
        const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        result.files.push({ path: file.filename, findings: inspect(text) });
      } catch (error) {
        result.errors.push({ path: file.filename, code: ['tool-failed', 'lint-json-invalid', 'blog-command-changed', 'blob-sha-invalid', 'blob-invalid-or-too-large', 'blob-invalid'].includes(error.message) ? error.message : 'file-inspection-failed' });
      }
    }
    const comments = await all(`issues/${number}/comments?per_page=100`);
    const previous = comments.find((comment) => comment.user?.login === 'github-actions[bot]' && comment.body?.startsWith(MARKER));
    const shouldComment = previous || result.errors.length || result.files.some((file) => file.findings.length);
    if (shouldComment) {
      const latest = await get(`pulls/${number}`);
      if (latest.state !== 'open' || latest.head.sha !== sha) result.stale = true;
      else {
        const path = previous ? `issues/comments/${previous.id}` : `issues/${number}/comments`;
        await gh(['-X', previous ? 'PATCH' : 'POST', `${root}/${path}`, '--input', '-'], JSON.stringify({ body: renderReport(result) }));
        result.comment = previous ? 'updated' : 'created';
      }
    }
  } catch (error) {
    result.errors.push({ code: error.message === 'processing-deadline-exceeded' ? error.message : 'github-api-failed' });
  } finally {
    mkdirSync(outputDir, { recursive: true });
    const report = renderReport(result);
    writeFileSync(join(outputDir, 'report.json'), `${JSON.stringify(result, null, 2)}\n`);
    writeFileSync(join(outputDir, 'report.md'), `${report}\n`);
    const findings = result.files.reduce((sum, file) => sum + file.findings.length, 0);
    appendFileSync(join(outputDir, 'guard-ledger.jsonl'), `${JSON.stringify({ guard: 'content-advisory', decision: result.stale ? 'stale' : result.errors.length ? 'error' : findings ? 'warn' : 'clean', sha, checker_sha: result.checker_sha, files: result.files.length, findings, errors: result.errors.length, stale: result.stale, comment: result.comment })}\n`);
    if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${report}\n`);
    if (result.errors.length) out('::warning title=content-advisory::検査できなかった項目があります。report.json を確認してください');
    out(`content-advisory files=${result.files.length} findings=${findings} errors=${result.errors.length} stale=${result.stale} comment=${result.comment}`);
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch(() => { console.error('::warning title=content-advisory::実行設定を確認してください'); process.exitCode = 1; });
}
