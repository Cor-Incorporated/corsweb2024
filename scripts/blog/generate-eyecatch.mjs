#!/usr/bin/env node
/**
 * ブログ記事のアイキャッチ（ヒーロー画像）を Gemini の画像生成で作る。
 * 手順と鍵の渡し方は docs/blog-eyecatch.md、絵の方針は docs/blog-style-guide.md「アイキャッチの方針」。
 *
 *   npm run blog:eyecatch -- src/content/blog/ja/<slug>.md --dry-run
 *   GEMINI_API_KEY="$(bwenv get NFC_GEMINI_API_KEY 2>/dev/null)" npm run blog:eyecatch -- src/content/blog/ja/<slug>.md --max 4
 *   npm run blog:eyecatch -- src/content/blog/ja/<slug>.md --pick 2 --alt "画像の説明"
 *
 * 1 回目（生成）は候補を .eyecatch/<slug>/ に置き、記録 public/images/blog/<slug>.eyecatch.json に足すだけで、
 * 記事も公開用の画像も変えない。2 回目（--pick）で 1 枚を AVIF 2 サイズにして public/images/blog/ に置き、
 * frontmatter の image を書く。鍵は環境変数 GEMINI_API_KEY からだけ読み、どこにも書き出さない。
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import matter from 'gray-matter';
import { createEyecatchClient, DEFAULT_EYECATCH_MODEL, IMAGE_CONFIG } from './eyecatch/client.mjs';
import { setFrontmatterImage } from './eyecatch/frontmatter.mjs';
import { readImageSize, renderEyecatchVariants, sha256 } from './eyecatch/image.mjs';
import { buildEyecatchPrompt, PROMPT_VERSION } from './eyecatch/prompt.mjs';
import {
  loadRecord,
  nextCandidateId,
  recordText,
  saveRecord,
  writeFileAtomic,
  writeFilesAtomic,
} from './eyecatch/record.mjs';

export const DEFAULT_MAX = 2;
export const MAX_LIMIT = 6;

export const EXIT = Object.freeze({ ok: 0, failed: 1, usage: 2, refused: 3 });

const BLOG_JA_DIR = path.join('src', 'content', 'blog', 'ja');
const IMAGES_DIR = path.join('public', 'images', 'blog');
const STAGING_DIR = '.eyecatch';
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const MIME_EXTENSIONS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

const HELP = `使い方: npm run blog:eyecatch -- src/content/blog/ja/<slug>.md [オプション]

  --dry-run        API を呼ばず、プロンプトと出力先だけを表示する（鍵は不要。--pick とは併用できない）
  --max N          1 回の実行で作る候補の数（既定 ${DEFAULT_MAX}、最大 ${MAX_LIMIT}）
  --pick N         候補 N を記事の画像にする（API は呼ばない。--alt が必要）
  --alt TEXT       画像の説明（frontmatter の image.alt。絵に描かれているものを書く）
  --force          すでにある画像と image を確認なしで置き換える
  --model ID       画像生成モデル（既定 ${DEFAULT_EYECATCH_MODEL}）

鍵: 環境変数 GEMINI_API_KEY。bwenv から直接渡す（ファイルに書かない）:
  GEMINI_API_KEY="$(bwenv get NFC_GEMINI_API_KEY 2>/dev/null)" npm run blog:eyecatch -- <記事> --max 2`;

/** 鍵そのものと、Gemini の鍵の形の文字列を伏せる。エラーの文面に鍵が混ざっても出力・記録に残さない。 */
export function redact(text, secret) {
  let out = String(text ?? '');
  if (secret) out = out.split(secret).join('[REDACTED]');
  return out.replace(/AIza[0-9A-Za-z_-]{30,}/g, '[REDACTED]');
}

/**
 * 公開される記録に残すエラーの文。1 行目だけにし、鍵を伏せ、リポジトリとホームの絶対パスを外す
 * （EACCES などの文には書き手の PC のパスが入る）。全文は stderr にだけ出す。
 */
