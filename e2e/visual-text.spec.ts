import { test, type Page } from '@playwright/test';
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

// 広い画面で、page の型ごとに main の箱の位置を見る。
// - LP の page: main の container の左端・右端が header の container と揃う（rail = 80rem）。
// - 読み物の page: main の中の .mx-auto の箱が 48rem の列に揃い、画面の中央に在る。
// あわせて、main の中の table が横 scroll の wrapper の幅を埋めているかも見る
//（罫線が page の半分で切れて見えないように）。
const LAYOUT_RAIL_VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'desktop-1920', width: 1920, height: 1080 },
] as const;

const LP_RAIL_ROUTES = ['/services/ai-development/', '/en/'] as const;
const READING_RAIL_ROUTES = [
  '/industries/medical/',
  '/security/',
  '/blog/ai-development-estimate-knowledge-asset/',
  '/legal/tokushoho/',
  '/company/',
] as const;

const RAIL_TOLERANCE_PX = 2;
const READING_MAX_WIDTH_PX = 768;

type RailMeasurement = {
  name: string;
  left: number;
  right: number;
  width: number;
};

async function settlePage(page: Page, route: string): Promise<void> {
  await page.goto(route, { waitUntil: 'load', timeout: 60_000 });
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
}

async function measureLayout(page: Page) {
  return page.evaluate(() => {
    const describe = (element: Element): string => {
      const className = Array.from(element.classList)
        .filter((name) => name.startsWith('max-w-') || name === 'mx-auto' || name === 'prose')
        .slice(0, 3)
        .join('.');
      return `${element.tagName.toLowerCase()}${className ? `.${className}` : ''}`;
    };
    const contentBox = (element: Element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
      const paddingRight = Number.parseFloat(style.paddingRight) || 0;
      return {
        left: rect.left + paddingLeft,
        right: rect.right - paddingRight,
        width: rect.width - paddingLeft - paddingRight,
      };
    };

    const headerContainer = document.querySelector('header .mx-auto');
    const header = headerContainer
      ? { name: `header ${describe(headerContainer)}`, ...contentBox(headerContainer) }
      : null;

    const seen = new Set<Element>();
    const rails: RailMeasurement[] = [];
    const add = (element: Element) => {
      if (seen.has(element)) return;
      seen.add(element);
      if (element.closest('[hidden], [aria-hidden="true"], template, script, style')) return;
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      const box = contentBox(element);
      if (box.width <= 0) return;
      rails.push({ name: describe(element), ...box });
    };

    document.querySelectorAll('main .mx-auto').forEach(add);
    document.querySelectorAll('main .prose').forEach(add);

    const tables = Array.from(document.querySelectorAll('main table')).map((table) => ({
      width: table.getBoundingClientRect().width,
      parentClientWidth: table.parentElement ? table.parentElement.clientWidth : 0,
    }));

    return { header, rails, tables, center: document.documentElement.clientWidth / 2 };
  });
}

function railRows(reference: RailMeasurement, rails: readonly RailMeasurement[]): string {
  return [reference, ...rails]
    .map(
      (rail) =>
        `  ${rail.name}: left=${rail.left.toFixed(1)} right=${rail.right.toFixed(1)} width=${rail.width.toFixed(1)}`,
    )
    .join('\n');
}

