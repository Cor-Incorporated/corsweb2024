// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectMarkdown, isTarget, MARKER, renderReport, run } from '../content-advisory.mjs';

const SHA = 'a'.repeat(40);
const BLOB = 'b'.repeat(40);
const dirs = [];
afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));
const output = () => { const dir = mkdtempSync(join(tmpdir(), 'advisory-test-')); dirs.push(dir); return dir; };
const clean = '設定ファイルを開きます。値を保存します。\n';
const bad = 'TapForge を利用します。🚀\n';

function fixture({ text = bad, comments = [], status = 'modified', filename = 'src/content/blog/ja/test.md', stale = false, incomplete = false, oversized = false } = {}) {
  const calls = [];
  let pulls = 0;
  const env = { GH_REPO: 'Cor-Incorporated/corsweb2024', PR_NUMBER: '449', HEAD_SHA: SHA, ADVISORY_OUTPUT_DIR: output() };
  const gh = async (args, input) => {
    calls.push({ args, input });
    const path = args.find((arg) => arg.startsWith('repos/'));
    if (args[0] === '-X') return {};
    if (path.endsWith('/pulls/449')) return { state: 'open', head: { sha: stale && ++pulls > 1 ? 'c'.repeat(40) : SHA, repo: { full_name: 'fork/articles' } }, changed_files: incomplete ? 3 : 1 };
    if (path.includes('/files?')) return [[{ filename, status, sha: BLOB }]];
    if (path.includes('/comments?')) return [comments];
    if (path.includes('/git/blobs/')) return { encoding: 'base64', size: oversized ? 999999 : Buffer.byteLength(text), content: Buffer.from(text).toString('base64') };
    throw new Error(`unexpected path: ${path}`);
  };
  return { env, gh, calls, out: () => {} };
}

