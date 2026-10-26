// @vitest-environment node
/**
 * Grift の用語の表（grift-terms.mjs）。正本（griftai の tep.ts・grift-cli の docs）との照合は
 * grift-terms-link.test.mjs。ここでは表の値そのものと、保護・復元・大文字・小文字の決まりを固定する。
 */
import { describe, expect, it } from 'vitest';
import { TARGET_LANGS } from '../config.mjs';
import {
  GRIFT_TERMS,
  griftTermFingerprint,
  griftTermForm,
  griftTermOutput,
  griftTermsIn,
  griftTermTokens,
  SOURCE_GRIFT_TERM_PATTERN,
  startsSentence,
} from '../grift-terms.mjs';
import { expandTokens, protect, restore } from '../markdown.mjs';

const byJa = (lang) => Object.fromEntries(GRIFT_TERMS.map((term) => [term.ja, term[lang]]));

describe('GRIFT_TERMS（言語ごとの正式表記）', () => {
  it('en は grift-cli の英語の語（文の途中の形）', () => {
    expect(byJa('en')).toEqual({
      検査値: 'observed values',
      テスト併修率: 'test co-change',
      手戻り率: 'corrective rework',
      磨き直し: 'path retouch',
      コードの新しさ: 'Code recency',
      作業領域: 'work surface',
      変更リズム: 'change rhythm',
      検証の形: 'verification profile',
    });
  });

  it('es / ko / zh は事例ページの訳を固定し、コードの新しさは（未決）で en の表記を使う', () => {
    expect(byJa('es')).toEqual({
      検査値: 'valores de inspección',
      テスト併修率: 'tasa de modificación conjunta de pruebas',
      手戻り率: 'tasa de retrabajo',
      磨き直し: 'retoque',
      コードの新しさ: null,
      作業領域: 'áreas de trabajo',
      変更リズム: 'ritmo de cambios',
      検証の形: 'forma de verificación',
    });
    expect(byJa('ko')).toEqual({
      検査値: '검사값',
      テスト併修率: '테스트 동시 수정률',
      手戻り率: '재작업률',
      磨き直し: '재접촉',
      コードの新しさ: null,
      作業領域: '작업 영역',
      変更リズム: '변경 리듬',
      検証の形: '검증 형태',
    });
    expect(byJa('zh')).toEqual({
      検査値: '检查值',
      テスト併修率: '测试伴随修改率',
      手戻り率: '返工率',
      磨き直し: '修缮重触',
      コードの新しさ: null,
      作業領域: '工作领域',
      変更リズム: '变更节奏',
      検証の形: '验证形态',
    });
    for (const lang of ['es', 'ko', 'zh'])
      expect(griftTermForm('コードの新しさ', lang)).toBe('Code recency');
  });

  it('id と ja は重ならず、どの言語の表記もトークンの予約文字を含まない', () => {
    expect(new Set(GRIFT_TERMS.map((t) => t.id)).size).toBe(GRIFT_TERMS.length);
    expect(new Set(GRIFT_TERMS.map((t) => t.ja)).size).toBe(GRIFT_TERMS.length);
    for (const term of GRIFT_TERMS) {
      for (const lang of TARGET_LANGS)
        expect(griftTermForm(term.ja, lang)).not.toMatch(/[⟦⟧]|^\s|\s$/);
    }
  });

  it('表に無い語・言語は例外', () => {
    expect(() => griftTermForm('定着率', 'en')).toThrow(/Grift の用語ではありません/);
    expect(() => griftTermForm('作業領域', 'fr')).toThrow(/未定義の言語/);
  });
});

describe('SOURCE_GRIFT_TERM_PATTERN（ja 側の用語）', () => {
  const matchOf = (text) => text.match(SOURCE_GRIFT_TERM_PATTERN);

  it.each([
    ['テスト併修率は上がる', 'テスト併修率'],
    ['- 作業領域（`surface_profile`）:', '作業領域'],
    ['出すのは検査値で', '検査値'],
    ['手戻り率・磨き直し: 直近', '手戻り率,磨き直し'],
    ['磨き直しの割合', '磨き直し'],
    ['コードの新しさ（いまのコード）', 'コードの新しさ'],
    ['作業領域・変更リズム・検証の形', '作業領域,変更リズム,検証の形'],
  ])('%s → %s', (text, expected) => {
    expect(matchOf(text)).toEqual(expected.split(','));
  });

  // 別の語の一部（後ろに漢字・カタカナが続く）と、動詞の活用は用語として扱わない
  it.each(['検証の形式', '作業領域内', '磨き直した', '磨き直して', '磨き直します', '定着率'])(
    '用語として扱わない: %s',
    (text) => {
      expect(matchOf(text)).toBeNull();
    }
  );
});

