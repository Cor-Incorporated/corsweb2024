import type { IndustrySlug, TrafficReading } from './industry-context';
import { INDUSTRY_SLUGS } from './industry-context';

/**
 * 受付の入口の文脈。業種と元のページの path は、許可した source からサーバーが決める。
 * ブラウザが送った path の文字列はここでは読まない（任意の文字列を記録に入れない）。
 *
 * 業種のページの path は、言語の接頭辞の無い形（`/industries/<業種>/`）で持つ。
 * 応対の言語は ja と en だけなので、ページの言語は応対の言語から決められない。
 */
export interface InquiryEntryContext {
  industry: IndustrySlug | '';
  entryPath: string;
}

export const EMPTY_ENTRY_CONTEXT: InquiryEntryContext = { industry: '', entryPath: '' };

export function industryPagePath(industry: IndustrySlug): string {
  return `/industries/${industry}/`;
}

export function entryContextFromTraffic(traffic: TrafficReading): InquiryEntryContext {
  if (traffic.kind !== 'industry') return EMPTY_ENTRY_CONTEXT;
  return { industry: traffic.industry, entryPath: industryPagePath(traffic.industry) };
}

/** 保存した列を読み戻す。知らない業種や、業種と合わない path は空にする。 */
export function readStoredEntryContext(row: { industry?: unknown; entry_path?: unknown }): InquiryEntryContext {
  const industry = typeof row.industry === 'string'
    && (INDUSTRY_SLUGS as readonly string[]).includes(row.industry)
    ? (row.industry as IndustrySlug)
    : '';
  if (!industry) return EMPTY_ENTRY_CONTEXT;
  const entryPath = row.entry_path === industryPagePath(industry) ? industryPagePath(industry) : '';
  return { industry, entryPath };
}