test('main content rails follow the page type on wide screens', async ({ page }) => {
  test.setTimeout(240_000);
  const failures: string[] = [];

  for (const viewport of LAYOUT_RAIL_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    for (const route of LP_RAIL_ROUTES) {
      await settlePage(page, route);
      const result = await measureLayout(page);
      if (!result.header) {
        failures.push(`${viewport.name} ${route}: header の container が見つからない`);
        continue;
      }
      const mismatched = result.rails.filter(
        (rail) =>
          Math.abs(rail.left - result.header!.left) > RAIL_TOLERANCE_PX ||
          Math.abs(rail.right - result.header!.right) > RAIL_TOLERANCE_PX,
      );
      if (mismatched.length > 0) {
        failures.push(
          `${viewport.name} ${route}: ${mismatched.length} rail(s) differ from header by more than ${RAIL_TOLERANCE_PX}px\n${railRows(result.header, result.rails)}`,
        );
      }
      const narrowTables = result.tables.filter((table) => table.width < table.parentClientWidth - 2);
      if (narrowTables.length > 0) {
        const example = narrowTables[0];
        failures.push(
          `${viewport.name} ${route}: ${narrowTables.length} table(s) narrower than the scroll wrapper (e.g. width=${example.width.toFixed(1)} < parent clientWidth - 2=${(example.parentClientWidth - 2).toFixed(1)})`,
        );
      }
    }

    for (const route of READING_RAIL_ROUTES) {
      await settlePage(page, route);
      const result = await measureLayout(page);
      if (result.rails.length === 0) {
        failures.push(`${viewport.name} ${route}: main の中に .mx-auto の箱が無い`);
        continue;
      }
      const first = result.rails[0];
      const misaligned = result.rails.filter(
        (rail) =>
          Math.abs(rail.left - first.left) > RAIL_TOLERANCE_PX || Math.abs(rail.right - first.right) > RAIL_TOLERANCE_PX,
      );
      if (misaligned.length > 0) {
        failures.push(
          `${viewport.name} ${route}: ${misaligned.length} box(es) do not share the reading column\n${railRows(first, result.rails)}`,
        );
      }
      const offCenter = result.rails.filter(
        (rail) => Math.abs(rail.left + rail.width / 2 - result.center) > RAIL_TOLERANCE_PX,
      );
      if (offCenter.length > 0) {
        failures.push(
          `${viewport.name} ${route}: ${offCenter.length} box(es) are off the screen center by more than ${RAIL_TOLERANCE_PX}px (center=${result.center.toFixed(1)})\n${railRows(first, result.rails)}`,
        );
      }
      const tooWide = result.rails.filter((rail) => rail.width > READING_MAX_WIDTH_PX + 0.5);
      if (tooWide.length > 0) {
        failures.push(
          `${viewport.name} ${route}: ${tooWide.length} box(es) wider than ${READING_MAX_WIDTH_PX}px\n${railRows(first, result.rails)}`,
        );
      }
      const narrowTables = result.tables.filter((table) => table.width < table.parentClientWidth - 2);
      if (narrowTables.length > 0) {
        const example = narrowTables[0];
        failures.push(
          `${viewport.name} ${route}: ${narrowTables.length} table(s) narrower than the scroll wrapper (e.g. width=${example.width.toFixed(1)} < parent clientWidth - 2=${(example.parentClientWidth - 2).toFixed(1)})`,
        );
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(`main content rails do not follow the page type:\n${failures.join('\n\n')}`);
  }
});

// 文が 1 行に収まるかを、字数ではなく実際の幅で見る。
// font の違う環境（CI の Linux など）では、同じ字数でも英数字や等幅の字の幅が広い。
// 字数で決めると、実際には箱に収まらない文を「1 行のはず」と誤って数える。
// この関数を page.evaluate で仕込み、業種別の page と読み物の page の試験で使い回す。
type LineBreakProbe = {
  lineCount: (element: Element) => number;
  unwrappedWidth: (element: Element) => number;
  contentWidth: (element: Element) => number;
  sentenceFailures: () => string[];
  judgedCount: () => number;
};

declare global {
  interface Window {
    __lineBreakProbe?: LineBreakProbe;
  }
}

function installLineBreakProbe(): void {
  // 行の数は、要素の高さを行の高さで割って数える。inline の code は、同じ行でも
  // 上下の padding で Range の top が 9px ずれる事があり、top を 8px でまとめる数え方だと
  // 1 行を 2 行と誤る。手で入れた <br> は折り返しではないので、その数だけ引く。
  const lineCount = (element: Element): number => {
    const manualBreaks = element.querySelectorAll('br').length;
    const style = window.getComputedStyle(element);
    const lineHeight = Number.parseFloat(style.lineHeight);
    const height = element.getBoundingClientRect().height;
    if (Number.isFinite(lineHeight) && lineHeight > 0 && height > 0) {
      return Math.max(1, Math.round(height / lineHeight) - manualBreaks);
    }
    const range = document.createRange();
    range.selectNodeContents(element);
    const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
    const tops: number[] = [];
    for (const rect of rects) {
      if (!tops.some((top) => Math.abs(top - rect.top) <= 8)) tops.push(rect.top);
    }
    range.detach();
    return Math.max(1, tops.length - manualBreaks);
  };

  // 折り返さない時の幅。複製を不可視・nowrap で親に置いて測り、終わったら必ず消す
  // （元の要素の見た目は変えない）。手で入れた <br> は、折り返さない時の幅を測るため
  // 空白に置き換える（<br> を残すと、複製の幅が長い方の行だけになる）。
  const unwrappedWidth = (element: Element): number => {
    const clone = element.cloneNode(true) as HTMLElement;
    for (const br of Array.from(clone.querySelectorAll('br'))) br.replaceWith(' ');
    clone.style.position = 'absolute';
    clone.style.visibility = 'hidden';
    clone.style.whiteSpace = 'nowrap';
    clone.style.maxWidth = 'none';
    clone.style.width = 'auto';
    clone.style.display = 'inline-block';
    element.parentElement?.appendChild(clone);
    const width = clone.getBoundingClientRect().width;
    clone.remove();
    return width;
  };

  // 文を置く箱（親）の中身の幅。文字が流れるのは padding と border の内側だけなので、
  // 親の矩形から左右の padding と border を引く。clientWidth は整数に丸めて返すので使わない
  // （丸めた値と、折り返さない時の幅の小数が、境界でどちらにも転ぶ）。
  const contentWidth = (element: Element): number => {
    const parent = element.parentElement;
    if (!parent) return document.documentElement.clientWidth;
    const style = window.getComputedStyle(parent);
    const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
    const paddingRight = Number.parseFloat(style.paddingRight) || 0;
    const borderLeft = Number.parseFloat(style.borderLeftWidth) || 0;
    const borderRight = Number.parseFloat(style.borderRightWidth) || 0;
    return (
      parent.getBoundingClientRect().width - paddingLeft - paddingRight - borderLeft - borderRight
    );
  };

  // 折り返さない時の幅が箱より 1px 以上小さい文だけを「1 行のはず」とし、2 行以上なら落とす。
  // 箱との差が 1px 未満の文は、丸めでどちらにも転ぶので判定から外す（箱より広い文も、
  // 折り返して当然なので同じく外す）。判定した文が 0 個の route は、測り方が空振りしているので落とす。
  const sentenceFailures = (): string[] => {
    const failures: string[] = [];
    let judged = 0;
    const sentences = Array.from(document.querySelectorAll('.lb-sentence'));
    if (sentences.length === 0) failures.push('.lb-sentence が 1 つも無い');
    for (const sentence of sentences) {
      const text = (sentence.textContent ?? '').replace(/\s+/g, '');
      if (text.length === 0) continue;
      const box = contentWidth(sentence);
      const nowrapWidth = unwrappedWidth(sentence);
      if (nowrapWidth > box - 1) continue;
      judged += 1;
      const lines = lineCount(sentence);
      if (lines !== 1) {
        const chars = Array.from(text).length;
        const style = window.getComputedStyle(sentence);
        const lineHeight = Number.parseFloat(style.lineHeight);
        const height = sentence.getBoundingClientRect().height;
        const lineHeightText =
          Number.isFinite(lineHeight) && lineHeight > 0 ? `${lineHeight.toFixed(1)}px` : '取れない';
        failures.push(
          `文が 1 行に収まらない（${lines} 行 = 高さ ${height.toFixed(1)}px ÷ 行 ${lineHeightText}。幅 ${nowrapWidth.toFixed(1)}px / 箱 ${box.toFixed(1)}px、${chars} 字）: ${text.slice(0, 40)}`,
        );
      }
    }
    if (judged === 0) failures.push('「1 行のはず」と判定した文が 0 個（幅の測り方が空振りしている）');
    return failures;
  };

  // route ごとに「1 行のはず」と判定した文の数（報告用。合否は sentenceFailures が見る）。
  const judgedCount = (): number => {
    let judged = 0;
    for (const sentence of Array.from(document.querySelectorAll('.lb-sentence'))) {
      const text = (sentence.textContent ?? '').replace(/\s+/g, '');
      if (text.length === 0) continue;
      if (unwrappedWidth(sentence) > contentWidth(sentence) - 1) continue;
      judged += 1;
    }
    return judged;
  };

  window.__lineBreakProbe = { lineCount, unwrappedWidth, contentWidth, sentenceFailures, judgedCount };
}

// 題の塊と文が、意味の区切りでだけ折れているかを見る（docs/design/layout-rules.md の R1・R2）。
// 幅 1440 と 1920 の業種別の page。空振りしないよう、.lb-sentence と h1 が無ければ落とす。
const LINE_BREAK_VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'desktop-1920', width: 1920, height: 1080 },
] as const;

