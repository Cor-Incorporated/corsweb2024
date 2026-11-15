// 演出（data-reveal。src/layouts/Layout.astro の script）の動きを、ブラウザで確かめる。
//
// 決まり:
//  - 下へスクロールして入る要素は、窓の下 12% では待ち、それより上に入ったらふわっと出る。
//  - 下へのスクロールの途中でなければ、窓の中に在る要素は出ている（上へ戻った後・一気に上へ移った後・
//    配置が変わった後）。窓が低いと、ヒーローの主ボタンは下 12% に在る。
//  - 窓から出きった要素は隠れる（次に入ったとき、また演出がかかる）。窓の下に在る要素は、スクロールで
//    入るまで隠れている。
// 「窓の中」は、隠れている間のずれ（transform）を除いた位置（offsetTop）で決める。script は判定を
// ずれと縮みの分（50px ほど）だけ下へ広げるので、「窓の下」は窓の下の端から BELOW_MARGIN_PX より下とする。
//
// 動かし方（ビルド結果で測る。first-view.spec.ts と同じ変数）:
//   npm run build
//   npx astro preview --host 127.0.0.1 --port 4393 &
//   FIRST_VIEW_BASE_URL=http://127.0.0.1:4393 npx playwright test e2e/reveal-motion.spec.ts --project=chromium
import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';

// 演出は最大 0.5s 遅れて 0.6s かけて出る。出終わるのを待つ時間
const SETTLE_MS = 1500;
const PRIMARY_CTA_SELECTOR = '[data-hero-primary-cta]';
const BELOW_MARGIN_PX = 120;

interface InViewHidden {
  text: string;
  top: number;
  bottom: number;
}

interface RevealState {
  scrollY: number;
  innerHeight: number;
  hiddenInView: InViewHidden[];
  visibleBelow: InViewHidden[];
  ctaOpacity: number | null;
}

// 窓の中に（1px 以上）在るのに、演出で隠れたままの要素、窓の下に在るのに出ている要素、主ボタンの opacity
function readRevealState({ ctaSelector, belowMargin }: { ctaSelector: string; belowMargin: number }): RevealState {
  const h = window.innerHeight;
  const layoutTop = (el: HTMLElement) => {
    let top = 0;
    for (let node: HTMLElement | null = el; node; node = node.offsetParent as HTMLElement | null) top += node.offsetTop;
    return top - window.scrollY;
  };
  const hiddenInView = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal].reveal-ready'))
    .filter((el) => !el.classList.contains('is-visible') && el.getClientRects().length > 0)
    .map((el) => {
      const top = layoutTop(el);
      return { text: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 24), top, bottom: top + el.offsetHeight };
    })
    .filter((r) => r.top < h && r.bottom > 0);
  const visibleBelow = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal].reveal-ready.is-visible'))
    .filter((el) => el.getClientRects().length > 0 && layoutTop(el) > h + belowMargin)
    .map((el) => {
      const top = layoutTop(el);
      return { text: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 24), top, bottom: top + el.offsetHeight };
    });
  const cta = document.querySelector<HTMLElement>(ctaSelector);
  let ctaOpacity: number | null = null;
  if (cta && cta.getClientRects().length > 0 && layoutTop(cta) < h && layoutTop(cta) + cta.offsetHeight > 0) {
    ctaOpacity = 1;
    for (let node: HTMLElement | null = cta; node; node = node.parentElement) ctaOpacity *= Number(getComputedStyle(node).opacity);
    ctaOpacity = Math.round(ctaOpacity * 100) / 100;
  }
  return { scrollY: Math.round(window.scrollY), innerHeight: h, hiddenInView, visibleBelow, ctaOpacity };
}

const readState = (page: Page) =>
  page.evaluate(readRevealState, { ctaSelector: PRIMARY_CTA_SELECTOR, belowMargin: BELOW_MARGIN_PX });

