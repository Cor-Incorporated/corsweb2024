/**
 * PR の src/content 差分が「新規追加の ja 下書き（isDraft: true）だけ」なら終了コード 0。
 * それ以外は 1。translate ジョブが npm ci と Gemini の前に使う。
 * npm 依存は import しない（actions/setup-node より前に実行する）。
 *
 * 変更（M）や削除、公開記事（isDraft が true でない）が混ざるときは 1。
 * isDraft を false から true にした既存記事は、翻訳の meta-drift 同期が要るのでここでは止めない。
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ADDED_JA_RE = /^src\/content\/(blog|cases|news)\/ja\/[A-Za-z0-9][A-Za-z0-9._-]*\.md$/;

/** `git diff --name-status -z` の出力を [{ status, path }] にする（R/C は新しい側のパス）。 */
export function parseNameStatusZ(output) {
  const fields = output.split('\0');
  const entries = [];
  let i = 0;
  while (i < fields.length && fields[i] !== '') {
    const status = fields[i];
    const twoPaths = /^[RC]/.test(status);
    entries.push({ status: status[0], path: fields[i + (twoPaths ? 2 : 1)] });
    i += twoPaths ? 3 : 2;
  }
  return entries;
}

/** frontmatter の isDraft が boolean の true か。本文中の同じ文字列は見ない。 */
export function frontmatterIsDraftTrue(text) {
  const match = String(text).match(/^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/);
  if (!match) return false;
  return /^isDraft:[ \t]*true[ \t]*$/m.test(match[1]);
}

/**
 * 差分のすべてのエントリが、追加された ja 下書きなら true。空の差分は false。
 * @param {{ status: string, path: string }[]} entries
 * @param {(file: string) => string} readFile
 */
export function isDraftAdditionOnly(entries, readFile) {
  if (!Array.isArray(entries) || entries.length === 0) return false;
  for (const { status, path: file } of entries) {
    if (status !== 'A' || !ADDED_JA_RE.test(file)) return false;
    let text;
    try {
      text = readFile(file);
    } catch {
      return false;
    }
    if (!frontmatterIsDraftTrue(text)) return false;
  }
  return true;
}

export function draftAdditionOnlySince(since, { cwd = process.cwd(), runGit, readFile } = {}) {
  const git =
    runGit ??
    ((args) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  const read = readFile ?? ((file) => readFileSync(path.join(cwd, file), 'utf8'));
  const out = git([
    'diff',
    '--name-status',
    '--no-renames',
    '-z',
    `${since}...HEAD`,
    '--',
    'src/content',
  ]);
  return isDraftAdditionOnly(parseNameStatusZ(out), read);
}

function runCli(argv) {
  const index = argv.indexOf('--since');
  const since = index === -1 ? '' : argv[index + 1];
  if (!since || since.startsWith('-')) {
    process.stderr.write('usage: node scripts/i18n/draft-only-diff.mjs --since <git-ref>\n');
    process.exit(2);
  }
  const skip = draftAdditionOnlySince(since);
  if (skip) {
    process.stdout.write('draft-only addition\n');
    process.exit(0);
  }
  process.exit(1);
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === entry) runCli(process.argv.slice(2));
