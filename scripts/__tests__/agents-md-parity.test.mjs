// @vitest-environment node
/**
 * リンクテスト: AGENTS.md（Codex など Claude Code 以外のエージェント向け）は CLAUDE.md の写し。
 * 違ってよいのは、題名・最初の説明の行・日本語の文章の段落（yomiyasu と cor-voice の使い方）の 3 か所だけ。
 * 2026-10-26 に #429・#431 が CLAUDE.md だけを直し、AGENTS.md が ADR-0023 の決まりやサービスのページを
 * 知らないままになっていた。片方だけを変えると、ずれた行を出して落ちる。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../..');
const read = (name) => readFileSync(path.join(root, name), 'utf8');

const VOICE_START = "- **Japanese text and the CEO's voice**";
const VOICE_END = '- **External expression guardrails**';

/** 違ってよい 3 か所を、同じ印に置き換えた行の配列。 */
function normalized(text, { title, intro }) {
  const start = text.indexOf(VOICE_START);
  const end = text.indexOf(VOICE_END);
  expect(start, `${title}: 「${VOICE_START}」の段落が無い`).toBeGreaterThan(-1);
  expect(end, `${title}: 「${VOICE_END}」の段落が無い`).toBeGreaterThan(start);
  return `${text.slice(0, start)}<voice>\n${text.slice(end)}`
    .replace(`# ${title}`, '# <title>')
    .replace(intro, '<intro>')
    .split('\n');
}

describe('AGENTS.md ↔ CLAUDE.md', () => {
  it('題名・最初の説明の行・日本語の文章の段落のほかは同じ', () => {
    const claude = normalized(read('CLAUDE.md'), {
      title: 'CLAUDE.md',
      intro: 'This file provides guidance to Claude Code (claude.ai/code) when working',
    });
    const agents = normalized(read('AGENTS.md'), {
      title: 'AGENTS.md',
      intro: 'This file provides guidance to Codex (Codex.ai/code) when working',
    });
    expect(agents).toEqual(claude);
  });
});
