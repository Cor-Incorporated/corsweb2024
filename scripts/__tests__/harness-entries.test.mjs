// @vitest-environment node
/**
 * リンクテスト: ハーネスごとの入口（AGENTS.md、CLAUDE.md、.cursor/rules/cor-voice.mdc）は、
 * .claude/skills/cor-voice-gate/references/harness-entry.md から render_harness_entries.py が生成する。
 * 正本だけ、または入口だけを手で直すと、期待値と実物の差分を出して落ちる。
 * AGENTS.md が Codex の読む上限（32 KiB）を超えたときも落ちる（超えた分は Codex に読まれない）。
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../..');
const scripts = path.join(root, '.claude/skills/cor-voice-gate/scripts');

function python(args) {
  return spawnSync('python3', ['-I', '-B', ...args], { cwd: root, encoding: 'utf8', timeout: TIMEOUT_MS });
}

// Python を起動するので、負荷のある環境でも落ちないように上限を長めにとる
const TIMEOUT_MS = 30_000;

describe('cor-voice のハーネスの入口', () => {
  it('入口が正本から生成したものと一致する', () => {
    const run = python([path.join(scripts, 'render_harness_entries.py'), '--check']);
    expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0);
  }, TIMEOUT_MS);

  it('生成と検査のスクリプトの単体テストが通る', () => {
    const run = python(['-m', 'unittest', 'discover', '-s', scripts, '-p', 'test_*.py']);
    expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0);
  }, TIMEOUT_MS);
});
