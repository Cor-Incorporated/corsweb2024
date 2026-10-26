// Issue #323 B-1〜B-3: ビルド済み dist に対する /contact の回帰ガード（設定: vitest.dist.config.ts）。
// `npm run build` の後に `npm run test:dist` で実行する（CI: .github/workflows/ci.yml の verify ジョブ）。
// 判定基準は src/config/contact-guards.ts に一本化している（#322 の合成監視と共有）。
// このファイルには「dist をどう読むか」と「実物に対して判定が空振りしないこと」だけを書く。
//
// HTML の解析とランチャー初期化スクリプトの実行には jsdom を使う。jsdom は既定で iframe・外部
// スクリプトなどのサブリソースを読み込まないため、テスト中にネットワークへは出ない。
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'astro/zod';
import { JSDOM, VirtualConsole } from 'jsdom';
import { describe, expect, it } from 'vitest';
import {
  CLOUDIA_CHAT_PATH,
  CLOUDIA_SPA_ROOT_ID,
  CONTACT_PAGE_PATHS,
  LAUNCHER_FALLBACK_LINK_SELECTOR,
  PRIVACY_PAGE_PATHS,
  findCalendarCopyMismatches,
  findContactSelfLoops,
  findLauncherFallbackSelfLinks,
  findPhoneInquiryLeads,
  findPhoneInquiryPhrases,
  findPhoneLeads,
  hasCalendarEmbed,
  inspectCloudiaChatDocument,
  isCloudiaChatHtmlServed,
  isContactPagePath,
} from '../../src/config/contact-guards';
import { PHONE_INQUIRY_ACCIDENTS } from '../fixtures/phone-inquiry-accidents';

// 反証の実測では、壊した dist の複製を CONTACT_GUARD_DIST_DIR で渡す（既定は ./dist）。
const DIST_DIR = path.resolve(process.env.CONTACT_GUARD_DIST_DIR || 'dist');
// その dist を作ったビルドの条件（ci.yml が渡す）。'0' = カレンダーなし、'1' = カレンダーあり（ダミー ID）。
// 未設定（ローカル実行）なら状態は検査しない。'0' / '1' 以外はここで落とす。
const EXPECT_CALENDAR = z
  .enum(['0', '1'])
  .optional()
  .parse(process.env.CONTACT_GUARD_EXPECT_CALENDAR || undefined);
const LOCALES = Object.keys(CONTACT_PAGE_PATHS) as ReadonlyArray<keyof typeof CONTACT_PAGE_PATHS>;
// 注入テストで使う架空のカレンダー埋め込み（カレンダーなしの dist で「ある状態」を作るとき用）。
const CALENDAR_IFRAME_FIXTURE =
  '<iframe src="https://calendar.google.com/calendar/embed?src=fixture%40example.invalid"></iframe>';

type DistPage = { readonly document: Document; readonly pageUrl: URL };
type LauncherRun = { readonly document: Document; readonly errors: readonly string[] };

function loadDistPage(urlPath: string): DistPage {
  const file = path.join(DIST_DIR, ...urlPath.split('/').filter(Boolean), 'index.html');
  if (!existsSync(file)) {
    throw new Error(`${file} が無い。先に npm run build を実行すること（dist=${DIST_DIR}）`);
  }
  const document: Document = new JSDOM(readFileSync(file, 'utf8')).window.document;
  const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
  if (!canonical) {
    throw new Error(`${urlPath}: canonical が無く、ページ URL を決められない`);
  }
  const pageUrl = new URL(canonical);
  if (pageUrl.pathname !== urlPath) {
    throw new Error(`${urlPath}: canonical のパスが一致しない（observed ${pageUrl.pathname}）`);
  }
  return { document, pageUrl };
}

function extractLauncher(page: DistPage): { readonly asideHtml: string; readonly script: string } {
  const aside = page.document.getElementById('cloudia-launcher');
  const scripts = Array.from(page.document.querySelectorAll('script:not([src])'), (script) => script.textContent ?? '')
    .filter((text) => text.includes('cloudia-launcher-fallback'));
  if (!aside || scripts.length !== 1) {
    throw new Error(
      `${page.pageUrl.pathname}: ランチャーを特定できない（aside=${Boolean(aside)}, 初期化スクリプト=${scripts.length} 本）`
    );
  }
  return { asideHtml: aside.outerHTML, script: scripts[0] };
}

