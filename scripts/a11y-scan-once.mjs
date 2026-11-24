#!/usr/bin/env node
/**
 * One-off axe scan over dist routes (run with preview:ci up).
 * Usage: node scripts/a11y-scan-once.mjs [--limit N] [--route /path/]
 */
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readdirSync } from 'node:fs';
import path from 'node:path';

const DIST_ROOT = path.resolve(process.cwd(), 'dist');
const baseURL = process.env.A11Y_BASE_URL ?? 'http://127.0.0.1:4322';

function collectHtmlFiles(directory) {
  try {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectHtmlFiles(fullPath);
      return entry.isFile() && entry.name.endsWith('.html') ? [fullPath] : [];
    });
  } catch {
    return [];
  }
}

function htmlFileToRoute(filePath) {
  const relativePath = path.relative(DIST_ROOT, filePath).split(path.sep).join('/');
  if (!relativePath.endsWith('.html')) return null;
  if (relativePath === 'index.html') return '/';
  if (relativePath.endsWith('/index.html')) {
    return `/${relativePath.slice(0, -'/index.html'.length)}`;
  }
  return `/${relativePath.slice(0, -'.html'.length)}`;
}

function discoverRoutes() {
  const routes = collectHtmlFiles(DIST_ROOT)
    .map(htmlFileToRoute)
    .filter((route) => Boolean(route))
    .filter((route) => !/^\/(?:styleguide|test-blog)(?:\/|$)/.test(route));
  return [...new Set(routes)].sort((a, b) => {
    if (a === '/') return -1;
    if (b === '/') return 1;
    return a.localeCompare(b);
  });
}

const limitArg = process.argv.indexOf('--limit');
const limit = limitArg >= 0 ? Number.parseInt(process.argv[limitArg + 1], 10) : undefined;
const routeArg = process.argv.indexOf('--route');
const singleRoute = routeArg >= 0 ? process.argv[routeArg + 1] : undefined;

let routes = discoverRoutes();
if (singleRoute) routes = routes.filter((r) => r === singleRoute || r.startsWith(singleRoute));
if (limit) routes = routes.slice(0, limit);

const byRule = new Map();
const byRoute = [];

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  reducedMotion: 'reduce',
});

for (const route of routes) {
  const page = await context.newPage();
  try {
    const url = `${baseURL}${route}`;
    const response = await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
    if (response?.status() === 404 && /\/404$/.test(route)) {
      await page.close();
      continue;
    }
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          transition-duration: 0s !important;
        }
        html.js [data-reveal] { opacity: 1 !important; transform: none !important; }
      `,
    });
    await page.evaluate(async () => {
      await document.fonts?.ready;
    });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    const serious = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    const moderate = results.violations.filter((v) => v.impact === 'moderate');

    if (serious.length > 0 || moderate.length > 0) {
      byRoute.push({ route, serious: serious.map((v) => v.id), moderate: moderate.map((v) => v.id) });
    }
    for (const v of [...serious, ...moderate]) {
      const entry = byRule.get(v.id) ?? { id: v.id, impact: v.impact, routes: [] };
      entry.routes.push(route);
      byRule.set(v.id, entry);
    }
  } catch (error) {
    byRoute.push({ route, error: String(error) });
  }
  await page.close();
}

await browser.close();

console.log(JSON.stringify({ scanned: routes.length, ruleCount: byRule.size, byRule: [...byRule.values()], byRoute }, null, 2));