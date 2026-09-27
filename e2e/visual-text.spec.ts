import { test } from '@playwright/test';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const VIEWPORTS = [
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1440', width: 1440, height: 900 },
] as const;

const DIST_ROOT = path.resolve(process.cwd(), 'dist');
const OUTPUT_ROOT = path.resolve(process.cwd(), 'test-results/visual-text');
const SCREENSHOT_ROOT = path.join(OUTPUT_ROOT, 'screenshots');
const EVIDENCE_SCREENSHOT_ROOT = path.join(OUTPUT_ROOT, 'evidence');

const EVIDENCE_SCREENSHOT_ROUTES = new Set([
  '/',
  '/en',
  '/zh',
  '/ko',
  '/es',
  '/news',
  '/news/news-static-v1',
  '/blog/ai-development-estimate-knowledge-asset',
  '/privacy',
  '/works',
]);

const FALLBACK_ROUTES = [
  '/',
  '/about',
  '/works',
  '/works/grift',
  '/contact',
  '/security',
  '/privacy',
  '/legal/tokushoho',
  '/blog',
  '/blog/ai-development-estimate-knowledge-asset',
  '/industries/medical',
  '/industries/shigyo',
  '/industries/construction',
  '/industries/manufacturing',
  '/industries/education',
  '/en',
  '/en/about',
  '/en/contact',
  '/en/security',
  '/en/privacy',
  '/en/legal/tokushoho',
  '/en/blog',
  '/zh',
  '/zh/about',
  '/zh/contact',
  '/zh/security',
  '/zh/privacy',
  '/zh/legal/tokushoho',
  '/zh/blog',
  '/ko',
  '/ko/about',
  '/ko/contact',
  '/ko/security',
  '/ko/privacy',
  '/ko/legal/tokushoho',
  '/ko/blog',
  '/es',
  '/es/about',
  '/es/contact',
  '/es/security',
  '/es/privacy',
  '/es/legal/tokushoho',
  '/es/blog',
];

type AuditIssue = {
  type: string;
  selector?: string;
  tagName?: string;
  text?: string;
  finalLine?: string;
  lineTexts?: string[];
  ratio?: number;
  lastLineWidth?: number;
  widestLineWidth?: number;
  left?: number;
  right?: number;
  scrollWidth?: number;
  clientWidth?: number;
};

type AuditObservation = {
  route: string;
  viewport: (typeof VIEWPORTS)[number]['name'];
  url?: string;
  status: number | null;
  title: string;
  scrollWidth: number | null;
  clientWidth: number | null;
  failures: AuditIssue[];
  warnings: AuditIssue[];
  screenshot?: string;
  evidenceScreenshot?: string;
};

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

function discoverRoutes(): string[] {
  const routes = collectHtmlFiles(DIST_ROOT)
    .map(htmlFileToRoute)
    .filter((route): route is string => Boolean(route))
    .filter(shouldAuditRoute);

  const discoveredRoutes = [...new Set(routes.length > 0 ? routes : FALLBACK_ROUTES)].sort((a, b) => {
    if (a === '/') return -1;
    if (b === '/') return 1;
    return a.localeCompare(b);
  });

  const routeFilter = process.env.VISUAL_TEXT_ROUTES;
  if (!routeFilter) return discoveredRoutes;

  const allowedRoutes = new Set(
    routeFilter
      .split(',')
      .map((route) => route.trim())
      .filter(Boolean),
  );

  return discoveredRoutes.filter((route) => allowedRoutes.has(route));
}

function isExpectedNotFound(route: string): boolean {
  return /^\/(?:(?:en|zh|ko|es)\/)?404$/.test(route);
}

