import type { APIRoute } from 'astro';
import { buildRobotsTxt } from '../config/robots';
import { isProductionSite } from '../config/site';

// 規則の正本は src/config/robots.ts（AI クローラー許可 / /_astro/ 非拒否 / Crawl-delay なし）。
// Preview / develop チャネルは全クロール拒否（ADR-0010）。meta robots の noindex と二重化。
export const GET: APIRoute = () => {
  const robotsTxt = buildRobotsTxt({
    production: isProductionSite(),
    sitemapUrl: new URL('sitemap-index.xml', import.meta.env.SITE).href,
  });
  return new Response(robotsTxt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