async function open(browser: Browser, testInfo: TestInfo, pathname: string, width: number, height: number) {
  const baseURL = process.env.FIRST_VIEW_BASE_URL ?? testInfo.project.use.baseURL;
  expect(baseURL, 'FIRST_VIEW_BASE_URL か設定の baseURL が要る').toBeTruthy();
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  await page.goto(new URL(pathname, baseURL!).toString(), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(SETTLE_MS);
  const ready = await page.evaluate(() => document.querySelectorAll('[data-reveal].reveal-ready').length);
  expect(ready, '演出が働いていない（reveal-ready が 0 個）').toBeGreaterThan(0);
  await page.mouse.move(Math.round(width / 2), Math.round(height / 2));
  return { context, page };
}

// 人のスクロールと同じに、窓の半分ずつ回す
async function wheelToBottom(page: Page, height: number) {
  const step = Math.round(height * 0.5);
  const docHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < docHeight; y += step) {
    await page.mouse.wheel(0, step);
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(600);
}

async function wheelToTop(page: Page, height: number) {
  const step = Math.round(height * 0.5);
  for (let i = 0; i < 400 && (await page.evaluate(() => window.scrollY)) > 0; i += 1) {
    await page.mouse.wheel(0, -step);
    await page.waitForTimeout(80);
  }
}

const jumpTo = (page: Page, top: number) =>
  page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior }), top);

async function wheelBy(page: Page, dy: number, times: number, waitMs: number) {
  for (let i = 0; i < times; i += 1) {
    await page.mouse.wheel(0, dy);
    await page.waitForTimeout(waitMs);
  }
}

type ReturnWay = (page: Page, height: number) => Promise<void>;

const RETURN_WAYS: Record<string, ReturnWay> = {
  '500px 下へ行き、100px ずつゆっくり戻る': async (page) => {
    await wheelBy(page, 100, 5, 300);
    await wheelBy(page, -100, 6, 300);
  },
  '2000px 下へ行き、200px ずつ速めに戻る': async (page) => {
    await wheelBy(page, 200, 10, 150);
    await wheelBy(page, -200, 11, 150);
  },
  '下まで回して、Home キーで戻る': async (page, height) => {
    await wheelToBottom(page, height);
    await page.keyboard.press('Home');
  },
  '下まで回して、一気に上へ移る': async (page, height) => {
    await wheelToBottom(page, height);
    await jumpTo(page, 0);
  },
  '300px 下へ行き、一気に上へ移る': async (page) => {
    await wheelBy(page, 100, 3, 300);
    await jumpTo(page, 0);
  },
  '下まで回して、少しずつ上へ戻る': async (page, height) => {
    await wheelToBottom(page, height);
    await wheelToTop(page, height);
  },
};

// ブラウザの枠とタスクバーを引いたパソコンの窓は、戻り方を 6 通り。ほかは、下まで回す 2 通り
const PC_WINDOWS = [
  { pathname: '/', width: 1366, height: 657 },
  { pathname: '/en/', width: 1280, height: 609 },
  { pathname: '/', width: 1536, height: 730 },
];
const OTHER_CASES = [
  { pathname: '/', width: 1280, height: 609 },
  { pathname: '/', width: 375, height: 667 },
  { pathname: '/services/confidential-ai-assessment/', width: 1920, height: 953 },
];
const RETURN_CASES = [
  ...PC_WINDOWS.flatMap((c) => Object.keys(RETURN_WAYS).map((way) => ({ ...c, way }))),
  ...OTHER_CASES.flatMap((c) => ['下まで回して、少しずつ上へ戻る', '下まで回して、一気に上へ移る'].map((way) => ({ ...c, way }))),
];

for (const c of RETURN_CASES) {
  test(`${c.pathname} ${c.width}x${c.height}: ${c.way}と、窓の中の演出の要素が出ていて、窓の下の要素は隠れている`, async ({ browser }, testInfo) => {
    test.setTimeout(120_000);
    const { context, page } = await open(browser, testInfo, c.pathname, c.width, c.height);
    try {
      const atLoad = await readState(page);
      expect(atLoad.hiddenInView, `読み込みの後に窓の中で隠れている要素（${JSON.stringify(atLoad)}）`).toEqual([]);
      expect(atLoad.visibleBelow, `読み込みの後に窓の下で出ている要素（${JSON.stringify(atLoad)}）`).toEqual([]);
      await RETURN_WAYS[c.way](page, c.height);
      await page.waitForFunction(() => window.scrollY === 0, null, { timeout: 10_000 }).catch(() => undefined);
      await page.waitForTimeout(SETTLE_MS);
      const back = await readState(page);
      expect(back.scrollY, '上まで戻れていない').toBe(0);
      expect(back.hiddenInView, `戻った後に窓の中で隠れている要素（${JSON.stringify(back)}）`).toEqual([]);
      expect(back.visibleBelow, `戻った後に窓の下で出ている要素（${JSON.stringify(back)}）`).toEqual([]);
      if (back.ctaOpacity !== null) expect(back.ctaOpacity, '戻った後の主ボタンの opacity').toBeGreaterThanOrEqual(0.99);
    } finally {
      await context.close();
    }
  });
}