const LINE_BREAK_ROUTES = ['/industries/medical/', '/industries/construction/'] as const;

test('industry headings and sentences break at meaning boundaries (line breaks)', async ({ page }) => {
  test.setTimeout(240_000);
  const failures: string[] = [];

  for (const viewport of LINE_BREAK_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    for (const route of LINE_BREAK_ROUTES) {
      await settlePage(page, route);
      await page.evaluate(installLineBreakProbe);
      const issues = await page.evaluate(() => {
        const failures: string[] = [];
        const probe = window.__lineBreakProbe;
        if (!probe) return ['折り返しを測る関数が仕込まれていない'];

        const heading = document.querySelector('h1');
        if (!heading) failures.push('h1 が無い');

        const h1Clauses = Array.from(document.querySelectorAll('h1 .lb-clause'));
        if (h1Clauses.length < 2) {
          failures.push(`h1 の塊が ${h1Clauses.length} 個（2 個以上のはず）: ${heading?.textContent?.trim() ?? ''}`);
        }

        const headingClauses = Array.from(document.querySelectorAll('h1 .lb-clause, h2 .lb-clause'));
        if (headingClauses.length === 0) failures.push('題の塊（.lb-clause）が 1 つも無い');
        for (const clause of headingClauses) {
          const box = probe.contentWidth(clause);
          if (probe.unwrappedWidth(clause) > box + 1) continue; // 箱より長い塊は除く
          const lines = probe.lineCount(clause);
          if (lines !== 1) {
            const style = window.getComputedStyle(clause);
            const lineHeight = Number.parseFloat(style.lineHeight);
            const height = clause.getBoundingClientRect().height;
            const lineHeightText =
              Number.isFinite(lineHeight) && lineHeight > 0 ? `${lineHeight.toFixed(1)}px` : '取れない';
            failures.push(
              `題の塊が ${lines} 行に割れている（高さ ${height.toFixed(1)}px ÷ 行 ${lineHeightText}）: ${(clause.textContent ?? '').slice(0, 40)}`,
            );
          }
        }

        failures.push(...probe.sentenceFailures());

        const bodyBoxes = Array.from(
          document.querySelectorAll('main [data-proposal-hero] p.type-copy, main [data-proposal-body] p.type-copy, main [data-proposal-cta] p'),
        );
        for (const paragraph of bodyBoxes) {
          const style = window.getComputedStyle(paragraph);
          const fontSize = Number.parseFloat(style.fontSize) || 16;
          const width = (paragraph as HTMLElement).clientWidth;
          if (width > fontSize * 40 + 1) {
            failures.push(
              `本文の箱が 40 字を超える（${width.toFixed(1)}px > ${(fontSize * 40).toFixed(1)}px）: ${(paragraph.textContent ?? '').slice(0, 40)}`,
            );
          }
        }

        return failures;
      });
      failures.push(...issues.map((issue) => `${viewport.name} ${route}: ${issue}`));
    }
  }

  if (failures.length > 0) {
    throw new Error(`line breaks are not at meaning boundaries:\n${failures.join('\n')}`);
  }
});

