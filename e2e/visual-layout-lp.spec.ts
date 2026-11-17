import { test, type Page } from '@playwright/test';

// LP と一覧の page（top・about・サービス・contact・実績・お知らせ・blog）の、配置と改行の決まり
// （docs/design/layout-rules.md の R1・R2）を見る。手本は e2e/visual-text.spec.ts の
// 「line breaks」の試験（待ち方・animation を止める・許す幅は同じ）。
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
      const issues = await page.evaluate(() => {
        const failures: string[] = [];

        const lineCount = (element: Element): number => {
          const range = document.createRange();
          range.selectNodeContents(element);
          const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
          // inline-block の中の文字は、同じ行でも top が数 px ずれて 2 つの rect になる。
          // 行の間隔（line-height）より十分小さい 8px を同じ行とみなす。
          const tops: number[] = [];
          for (const rect of rects) {
            if (!tops.some((top) => Math.abs(top - rect.top) <= 8)) tops.push(rect.top);
          }
          range.detach();
          return tops.length;
        };

        // 折り返さない時の幅。同じ要素を nowrap にした複製を作って測り、すぐ消す
        // （元の要素の見た目は変えない）。「1 行のはず」を字数でなく実際の幅で決める:
        // OS ごとに font の幅が違い、同じ字数でも幅が変わるため。width は max-content で
        // 測る（auto だと複製が箱の幅に切り詰められ、本当の幅より小さく出る事がある）。
        const unwrappedWidth = (element: Element): number => {
          const clone = element.cloneNode(true) as HTMLElement;
          clone.style.position = 'absolute';
          clone.style.visibility = 'hidden';
          clone.style.whiteSpace = 'nowrap';
          clone.style.maxWidth = 'none';
          clone.style.display = 'inline-block';
          clone.style.width = 'max-content';
          element.parentElement?.appendChild(clone);
          const width = clone.getBoundingClientRect().width;
          clone.remove();
          return width;
        };

        // 箱（要素の中身の幅。padding は引く）。inline の要素（span の中の span など）は
        // 幅が 0 なので、幅を持つ block の祖先まで上がってから測る。見えていない要素
        // （閉じた開閉の中など）は 0 のまま返る。
        const contentBoxWidth = (element: Element): number => {
          let current: Element | null = element;
          while (current && current !== document.documentElement) {
            const style = window.getComputedStyle(current);
            if (!style.display.startsWith('inline')) {
              const width = (current as HTMLElement).clientWidth;
              if (width > 0) {
                return width - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight);
              }
            }
            current = current.parentElement;
          }
          return 0;
        };

        const clauseBoxWidth = (element: Element): number => contentBoxWidth(element.parentElement ?? element);

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

        // 塊の 1 つ 1 つは 1 行（折り返さない時の幅が箱より長い塊は除く。許す幅 2px。
        // 見えていない塊（幅 0）は対象外）。
        const headingClauses = Array.from(
          document.querySelectorAll('main h1 .lb-clause, main h2 .lb-clause, main h3 .lb-clause'),
        );
        if (headingClauses.length === 0) failures.push('題の塊（.lb-clause）が 1 つも無い');
        for (const clause of headingClauses) {
          const unwrapped = unwrappedWidth(clause);
          if (unwrapped <= 0) continue;
          const box = clauseBoxWidth(clause);
          if (unwrapped > box + 2) continue;
          const lines = lineCount(clause);
          if (lines !== 1) {
            failures.push(`題の塊が ${lines} 行に割れている: ${(clause.textContent ?? '').slice(0, 40)}`);
          }
        }

        // main の中に文の印が 1 つ以上在る。折り返さない時の幅が箱（文を入れる要素の
        // 中身の幅）に収まる文は 1 行（許す幅 2px）。見えていない文（閉じた開閉の中など・
        // 行が測れない）は対象外。字数は落ちた時の文に出すだけ。
        const sentences = Array.from(document.querySelectorAll('main .lb-sentence'));
        if (sentences.length === 0) failures.push('.lb-sentence が 1 つも無い');
        for (const sentence of sentences) {
          const text = (sentence.textContent ?? '').replace(/\s+/g, '');
          if (text.length === 0) continue;
          const lines = lineCount(sentence);
          if (lines === 0) continue;
          const box = contentBoxWidth(sentence);
          const unwrapped = unwrappedWidth(sentence);
          if (unwrapped <= box + 2 && lines !== 1) {
            const fontSize = Number.parseFloat(window.getComputedStyle(sentence).fontSize) || 16;
            failures.push(
              `文が 1 行に収まらない（折り返さない時 ${unwrapped.toFixed(1)}px / 箱 ${box.toFixed(1)}px・${Array.from(text).length} 字 / 列 ${(box / fontSize).toFixed(1)} 字）: ${text.slice(0, 40)}`,
            );
          }
        }

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
        for (const sentence of sentences) {
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