describe('content advisory', () => {
  it('scopes every Japanese collection, including nested CMS paths', () => {
    expect(isTarget('src/content/news/ja/nested/post.md')).toBe(true);
    expect(isTarget('src/content/cases/ja/post.md')).toBe(true);
    expect(isTarget('src/content/blog/en/post.md')).toBe(false);
    expect(isTarget('scripts/test.md')).toBe(false);
  });

  it('runs real common lint and blog:check: red sample and clean sample', () => {
    const findings = inspectMarkdown(bad);
    expect(findings.some((row) => row.tool === 'blog:check' && row.rule === '旧事業名')).toBe(true);
    expect(findings.some((row) => row.tool === 'yomiyasu')).toBe(true);
    expect(inspectMarkdown(clean)).toEqual([]);
  });

  it('posts one marked comment for violations and records the ledger', async () => {
    const f = fixture();
    const result = await run(f);
    expect(result.comment).toBe('created');
    expect(f.calls.filter((call) => call.args[0] === '-X')).toHaveLength(1);
    const body = JSON.parse(f.calls.at(-1).input).body;
    expect(body).toContain(MARKER);
    expect(body).toContain('blog:check');
    expect(body).not.toContain('TapForge');
    expect(JSON.parse(readFileSync(join(f.env.ADVISORY_OUTPUT_DIR, 'guard-ledger.jsonl'), 'utf8'))).toMatchObject({ decision: 'warn', sha: SHA, comment: 'created' });
    expect(f.calls.some((call) => call.args.includes(`repos/fork/articles/git/blobs/${BLOB}`))).toBe(true);
  });

  it('does not create a clean comment or accept a human marker', async () => {
    const f = fixture({ text: clean, comments: [{ id: 1, user: { login: 'human' }, body: MARKER }] });
    expect((await run(f)).comment).toBe('none');
    expect(f.calls.some((call) => call.args[0] === '-X')).toBe(false);
  });

  it('updates previous bot findings after fix, deletion, and rename away', async () => {
    for (const change of [{ text: clean }, { status: 'removed' }, { filename: 'src/content/blog/en/test.md', status: 'renamed' }]) {
      const f = fixture({ ...change, comments: [{ id: 10, user: { login: 'github-actions[bot]' }, body: MARKER }] });
      expect((await run(f)).comment).toBe('updated');
      expect(f.calls.at(-1).args).toContain('PATCH');
      expect(JSON.parse(f.calls.at(-1).input).body).toContain('見直し候補はありません');
    }
  });

  it('suppresses stale-head writes', async () => {
    const f = fixture({ stale: true });
    expect((await run(f)).stale).toBe(true);
    expect(f.calls.some((call) => call.args[0] === '-X')).toBe(false);
    expect(JSON.parse(readFileSync(join(f.env.ADVISORY_OUTPUT_DIR, 'guard-ledger.jsonl'), 'utf8')).decision).toBe('stale');
  });

  it('records the bounded processing deadline instead of reporting a clean run', async () => {
    const f = fixture();
    let tick = 0;
    const result = await run({ ...f, now: () => tick++ * 180_000 });
    expect(result.errors[0].code).toBe('processing-deadline-exceeded');
    expect(readFileSync(join(f.env.ADVISORY_OUTPUT_DIR, 'report.md'), 'utf8')).not.toContain('見直し候補はありません');
  });

  it('reports oversized blobs, missing file pages, and tool failure visibly', async () => {
    const f = fixture({ oversized: true, incomplete: true });
    expect((await run(f)).errors.map((error) => error.code)).toEqual(['file-list-incomplete', 'blob-invalid-or-too-large']);
    const timeout = fixture();
    expect((await run({ ...timeout, inspect: () => { throw new Error('tool-failed'); } })).errors[0].code).toBe('tool-failed');
    expect(() => inspectMarkdown(clean, { execute: () => ({ error: new Error('timeout'), status: null }) })).toThrow('tool-failed');
  });

  it('renders untrusted filenames as escaped text without mentions', () => {
    const report = renderReport({ sha: SHA, files: [{ path: '<img>\n@all`', findings: [{ tool: 'blog:check', rule: 'rule', line: 1 }] }], errors: [] });
    expect(report).not.toContain('<img>');
    expect(report).not.toContain('@all');
    expect(report).toContain('&lt;img&gt; ＠all&#96;');
  });

  it('replays the workflow CLI with real tools for violating, clean, and fixed articles', () => {
    const dir = output();
    const fakeGh = join(dir, 'gh');
    writeFileSync(fakeGh, `#!/usr/bin/env node
const fs = require('node:fs');
const fixture = JSON.parse(fs.readFileSync(process.env.ADVISORY_FAKE_STATE, 'utf8'));
const args = process.argv.slice(3);
const route = args.find((arg) => arg.startsWith('repos/'));
if (args[0] === '-X') {
  fixture.writes.push({ method: args[1], route, body: JSON.parse(fs.readFileSync(0, 'utf8')).body });
  fs.writeFileSync(process.env.ADVISORY_FAKE_STATE, JSON.stringify(fixture));
  process.stdout.write('{}');
} else if (route.endsWith('/pulls/449')) {
  process.stdout.write(JSON.stringify({ state: 'open', head: { sha: fixture.sha, repo: { full_name: 'fixture/articles' } }, changed_files: 1 }));
} else if (route.includes('/files?')) {
  process.stdout.write(JSON.stringify([[{ filename: 'src/content/blog/ja/replay.md', status: 'modified', sha: fixture.blob }]]));
} else if (route.includes('/comments?')) {
  process.stdout.write(JSON.stringify([fixture.previous ? [{ id: 1, user: { login: 'github-actions[bot]' }, body: '<!-- cor-content-advisory --> old finding' }] : []]));
} else if (route.includes('/git/blobs/')) {
  process.stdout.write(JSON.stringify({ encoding: 'base64', size: Buffer.byteLength(fixture.text), content: Buffer.from(fixture.text).toString('base64') }));
} else { process.stderr.write('unexpected offline API route'); process.exitCode = 1; }
`);
    chmodSync(fakeGh, 0o755);
    const evidence = [];
    for (const sample of [{ name: 'violation', text: bad, previous: false, method: 'POST' }, { name: 'clean', text: clean, previous: false, method: null }, { name: 'fixed', text: clean, previous: true, method: 'PATCH' }]) {
      const state = join(dir, `${sample.name}.json`);
      const artifactDir = join(dir, sample.name);
      writeFileSync(state, JSON.stringify({ ...sample, sha: SHA, blob: BLOB, writes: [] }));
      const child = spawnSync(process.execPath, ['scripts/content-advisory.mjs'], { encoding: 'utf8', timeout: 30_000, env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, GH_TOKEN: 'offline-fixture', GH_REPO: 'fixture/articles', PR_NUMBER: '449', HEAD_SHA: SHA, GITHUB_STEP_SUMMARY: '', ADVISORY_FAKE_STATE: state, ADVISORY_OUTPUT_DIR: artifactDir } });
      expect(child.status, child.stderr).toBe(0);
      const result = JSON.parse(readFileSync(join(artifactDir, 'report.json'), 'utf8'));
      const writes = JSON.parse(readFileSync(state, 'utf8')).writes;
      expect(result.errors).toEqual([]);
      expect(writes.map((write) => write.method)).toEqual(sample.method ? [sample.method] : []);
      expect(result.files[0].findings.length > 0).toBe(sample.name === 'violation');
      evidence.push({ sample: sample.name, command: 'node scripts/content-advisory.mjs', exit: child.status, stdout: child.stdout.trim(), result, writes, ledger: JSON.parse(readFileSync(join(artifactDir, 'guard-ledger.jsonl'), 'utf8')) });
    }
    if (process.env.ADVISORY_TEST_EVIDENCE_DIR) {
      mkdirSync(process.env.ADVISORY_TEST_EVIDENCE_DIR, { recursive: true });
      writeFileSync(join(process.env.ADVISORY_TEST_EVIDENCE_DIR, 'equivalent-replay.json'), `${JSON.stringify(evidence, null, 2)}\n`);
    }
    console.log(`offline CLI replay: ${evidence.map((row) => `${row.sample}:exit=${row.exit},comment=${row.result.comment}`).join(' / ')}`);
  }, 30_000);
});