// 幅 390 で、横の scroll が出ず、塊が箱からはみ出さないことを見る。
test('reading column has no horizontal overflow on mobile (line breaks)', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const failures: string[] = [];

  for (const route of LINE_BREAK_ROUTES) {
    await settlePage(page, route);
    const issues = await page.evaluate(() => {
      const failures: string[] = [];
      const root = document.documentElement;
      const scrollWidth = Math.max(root.scrollWidth, document.body?.scrollWidth ?? 0);
      if (scrollWidth > root.clientWidth + 2) {
        failures.push(`横 scroll が出る（scrollWidth=${scrollWidth} > clientWidth=${root.clientWidth}）`);
      }

      const clauses = Array.from(document.querySelectorAll('.lb-clause'));
      if (clauses.length === 0) failures.push('.lb-clause が 1 つも無い');
      for (const clause of clauses) {
        const box = clause.parentElement?.getBoundingClientRect();
        const rect = clause.getBoundingClientRect();
        if (!box) continue;
        if (rect.left < box.left - 1 || rect.right > box.right + 1) {
          failures.push(`塊が箱からはみ出す: ${(clause.textContent ?? '').slice(0, 30)}`);
        }
      }
      return failures;
    });
    failures.push(...issues.map((issue) => `mobile-390 ${route}: ${issue}`));
  }

  if (failures.length > 0) {
    throw new Error(`reading column overflows on mobile:\n${failures.join('\n')}`);
  }
});


