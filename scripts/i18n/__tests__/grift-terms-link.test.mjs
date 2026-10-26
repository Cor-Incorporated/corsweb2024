// @vitest-environment node
/**
 * リンクテスト: Grift の用語の表（scripts/i18n/grift-terms.mjs の GRIFT_TERMS）を、正本と、cor-jp.com の事例ページの
 * 対応表に結ぶ。正本は別のリポジトリにあって CI からは読めないので、値をここに写し、出典の path と commit を書く。
 * 正本が変わったら、ここの値と commit を写し直し、表（GRIFT_TERMS）も直す。どちらか片方だけを変えると、両側の値を
 * 出して落ちる。
 *
 * - ja の正本: Cor-Incorporated/griftai の src/config/tep.ts の tepTerms（用語の対応表。/tep/ と llms.txt が読む）
 * - en の正本: Cor-Incorporated/grift-cli-dev の docs/en/metrics-guide.md と docs/metrics-guide.md
 *   （0.9.0 向けの PR #95 の head。2026-10-26 時点で未マージ。マージ後の commit で写し直す）
 * - cor-jp.com 側: src/content/cases/ja/grift.md の「サイトの言い方 | CLIの語」の表
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GRIFT_TERMS } from '../grift-terms.mjs';

const GRIFTAI = {
  repo: 'Cor-Incorporated/griftai',
  path: 'src/config/tep.ts',
  commit: '74a108295c45bc6af6a01a7d8e49af79ab149dd0', // origin/main（#86「定着率」→「コードの新しさ」のマージ）
};

/** tepTerms の site（サイトの用語。site の無い項目は plain）と cli。行は GRIFTAI.commit の tep.ts。 */
const TEP_TERMS = Object.freeze([
  { site: '検査値', cli: 'observed value', line: 327 },
  { site: '帰属の区別', cli: 'origin', line: 105 },
  { site: '作業領域', cli: 'surface_profile', line: 119 },
  { site: '変更リズム', cli: 'change_rhythm', line: 133 },
  { site: 'テスト併修率', cli: 'test co-change', line: 147 },
  { site: '検証の形', cli: 'verification_profile', line: 156 },
  { site: 'リポジトリの文脈', cli: 'context profile', line: 170 },
  { site: '関わり方', cli: 'role_profile', line: 177 },
  { site: '手戻り率', cli: 'corrective rework', line: 193 },
  { site: '磨き直し', cli: 'path retouch', line: 201 },
  { site: 'コードの新しさ', cli: 'survival', line: 214 },
  { site: '案件側の宣言', cli: 'grift project', line: 279 },
  { site: '軸ごとの並び', cli: 'grift align', line: 289 },
  { site: 'チーム単位の充足', cli: 'grift align --team', line: 298 },
  { site: '未観測', cli: 'not_observed', line: 347 },
  { site: 'TEP', cli: 'Technical Evidence Pipeline', line: 353 },
]);

/** 正本の用語のうち、訳を固定しないもの（理由つき）。表に足すときは、ここから外す。 */
const NOT_FIXED = Object.freeze({
  帰属の区別: 'grift-cli の英語の文書に、サイトの用語の英語が無い（CLI の語は origin）。（未決）',
  リポジトリの文脈:
    'grift-cli の英語の文書に、サイトの用語の英語が無い（CLI の語は context profile）。（未決）',
  関わり方: '一般の言葉で、cor-jp.com の記事には出ない（事例ページは「役割の4次元」と書く）',
  案件側の宣言: 'cor-jp.com の記事には出ない（grift project とコマンド名で書く）',
  軸ごとの並び: 'cor-jp.com の記事には出ない（grift align とコマンド名で書く）',
  チーム単位の充足: 'cor-jp.com の記事には出ない（--team とオプション名で書く）',
  未観測: '一般の言葉で、記事では「未観測（not_observed）」と CLI の語を添えて書く',
  TEP: '英字の名前で、モデルは訳さない（どの言語の訳でも「TEP」のまま）',
});

const GRIFT_CLI = {
  repo: 'Cor-Incorporated/grift-cli-dev',
  commit: 'f785c4c376e6a60dd00f8f808574961576878cc8', // feat/site-plain-names（PR #95、base release/v0.9.0）
};

/** en の正本。evidence は [path, 行, その行をそのまま写した文字列]（en の語が書かれていることを、下のテストが確かめる）。 */
const GRIFT_CLI_EN = Object.freeze([
  {
    ja: '検査値',
    en: 'observed values',
    evidence: [
      [
        'docs/metrics-guide.md',
        26,
        '| 検査値 | observed | `kind: "observed"` を持つ観測ブロックの `value`（単位は `unit`） | [数値が出ない（not observed）とき](#数値が出ないnot-observedとき) |',
      ],
      ['README.en.md', 121, 'It never turns observed values into pass/fail results or thresholds.'],
    ],
  },
  {
    ja: 'テスト併修率',
    en: 'test co-change',
    evidence: [
      [
        'docs/metrics-guide.md',
        27,
        '| テスト併修率 | test co-change（テスト同期変更率） | `test_cochange.all_time.value` | [証拠系: test co-change](#証拠系-test-co-changeテスト同期変更率) |',
      ],
    ],
  },
  {
    ja: '手戻り率',
    en: 'corrective rework',
    evidence: [
      [
        'docs/metrics-guide.md',
        28,
        '| 手戻り率 | corrective rework | `rework.corrective_rework_rate.value` | [観測系: corrective rework と path retouch](#観測系-corrective-rework-と-path-retouch) |',
      ],
    ],
  },
  {
    ja: '磨き直し',
    en: 'path retouch',
    evidence: [
      [
        'docs/metrics-guide.md',
        29,
        '| 磨き直し | path retouch | `rework.path_retouch_rate.value` | [観測系: corrective rework と path retouch](#観測系-corrective-rework-と-path-retouch) |',
      ],
    ],
  },
  {
    ja: 'コードの新しさ',
    en: 'Code recency',
    evidence: [
      [
        'docs/en/metrics-guide.md',
        213,
        'On griftai.org and cor-jp.com this value is called コードの新しさ (Code recency).',
      ],
    ],
  },
  {
    ja: '作業領域',
    en: 'Work surface',
    evidence: [
      [
        'docs/en/metrics-guide.md',
        19,
        '| 変えた部分の区分（作業領域） | Parts changed | Work surface | `surface_profile` |',
      ],
    ],
  },
  {
    ja: '変更リズム',
    en: 'Change rhythm',
    evidence: [
      [
        'docs/en/metrics-guide.md',
        20,
        '| 変更のペース（変更リズム） | Pace of change | Change rhythm | `change_rhythm` |',
      ],
    ],
  },
  {
    ja: '検証の形',
    en: 'Verification profile',
    evidence: [
      [
        'docs/en/metrics-guide.md',
        21,
        '| テストの付け方（検証の形） | How tests are added | Verification profile | `verification_profile` |',
      ],
    ],
  },
]);

