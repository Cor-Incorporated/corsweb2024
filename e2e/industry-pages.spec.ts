// 業種のページ（5 業種 × 5 言語）をスマホの幅で開き、横のはみ出しと、押せない link が無いかを数える。
// - 横のはみ出し: document.documentElement.scrollWidth <= innerWidth
// - 押せない link: 本文・問い合わせ・参考資料の link を画面の中央へ動かし、その中心の点で
//   いちばん上にある要素が link 自身（かその中身）であること。浮きボタンなどに覆われていないこと
// 実行: npx playwright test e2e/industry-pages.spec.ts --project=chromium
import { expect, test } from '@playwright/test';

const LOCALES = ['ja', 'en', 'zh', 'ko', 'es'] as const;
const SLUGS = ['medical', 'shigyo', 'construction', 'manufacturing', 'education'] as const;
const VIEWPORTS = [
  { name: '375x812', width: 375, height: 812 },
  { name: '390x844', width: 390, height: 844 },
] as const;
const PARTS = '[data-proposal-hero], [data-proposal-body], [data-proposal-cta], [data-proposal-sources]';

for (const viewport of VIEWPORTS) {
  for (const locale of LOCALES) {
    for (const slug of SLUGS) {
      const route = `${locale === 'ja' ? '' : `/${locale}`}/industries/${slug}/`;
      test(`${viewport.name} ${route}: 横にはみ出さず、link がすべて押せる`, async ({ page, browserName }) => {
        test.skip(browserName !== 'chromium', 'Chromium だけで測る');
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        const response = await page.goto(route);
        expect(response?.status()).toBe(200);

        const overflow = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        expect(overflow.scrollWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.innerWidth);

        const covered = await page.evaluate(async (selector) => {
          const anchors = [...document.querySelectorAll(selector)].flatMap((part) => [...part.querySelectorAll('a[href]')]);
          const blocked: string[] = [];
          for (const anchor of anchors) {
            anchor.scrollIntoView({ block: 'center', inline: 'nearest' });
            await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
            const box = (anchor.getClientRects()[0] ?? anchor.getBoundingClientRect()) as DOMRect;
            const x = box.left + Math.min(box.width / 2, 8);
            const y = box.top + box.height / 2;
            const hit = document.elementFromPoint(x, y);
            if (!hit || !(anchor === hit || anchor.contains(hit))) {
              blocked.push(`${anchor.getAttribute('href')} -> ${hit?.tagName ?? 'none'}${hit?.id ? `#${hit.id}` : ''}`);
            }
          }
          return { total: anchors.length, blocked };
        }, PARTS);
        expect(covered.total).toBeGreaterThan(0);
        expect(covered.blocked).toEqual([]);
      });
    }
  }
}
