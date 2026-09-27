/**
 * robots.txt の正本（H1）。src/pages/robots.txt.ts から呼ぶ。
 *
 * - AI クローラーは検索・回答・学習のいずれの用途も許可する（CEO 決定 2026-09-27）。
 * - /_astro/ は拒否しない。拒否すると Google がページ描画に使う JS/CSS を取得できない。
 * - Crawl-delay は書かない（Google は無視し、Bing 等はクロール頻度が落ちるだけ）。
 * - 個別 UA のグループは `*` の規則を引き継がない（RFC 9309: 最も具体的に一致したグループだけ
 *   を使う）。そのため、AI クローラーのグループにも `*` と同じ規則を同じ配列から出力する。
 */

export const AI_CRAWLER_USER_AGENTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'meta-externalagent',
  'Amazonbot',
] as const;

/** 全クローラー共通で拒否するパス（管理・API・プレビュー・外部サイトのリンクカード画像キャッシュ）。 */
export const DISALLOWED_PATHS = [
  '/admin/',
  '/blog-admin/',
  '/dashboard/',
  '/api/',
  '/preview/',
  '/remark-link-card-plus/',
] as const;

export type RobotsTxtOptions = {
  /** production 以外（preview / develop）は全拒否（ADR-0010）。 */
  production: boolean;
  sitemapUrl: string;
};

export function buildRobotsTxt({ production, sitemapUrl }: RobotsTxtOptions): string {
  if (!production) {
    return ['User-agent: *', 'Disallow: /'].join('\n');
  }
  const rules = ['Allow: /', ...DISALLOWED_PATHS.map((path) => `Disallow: ${path}`)];
  return [
    '# AI crawlers (search, answers and training) are explicitly allowed.',
    ...AI_CRAWLER_USER_AGENTS.map((agent) => `User-agent: ${agent}`),
    ...rules,
    '',
    'User-agent: *',
    ...rules,
    '',
    `Sitemap: ${sitemapUrl}`,
  ].join('\n');
}
