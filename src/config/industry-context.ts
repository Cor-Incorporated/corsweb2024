// 5 業種の一覧の正本。業種ページの URL・相談へ渡す source・トップとヘッダーの入口の並びは、ここから導く。
// 他の場所（5 言語の homeIndustries.rows、src/pages/industries/、src/pages/[lang]/industries/[industry].astro）
// との食い違いは src/config/__tests__/industry-context.test.ts が両方の値を挙げて落とす。
export const INDUSTRY_SLUGS = ['medical', 'shigyo', 'construction', 'manufacturing', 'education'] as const;
export type IndustrySlug = (typeof INDUSTRY_SLUGS)[number];

// 業種ページの title と description が入っている locale の key（meta.<key>）
export const INDUSTRY_META_KEYS = {
  medical: 'industryMedical',
  shigyo: 'industryShigyo',
  construction: 'industryConstruction',
  manufacturing: 'industryManufacturing',
  education: 'industryEducation',
} as const satisfies Record<IndustrySlug, string>;

const INDUSTRY_PATH = new RegExp(`/industries/(${INDUSTRY_SLUGS.join('|')})/?$`);

export function isIndustrySlug(value: string): value is IndustrySlug {
  return (INDUSTRY_SLUGS as readonly string[]).includes(value);
}

// ja の業種ページのパス（他の言語は getLocalizedUrl で接頭辞を付ける）
export function industryPagePath(slug: IndustrySlug): `/industries/${IndustrySlug}` {
  return `/industries/${slug}`;
}

// 業種ページの URL から、相談へ渡す source を決める。
// 5 業種の既存 CTA（industry-*）と同じ値にする。業種ページ以外は null。
export function industrySlugFromPath(pathname: string): IndustrySlug | null {
  const match = pathname.match(INDUSTRY_PATH);
  if (!match) return null;
  return match[1] as IndustrySlug;
}

export function industryContactSource(slug: IndustrySlug): `industry-${IndustrySlug}` {
  return `industry-${slug}`;
}

interface IndustryRow {
  link: string;
}

// locale の homeIndustries.rows を、正本の並びで返す。行が足りない・多い・並びが違うときは、
// どちらの値も挙げて build を止める（トップの入口とヘッダーに、片方だけの業種が出ないようにする）。
export function industryRowsInOrder<Row extends IndustryRow>(rows: readonly Row[], label: string): (Row & { slug: IndustrySlug })[] {
  const slugs = rows.map((row) => row.link.replace(/\/+$/, '').split('/').pop() ?? row.link);
  if (slugs.join(',') !== INDUSTRY_SLUGS.join(',')) {
    throw new Error(
      `${label}: homeIndustries.rows の業種 [${slugs.join(', ')}] が INDUSTRY_SLUGS [${INDUSTRY_SLUGS.join(', ')}] と違う`,
    );
  }
  return rows.map((row, index) => ({ ...row, slug: INDUSTRY_SLUGS[index] }));
}

// 公開済みの実績本文が業種を名指ししているものだけ。
// 教育: legacy-core-system-cloud-migration は「教育機関」と書いてある。
// 医療・士業・建設・製造を名指しする実績は、この一覧には無い。
export const INDUSTRY_NAMED_CASE: Partial<Record<IndustrySlug, string>> = {
  education: 'legacy-core-system-cloud-migration',
};
