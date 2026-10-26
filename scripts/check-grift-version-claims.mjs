#!/usr/bin/env node
/**
 * Grift CLI の版の書き方の検査（ADR-0023）。
 *
 * 記事は版を「執筆時点では v0.x」のように、その時点の記録として書く。「公開中」「最新」「現在」と版を一緒に書くと、
 * 次の版が出た日から誤りになる（2026-10-26: 0.8.0 の公開後も「公開中の v0.7.2」が残っていた）。そこで 1 文ずつ見て、
 * - current-claim:    「公開中・公開版・最新・現在・今の」などと一緒に書いた版が、正本（src/config/grift-cli-release.json）と違う
 * - unreleased-claim: 「まだリリースしていない・準備中・公開前」と書いた版が、正本ではもう公開済み
 * を落とす。同じ文に「時点」「当時」「執筆時」があれば記録の形として通す（「現時点」は記録ではないので通さない）。
 *
 * 対象は Grift に触れている ja の記事（src/content/{blog,news,cases}/ja）・ja の UI 文言・/llms.txt。
 * 他言語の記事は CI の翻訳が ja から作るので見ない（ADR-0019）。コード・インラインのコード・URL・HTML のコメントは見ない。
 *
 * CI: scripts/__tests__/grift-version-claims.test.mjs（npm run test:run）が、実際のファイルで 0 件であることを照合する。
 * 手元: npm run check:grift-version
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { compareToRelease, readRelease, RELEASE_FILE } from './lib/grift-cli-release.mjs';

export const SCAN_DIRS = ['src/content/blog/ja', 'src/content/news/ja', 'src/content/cases/ja'];
export const SCAN_FILES = ['src/i18n/locales/ja.json', 'src/pages/llms.txt.ts'];

// 「いまの版」を言う語。「公開版の 0.7.2」も、次の版が出るといまの版と読めてしまうので拾う（記録なら「当時の公開版」と書く）。
// 「います」に当たらないよう「いま」だけでは拾わない
const CURRENT_RE = /公開中|公開版|最新|現在|現行|現時点|いまの|いまは|いま公開|今の|今は|今公開/;
// まだ出ていないと言う語。「次の版（0.8）」も、0.8 が出た日から誤りになる。
// 「まだ数字の隣に載っていません」のような、公開と関係のない「まだ〜ません」は拾わない
const UNRELEASED_RE =
  /未公開|未リリース|リリース前|公開前|準備中|次の版|次のバージョン|まだ(?:リリース|公開)(?:して|されて)(?:い)?(?:ない|ません)/;
// その時点の記録の形
const RECORD_RE = /(?<!現)時点|当時|執筆時/;
// 0.x の版。"0.08日" のような数や "tep-v0.8.0" のような識別子の一部は拾わない
const VERSION_RE = /(?<![\w.-])v?(0\.(?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*))?)(?![\w.%]|日|秒|倍|件|割)/g;

/** 文として読まない部分（コード・インラインのコード・HTML のコメント・URL）を、行の数を保ったまま空白にする */
export function stripNonProse(text) {
  const blank = (s) => s.replace(/[^\n]/g, ' ');
  return text
    .replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, blank)
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/`[^`\n]*`/g, blank)
    .replace(/https?:\/\/[^\s)\]>"'`]+/g, blank);
}

/**
 * 1 つのファイルの本文から、版の書き方の誤りを探す。
 * @returns {{ line: number, rule: 'current-claim' | 'unreleased-claim', version: string, sentence: string }[]}
 */
export function findVersionClaims(text, releaseVersion) {
  const findings = [];
  const originalLines = text.split('\n');
  stripNonProse(text)
    .split('\n')
    .forEach((lineText, index) => {
      // stripNonProse は文字の位置を変えないので、出すときは元の行の同じ範囲を使う（コードが空白のまま出ないように）
      let start = 0;
      for (const raw of lineText.split(/(?<=[。！？])/)) {
        const shown = originalLines[index].slice(start, start + raw.length).trim();
        start += raw.length;
        const sentence = raw.trim();
        const versions = [...sentence.matchAll(VERSION_RE)].map((m) => m[1]);
        if (versions.length === 0 || RECORD_RE.test(sentence)) continue;
        const current = CURRENT_RE.test(sentence);
        const unreleased = UNRELEASED_RE.test(sentence);
        // 1 つの文に両方があるとき（「公開版は 0.7.2 で、0.8.0 は準備中」）は、版ごとに当たる方を 1 つだけ出す
        for (const version of new Set(versions)) {
          const relation = compareToRelease(version, releaseVersion);
          if (current && relation !== 'same') {
            findings.push({ line: index + 1, rule: 'current-claim', version, sentence: shown });
          } else if (unreleased && relation !== 'newer') {
            findings.push({ line: index + 1, rule: 'unreleased-claim', version, sentence: shown });
          }
        }
      }
    });
  return findings;
}

function listTargets(root) {
  const files = [];
  for (const dir of SCAN_DIRS) {
    const full = path.join(root, dir);
    if (!existsSync(full)) continue;
    for (const name of readdirSync(full).sort()) {
      const rel = `${dir}/${name}`;
      if (/\.mdx?$/.test(name) && statSync(path.join(root, rel)).isFile()) files.push(rel);
    }
  }
  return [...files, ...SCAN_FILES.filter((rel) => existsSync(path.join(root, rel)))];
}

/** リポジトリの対象ファイルを見る。Grift に触れていないファイルは見ない */
export function scanRepository(root = process.cwd(), releaseVersion = readRelease(root).version) {
  return listTargets(root).flatMap((file) => {
    const text = readFileSync(path.join(root, file), 'utf8');
    if (!/grift/i.test(text)) return [];
    return findVersionClaims(text, releaseVersion).map((finding) => ({ file, ...finding }));
  });
}

/** 落ちたときの 1 行。直す人が正本の値と、見つけた版の両方を見られるようにする */
export function formatFinding({ file, line, rule, version, sentence }, releaseVersion) {
  const why =
    rule === 'current-claim'
      ? `「公開中・公開版・最新・現在」などと一緒に v${version} と書いているが、正本（${RELEASE_FILE}）は v${releaseVersion}`
      : `v${version} を「まだ出ていない」と書いているが、正本（${RELEASE_FILE}）では v${releaseVersion} まで公開済み`;
  return `${file}:${line}: ${rule}: ${why}\n    ${sentence}`;
}

function main() {
  const { version } = readRelease();
  const findings = scanRepository(process.cwd(), version);
  if (findings.length === 0) {
    process.stdout.write(`grift-version-claims: OK（正本 v${version}）\n`);
    return 0;
  }
  process.stderr.write(`${findings.map((f) => formatFinding(f, version)).join('\n')}\n`);
  process.stderr.write(
    `grift-version-claims: ${findings.length} 件。版は「執筆時点では v0.x」の形にして、リリースノートへリンクする（ADR-0023）\n`
  );
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
