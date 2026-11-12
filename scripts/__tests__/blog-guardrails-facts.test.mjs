// @vitest-environment node
/**
 * リンクテスト: ISMS など「いまの事実」の判断は 2 か所にある。
 *   - .claude/skills/cor-voice-gate/scripts/cor_voice_lint.py（範囲・番号・日付・状態・古い表現。正）
 *   - scripts/blog-guardrails.mjs（状態と古い表現だけ。記事の手元検査）
 * どちらも .claude/skills/cor-voice/references/facts.json を読む。片方だけを変えると、両方の値を挙げて落ちる。
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACQUIRED, FALLBACK_UNRECORDED_CERTIFICATIONS, loadFacts, scanForViolations } from '../blog-guardrails.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const lint = path.join(root, '.claude/skills/cor-voice-gate/scripts/cor_voice_lint.py');
const ISMS_BLOCK = 'Cor.株式会社は ISO/IEC 27001:2022 の認証を取得しています。登録範囲は「ソフトウエアの受託開発および運用」です。';

function lintRules(text) {
  const dir = mkdtempSync(path.join(tmpdir(), 'guardrails-facts-'));
  const file = path.join(dir, 'draft.md');
  writeFileSync(file, text);
  const run = spawnSync('python3', ['-I', '-B', lint, 'check', '--scene', 'company', '--as-of', '2026-11-12', '--json', file], { cwd: root, encoding: 'utf8', timeout: 30_000 });
  const report = JSON.parse(run.stdout);
  return Object.values(report)[0].filter((h) => h.level === 'error').map((h) => h.rule_id);
}

// lint は Python の子プロセスなので、負荷のある環境でも落ちないよう上限を長めにとる
const TIMEOUT_MS = 30_000;
const names = (violations) => violations.map((v) => v.name);

describe('facts.json を読む blog-guardrails.mjs', () => {
  const facts = loadFacts();

  it('記録を読める', () => {
    expect(facts.error).toBeUndefined();
    expect(facts.isms.status).toBe('registered');
  });

  it('控えの認証名は、記録の unrecorded_certifications.names に全部ある', () => {
    const missing = FALLBACK_UNRECORDED_CERTIFICATIONS.filter((n) => !facts.unrecorded.includes(n));
    expect({ fallback: FALLBACK_UNRECORDED_CERTIFICATIONS, recorded: facts.unrecorded, missing }).toMatchObject({ missing: [] });
  });

  it('取得の表明を見る正規表現は cor_voice_lint.py の ACQUIRED と同じ', () => {
    const source = readFileSync(path.join(root, '.claude/skills/cor-voice-gate/scripts/cor_voice_lint.py'), 'utf8');
    const python = source.match(/^ACQUIRED = r"(.*)"$/m)?.[1];
    expect({ blogGuardrails: ACQUIRED, corVoiceLint: python }).toEqual({ blogGuardrails: python, corVoiceLint: python });
  });

  it('記録に無い認証の取得済みは止める（P マーク、SOC 2）', () => {
    expect(names(scanForViolations('プライバシーマークを取得しています'))).toContain('未取得認証の取得済み主張');
    expect(names(scanForViolations('SOC 2 認証済み'))).toContain('未取得認証の取得済み主張');
  });

  it('範囲つきの取得は止めない（同じ文を lint も止めない）', () => {
    expect(scanForViolations(ISMS_BLOCK)).toEqual([]);
    expect(lintRules(ISMS_BLOCK)).toEqual([]);
  }, TIMEOUT_MS);

  it('古い状態の説明は、guardrails と lint が同じ文を止める', () => {
    for (const text of ['ISMS の第2段階審査を終え、2026年12月ごろの認証登録を見込んでいます', 'ISMS は取得予定です。', '取得に向けて整備中です。']) {
      expect({ text, guardrails: names(scanForViolations(text)).includes('ISMSの古い状態の説明') }).toEqual({ text, guardrails: true });
      expect({ text, lint: lintRules(text).includes('isms_stale_state') }).toEqual({ text, lint: true });
    }
  }, TIMEOUT_MS);

  it('記録の status を変えると、取得の主張を止める（根拠あり → 通る / 根拠なし → 止まる）', () => {
    const mutated = { ...facts, isms: { ...facts.isms, status: 'registration_expected' } };
    expect(names(scanForViolations(ISMS_BLOCK, { facts: mutated }))).toContain('ISMS取得の主張が記録と違う');
    expect(names(scanForViolations(ISMS_BLOCK, { facts }))).not.toContain('ISMS取得の主張が記録と違う');
    // 予定の説明は、記録が registration_expected のときは古くない
    expect(names(scanForViolations('ISMS は取得予定です。', { facts: mutated }))).not.toContain('ISMSの古い状態の説明');
  });

  it('記録が読めないときは、ISMS を黙って旧規則へ戻さず、他の認証の禁止は続ける', () => {
    const broken = loadFacts(new URL('file:///nonexistent/facts.json'));
    expect(broken.error).toBeTruthy();
    const found = names(scanForViolations('プライバシーマークを取得しています', { facts: broken }));
    expect(found).toContain('事実記録が読めない');
    expect(found).toContain('未取得認証の取得済み主張');
  });
});
