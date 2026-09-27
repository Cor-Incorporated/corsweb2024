#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const FIREBASE_CONFIG = path.resolve('firebase.json');

const normalize = value => String(value ?? '').toLowerCase();

const findRoute = (headers, source) => headers.find(route => route.source === source);

const headerMap = route => {
  const map = new Map();
  for (const header of route?.headers ?? []) {
    map.set(normalize(header.key), String(header.value ?? ''));
  }
  return map;
};

const hasHeader = (headers, key, expected) => {
  const actual = headers.get(normalize(key));
  return expected instanceof RegExp ? expected.test(actual ?? '') : actual === expected;
};

const requireRouteHeader = (violations, headers, source, key, expected) => {
  const route = findRoute(headers, source);
  if (!route) {
    violations.push(`[firebase-headers] Missing headers route: ${source}`);
    return;
  }
  const routeHeaders = headerMap(route);
  if (!hasHeader(routeHeaders, key, expected)) {
    const actual = routeHeaders.get(normalize(key)) ?? '<missing>';
    violations.push(
      `[firebase-headers] ${source} ${key} expected ${expected.toString()} but found "${actual}".`
    );
  }
};

const requireNoRouteHeader = (violations, headers, source, key) => {
  const route = findRoute(headers, source);
  if (!route) return;
  const routeHeaders = headerMap(route);
  if (routeHeaders.has(normalize(key))) {
    violations.push(`[firebase-headers] ${source} must not set ${key}; cache policy belongs to specific routes.`);
  }
};

const routeMatches = (source, requestPath) => {
  if (source === '**') return true;
  if (source === '/') return requestPath === '/';
  if (source === '**/') return requestPath.endsWith('/');
  if (source === '/images/blog/uploads/**') return requestPath.startsWith('/images/blog/uploads/');
  // 自前ホストのフォント（KaTeX 等。/_astro/ にハッシュ付きで出力）も JS/CSS と同じく immutable
  if (source === '**/*.@(js|css|woff|woff2|ttf)') return /\.(js|css|woff|woff2|ttf)$/i.test(requestPath);
  if (source === '**/*.@(jpg|jpeg|png|gif|webp|avif|svg)') {
    return /\.(jpg|jpeg|png|gif|webp|avif|svg)$/i.test(requestPath);
  }
  if (source === '**/*.html') return /\.html$/i.test(requestPath);
  if (source === '**/*.@(json|xml|txt|svg)') return /\.(json|xml|txt|svg)$/i.test(requestPath);
  return false;
};

const effectiveHeadersFor = (headers, requestPath) => {
  const effective = new Map();
  for (const route of headers) {
    if (!routeMatches(route.source, requestPath)) continue;
    for (const header of route.headers ?? []) {
      effective.set(normalize(header.key), String(header.value ?? ''));
    }
  }
  return effective;
};

const requireEffectiveHeader = (violations, headers, requestPath, key, expected) => {
  const effective = effectiveHeadersFor(headers, requestPath);
  if (!hasHeader(effective, key, expected)) {
    const actual = effective.get(normalize(key)) ?? '<missing>';
    violations.push(
      `[firebase-headers] effective ${requestPath} ${key} expected ${expected.toString()} but found "${actual}".`
    );
  }
};

const main = async () => {
  const raw = await readFile(FIREBASE_CONFIG, 'utf8');
  const config = JSON.parse(raw);
  const headers = config?.hosting?.headers;
  const violations = [];

  if (!Array.isArray(headers)) {
    throw new Error('[firebase-headers] hosting.headers must be an array.');
  }

  requireNoRouteHeader(violations, headers, '**', 'Cache-Control');
  requireRouteHeader(violations, headers, '**', 'X-Content-Type-Options', 'nosniff');
  requireRouteHeader(
    violations,
    headers,
    '**',
    'Referrer-Policy',
    'strict-origin-when-cross-origin'
  );
  requireRouteHeader(violations, headers, '**', 'X-Frame-Options', 'DENY');

  requireRouteHeader(violations, headers, '/', 'Cache-Control', /no-cache/);
  requireRouteHeader(violations, headers, '/', 'Pragma', 'no-cache');
  requireRouteHeader(violations, headers, '/', 'Expires', '0');
  requireRouteHeader(violations, headers, '**/', 'Cache-Control', /no-cache/);
  requireRouteHeader(violations, headers, '**/', 'Pragma', 'no-cache');
  requireRouteHeader(violations, headers, '**/', 'Expires', '0');
  requireRouteHeader(violations, headers, '**/*.html', 'Cache-Control', /no-cache/);
  requireRouteHeader(violations, headers, '**/*.html', 'Pragma', 'no-cache');
  requireRouteHeader(violations, headers, '**/*.html', 'Expires', '0');

  requireRouteHeader(violations, headers, '**/*.@(js|css|woff|woff2|ttf)', 'Cache-Control', /immutable/);
  requireRouteHeader(
    violations,
    headers,
    '**/*.@(jpg|jpeg|png|gif|webp|avif|svg)',
    'Cache-Control',
    /immutable/
  );
  requireRouteHeader(violations, headers, '/images/blog/uploads/**', 'X-Content-Type-Options', 'nosniff');

  const samplePaths = ['/', '/blog/', '/blog/index.html', '/assets/app.js', '/og/page/home.png', '/sitemap-index.xml'];
  for (const requestPath of samplePaths) {
    requireEffectiveHeader(violations, headers, requestPath, 'X-Content-Type-Options', 'nosniff');
    requireEffectiveHeader(violations, headers, requestPath, 'Referrer-Policy', 'strict-origin-when-cross-origin');
    requireEffectiveHeader(violations, headers, requestPath, 'X-Frame-Options', 'DENY');
  }
  requireEffectiveHeader(violations, headers, '/', 'Cache-Control', /no-cache/);
  requireEffectiveHeader(violations, headers, '/blog/', 'Cache-Control', /no-cache/);
  requireEffectiveHeader(violations, headers, '/blog/index.html', 'Cache-Control', /no-cache/);
  requireEffectiveHeader(violations, headers, '/assets/app.js', 'Cache-Control', /immutable/);
  for (const font of ['/_astro/KaTeX_Main-Regular.B22Nviop.woff2', '/_astro/KaTeX_Main-Regular.Dr94JaBh.woff', '/_astro/KaTeX_Main-Regular.ypZvNtVU.ttf']) {
    requireEffectiveHeader(violations, headers, font, 'Cache-Control', /immutable/);
  }
  requireEffectiveHeader(violations, headers, '/og/page/home.png', 'Cache-Control', /immutable/);
  requireEffectiveHeader(violations, headers, '/sitemap-index.xml', 'Cache-Control', /max-age=86400/);

  const allHeaders = headers.flatMap(route => route.headers ?? []);
  const csp = allHeaders.find(header => normalize(header.key) === 'content-security-policy');
  const reportOnly = allHeaders.find(
    header => normalize(header.key) === 'content-security-policy-report-only'
  );
  if (csp) {
    console.log('[firebase-headers][csp] enforcing CSP is configured; audit only checks presence here.');
  } else if (reportOnly) {
    console.log('[firebase-headers][csp] report-only CSP is configured.');
  } else {
    console.log('[firebase-headers][csp] planned: no Firebase CSP header is enforced by this baseline.');
  }

  if (violations.length > 0) {
    throw new Error(violations.join('\n'));
  }

  console.log('[firebase-headers] firebase.json passed baseline header audit.');
};

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
