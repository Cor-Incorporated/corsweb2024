// @vitest-environment node
// トップページの書き直し（#414、2026-10-26）で代表が決めたことを、5 言語の locale と index.astro で照合する。
// ビルド結果の検査は tests/build-output/home-page.test.ts。
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import jaJson from '../../i18n/locales/ja.json';
import enJson from '../../i18n/locales/en.json';
import zhJson from '../../i18n/locales/zh.json';
import koJson from '../../i18n/locales/ko.json';
import esJson from '../../i18n/locales/es.json';
import { isContactIntent } from '../../config/site';

const ROOT = path.resolve(__dirname, '../../..');
const LOCALES = { ja: jaJson, en: enJson, zh: zhJson, ko: koJson, es: esJson } as const;
type LocaleKey = keyof typeof LOCALES;
const LOCALE_KEYS = Object.keys(LOCALES) as LocaleKey[];

// 課題 → 実証 → 柱 → セキュリティ → 業種 → Grift のあとに FAQ と締め（docs/story-spine.md）
const SECTION_ORDER = [
  'ProblemHero',
  'ChallengeGrid',
  'ProofHighlights',
  'ServicesReframed',
  'SecurityTrust',
  'IndustryList',
  'GriftBridge',
  'Faq',
  'FinalCta',
];

// 最初の画面に出さない言葉（技術・製品の名前）。どの言語でもラテン文字のまま書く語だけを挙げる
const FIRST_SCREEN_JARGON = /LLM|PoC|RAG|Grift/;

// ADR-0011 の有料入口 3 本
const PAID_ENTRY_INTENTS = ['confidential-ai-assessment', 'local-llm-poc', 'grift-team-beta'];

function indexFile(locale: LocaleKey): string {
  return path.join(ROOT, 'src/pages', locale === 'ja' ? '' : locale, 'index.astro');
}

// index.astro の本文に並んだ部品の名前（<Name /> の自己終了タグ）
function sectionsOf(locale: LocaleKey): string[] {
  const source = readFileSync(indexFile(locale), 'utf8');
  const body = source.slice(source.indexOf('<Layout'), source.indexOf('</Layout>'));
  return [...body.matchAll(/<([A-Z]\w*)\s*\/>/g)].map((m) => m[1]);
}

// サイト内のパスが、ja の元になるファイルとして実在するか（他言語のページは dist のテストで確かめる）
function sourceExists(link: string): boolean {
  const [, kind, slug] = link.match(/^\/(works|industries|blog)\/([\w-]+)$/) ?? [];
  if (kind === 'works') return existsSync(path.join(ROOT, 'src/content/cases/ja', `${slug}.md`));
  if (kind === 'industries') return existsSync(path.join(ROOT, 'src/pages/industries', `${slug}.astro`));
  if (kind === 'blog') return existsSync(path.join(ROOT, 'src/content/blog/ja', `${slug}.md`));
  return false;
}

// docs/story-spine.md の「ページの最後の問いかけは、全部のページで「…」にそろえます。」から締めの一文を取る
function closingLineInSpine(): string {
  const spine = readFileSync(path.join(ROOT, 'docs/story-spine.md'), 'utf8');
  const match = spine.match(/ページの最後の問いかけは、全部のページで「(.+?)」にそろえます。/);
  expect(match, 'docs/story-spine.md に締めの一文の決まりが見つからない').not.toBeNull();
  return match![1];
}

describe('トップのセクションの並び (#414)', () => {
  it.each(LOCALE_KEYS)('%s: index.astro が決めた並びになっている', (locale) => {
    expect(sectionsOf(locale)).toEqual(SECTION_ORDER);
  });
});

describe('最初の画面の言葉 (#414)', () => {
  it.each(LOCALE_KEYS)('%s: ヒーローに技術・製品の名前を出さない', (locale) => {
    const hero = LOCALES[locale].homeHero;
    const texts = {
      kicker: hero.kicker,
      title: hero.title,
      subtitle: hero.subtitle,
      primaryCta: hero.primaryCta,
      secondaryCta: hero.secondaryCta,
      ...Object.fromEntries(hero.trustBadges.map((badge) => [`trustBadges.${badge.id}`, badge.label])),
    };
    const hits = Object.entries(texts).filter(([, text]) => FIRST_SCREEN_JARGON.test(text));
    expect(hits, `ヒーローの文言に ${FIRST_SCREEN_JARGON} が入っている`).toEqual([]);
  });
});

describe('5 言語で同じ並び・同じリンク (#414)', () => {
  const pick = (locale: LocaleKey) => {
    const t = LOCALES[locale];
    return {
      trustBadges: t.homeHero.trustBadges.map((badge) => badge.id),
      challengeLinks: t.homeChallenges.items.map((item) => item.link),
      proofItems: t.proof.items.map((item) => item.id),
      industryLinks: t.homeIndustries.rows.map((row) => row.link),
      finalIntents: t.finalCta.items.map((item) => item.intent),
    };
  };

  it.each(LOCALE_KEYS.filter((l) => l !== 'ja'))('%s: ja と同じ id・リンクが同じ順に並ぶ', (locale) => {
    const ja = pick('ja');
    for (const [key, values] of Object.entries(pick(locale))) {
      const expected = ja[key as keyof typeof ja];
      expect(values, `${key}: ${locale}=${JSON.stringify(values)} / ja=${JSON.stringify(expected)}`).toEqual(expected);
    }
  });

  it('課題のカードのリンク先が実在する', () => {
    const missing = jaJson.homeChallenges.items.map((item) => item.link).filter((link) => !sourceExists(link));
    expect(missing).toEqual([]);
  });

  it('業種の一覧のリンク先が実在する', () => {
    const missing = jaJson.homeIndustries.rows.map((row) => row.link).filter((link) => !sourceExists(link));
    expect(missing).toEqual([]);
  });

  it('締めの入口は ADR-0011 の有料入口 3 本で、intent が契約の 7 キーに入っている', () => {
    const intents = jaJson.finalCta.items.map((item) => item.intent);
    expect(intents).toEqual(PAID_ENTRY_INTENTS);
    expect(intents.filter((intent) => !isContactIntent(intent))).toEqual([]);
  });
});

describe('締めの一文 (docs/story-spine.md)', () => {
  it('ja の締めの見出しが、物語の背骨で決めた一文と同じ', () => {
    expect(jaJson.finalCta.title).toBe(closingLineInSpine());
  });
});
