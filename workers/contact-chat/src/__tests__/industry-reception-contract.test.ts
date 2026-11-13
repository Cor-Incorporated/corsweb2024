// 業種ページ → Cloudia → Worker の受付の契約。Cloudia 側の試験が同じバイト列の fixture を読む。
// 片側だけ文や列挙を変えると、期待値と観測値の両方を挙げて落ちる。
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  INDUSTRY_COPY_STATUS,
  INDUSTRY_ENTRY_SOURCES,
  KNOWN_ENTRY_SOURCES,
  industryStartReply,
  type IndustrySlug,
} from '../industry-context';

interface Marker { source: string; locale: 'ja' | 'en'; marker: string }
interface Contract {
  contract: string;
  copyStatus: string;
  sources: string[];
  genericSources: string[];
  localeFallback: Record<string, string>;
  markers: Marker[];
}

const contract = JSON.parse(
  readFileSync(resolve(__dirname, 'fixtures/industry-reception-contract.v1.json'), 'utf8'),
) as Contract;

/** Cloudia の industryReceptionMarker と同じ規則。ja は最初の「。」まで、en は最初の「.」（後ろが空白か終端）まで。 */
function firstSentence(text: string, locale: 'ja' | 'en'): string {
  const found = locale === 'ja' ? /^[^。]*。/.exec(text) : /^.*?\.(?=\s|$)/.exec(text);
  return found ? found[0] : text;
}

/** この fixture の実測値。Cloudia の repo の同じ fixture とは、両方の sha256 を並べて照合する。 */
const FIXTURE_SHA256 = '7a5fb2f9e77ffec6cad4ce169d994f67d21cb3da78178d30fd4ad8cdd6d87499';

describe('industry-reception-v1 の fixture', () => {
  it('file の生バイトの sha256 が、この PR の fixture の実測値と一致する（書式の 1 バイトでも落ちる）', () => {
    const bytes = readFileSync(resolve(__dirname, 'fixtures/industry-reception-contract.v1.json'));
    const observed = createHash('sha256').update(bytes).digest('hex');
    expect(observed, `fixture sha256 expected=${FIXTURE_SHA256} observed=${observed} bytes=${bytes.length}`).toBe(FIXTURE_SHA256);
  });

  it('契約名と、業種 5 × 言語 2 の 10 行がそろっている', () => {
    expect(contract.contract).toBe('industry-reception-v1');
    expect(contract.markers).toHaveLength(10);
    for (const source of contract.sources) {
      for (const locale of ['ja', 'en']) {
        expect(contract.markers.filter((m) => m.source === source && m.locale === locale), `${source}/${locale}`).toHaveLength(1);
      }
    }
  });

  it('Worker の最初の返事の最初の一文が、fixture の marker と一致する', () => {
    for (const entry of contract.markers) {
      const slug = entry.source.replace('industry-', '') as IndustrySlug;
      const observed = firstSentence(industryStartReply(slug, '', entry.locale), entry.locale);
      expect(observed, `marker mismatch for ${entry.source}/${entry.locale}: fixture="${entry.marker}" observed="${observed}"`).toBe(entry.marker);
    }
  });

  it('source の列挙が一致する（業種 5 値、一般の 3 値 + cloudia）', () => {
    expect([...INDUSTRY_ENTRY_SOURCES], `sources fixture=${JSON.stringify(contract.sources)}`).toEqual(contract.sources);
    expect(
      [...KNOWN_ENTRY_SOURCES].sort(),
      `generic fixture=${JSON.stringify(contract.genericSources)} (+cloudia)`,
    ).toEqual([...contract.genericSources, 'cloudia'].sort());
  });

  it('文案の状態が、Worker の定数と一致する', () => {
    expect(INDUSTRY_COPY_STATUS, `copyStatus fixture="${contract.copyStatus}"`).toBe(contract.copyStatus);
  });

  it('受付言語の落とし先は ja だけ ja、それ以外（en・zh・ko・es）は en', () => {
    expect(contract.localeFallback).toEqual({ ja: 'ja', en: 'en', zh: 'en', ko: 'en', es: 'en' });
  });
});