export function publicErrorMessage(message, { secret, rootDir }) {
  const firstLine = redact(message, secret).split('\n')[0];
  const withoutPaths = [rootDir, homedir()]
    .filter(Boolean)
    .reduce((text, dir) => text.split(dir).join(dir === rootDir ? '<repo>' : '~'), firstLine)
    .replace(/(?:\/[^\s'"/]+){2,}/g, (abs) => `…/${path.basename(abs)}`);
  return withoutPaths.length > 300 ? `${withoutPaths.slice(0, 300)}…` : withoutPaths;
}

function parseCli(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      'dry-run': { type: 'boolean', default: false },
      max: { type: 'string' },
      pick: { type: 'string' },
      alt: { type: 'string' },
      force: { type: 'boolean', default: false },
      model: { type: 'string' },
      help: { type: 'boolean', default: false },
    },
  });
  return { ...values, file: positionals[0], extra: positionals.slice(1) };
}

function parseCount(value, name, { min, max }) {
  if (!/^\d+$/.test(value)) throw new UsageError(`${name} は整数で指定してください（${value}）`);
  const n = Number(value);
  if (n < min || n > max) throw new UsageError(`${name} は ${min}〜${max} で指定してください（${n}）`);
  return n;
}

class UsageError extends Error {}

/** 記事のパスを確かめ、slug と frontmatter を返す。ja の記事だけを受け付ける（en/zh/ko/es は翻訳 CI のもの）。 */
async function readPost(rootDir, file) {
  if (!file) throw new UsageError('記事のファイルを指定してください');
  const abs = path.resolve(rootDir, file);
  const jaDir = path.join(rootDir, BLOG_JA_DIR) + path.sep;
  if (!abs.startsWith(jaDir) || !abs.endsWith('.md')) {
    throw new UsageError(`${BLOG_JA_DIR}/ の .md だけを受け付けます（${file}）`);
  }
  const slug = path.basename(abs, '.md');
  if (!SLUG_PATTERN.test(slug)) throw new UsageError(`slug に使えない文字があります（${slug}）`);
  const text = await readFile(abs, 'utf8');
  const { data } = matter(text);
  if (!data.title) throw new UsageError(`frontmatter に title がありません（${file}）`);
  return { abs, rel: path.relative(rootDir, abs), slug, text, data };
}

function pathsFor(rootDir, slug) {
  return {
    record: path.join(rootDir, IMAGES_DIR, `${slug}.eyecatch.json`),
    staging: path.join(rootDir, STAGING_DIR, slug),
    image: (suffix) => path.join(rootDir, IMAGES_DIR, `${slug}${suffix}.avif`),
    publicUrl: (suffix) => `/images/blog/${slug}${suffix}.avif`,
  };
}

function printDryRun(io, { post, prompt, model, max, paths, rootDir }) {
  const rel = (p) => path.relative(rootDir, p);
  io.stdout(`記事: ${post.rel}`);
  io.stdout(`モデル: ${model}（${IMAGE_CONFIG.aspectRatio}, ${IMAGE_CONFIG.imageSize}）`);
  io.stdout(`候補の数: ${max}（置き場: ${rel(paths.staging)}/）`);
  io.stdout(`記録: ${rel(paths.record)}`);
  io.stdout(`採用後の画像: ${rel(paths.image(''))}（1600×900）, ${rel(paths.image('-1200x630'))}（1200×630）`);
  io.stdout(`--- プロンプト（v${PROMPT_VERSION}） ---\n${prompt}`);
}

