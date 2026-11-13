// 業種の提案ページのリンク先（#525）。URL と出典の並びはここに置き、文言は locale の
// industry<Name> に置く（訳で URL が変わらないように、URL と訳文を分ける）。
// sources は参考資料の番号順（本文の [n] と、CTA の後の参考資料の欄の並び）。
// 教育は参考資料の欄が無く、本文の近くのリンク（sourceLink）がこの並びを指す。
// inline は本文と参考資料の説明の中のリンク。'/' で始まるものはサイト内のページで、言語の接頭辞を付ける。
import { industryContactSource, type IndustrySlug } from '../../config/industry-context';
import { getLocalizedUrl, type Locale } from '../../utils/i18n';

export type ProposalLinks = {
  readonly sources: readonly string[];
  readonly inline: Readonly<Record<string, string>>;
};

export const PROPOSAL_LINKS = {
  education: {
    sources: [
      'https://case.dx.tohoku.ac.jp/08-jirei/',
      'https://manaba.jp/remote/',
      'https://tsumugino.jp/case/0001473/',
    ],
    inline: {},
  },
  medical: {
    sources: [
      'https://medimo.ai/case/-WX4fHHM',
      'https://www.mhlw.go.jp/content/001749829.pdf',
      'https://www.jshp.or.jp/activity/kiroku.html',
      'https://www.jshp.or.jp/activity/guideline/20260331.pdf',
      'https://www.mhlw.go.jp/stf/shingi/0000516275_00006.html',
      'https://www.mhlw.go.jp/web/t_doc?dataId=00tc7534&dataType=1&pageNo=1',
      '/company/',
      '/security/',
    ],
    inline: {
      security: '/security/',
      mhlwSystemOperation: 'https://www.mhlw.go.jp/content/10808000/001716295.pdf',
    },
  },
  shigyo: {
    sources: [
      'https://www.ht-tax.or.jp/generative-ai_utilization_guideline.php',
      'https://docs.bengo-kakumei.jp/guide/ai/document-analysis',
      'https://prtimes.jp/main/html/rd/p/000000005.000055912.html',
      '/company/',
      '/security/',
      'https://learn.microsoft.com/en-us/microsoft-365/copilot/connectors/federated-connectors-overview',
    ],
    inline: {},
  },
  construction: {
    sources: [
      'https://www.mlit.go.jp/tochi_fudousan_kensetsugyo/const/content/001851355.pdf',
      'https://andpad.jp/products/api',
      'https://spider-plus.com/functions/basic/',
      '/company/',
      'https://www.kentem.jp/product-service/sitebox/feature/',
    ],
    inline: {},
  },
  manufacturing: {
    sources: [
      'https://www.jil.go.jp/press/documents/20260527.pdf',
      'https://www.hitachi.com/ja-jp/products/digital/highlights/usecases/lumada-10th/dh260001/',
      'https://www.nedo.go.jp/koubo/CD3_100422.html',
      '/company/',
    ],
    inline: {},
  },
} as const satisfies Record<IndustrySlug, ProposalLinks>;

export function isInternalHref(href: string): boolean {
  return href.startsWith('/');
}

export function resolveProposalHref(href: string, locale: Locale): string {
  return isInternalHref(href) ? getLocalizedUrl(href, locale) : href;
}

export function isPdfHref(href: string): boolean {
  return /\.pdf(?:$|[?#])/i.test(href);
}

/**
 * 業種のページの「問い合わせ」の入口。Cloudia の画面（浮きボタンと同じ /contact/chat/）へ、業種の source を付けて進む。
 * 問い合わせページ（/contact）は経由しない。入口の部品が別に用意されたら、この関数ごと差し替える。
 */
export function industryInquiryHref(locale: Locale, industry: IndustrySlug): string {
  const params = new URLSearchParams({ source: industryContactSource(industry), locale });
  return `/contact/chat/?${params.toString()}`;
}