function slugifyRoute(route: string): string {
  return route.replace(/^\//, '').replace(/[^\w-]+/g, '_') || 'home';
}

function escapeMarkdown(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').replace(/\|/g, '\\|').slice(0, 180);
}

function buildSummary(observations: AuditObservation[], routeCount: number): string {
  const failures = observations.flatMap((observation) =>
    observation.failures.map((issue) => ({ ...issue, route: observation.route, viewport: observation.viewport })),
  );
  const warnings = observations.flatMap((observation) =>
    observation.warnings.map((issue) => ({ ...issue, route: observation.route, viewport: observation.viewport })),
  );

  const lines = [
    '# Responsive visual text audit',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Routes: ${routeCount}`,
    `Viewports: ${VIEWPORTS.map((viewport) => `${viewport.width}x${viewport.height}`).join(', ')}`,
    `Observations: ${observations.length}`,
    `Failures: ${failures.length}`,
    `Warnings: ${warnings.length}`,
    '',
    '## Failures',
    '',
  ];

  if (failures.length === 0) {
    lines.push('No hard failures detected.', '');
  } else {
    lines.push('| Route | Viewport | Type | Text | Final line | Ratio |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    for (const failure of failures) {
      lines.push(
        `| ${failure.route} | ${failure.viewport} | ${failure.type} | ${escapeMarkdown(failure.text)} | ${escapeMarkdown(
          failure.finalLine,
        )} | ${failure.ratio ?? ''} |`,
      );
    }
    lines.push('');
  }

  lines.push('## Warnings');
  lines.push('');

  if (warnings.length === 0) {
    lines.push('No advisory warnings detected.', '');
  } else {
    lines.push('| Route | Viewport | Type | Text | Lines |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const warning of warnings.slice(0, 200)) {
      lines.push(
        `| ${warning.route} | ${warning.viewport} | ${warning.type} | ${escapeMarkdown(warning.text)} | ${escapeMarkdown(
          warning.lineTexts?.join(' / '),
        )} |`,
      );
    }
    if (warnings.length > 200) {
      lines.push(`| ... | ... | ... | ${warnings.length - 200} additional warnings omitted from summary.md | ... |`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

test.describe.configure({ mode: 'serial' });

test('production pages do not have hard responsive text failures', async ({ page }) => {
  const routes = discoverRoutes();
  const observations: AuditObservation[] = [];

  mkdirSync(SCREENSHOT_ROOT, { recursive: true });
  mkdirSync(EVIDENCE_SCREENSHOT_ROOT, { recursive: true });
  test.setTimeout(Math.max(180_000, routes.length * VIEWPORTS.length * 7_500));

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    for (const route of routes) {
      const response = await page.goto(route, { waitUntil: 'load', timeout: 60_000 });
      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation-duration: 0s !important;
            animation-delay: 0s !important;
            transition-duration: 0s !important;
            transition-delay: 0s !important;
            scroll-behavior: auto !important;
          }
          html.js [data-reveal] {
            opacity: 1 !important;
            transform: none !important;
          }
        `,
      });
      await page.evaluate(async () => {
        await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
      });
      await page.waitForTimeout(150);

      const status = response?.status() ?? null;
      const result = await page.evaluate(() => {
        type LineFragment = {
          text: string;
          top: number;
          bottom: number;
          left: number;
          right: number;
        };
        type MeasuredLine = {
          text: string;
          top: number;
          bottom: number;
          left: number;
          right: number;
          width: number;
        };
        type TargetIssue = AuditIssue;

        const failures: TargetIssue[] = [];
        const warnings: TargetIssue[] = [];
        const clientWidth = document.documentElement.clientWidth;
        const scrollWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0);
        const overflowAmount = scrollWidth - clientWidth;

        if (overflowAmount > 2) {
          failures.push({
            type: 'page-horizontal-overflow',
            scrollWidth,
            clientWidth,
          });
        }

        const segmenter =
          typeof (Intl as unknown as { Segmenter?: unknown }).Segmenter === 'function'
            ? new ((Intl as unknown as { Segmenter: new (_locale: string, options: { granularity: string }) => { segment: (value: string) => Iterable<{ segment: string }> } }).Segmenter)(
                document.documentElement.lang || navigator.language || 'ja',
                { granularity: 'grapheme' },
              )
            : null;

        function getGraphemes(value: string): string[] {
          if (segmenter) return [...segmenter.segment(value)].map((item) => item.segment);
          return Array.from(value);
        }

        function getLabel(element: Element): string {
          const id = element.id ? `#${element.id}` : '';
          const classes = Array.from(element.classList)
            .slice(0, 3)
            .map((className) => `.${className}`)
            .join('');
          return `${element.tagName.toLowerCase()}${id}${classes}`;
        }

        function isElementVisible(element: Element): boolean {
          if (element.closest('[data-visual-ignore-linecheck], [hidden], [aria-hidden="true"]')) return false;
          const style = window.getComputedStyle(element);
          if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
          const rect = element.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return false;
          return Boolean((element as HTMLElement).innerText?.trim() || element.textContent?.trim());
        }

        function isHiddenTextNode(node: Node): boolean {
          const parent = node.parentElement;
          if (!parent) return true;
          if (parent.closest('[hidden], [aria-hidden="true"], .sr-only, script, style, template, svg')) return true;
          const style = window.getComputedStyle(parent);
          return style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0;
        }

        function clipsTextOverflow(element: Element): boolean {
          const style = window.getComputedStyle(element);
          const lineClamp = style.getPropertyValue('-webkit-line-clamp');
          const hasLineClampClass = Array.from(element.classList).some((className) => className.startsWith('line-clamp-'));
          return (
            style.overflowX !== 'visible' ||
            style.overflowY !== 'visible' ||
            hasLineClampClass ||
            (lineClamp !== '' && lineClamp !== 'none')
          );
        }

        function isFragmentVisibleInClips(node: Node, rect: DOMRect, rootElement: Element): boolean {
          let current = node.parentElement;

          while (current) {
            if (clipsTextOverflow(current)) {
              const clipRect = current.getBoundingClientRect();
              const intersectsClip =
                rect.bottom > clipRect.top + 0.5 &&
                rect.top < clipRect.bottom - 0.5 &&
                rect.right >= clipRect.left - 2 &&
                rect.left <= clipRect.right + 2;
              if (!intersectsClip) return false;
            }

            if (current === rootElement) break;
            current = current.parentElement;
          }

          return true;
        }

        function measureLines(element: Element): MeasuredLine[] {
          const fragments: LineFragment[] = [];
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
          let node = walker.nextNode();

          while (node) {
            if (!isHiddenTextNode(node)) {
              const text = node.textContent ?? '';
              let offset = 0;

              for (const grapheme of getGraphemes(text)) {
                const nextOffset = offset + grapheme.length;
                const range = document.createRange();
                range.setStart(node, offset);
                range.setEnd(node, nextOffset);
                const rect = range.getBoundingClientRect();
                range.detach();

                if (rect.width > 0 && rect.height > 0 && isFragmentVisibleInClips(node, rect, element)) {
                  fragments.push({
                    text: grapheme,
                    top: rect.top,
                    bottom: rect.bottom,
                    left: rect.left,
                    right: rect.right,
                  });
                }

                offset = nextOffset;
              }
            }

            node = walker.nextNode();
          }

          const sortedFragments = fragments.sort((a, b) => {
            if (Math.abs(a.top - b.top) > 3) return a.top - b.top;
            return a.left - b.left;
          });

          const lines: MeasuredLine[] = [];

          for (const fragment of sortedFragments) {
            let line = lines.find((candidate) => Math.abs(candidate.top - fragment.top) <= 3);
            if (!line) {
              line = {
                text: '',
                top: fragment.top,
                bottom: fragment.bottom,
                left: fragment.left,
                right: fragment.right,
                width: fragment.right - fragment.left,
              };
              lines.push(line);
            }

            line.text += fragment.text;
            line.top = Math.min(line.top, fragment.top);
            line.bottom = Math.max(line.bottom, fragment.bottom);
            line.left = Math.min(line.left, fragment.left);
            line.right = Math.max(line.right, fragment.right);
            line.width = line.right - line.left;
          }

          return lines
            .map((line) => ({
              ...line,
              text: line.text.replace(/\s+/g, ' ').trim(),
              width: Math.max(0, line.right - line.left),
            }))
            .filter((line) => line.text.length > 0 && line.width > 0);
        }

        function isInsideHorizontalScrollContainer(element: Element): boolean {
          let current = element.parentElement;
          while (current && current !== document.documentElement) {
            const style = window.getComputedStyle(current);
            const canScroll = ['auto', 'scroll'].includes(style.overflowX);
            if (canScroll && current.scrollWidth > current.clientWidth + 2) return true;
            current = current.parentElement;
          }
          return false;
        }

        function getTerminalOrphanIssue(
          element: Element,
          lines: MeasuredLine[],
          selector: string,
          text: string,
        ): TargetIssue | null {
          if (lines.length < 2) return null;

          const widestLineWidth = Math.max(...lines.map((line) => line.width));
          const lastLine = lines[lines.length - 1];
          const ratio = widestLineWidth > 0 ? lastLine.width / widestLineWidth : 1;

          if (ratio >= 0.18) return null;

          const finalLine = lastLine.text.trim();
          const contentCharacters =
            finalLine.match(/[\p{Letter}\p{Number}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu) ?? [];
          const cjkCharacters =
            finalLine.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu) ?? [];
          const latinCharacters = finalLine.match(/[A-Za-z0-9]/g) ?? [];
          const visibleCharacters = getGraphemes(finalLine.replace(/\s+/g, ''));
          const isPunctuationOnly = contentCharacters.length === 0 && visibleCharacters.length <= 4;
          const hasTerminalPunctuation = /[、。，．！？!?）)\]」』]$/.test(finalLine);
          const isShortCjk =
            cjkCharacters.length > 0 && (contentCharacters.length <= 1 || (contentCharacters.length <= 2 && hasTerminalPunctuation));
          const isShortLatin =
            cjkCharacters.length === 0 &&
            latinCharacters.length > 0 &&
            latinCharacters.length <= 2 &&
            /[)\]]$/.test(finalLine);

          if (!isPunctuationOnly && !isShortCjk && !isShortLatin) return null;

          return {
            type: 'terminal-orphan-fragment',
            selector,
            tagName: element.tagName.toLowerCase(),
            text,
            finalLine,
            lineTexts: lines.map((line) => line.text),
            ratio: Number(ratio.toFixed(3)),
            lastLineWidth: Number(lastLine.width.toFixed(2)),
            widestLineWidth: Number(widestLineWidth.toFixed(2)),
          };
        }

        const targets = Array.from(document.querySelectorAll('h1,h2,h3,a[href],button,[role="button"]')).filter((element) => {
          if (!isElementVisible(element)) return false;
          if (element.tagName.toLowerCase() === 'a' && element.closest('h1,h2,h3')) return false;
          return true;
        });

        for (const element of targets) {
          const selector = getLabel(element);
          const text = ((element as HTMLElement).innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
          const lines = measureLines(element);
          const lineTexts = lines.map((line) => line.text);
          if (lines.length === 0) continue;

          const tagName = element.tagName.toLowerCase();
          const isHeading = ['h1', 'h2', 'h3'].includes(tagName);
          const isControl = element.matches('a[href],button,[role="button"]');

          if (!isInsideHorizontalScrollContainer(element)) {
            const outOfViewportLine = lines.find((line) => line.left < -2 || line.right > clientWidth + 2);
            if (outOfViewportLine) {
              failures.push({
                type: 'text-horizontal-viewport-escape',
                selector,
                tagName,
                text,
                lineTexts,
                left: Number(outOfViewportLine.left.toFixed(2)),
                right: Number(outOfViewportLine.right.toFixed(2)),
                clientWidth,
              });
            }
          }

          const orphanIssue = getTerminalOrphanIssue(element, lines, selector, text);
          if (orphanIssue) failures.push(orphanIssue);

          if (isHeading && lines.length >= 3) {
            warnings.push({
              type: 'heading-3plus-lines',
              selector,
              tagName,
              text,
              lineTexts,
            });
          }

          if (isHeading && lines.length >= 2 && window.getComputedStyle(element).textAlign === 'center') {
            warnings.push({
              type: 'centered-multiline-heading',
              selector,
              tagName,
              text,
              lineTexts,
            });
          }

          if (isControl && lines.length >= 2) {
            warnings.push({
              type: 'control-text-wraps',
              selector,
              tagName,
              text,
              lineTexts,
            });
          }
        }

        return {
          title: document.title,
          scrollWidth,
          clientWidth,
          failures,
          warnings,
        };
      });

      const failures = [...result.failures];
      if (status !== null && status >= 400 && !isExpectedNotFound(route)) {
        failures.unshift({ type: 'unexpected-http-status', text: String(status) });
      }

      const observation: AuditObservation = {
        route,
        viewport: viewport.name,
        url: page.url(),
        status,
        title: result.title,
        scrollWidth: result.scrollWidth,
        clientWidth: result.clientWidth,
        failures,
        warnings: result.warnings,
      };

      if (failures.length > 0) {
        const screenshotPath = path.join(SCREENSHOT_ROOT, `${viewport.name}_${slugifyRoute(route)}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        observation.screenshot = screenshotPath;
      }

      if (EVIDENCE_SCREENSHOT_ROUTES.has(route)) {
        const evidencePath = path.join(EVIDENCE_SCREENSHOT_ROOT, `${viewport.name}_${slugifyRoute(route)}.png`);
        await page.screenshot({ path: evidencePath, fullPage: true });
        observation.evidenceScreenshot = evidencePath;
      }

      observations.push(observation);
    }
  }

  mkdirSync(OUTPUT_ROOT, { recursive: true });
  writeFileSync(
    path.join(OUTPUT_ROOT, 'audit.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4322',
        routes,
        viewports: VIEWPORTS,
        observations,
      },
      null,
      2,
    ),
  );
  writeFileSync(path.join(OUTPUT_ROOT, 'summary.md'), buildSummary(observations, routes.length));

  const failureCount = observations.reduce((count, observation) => count + observation.failures.length, 0);
  if (failureCount > 0) {
    throw new Error(`Responsive visual text audit failed with ${failureCount} hard failure(s). See test-results/visual-text/summary.md.`);
  }
});