// 読み込んだ時に窓の外（下）に在る、低い演出の要素を 1 つ選び、文書の中の上端と高さを返す
async function pickBelowFold(page: Page) {
  const picked = await page.evaluate(() => {
    const h = window.innerHeight;
    const docTop = (el: HTMLElement) => {
      let top = 0;
      for (let node: HTMLElement | null = el; node; node = node.offsetParent as HTMLElement | null) top += node.offsetTop;
      return top;
    };
    const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    const index = targets.findIndex((el) => el.getClientRects().length > 0 && docTop(el) > h * 1.5 && el.offsetHeight < h * 0.1);
    if (index < 0) return null;
    targets[index].setAttribute('data-reveal-probe', '');
    return { top: docTop(targets[index]), height: targets[index].offsetHeight, style: targets[index].getAttribute('style') };
  });
  expect(picked, '窓の外の低い演出の要素が無い').not.toBeNull();
  return picked!;
}

const probeState = (page: Page) =>
  page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('[data-reveal-probe]')!;
    return { visible: el.classList.contains('is-visible'), opacity: Number(getComputedStyle(el).opacity), style: el.getAttribute('style') };
  });

test('下へのスクロールでは、窓の下 12% に入った要素は待ち、上へ少し戻ると出る', async ({ browser }, testInfo) => {
  const height = 657;
  const { context, page } = await open(browser, testInfo, '/', 1366, height);
  try {
    const target = await pickBelowFold(page);
    // 上端が窓の 95% の所（下 12% の中）に来るまで、下へ移る
    await jumpTo(page, target.top - Math.round(height * 0.95));
    await page.waitForTimeout(SETTLE_MS);
    expect((await probeState(page)).visible, '下へのスクロールで、下 12% に入った要素がもう出ている').toBe(false);
    // 上へ 10px（まだ窓の中）
    await jumpTo(page, target.top - Math.round(height * 0.95) - 10);
    await page.waitForTimeout(SETTLE_MS);
    const after = await probeState(page);
    expect(after.visible, '上へ動いた後も、窓の中の要素が隠れたまま').toBe(true);
    expect(after.opacity, '上へ動いた後の opacity').toBeGreaterThanOrEqual(0.99);
  } finally {
    await context.close();
  }
});

test('下へのスクロールで窓の中ほどに入った要素は、遅れを付けたまま、ふわっと出る', async ({ browser }, testInfo) => {
  const height = 657;
  const { context, page } = await open(browser, testInfo, '/', 1366, height);
  try {
    const target = await pickBelowFold(page);
    await jumpTo(page, target.top - Math.round(height * 0.95));
    await page.waitForTimeout(SETTLE_MS);
    // 中ほどへ下りて、1.2 秒の間、毎回の描画で opacity を読む
    const samples = await page.evaluate(async (y) => {
      const el = document.querySelector<HTMLElement>('[data-reveal-probe]')!;
      window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
      const values: number[] = [];
      const start = performance.now();
      while (performance.now() - start < 1200) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        values.push(Number(getComputedStyle(el).opacity));
      }
      return values;
    }, target.top - Math.round(height * 0.5));
    const between = samples.filter((v) => v > 0.05 && v < 0.95);
    expect(between.length, `途中の opacity が無い（ふわっと出ていない）: ${samples.map((v) => v.toFixed(2)).join(' ')}`).toBeGreaterThan(0);
    expect(samples.at(-1), '出終わった opacity').toBeGreaterThanOrEqual(0.99);
    expect((await probeState(page)).style, '並べて出すための遅れ（style の --reveal-delay）が変わった').toBe(target.style);
  } finally {
    await context.close();
  }
});

