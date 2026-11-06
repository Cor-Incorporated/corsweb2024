// @vitest-environment node
/**
 * npm run blog:eyecatch（scripts/blog/generate-eyecatch.mjs）の検査。API はモックに差し替え、
 * 一時ディレクトリをリポジトリの根に見立てて、記録・変換・上書きの保護・鍵の扱いを確かめる。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import matter from 'gray-matter';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setFrontmatterImage } from '../eyecatch/frontmatter.mjs';
import { renderEyecatchVariants, sha256 } from '../eyecatch/image.mjs';
import { buildEyecatchPrompt, PROHIBITED } from '../eyecatch/prompt.mjs';
import { EXIT, main, publicErrorMessage, redact } from '../generate-eyecatch.mjs';

// 本物の鍵の形にしない（gitleaks に掛からないように、実行時に組み立てる）。
const FAKE_KEY = ['fake', 'eyecatch', 'key', 'do-not-print', '0123456789'].join('-');
const POST = 'src/content/blog/ja/sample-post.md';
const ARTICLE = `---
title: "小さなモデルで試す"
description: "説明の文です。"
summary: "要点の 1 文目です。要点の 2 文目です。"
pubDate: 2026-10-30
author: "Terisuke"
category: "ai"
tags: ["AI"]
lang: "ja"
isDraft: false
---

本文です。
`;

let root;
let lines;

async function pngOf(width, height, color = '#2563eb') {
  return sharp({ create: { width, height, channels: 3, background: color } }).png().toBuffer();
}

/** generate() を呼ばれた順に results を返すモック。Error を入れるとその回で失敗する。 */
function mockClient(results) {
  const calls = [];
  let created = 0;
  const createClient = async ({ model }) => {
    created += 1;
    return {
      model,
      async generate(prompt) {
        calls.push(prompt);
        const next = results[calls.length - 1];
        if (next instanceof Error) throw next;
        return { mimeType: 'image/png', bytes: next };
      },
    };
  };
  return { createClient, calls, created: () => created };
}

function run(argv, { env = { GEMINI_API_KEY: FAKE_KEY }, createClient, isTTY = false, answer = 'n' } = {}) {
  const io = {
    stdout: (line) => lines.push(['out', line]),
    stderr: (line) => lines.push(['err', line]),
    isTTY,
    confirm: async () => answer,
  };
  return main({ argv, env, rootDir: root, io, createClient, now: () => new Date('2026-10-30T01:23:45Z') });
}

const output = () => lines.map(([, line]) => line).join('\n');
const readRecord = () =>
  JSON.parse(readFileSync(path.join(root, 'public/images/blog/sample-post.eyecatch.json'), 'utf8'));
const heroPath = () => path.join(root, 'public/images/blog/sample-post.avif');

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'eyecatch-'));
  lines = [];
  await mkdir(path.join(root, 'src/content/blog/ja'), { recursive: true });
  await mkdir(path.join(root, 'public/images/blog'), { recursive: true });
  await writeFile(path.join(root, POST), ARTICLE);
});

afterEach(async () => rm(root, { recursive: true, force: true }));

describe('プロンプトの組み立て', () => {
  it('題・要点・カテゴリのモチーフと、入れないもの（文字・顔・ロゴ・偽スクショ）をすべて含む', () => {
    const prompt = buildEyecatchPrompt(matter(ARTICLE).data);
    expect(prompt).toContain('Title (mood only): 小さなモデルで試す');
    expect(prompt).toContain('Summary (mood only): 要点の 1 文目です。要点の 2 文目です。');
    expect(prompt).toContain('two parallel paths being compared');
    for (const item of PROHIBITED) expect(prompt).toContain(item);
    expect(prompt).toMatch(/never write them in the image/);
    // 書き手や公開状態など、絵に関係しない欄は渡さない。
    expect(prompt).not.toContain('Terisuke');
  });

  it('summary が無ければ description を使い、改行は 1 行にまとめる', () => {
    const prompt = buildEyecatchPrompt({ title: '題', description: '1 行目\n2 行目', category: 'lab' });
    expect(prompt).toContain('Summary (mood only): 1 行目 2 行目');
    expect(prompt).toContain('laboratory bench');
  });
});