// 読み物の page（blog・お知らせ・実績・security・privacy・特商法・会社情報）にも、R1・R2 の見方を当てる。
// 手本の業種別の page の試験と同じ見方。ただし短い題は 1 つの塊なので、h1 の塊の数は問わない。
const READING_LINE_BREAK_ROUTES = [
  '/blog/ai-development-estimate-knowledge-asset/',
  '/news/news-static-v1/',
  '/works/grift/',
  '/security/',
  '/privacy/',
  '/legal/tokushoho/',
  '/company/',
] as const;

// 業種別と読み物の試験が回る page の全部で、page の中の link（href="#…"）の飛び先の id が
// 同じ page に在るかを見る。# だけの link は飛び先を持たないので除く。
test('page-internal links point to an id on the same page', async ({ page }) => {
  test.setTimeout(120_000);
  const failures: string[] = [];

  for (const route of [...LINE_BREAK_ROUTES, ...READING_LINE_BREAK_ROUTES]) {
    await settlePage(page, route);
    const missing = await page.evaluate(() => {
      const missing: string[] = [];
      for (const link of Array.from(document.querySelectorAll('main a[href^="#"]'))) {
        const href = link.getAttribute('href') ?? '';
        if (href === '#') continue;
        const raw = href.slice(1);
        // % を含む壊れた href は decodeURIComponent が投げる。例外で試験を止めず、
        // 生の文字列のまま id を引く（encode されていない #id も同じ所で拾える）。
        let id = raw;
        try {
          id = decodeURIComponent(raw);
        } catch {
          id = raw;
        }
        if (!id) continue;
        if (document.getElementById(id)) continue;
        missing.push(href);
      }
      return Array.from(new Set(missing));
    });
    failures.push(...missing.map((href) => `${route}: 飛び先の id が無い ${href}`));
  }

  if (failures.length > 0) {
    throw new Error(`page-internal links have no target:\n${failures.join('\n')}`);
  }
});

// Markdown の記事の本文の箱（.prose）の中の p に、文の印（.lb-sentence）が在るかを見る。
// plugin を astro.config.mjs の rehypePlugins から外すと、記事の題・lead の印は残るのに
// 本文だけ印が消えるので、この試験が落ちる。
const MARKDOWN_BODY_ROUTES = [
  { route: '/blog/ai-development-estimate-knowledge-asset/', label: 'blog ja' },
  { route: '/zh/blog/ai-development-estimate-knowledge-asset/', label: 'blog zh' },
  { route: '/news/news-static-v1/', label: 'news ja' },
  { route: '/works/grift/', label: 'works ja' },
] as const;

test('markdown body paragraphs carry line-break marks (line breaks)', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const failures: string[] = [];

  for (const { route, label } of MARKDOWN_BODY_ROUTES) {
    await settlePage(page, route);
    const result = await page.evaluate(() => {
      const prose = document.querySelector('main .prose');
      if (!prose) return { paragraphs: 0, marked: 0 };
      const paragraphs = Array.from(prose.querySelectorAll('p'));
      const marked = paragraphs.filter((paragraph) => paragraph.querySelector('.lb-sentence')).length;
      return { paragraphs: paragraphs.length, marked };
    });
    if (result.paragraphs === 0) failures.push(`${label} ${route}: 本文の箱（.prose）の中に p が無い`);
    else if (result.marked === 0) {
      failures.push(`${label} ${route}: 本文の p ${result.paragraphs} 個のどれにも .lb-sentence が無い`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`markdown body paragraphs have no line-break marks:\n${failures.join('\n')}`);
  }
});

