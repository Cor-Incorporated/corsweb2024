// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { bodyCore, parseDocument } from '../frontmatter.mjs';
import { analyze, protect, ProtectionError, restore } from '../markdown.mjs';
import { JA_BLOG } from './helpers.mjs';

const roundTrip = (markdown) => {
  const { text, store } = protect(markdown);
  return { text, store, back: restore(text, store) };
};

const CASES = {
  'backtick fence with info': 'テキスト\n\n```js\nconst a = `x`; // 日本語コメント\n```\n\n後',
  'tilde fence': '~~~bash\necho "完了"\n~~~',
  'longer closing fence and nested backticks': '````md\n```js\ncode\n```\n````\n本文',
  'unclosed fence runs to the end': '前\n```\n閉じない\nまま',
  'indented fence inside a list': '- 項目\n\n   ```ts\n   let x = 1;\n   ```\n- 次',
  'fence inside a blockquote': '> 引用\n> ```sh\n> ls -la\n> ```\n> 続き',
  'inline code, escaped backticks and double backticks':
    '\\`コードではない\\` と `本物` と ``a ` b``',
  'links, images with titles and angle destinations':
    '[リンク](https://a.example/x_(y)) ![代替](/images/図.avif "題") [角](<https://b.example/a b>)',
  'autolinks, bare URLs and trailing punctuation':
    '<https://c.example> と https://d.example/path?q=1。 (https://e.example/)',
  'math inline and block':
    '式 $a^2 + b^2$ と $$x$$。価格は $20 と $30。\n\n$$\n\\int_0^1 x\\,dx\n$$',
  'html comment, block and inline tags':
    '<!--\nメモ\n-->\n\n<div class="x">\n中身\n</div>\n\n文<br>改行と<span>強調</span>',
  'link card lines and reference definitions':
    'https://github.com\n\n[ref]: https://f.example "題"\n\n[本文][ref] と脚注[^1]\n\n[^1]: 脚注の本文',
  'heading ids and tables': '## 見出し {#custom-id}\n\n| 列 | 値 |\n|---|---|\n| a | `b` |',
};

describe('protect / restore', () => {
  it.each(Object.entries(CASES))('restores exactly: %s', (_name, markdown) => {
    const { back } = roundTrip(markdown);
    expect(back).toBe(markdown);
  });

  it('leaves no code, URL, math or HTML in the text sent to the model', () => {
    const { text } = protect(bodyCore(parseDocument(JA_BLOG).body));
    expect(text).not.toMatch(/https?:\/\//);
    expect(text).not.toMatch(/^\s*(```|~~~)/m);
    expect(text).not.toContain('console.log');
    expect(text).not.toContain('\\pi');
    expect(text).not.toContain('<!--');
    expect(text).not.toContain('図1.avif');
    // 訳すべき部分（リンクテキスト・alt・見出し）は残っている
    expect(text).toContain('[公式サイト]');
    expect(text).toContain('![図の説明]');
    expect(text).toContain('## はじめに');
  });

  it.each([
    ['\\`コードではない\\` と `本物`', '\\`コードではない\\` と ⟦P0⟧'],
    ['式 $a^2 + b^2$。価格は $20 と $30。', '式 ⟦P0⟧。価格は $20 と $30。'],
    [
      '[リンク](https://a.example/x_(y)) ![代替](/図.avif "題")',
      '[リンク](⟦P0⟧) ![代替](⟦P1⟧ "題")',
    ],
    ['https://d.example/path?q=1。 (https://e.example/)', '⟦P0⟧。 (⟦P1⟧)'],
    ['文<br>と<span>強調</span>', '文⟦P0⟧と⟦P1⟧強調⟦P2⟧'],
    ['<AIエージェント> と a < b > c', '<AIエージェント> と a < b > c'],
  ])('protects only the untranslatable spans: %s', (markdown, expected) => {
    expect(protect(markdown).text).toBe(expected);
  });

  it('puts every block placeholder on its own line, keeping list / quote prefixes', () => {
    const { text } = protect(
      CASES['indented fence inside a list'] + '\n\n' + CASES['fence inside a blockquote']
    );
    expect(text).toContain('\n   ⟦B');
    expect(text).toMatch(/\n> ⟦B\d+⟧\n> 続き/);
  });

  it('refuses a source that already contains the reserved ⟦ ⟧ characters', () => {
    expect(() => protect('これは ⟦P0⟧ を含む')).toThrow(ProtectionError);
  });

  it('round-trips every existing content file in src/content (all collections and languages)', () => {
    const root = path.resolve(import.meta.dirname, '../../../src/content');
    const files = ['blog', 'cases', 'news'].flatMap((c) =>
      ['ja', 'en', 'zh', 'ko', 'es'].flatMap((l) =>
        readdirSync(path.join(root, c, l)).map((f) => path.join(root, c, l, f))
      )
    );
    expect(files.length).toBeGreaterThan(90);
    for (const file of files) {
      const core = bodyCore(parseDocument(readFileSync(file, 'utf8')).body);
      const { text, back } = roundTrip(core);
      expect(back, file).toBe(core);
      expect(text, file).not.toMatch(/https?:\/\//);
      expect(text, file).not.toMatch(/^\s*(```|~~~)/m);
    }
  });
});

describe('リンク・画像の title は訳す（宛先だけを保護する）', () => {
  it.each([
    ['![説明](/img.avif "タイトル")', '![説明](⟦P0⟧ "タイトル")'],
    ['[文言](https://example.com/a "リンクの説明")', '[文言](⟦P0⟧ "リンクの説明")'],
    ["[文言](/b 'シングル')", "[文言](⟦P0⟧ 'シングル')"],
    ['[文言](/c (かっこ))', '[文言](⟦P0⟧ (かっこ))'],
    ['[文言](<https://example.com/a b> "空白入り")', '[文言](⟦P0⟧ "空白入り")'],
    ['[文言]( /d  "余白" )', '[文言]( ⟦P0⟧  "余白" )'],
  ])('%s', (markdown, expected) => {
    const { text, store } = protect(markdown);
    expect(text).toBe(expected);
    expect(restore(text, store)).toBe(markdown);
  });

  it('title だけを訳しても宛先は 1 文字も変わらない（往復）', () => {
    const markdown =
      '見出し ![図の説明](/images/blog/図1.avif "タイトル") と [公式](https://cor-jp.com "会社の説明")';
    const { text, store } = protect(markdown);
    const translated = text
      .replace('見出し', 'Heading')
      .replace('図の説明', 'Figure')
      .replace('"タイトル"', '"Title"')
      .replace('公式', 'Official')
      .replace('"会社の説明"', '"About us"');
    expect(restore(translated, store)).toBe(
      'Heading ![Figure](/images/blog/図1.avif "Title") と [Official](https://cor-jp.com "About us")'
    );
  });
});

describe('analyze', () => {
  it('counts structure outside code blocks only', () => {
    const metrics = analyze(
      '# A\n\n```md\n# not a heading\n| not | a row |\n```\n\n## B\n\n| x |\n|---|\n\n![i](/a.png) [l](/b) https://c.example'
    );
    expect(metrics.headings).toEqual([1, 1, 0, 0, 0, 0]);
    expect(metrics.tableRows).toBe(2);
    expect(metrics.kinds['code-block']).toHaveLength(1);
    expect(metrics.kinds['image-dest']).toEqual(['/a.png']);
    expect(metrics.kinds['link-dest']).toEqual(['/b']);
    expect(metrics.kinds['bare-url']).toEqual(['https://c.example']);
  });
});
