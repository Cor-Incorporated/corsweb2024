// @vitest-environment node
/**
 * リンクテスト: ハーネスごとの入口（AGENTS.md、CLAUDE.md、.cursor/rules/cor-voice.mdc）は、
 * .claude/skills/cor-voice-gate/references/harness-entry.md から render_harness_entries.py が生成する。
 * 正本だけ、または入口だけを手で直すと、期待値と実物の差分を出して落ちる。
 * AGENTS.md が Codex の読む上限（32 KiB）を超えたときも落ちる（超えた分は Codex に読まれない）。
 * 同じフォルダの test_*.py には、voice_gate.py を PATH に Python だけを置いた環境で一周させるテストと、
 * voice 技能に特定のハーネスだけの呼び出しが残っていないことの検査（test_voice_gate.py）が入る。
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../..');
const scripts = path.join(root, '.claude/skills/cor-voice-gate/scripts');

// Python を起動するので、負荷のある環境でも落ちないように上限を長めにとる
const TIMEOUT_MS = 30_000;
// 単体テストは voice_gate.py の init と check を子プロセスで何度も動かす（手元の実測で 11〜29 秒）
const UNITTEST_TIMEOUT_MS = 120_000;

function python(args, timeout = TIMEOUT_MS) {
  return spawnSync('python3', ['-I', '-B', ...args], { cwd: root, encoding: 'utf8', timeout });
}

describe('cor-voice のハーネスの入口', () => {
  it('入口が正本から生成したものと一致する', () => {
    const run = python([path.join(scripts, 'render_harness_entries.py'), '--check']);
    expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0);
  }, TIMEOUT_MS);

  it('生成と検査のスクリプトの単体テストが通る', () => {
    const run = python(['-m', 'unittest', 'discover', '-s', scripts, '-p', 'test_*.py'], UNITTEST_TIMEOUT_MS);
    expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0);
  }, UNITTEST_TIMEOUT_MS);
});