describe('AVIF への変換', () => {
  it('16:9 の生成画像から 1600×900 と 1200×630 の AVIF を作る', async () => {
    const variants = await renderEyecatchVariants(await pngOf(2752, 1536));
    const sizes = await Promise.all(variants.map((v) => sharp(v.buffer).metadata()));
    expect(sizes.map(({ width, height }) => `${width}x${height}`)).toEqual(['1600x900', '1200x630']);
    // sharp は AVIF を heif（圧縮 av1）として読む。
    expect(sizes.every((m) => m.format === 'heif' && m.compression === 'av1')).toBe(true);
    expect(variants.map((v) => v.sha256)).toEqual(variants.map((v) => sha256(v.buffer)));
  });
});

describe('生成と記録', () => {
  it('候補を置き場に書き、記録にモデル・プロンプト・日時・大きさ・sha256 を残す。記事は変えない', async () => {
    const png = await pngOf(2752, 1536);
    const mock = mockClient([png, png]);
    expect(await run([POST, '--max', '2'], { createClient: mock.createClient })).toBe(EXIT.ok);

    const record = readRecord();
    expect(record.candidates).toHaveLength(2);
    const [first] = record.candidates;
    expect(first).toMatchObject({
      id: 1,
      status: 'generated',
      model: 'gemini-3.1-flash-image',
      generatedAt: '2026-10-30T01:23:45.000Z',
      width: 2752,
      height: 1536,
      sha256: sha256(png),
      file: '.eyecatch/sample-post/candidate-1.png',
      picked: false,
    });
    expect(first.prompt).toBe(mock.calls[0]);
    expect(readFileSync(path.join(root, first.file))).toEqual(png);
    expect(readFileSync(path.join(root, POST), 'utf8')).toBe(ARTICLE);
    expect(existsSync(heroPath())).toBe(false);
  });

  it('途中で失敗しても、それまでの候補と失敗の行を記録して 1 で終わる', async () => {
    const mock = mockClient([await pngOf(2752, 1536), new Error('quota exceeded')]);
    expect(await run([POST, '--max', '2'], { createClient: mock.createClient })).toBe(EXIT.failed);
    expect(readRecord().candidates.map((c) => c.status)).toEqual(['generated', 'failed']);
    expect(readRecord().candidates[1].error).toBe('quota exceeded');
  });

  it('--max は 1〜6。7 は使い方の誤りとして API を呼ばない', async () => {
    const mock = mockClient([]);
    expect(await run([POST, '--max', '7'], { createClient: mock.createClient })).toBe(EXIT.usage);
    expect(mock.created()).toBe(0);
  });

  it('--dry-run は鍵なしで動き、プロンプトと出力先を出すだけで何も書かない', async () => {
    const mock = mockClient([]);
    expect(await run([POST, '--dry-run'], { env: {}, createClient: mock.createClient })).toBe(EXIT.ok);
    expect(mock.created()).toBe(0);
    expect(output()).toContain('public/images/blog/sample-post.avif（1600×900）');
    expect(output()).toContain('Title (mood only): 小さなモデルで試す');
    expect(existsSync(path.join(root, '.eyecatch'))).toBe(false);
    expect(existsSync(path.join(root, 'public/images/blog/sample-post.eyecatch.json'))).toBe(false);
  });

  it('ja の記事以外（翻訳 CI の en など）は受け付けない', async () => {
    expect(await run(['src/content/blog/en/sample-post.md', '--dry-run'])).toBe(EXIT.usage);
  });
});

