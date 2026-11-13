import {
  CLOUDIA_UNAVAILABLE_COPY,
  type UnavailableLocale,
} from '../../../src/components/contact/chat/cloudiaUnavailableCopy';
import { unavailableLocale } from '../../../src/components/contact/chat/cloudiaUnavailableNotice';

/**
 * 代わりのページの見出しと同じ文（src/config/contact-guards.ts の CLOUDIA_CHAT_PLACEHOLDER_TITLES）。
 * あの file は DOM の型を使うので Worker からは import しない。同じ値であることは unavailable.test.ts が照らす。
 */
export const UNAVAILABLE_PAGE_TITLES = {
  ja: 'AIチャットを準備しています',
  en: 'The AI chat is unavailable',
} as const;

/**
 * Cloudia の画面も、サイトの代わりのページも配れないときに、/contact/chat/ でその場に返すページ。
 *
 * - 文は浮きボタンと代わりのページと同じ定義（cloudiaUnavailableCopy.ts）から読む。
 * - 見出しは代わりのページと同じ文（ja と en）。合成監視はこの見出しで「Cloudia が配られていない」と判定する。
 * - 電話の行はまだ描かない（CLOUDIA_UNAVAILABLE_PHONE_VISIBLE を true にするなら、先にここの描き方を決めて足す）。
 * - 要求の値（query など）は本文に写さない。言語は許可した 5 つから選ぶだけ。
 * - link・script・form は置かない。読み込み直せば、同じ URL のまま試し直せる。
 */
const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

export function unavailablePageLocale(rawLocale: string | null): UnavailableLocale {
  return unavailableLocale(rawLocale ?? '');
}

function heading(locale: UnavailableLocale): string | null {
  if (locale === 'ja') return UNAVAILABLE_PAGE_TITLES.ja;
  if (locale === 'en') return UNAVAILABLE_PAGE_TITLES.en;
  return null;
}

export function renderUnavailablePage(locale: UnavailableLocale): string {
  const message = escapeHtml(CLOUDIA_UNAVAILABLE_COPY[locale].unavailable);
  const title = heading(locale);
  const titleText = escapeHtml(title ?? CLOUDIA_UNAVAILABLE_COPY[locale].unavailable);
  return [
    '<!doctype html>',
    `<html lang="${locale}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="robots" content="noindex">',
    `<title>${titleText}</title>`,
    '<style>body{margin:0;font-family:system-ui,sans-serif;background:#f7f6f3;color:#1f1d1a}' +
      'main{max-width:40rem;margin:0 auto;padding:5rem 1.5rem;text-align:center}' +
      'h1{font-size:1.5rem;font-weight:500;margin:0 0 1rem}p{line-height:1.7;margin:0}</style>',
    '</head>',
    '<body>',
    '<main>',
    ...(title ? [`<h1>${escapeHtml(title)}</h1>`] : []),
    `<p>${message}</p>`,
    '</main>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
}
