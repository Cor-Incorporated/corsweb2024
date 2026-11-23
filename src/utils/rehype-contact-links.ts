/**
 * 記事の本文（Markdown）の中の問い合わせの link を、build の時にそのページの言語で業種一覧または Cloudia へ向ける rehype の部品。
 *
 * サイトの問い合わせの入口は、問い合わせページ（/contact、/<lang>/contact）を通さずチャット（/contact/chat/）へ直接向ける
 * （src/config/site.ts の getContactUrl）。記事の本文は人と CMS が書き、訳は翻訳の CI が作る。翻訳の CI は link の行き先を
 * ja と同じにそろえるので、本文に言語ごとの URL を書いても、次の訳し直しで ja の値に戻る。だから本文は今のまま
 * （`/contact?intent=…` と書いてよい）にし、行き先は描く時にそのページの言語で決める。
 *
 * 書き換えるもの:
 * - 同じ site の問い合わせページへの a の href（/contact、/<lang>/contact、末尾の /、index.html、query・hash つき）
 *   → intent があればチャット、なければ業種一覧。source は記事の種類と slug を使う。
 *   元の query から運ぶのは intent だけ。hash は落とす（チャットの画面では使わない）。
 * - 同じ site のチャット（/contact/chat/）への a の href → source と locale が無いときだけ足す（在る値は変えない）。
 * 変えないもの: 外の site の link、似た path（/contacts、/contact-us など）、code の中の文字（a ではない）、画像の src、
 * 言語と slug が分からない file（src/content の外）。
 * Cloudia を止めたときの切り戻し（isContactChatPrimary() が偽。問い合わせページにフォームが出る）の build では、
 * 何も書き換えない（本文の link は書かれたとおり問い合わせページを指す）。
 */
import { SITE_ORIGIN } from '../config/organization';
import { CLOUDIA_CHAT_PATH, isContactPagePath, normalizeSitePath } from '../config/contact-guards';
import { getContactUrl, getGeneralConsultationUrl, isContactChatPrimary } from '../config/site';
import type { Locale } from './i18n';

type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};
type AstroVFile = { path?: string; history?: string[] };

const LOCALES: readonly Locale[] = ['ja', 'en', 'zh', 'ko', 'es'];
// source の前半は、そのページの URL の区切り（ブログ /blog、実績 /works、お知らせ /news）にそろえる。
// 実績の記事の CTA（src/components/works/CaseArticle.astro）の source も works/<slug>。
const SOURCE_PREFIX: Readonly<Record<string, string>> = { blog: 'blog', cases: 'works', news: 'news' };
const CONTENT_FILE = /[\\/]src[\\/]content[\\/]([^\\/]+)[\\/]([^\\/]+)[\\/](.+)\.mdx?$/;

export type ContactLinkContext = { locale: Locale; source: string };

/** content の file の path から、その記事の言語と source（blog/<slug> など）。分からなければ null */
export function contactLinkContextOf(filePath: string | undefined): ContactLinkContext | null {
  const match = filePath?.match(CONTENT_FILE);
  if (!match) return null;
  const [, collection, locale, slug] = match;
  const prefix = SOURCE_PREFIX[collection];
  if (!prefix || !(LOCALES as readonly string[]).includes(locale)) return null;
  return { locale: locale as Locale, source: `${prefix}/${slug.replace(/\\/g, '/')}` };
}

/** a の href を、問い合わせページならチャットへ、チャットなら足りない source・locale を足して返す。変えないときは null */
export function rewriteContactHref(href: string, context: ContactLinkContext): string | null {
  const value = href.trim();
  // 同じ site の、path で書いた link だけを見る（相対の path・# だけ・mailto などは見ない）
  if (!value.startsWith('/') && !/^https?:\/\//i.test(value)) return null;
  let url: URL;
  try {
    url = new URL(value, SITE_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== SITE_ORIGIN) return null;

  if (isContactPagePath(url.pathname)) {
    const intent = url.searchParams.get('intent') ?? undefined;
    return intent
      ? getContactUrl(context.locale, { intent, source: context.source })
      : getGeneralConsultationUrl(context.locale, context.source);
  }
  if (normalizeSitePath(url.pathname) === normalizeSitePath(CLOUDIA_CHAT_PATH)) {
    const params = new URLSearchParams(url.search);
    if (params.get('source') && params.get('locale')) return null;
    if (!params.get('source')) params.set('source', context.source);
    if (!params.get('locale')) params.set('locale', context.locale);
    return `${CLOUDIA_CHAT_PATH}?${params.toString()}${url.hash}`;
  }
  return null;
}

/** 木の中の a を全部見て、書き換えた数を返す（木はその場で変える。rehype の部品の決まり） */
export function rewriteContactLinksInTree(node: HastNode, context: ContactLinkContext): number {
  let changed = 0;
  if (node.type === 'element' && node.tagName === 'a' && typeof node.properties?.href === 'string') {
    const next = rewriteContactHref(node.properties.href, context);
    if (next !== null && next !== node.properties.href) {
      node.properties.href = next;
      changed += 1;
    }
  }
  for (const child of node.children ?? []) changed += rewriteContactLinksInTree(child, context);
  return changed;
}

/**
 * 切り戻しの旗を、この部品から読む。astro.config から読み込まれたこの部品には、import.meta.env に PUBLIC_ の値が
 * 届かないことがある（旗を false にした build で、import.meta.env だけを見ると本文を書き換えてしまった）。
 * そこで build の process の環境変数も見て、どちらかが false なら書き換えない。
 */
export function chatPrimaryForBuild(): boolean {
  const fromProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.PUBLIC_CLOUDIA_CONTACT_PRIMARY_ENABLED;
  return isContactChatPrimary() && fromProcess !== 'false';
}

// unified の Transformer に代入できるよう引数は unknown で受ける（hast / vfile の型に依存しない）
export function rehypeContactLinks() {
  return (tree: unknown, file: unknown): void => {
    if (!chatPrimaryForBuild()) return;
    const vfile = file as AstroVFile;
    const context = contactLinkContextOf(vfile.path ?? vfile.history?.[0]);
    if (!context) return;
    rewriteContactLinksInTree(tree as HastNode, context);
  };
}