describe('鍵の扱い', () => {
  it('鍵が未設定なら API を呼ばず 2 で終わり、bwenv での渡し方を案内する', async () => {
    const mock = mockClient([]);
    expect(await run([POST], { env: {}, createClient: mock.createClient })).toBe(EXIT.usage);
    expect(mock.created()).toBe(0);
    expect(output()).toContain('GEMINI_API_KEY が未設定です');
    expect(output()).toContain('bwenv get NFC_GEMINI_API_KEY');
    expect(existsSync(path.join(root, 'public/images/blog/sample-post.eyecatch.json'))).toBe(false);
  });

  it('API のエラーが鍵を含んでも、stdout・stderr・記録に鍵を出さない', async () => {
    const mock = mockClient([new Error(`request failed for key=${FAKE_KEY}`)]);
    expect(await run([POST, '--max', '1'], { createClient: mock.createClient })).toBe(EXIT.failed);
    expect(output()).not.toContain(FAKE_KEY);
    expect(output()).toContain('[REDACTED]');
    const recordText = readFileSync(path.join(root, 'public/images/blog/sample-post.eyecatch.json'), 'utf8');
    expect(recordText).not.toContain(FAKE_KEY);
  });

  it('クライアントを作る段階で鍵を含むエラーが出ても、出力に鍵を出さない', async () => {
    const createClient = async () => {
      throw new Error(`invalid api key: ${FAKE_KEY}`);
    };
    expect(await run([POST, '--max', '1'], { createClient })).toBe(EXIT.failed);
    expect(output()).not.toContain(FAKE_KEY);
    expect(output()).toContain('[REDACTED]');
  });

  it('公開される記録のエラーには、リポジトリやホームの絶対パスを残さない', async () => {
    const leaked = `EACCES: permission denied, open '${root}/.eyecatch/sample-post/candidate-1.png.tmp-1'\nstack…`;
    const mock = mockClient([new Error(leaked)]);
    expect(await run([POST, '--max', '1'], { createClient: mock.createClient })).toBe(EXIT.failed);
    const { error } = readRecord().candidates[0];
    expect(error).not.toContain(root);
    expect(error).not.toContain('stack');
    expect(error).toContain('EACCES: permission denied');
    expect(publicErrorMessage(`open '${homedir()}/x/y.png'`, { rootDir: root })).not.toContain(homedir());
    // リポジトリとホームの外の絶対パスも、ファイル名だけにする。
    const outside = publicErrorMessage("open '/var/tmp/a/b.png'", { rootDir: root });
    expect(outside).not.toContain('/var/tmp/a');
    expect(outside).toContain('b.png');
  });

  it('公開される記録のエラーには、GCP の project 番号とリソース名を残さない', async () => {
    const body = JSON.stringify({
      error: {
        code: 403,
        message:
          'Generative Language API has not been used in project 123456789012 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/generativelanguage.googleapis.com/overview?project=123456789012 then retry.',
        status: 'PERMISSION_DENIED',
        details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'SERVICE_DISABLED', metadata: { consumer: 'projects/123456789012', service: 'generativelanguage.googleapis.com' } }],
      },
    });
    const mock = mockClient([new Error(body)]);
    expect(await run([POST, '--max', '1'], { createClient: mock.createClient })).toBe(EXIT.failed);
    const { error } = readRecord().candidates[0];
    expect(error).not.toContain('123456789012');
    expect(error).not.toMatch(/projects?[=/ ]/);
    expect(error).not.toContain('https://');
    expect(error).toContain('403');
    expect(error).toContain('PERMISSION_DENIED');
    // JSON でない文でも、project の番号と長い数字は残さない。
    const plain = publicErrorMessage('quota for project 987654321098 exhausted (consumer projects/987654321098)', { rootDir: root });
    expect(plain).not.toContain('987654321098');
    expect(plain).toContain('quota');
    // project の規則だけに掛かる短い番号と、要約の経路に混ざった識別子も伏せる。
    expect(publicErrorMessage('consumer projects/12345678 denied', { rootDir: root })).toBe('consumer projects/<redacted> denied');
    // 識別子を先頭に置く。後ろに置くと 300 字の打ち切りだけで消えて、伏せ字の有無を見分けられない。
    const longStatus = JSON.stringify({ error: { code: 503, status: `projects/123456789012 https://x.example/overview?project=123456789012 ${'x'.repeat(400)}` } });
    const summary = publicErrorMessage(longStatus, { rootDir: root });
    expect(summary).not.toContain('123456789012');
    expect(summary).not.toContain('https://');
    expect(summary).toContain('projects/<redacted>');
    expect(summary.length).toBeLessThanOrEqual(300);
  });

  it('redact は渡された鍵と、Gemini の鍵の形の文字列を伏せる', () => {
    const geminiShaped = `AIza${'x'.repeat(35)}`;
    expect(redact(`a ${FAKE_KEY} b ${geminiShaped}`, FAKE_KEY)).toBe('a [REDACTED] b [REDACTED]');
  });
});