test('reading pages break headings and sentences at meaning boundaries (line breaks)', async ({ page }) => {
  test.setTimeout(300_000);
  const failures: string[] = [];

  for (const viewport of LINE_BREAK_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    for (const route of READING_LINE_BREAK_ROUTES) {
      await settlePage(page, route);
      await page.evaluate(installLineBreakProbe);
      const issues = await page.evaluate(() => {
        const failures: string[] = [];
        const probe = window.__lineBreakProbe;
        if (!probe) return ['折り返しを測る関数が仕込まれていない'];

        const headingClauses = Array.from(document.querySelectorAll('main h1 .lb-clause, main h2 .lb-clause, main h3 .lb-clause'));
        if (headingClauses.length === 0) failures.push('題の塊（.lb-clause）が 1 つも無い');
        for (const clause of headingClauses) {
          const box = probe.contentWidth(clause);
          if (probe.unwrappedWidth(clause) > box + 1) continue;
          const lines = probe.lineCount(clause);
          if (lines !== 1) {
            const style = window.getComputedStyle(clause);
            const lineHeight = Number.parseFloat(style.lineHeight);
            const height = clause.getBoundingClientRect().height;
            const lineHeightText =
              Number.isFinite(lineHeight) && lineHeight > 0 ? `${lineHeight.toFixed(1)}px` : '取れない';
            failures.push(
              `題の塊が ${lines} 行に割れている（高さ ${height.toFixed(1)}px ÷ 行 ${lineHeightText}）: ${(clause.textContent ?? '').slice(0, 40)}`,
            );
          }
        }

        failures.push(...probe.sentenceFailures());

        // 読み物の本文の箱が 40 字を超えない（R2）。表・脚注・著者の箱・要点の箱・出典の一覧は本文ではない。
        const bodyBoxes = Array.from(document.querySelectorAll('main .prose > p, main p.lb-text'));
        for (const paragraph of bodyBoxes) {
          if (paragraph.closest('table, aside, nav, li, [data-article-sources]')) continue;
          const style = window.getComputedStyle(paragraph);
          const fontSize = Number.parseFloat(style.fontSize) || 16;
          const width = (paragraph as HTMLElement).clientWidth;
          if (width > fontSize * 40 + 1) {
            failures.push(
              `本文の箱が 40 字を超える（${width.toFixed(1)}px > ${(fontSize * 40).toFixed(1)}px）: ${(paragraph.textContent ?? '').slice(0, 40)}`,
            );
          }
        }

        return failures;
      });
      failures.push(...issues.map((issue) => `${viewport.name} ${route}: ${issue}`));
    }
  }

  if (failures.length > 0) {
    throw new Error(`line breaks are not at meaning boundaries:\n${failures.join('\n')}`);
  }
});

// 印の CSS が効いていることを、計算値で見る（業種別と読み物の両方）。
// .lb-sentence を display: inline にすると、この試験が落ちる。
test('line-break marks keep their computed styles (line breaks)', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const failures: string[] = [];

  for (const route of [...LINE_BREAK_ROUTES, ...READING_LINE_BREAK_ROUTES]) {
    await settlePage(page, route);
    const issues = await page.evaluate(() => {
      const failures: string[] = [];
      const displayOf = (element: Element | null): string =>
        element ? window.getComputedStyle(element).display : '(要素が無い)';

      const sentence = document.querySelector('.lb-sentence');
      if (!sentence) failures.push('.lb-sentence が 1 つも無い');
      else if (displayOf(sentence) !== 'block') {
        failures.push(`.lb-sentence の display が ${displayOf(sentence)}（block のはず）`);
      }

      const clause = document.querySelector('.lb-clause');
      if (!clause) failures.push('.lb-clause が 1 つも無い');
      else if (displayOf(clause) !== 'inline-block') {
        failures.push(`.lb-clause の display が ${displayOf(clause)}（inline-block のはず）`);
      }

      const headings = Array.from(document.querySelectorAll('.lb-heading'));
      if (headings.length === 0) failures.push('.lb-heading が 1 つも無い');
      for (const heading of headings) {
        const style = window.getComputedStyle(heading);
        const textWrap = style.getPropertyValue('text-wrap') || style.getPropertyValue('text-wrap-mode');
        if (textWrap.trim() === 'balance') {
          failures.push(`.lb-heading の text-wrap が balance: ${(heading.textContent ?? '').slice(0, 30)}`);
        }
      }

      return failures;
    });
    failures.push(...issues.map((issue) => `${route}: ${issue}`));
  }

  if (failures.length > 0) {
    throw new Error(`line-break marks do not keep their styles:\n${failures.join('\n')}`);
  }
});

