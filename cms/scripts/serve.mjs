#!/usr/bin/env node
// cms/dist を、cms/firebase.json の hosting.headers を実際に付けて配信するローカルサーバー（e2e 用）。
// 宣言（firebase.json）とブラウザが受け取るヘッダーを同じファイルから作るので、e2e が本番と同じ CSP で検査できる。
//   npm run build:cms && node cms/scripts/serve.mjs   # http://127.0.0.1:4323/
// Firebase Hosting の挙動のうち、ここで再現するのは「source glob に一致したヘッダーを付ける」ことと
// 「/ で index.html を返す」ことだけ。同じヘッダーを複数の規則が付ける構成は、どちらが勝つかが曖昧なので拒否する。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CMS_DIR = fileURLToPath(new URL('..', import.meta.url));
const hosting = JSON.parse(readFileSync(path.join(CMS_DIR, 'firebase.json'), 'utf8')).hosting;
const PUBLIC_DIR = path.resolve(CMS_DIR, hosting.public);
const HOST = process.env.HOST ?? '127.0.0.1';
const PORT = Number(process.env.PORT ?? 4323);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.yml': 'text/yaml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
};

// source glob を正規表現にする。使ってよいのは **、*、@(a|b) だけ（それ以外の記号は例外にして気づけるようにする）。
const escape = (text) => text.replace(/[.+^${}()|[\]\\]/g, '\\$&');
const globToRegExp = (glob) => {
  if (/[?![\]{}]|[+*!]\(/.test(glob.replace(/@\([^)]*\)/g, ''))) {
    throw new Error(`cms/firebase.json: unsupported glob in source "${glob}"`);
  }
  const source = glob
    .split(/(@\([^)]*\)|\*\*|\*)/)
    .map((part) => {
      if (part === '**') return '.*';
      if (part === '*') return '[^/]*';
      if (part.startsWith('@(')) return `(?:${part.slice(2, -1).split('|').map(escape).join('|')})`;
      return escape(part);
    })
    .join('');
  return new RegExp(`^${source}$`);
};

const RULES = (hosting.headers ?? []).map((rule) => ({
  ...rule,
  pattern: globToRegExp(rule.source),
}));

const headersFor = (requestPath) => {
  const headers = new Map();
  for (const rule of RULES.filter(({ pattern }) => pattern.test(requestPath))) {
    for (const { key, value } of rule.headers) {
      const name = key.toLowerCase();
      if (headers.has(name))
        throw new Error(
          `cms/firebase.json: ${key} for ${requestPath} is set by more than one rule`
        );
      headers.set(name, value);
    }
  }
  return headers;
};

const fileFor = (requestPath) => {
  const relative = requestPath.endsWith('/') ? `${requestPath}index.html` : requestPath;
  const file = path.resolve(PUBLIC_DIR, `.${relative}`);
  const hidden = relative.split('/').some((segment) => segment.startsWith('.'));
  return file.startsWith(`${PUBLIC_DIR}${path.sep}`) && !hidden ? file : null;
};

const readTarget = async (requestPath) => {
  const file = fileFor(requestPath);
  try {
    if (!file) return { status: 404 };
    return { status: 200, body: await readFile(file), type: TYPES[path.extname(file)] };
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EISDIR') return { status: 404 };
    throw error;
  }
};

const server = createServer(async (req, res) => {
  try {
    const requestPath = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    const {
      status,
      body = 'Not Found',
      type = 'text/plain; charset=utf-8',
    } = await readTarget(requestPath);
    const headers = { 'Content-Type': type, ...Object.fromEntries(headersFor(requestPath)) };
    res.writeHead(status, headers);
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (error) {
    // 規則の重複など、宣言の誤りはサーバーエラーにして e2e を落とす。
    console.error(error);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(String(error.message));
  }
});

if (!existsSync(path.join(PUBLIC_DIR, 'index.html'))) {
  console.error(
    `${path.relative(
      process.cwd(),
      PUBLIC_DIR
    )}/index.html がありません。先に npm run build:cms を実行してください。`
  );
  process.exit(1);
}
server.listen(PORT, HOST, () => {
  console.log(`CMS preview with cms/firebase.json headers: http://${HOST}:${PORT}/`);
});
