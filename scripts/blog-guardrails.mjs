// ブログ記事（自動生成・手動とも）のガードレール検査。
// 正本ルール違反（旧事業名・未取得認証の「取得済み」主張・漏洩URL/メモ）を機械検出する。
// 認証の「いまの事実」（ISMS の状態・範囲・番号・日付・古い表現、記録に無い認証）は、ここに写しを持たず、
// cor_voice_lint.py の事実の照合（check --only-facts）をそのまま呼ぶ。lint は .claude/skills/cor-voice/references/facts.json を
// 読む（ADR-0029）。動詞の一覧・範囲・番号を JS 側に持たないので、lint と食い違わない。
// 使い方: import { scanForViolations } from './blog-guardrails.mjs'
//        const violations = scanForViolations(markdownText)  // [] なら合格

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const LINT_PATH = fileURLToPath(new URL('../.claude/skills/cor-voice-gate/scripts/cor_voice_lint.py', import.meta.url));
// lint が使えない・記録が壊れているときの、記録に無い認証の名前の控え（facts.json の unrecorded_certifications.names の部分集合。試験が結ぶ）
export const FALLBACK_UNRECORDED_CERTIFICATIONS = ['プライバシーマーク', 'Pマーク', 'SOC 2', 'SOC2', 'SCS'];
const FALLBACK_ACQUIRED = '(?:取得済み|取得しました|取得しています|認証済み|認証取得)';

const RULES = [
  {
    name: '旧事業名',
    re: /(TapForge|BoltSite|IoTRealm|IoT戦略|IT戦略コンサル)/g,
    reason: '公開禁止の旧事業名（正本ガードレール）',
  },
  {
    name: 'developプレビューURL漏洩',
    re: /[a-z0-9-]+\.web\.app|cor-jp-main--/gi,
    reason: 'プレビュー/一時ホスティングURLが本文に混入（本番ドメイン cor-jp.com を使う）',
  },
  {
    name: 'draftKey/下書きURL漏洩',
    re: /draftKey|\/draft\/[^\s)]*\bid=/gi,
    reason: '第三者媒体の下書きキー/非公開URLが混入',
  },
  {
    name: '内部編集メモ',
    re: /(編集・監修用|公開時に外部リンクを本文から外す)/g,
    reason: '読者向けでない内部メモが本文に残っている',
  },
];

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hit = (name, reason, line, match) => ({ name, reason, line, match: String(match).trim().slice(0, 120) });
// cert_unverified だけは、これまでの名前を保つ（content-advisory の表示と記事の既存の指摘に合わせる）
const ruleName = (id) => (id === 'cert_unverified' ? '未取得認証の取得済み主張' : `事実記録: ${id}`);

/** 記録に無い認証の控え。lint が使えないときだけ当てる。 */
function fallbackRules() {
  const alt = [...FALLBACK_UNRECORDED_CERTIFICATIONS].sort((x, y) => y.length - x.length).map(escape).join('|');
  const reason = '記録（facts.json）に事実が無い認証を「取得済み」と記載している疑い（lint が使えないため控えの一覧で検査）';
  return [
    { name: '未取得認証の取得済み主張', re: new RegExp(`(?:${alt})[^。\\n]{0,16}${FALLBACK_ACQUIRED}`, 'g'), reason },
    { name: '未取得認証の取得済み主張(語順違い)', re: new RegExp(`${FALLBACK_ACQUIRED}[^。\\n]{0,16}(?:${alt})`, 'g'), reason },
  ];
}

/**
 * 事実の照合を cor_voice_lint.py に任せる。
 * @returns {{violations: object[]} | {error: string}}
 */
export function factViolations(markdown, { run = spawnSync, lint = LINT_PATH } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'blog-guardrails-'));
  try {
    const file = join(dir, 'article.md');
    writeFileSync(file, markdown);
    const result = run('python3', ['-I', '-B', lint, 'check', '--only-facts', '--json', file], { encoding: 'utf8', timeout: 30_000, maxBuffer: 4 * 1024 * 1024 });
    if (result.error || ![0, 1].includes(result.status)) return { error: `cor_voice_lint.py が動かない（${result.error?.message ?? `終了コード ${result.status}`}）` };
    const hits = Object.values(JSON.parse(result.stdout))[0] ?? [];
    return { violations: hits.map((h) => hit(ruleName(h.rule_id), h.message, h.line, h.text)) };
  } catch (err) {
    return { error: `事実の照合の結果を読めない（${String(err.message ?? err)}）` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * @param {string} markdown 記事全文（frontmatter含めてOK）
 * @param {{run?: Function, lint?: string}} [options] 試験で lint の呼び出しを差し替える
 * @returns {{name:string, reason:string, line:number, match:string}[]}
 */
export function scanForViolations(markdown, options = {}) {
  const facts = factViolations(markdown, options);
  const broken = facts.error !== undefined || facts.violations.some((v) => v.name === ruleName('fact_record_invalid'));
  const violations = facts.error !== undefined
    ? [hit('事実記録が使えない', `${facts.error}。他の認証の禁止は控えの一覧で続ける`, 1, 'cor_voice_lint.py')]
    : facts.violations;
  const lines = markdown.split('\n');
  lines.forEach((line, i) => {
    for (const rule of broken ? [...RULES, ...fallbackRules()] : RULES) {
      rule.re.lastIndex = 0;
      for (const m of line.matchAll(rule.re)) {
        violations.push({ name: rule.name, reason: rule.reason, line: i + 1, match: m[0] });
      }
    }
  });
  return violations;
}

// 単体実行: node scripts/blog-guardrails.mjs <file.md> でチェック
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fs = await import('node:fs');
  const file = process.argv[2];
  if (!file) {
    console.error('使い方: node scripts/blog-guardrails.mjs <記事.md>');
    process.exit(2);
  }
  const md = fs.readFileSync(file, 'utf8');
  const v = scanForViolations(md);
  if (v.length === 0) {
    console.log(`✅ ガードレール合格: ${file}`);
    process.exit(0);
  }
  console.error(`❌ ガードレール違反 ${v.length}件: ${file}`);
  for (const x of v) console.error(`  L${x.line} [${x.name}] "${x.match}" — ${x.reason}`);
  process.exit(1);
}
