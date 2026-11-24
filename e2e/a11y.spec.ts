/**
 * WCAG 2.2 AA を axe と Playwright で全ルート（dist 生成物）に対して測る。
 * 390px 幅を既定にし、操作域・見出し・ランドマーク・フォーカスも代表パスで確認する。
 * ブログ記事題と固定リンク（PR #671 レーン）は触らない。
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type BrowserContextOptions } from '@playwright/test';

import { discoverRoutes, filterRoutesByEnv, isExpectedNotFoundRoute } from './helpers/discover-routes';
import { settlePageForAudit } from './helpers/page-settle';

const ROUTE_BATCH_SIZE = 100;
const allProductionRoutes = filterRoutesByEnv(discoverRoutes());

function routeBatches(routes: readonly string[], size: number): string[][] {
  const batches: string[][] = [];
  for (let index = 0; index < routes.length; index += size) {
    batches.push(routes.slice(index, index + size));
  }
  return batches;
}

const LOCALES = ['ja', 'en', 'zh', 'ko', 'es'] as const;
const MIN_TARGET_PX = 44;

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] as const;

const REPRESENTATIVE_PATHS = [
  '/',
  '/about/',
  '/company/',
  '/blog/',
  '/works/',
  '/news/',
  '/privacy/',
  '/services/ai-development/',
  '/industries/medical/',
] as const;

function localePrefix(locale: (typeof LOCALES)[number]): string {
  return locale === 'ja' ? '' : `/${locale}`;
}

function localizedPath(locale: (typeof LOCALES)[number], path: string): string {
  if (path === '/') return locale === 'ja' ? '/' : `/${locale}/`;
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${localePrefix(locale)}${suffix}`;
}

const representativeRoutes = LOCALES.flatMap((locale) =>
  REPRESENTATIVE_PATHS.map((path) => localizedPath(locale, path)),
);

test.use({
  contextOptions: { reducedMotion: 'reduce' } satisfies BrowserContextOptions,
});

async function runAxe(page: Page) {
  return new AxeBuilder({ page }).withTags([...AXE_TAGS]).analyze();
}

function seriousViolations(results: Awaited<ReturnType<typeof runAxe>>) {
  return results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
}

test.describe('axe — all production routes at 390px', () => {
  for (const [batchIndex, batch] of routeBatches(allProductionRoutes, ROUTE_BATCH_SIZE).entries()) {
    const rangeStart = batchIndex * ROUTE_BATCH_SIZE + 1;
    const rangeEnd = rangeStart + batch.length - 1;

    test(`routes ${rangeStart}–${rangeEnd}: no serious WCAG violations`, async ({ page }) => {
      test.setTimeout(Math.max(180_000, batch.length * 4_000));
      const failures: string[] = [];

      for (const route of batch) {
        const status = await settlePageForAudit(page, route);
        if (status === 404 && isExpectedNotFoundRoute(route)) continue;

        const results = await runAxe(page);
        const serious = seriousViolations(results);
        if (serious.length > 0) {
          const summary = serious.map((v) => `${v.id}(${v.nodes.length})`).join(', ');
          failures.push(`${route}: ${summary}`);
        }
      }

      expect(failures, failures.join('\n')).toEqual([]);
    });
  }
});

test.describe('document landmarks and headings (5 languages × representative pages)', () => {
  for (const route of representativeRoutes) {
    test(`${route} has one main, one h1, and no skipped heading levels`, async ({ page }) => {
      await settlePageForAudit(page, route);
      await expect(page.locator('main#main-content, main[id="main-content"], main').first()).toBeVisible();
      const h1Count = await page.locator('main h1').count();
      expect(h1Count).toBe(1);

      const skipped = await page.evaluate(() => {
        const levels = Array.from(document.querySelectorAll('main h1, main h2, main h3, main h4, main h5, main h6'))
          .map((el) => Number(el.tagName[1]))
          .filter((level) => Number.isFinite(level));
        const failures: string[] = [];
        let previous = 0;
        for (const level of levels) {
          if (previous > 0 && level - previous > 1) {
            failures.push(`h${previous} → h${level}`);
          }
          previous = level;
        }
        return failures;
      });
      expect(skipped).toEqual([]);
    });
  }
});

test.describe('44px touch targets in the header (390px)', () => {
  for (const locale of LOCALES) {
    const home = localizedPath(locale, '/');
    test(`${home} header controls meet ${MIN_TARGET_PX}px`, async ({ page }) => {
      await settlePageForAudit(page, home);
      const sizes = await page.evaluate((min) => {
        const failures: string[] = [];
        const isVisible = (el: HTMLElement) => {
          const style = getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            rect.width > 0 &&
            rect.height > 0
          );
        };
        const check = (el: HTMLElement | null, label: string) => {
          if (!el) {
            failures.push(`${label}: missing`);
            return;
          }
          if (!isVisible(el)) return;
          const rect = el.getBoundingClientRect();
          if (rect.width < min || rect.height < min) {
            failures.push(`${label}: ${Math.round(rect.width)}×${Math.round(rect.height)}`);
          }
        };
        check(document.querySelector<HTMLElement>('[data-theme-switch]'), 'theme');
        check(document.querySelector<HTMLElement>('[data-lang-switch]'), 'language');
        check(document.querySelector<HTMLElement>('header button[aria-controls="website-menu"]'), 'menu');
        return failures;
      }, MIN_TARGET_PX);
      expect(sizes).toEqual([]);
    });
  }
});

test.describe('keyboard focus visibility', () => {
  const skipLabels: Record<(typeof LOCALES)[number], string> = {
    ja: '本文へ移動',
    en: 'Skip to main content',
    zh: '跳至主要内容',
    ko: '본문으로 이동',
    es: 'Saltar al contenido principal',
  };

  for (const locale of LOCALES) {
    test(`${locale} skip link focuses main`, async ({ page, browserName }) => {
      const home = localizedPath(locale, '/');
      await settlePageForAudit(page, home);
      const next = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
      const skip = page.getByRole('link', { name: skipLabels[locale], exact: true });
      await page.keyboard.press(next);
      await expect(skip).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('main')).toBeFocused();
    });

    test(`${locale} theme switch shows focus ring`, async ({ page }) => {
      const home = localizedPath(locale, '/');
      await settlePageForAudit(page, home);
      const theme = page.locator('[data-theme-switch]');
      await theme.focus();
      await expect(theme).toBeFocused();
      const ring = await theme.evaluate((el) => {
        const style = getComputedStyle(el);
        return style.outlineWidth !== '0px' || style.boxShadow !== 'none';
      });
      expect(ring).toBe(true);
    });
  }
});

test.describe('design contrast — no horizontal overflow at 390px', () => {
  for (const [batchIndex, batch] of routeBatches(allProductionRoutes, ROUTE_BATCH_SIZE).entries()) {
    const rangeStart = batchIndex * ROUTE_BATCH_SIZE + 1;
    const rangeEnd = rangeStart + batch.length - 1;

    test(`routes ${rangeStart}–${rangeEnd}: fit viewport width`, async ({ page }) => {
      test.setTimeout(Math.max(120_000, batch.length * 2_000));
      const failures: string[] = [];
      for (const route of batch) {
        const status = await settlePageForAudit(page, route);
        if (status === 404 && isExpectedNotFoundRoute(route)) continue;
        const overflow = await page.evaluate(() => {
          const root = document.documentElement;
          const scrollWidth = Math.max(root.scrollWidth, document.body?.scrollWidth ?? 0);
          return scrollWidth - root.clientWidth;
        });
        if (overflow > 2) failures.push(`${route}: overflow ${overflow}px`);
      }
      expect(failures).toEqual([]);
    });
  }
});