// 幅 390 の狭い画面では、本文は文の終わり（句点）でだけ行を替える（docs/design/layout-rules.md の R1）。
// 文の中の塊（.lb-sentence の子孫の .lb-clause。link などを挟んで直下に無い物も含む）は通常の折り方に
// 戻り、文は印の無い普通の文字として流した時と同じ行の切り方（各行の文字）になる。
// 題の塊（.lb-heading .lb-clause）は、狭い画面でも読点で切る。
test('narrow screens break body text at sentence ends only (line breaks)', async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const failures: string[] = [];

  for (const route of [...LINE_BREAK_ROUTES, ...READING_LINE_BREAK_ROUTES]) {
    await settlePage(page, route);
    await page.evaluate(installLineBreakProbe);
    const issues = await page.evaluate(() => {
      const failures: string[] = [];
      const probe = window.__lineBreakProbe;
      if (!probe) return ['折り返しを測る関数が仕込まれていない'];
      const displayOf = (element: Element): string => window.getComputedStyle(element).display;

      const sentences = Array.from(document.querySelectorAll('.lb-sentence'));
      if (sentences.length === 0) failures.push('.lb-sentence が 1 つも無い');
      for (const sentence of sentences) {
        if (displayOf(sentence) !== 'block') {
          failures.push(`文の display が ${displayOf(sentence)}（block のはず）: ${(sentence.textContent ?? '').slice(0, 30)}`);
          break;
        }
      }

      const bodyClauses = Array.from(document.querySelectorAll('.lb-sentence .lb-clause'));
      if (bodyClauses.length === 0) failures.push('文の中の塊（.lb-sentence .lb-clause）が 1 つも無い');
      for (const clause of bodyClauses) {
        if (displayOf(clause) !== 'inline') {
          failures.push(`文の中の塊の display が ${displayOf(clause)}（inline のはず）: ${(clause.textContent ?? '').slice(0, 30)}`);
          break;
        }
      }

      const headingClauses = Array.from(document.querySelectorAll('.lb-heading .lb-clause'));
      if (headingClauses.length === 0) failures.push('題の塊（.lb-heading .lb-clause）が 1 つも無い');
      for (const clause of headingClauses) {
        if (displayOf(clause) !== 'inline-block') {
          failures.push(`題の塊の display が ${displayOf(clause)}（inline-block のはず）: ${(clause.textContent ?? '').slice(0, 30)}`);
          break;
        }
      }

      // 形で見る: 文ごとに、印ありの行の切り方（各行の文字）が、印を外して同じ箱に流した時と同じか。
      // 行の数だけの比べは、同じ行数でも折れる場所が違う文（子孫の塊が inline-block のまま残った文）を
      // 見逃す。複製から外す印は子孫の全部とし、複製は不可視にして元の文の直前に置き（同じ幅で折り）、
      // 測り終えたら必ず消す。
      const segmenter =
        typeof (Intl as unknown as { Segmenter?: unknown }).Segmenter === 'function'
          ? new ((Intl as unknown as { Segmenter: new (_locale: string, options: { granularity: string }) => { segment: (value: string) => Iterable<{ segment: string }> } }).Segmenter)(
              document.documentElement.lang || navigator.language || 'ja',
              { granularity: 'grapheme' },
            )
          : null;
      const lineTextsOf = (element: Element): string[] => {
        const rows: { y: number; chars: string[] }[] = [];
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node) {
          const text = node.textContent ?? '';
          let offset = 0;
          for (const grapheme of segmenter ? [...segmenter.segment(text)].map((item) => item.segment) : Array.from(text)) {
            const next = offset + grapheme.length;
            if (grapheme.trim() !== '') {
              const range = document.createRange();
              range.setStart(node, offset);
              range.setEnd(node, next);
              const rect = range.getBoundingClientRect();
              range.detach();
              if (rect.width > 0 && rect.height > 0) {
                const y = (rect.top + rect.bottom) / 2;
                let row = rows.find((candidate) => Math.abs(candidate.y - y) <= 4);
                if (!row) {
                  row = { y, chars: [] };
                  rows.push(row);
                }
                row.chars.push(grapheme);
              }
            }
            offset = next;
          }
          node = walker.nextNode();
        }
        rows.sort((a, b) => a.y - b.y);
        return rows.map((row) => row.chars.join('').replace(/\s+/g, ' ').trim());
      };
      const mismatchedTexts: string[] = [];
      for (const sentence of sentences) {
        const text = (sentence.textContent ?? '').replace(/\s+/g, '');
        if (text.length === 0) continue;
        const markedLines = lineTextsOf(sentence);
        const clone = sentence.cloneNode(true) as HTMLElement;
        for (const clause of Array.from(clone.querySelectorAll('.lb-clause'))) {
          (clause as ChildNode).replaceWith(...Array.from(clause.childNodes));
        }
        clone.style.visibility = 'hidden';
        sentence.parentElement?.insertBefore(clone, sentence);
        const plainLines = lineTextsOf(clone);
        clone.remove();
        if (markedLines.join('\n') !== plainLines.join('\n')) {
          mismatchedTexts.push(
            `文の行の切り方が通常の折り方と違う（印あり ${markedLines.length} 行 / 印なし ${plainLines.length} 行）: ${text.slice(0, 30)}\n          印あり: ${markedLines.join(' / ')}\n          印なし: ${plainLines.join(' / ')}`,
          );
        }
      }
      if (mismatchedTexts.length > 0) {
        failures.push(...mismatchedTexts.slice(0, 50));
        if (mismatchedTexts.length > 50) failures.push(`ほか ${mismatchedTexts.length - 50} 文も同様に違う`);
      }

      return failures;
    });
    failures.push(...issues.map((issue) => `mobile-390 ${route}: ${issue}`));
  }

  if (failures.length > 0) {
    throw new Error(`narrow screens must break body text at sentence ends only:\n${failures.join('\n')}`);
  }
});