// CloudiaLauncher の初期化スクリプトを、指定した URL のページとして実際に動かす。
// scriptRuns: ViewTransitions はランチャーの無いページ（/contact/chat/ のプレースホルダ）を経て戻ると、
// このスクリプトをもう一度実行する。その状態を再現するときは 2 を渡す。
function runLauncher(
  page: DistPage,
  url: URL,
  scriptRuns = 1,
  beforeScripts?: (window: JSDOM['window']) => void
): LauncherRun {
  const { asideHtml, script } = extractLauncher(page);
  const errors: string[] = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error: Error) => errors.push(error.message));
  const dom = new JSDOM(`<!doctype html><html><body>${asideHtml}</body></html>`, {
    url: url.href,
    runScripts: 'outside-only',
    virtualConsole,
  });
  beforeScripts?.(dom.window);
  for (let run = 0; run < scriptRuns; run += 1) dom.window.eval(script);
  dom.window.document.dispatchEvent(new dom.window.Event('astro:page-load'));
  return { document: dom.window.document, errors };
}

// 開いている間はフォールバックの待ち（8 秒）と iframe の確認（250ms ごと）のタイマーが動くので、
// 開いたテストは最後に window を閉じてタイマーを止める。
function clickLauncherButton(run: LauncherRun): HTMLElement {
  const button = run.document.getElementById('cloudia-launcher-open');
  if (!button) throw new Error('#cloudia-launcher-open が無い');
  button.click();
  return button;
}

function closeLauncherRun(run: LauncherRun): void {
  run.document.defaultView?.close();
}

function lastMain(document: Document): Element {
  const mains = Array.from(document.querySelectorAll('main'));
  if (mains.length === 0) throw new Error('<main> が無い');
  return mains[mains.length - 1];
}

describe('B-1 5 言語の /contact に電話導線が無い（語レベル）', () => {
  it.each(LOCALES)('%s', (locale) => {
    const { document } = loadDistPage(CONTACT_PAGE_PATHS[locale]);
    expect(findPhoneLeads(document)).toEqual([]);
  });
});

// スクリプトが表示する文言は実行後の DOM で見る（ADR-0021 §1）。CloudiaLauncher は /contact 上で、チャットを
// 開けないときの文言を data-fallback-same-page から差し込む。静的な照合では data-* は対象外なので、ここで見る。
describe('B-1 5 言語の /contact: ランチャー実行後に表示される文言にも電話導線が無い', () => {
  it.each(LOCALES)('%s', (locale) => {
    const page = loadDistPage(CONTACT_PAGE_PATHS[locale]);
    const run = runLauncher(page, page.pageUrl);
    expect(run.errors).toEqual([]);
    expect(findPhoneLeads(run.document)).toEqual([]);
    // ボタンを押した後に差し込まれる文言（data-label-close）も見る。
    clickLauncherButton(run);
    expect(findPhoneLeads(run.document)).toEqual([]);
    closeLauncherRun(run);
  });
});