test('窓から出きった要素は隠れ、配置が変わって窓に入った要素は、スクロールしなくても出る', async ({ browser }, testInfo) => {
  const height = 657;
  const { context, page } = await open(browser, testInfo, '/', 1366, height);
  try {
    const target = await pickBelowFold(page);
    // スクロールせずに、上の余白を詰めて、要素を窓の 94% の所（下 12% の中）へ上げる
    await page.evaluate((shift) => {
      const main = document.querySelector<HTMLElement>('main')!;
      main.style.marginTop = `${-shift}px`;
    }, target.top - Math.round(height * 0.94));
    await page.waitForTimeout(SETTLE_MS);
    expect((await probeState(page)).visible, '配置が変わって窓に入った要素が、隠れたまま').toBe(true);
    await page.evaluate(() => {
      document.querySelector<HTMLElement>('main')!.style.marginTop = '';
    });
    // 主ボタンが窓の上へ出きるまで、下へ移る
    await jumpTo(page, height * 3);
    await page.waitForTimeout(300);
    const ctaHidden = await page.evaluate((sel) => {
      const wrap = document.querySelector(sel)?.closest('[data-reveal]');
      return wrap ? !wrap.classList.contains('is-visible') : null;
    }, PRIMARY_CTA_SELECTOR);
    expect(ctaHidden, '窓から出きった主ボタンの枠が、表示のまま').toBe(true);
  } finally {
    await context.close();
  }
});

// 隠れている要素は 2.5rem 下へずれ、さらに真ん中を軸に 0.98 へ縮む（上の端が高さの 1% 下がる）。
// 背の高い要素の上端が窓の下の端に 1px だけ入った所へ、一気に上へ移っても出ること（縮みの分まで判定を広げている）。
test('背の高い要素の上端が窓の下の端に 1px 入った所へ一気に上へ移ると、その要素が出る', async ({ browser }, testInfo) => {
  const height = 657;
  const { context, page } = await open(browser, testInfo, '/', 1366, height);
  try {
    const picked = await page.evaluate((h) => {
      const docTop = (el: HTMLElement) => {
        let top = 0;
        for (let node: HTMLElement | null = el; node; node = node.offsetParent as HTMLElement | null) top += node.offsetTop;
        return top;
      };
      const bottomView = document.documentElement.scrollHeight - h;
      const candidates = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
        .filter((el) => el.getClientRects().length > 0 && docTop(el) > h * 2 && docTop(el) + el.offsetHeight < bottomView - 100)
        .sort((a, b) => b.offsetHeight - a.offsetHeight);
      if (!candidates[0]) return null;
      candidates[0].setAttribute('data-reveal-probe', '');
      return { top: docTop(candidates[0]), height: candidates[0].offsetHeight };
    }, height);
    expect(picked, '背の高い演出の要素が無い').not.toBeNull();
    // 縮みの分が 2px 以上ないと、この試験は判定の広げ方の違いを見分けられない
    expect(picked!.height, '選んだ要素の高さ').toBeGreaterThanOrEqual(200);
    await jumpTo(page, 1_000_000);
    await page.waitForTimeout(300);
    expect((await probeState(page)).visible, '下の端へ移った後、窓の上へ出きった要素が表示のまま').toBe(false);
    await jumpTo(page, picked!.top - height + 1);
    await page.waitForTimeout(SETTLE_MS);
    const state = await readState(page);
    expect((await probeState(page)).visible, `上端が窓に 1px 入った要素が隠れたまま（${JSON.stringify({ picked, state })}）`).toBe(true);
    expect(state.hiddenInView, '窓の中で隠れている要素').toEqual([]);
  } finally {
    await context.close();
  }
});

// 再読み込みでは、Astro の router が前の位置へ戻す（history.state の scrollY。演出の初期化より前に戻す）。
// 位置を戻す動きを「下へのスクロール」と読んで、下 12% の要素を待たせないこと。
test('再読み込みで、ページの途中の位置から始まっても、窓の中の演出の要素が出ている', async ({ browser }, testInfo) => {
  const height = 657;
  const { context, page } = await open(browser, testInfo, '/', 1366, height);
  try {
    const target = await pickBelowFold(page);
    // 下 12% の中に演出の要素が在る位置へ下りて、止まってから再読み込みする
    const y = target.top - Math.round(height * 0.95);
    await jumpTo(page, y);
    await page.waitForTimeout(SETTLE_MS);
    await page.reload({ waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(SETTLE_MS);
    const state = await readState(page);
    expect(Math.abs(state.scrollY - y), `再読み込みで前の位置に戻っていない（scrollY=${state.scrollY}、前は ${y}）`).toBeLessThanOrEqual(2);
    expect(state.hiddenInView, `再読み込みの後に窓の中で隠れている要素（${JSON.stringify(state)}）`).toEqual([]);
    expect(state.visibleBelow, `再読み込みの後に窓の下で出ている要素（${JSON.stringify(state)}）`).toEqual([]);
  } finally {
    await context.close();
  }
});
