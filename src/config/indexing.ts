/**
 * インデックス制御の正本（M3 / L1）。
 *
 * meta robots（Layout.astro）と sitemap の filter（astro.config.mjs）の両方がこのモジュールを読む。
 * 「noindex なのに sitemap に載っている」「sitemap から外したのに index のまま」というずれを、
 * 判定を 1 か所に置くことで構造的に防ぐ。
 */

const LOCALE_PREFIX = '(?:/(?:en|zh|ko|es))?';

/** 検索結果に出す価値が無い（薄い・重複・利用者向けでない）ページ。noindex, follow にする。 */
const NOINDEX_PATTERNS: readonly RegExp[] = [
  // タグ一覧: ja 76 タグ中 66 が記事 1 本だけの薄いページで、sitemap の過半を占めていた
  new RegExp(`^${LOCALE_PREFIX}/blog/tags(?:/|$)`),
  // 検証用ページ・決済コールバック・404（ロケール直下のみ。/blog/test-blog-xxx 等の記事は対象外）
  new RegExp(`^${LOCALE_PREFIX}/(?:test-blog|styleguide|tip-success|tip-cancelled|404)(?:/|\\.html)?$`),
  // Cloudia チャット本体（ランチャーの iframe 埋め込み先 / フォールバック）。検索の入口は /contact
  new RegExp(`^${LOCALE_PREFIX}/contact/chat(?:/|$)`),
];

/** ページではない公開パス（sitemap に載せない）。 */
const NON_PAGE_PATTERNS: readonly RegExp[] = [/^\/api\//, /^\/_astro\//, /^\/remark-link-card-plus\//];

function decodePath(pathname: string): string {
  try {
    return decodeURI(pathname);
  } catch {
    return pathname;
  }
}

/** このパスのページを noindex にするか。 */
export function isNoindexPath(pathname: string): boolean {
  const path = decodePath(pathname);
  return NOINDEX_PATTERNS.some((pattern) => pattern.test(path));
}

/** sitemap に載せるか（@astrojs/sitemap の filter に渡す。引数は絶対 URL）。 */
export function includeInSitemap(pageUrl: string): boolean {
  const { pathname } = new URL(pageUrl);
  return !NON_PAGE_PATTERNS.some((pattern) => pattern.test(pathname)) && !isNoindexPath(pathname);
}
