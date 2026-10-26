// @vitest-environment node
/**
 * Grift CLI の版の書き方の検査（scripts/check-grift-version-claims.mjs、ADR-0023）。
 * 最後のテストが実際の ja の記事で 0 件であることを照合し、CI（npm run test:run）で古い書き方を止める。
 * 2026-10-26 の直す前の記事（origin/develop 1ae26b7）では、この検査は 13 件で落ちた（PR の H5-NEGATIVE）。
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  findVersionClaims,
  formatFinding,
  scanRepository,
  stripNonProse,
} from '../check-grift-version-claims.mjs';
import { compareToRelease, readRelease, validateRelease } from '../lib/grift-cli-release.mjs';

const ROOT = process.cwd();
const dir = mkdtempSync(path.join(tmpdir(), 'grift-version-claims-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const rulesOf = (text, release = '0.8.0') => findVersionClaims(text, release).map((f) => `${f.rule}:${f.version}`);

describe('版を比べる', () => {
  it('patch を省いた版は系列として比べる', () => {
    expect(compareToRelease('0.8', '0.8.0')).toBe('same');
    expect(compareToRelease('v0.8.0', '0.8.0')).toBe('same');
    expect(compareToRelease('0.7.2', '0.8.0')).toBe('older');
    expect(compareToRelease('0.8.1', '0.8.0')).toBe('newer');
    expect(compareToRelease('0.9', '0.8.0')).toBe('newer');
    expect(compareToRelease('0.10.0', '0.9.3')).toBe('newer');
  });

  it('正本の形が違えば、観測した値を出して落ちる', () => {
    expect(() => validateRelease({ version: 'v0.8.0', releasedOn: '2026-10-26' })).toThrow('observed "v0.8.0"');
    expect(() => validateRelease({ version: '0.8', releasedOn: '2026-10-26' })).toThrow('observed "0.8"');
    expect(() => validateRelease({ version: '0.8.0', releasedOn: '2026/10/26' })).toThrow('observed "2026/10/26"');
    expect(() => validateRelease({ version: '0.8.0', releasedOn: '2026-10-26', url: 'x' })).toThrow('observed url');
  });
});

describe('いまの版として書いた古い版（current-claim）', () => {
  it.each([
    ['公開中のv0.7.2では、注記が付いています。'],
    ['0.7.2（今の公開版）では、一覧が変更の多い順でした。'],
    ['現時点の最新版はv0.7.2です。'],
    ['比べるために、公開版の0.7.2も同じ4つにかけました'],
    ['現在の版は 0.7 系です。'],
  ])('落とす: %s', (text) => {
    expect(rulesOf(text)).toEqual([expect.stringMatching(/^current-claim:0\.7/)]);
  });

  it('正本と同じ版なら通す（正本が次の版に進むと落ちる）', () => {
    expect(rulesOf('最新の公開版はv0.8.0です。')).toEqual([]);
    expect(rulesOf('最新の公開版はv0.8.0です。', '0.9.0')).toEqual(['current-claim:0.8.0']);
  });
});

describe('出ていないと書いた公開済みの版（unreleased-claim）', () => {
  it.each([
    ['0.8はまだリリースしていません。'],
    ['0.8.0は公開の準備中です。'],
    ['次の版（0.8）では並びを変えます。'],
    ['公開前の0.8.0で測りました。'],
  ])('落とす: %s', (text) => {
    expect(rulesOf(text)).toEqual([expect.stringMatching(/^unreleased-claim:0\.8/)]);
  });

  it('まだ出ていない版なら通す', () => {
    expect(rulesOf('次の版（0.9）では並びを変えます。')).toEqual([]);
    expect(rulesOf('0.8.1は公開の準備中です。')).toEqual([]);
  });

  it('公開とは関係のない「まだ〜ません」は拾わない', () => {
    expect(rulesOf('0.8.0では、この注意はまだ数字の隣に載っていません。')).toEqual([]);
  });

  it('1 つの文に両方があれば、版ごとに 1 つだけ出す', () => {
    expect(rulesOf('公開版は0.7.2で、0.8.0は公開の準備中')).toEqual(['current-claim:0.7.2', 'unreleased-claim:0.8.0']);
  });
});

describe('記録の形と、文ではない部分', () => {
  it.each([
    ['この記事を書いた時点（2026年10月25日）で公開していたv0.7.2では、注記が付いています。'],
    ['0.8.0はこの日の時点ではまだ公開の準備中で、翌日に公開しました。'],
    ['当時の公開版の0.7.2も同じ4つにかけました。'],
    ['執筆時の最新はv0.7.2でした。'],
    ['2026年9月8日に、PyPIでv0.7.2を公開しました。'],
  ])('通す: %s', (text) => {
    expect(rulesOf(text)).toEqual([]);
  });

  it('コード・インラインのコード・URL・HTML のコメント・版ではない数は見ない', () => {
    const text = [
      '最新の定義版は`tep-v0.7.2-2026-09-07`です。',
      '最新の[リリース](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.7.2)を見てください。',
      '<!-- 公開中のv0.7.2 -->',
      '現在の間隔の中央値は0.08日です。',
      '```bash',
      'pipx install grift-cli==0.7.2  # 今の公開版',
      '```',
    ].join('\n');
    expect(findVersionClaims(text, '0.8.0')).toEqual([]);
    // 行の数は変えない（落ちたときの行番号がずれない）
    expect(stripNonProse(text).split('\n')).toHaveLength(7);
  });

  it('行番号と、正本の値と見つけた版の両方を出す', () => {
    const [finding] = findVersionClaims('一行目\n公開中のv0.7.2です。', '0.8.0');
    expect(finding).toMatchObject({ line: 2, rule: 'current-claim', version: '0.7.2' });
    expect(formatFinding({ file: 'a.md', ...finding }, '0.8.0')).toContain('a.md:2: current-claim:');
    expect(formatFinding({ file: 'a.md', ...finding }, '0.8.0')).toMatch(/v0\.7\.2.*v0\.8\.0/);
  });
});

describe('リポジトリを見る', () => {
  const fixture = (files) => {
    const root = mkdtempSync(path.join(dir, 'repo-'));
    for (const [rel, text] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      writeFileSync(path.join(root, rel), text);
    }
    return root;
  };

  it('Grift に触れていないファイルと、ja 以外の記事は見ない', () => {
    const root = fixture({
      'src/content/blog/ja/other.md': '最新のv0.7.2では。',
      'src/content/blog/en/grift.md': 'Grift 最新のv0.7.2では。',
      'src/content/news/ja/grift.md': 'Grift CLI の公開中のv0.7.2では。',
    });
    expect(scanRepository(root, '0.8.0')).toEqual([
      expect.objectContaining({ file: 'src/content/news/ja/grift.md', rule: 'current-claim', version: '0.7.2' }),
    ]);
  });

  it('CLI は見つけたら exit 1 で、ファイルと行を出す', () => {
    const root = fixture({
      'src/config/grift-cli-release.json': JSON.stringify({ version: '0.8.0', releasedOn: '2026-10-26' }),
      'src/content/cases/ja/grift.md': 'Grift\n公開中のv0.7.2です。',
    });
    const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts/check-grift-version-claims.mjs')], {
      cwd: root,
      encoding: 'utf8',
      timeout: 10_000,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('src/content/cases/ja/grift.md:2: current-claim:');
  });

  it('実際の ja の記事・UI 文言・/llms.txt に、古い版を「いまの版」として書いた文が無い', () => {
    const { version } = readRelease(ROOT);
    const findings = scanRepository(ROOT, version);
    expect(findings.map((f) => formatFinding(f, version))).toEqual([]);
  });
});
