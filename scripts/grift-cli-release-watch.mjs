#!/usr/bin/env node
/**
 * Grift CLI の版の正本（src/config/grift-cli-release.json）を、PyPI の最新と照合する（ADR-0023）。
 *
 * .github/workflows/grift-cli-release-watch.yml が毎日動かし、違えば Issue を開く（Issue を開くのは workflow の側）。
 * 次の版が出たら、手元で `--write` を付けて動かすと、PyPI の版と公開日（日本時間）で JSON を書き換える。
 *
 *   node scripts/grift-cli-release-watch.mjs                      照合だけ（違っても exit 0。取れなければ exit 1）
 *   node scripts/grift-cli-release-watch.mjs --write              PyPI の最新で JSON を書き換える
 *   --body-file <path>      違ったときの Issue の本文を書く
 *   --github-output <path>  drift / title / pypi_version を GitHub Actions の出力に書く
 *   --pypi-json <path> / --github-json <path>  取りに行かず、保存した応答を読む（テスト用）
 *
 * 違うかどうかは PyPI だけで決める（配布の一次資料）。GitHub の Release は本文に並べるだけで、取れなくても止めない。
 * Node の組み込みだけを使う（workflow は npm ci をしない）。
 */
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  compareToRelease,
  GITHUB_REPO,
  parseVersion,
  PYPI_PROJECT,
  readRelease,
  RELEASE_FILE,
  releaseNotesUrl,
  validateRelease,
} from './lib/grift-cli-release.mjs';

export const PYPI_URL = `https://pypi.org/pypi/${PYPI_PROJECT}/json`;
export const GITHUB_LATEST_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

/** ISO 8601 の時刻を、日本時間の日付（YYYY-MM-DD）にする。PyPI の時刻は UTC（末尾に Z が無いこともある） */
export function toJstDate(iso) {
  const time = Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(time)) throw new Error(`時刻として読めない（observed ${JSON.stringify(iso)}）`);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date(time));
}

/** PyPI の JSON API の応答から、最新の版と、その版の最初のファイルを上げた時刻を取り出す */
export function readPypi(json) {
  const version = json?.info?.version;
  const parsed = parseVersion(version ?? '');
  if (typeof version !== 'string' || !parsed || parsed[2] === null) {
    throw new Error(`PyPI の info.version が版の形ではない（observed ${JSON.stringify(version)}）`);
  }
  const files = json?.releases?.[version];
  const uploadedAt = Array.isArray(files) && files.length > 0 ? files[0].upload_time_iso_8601 : undefined;
  if (typeof uploadedAt !== 'string') {
    throw new Error(`PyPI の releases["${version}"] にファイルの時刻が無い（observed ${JSON.stringify(files)}）`);
  }
  return { version, uploadedAt, releasedOn: toJstDate(uploadedAt) };
}

/** GitHub の releases/latest の応答から、tag と URL を取り出す。形が違えば null（照合は止めない） */
export function readGithubLatest(json) {
  if (typeof json?.tag_name !== 'string' || typeof json?.html_url !== 'string') return null;
  return { tag: json.tag_name, url: json.html_url, publishedAt: json.published_at ?? null };
}

const pypiPage = (version = '') => `https://pypi.org/project/${PYPI_PROJECT}/${version ? `${version}/` : ''}`;

/** 違ったときの直し方。正本が PyPI より新しいとき（PyPI に出る前に正本を進めた）は、戻し方を書く */
export function fixSteps({ release, pypi, ahead }) {
  if (ahead) {
    return [
      `正本（v${release.version}）が PyPI の最新（v${pypi.version}）より新しい。PyPI に v${release.version} が出ているかを確かめる（${pypiPage(release.version)}）`,
      '出ていなければ、正本を PyPI の最新に戻す: `node scripts/grift-cli-release-watch.mjs --write`',
    ];
  }
  // リポジトリの直下で動かす（.worktrees/ は .gitignore 済み）
  const dir = `.worktrees/claude/grift-cli-v${pypi.version}`;
  return [
    `作業用の worktree を作る（lane-launch-gate が origin/main より古い起点を拒否するので origin/main から切り、develop を merge する）: \`git fetch origin && git worktree add ${dir} -b chore/grift-cli-v${pypi.version} origin/main && git -C ${dir} merge --no-edit origin/develop && cd ${dir} && npm ci\``,
    `\`node scripts/grift-cli-release-watch.mjs --write\`（${RELEASE_FILE} が下の内容になる）`,
    '`npm run check:grift-version` で、記事の「公開中・最新・現在」と一緒に書いた古い版を探し、「執筆時点では v0.x」の形に直す（ja だけ。翻訳は CI が作る）',
    '`npm run test:run` と `npm run build`、build の後に `npm run test:dist`',
    `develop へ PR を出す（題の例: \`chore: Grift CLI の版の正本を v${pypi.version} にする\`）。PR の本文に \`Refs #<この Issue の番号>\` と書く（この Issue は手で閉じない）`,
  ];
}

