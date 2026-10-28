// @vitest-environment node
/**
 * リンクテスト: .cursor/rules/japanese-copy.mdc と、CLAUDE.md / AGENTS.md の
 * 「Japanese text and the CEO's voice」の段落が指すパスを揃える（#450、ADR-0026）。
 * SKILL.md とスキルのディレクトリは同じ値にし、検査スクリプトはパスそのもので比べる。
 * どれか 1 つだけ変えると、3 つの値を出して落ちる。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../..');
const read = (name) => readFileSync(path.join(root, name), 'utf8');

const VOICE_START = "- **Japanese text and the CEO's voice**";
const VOICE_END = '- **External expression guardrails**';
const RULE = '.cursor/rules/japanese-copy.mdc';
const CHECK_SCRIPT = '.claude/skills/yomiyasu/scripts/yomiyasu_check.py';
const SKILL_PATH = /\.claude\/skills\/[A-Za-z0-9_./-]+/g;

const CANONICAL = [
  '.claude/skills/cor-voice/',
  '.claude/skills/yomiyasu/',
  CHECK_SCRIPT,
];

/** `.claude/skills/<名前>/` で始まるパスを、ディレクトリか検査スクリプトに揃える。 */
function canonicalizeSkillPath(skillPath) {
  const skillMd = skillPath.match(/^\.claude\/skills\/([^/]+)\/SKILL\.md$/);
  if (skillMd) return `.claude/skills/${skillMd[1]}/`;
  const directory = skillPath.match(/^\.claude\/skills\/([^/]+)\/?$/);
  if (directory) return `.claude/skills/${directory[1]}/`;
  if (skillPath === CHECK_SCRIPT) return skillPath;
  return skillPath;
}

/** 文からスキルのパスを取り、揃えたあとの重複を除いて並べる。 */
function skillRefs(text) {
  const found = [...text.matchAll(SKILL_PATH)].map((match) => canonicalizeSkillPath(match[0]));
  return [...new Set(found)].sort();
}

function voiceParagraph(text, name) {
  const start = text.indexOf(VOICE_START);
  const end = text.indexOf(VOICE_END);
  if (start < 0 || end < start) {
    throw new Error(`${name}: 「${VOICE_START}」の段落が見つからない`);
  }
  return text.slice(start, end);
}

function formatRefs(label, refs) {
  const body = refs.length > 0 ? refs.map((ref) => `  ${ref}`).join('\n') : '  (なし)';
  return `${label}:\n${body}`;
}

function globsOf(text) {
  const frontmatter = text.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatter) throw new Error(`${RULE}: frontmatter が無い`);
  const globs = [];
  let inGlobs = false;
  for (const line of frontmatter[1].split('\n')) {
    if (line.startsWith('globs:')) {
      inGlobs = true;
      continue;
    }
    if (!inGlobs) continue;
    const item = line.match(/^\s+-\s+("?)(.+?)\1\s*$/);
    if (!item) break;
    globs.push(item[2]);
  }
  return globs;
}

describe('日本語の文章のパス', () => {
  it('mdc と CLAUDE.md と AGENTS.md の 3 つが同じパスを指す', () => {
    const observed = {
      mdc: skillRefs(read(RULE)),
      claude: skillRefs(voiceParagraph(read('CLAUDE.md'), 'CLAUDE.md')),
      agents: skillRefs(voiceParagraph(read('AGENTS.md'), 'AGENTS.md')),
    };
    const same =
      JSON.stringify(observed.mdc) === JSON.stringify(CANONICAL) &&
      JSON.stringify(observed.claude) === JSON.stringify(CANONICAL) &&
      JSON.stringify(observed.agents) === JSON.stringify(CANONICAL);
    if (!same) {
      throw new Error(
        [
          'スキルのパスがずれています。3 つの値:',
          formatRefs('mdc', observed.mdc),
          formatRefs('CLAUDE.md', observed.claude),
          formatRefs('AGENTS.md', observed.agents),
        ].join('\n'),
      );
    }
    expect(observed.mdc).toEqual(CANONICAL);
    expect(observed.claude).toEqual(CANONICAL);
    expect(observed.agents).toEqual(CANONICAL);
  });

  it('SKILL.md はディレクトリに揃え、1 文字違うパスは別の値として残す', () => {
    expect(canonicalizeSkillPath('.claude/skills/yomiyasu/SKILL.md')).toBe('.claude/skills/yomiyasu/');
    expect(canonicalizeSkillPath('.claude/skills/cor-voice/')).toBe('.claude/skills/cor-voice/');
    expect(canonicalizeSkillPath(CHECK_SCRIPT)).toBe(CHECK_SCRIPT);
    expect(canonicalizeSkillPath('.claude/skills/yomiyasu/SKIL.md')).toBe('.claude/skills/yomiyasu/SKIL.md');
    expect(canonicalizeSkillPath('.claude/skills/yomiyasu/scripts/yomiyasu_chek.py')).toBe(
      '.claude/skills/yomiyasu/scripts/yomiyasu_chek.py',
    );
  });
});

describe('japanese-copy.mdc の適用範囲', () => {
  it('ja の記事、画面文言、ページ、コンポーネント、設定に付き、常時適用にはしない', () => {
    const text = read(RULE);
    const frontmatter = text.match(/^---\n([\s\S]*?)\n---/);
    expect(frontmatter, `${RULE}: frontmatter が無い`).not.toBeNull();
    expect(globsOf(text)).toEqual([
      'src/content/**/ja/**',
      'src/i18n/locales/ja.json',
      'src/pages/**',
      'src/components/**',
      'src/config/**',
    ]);
    expect(frontmatter[1]).toMatch(/^description: ".+"$/m);
    expect(frontmatter[1]).toMatch(/^alwaysApply: false$/m);
  });
});
