import { test, type Page } from '@playwright/test';

import { installLineBreakProbe } from './helpers/line-break-probe';

// LP と一覧の page（top・about・サービス・contact・実績・お知らせ・blog）の、配置と改行の決まり
// （docs/design/layout-rules.md の R1・R2）を見る。手本は e2e/visual-text.spec.ts の
// 「line breaks」の試験（待ち方・animation を止める・許す幅は同じ）。
// 幅を測る関数と「1 行のはず」の決め（幅が箱より 1px 以上小さい物だけ判定。判定した文が
// 0 個の route は落とす）は e2e/helpers/line-break-probe.ts を共用する。
const LP_ROUTES = [
  '/',
  '/about/',
  '/services/ai-development/',
  '/contact/',
  '/works/',
  '/news/',
  '/blog/',
] as const;

const LP_ZH_ROUTES = ['/zh/'] as const;

const LP_VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'desktop-1920', width: 1920, height: 1080 },
] as const;

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

// 決まりの対象から外れる題（手で改行を入れた題・set:html で HTML を含む題）は、
// 試験の中で「塊の span だけを子に持つ題」だけを対象にすることで外している。

test('LP headings and sentences break at meaning boundaries (LP line breaks)', async ({ page }) => {
  test.setTimeout(300_000);
  const failures: string[] = [];

  for (const viewport of LP_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    for (const route of [...LP_ROUTES, ...LP_ZH_ROUTES]) {
      await settlePage(page, route);
      await page.evaluate(installLineBreakProbe);
      const issues = await page.evaluate(() => {
        const failures: string[] = [];
        const probe = window.__lineBreakProbe;
        if (!probe) return ['折り返しを測る関数が仕込まれていない'];

        // 塊の span だけを持つ（手書きの <br> や set:html の HTML を含まない）題。
        const plainMarkedHeadings = Array.from(
          document.querySelectorAll('main h1, main h2, main h3'),
        ).filter((heading) =>
          Array.from(heading.childNodes).every((node) => {
            if (node.nodeType === Node.TEXT_NODE) return true;
            return (
              node instanceof Element && node.tagName === 'SPAN' && node.classList.contains('lb-clause')
            );
          }),
        );

        // 読点（、，）を含む題は、塊を 2 つ以上持つか、5 字以下の出だしで 1 つにまとまっている。
        for (const heading of plainMarkedHeadings) {
          const text = (heading.textContent ?? '').replace(/\s+/g, '');
          if (![...text].some((ch) => ch === '、' || ch === '，')) continue;
          const clauses = Array.from(heading.querySelectorAll('.lb-clause'));
          if (clauses.length >= 2) continue;
          const lead = text.replace(/[、，].*$/, '');
          if ([...lead].length <= 5) continue;
          failures.push(
            `読点を含む題が 1 つの塊のままで、出だしが 5 字を超える（塊 ${clauses.length} 個・出だし「${lead}」）: ${text.slice(0, 40)}`,
          );
        }

        // 題の塊 1 つ 1 つは 1 行（helper と同じ決め: 幅が箱より 1px 以上小さい塊だけ判定。
        // 箱との差が 1px 未満の物・箱より広い物・見えていない物（幅 0）は判定から外す）。
        const clauseSelector = 'main h1 .lb-clause, main h2 .lb-clause, main h3 .lb-clause';
        const headingClauses = Array.from(document.querySelectorAll(clauseSelector));
        if (headingClauses.length === 0) failures.push('題の塊（.lb-clause）が 1 つも無い');
        failures.push(...probe.clauseFailures(clauseSelector));

        // main の中の文は、箱に収まる物が 1 行（helper と同じ決め。判定した文が 0 個の
        // route は落とす）。字数は落ちた時の文に出すだけ。
        failures.push(...probe.sentenceFailures('main .lb-sentence'));

        // 節の題のすぐ下の説明の段落（card の中でない物）の箱は、全角 40 字まで（R2）。
        // card（一覧の card・実績の card）と表・箇条書き・定義・読み物の部品は、card の幅のまま。
        const bodyBoxes = Array.from(document.querySelectorAll<HTMLParagraphElement>('main p')).filter((p) =>
          p.querySelector('.lb-sentence'),
        );
        for (const paragraph of bodyBoxes) {
          if (paragraph.closest('table, li, dl, aside, nav, details, article, pre')) continue;
          const style = window.getComputedStyle(paragraph);
          const fontSize = Number.parseFloat(style.fontSize) || 16;
          const width = paragraph.clientWidth;
          if (width > fontSize * 40 + 1) {
            failures.push(
              `説明の箱が 40 字を超える（${width.toFixed(1)}px > ${(fontSize * 40).toFixed(1)}px）: ${(paragraph.textContent ?? '').slice(0, 40)}`,
            );
          }
        }

        // 表・button・link の中（link の文字だけを包む物）に文の印が無い。
        const inInteractive = document.querySelectorAll(
          'main table .lb-sentence, main button .lb-sentence, main a .lb-sentence',
        ).length;
        if (inInteractive > 0) failures.push(`表・button・a の中に .lb-sentence が ${inInteractive} 個`);

        // 文ごとに、括弧の対の数が同じ。
        for (const sentence of Array.from(document.querySelectorAll('main .lb-sentence'))) {
          const text = sentence.textContent ?? '';
          const pairs: Array<[string, string]> = [
            ['（', '）'],
            ['「', '」'],
          ];
          for (const [open, close] of pairs) {
            const opens = text.split(open).length - 1;
            const closes = text.split(close).length - 1;
            if (opens !== closes) {
              failures.push(`括弧の対が揃わない（${open} ${opens}・${close} ${closes}）: ${text.slice(0, 40)}`);
            }
          }
        }

        return failures;
      });
      failures.push(...issues.map((issue) => `${viewport.name} ${route}: ${issue}`));
    }
  }

  if (failures.length > 0) {
    throw new Error(`LP line breaks are not at meaning boundaries:\n${failures.join('\n')}`);
  }
});

// 幅 390 で、LP と一覧の pageに横の scroll が出ず、塊が箱からはみ出さない。
test('LP pages have no horizontal overflow on mobile (LP line breaks)', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const failures: string[] = [];

  for (const route of [...LP_ROUTES, ...LP_ZH_ROUTES]) {
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
    throw new Error(`LP pages overflow on mobile:\n${failures.join('\n')}`);
  }
});
