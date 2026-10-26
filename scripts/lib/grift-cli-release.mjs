// Grift CLI の「いま公開している版」の正本（src/config/grift-cli-release.json、ADR-0023）を読み、版を比べる。
// 記事の版の書き方の検査（scripts/check-grift-version-claims.mjs）と、PyPI との照合（scripts/grift-cli-release-watch.mjs）の
// 両方から使う。サイトの側は src/config/grift-cli.ts が同じ JSON を読む（値は JSON の 1 か所だけ）。
// Node の組み込みだけを使う（照合の workflow は npm ci をしない）。

import { readFileSync } from 'node:fs';
import path from 'node:path';

export const RELEASE_FILE = 'src/config/grift-cli-release.json';
export const PYPI_PROJECT = 'grift-cli';
export const GITHUB_REPO = 'Cor-Incorporated/grift-cli';

const VERSION_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\.(0|[1-9]\d*))?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** "0.8.0" → [0, 8, 0]、"0.8" → [0, 8, null]。版の形でなければ null */
export function parseVersion(text) {
  const m = VERSION_RE.exec(String(text).replace(/^v/, ''));
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), m[3] === undefined ? null : Number(m[3])];
}

/**
 * 記事に書かれた版（"0.8" のように patch を省いたものを含む）を、正本の版（"0.8.0"）と比べる。
 * patch を省いた版は系列（0.8 系）として扱い、同じ系列なら same。
 * @returns {'same' | 'older' | 'newer'}
 */
export function compareToRelease(found, release) {
  const a = parseVersion(found);
  const b = parseVersion(release);
  if (!a || !b || b[2] === null) throw new Error(`版を比べられない: found=${found} release=${release}`);
  for (let i = 0; i < 3; i++) {
    if (a[i] === null) return 'same';
    if (a[i] !== b[i]) return a[i] < b[i] ? 'older' : 'newer';
  }
  return 'same';
}

/** 正本の形を確かめる。違えば観測した値を入れて投げる */
export function validateRelease(value) {
  const version = value?.version;
  const releasedOn = value?.releasedOn;
  const parsed = parseVersion(version ?? '');
  if (typeof version !== 'string' || !parsed || parsed[2] === null || version.startsWith('v')) {
    throw new Error(`${RELEASE_FILE} の version は "0.8.0" の形にする（observed ${JSON.stringify(version)}）`);
  }
  if (typeof releasedOn !== 'string' || !DATE_RE.test(releasedOn) || Number.isNaN(Date.parse(releasedOn))) {
    throw new Error(`${RELEASE_FILE} の releasedOn は "2026-10-26" の形にする（observed ${JSON.stringify(releasedOn)}）`);
  }
  const extra = Object.keys(value).filter((k) => k !== 'version' && k !== 'releasedOn');
  if (extra.length > 0) throw new Error(`${RELEASE_FILE} に知らないキーがある（observed ${extra.join(', ')}）`);
  return { version, releasedOn };
}

export function readRelease(root = process.cwd()) {
  return validateRelease(JSON.parse(readFileSync(path.join(root, RELEASE_FILE), 'utf8')));
}

export const releaseNotesUrl = (version) => `https://github.com/${GITHUB_REPO}/releases/tag/v${version}`;
