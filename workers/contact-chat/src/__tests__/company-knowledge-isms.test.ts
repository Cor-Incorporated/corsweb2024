// @vitest-environment node
/**
 * 公開 chat（AI 受付）の「会社の知識」の ISMS の行が、事実の正本
 * （.claude/skills/cor-voice/references/facts.json の isms）と同じ登録済みの事実であること。
 * 登録前の書き方（「第2段階審査を終え、12月ごろの認証登録を見込む。まだ認証していない」）が
 * 戻ると落ちる。トップ・会社概要・llms.txt は登録済みの書き方なのに、chat の知識だけが
 * 取り残される食い違いを防ぐ。値は試験に写し書きせず、facts.json を読んで比べる
 * （正本と知識のどちらか一方だけを変えたら落ちる）。
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { COMPANY_KNOWLEDGE } from '../company-knowledge';
import { buildSystemPrompt } from '../llm';

// workers/contact-chat/src/__tests__/ から repository root へ 4 つ上
const FACTS_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../.claude/skills/cor-voice/references/facts.json',
);

type IsmsFacts = {
  id: string;
  status?: string;
  standard?: string;
  registration_number?: string;
  scope?: string;
  issuer?: string;
  valid_from?: string;
  valid_to?: string;
  stale_state_phrases?: string[];
  stale_state_phrases_any_context?: string[];
};

const factsJson = JSON.parse(readFileSync(FACTS_PATH, 'utf8')) as { facts: IsmsFacts[] };
const isms = factsJson.facts.find((fact) => fact.id === 'isms') ?? ({ id: 'missing' } as IsmsFacts);

const ismsLine = COMPANY_KNOWLEDGE.split('\n').find((line) => /ISMS|ISO\/IEC 27001/.test(line)) ?? '';

const KNOWLEDGE_SECTION = '# Approved public company knowledge';

const BEFORE_REGISTRATION_EN = [
  'not certified',
  'expects certification',
  'stage 2 audit',
  'around December',
  'expects registration',
];

function stalePhrases(text: string): string[] {
  const lower = text.toLowerCase();
  const english = BEFORE_REGISTRATION_EN.filter((phrase) => lower.includes(phrase.toLowerCase()));
  const japanese = [...(isms.stale_state_phrases ?? []), ...(isms.stale_state_phrases_any_context ?? [])]
    .filter((phrase) => text.includes(phrase));
  return [...english, ...japanese];
}

describe('chat の知識の ISMS の行', () => {
  it('正本（facts.json の isms）は登録済みである', () => {
    expect({ id: isms.id, status: isms.status }).toMatchObject({ id: 'isms', status: 'registered' });
  });

  it('登録済みの事実（規格・登録番号・範囲・発行者・有効期間）を同じ行に持つ（値は facts.json から）', () => {
    expect({
      line: ismsLine,
      standard: ismsLine.includes(isms.standard ?? ''),
      registration_number: ismsLine.includes(isms.registration_number ?? ''),
      scope: ismsLine.includes(`「${isms.scope}」`),
      issuer: ismsLine.includes(isms.issuer ?? ''),
      valid_from: ismsLine.includes(isms.valid_from ?? ''),
      valid_to: ismsLine.includes(isms.valid_to ?? ''),
    }).toMatchObject({
      standard: true,
      registration_number: true,
      scope: true,
      issuer: true,
      valid_from: true,
      valid_to: true,
    });
  });

  it('登録前の書き方が無い（直す前の行は落ちる）', () => {
    expect({ line: ismsLine, stale: stalePhrases(ismsLine) }).toMatchObject({ stale: [] });
  });

  it('範囲の外へ広げない注意（個別の製品・登録範囲の外）が行にある', () => {
    expect({
      line: ismsLine,
      individualProduct: ismsLine.includes('individual product'),
      registeredScope: ismsLine.includes('registered scope'),
      outside: ismsLine.includes('登録範囲の外'),
    }).toMatchObject({ individualProduct: true, registeredScope: true, outside: true });
  });

  // cor-voice の lint は、ISMS の語と同じ段落の `Grift` を範囲の外への拡張として拾う
  // （否定の形でも英語の否定を読めない）。行から `Grift` を外し、意味は個別の製品で保つ。
  it('ISMS の行に Grift が無い（lint の isms_scope_overreach を出さない）', () => {
    expect({ line: ismsLine, grift: ismsLine.includes('Grift') }).toMatchObject({ grift: false });
  });

  it.each([
    ['intake/ja', { mode: 'intake', locale: 'ja' } as const],
    ['ambassador/en', { mode: 'ambassador', locale: 'en' } as const],
  ])('%s の prompt の知識の節に ISMS の行があり、登録前の書き方が無い', (_name, opts) => {
    const prompt = buildSystemPrompt(opts);
    const section = prompt.split(KNOWLEDGE_SECTION)[1] ?? '';
    expect({ section, hasIsmsLine: section.includes(ismsLine) }).toMatchObject({ hasIsmsLine: true });
    expect({ prompt, stale: stalePhrases(prompt) }).toMatchObject({ stale: [] });
  });
});
