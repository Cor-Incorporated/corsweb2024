// 業種のページで、#525 の本文（locale の industry<Name>.proposal、ProposalPage）を描く言語。
// 一覧に無い言語のページは、旧い本文（industry<Name> の hero・challenges・support・cta、*Body.astro）を描く。
// ja は外さない（ja の 5 ページ src/pages/industries/*.astro は ProposalPage だけを描く）。
import type { Locale } from '../../utils/i18n';

export const PROPOSAL_LOCALES: readonly Locale[] = ['ja', 'en', 'zh', 'ko', 'es'];

export function isProposalLocale(locale: string): locale is Locale {
  return (PROPOSAL_LOCALES as readonly string[]).includes(locale);
}
