#!/usr/bin/env node
// docs/billing/contract/verify-sample.mjs — Clerk のセッショントークンの検証の見本（ADR-0028 の R1・R2、道 A）。
//
// 何をするか:
//   1. 試験用の RSA の鍵をその場で作り（ファイルに残さない）、RS256 のトークンを 1 本作る
//   2. R1 を確かめる: 署名、iss、exp、nbf、azp（許可リスト）、v = 2、sts ≠ pending
//   3. R2 を確かめる: o.id が設定の組織と同じ。o が無ければ拒否
//   4. 通ったら cor_svc（= 組織の public_metadata.services）を、T1 の判定の見本 judge.sh に渡し、
//      サービスごとの結果（open / view_only / read_export_only / closed）を 1 行ずつ出す
//
// 依存を足さない（Node の組み込みの crypto と child_process だけ）。鍵は標準出力にも出さない。
//
// 使い方:
//   node docs/billing/contract/verify-sample.mjs --case positive --date 2027-01-30
//   node docs/billing/contract/verify-sample.mjs --case bad-signature
//
//   --case <名前>      陽性: positive / 陰性: bad-signature expired not-yet wrong-iss wrong-azp
//                      no-org wrong-org sts-pending bad-version
//   --issuer <url>     設定に置く iss（既定: https://clerk.example.test）
//   --azp <url,url>    azp の許可リスト（カンマ区切り。既定: https://bd.example.test）
//   --org-id <id>      そのサービスのテナントに結んだ Clerk の組織の id（既定: org_test_configured）
//   --date YYYY-MM-DD  judge.sh に渡す日本時間の日付（既定: 日本時間の今日）
//   --judge <path>     判定の見本（既定: このファイルと同じディレクトリの judge.sh）
//
// 出力（標準出力）:
//   TOKEN accepted iss=… azp=… sub=… org_id=… services=<サービス名を , で>
//   JUDGE <サービス> <結果>      … cor_svc のサービスごとに 1 行
//   拒否したときは REJECT <理由の符号> を 1 行（理由は標準エラーにも出す）
//
// 終了コード: 0 = 受け入れた / 3 = 拒否した（R1・R2 のどれかが成り立たない）/ 64 = 使い方の誤り

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CASES = new Map([
  ['positive', '陽性（署名も claim も正しい）'],
  ['bad-signature', '署名が違う（別の鍵で署名した）'],
  ['expired', '期限切れ（exp が過去）'],
  ['not-yet', 'まだ有効でない（nbf が未来）'],
  ['wrong-iss', '違う iss'],
  ['wrong-azp', '違う azp（許可リストに無い）'],
  ['no-org', 'o が無い（組織を選んでいない）'],
  ['wrong-org', 'o.id が設定の組織と違う'],
  ['sts-pending', 'sts が pending'],
  ['bad-version', 'v が 2 でない'],
]);

const USAGE = `使い方: node verify-sample.mjs --case <名前> [--date YYYY-MM-DD] [--issuer <url>] [--azp <url,url>] [--org-id <id>] [--judge <path>]
--case は ${[...CASES.keys()].join(' / ')} のどれか。`;

function die(message) {
  process.stderr.write(`STOP: ${message}\n`);
  process.exit(64);
}

function usageDie(message) {
  process.stderr.write(`${USAGE}\n`);
  die(message);
}