// e2e（e2e/contact-cloudia.spec.ts）は CI で走らないので、開閉の文言と言語は dist の実物でも固定する。
describe('ランチャーのボタンは開いている間「閉じる」の文言になり、押すと閉じる（5 言語）', () => {
  const enLabels = (() => {
    const run = runLauncher(loadDistPage(CONTACT_PAGE_PATHS.en), loadDistPage(CONTACT_PAGE_PATHS.en).pageUrl);
    const button = run.document.getElementById('cloudia-launcher-open');
    return { open: button?.getAttribute('data-label-open'), close: button?.getAttribute('data-label-close') };
  })();

  it.each(LOCALES)('%s', (locale) => {
    const page = loadDistPage(CONTACT_PAGE_PATHS[locale]);
    const run = runLauncher(page, page.pageUrl);
    const button = run.document.getElementById('cloudia-launcher-open');
    const labelOpen = button?.getAttribute('data-label-open');
    const labelClose = button?.getAttribute('data-label-close');
    const xLabel = run.document.getElementById('cloudia-launcher-close')?.getAttribute('aria-label');
    expect(run.errors).toEqual([]);
    expect(labelOpen).toBeTruthy();
    expect(labelClose).toBeTruthy();
    // × ボタンと同じ名前だと、読み上げで 2 つの「閉じる」が並ぶ。
    expect(labelClose).not.toBe(xLabel);
    if (locale !== 'en') {
      // 以前は ja 以外がすべて英語だった。
      expect(labelOpen).not.toBe(enLabels.open);
      expect(labelClose).not.toBe(enLabels.close);
    }

    expect(button?.textContent?.trim()).toBe(labelOpen);
    clickLauncherButton(run);
    expect(button?.getAttribute('aria-expanded')).toBe('true');
    expect(button?.textContent?.trim()).toBe(labelClose);
    clickLauncherButton(run);
    expect(button?.getAttribute('aria-expanded')).toBe('false');
    expect(button?.textContent?.trim()).toBe(labelOpen);
    closeLauncherRun(run);
  });

  it.each(['zh', 'ko', 'es'] as const)('%s の /contact の Cloudia の案内が英語のままでない', (locale) => {
    const enTitle = loadDistPage(CONTACT_PAGE_PATHS.en).document.getElementById('cloudia-contact-entry-title')?.textContent;
    const title = loadDistPage(CONTACT_PAGE_PATHS[locale]).document.getElementById('cloudia-contact-entry-title')?.textContent;
    expect(title).toBeTruthy();
    expect(title).not.toBe(enTitle);
  });

  // ランチャーの無いページを経て戻ると、スクリプトがもう一度実行される。開閉を 2 回束縛すると、
  // 2 つの受け手の opened がずれる（Escape は最後の受け手にしか届かない）。いまは最後の受け手が
  // 勝つので見た目は合うが、内部の状態がずれたまま残る。見た目では分からないので、束縛の数を数える。
  // /contact では 1 回目の初期化がフォールバックのリンクを消すので、2 回目は早く抜けて二重にならない。
  // 二重になるのは /contact 以外のページなので、トップで確かめる。
  it('スクリプトが 2 回実行されても、ボタンの開閉は 1 回だけ束縛する（トップ）', () => {
    const page = loadDistPage('/');
    let openButtonClickBindings = 0;
    const run = runLauncher(page, page.pageUrl, 2, (window) => {
      const original = window.EventTarget.prototype.addEventListener;
      window.EventTarget.prototype.addEventListener = function (
        this: EventTarget,
        ...args: Parameters<EventTarget['addEventListener']>
      ) {
        if (args[0] === 'click' && (this as Element).id === 'cloudia-launcher-open') openButtonClickBindings += 1;
        return original.apply(this, args);
      };
    });
    expect(run.errors).toEqual([]);
    expect(openButtonClickBindings).toBe(1);

    const panel = run.document.getElementById('cloudia-launcher-panel');
    clickLauncherButton(run);
    expect(panel?.getAttribute('aria-hidden')).toBe('false');
    run.document.dispatchEvent(new run.document.defaultView!.KeyboardEvent('keydown', { key: 'Escape' }));
    expect(panel?.getAttribute('aria-hidden')).toBe('true');
    const button = clickLauncherButton(run);
    expect(panel?.getAttribute('aria-hidden')).toBe('false');
    expect(button.textContent?.trim()).toBe(button.getAttribute('data-label-close'));
    closeLauncherRun(run);
  });
});

// /privacy は収集項目として「電話番号」が正当に載るため、語ではなく句・番号・tel: で判定する（#323 背景 1 の事故現場）。
describe('B-1 5 言語の /privacy に「電話で受け付ける」旨・電話番号・tel: が無い（#323 背景 1）', () => {
  it.each(LOCALES)('%s', (locale) => {
    const { document } = loadDistPage(PRIVACY_PAGE_PATHS[locale]);
    expect(findPhoneInquiryLeads(document)).toEqual([]);
  });
});

