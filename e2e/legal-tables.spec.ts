import { expect, test } from '@playwright/test';

test('特商法表の項目と値を320pxで一緒に読める', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 850 });
  await page.goto('/legal/tokushoho/');
  const region = page.getByRole('region', { name: '特定商取引法に基づく表記', exact: true });
  await expect(region).toHaveAttribute('tabindex', '-1');
  const width = await region.evaluate(el => {
    const th = el.querySelector('th')!;
    const css = getComputedStyle(th);
    return {
      label: (th.clientWidth - parseFloat(css.paddingInlineEnd)) / parseFloat(css.fontSize),
      value: el.querySelector('td')!.clientWidth / parseFloat(css.fontSize),
      overflow: el.scrollWidth - el.clientWidth,
    };
  });
  expect(width.label).toBeGreaterThanOrEqual(5);
  expect(width.value).toBeGreaterThanOrEqual(10);
  expect(width.overflow).toBe(0);
});

test('横に収まらない対照表をキーで読み、全列が収まればTabで通過する', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 320, height: 850 });
  await page.goto('/es/security/');
  const region = page.locator('scrollable-table[aria-labelledby="security-measures-table"]');
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