/**
 * 正本と PyPI を比べ、違えば Issue の題と本文を作る。
 * 題には両方の版を入れる（同じ組み合わせの Issue を 2 つ開かないように、workflow が題で探す）。
 */
export function compareRelease({ release, pypi, github, githubError = null }) {
  const drift = release.version !== pypi.version;
  const title = `Grift CLI の版の正本（v${release.version}）が PyPI の最新（v${pypi.version}）と違う`;
  if (!drift) return { drift, title, body: '' };
  const ahead = compareToRelease(release.version, pypi.version) === 'newer';
  const next = { version: pypi.version, releasedOn: pypi.releasedOn };
  const githubRow = github ? `${github.tag}（${github.url}）` : `取れなかった${githubError ? `（${githubError}）` : ''}`;
  const githubNote =
    github && github.tag !== `v${pypi.version}`
      ? `\n> GitHub の最新の Release（${github.tag}）が PyPI の版（v${pypi.version}）と違う。記事からリンクするリリースノート（${releaseNotesUrl(pypi.version)}）があるかを先に確かめる。\n`
      : '';
  const nextJson = ahead
    ? ''
    : `書き換えたあとの \`${RELEASE_FILE}\`:\n\n\`\`\`json\n${JSON.stringify(next, null, 2)}\n\`\`\`\n\n` +
      '手順の詳細: `docs/adr/ADR-0023-grift-cli-version-source.md` の「次の版が出たとき」。\n\n';
  const body = `cor-jp.com の Grift CLI の版の正本と、PyPI の最新が違います（ADR-0023）。

| | 版 | 公開日（日本時間） |
|---|---|---|
| 正本（\`${RELEASE_FILE}\`） | v${release.version} | ${release.releasedOn} |
| PyPI（${pypiPage()}） | v${pypi.version} | ${pypi.releasedOn}（PyPI の時刻 ${pypi.uploadedAt}） |
| GitHub の最新の Release | ${githubRow} | |
${githubNote}
## 直し方

${fixSteps({ release, pypi, ahead })
  .map((step, i) => `${i + 1}. ${step}`)
  .join('\n')}

${nextJson}この Issue は \`.github/workflows/grift-cli-release-watch.yml\` が開きました。同じ題の Issue が開いている間は、もう開きません。照合は main の正本を読むので、develop で直したあとも main へのリリースまでは開いたままで、PyPI と同じになった日の照合で閉じます。
`;
  return { drift, title, body, next };
}

async function fetchJson(url, headers = {}) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'cor-jp.com grift-cli-release-watch', ...headers },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

function parseArgs(argv) {
  const args = { write: false };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--write') args.write = true;
    else if (['--body-file', '--github-output', '--pypi-json', '--github-json'].includes(key) && argv[i + 1]) {
      args[key.slice(2).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = argv[++i];
    } else {
      throw new Error(`知らない引数: ${key}`);
    }
  }
  return args;
}

const readJsonFile = (file) => JSON.parse(readFileSync(file, 'utf8'));

async function loadGithub(args) {
  if (args.githubJson) return { github: readGithubLatest(readJsonFile(args.githubJson)), githubError: null };
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  try {
    const json = await fetchJson(GITHUB_LATEST_URL, token ? { Authorization: `Bearer ${token}` } : {});
    return { github: readGithubLatest(json), githubError: null };
  } catch (error) {
    return { github: null, githubError: String(error.message || error) };
  }
}

export async function main(argv = process.argv.slice(2), root = process.cwd()) {
  const args = parseArgs(argv);
  const release = readRelease(root);
  const pypi = readPypi(args.pypiJson ? readJsonFile(args.pypiJson) : await fetchJson(PYPI_URL));

  if (args.write) {
    const next = validateRelease({ version: pypi.version, releasedOn: pypi.releasedOn });
    writeFileSync(path.join(root, RELEASE_FILE), `${JSON.stringify(next, null, 2)}\n`);
    process.stdout.write(`${RELEASE_FILE}: v${release.version}（${release.releasedOn}）→ v${next.version}（${next.releasedOn}）\n`);
    return 0;
  }

  const { github, githubError } = await loadGithub(args);
  if (githubError) process.stdout.write(`::warning title=grift-cli-release-watch::GitHub の Release を取れなかった: ${githubError}\n`);
  const result = compareRelease({ release, pypi, github, githubError });
  if (args.bodyFile) writeFileSync(args.bodyFile, result.body);
  if (args.githubOutput) {
    appendFileSync(args.githubOutput, `drift=${result.drift}\ntitle=${result.title}\npypi_version=${pypi.version}\n`);
  }
  process.stdout.write(
    result.drift
      ? `違う: 正本 v${release.version}、PyPI v${pypi.version}（${pypi.releasedOn}）\n`
      : `同じ: 正本と PyPI の最新は v${pypi.version}\n`
  );
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      process.stderr.write(`grift-cli-release-watch: ${error.message || error}\n`);
      process.exitCode = 1;
    }
  );
}