describe('B-2 <details> の文言とカレンダーが整合している', () => {
  it.each(LOCALES)('%s', (locale) => {
    const { document } = loadDistPage(CONTACT_PAGE_PATHS[locale]);
    // 検査対象が消えて素通りになっていないこと（details が無ければ判定は常に空になる）。
    expect(document.querySelectorAll('details').length).toBeGreaterThan(0);
    expect(findCalendarCopyMismatches(document)).toEqual([]);
  });
});

// ビルド条件どおりにカレンダーが描画されたか（#331 再レビュー MEDIUM-1）。これが無いと、
// カレンダーありのビルドが何かの理由でカレンダーなしの HTML になっても B-2 の逆向き
// （calendar-without-claim）は評価されず、2 回目の test:dist が気づかれずに空振りする。
describe.runIf(EXPECT_CALENDAR !== undefined)('ビルド条件どおりのカレンダー状態（CONTACT_GUARD_EXPECT_CALENDAR）', () => {
  it.each(LOCALES)('%s', (locale) => {
    const { document } = loadDistPage(CONTACT_PAGE_PATHS[locale]);
    const rendered = Array.from(document.querySelectorAll('details')).some(hasCalendarEmbed);
    expect({ locale, rendered }).toEqual({ locale, rendered: EXPECT_CALENDAR === '1' });
  });
});

describe('B-3 /contact/chat/ の <main> から /contact/ へ送り返さない', () => {
  it('プレースホルダページ', () => {
    const { document, pageUrl } = loadDistPage(CLOUDIA_CHAT_PATH);
    expect(document.querySelectorAll('main').length).toBeGreaterThan(0);
    expect(findContactSelfLoops(document, pageUrl)).toEqual([]);
  });
});

describe('B-3 /contact 上のランチャーのフォールバックが自分自身へのリンクにならない', () => {
  // ViewTransitions 後の /contact（末尾スラッシュ無し）と /contact/index.html も同じページとして扱う。
  const cases = LOCALES.flatMap((locale) => {
    const canonicalPath = CONTACT_PAGE_PATHS[locale];
    return [canonicalPath, canonicalPath.slice(0, -1), `${canonicalPath}index.html`].map(
      (visitedPath) => [locale, visitedPath] as const
    );
  });

  it.each(cases)('%s（%s で表示）', (locale, visitedPath) => {
    const page = loadDistPage(CONTACT_PAGE_PATHS[locale]);
    const visitedUrl = new URL(visitedPath, page.pageUrl);
    const run = runLauncher(page, visitedUrl);
    expect(run.errors).toEqual([]);
    expect(findLauncherFallbackSelfLinks(run.document, visitedUrl)).toEqual([]);
    // 導線を消しただけで「お問い合わせページから開き直して」の案内が残ると、従えない指示になる。
    const samePageText = run.document.getElementById('cloudia-launcher')?.getAttribute('data-fallback-same-page');
    expect(samePageText).toBeTruthy();
    expect(run.document.querySelector('#cloudia-launcher-fallback p')?.textContent).toBe(samePageText);
  });

  // 陽性対照: 別ページではフォールバックが /contact/ への正しい導線として残る（判定が常に空でないこと）。
  it.each(['/', '/en/'])('別ページ %s ではフォールバックが /contact/ へ残る', (homePath) => {
    const page = loadDistPage(homePath);
    const run = runLauncher(page, page.pageUrl);
    const links = Array.from(run.document.querySelectorAll(LAUNCHER_FALLBACK_LINK_SELECTOR));
    expect(run.errors).toEqual([]);
    expect(links).toHaveLength(1);
    expect(isContactPagePath(new URL(links[0].getAttribute('href') ?? '', page.pageUrl).pathname)).toBe(true);
    expect(findLauncherFallbackSelfLinks(run.document, page.pageUrl)).toEqual([]);
  });
});

