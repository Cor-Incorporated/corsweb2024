// @vitest-environment node
// 右下の浮きボタンの開く前の文字（cloudia-launcher-copy.ts の label・title）と、業界 page の
// CTA の button の文字（locales の industryXxx.proposal.cta.primary）は、同じ文字を 2 か所で定義している。
// 片方だけ直って食い違わないよう、ここで機械的に結ぶ（食い違う写しで赤になる事は写しの試験で確認する）。
// あわせて、ボタンの文字（浮きボタンの開く前と開いている間・業界 page の CTA・/contact/ の入口）から受付 AI の名前が消えている事を残す。
// 本文・法務の文（locales の proposal.cta.body など、AI 受付を説明する文）は対象外で、名前は残る。
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LAUNCHER_COPY } from '../cloudia-launcher-copy';

const here = dirname(fileURLToPath(import.meta.url));

const LOCALES = ['ja', 'en', 'zh', 'ko', 'es'] as const;
const INDUSTRY_KEYS = [
  'industryMedical',
  'industryShigyo',
  'industryConstruction',
  'industryManufacturing',
  'industryEducation',
] as const;

type IndustryCopy = { proposal: { cta: { primary: string } } };

function loadIndustryPrimary(
  locale: (typeof LOCALES)[number],
  key: (typeof INDUSTRY_KEYS)[number]
): string {
  const localeJson = JSON.parse(
    readFileSync(join(here, '../../../i18n/locales', `${locale}.json`), 'utf8')
  ) as Record<string, IndustryCopy>;
  const section = localeJson[key];
  if (!section) throw new Error(`${key} が ${locale}.json に見つからない`);
  return section.proposal.cta.primary;
}

// /contact/ の入口の部品の文字は .astro の中にあるので、source から取り出す。
// 説明文（description）は受付 AI を説明する文で対象外のため、eyebrow・title・cta だけを数える。
function loadEntryCopyValues(): string[] {
  const source = readFileSync(join(here, '../CloudiaContactEntry.astro'), 'utf8');
  const block = source.split('const ENTRY_COPY = {')[1]?.split('} as const')[0] ?? '';
  const values: string[] = [];
  const pattern = /(?:eyebrow|title|cta): '([^']*)'/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(block)) !== null) values.push(match[1]);
  expect(values).toHaveLength(LOCALES.length * 3);
  return values;
}

describe('Cloudia のボタンの文字（浮きボタンの開く前と開いている間・業界 page の CTA・/contact/ の入口）', () => {
  for (const locale of LOCALES) {
    it(`${locale}: 浮きボタンの開く前の文字（label・title）が 5 つの業界 page の CTA と同じ文字`, () => {
      const launcher = LAUNCHER_COPY[locale];
      expect(launcher.label).toBe(launcher.title);
      for (const key of INDUSTRY_KEYS) {
        expect(loadIndustryPrimary(locale, key)).toBe(launcher.label);
      }
    });
  }

  it('ボタンの文字（浮きボタンの開く前と開いている間・業界 page の CTA・/contact/ の入口）に受付 AI の名前を含まない', () => {
    const buttonCopy: string[] = [];
    for (const locale of LOCALES) {
      const launcher = LAUNCHER_COPY[locale];
      buttonCopy.push(launcher.label, launcher.title, launcher.closeLauncher);
      for (const key of INDUSTRY_KEYS) buttonCopy.push(loadIndustryPrimary(locale, key));
    }
    buttonCopy.push(...loadEntryCopyValues());
    expect(buttonCopy).toHaveLength(5 * (3 + 5) + 15);
    for (const value of buttonCopy) expect(value, JSON.stringify(value)).not.toMatch(/Cloudia/);
  });
});