describe('採用（--pick）と上書きの保護', () => {
  async function generateTwo() {
    const mock = mockClient([await pngOf(2752, 1536, '#2563eb'), await pngOf(2752, 1536, '#57534e')]);
    await run([POST, '--max', '2'], { createClient: mock.createClient });
  }

  it('候補を AVIF 2 サイズにして置き、frontmatter の image と記録の picked を書く', async () => {
    await generateTwo();
    expect(await run([POST, '--pick', '2', '--alt', '灰色の図形'])).toBe(EXIT.ok);
    const { data } = matter(readFileSync(path.join(root, POST), 'utf8'));
    expect(data.image).toEqual({ url: '/images/blog/sample-post.avif', alt: '灰色の図形' });
    const record = readRecord();
    expect(record.picked).toMatchObject({ candidateId: 2, alt: '灰色の図形' });
    expect(record.picked.outputs.map((o) => `${o.path} ${o.width}x${o.height}`)).toEqual([
      '/images/blog/sample-post.avif 1600x900',
      '/images/blog/sample-post-1200x630.avif 1200x630',
    ]);
    expect(record.picked.outputs[0].sha256).toBe(sha256(readFileSync(heroPath())));
    expect(record.candidates.map((c) => c.picked)).toEqual([false, true]);
  });

  it('--alt が無ければ何も書かずに 2 で終わる', async () => {
    await generateTwo();
    expect(await run([POST, '--pick', '1'])).toBe(EXIT.usage);
    expect(existsSync(heroPath())).toBe(false);
  });

  it('既存の画像は、対話できないときは --force なしで置き換えない（バイト列が変わらない）', async () => {
    await generateTwo();
    await run([POST, '--pick', '1', '--alt', '青い図形']);
    const before = readFileSync(heroPath());
    const articleBefore = readFileSync(path.join(root, POST), 'utf8');

    expect(await run([POST, '--pick', '2', '--alt', '灰色の図形'])).toBe(EXIT.refused);
    expect(readFileSync(heroPath())).toEqual(before);
    expect(readFileSync(path.join(root, POST), 'utf8')).toBe(articleBefore);
    expect(output()).toContain('--force');

    expect(await run([POST, '--pick', '2', '--alt', '灰色の図形'], { isTTY: true, answer: 'n' })).toBe(EXIT.refused);
    expect(readFileSync(heroPath())).toEqual(before);

    expect(await run([POST, '--pick', '2', '--alt', '灰色の図形', '--force'])).toBe(EXIT.ok);
    expect(readFileSync(heroPath())).not.toEqual(before);
  });

  it('--pick と --dry-run は一緒に使えず、何も書かない', async () => {
    await generateTwo();
    expect(await run([POST, '--pick', '1', '--alt', '青い図形', '--dry-run', '--force'])).toBe(EXIT.usage);
    expect(existsSync(heroPath())).toBe(false);
    expect(readFileSync(path.join(root, POST), 'utf8')).toBe(ARTICLE);
  });

  it('画像ファイルが無くても frontmatter に image があれば、--force なしでは置き換えない', async () => {
    await generateTwo();
    const withImage = setFrontmatterImage(ARTICLE, { url: '/images/blog/other.avif', alt: '別の画像' });
    await writeFile(path.join(root, POST), withImage);
    expect(await run([POST, '--pick', '1', '--alt', '青い図形'])).toBe(EXIT.refused);
    expect(readFileSync(path.join(root, POST), 'utf8')).toBe(withImage);
    expect(existsSync(heroPath())).toBe(false);
  });

  it('対話できるときは y で置き換える', async () => {
    await generateTwo();
    await run([POST, '--pick', '1', '--alt', '青い図形']);
    const before = readFileSync(heroPath());
    expect(await run([POST, '--pick', '2', '--alt', '灰色の図形'], { isTTY: true, answer: 'y' })).toBe(EXIT.ok);
    expect(readFileSync(heroPath())).not.toEqual(before);
  });

  it('frontmatter を書き換えられない記事（CRLF）では、画像も書かない', async () => {
    await generateTwo();
    const crlf = ARTICLE.replace(/\n/g, '\r\n');
    await writeFile(path.join(root, POST), crlf);
    expect(await run([POST, '--pick', '1', '--alt', '青い図形', '--force'])).toBe(EXIT.failed);
    expect(existsSync(heroPath())).toBe(false);
    expect(readFileSync(path.join(root, POST), 'utf8')).toBe(crlf);
  });

  // root で動くとパーミッションで書き込みを止められないので、その環境では飛ばす。
  it.skipIf(process.getuid?.() === 0)('記事を書けないときは、画像も記録も置き換えず一時ファイルも残さない', async () => {
    await generateTwo();
    const jaDir = path.join(root, 'src/content/blog/ja');
    await chmod(jaDir, 0o555);
    try {
      expect(await run([POST, '--pick', '1', '--alt', '青い図形', '--force'])).toBe(EXIT.failed);
    } finally {
      await chmod(jaDir, 0o755);
    }
    expect(existsSync(heroPath())).toBe(false);
    expect(readRecord().picked).toBeNull();
    expect(readdirSync(path.join(root, 'public/images/blog')).filter((f) => f.includes('.tmp-'))).toEqual([]);
    expect(readFileSync(path.join(root, POST), 'utf8')).toBe(ARTICLE);
  });

  it('候補のファイルが記録の sha256 と違えば採用しない', async () => {
    await generateTwo();
    await writeFile(path.join(root, '.eyecatch/sample-post/candidate-1.png'), await pngOf(10, 10));
    expect(await run([POST, '--pick', '1', '--alt', '青い図形'])).toBe(EXIT.failed);
    expect(existsSync(heroPath())).toBe(false);
  });
});