/** 1 枚生成して置き場に書き、記録の 1 行を返す。失敗したら失敗の行を返す（鍵と PC のパスは伏せる）。 */
async function generateOne({ client, prompt, id, paths, rootDir, now, apiKey, io }) {
  const base = {
    id,
    generatedAt: now().toISOString(),
    model: client.model,
    promptVersion: PROMPT_VERSION,
    prompt,
    imageConfig: { ...IMAGE_CONFIG },
    picked: false,
  };
  try {
    const { mimeType, bytes } = await client.generate(prompt);
    const { width, height } = await readImageSize(bytes);
    const file = path.join(paths.staging, `candidate-${id}.${MIME_EXTENSIONS[mimeType] ?? 'png'}`);
    await writeFileAtomic(file, bytes);
    return {
      ...base,
      status: 'generated',
      mimeType,
      width,
      height,
      bytes: bytes.length,
      sha256: sha256(bytes),
      file: path.relative(rootDir, file).split(path.sep).join('/'),
    };
  } catch (error) {
    io.stderr(`候補 ${id} のエラー: ${redact(error?.message, apiKey)}`);
    return { ...base, status: 'failed', error: publicErrorMessage(error?.message, { secret: apiKey, rootDir }) };
  }
}

async function runGenerate({ post, prompt, model, max, paths, rootDir, env, io, createClient, now }) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    io.stderr('GEMINI_API_KEY が未設定です。bwenv から直接渡してください（ファイルに書かない）:');
    io.stderr(`  GEMINI_API_KEY="$(bwenv get NFC_GEMINI_API_KEY 2>/dev/null)" npm run blog:eyecatch -- ${post.rel}`);
    return EXIT.usage;
  }
  const client = await createClient({ apiKey, model });
  let record = await loadRecord(paths.record, { slug: post.slug, source: post.rel });
  await mkdir(paths.staging, { recursive: true });
  let failures = 0;
  for (let i = 0; i < max; i += 1) {
    const entry = await generateOne({ client, prompt, id: nextCandidateId(record), paths, rootDir, now, apiKey, io });
    record = { ...record, candidates: [...record.candidates, entry] };
    // 1 枚ごとに記録を書く。途中で止まっても、それまでの候補と記録の対応が残る。
    await saveRecord(paths.record, record);
    if (entry.status === 'generated') {
      io.stdout(`候補 ${entry.id}: ${entry.file}（${entry.width}×${entry.height}）`);
    } else {
      failures += 1;
      io.stderr(`候補 ${entry.id}: 失敗しました（${entry.error}）`);
    }
  }
  io.stdout(`記録: ${path.relative(rootDir, paths.record)}`);
  io.stdout(`採用するとき: npm run blog:eyecatch -- ${post.rel} --pick <番号> --alt "画像の説明"`);
  return failures > 0 ? EXIT.failed : EXIT.ok;
}

/** すでに画像か frontmatter の image があるとき、置き換えてよいかを決める。 */
async function allowOverwrite({ post, paths, force, io }) {
  const existing = ['', '-1200x630'].map(paths.image).filter((p) => existsSync(p));
  if (existing.length === 0 && !post.data.image) return true;
  if (force) return true;
  const what = [...existing.map((p) => path.basename(p)), ...(post.data.image ? ['frontmatter の image'] : [])];
  const question = `次を置き換えます: ${what.join(', ')}。よろしいですか？ [y/N] `;
  if (!io.isTTY) {
    io.stderr(`${question}\n対話できないので止めました。置き換えるなら --force を付けてください。`);
    return false;
  }
  return /^y(es)?$/i.test((await io.confirm(question)).trim());
}

