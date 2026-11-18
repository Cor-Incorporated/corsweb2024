// 業種のページ（5 業種 × 5 言語。#525 の本文の部品がある）をスマホの幅で開き、横のはみ出しと、押せない link が無いかを数える。
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

// ISMS の区画（data-company-note）の面: hero（灰色の光の背景）と違う面＝白い card + 細い枠線であること。
// 明るい時は不透明の白。暗い時（<html> の dark class。ThemeInit と同じ切り替え方）は
// 透明でも旧い灰色（stone の半透明）でもないこと。位置は hero の下。
const NOTE_VIEWPORT = { width: 1440, height: 900 } as const;

function parseAlpha(color: string): number {
  const match = color.match(/rgba?\(([^)]+)\)/);
  if (!match) return -1;
  const parts = match[1].split(',').map((part) => Number.parseFloat(part.trim()));
  return parts.length >= 4 ? parts[3] : 1;
}

test(`desktop-1440 ja: ISMS 区画は白い card で hero の下にある`, async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Chromium だけで測る');
  await page.setViewportSize({ width: NOTE_VIEWPORT.width, height: NOTE_VIEWPORT.height });
  for (const slug of SLUGS) {
    const response = await page.goto(`/industries/${slug}/`);
    expect(response?.status()).toBe(200);
    const style = await page.locator('[data-company-note]').first().evaluate((element) => {
      const computed = getComputedStyle(element);
      const hero = document.querySelector('[data-proposal-hero]');
      return {
        bg: computed.backgroundColor,
        borderTopWidth: computed.borderTopWidth,
        noteTop: element.getBoundingClientRect().top,
        heroBottom: hero ? hero.getBoundingClientRect().bottom : Number.NaN,
      };
    });
    expect(style.bg, `${slug} 明るい mode の地の色`).toBe('rgb(255, 255, 255)');
    expect(Number.parseFloat(style.borderTopWidth), `${slug} 明るい mode の枠線`).toBeGreaterThanOrEqual(1);
    // 区画は最初の block（first:mt-0）で body 側に pt が無いため、上の端は hero の下の端とちょうど接する。重なっていない事を見る。
    expect(style.noteTop, `${slug} 区画の上の端`).toBeGreaterThanOrEqual(style.heroBottom);
  }
});

test('desktop-1440 ja medical: ISMS 区画は暗い mode で不透明（透明・灰色でない）', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Chromium だけで測る');
  await page.setViewportSize({ width: NOTE_VIEWPORT.width, height: NOTE_VIEWPORT.height });
  const response = await page.goto('/industries/medical/');
  expect(response?.status()).toBe(200);
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  const style = await page.locator('[data-company-note]').first().evaluate((element) => {
    const computed = getComputedStyle(element);
    const hero = document.querySelector('[data-proposal-hero]');
    return {
      bg: computed.backgroundColor,
      borderTopWidth: computed.borderTopWidth,
      noteTop: element.getBoundingClientRect().top,
      heroBottom: hero ? hero.getBoundingClientRect().bottom : Number.NaN,
    };
  });
  expect(parseAlpha(style.bg), '暗い mode の地は不透明').toBe(1);
  expect(style.bg, '暗い mode の地は旧い灰色（stone-500/10）ではない').not.toBe('rgba(120, 113, 108, 0.1)');
  expect(style.bg, '暗い mode の地は旧い灰色（stone-400/10）ではない').not.toBe('rgba(168, 162, 158, 0.1)');
  expect(Number.parseFloat(style.borderTopWidth), '暗い mode の枠線').toBeGreaterThanOrEqual(1);
  // 明るい mode と同じく、上の端は hero の下の端とちょうど接する（first:mt-0）。
  expect(style.noteTop, '暗い mode の区画の上の端').toBeGreaterThanOrEqual(style.heroBottom);
});
