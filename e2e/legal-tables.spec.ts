import { expect, test } from '@playwright/test';

test('法務表をキーボードで横に読み、全列が収まればTabで通過する', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 320, height: 850 });
  await page.goto('/legal/tokushoho/');
  const region = page.getByRole('region', { name: '特定商取引法に基づく表記', exact: true });
  const headingWidthInCharacters = await region.locator('tbody th').first().evaluate(el => {
    const css = getComputedStyle(el);
    const contentWidth = el.clientWidth - parseFloat(css.paddingInlineStart) - parseFloat(css.paddingInlineEnd);
    return contentWidth / parseFloat(css.fontSize);
  });
  expect(headingWidthInCharacters).toBeGreaterThanOrEqual(6);
  await expect(region).toHaveAttribute('tabindex', '0');
  // macOS WebKit uses Option+Tab to visit all keyboard-focusable elements.
  for (let i = 0; i < 30 && !(await region.evaluate(el => el.matches(':focus'))); i++) {
    await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
  }
  await expect(region).toBeFocused();
  const horizontalOffset = () => region.evaluate(el => el.scrollLeft);
  const initial = await horizontalOffset();
  await page.keyboard.press('ArrowRight');
  await expect.poll(horizontalOffset).toBeGreaterThan(initial);
  await page.keyboard.press('ArrowLeft');
  await expect.poll(horizontalOffset).toBe(initial);

  await page.setViewportSize({ width: 1280, height: 850 });
  await expect(region).toHaveAttribute('tabindex', '-1');
});
