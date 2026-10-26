// @vitest-environment node
/**
 * Grift CLI の版の正本と PyPI の照合（scripts/grift-cli-release-watch.mjs、ADR-0023）。
 * PyPI と GitHub の応答は保存した形（2026-10-26 に取った応答の必要な部分）を使い、ネットにはつながない。
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { compareRelease, readGithubLatest, readPypi, toJstDate } from '../grift-cli-release-watch.mjs';

const SCRIPT = path.join(process.cwd(), 'scripts/grift-cli-release-watch.mjs');
const dir = mkdtempSync(path.join(tmpdir(), 'grift-cli-release-watch-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

// 2026-10-26 の https://pypi.org/pypi/grift-cli/json の必要な部分
const pypiJson = (version = '0.8.0', uploaded = '2026-10-25T23:39:22.934760Z') => ({
  info: { name: 'grift-cli', version },
  releases: {
    '0.7.2': [{ upload_time_iso_8601: '2026-09-08T01:01:31.000000Z' }],
    [version]: [{ upload_time_iso_8601: uploaded }],
  },
});
// 2026-10-26 の https://api.github.com/repos/Cor-Incorporated/grift-cli/releases/latest の必要な部分
const githubJson = (tag = 'v0.8.0') => ({
  tag_name: tag,
  html_url: `https://github.com/Cor-Incorporated/grift-cli/releases/tag/${tag}`,
  published_at: '2026-10-26T02:25:09Z',
});

describe('応答の読み取り', () => {
  it('PyPI の時刻（UTC）を日本時間の日付にする', () => {
    expect(toJstDate('2026-10-25T23:39:22.934760Z')).toBe('2026-10-26');
    expect(toJstDate('2026-10-25T14:59:59')).toBe('2026-10-25');
    expect(toJstDate('2026-10-25T15:00:00')).toBe('2026-10-26');
  });

  it('PyPI の最新の版と、その版を上げた日を取り出す', () => {
    expect(readPypi(pypiJson())).toEqual({
      version: '0.8.0',
      uploadedAt: '2026-10-25T23:39:22.934760Z',
      releasedOn: '2026-10-26',
    });
  });

  it('PyPI の形が違えば、観測した値を出して落ちる', () => {
    expect(() => readPypi({ info: { version: '0.9.0rc1' }, releases: {} })).toThrow('observed "0.9.0rc1"');
    expect(() => readPypi({ info: { version: '0.9.0' }, releases: { '0.9.0': [] } })).toThrow('observed []');
  });

  it('GitHub の応答の形が違えば null（照合は止めない）', () => {
    expect(readGithubLatest(githubJson())).toMatchObject({ tag: 'v0.8.0' });
    expect(readGithubLatest({ message: 'Not Found' })).toBeNull();
  });
});

describe('正本と PyPI を比べる', () => {
  const release = { version: '0.8.0', releasedOn: '2026-10-26' };

  it('同じなら Issue を作らない', () => {
    expect(compareRelease({ release, pypi: readPypi(pypiJson()), github: readGithubLatest(githubJson()) })).toMatchObject({
      drift: false,
      body: '',
    });
  });

  it('PyPI が新しければ、両方の版を題に入れ、書き換えたあとの JSON と手順を本文に書く', () => {
    const pypi = readPypi(pypiJson('0.9.0', '2026-11-02T03:00:00Z'));
    const result = compareRelease({ release, pypi, github: readGithubLatest(githubJson('v0.9.0')) });
    expect(result.drift).toBe(true);
    expect(result.title).toBe('Grift CLI の版の正本（v0.8.0）が PyPI の最新（v0.9.0）と違う');
    expect(result.next).toEqual({ version: '0.9.0', releasedOn: '2026-11-02' });
    expect(result.body).toContain('"version": "0.9.0"');
    expect(result.body).toContain('-b chore/grift-cli-v0.9.0 origin/main');
    expect(result.body).toContain('node scripts/grift-cli-release-watch.mjs --write');
    expect(result.body).toContain('npm run check:grift-version');
    expect(result.body).not.toContain('GitHub の最新の Release（v0.9.0）が');
  });

  it('GitHub の Release が PyPI に追いついていなければ、本文で知らせる', () => {
    const pypi = readPypi(pypiJson('0.9.0', '2026-11-02T03:00:00Z'));
    const result = compareRelease({ release, pypi, github: readGithubLatest(githubJson('v0.8.0')) });
    expect(result.body).toContain('GitHub の最新の Release（v0.8.0）が PyPI の版（v0.9.0）と違う');
    expect(result.body).toContain('https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0');
  });

  it('正本が PyPI より新しければ、戻し方を書く（書き換えたあとの JSON は出さない）', () => {
    const result = compareRelease({ release: { version: '0.9.0', releasedOn: '2026-11-02' }, pypi: readPypi(pypiJson()), github: null, githubError: 'HTTP 503' });
    expect(result.drift).toBe(true);
    expect(result.body).toContain('正本（v0.9.0）が PyPI の最新（v0.8.0）より新しい');
    expect(result.body).toContain('取れなかった（HTTP 503）');
    expect(result.body).not.toContain('```json');
  });
});

describe('CLI', () => {
  const repo = (version) => {
    const root = mkdtempSync(path.join(dir, 'repo-'));
    mkdirSync(path.join(root, 'src/config'), { recursive: true });
    writeFileSync(path.join(root, 'src/config/grift-cli-release.json'), JSON.stringify({ version, releasedOn: '2026-09-08' }));
    writeFileSync(path.join(root, 'pypi.json'), JSON.stringify(pypiJson()));
    writeFileSync(path.join(root, 'github.json'), JSON.stringify(githubJson()));
    return root;
  };
  const run = (root, args) =>
    spawnSync(process.execPath, [SCRIPT, '--pypi-json', 'pypi.json', '--github-json', 'github.json', ...args], {
      cwd: root,
      encoding: 'utf8',
      timeout: 10_000,
    });

  it('違えば GitHub Actions の出力に drift=true と題を書き、Issue の本文を書く（exit 0）', () => {
    const root = repo('0.7.2');
    const result = run(root, ['--body-file', 'body.md', '--github-output', 'out.txt']);
    expect(result.status).toBe(0);
    expect(readFileSync(path.join(root, 'out.txt'), 'utf8')).toBe(
      'drift=true\ntitle=Grift CLI の版の正本（v0.7.2）が PyPI の最新（v0.8.0）と違う\npypi_version=0.8.0\n'
    );
    expect(readFileSync(path.join(root, 'body.md'), 'utf8')).toContain('| 正本（`src/config/grift-cli-release.json`） | v0.7.2 |');
  });

  it('同じなら drift=false（Issue の本文は空）', () => {
    const root = repo('0.8.0');
    expect(run(root, ['--body-file', 'body.md', '--github-output', 'out.txt']).status).toBe(0);
    expect(readFileSync(path.join(root, 'out.txt'), 'utf8')).toContain('drift=false\n');
    expect(readFileSync(path.join(root, 'body.md'), 'utf8')).toBe('');
  });

  it('--write は PyPI の版と日本時間の公開日で正本を書き換える', () => {
    const root = repo('0.7.2');
    const result = run(root, ['--write']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('v0.7.2（2026-09-08）→ v0.8.0（2026-10-26）');
    expect(readFileSync(path.join(root, 'src/config/grift-cli-release.json'), 'utf8')).toBe(
      '{\n  "version": "0.8.0",\n  "releasedOn": "2026-10-26"\n}\n'
    );
  });

  it('PyPI の応答が読めなければ exit 1（黙って通さない）', () => {
    const root = repo('0.8.0');
    writeFileSync(path.join(root, 'pypi.json'), JSON.stringify({ info: {} }));
    const result = run(root, []);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('PyPI の info.version が版の形ではない');
  });

  it('知らない引数は exit 1', () => {
    expect(run(repo('0.8.0'), ['--dry-run']).status).toBe(1);
  });
});