describe('griftTermsIn / griftTermFingerprint（どの記事で固定するか・ハッシュに入れる値）', () => {
  const source = (body, fields = {}) => ({ fields, body });

  it('「Grift」の出ない記事では固定しない（一般の言葉としての「作業領域」など）', () => {
    expect(griftTermsIn(source('作業領域を広げる。検査値を見る。'))).toEqual([]);
    expect(griftTermFingerprint(source('作業領域を広げる。'))).toBeNull();
  });

  it('Grift の記事では、訳すフィールドと本文に出る用語を表の順に返す', () => {
    const terms = griftTermsIn(
      source('変更リズムと作業領域。', { description: 'Griftの検査値' })
    ).map((t) => t.ja);
    expect(terms).toEqual(['検査値', '作業領域', '変更リズム']);
    expect(griftTermsIn(source('Griftの記事。用語は出ない。'))).toEqual([]);
  });

  it('ハッシュに入れる値は、用語の id と ja と各言語の正式表記（表の値を変えるとハッシュが変わる）', () => {
    expect(griftTermFingerprint(source('Griftの作業領域'))).toEqual([
      ['work-surface', '作業領域', 'work surface', '工作领域', '작업 영역', 'áreas de trabajo'],
    ]);
  });
});

describe('startsSentence / griftTermOutput（en / es は文の頭だけ大文字）', () => {
  it.each([
    ['', true],
    ['- ', true],
    ['  - ', true],
    ['1. ', true],
    ['## ', true],
    ['> - ', true],
    ['- **', true],
    ['| ', true],
    ['| Observed values | x | ', true],
    ['It rises. ', true],
    ['first line\n', true],
    ['He wrote: "', true],
    ['- `survival_scan_disabled`: ', true],
    ['the ', false],
    ['facts (', false],
    ['test co-change, ', false],
    ['we noted that "', false],
  ])('en: 「%s」の後', (before, expected) => {
    expect(startsSentence(before, 'en')).toBe(expected);
  });

  it('es はコロンの後を文の頭とみなさない（小文字で続ける）。¿ ¡ は飛ばす', () => {
    expect(startsSentence('- `survival_scan_disabled`: ', 'es')).toBe(false);
    expect(startsSentence('¿', 'es')).toBe(true);
    expect(griftTermOutput('作業領域', 'es', '- ')).toBe('Áreas de trabajo');
    expect(griftTermOutput('作業領域', 'es', 'Las ')).toBe('áreas de trabajo');
  });

  it('大文字で書いた表記（Code recency）は文の途中でも大文字のまま。ko / zh は表記どおり', () => {
    expect(griftTermOutput('作業領域', 'en', '| ')).toBe('Work surface');
    expect(griftTermOutput('作業領域', 'en', 'the ')).toBe('work surface');
    expect(griftTermOutput('コードの新しさ', 'en', 'the ')).toBe('Code recency');
    expect(griftTermOutput('作業領域', 'ko', '')).toBe('작업 영역');
    expect(griftTermOutput('作業領域', 'zh', '')).toBe('工作领域');
  });
});

describe('protect / restore: Grift の記事では用語をトークン ⟦G…⟧ にし、翻訳先言語の正式表記で戻す', () => {
  const markdown = [
    '- 作業領域（`surface_profile`）: 11区分。`作業領域` と https://griftai.org/tep は触らない',
    '',
    '| サイトの言い方 | CLIの語 |',
    '|---|---|',
    '| 作業領域・変更リズム・検証の形 | surface_profile |',
    '',
    '<!-- 作業領域のメモ -->',
  ].join('\n');

  it('griftTerms を渡したときだけトークンにする。コード・URL・HTML コメントの中は置き換えない', () => {
    expect(protect(markdown).text).not.toMatch(/⟦G\d+⟧/);
    const { text, store } = protect(markdown, { griftTerms: true });
    expect(text).toMatch(/^- ⟦G\d+⟧（⟦P\d+⟧）: 11区分。⟦P\d+⟧ と ⟦P\d+⟧ は触らない$/m);
    expect(text).toMatch(/^\| ⟦G\d+⟧・⟦G\d+⟧・⟦G\d+⟧ \| surface_profile \|$/m);
    expect(
      [...store.values()].filter((e) => e.kind === 'grift-term').map((e) => e.original)
    ).toEqual(['作業領域', '作業領域', '変更リズム', '検証の形']);
  });

  it('lang なしは完全な往復、lang ありは正式表記（文の頭・表のセルの頭で大文字）', () => {
    const { text, store } = protect(markdown, { griftTerms: true });
    expect(restore(text, store)).toBe(markdown);
    // 訳のふり: 日本語の区切りを英語の区切りに替える（トークンは残す）
    const translated = text.replace('・', ', ').replace('・', ', ');
    const en = restore(translated, store, 'en');
    expect(en).toContain('- Work surface（`surface_profile`）');
    expect(en).toContain('| Work surface, change rhythm, verification profile | surface_profile |');
    expect(en).toContain('`作業領域` と https://griftai.org/tep');
    expect(en).toContain('<!-- 作業領域のメモ -->');
    expect(expandTokens(text, store, 'ko')).toContain('| 작업 영역・변경 리듬・검증 형태 |');
  });

  it('griftTermTokens はトークンを表記ごとにまとめる（プロンプトで伝える）', () => {
    const { store } = protect(markdown, { griftTerms: true });
    const tokens = griftTermTokens(store, 'en');
    expect(tokens.map((t) => t.form)).toEqual([
      'work surface',
      'change rhythm',
      'verification profile',
    ]);
    expect(tokens[0].tokens).toHaveLength(2);
    expect(tokens.flatMap((t) => t.tokens).every((t) => /^⟦G\d+⟧$/.test(t))).toBe(true);
  });
});
