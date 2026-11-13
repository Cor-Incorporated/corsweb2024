// 業種ページの URL から、相談へ渡す source を決める。
// 5 業種の既存 CTA（industry-*）と同じ値にする。業種ページ以外は null。
export const INDUSTRY_SLUGS = ['medical', 'shigyo', 'construction', 'manufacturing', 'education'] as const;
export type IndustrySlug = (typeof INDUSTRY_SLUGS)[number];

const INDUSTRY_PATH = /\/industries\/(medical|shigyo|construction|manufacturing|education)\/?$/;

export function industrySlugFromPath(pathname: string): IndustrySlug | null {
  const match = pathname.match(INDUSTRY_PATH);
  if (!match) return null;
  return match[1] as IndustrySlug;
}

export function industryContactSource(slug: IndustrySlug): `industry-${IndustrySlug}` {
  return `industry-${slug}`;
}

// 公開済みの実績本文が業種を名指ししているものだけ。
// 教育: legacy-core-system-cloud-migration は「教育機関」と書いてある。
// 医療・士業・建設・製造を名指しする実績は、この一覧には無い。
export const INDUSTRY_NAMED_CASE: Partial<Record<IndustrySlug, string>> = {
  education: 'legacy-core-system-cloud-migration',
};