// 全部の .lb-sentence で、開きの括弧と閉じの括弧の数が同じ（業種別と読み物の両方）。
// 揃わない文は、page と文の頭 30 字を出す。
const BRACKET_PAIRS = [
  ['（', '）'],
  ['「', '」'],
  ['『', '』'],
  ['(', ')'],
] as const;

test('sentences keep bracket pairs balanced (line breaks)', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const failures: string[] = [];
  const pairs = BRACKET_PAIRS.map(([open, close]) => [open, close]);

  for (const route of [...LINE_BREAK_ROUTES, ...READING_LINE_BREAK_ROUTES]) {
    await settlePage(page, route);
    const issues = await page.evaluate((bracketPairs: string[][]) => {
      const failures: string[] = [];
      const sentences = Array.from(document.querySelectorAll('.lb-sentence'));
      for (const sentence of sentences) {
        const text = sentence.textContent ?? '';
        for (const [open, close] of bracketPairs) {
          const opens = text.split(open).length - 1;
          const closes = text.split(close).length - 1;
          if (opens !== closes) {
            failures.push(`括弧 ${open}${close} が ${opens} 個 / ${closes} 個: ${text.slice(0, 30)}`);
          }
        }
      }
      return failures;
    }, pairs);
    failures.push(...issues.map((issue) => `${route}: ${issue}`));
  }

  if (failures.length > 0) {
    throw new Error(`sentences have unbalanced brackets:\n${failures.join('\n')}`);
  }
});

// 表・code block の中に、文と塊の印が 1 つも無いこと。
test('tables and code blocks have no line-break marks (line breaks)', async ({ page }) => {
  test.setTimeout(180_000);
  const failures: string[] = [];
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const route of READING_LINE_BREAK_ROUTES) {
    await settlePage(page, route);
    const count = await page.evaluate(
      () =>
        document.querySelectorAll(
          'main table .lb-sentence, main table .lb-clause, main pre .lb-sentence, main pre .lb-clause',
        ).length,
    );
    if (count > 0) failures.push(`${route}: 表・code block の中に印が ${count} 個`);
  }

  if (failures.length > 0) {
    throw new Error(`line-break marks must not be inside tables or code blocks:\n${failures.join('\n')}`);
  }
});

// 幅 390 で、読み物の page にも横の scroll が出ず、塊が箱からはみ出さないことを見る。
test('reading pages have no horizontal overflow on mobile (line breaks)', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const failures: string[] = [];

  for (const route of READING_LINE_BREAK_ROUTES) {
    await settlePage(page, route);
    const issues = await page.evaluate(() => {
      const failures: string[] = [];
      const root = document.documentElement;
      const scrollWidth = Math.max(root.scrollWidth, document.body?.scrollWidth ?? 0);
      if (scrollWidth > root.clientWidth + 2) {
        failures.push(`横 scroll が出る（scrollWidth=${scrollWidth} > clientWidth=${root.clientWidth}）`);
      }

      const clauses = Array.from(document.querySelectorAll('.lb-clause'));
      if (clauses.length === 0) failures.push('.lb-clause が 1 つも無い');
      for (const clause of clauses) {
        const box = clause.parentElement?.getBoundingClientRect();
        const rect = clause.getBoundingClientRect();
        if (!box) continue;
        if (rect.left < box.left - 1 || rect.right > box.right + 1) {
          failures.push(`塊が箱からはみ出す: ${(clause.textContent ?? '').slice(0, 30)}`);
        }
      }
      return failures;
    });
    failures.push(...issues.map((issue) => `mobile-390 ${route}: ${issue}`));
  }

  if (failures.length > 0) {
    throw new Error(`reading column overflows on mobile:\n${failures.join('\n')}`);
  }
});

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