describe('frontmatter の image の書き換え', () => {
  it('無ければ lang の前に足し、ほかの行は変えない', () => {
    const next = setFrontmatterImage(ARTICLE, { url: '/images/blog/a.avif', alt: '説明 "引用"' });
    expect(matter(next).data.image).toEqual({ url: '/images/blog/a.avif', alt: '説明 "引用"' });
    expect(next.replace(/image:\n {2}url: .*\n {2}alt: .*\n/, '')).toBe(ARTICLE);
  });

  it('閉じの行が「--- 」のように崩れていれば、本文に書き込まずに止める', () => {
    const broken = '---\ntitle: "t"\ncategory: "ai"\n--- \n\n本文\n\n---\n\n続き\n';
    expect(() => setFrontmatterImage(broken, { url: '/images/blog/a.avif', alt: 'A' })).toThrow();
  });

  it('あれば同じ場所で置き換える', () => {
    const first = setFrontmatterImage(ARTICLE, { url: '/images/blog/a.avif', alt: 'A' });
    const second = setFrontmatterImage(first, { url: '/images/blog/b.avif', alt: 'B' });
    expect(matter(second).data.image).toEqual({ url: '/images/blog/b.avif', alt: 'B' });
    expect(second.match(/^image:/gm)).toHaveLength(1);
  });
});
