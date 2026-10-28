// @vitest-environment node
/**
 * 推敲ゲートの真理値表。
 * 場面はカテゴリの既定か、人間の指示の明示の印だけから決まる。
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { parseDocument } from '../../i18n/frontmatter.mjs';
import { check, instruction, learn, main, prepare } from '../cli.mjs';
import { PolishError, resolveVoice, scenesInInstruction } from '../voice.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const CLI = path.join(ROOT, 'scripts/polish/cli.mjs');
const dir = mkdtempSync(path.join(tmpdir(), 'polish-gate-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

let caseId = 0;

function sandbox() {
  const root = path.join(dir, `c${caseId}`);
  caseId += 1;
  mkdirSync(root, { recursive: true });
  function write(rel, { category = 'ai', date = '2026-01-01', draft = false, collection = 'blog' } = {}, body = '本文です。') {
    const dateKey = collection === 'news' ? 'publishedAt' : 'pubDate';
    const categoryLine = collection === 'news' ? 'category: "info"\n' : `category: "${category}"\n`;
    const text = `---
title: "題"
description: "説明です"
${categoryLine}${dateKey}: ${date}
isDraft: ${draft}
lang: "ja"
---

${body}
`;
    const abs = path.join(root, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, text);
    return rel;
  }
  function call(extra) {
    return { repo: root, file: null, json: true, approved: false, noYomiyasu: true, ...extra };
  }
  return { root, write, call };
}

describe('場面の決定', () => {
  it('カテゴリとコレクションから既定の場面が決まる', () => {
    expect(resolveVoice({ collection: 'blog', category: 'ai' }).scene).toBe('company');
    expect(resolveVoice({ collection: 'blog', category: 'engineering' }).scene).toBe('company');
    expect(resolveVoice({ collection: 'blog', category: 'lab' }).scene).toBe('technical');
    expect(resolveVoice({ collection: 'blog', category: 'founder' }).scene).toBe('founder');
    expect(resolveVoice({ collection: 'news', category: 'info' }).scene).toBe('company');
  });

  it('言い回しだけの指示では場面を変えない', () => {
    const voice = resolveVoice({
      collection: 'blog',
      category: 'ai',
      instructionText: '結びを短くしてほしい',
    });
    expect(voice.scene).toBe('company');
    expect(voice.voiceSwitched).toBe(false);
    expect(voice.instructionEffect).toBe('wording');
  });

  it('明示の印があるときだけ場面を変える', () => {
    expect(scenesInInstruction('scene: founder')).toEqual(['founder']);
    expect(scenesInInstruction('代表の名前で書く')).toEqual(['founder']);
    expect(scenesInInstruction('技術の記事として書く')).toEqual(['technical']);
    expect(scenesInInstruction('ストーリーとして書く')).toEqual(['story']);
    const voice = resolveVoice({
      collection: 'blog',
      category: 'ai',
      instructionText: 'scene: technical',
    });
    expect(voice.scene).toBe('technical');
    expect(voice.voiceSwitched).toBe(true);
    expect(voice.sceneSource).toBe('explicit');
  });

  it('既定と同じ場面を名指ししても、切り替えとは扱わない', () => {
    const voice = resolveVoice({
      collection: 'blog',
      category: 'ai',
      instructionText: '今回は会社として書く',
    });
    expect(voice.scene).toBe('company');
    expect(voice.voiceSwitched).toBe(false);
    expect(voice.sceneSource).toBe('explicit-same');
  });

  it('複数の場面を名指しすると止まる', () => {
    expect(() =>
      resolveVoice({
        collection: 'blog',
        category: 'ai',
        instructionText: 'scene: founder\n会社として書く',
      }),
    ).toThrow(/複数の場面/);
  });

  it('未知のカテゴリと翻訳ファイルと cases は受け付けない', () => {
    expect(() => resolveVoice({ collection: 'blog', category: 'diary' })).toThrow(PolishError);
    const box = sandbox();
    box.write('src/content/blog/en/x.md', { category: 'ai' });
    expect(() => prepare(box.call({ file: 'src/content/blog/en/x.md' }))).toThrow(/翻訳/);
    box.write('src/content/cases/ja/x.md', { category: 'grift' });
    expect(() => prepare(box.call({ file: 'src/content/cases/ja/x.md' }))).toThrow(/cases/);
  });
});

describe('検査', () => {
  it('会社の文章の僕は不合格、代表の文章の僕は合格', () => {
    const box = sandbox();
    const company = box.write('src/content/blog/ja/co.md', { category: 'ai' }, '僕は試しに書きました。');
    expect(() => check(box.call({ file: company }))).toThrow(/first-person/);
    const founder = box.write('src/content/blog/ja/me.md', { category: 'founder' }, '僕は試しに書きました。');
    const ok = check(box.call({ file: founder }));
    expect(ok.scene).toBe('founder');
    expect(ok.complete).toBe(false);
    expect(ok.findings.filter((item) => item.severity === 'fail')).toEqual([]);
  });

  it('コードの中の一人称と、試行錯誤は不合格にしない', () => {
    const box = sandbox();
    const rel = box.write(
      'src/content/blog/ja/code.md',
      { category: 'engineering' },
      '手順は次です。\n\n```js\nconst label = "僕は"\n```\n\n試行錯誤の記録です。',
    );
    const result = check(box.call({ file: rel }));
    expect(result.findings.map((item) => item.rule)).not.toContain('first-person');
    expect(result.findings.map((item) => item.rule)).not.toContain('trial-word');
  });

  it('試行と、原文に無かった必ずは不合格になる', () => {
    const box = sandbox();
    const source = box.write('src/content/blog/ja/trial.md', { category: 'ai' }, 'テスト導入の話です。');
    const finalPath = path.join(box.root, 'final-trial.md');
    writeFileSync(
      finalPath,
      readFileSync(path.join(box.root, source), 'utf8').replace('テスト導入の話です。', '試行で必ず進みます。'),
    );
    expect(() => check(box.call({ file: source, final: finalPath }))).toThrow(/trial-word|guarantee/);
  });

  it('原文にある必ずは、最終稿でも同じ数なら不合格にしない', () => {
    const box = sandbox();
    const source = box.write('src/content/news/ja/note.md', { collection: 'news' }, '数値には必ず分子を付けます。');
    const result = check(box.call({ file: source, final: path.join(box.root, source) }));
    expect(result.findings.filter((item) => item.rule === 'guarantee' && item.severity === 'fail')).toEqual([]);
    expect(result.scene).toBe('company');
  });

  it('感嘆符は story 以外で不合格', () => {
    const box = sandbox();
    const rel = box.write('src/content/blog/ja/bang.md', { category: 'lab' }, '動きました。');
    const finalPath = path.join(box.root, 'bang-final.md');
    writeFileSync(finalPath, readFileSync(path.join(box.root, rel), 'utf8').replace('動きました。', '動きました！'));
    expect(() => check(box.call({ file: rel, final: finalPath }))).toThrow(/exclamation/);
  });

  it('社名の崩れた表記は不合格、GitHub の組織名は残す', () => {
    const box = sandbox();
    const bad = box.write('src/content/blog/ja/name.md', { category: 'ai' }, 'Cor株式会社の話です。');
    expect(() => check(box.call({ file: bad }))).toThrow(/company-name/);
    const org = box.write('src/content/blog/ja/org.md', { category: 'ai' }, 'Cor.Incorporated のリポジトリです。');
    const result = check(box.call({ file: org }));
    expect(result.findings.map((item) => item.rule)).not.toContain('company-name');
  });

  it('私たちと僕を混ぜた代表の文章は不合格', () => {
    const box = sandbox();
    const rel = box.write(
      'src/content/blog/ja/mix.md',
      { category: 'founder' },
      '僕は書きました。私は残しました。私たちは進みました。',
    );
    expect(() => check(box.call({ file: rel }))).toThrow(/mixed-person/);
  });
});

describe('指示と学習', () => {
  it('指示ファイルが無い限り、エージェントは場面を渡せない', () => {
    expect(main(['--scene', 'founder'])).toBe(2);
    expect(main(['prepare', '--scene', 'founder'])).toBe(2);
  });

  it('明示の指示だけが場面を変え、曖昧な指示は変えない', () => {
    const box = sandbox();
    const rel = box.write('src/content/blog/ja/switch.md', { category: 'ai' }, 'Cor.株式会社では、事実を確かめます。');
    const wording = instruction(box.call({ file: rel, text: '結びを短くしてほしい', date: '2026-10-28' }));
    expect(wording.voiceSwitched).toBe(false);
    expect(wording.scene).toBe('company');
    const switched = instruction(
      box.call({ file: rel, text: '代表の名前で書く', date: '2026-10-28', issue: '456' }),
    );
    expect(switched.voiceSwitched).toBe(true);
    expect(switched.scene).toBe('founder');
    const recorded = readFileSync(path.join(box.root, switched.rel), 'utf8');
    expect(recorded).toContain('issue: "456"');
    expect(recorded).toContain('代表の名前で書く');
    expect(recorded).not.toContain('\nscene:');
    const founderBody = readFileSync(path.join(box.root, rel), 'utf8').replace(
      'Cor.株式会社では、事実を確かめます。',
      '僕は、事実を確かめます。',
    );
    const finalPath = path.join(box.root, 'switch-final.md');
    writeFileSync(finalPath, founderBody);
    const result = check(box.call({ file: rel, final: finalPath }));
    expect(result.scene).toBe('founder');
    expect(result.findings.filter((item) => item.severity === 'fail')).toEqual([]);
    instruction(box.call({ file: rel, clear: true }));
    expect(() => check(box.call({ file: rel, final: finalPath }))).toThrow(/first-person/);
  });

  it('採用した記事の抜粋が、次のパケットに入り、見本からは外れる', () => {
    const box = sandbox();
    const older = box.write(
      'src/content/blog/ja/old.md',
      { category: 'ai', date: '2020-01-01' },
      '古い書き出しです。現場の言葉で書きます。',
    );
    const newerOther = box.write(
      'src/content/blog/ja/new-eng.md',
      { category: 'engineering', date: '2026-06-01' },
      '新しいけれどカテゴリは違います。手順を書きます。',
    );
    box.write('src/content/blog/ja/draft.md', { category: 'ai', date: '2026-08-01', draft: true }, '下書きの書き出しです。');
    const target = box.write('src/content/blog/ja/target.md', { category: 'ai', date: '2026-10-01' }, 'これから直す本文です。');
    const learnedRel = learn(box.call({ file: older, approved: true, note: '結びは短くする', date: '2026-10-28' }));
    expect(learnedRel.scene).toBe('company');
    const { packet } = prepare(box.call({ file: target }));
    expect(packet.learned.map((item) => item.source)).toContain(older);
    expect(packet.learned[0].note).toContain('結びは短くする');
    expect(packet.exemplars.map((item) => item.rel)).toEqual([newerOther]);
    expect(packet.scene).toBe('company');
    expect(packet.voiceSwitched).toBe(false);
  });

  it('同じカテゴリの見本を、日付が新しい別カテゴリより先にする', () => {
    const box = sandbox();
    const same = box.write(
      'src/content/blog/ja/same-cat.md',
      { category: 'ai', date: '2024-01-01' },
      '同じカテゴリの書き出しです。',
    );
    const other = box.write(
      'src/content/blog/ja/other-cat.md',
      { category: 'engineering', date: '2026-01-01' },
      '別カテゴリの書き出しです。',
    );
    const target = box.write('src/content/blog/ja/rank.md', { category: 'ai' }, '対象の本文です。');
    const { packet } = prepare(box.call({ file: target }));
    const rels = packet.exemplars.map((item) => item.rel);
    expect(rels).toEqual([same, other]);
  });

  it('下書きと未承認は learn できない', () => {
    const box = sandbox();
    const draft = box.write('src/content/blog/ja/no-learn.md', { draft: true }, '下書きです。');
    expect(() => learn(box.call({ file: draft, approved: true, note: '残す' }))).toThrow(/下書き/);
    const ready = box.write('src/content/blog/ja/need-flag.md', {}, '採用前の本文です。');
    expect(() => learn(box.call({ file: ready, approved: false, note: '残す' }))).toThrow(/--approved/);
  });

  it('見本の抜粋はコードを含まない', () => {
    const box = sandbox();
    box.write(
      'src/content/blog/ja/fenced.md',
      { category: 'lab', date: '2026-02-02' },
      '```js\nconst secret = "写さない"\n```\n\n手順の書き出しです。数値は定義と一緒に書きます。',
    );
    const target = box.write('src/content/blog/ja/lab-target.md', { category: 'lab' }, '検証の本文です。');
    const { packet } = prepare(box.call({ file: target }));
    expect(packet.scene).toBe('technical');
    expect(packet.exemplars[0].opening).toContain('手順の書き出しです');
    expect(packet.exemplars[0].opening).not.toContain('secret');
  });
});

describe('実ファイル', () => {
  it('founder-story の既定は代表の場面で、自分自身は見本に入らない', () => {
    const run = spawnSync(process.execPath, [CLI, 'prepare', '--file', 'src/content/blog/ja/founder-story.md', '--json'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(run.status, run.stderr).toBe(0);
    const packet = JSON.parse(run.stdout);
    expect(packet.scene).toBe('founder');
    expect(packet.voiceSwitched).toBe(false);
    expect(packet.file).toBe('src/content/blog/ja/founder-story.md');
    expect(packet.exemplars.map((item) => item.rel)).not.toContain(packet.file);
    for (const item of packet.exemplars) {
      expect(parseDocument(readFileSync(path.join(ROOT, item.rel), 'utf8')).data.category).toBe('founder');
    }
    expect(packet.yomiyasu).toEqual({ docType: 'article', reader: 'informed', stance: '説明' });
  });

  it('同じ内容の別ファイルを最終稿にしても、yomiyasu まで含めて完了になる', () => {
    const finalPath = path.join(dir, 'news-static-v1.final.md');
    writeFileSync(finalPath, readFileSync(path.join(ROOT, 'src/content/news/ja/news-static-v1.md')));
    const run = spawnSync(
      process.execPath,
      [
        CLI,
        'check',
        '--file',
        'src/content/news/ja/news-static-v1.md',
        '--final',
        finalPath,
        '--json',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    );
    expect(run.status, `${run.stderr}\n${run.stdout}`).toBe(0);
    const result = JSON.parse(run.stdout);
    expect(result.complete).toBe(true);
    expect(result.scene).toBe('company');
    expect(result.yomiyasu.status).toBe('ran');
  });
});

describe('入口', () => {
  const pointers = [
    '.claude/skills/article-polish/SKILL.md',
    '.agents/skills/article-polish/SKILL.md',
    '.pi/skills/article-polish/SKILL.md',
    '.opencode/skills/article-polish/SKILL.md',
    '.cursor/skills/article-polish/SKILL.md',
  ];

  it('ツールごとのスキルは同じ参照で、正本と規則のパスが実在する', () => {
    const bodies = pointers.map((rel) => readFileSync(path.join(ROOT, rel), 'utf8'));
    expect(new Set(bodies).size).toBe(1);
    expect(bodies[0]).toContain('skills/article-polish/SKILL.md');
    expect(bodies[0]).toContain('npm run polish');
    const canonical = readFileSync(path.join(ROOT, 'skills/article-polish/SKILL.md'), 'utf8');
    expect(canonical).toContain('.claude/skills/yomiyasu/SKILL.md');
    expect(canonical).toContain('.claude/skills/cor-voice/SKILL.md');
    expect(canonical).not.toContain('意味の保持（主張');
    const rule = readFileSync(path.join(ROOT, '.cursor/rules/japanese-copy.mdc'), 'utf8');
    expect(rule).toContain('npm run polish');
    expect(rule).toContain('.claude/skills/yomiyasu/SKILL.md');
    expect(rule).toContain('.claude/skills/cor-voice/SKILL.md');
    const voice = readFileSync(path.join(ROOT, '.claude/skills/cor-voice/SKILL.md'), 'utf8');
    for (const heading of ['会社として書く文章', '代表の名前で書く文章', '技術の記事', 'Grift のストーリー（架空の物語）']) {
      expect(voice).toContain(`### ${heading}`);
    }
    const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.scripts.polish).toContain('scripts/polish/cli.mjs');
    for (const name of ['CLAUDE.md', 'AGENTS.md']) {
      expect(readFileSync(path.join(ROOT, name), 'utf8')).toContain('npm run polish');
    }
  });
});