function parseArgs(argv) {
  const opts = {
    caseName: '',
    issuer: 'https://clerk.example.test',
    azp: 'https://bd.example.test',
    orgId: 'org_test_configured',
    date: '',
    judge: path.join(HERE, 'judge.sh'),
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const needValue = () => {
      if (i + 1 >= argv.length) usageDie(`${arg} に値が無い`);
      i += 1;
      return argv[i];
    };
    switch (arg) {
      case '--case': opts.caseName = needValue(); break;
      case '--issuer': opts.issuer = needValue(); break;
      case '--azp': opts.azp = needValue(); break;
      case '--org-id': opts.orgId = needValue(); break;
      case '--date': opts.date = needValue(); break;
      case '--judge': opts.judge = needValue(); break;
      case '-h':
      case '--help':
        process.stdout.write(`${USAGE}\n`);
        process.exit(0);
        break;
      default:
        usageDie(`知らない引数: ${arg}`);
    }
  }
  if (!opts.caseName) usageDie('--case が要る');
  if (!CASES.has(opts.caseName)) usageDie(`知らない --case: ${opts.caseName}`);
  if (opts.date && !/^\d{4}-\d{2}-\d{2}$/.test(opts.date)) usageDie(`--date は YYYY-MM-DD（観測: ${opts.date}）`);
  return opts;
}

function todayJst() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

