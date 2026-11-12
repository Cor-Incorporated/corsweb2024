// ブログ記事（自動生成・手動とも）のガードレール検査。
// 正本ルール違反（旧事業名・未取得認証の「取得済み」主張・漏洩URL/メモ）を機械検出する。
// 認証の「いまの事実」（ISMS の状態、記録に無い認証の名前）は、固定の語ではなく
// .claude/skills/cor-voice/references/facts.json の記録を読んで判定する（ADR-0029）。
// 範囲・番号・日付の照合は cor_voice_lint.py が持つ（ここは状態と古い表現だけ。結線の試験: scripts/__tests__/blog-guardrails-facts.test.mjs）。
// 使い方: import { scanForViolations } from './blog-guardrails.mjs'
//        const violations = scanForViolations(markdownText)  // [] なら合格

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const FACTS_URL = new URL('../.claude/skills/cor-voice/references/facts.json', import.meta.url);
// 記録が読めないときの、記録に無い認証の名前（facts.json の unrecorded_certifications.names の部分集合。試験が結ぶ）
export const FALLBACK_UNRECORDED_CERTIFICATIONS = ['プライバシーマーク', 'Pマーク', 'SOC 2', 'SOC2', 'SCS'];
const ISMS_WORD = '(?:ISMS|27001|情報セキュリティマネジメントシステム)';
// 取得したという現在の表明（cor_voice_lint.py の ACQUIRED と同じ判断。試験が結ぶ）
export const ACQUIRED = '(?:取得済|認証取得|取得しました|取得しています|取得している|取得しており|取得し、|取得いたしました|取得した(?!い)|認証を受け|認証済|登録済|登録されました|認証されました)';
const ISMS_CLAIM = new RegExp(`${ISMS_WORD}[^。\\n]{0,40}${ACQUIRED}|${ACQUIRED}[^。\\n]{0,40}${ISMS_WORD}`);
const COMPLETED = /取得しま|取得して|取得し、|取得済|認証取得|登録されま|認証済/;

/** @returns {{isms: object, unrecorded: string[]} | {error: string}} */
export function loadFacts(url = FACTS_URL) {
  try {
    const raw = JSON.parse(readFileSync(url, 'utf8'));
    const isms = (raw.facts ?? []).filter((f) => f?.id === 'isms');
    const names = raw.unrecorded_certifications?.names;
    if (isms.length !== 1 || !Array.isArray(names) || names.length === 0) return { error: 'isms の記録が 1 件でない、または unrecorded_certifications.names が無い' };
    return { isms: isms[0], unrecorded: names };
  } catch (err) {
    return { error: String(err.message ?? err) };
  }
}

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

/** 記録に無い認証の「取得済み」主張。名前は記録（読めなければ控えの一覧）から作る。 */
export function certificationRules(names) {
  const alt = [...names].sort((x, y) => y.length - x.length).map(escape).join('|');
  const reason = '記録（facts.json）に事実が無い認証を「取得済み」と記載している疑い';
  return [
    { name: '未取得認証の取得済み主張', re: new RegExp(`(?:${alt})[^。\\n]{0,16}(?:取得済み|取得しました|取得しています|認証済み|認証取得)`, 'g'), reason },
    { name: '未取得認証の取得済み主張(語順違い)', re: new RegExp(`(?:取得済み|取得しました|認証取得しました)[^。\\n]{0,16}(?:${alt})`, 'g'), reason: `${reason}（語順違い）` },
  ];
}

const hit = (name, reason, line, match) => ({ name, reason, line, match: match.trim().slice(0, 120) });

/** ISMS の状態と古い表現。範囲・番号・日付の照合は cor_voice_lint.py。 */
export function ismsViolations(lines, rec) {
  const found = [];
  const context = new RegExp(`認証|${ISMS_WORD}`);
  lines.forEach((line, i) => {
    for (const sentence of line.split(/(?<=。)/)) {
      if (rec.status !== 'registered' && ISMS_CLAIM.test(sentence)) {
        found.push(hit('ISMS取得の主張が記録と違う', `記録の status は ${rec.status}（registered ではない）なのに、取得を現在の事実として書いている`, i + 1, sentence));
      }
      if (rec.status !== 'registered') continue;
      const strong = [...(context.test(sentence) ? rec.stale_state_phrases : []), ...rec.stale_state_phrases_any_context].filter((p) => sentence.includes(p));
      const weak = new RegExp(ISMS_WORD).test(sentence) && !COMPLETED.test(sentence) ? rec.stale_state_phrases_unless_completed.filter((p) => sentence.includes(p)) : [];
      if (strong.length + weak.length > 0) {
        found.push(hit('ISMSの古い状態の説明', `記録の status は registered（${rec.valid_from} 登録）なのに、古い状態（「${[...strong, ...weak][0]}」）を現在の説明として書いている`, i + 1, sentence));
      }
    }
  });
  return found;
}

/**
 * @param {string} markdown 記事全文（frontmatter含めてOK）
 * @param {{facts?: object}} [options] facts は loadFacts() の形（試験で差し替える）
 * @returns {{name:string, reason:string, line:number, match:string}[]}
 */
export function scanForViolations(markdown, options = {}) {
  const facts = options.facts ?? loadFacts();
  const lines = markdown.split('\n');
  const names = facts.error ? FALLBACK_UNRECORDED_CERTIFICATIONS : facts.unrecorded;
  const violations = facts.error
    ? [hit('事実記録が読めない', `facts.json を使えない（${facts.error}）。ISMS は cor_voice_lint.py が止める。他の認証の禁止は控えの一覧で続ける`, 1, 'facts.json')]
    : ismsViolations(lines, facts.isms);
  lines.forEach((line, i) => {
    for (const rule of [...RULES, ...certificationRules(names)]) {
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
