import { readdirSync } from 'node:fs';
import path from 'node:path';

const DIST_ROOT = path.resolve(process.cwd(), 'dist');

function collectHtmlFiles(directory: string): string[] {
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

function htmlFileToRoute(filePath: string): string | null {
  const relativePath = path.relative(DIST_ROOT, filePath).split(path.sep).join('/');
  if (!relativePath.endsWith('.html')) return null;
  if (relativePath === 'index.html') return '/';
  if (relativePath.endsWith('/index.html')) {
    return `/${relativePath.slice(0, -'/index.html'.length)}`;
  }
  return `/${relativePath.slice(0, -'.html'.length)}`;
}

function shouldAuditRoute(route: string): boolean {
  return !/^\/(?:styleguide|test-blog)(?:\/|$)/.test(route);
}

/** Production HTML routes from the latest `dist/` build (sitemap parity minus dev-only paths). */
export function discoverRoutes(): string[] {
  const routes = collectHtmlFiles(DIST_ROOT)
    .map(htmlFileToRoute)
    .filter((route): route is string => Boolean(route))
    .filter(shouldAuditRoute);

  return [...new Set(routes)].sort((a, b) => {
    if (a === '/') return -1;
    if (b === '/') return 1;
    return a.localeCompare(b);
  });
}

export function isExpectedNotFoundRoute(route: string): boolean {
  return /^\/(?:(?:en|zh|ko|es)\/)?404$/.test(route);
}

export function filterRoutesByEnv(routes: string[]): string[] {
  const routeFilter = process.env.A11Y_ROUTES ?? process.env.VISUAL_TEXT_ROUTES;
  if (!routeFilter) return routes;
  const allowed = new Set(
    routeFilter
      .split(',')
      .map((route) => route.trim())
      .filter(Boolean),
  );
  return routes.filter((route) => allowed.has(route));
}