const tableJa = Object.fromEntries(GRIFT_TERMS.map((term) => [term.ja, term.ja]));
// 大文字・小文字は訳の中の位置で決まる（文の頭・表のセルの頭で大文字。grift-terms.mjs）ので、照合では区別しない
const lower = (entries) => Object.fromEntries(entries.map(([ja, en]) => [ja, en.toLowerCase()]));

describe(`Grift の用語 ja: scripts/i18n/grift-terms.mjs ↔ ${GRIFTAI.repo} ${
  GRIFTAI.path
}@${GRIFTAI.commit.slice(0, 7)}`, () => {
  it('正本の用語は、どれも表にあるか、固定しない理由が書いてある', () => {
    const covered = Object.fromEntries(
      TEP_TERMS.map(({ site }) => [
        site,
        site in tableJa ? 'GRIFT_TERMS' : NOT_FIXED[site] ? 'NOT_FIXED' : '（どちらにも無い）',
      ])
    );
    expect(Object.values(covered).filter((v) => v === '（どちらにも無い）')).toEqual([]);
    expect(Object.keys(NOT_FIXED).filter((site) => site in tableJa)).toEqual([]);
  });

  it('表の ja は、どれも正本のサイトの用語（片方だけ変えると両側の値を出して落ちる）', () => {
    const canonical = new Set(TEP_TERMS.map((t) => t.site));
    expect(
      Object.fromEntries(
        GRIFT_TERMS.map((t) => [t.id, canonical.has(t.ja) ? t.ja : `正本に無い: ${t.ja}`])
      ),
      'Received = scripts/i18n/grift-terms.mjs、Expected = griftai の tep.ts'
    ).toEqual(Object.fromEntries(GRIFT_TERMS.map((t) => [t.id, t.ja])));
  });
});

describe(`Grift の用語 en: scripts/i18n/grift-terms.mjs ↔ ${
  GRIFT_CLI.repo
}@${GRIFT_CLI.commit.slice(0, 7)}`, () => {
  it('写した出典の行に、en の語が書いてある（写し間違いの検出）', () => {
    for (const { en, evidence } of GRIFT_CLI_EN) {
      expect(
        evidence.some(([, , text]) => text.toLowerCase().includes(en.toLowerCase())),
        en
      ).toBe(true);
    }
  });

  it('全部の用語で en が正本と同じ（片方だけ変えると両側の値を出して落ちる）', () => {
    expect(
      lower(GRIFT_TERMS.map((t) => [t.ja, t.en])),
      'Received = scripts/i18n/grift-terms.mjs の en、Expected = grift-cli の docs'
    ).toEqual(lower(GRIFT_CLI_EN.map((t) => [t.ja, t.en])));
  });
});

describe('Grift の用語: scripts/i18n/grift-terms.mjs ↔ src/content/cases/ja/grift.md の対応表', () => {
  const file = path.resolve(import.meta.dirname, '../../..', 'src/content/cases/ja/grift.md');
  const lines = readFileSync(file, 'utf8').split('\n');
  const header = lines.findIndex((line) =>
    /^\|\s*サイトの言い方\s*\|\s*CLIの語\s*\|$/.test(line.trim())
  );
  const rows = [];
  for (let i = header + 2; header !== -1 && i < lines.length && lines[i].startsWith('|'); i += 1) {
    const [site, cli] = lines[i]
      .split('|')
      .slice(1, 3)
      .map((cell) => cell.trim());
    rows.push({ site, cli });
  }

  it('事例ページに「| サイトの言い方 | CLIの語 |」の表がある', () => {
    expect(header, '表の見出し行が見つからない。表を動かしたら、このテストの探し方も直す').not.toBe(
      -1
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it('表のサイトの言い方は、どれも用語の表か、固定しない理由のある正本の用語で、CLI の語は正本と同じ', () => {
    const cliOf = Object.fromEntries(TEP_TERMS.map((t) => [t.site, t.cli]));
    const problems = rows.flatMap(({ site, cli }) =>
      site.split('・').flatMap((term) => {
        if (!(term in tableJa) && !NOT_FIXED[term])
          return [`${term}: 用語の表にも、固定しない語の一覧にも無い`];
        if (!cliOf[term]) return [`${term}: griftai の tep.ts に無い`];
        return cli.includes(cliOf[term].split(' ')[0])
          ? []
          : [`${term}: CLI の語「${cli}」に「${cliOf[term]}」が無い`];
      })
    );
    expect(problems).toEqual([]);
  });
});
