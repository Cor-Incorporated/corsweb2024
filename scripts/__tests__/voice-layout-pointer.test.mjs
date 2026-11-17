// @vitest-environment node
/**
 * リンクテスト: cor-voice の 5A 章は、画面での行の替え方と配置の決まり（docs/design/layout-rules.md）
 * への案内だけを持ち、決まりの中身は写さない。skill の案内か決まりの見出しのどちらか一方だけが
 * 動くと、探した物と実際に在った見出しの一覧を出して落ちる。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../..');
const read = (name) => readFileSync(path.join(root, name), 'utf8');

const SKILL = '.claude/skills/cor-voice/SKILL.md';
const LAYOUT = 'docs/design/layout-rules.md';
const POINTER = 'docs/design/layout-rules.md';
const RULES = ['R1', 'R2', 'R3', 'R4'];
const EXISTING_CHAPTERS = ['1', '2', '3', '4', '5', '6', '6A', '7', '8'];

/** `##` で始まる見出し行の一覧（落ちたときの表示に使う）。 */
const h2Headings = (text) => text.split('\n').filter((line) => line.startsWith('## '));

/** 見出し行の章の番号（「## 6A. …」なら「6A」）。 */
const chapterId = (line) => /^## (\S+)\./.exec(line)?.[1] ?? '';

/** headingPrefix の見出しから、次の `##` 見出しの直前までの行。 */
function section(text, headingPrefix) {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.startsWith(headingPrefix));
  const end = lines.findIndex((line, i) => i > start && line.startsWith('## '));
  return { start, lines: start === -1 ? [] : lines.slice(start, end === -1 ? lines.length : end) };
}

describe('cor-voice 5A の案内（画面での行の替え方と配置の決まり）', () => {
  it('skill に 5A の章が在り、その中に決まりの path が在る', () => {
    const skill = read(SKILL);
    const fiveA = section(skill, '## 5A.');
    expect(
      fiveA.start,
      `「## 5A.」の章が見つからない。探した物: ## 5A. の見出し、skill に実際に在った ## の見出し:\n${h2Headings(skill).join('\n')}`,
    ).toBeGreaterThan(-1);
    expect(
      fiveA.lines.join('\n'),
      `5A の章の中に「${POINTER}」が見つからない。探した物: ${POINTER}、5A の章:\n${fiveA.lines.join('\n')}`,
    ).toContain(POINTER);
    const ids = h2Headings(skill).map(chapterId);
    const i5 = ids.indexOf('5');
    const i5a = ids.indexOf('5A');
    const i6 = ids.indexOf('6');
    expect(
      i5a,
      `5A の章が 5 章の直後に無い。探した物: 5 → 5A → 6 の並び、実際に在った ## の見出し:\n${h2Headings(skill).join('\n')}`,
    ).toBe(i5 + 1);
    expect(
      i6,
      `5A の章の次に 6 章が無い。探した物: 5 → 5A → 6 の並び、実際に在った ## の見出し:\n${h2Headings(skill).join('\n')}`,
    ).toBe(i5a + 1);
  });

  it('5A が指す path の file が repo に在る', () => {
    const skill = read(SKILL);
    const fiveA = section(skill, '## 5A.');
    expect(
      fiveA.start,
      `「## 5A.」の章が見つからない。探した物: ## 5A. の見出し、skill に実際に在った ## の見出し:\n${h2Headings(skill).join('\n')}`,
    ).toBeGreaterThan(-1);
    const pointers = [...fiveA.lines.join('\n').matchAll(/`([A-Za-z0-9_./-]+\.md)`/g)].map((m) => m[1]);
    expect(
      pointers.length,
      `5A の章にバッククォートの .md path が無い。探した物: バッククォートで囲んだ .md path、5A の章:\n${fiveA.lines.join('\n')}`,
    ).toBeGreaterThan(0);
    for (const pointer of pointers) {
      expect(
        existsSync(path.join(root, pointer)),
        `探した物: ${pointer}（repo root から）、実際に docs/design/ に在った物: ${readdirSync(path.join(root, path.dirname(pointer))).join(', ')}`,
      ).toBe(true);
    }
  });

  it('決まりの file に R1〜R4 に当たる見出しが在る', () => {
    const layout = read(LAYOUT);
    const found = layout.split('\n').filter((line) => /^### R\d\./.test(line));
    for (const rule of RULES) {
      expect(
        found.some((line) => line.startsWith(`### ${rule}.`)),
        `探した物: 「### ${rule}.」で始まる見出し（${LAYOUT} の中）、実際に在った R の見出し:\n${found.join('\n') || '（無し）'}`,
      ).toBe(true);
    }
  });

  it('skill の既存の章の見出しが今の並びのまま在る（番号を動かしていない）', () => {
    const skill = read(SKILL);
    const ids = h2Headings(skill).map(chapterId).filter((id) => EXISTING_CHAPTERS.includes(id));
    expect(
      ids,
      `探した物: ${EXISTING_CHAPTERS.join(' → ')} の並び、skill に実際に在った ## の見出し:\n${h2Headings(skill).join('\n')}`,
    ).toEqual(EXISTING_CHAPTERS);
  });
});