function b64u(value) {
  return Buffer.from(value, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64u(value) {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

// 試験用のトークン。署名の鍵は外部から渡される（この関数は鍵を作らない）。
function makeToken(claims, privateKey) {
  const header = { alg: 'RS256', typ: 'JWT', kid: 'cor-test-key-1' };
  const head = b64u(JSON.stringify(header));
  const body = b64u(JSON.stringify(claims));
  const data = `${head}.${body}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(data, 'utf8'), privateKey).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${data}.${signature}`;
}

// R1・R2 の検証。設定（issuer・azp の許可リスト・組織の id）と、JWKS の公開鍵だけを使う。通信しない。
function verifyToken(token, publicKey, config) {
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, code: 'format', message: 'トークンが 3 つの部分に分かれない' };
  let header;
  let claims;
  try {
    header = JSON.parse(fromB64u(parts[0]));
    claims = JSON.parse(fromB64u(parts[1]));
  } catch {
    return { ok: false, code: 'format', message: 'ヘッダか claim を JSON として読めない' };
  }
  if (header.alg !== 'RS256') return { ok: false, code: 'alg', message: `署名的に RS256 でない（観測: ${header.alg}）` };
  const signatureOk = crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`, 'utf8'), publicKey, Buffer.from(parts[2].replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
  if (!signatureOk) return { ok: false, code: 'signature', message: '署名が合わない（JWKS の公開鍵で確かめた）' };
  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== 'number') return { ok: false, code: 'exp', message: 'exp が無い' };
  if (now >= claims.exp) return { ok: false, code: 'exp', message: `期限切れ（exp=${claims.exp} now=${now}）` };
  if (typeof claims.nbf !== 'number') return { ok: false, code: 'nbf', message: 'nbf が無い' };
  if (now < claims.nbf) return { ok: false, code: 'nbf', message: `まだ有効でない（nbf=${claims.nbf} now=${now}）` };
  if (claims.iss !== config.issuer) return { ok: false, code: 'iss', message: `iss が設定と違う（期待 ${config.issuer} 観測 ${claims.iss}）` };
  if (claims.v !== 2) return { ok: false, code: 'v', message: `v が 2 でない（観測 ${claims.v}）` };
  if (claims.sts === 'pending') return { ok: false, code: 'sts', message: 'sts が pending（保留中のセッション）' };
  if (!config.azpAllow.includes(claims.azp)) return { ok: false, code: 'azp', message: `azp が許可リストに無い（観測 ${claims.azp}）` };
  if (!claims.o || typeof claims.o !== 'object' || typeof claims.o.id !== 'string' || claims.o.id === '') {
    return { ok: false, code: 'org-missing', message: 'o が無い（組織を選んでいないトークン）' };
  }
  if (claims.o.id !== config.orgId) return { ok: false, code: 'org-mismatch', message: `o.id が設定の組織と違う（期待 ${config.orgId} 観測 ${claims.o.id}）` };
  return { ok: true, claims };
}

function buildClaims(opts) {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: opts.issuer,
    sub: 'user_test_1',
    sid: 'sess_test_1',
    exp: now + 300,
    nbf: now - 10,
    iat: now - 10,
    azp: 'https://bd.example.test',
    v: 2,
    sts: 'active',
    o: { id: opts.orgId, rol: 'org:admin', sls: [] },
    // 組織の public_metadata.services の写し（値は架空）
    cor_svc: {
      'business-dossier': { from: '2026-12-01', until: '2026-12-31', hold: false },
      xesm: { from: '2026-12-01', until: null, hold: false },
    },
  };
  switch (opts.caseName) {
    case 'expired': claims.exp = now - 60; break;
    case 'not-yet': claims.nbf = now + 300; claims.exp = now + 600; break;
    case 'wrong-iss': claims.iss = 'https://clerk.example.invalid'; break;
    case 'wrong-azp': claims.azp = 'https://evil.example.test'; break;
    case 'no-org': delete claims.o; break;
    case 'wrong-org': claims.o = { ...claims.o, id: 'org_other' }; break;
    case 'sts-pending': claims.sts = 'pending'; break;
    case 'bad-version': claims.v = 1; break;
    default: break; // positive と bad-signature は claim を変えない（bad-signature は鍵だけ変える）
  }
  return claims;
}

function runJudge(judgePath, services, service, date) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cor-verify-sample-'));
  const file = path.join(dir, 'services.json');
  try {
    fs.writeFileSync(file, `${JSON.stringify(services)}\n`, 'utf8');
    const result = spawnSync('bash', [judgePath, '--services-json', file, '--service', service, '--date', date], { encoding: 'utf8' });
    if (result.error) return { ok: false, message: `judge.sh を実行できない（${result.error.message}）` };
    if (result.status !== 0) {
      const text = `${result.stdout}${result.stderr}`.trim().split('\n').filter(Boolean).pop() || `exit ${result.status}`;
      return { ok: false, message: `judge.sh が止まった: ${text}` };
    }
    return { ok: true, value: result.stdout.trim() };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const date = opts.date || todayJst();
  if (!fs.existsSync(opts.judge)) usageDie(`判定の見本が無い（観測: ${opts.judge}）`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) usageDie(`日付が YYYY-MM-DD でない（観測: ${date}）`);

  // 鍵はその場で作る。ファイルにも標準出力にも出さない（この関数の中でだけ使う）。
  const keyPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const claims = buildClaims(opts);
  let signingKey = keyPair.privateKey;
  if (opts.caseName === 'bad-signature') {
    // 検証に使う鍵とは別の鍵で署名する（JWKS に無い鍵で署名されたトークンと同じ形）
    const attacker = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    signingKey = attacker.privateKey;
  }
  const token = makeToken(claims, signingKey);
  const result = verifyToken(token, keyPair.publicKey, {
    issuer: opts.issuer,
    azpAllow: opts.azp.split(',').map((s) => s.trim()).filter(Boolean),
    orgId: opts.orgId,
  });

  if (!result.ok) {
    process.stdout.write(`REJECT ${result.code}\n`);
    process.stderr.write(`STOP: ${result.message}（R1・R2 のどれかが成り立たない。トークンは受け入れない）\n`);
    process.exit(3);
  }

  const services = result.claims.cor_svc && typeof result.claims.cor_svc === 'object' ? result.claims.cor_svc : {};
  const names = Object.keys(services).sort();
  if (names.length === 0) process.stdout.write('NOTE cor_svc が無い（services の行が 1 つも無い。判定は全部 closed になる）\n');
  process.stdout.write(`TOKEN accepted iss=${result.claims.iss} azp=${result.claims.azp} sub=${result.claims.sub} org_id=${result.claims.o.id} services=${names.length ? names.join(',') : '（なし）'}\n`);

  for (const name of names) {
    const judged = runJudge(opts.judge, services, name, date);
    if (!judged.ok) die(`${name} の判定で止まった: ${judged.message}`);
    if (!['open', 'view_only', 'read_export_only', 'closed'].includes(judged.value)) {
      die(`判定の値が 4 つのどれでもない（観測: ${judged.value}）`);
    }
    process.stdout.write(`JUDGE ${name} ${judged.value}\n`);
  }
}

main();