// F2: dist の実物に既知の事故入力を注入し、判定が赤になることを毎回確かめる。
// ページ構造が変わって判定が空振りし始めたら（素通り）、ここが先に落ちる。
// 件数を数える注入テストは「注入前との差分」で判定する。dist がすでに壊れているときは本体の
// B-1〜B-3 だけが落ち、ここは巻き添えで落ちない（失敗の報告先を 1 か所に保つ）。
describe('反証: dist の実物へ事故を注入すると検出する', () => {
  it('zh の /contact に「电话」が出る', () => {
    const { document } = loadDistPage(CONTACT_PAGE_PATHS.zh);
    lastMain(document).insertAdjacentHTML('beforeend', '<p>也可以通过电话联系我们。</p>');
    expect(findPhoneLeads(document).map((finding) => finding.match)).toContain('电话');
  });

  it.each(LOCALES)('%s の /privacy に削除済みの「電話でも受け付ける」文言が戻る（#323 背景 1）', (locale) => {
    const { document } = loadDistPage(PRIVACY_PAGE_PATHS[locale]);
    const before = findPhoneInquiryPhrases(document).length;
    lastMain(document).insertAdjacentHTML('beforeend', `<p>${PHONE_INQUIRY_ACCIDENTS[locale].privacy}</p>`);
    expect(findPhoneInquiryPhrases(document).length).toBeGreaterThan(before);
  });

  // #331 再レビュー MEDIUM-1: 「チャットが落ちたら電話を案内する」は #323 の回帰として最も起きやすい形。
  // 静的な照合では読めない（data-* は対象外）が、ランチャー実行後の DOM で検出する。
  it('/contact のランチャーの data-fallback-same-page に電話の案内が入る（実行後に表示される）', () => {
    const page = loadDistPage(CONTACT_PAGE_PATHS.ja);
    page.document
      .getElementById('cloudia-launcher')
      ?.setAttribute('data-fallback-same-page', 'お急ぎの方はお電話（092-000-0000）でご連絡ください');
    expect(findPhoneLeads(page.document)).toEqual([]);
    const kinds = findPhoneLeads(runLauncher(page, page.pageUrl).document).map((finding) => finding.kind);
    expect(kinds).toEqual(expect.arrayContaining(['text', 'number']));
  });

  // ボタンを押した後にだけ表示される文言（data-label-close）も、押した後の DOM で検出する。
  it('ランチャーのボタンの「閉じる」の文言に電話の案内が入る（押した後に表示される）', () => {
    const page = loadDistPage(CONTACT_PAGE_PATHS.ja);
    page.document
      .getElementById('cloudia-launcher-open')
      ?.setAttribute('data-label-close', '閉じる（お急ぎはお電話 092-000-0000）');
    const run = runLauncher(page, page.pageUrl);
    expect(findPhoneLeads(run.document)).toEqual([]);
    clickLauncherButton(run);
    expect(findPhoneLeads(run.document).map((finding) => finding.kind)).toEqual(
      expect.arrayContaining(['text', 'number'])
    );
    closeLauncherRun(run);
  });

  it('ja の /privacy に語を伴わない番号（TEL 092-000-0000）が出る', () => {
    const { document } = loadDistPage(PRIVACY_PAGE_PATHS.ja);
    const before = findPhoneInquiryLeads(document).length;
    lastMain(document).insertAdjacentHTML('beforeend', '<p>お問合せ窓口 TEL 092-000-0000</p>');
    const after = findPhoneInquiryLeads(document);
    expect(after).toHaveLength(before + 1);
    expect(after.map((finding) => finding.kind)).toContain('number');
  });

  it('en の /contact に tel: リンクが戻る', () => {
    const { document } = loadDistPage(CONTACT_PAGE_PATHS.en);
    lastMain(document).insertAdjacentHTML('beforeend', '<a href="tel:+810000000000">0000</a>');
    expect(findPhoneLeads(document).map((finding) => finding.kind)).toContain('tel-link');
  });

  // 語を伴わず番号だけが出る回帰（番号は架空）。
  it.each([
    ['ja', '092-000-0000'],
    ['es', '+81 92-000-0000'],
  ] as const)('%s の /contact に電話番号だけ（%s）が出る', (locale, number) => {
    const { document } = loadDistPage(CONTACT_PAGE_PATHS[locale]);
    lastMain(document).insertAdjacentHTML('beforeend', `<p>${number}</p>`);
    expect(findPhoneLeads(document).map((finding) => finding.kind)).toContain('number');
  });

  // 陽性対照: 法令で番号を表示する特商法ページ（B-1 の対象外）では、サイト自身が出している
  // 表記（国内表記・+81 表記）を番号として検出できる。表記が変わって空振りし始めたらここが落ちる。
  it.each(['/legal/tokushoho/', '/en/legal/tokushoho/'])('特商法ページ %s の番号を検出できる', (legalPath) => {
    const { document } = loadDistPage(legalPath);
    expect(findPhoneLeads(document).map((finding) => finding.kind)).toContain('number');
  });

  it('format-detection の meta を足しても誤検出しない', () => {
    const { document } = loadDistPage(CONTACT_PAGE_PATHS.ja);
    const before = findPhoneLeads(document);
    document.head.insertAdjacentHTML('beforeend', '<meta name="format-detection" content="telephone=no">');
    expect(findPhoneLeads(document)).toEqual(before);
  });

  it.each(LOCALES)('%s: カレンダーが無いのに時間帯を断言する（#323 背景 4）', (locale) => {
    const { document } = loadDistPage(CONTACT_PAGE_PATHS[locale]);
    const details = document.querySelector('details');
    const summary = details?.querySelector('summary');
    if (!details || !summary) throw new Error(`${locale}: details / summary が無い`);
    details.querySelectorAll('iframe').forEach((iframe) => iframe.remove());
    summary.textContent = '所在地・打ち合わせ可能な時間を見る';
    expect(findCalendarCopyMismatches(document).map((finding) => finding.kind)).toEqual([
      'claim-without-calendar',
    ]);
  });

  // 逆向き（#331 再レビュー MEDIUM-1）: カレンダーがあるのに見出しが案内しない。カレンダーありの dist では
  // 実物のカレンダーをそのまま使い、カレンダーなしの dist では架空の埋め込みを足して同じ状態を作る。
  it.each(LOCALES)('%s: カレンダーがあるのに見出しが時間帯を案内しない（calendar-without-claim）', (locale) => {
    const { document } = loadDistPage(CONTACT_PAGE_PATHS[locale]);
    const details = document.querySelector('details');
    const summary = details?.querySelector('summary');
    if (!details || !summary) throw new Error(`${locale}: details / summary が無い`);
    if (!hasCalendarEmbed(details)) details.insertAdjacentHTML('beforeend', CALENDAR_IFRAME_FIXTURE);
    summary.textContent = '所在地を見る';
    expect(findCalendarCopyMismatches(document).map((finding) => finding.kind)).toEqual([
      'calendar-without-claim',
    ]);
  });

  it.each(['/contact/', '../'])('/contact/chat/ の <main> に %s へのリンクが入る（#323 背景 2）', (href) => {
    const { document, pageUrl } = loadDistPage(CLOUDIA_CHAT_PATH);
    const before = findContactSelfLoops(document, pageUrl).length;
    lastMain(document).insertAdjacentHTML('beforeend', `<a href="${href}">お問い合わせページへ戻る</a>`);
    expect(findContactSelfLoops(document, pageUrl)).toHaveLength(before + 1);
  });

  it.each(LOCALES)('%s: 初期化スクリプトが動かなければ自己リンクが残る（#323 背景 3）', (locale) => {
    const page = loadDistPage(CONTACT_PAGE_PATHS[locale]);
    expect(findLauncherFallbackSelfLinks(page.document, page.pageUrl)).toHaveLength(1);
  });
});

describe('C 判定基準 ↔ ビルド出力（#322 の合成監視と共有）', () => {
  it('/contact/chat/ のプレースホルダは「Cloudia 未配信」と判定される', () => {
    const { document, pageUrl } = loadDistPage(CLOUDIA_CHAT_PATH);
    const inspection = inspectCloudiaChatDocument(document, pageUrl);
    expect(inspection).toEqual({
      hasSpaRoot: false,
      entryScriptUrls: [],
      preloadScriptUrls: [],
      placeholderLocales: ['ja'],
    });
    expect(isCloudiaChatHtmlServed(inspection)).toBe(false);
  });

  it('ランチャーの readiness 判定は監視と同じ #root を見ている', () => {
    const { script } = extractLauncher(loadDistPage(CONTACT_PAGE_PATHS.ja));
    expect(script).toMatch(new RegExp(`getElementById\\((["'])${CLOUDIA_SPA_ROOT_ID}\\1\\)`, 'u'));
  });
});