async function runPick({ post, pick, alt, force, paths, io, now }) {
  const id = parseCount(pick, '--pick', { min: 1, max: Number.MAX_SAFE_INTEGER });
  const altText = (alt ?? '').trim();
  if (!altText) throw new UsageError('--pick には --alt "画像の説明" が必要です');
  const record = await loadRecord(paths.record, { slug: post.slug, source: post.rel });
  const candidate = record.candidates.find((c) => c.id === id && c.status === 'generated');
  if (!candidate) throw new UsageError(`生成済みの候補 ${id} が記録にありません（${path.basename(paths.record)}）`);
  const source = await readFile(path.join(paths.staging, path.basename(candidate.file)));
  if (sha256(source) !== candidate.sha256) {
    io.stderr(`候補 ${id} のファイルが記録の sha256 と違います。生成し直してください。`);
    return EXIT.failed;
  }
  // 画像・本文・記録を全部メモリ上で作ってから書く。変換や frontmatter の検証で落ちたら、何も書き換えない。
  const variants = await renderEyecatchVariants(source);
  const nextText = setFrontmatterImage(post.text, { url: paths.publicUrl(''), alt: altText });
  if (!(await allowOverwrite({ post, paths, force, io }))) return EXIT.refused;
  const picked = {
    candidateId: id,
    pickedAt: now().toISOString(),
    alt: altText,
    outputs: variants.map((v) => ({
      path: paths.publicUrl(v.suffix),
      width: v.width,
      height: v.height,
      bytes: v.buffer.length,
      sha256: v.sha256,
    })),
  };
  // 画像 2 枚・記事・記録の 4 つをまとめて置き換える。1 つでも書けなければ、どれも変えない。
  await writeFilesAtomic([
    ...variants.map((v) => [paths.image(v.suffix), v.buffer]),
    [post.abs, nextText],
    [
      paths.record,
      recordText({ ...record, candidates: record.candidates.map((c) => ({ ...c, picked: c.id === id })), picked }),
    ],
  ]);
  picked.outputs.forEach((o) => io.stdout(`画像: public${o.path}（${o.width}×${o.height}, ${o.bytes} bytes）`));
  io.stdout(`frontmatter: image.url = ${paths.publicUrl('')}`);
  return EXIT.ok;
}

function defaultIo() {
  return {
    stdout: (line) => process.stdout.write(`${line}\n`),
    stderr: (line) => process.stderr.write(`${line}\n`),
    isTTY: Boolean(process.stdin.isTTY && process.stdout.isTTY),
    async confirm(question) {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      try {
        return await rl.question(question);
      } finally {
        rl.close();
      }
    },
  };
}

/**
 * @param {{ argv?: string[], env?: Record<string, string | undefined>, rootDir?: string,
 *           io?: ReturnType<typeof defaultIo>, createClient?: typeof createEyecatchClient, now?: () => Date }} [options]
 * @returns {Promise<number>} 終了コード（EXIT）
 */
export async function main({
  argv = process.argv.slice(2),
  env = process.env,
  rootDir = process.cwd(),
  io = defaultIo(),
  createClient = createEyecatchClient,
  now = () => new Date(),
} = {}) {
  try {
    const args = parseCli(argv);
    if (args.help) {
      io.stdout(HELP);
      return EXIT.ok;
    }
    if (args.extra.length > 0) throw new UsageError(`記事は 1 つだけ指定してください（${args.extra.join(' ')}）`);
    const post = await readPost(rootDir, args.file);
    const paths = pathsFor(rootDir, post.slug);
    if (args.pick !== undefined) {
      // --dry-run は「何も書かない」約束なので、書き込む --pick とは一緒に受け付けない。
      if (args['dry-run']) throw new UsageError('--pick と --dry-run は一緒に使えません');
      return await runPick({ post, ...args, paths, io, now });
    }
    const max = args.max === undefined ? DEFAULT_MAX : parseCount(args.max, '--max', { min: 1, max: MAX_LIMIT });
    const model = args.model ?? DEFAULT_EYECATCH_MODEL;
    if (!/^[a-z0-9][a-z0-9.-]*$/.test(model)) throw new UsageError(`--model の形が正しくありません（${model}）`);
    const prompt = buildEyecatchPrompt(post.data);
    if (args['dry-run']) {
      printDryRun(io, { post, prompt, model, max, paths, rootDir });
      return EXIT.ok;
    }
    return await runGenerate({ post, prompt, model, max, paths, rootDir, env, io, createClient, now });
  } catch (error) {
    io.stderr(redact(error?.message ?? String(error), env.GEMINI_API_KEY));
    if (error instanceof UsageError || error?.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION') {
      io.stderr('使い方: npm run blog:eyecatch -- --help');
      return EXIT.usage;
    }
    return EXIT.failed;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = await main();
}
