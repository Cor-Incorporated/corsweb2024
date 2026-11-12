// @vitest-environment node
/**
 * リンクテスト: ISMS など「いまの事実」の判断は cor_voice_lint.py（check --only-facts）が持ち、
 * scripts/blog-guardrails.mjs はそれをそのまま呼ぶ（動詞・範囲・番号の写しを JS 側に持たない）。
 * 呼び出しを外す・結果を落とす・lint とずれた判断を足すと、両方の結果を挙げて落ちる。
 * 反例の番号（F-3 など）は PR #532 の独立査読（review-s1）のもの。
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FALLBACK_UNRECORDED_CERTIFICATIONS, factViolations, scanForViolations } from '../blog-guardrails.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const lint = path.join(root, '.claude/skills/cor-voice-gate/scripts/cor_voice_lint.py');
const facts = JSON.parse(readFileSync(path.join(root, '.claude/skills/cor-voice/references/facts.json'), 'utf8'));
// lint は Python の子プロセスなので、負荷のある環境でも落ちないよう上限を長めにとる
const TIMEOUT_MS = 30_000;
const SCOPE = '登録範囲は「ソフトウエアの受託開発および運用」です。';

function lintRuleIds(text) {
  const dir = mkdtempSync(path.join(tmpdir(), 'guardrails-facts-'));
  const file = path.join(dir, 'draft.md');
  writeFileSync(file, text);
  const run = spawnSync('python3', ['-I', '-B', lint, 'check', '--only-facts', '--as-of', '2026-11-12', '--json', file], { cwd: root, encoding: 'utf8', timeout: TIMEOUT_MS });
  return Object.values(JSON.parse(run.stdout))[0].map((h) => h.rule_id).sort();
}
const guardrailIds = (text) => scanForViolations(text).map((v) => v.name).sort();
const ruleName = (id) => (id === 'cert_unverified' ? '未取得認証の取得済み主張' : `事実記録: ${id}`);

describe('blog-guardrails.mjs は事実の照合を lint に任せる', () => {
  // F-3: base（#527 の head 9ff03ff）の guardrails が止めていた 3 件。この head でも止まる
  const base = [
    ['F-3a 範囲なしの取得', 'ISMS 認証を取得しました。', 'isms_scope_missing'],
    ['F-3b R02 の範囲の拡大', 'ISMS認証済みなので、AIが誤回答することはありません', 'isms_scope_overreach'],
    ['F-3c 番号違い', '登録番号：JP26/00000365 の ISMS 認証を取得しています。', 'isms_number_mismatch'],
  ];
  for (const [id, text, rule] of base) {
    it(`${id}: base で止まっていた入力は、今も止まる`, () => {
      expect({ text, names: guardrailIds(text).includes(ruleName(rule)) }).toEqual({ text, names: true });
    }, TIMEOUT_MS);
  }

  it('F-9 取得の動詞は lint と同じ記録から読む（Pマークの「取得しており」、ISO 27017 の表記ゆれも止まる）', () => {
    for (const text of ['Pマークを取得しており、安心です。', 'ISO 27017 の認証を取得しました。', 'ISO27701 認証を取得しました。']) {
      expect({ text, names: guardrailIds(text) }).toEqual({ text, names: ['未取得認証の取得済み主張'] });
    }
  }, TIMEOUT_MS);

  it('範囲つきの正しい取得は止めない（lint も止めない）', () => {
    const text = `Cor.株式会社は ISO/IEC 27001:2022 の認証を取得しています。${SCOPE}\n\n初回登録日：2026年11月7日。登録番号：JP26/00000364。\n`;
    expect({ guardrails: guardrailIds(text), lint: lintRuleIds(text) }).toEqual({ guardrails: [], lint: [] });
  }, TIMEOUT_MS);

  it('guardrails の判断は lint --only-facts と同じ（片方だけを変えると、両方の結果を挙げて落ちる）', () => {
    const samples = [
      'ISMS 認証を取得しました。',
      'ISMS認証済みなので、AIが誤回答することはありません',
      '登録番号：JP26/00000365 の ISMS 認証を取得しています。',
      `2026年11月11日に ISMS 認証を取得しました。${SCOPE}`,
      'ISMS の第2段階審査を終え、2026年12月ごろの認証登録を見込んでいます',
      'ISMS は取得予定です。',
      'ＩＳＭＳ認証取得済みです。',
      'ISMS 認証を取得しました。\n\n' + SCOPE,
      `ISMS 認証を取得しました。${SCOPE}`,
      'プライバシーマークを取得しています',
      '「ISMS 認証取得済み」と書く会社が増えています。',
      `**ISMS認証取得済み**\n\n${SCOPE}\n`,
      `## ISMS認証取得済み\n\n別の話です。\n\n${SCOPE}\n`,
      `**ISMS認証取得済み**\n\n## 次の見出し\n\n${SCOPE}\n`,
    ];
    for (const text of samples) {
      const mapped = lintRuleIds(text).map(ruleName).sort();
      expect({ text, guardrails: guardrailIds(text) }).toEqual({ text, guardrails: mapped });
    }
  }, TIMEOUT_MS);

  it('古い状態の説明は止める（文脈なしの「取得に向けて整備中」も）', () => {
    for (const text of ['ISMS の第2段階審査を終え、2026年12月ごろの認証登録を見込んでいます', 'ISMS は取得予定です。', '取得に向けて整備中です。']) {
      expect({ text, names: guardrailIds(text).includes('事実記録: isms_stale_state') }).toEqual({ text, names: true });
    }
  }, TIMEOUT_MS);

  it('lint の結果を落とすと、F-3 の入力が通ってしまう（委譲していることの確認。試験の変異 M9d の代わり）', () => {
    const empty = () => ({ status: 0, stdout: '{"x": []}' });
    expect(scanForViolations('ISMS 認証を取得しました。', { run: empty })).toEqual([]);
    expect(guardrailIds('ISMS 認証を取得しました。')).toContain('事実記録: isms_scope_missing');
  }, TIMEOUT_MS);

  it('lint が動かないときは違反として出し、他の認証の禁止は控えの一覧で続ける', () => {
    const broken = () => ({ error: new Error('python3 が無い'), status: null, stdout: '' });
    const names = scanForViolations('プライバシーマークを取得しています', { run: broken }).map((v) => v.name);
    expect(names).toContain('事実記録が使えない');
    expect(names).toContain('未取得認証の取得済み主張');
    expect(factViolations('x', { run: broken }).error).toContain('python3 が無い');
  });

  it('記録が壊れている（fact_record_invalid）ときも、控えの一覧で P マークを止める', () => {
    const invalid = () => ({ status: 1, stdout: JSON.stringify({ f: [{ rule_id: 'fact_record_invalid', level: 'error', line: 1, text: 'x', message: 'm' }] }) });
    const names = scanForViolations('SOC 2 認証済み', { run: invalid }).map((v) => v.name);
    expect(names).toContain('事実記録: fact_record_invalid');
    expect(names).toContain('未取得認証の取得済み主張');
  });

  it('控えの認証名は、記録の unrecorded_certifications.names に全部ある', () => {
    const recorded = facts.unrecorded_certifications.names;
    const missing = FALLBACK_UNRECORDED_CERTIFICATIONS.filter((n) => !recorded.includes(n));
    expect({ fallback: FALLBACK_UNRECORDED_CERTIFICATIONS, recorded, missing }).toMatchObject({ missing: [] });
  });
});
