// /contact の回帰ガードの判定基準（Issue #323 B-1〜B-3・C）。
// B-1 は /contact（語レベル）と /privacy（句レベル）の 2 段構え。詳細は B-1 節を参照。
//
// ここが唯一の定義。ビルド済み dist の検査（tests/build-output/contact-regression.test.ts）と
// Cloudia 可用性の合成監視（Issue #322）は、この値と関数を import して同じ基準で判定する。
// 文言や判定を別の場所へ書き写さないこと（片方だけ直して食い違うのを防ぐ）。
//
// 可搬性の約束（#322 の監視スクリプトからそのまま import できるように）:
// - 実行時 import を持たない（型だけを import する）。import.meta.env も参照しない。
// - 判定関数は標準 DOM API（querySelectorAll / getAttribute / textContent / cloneNode）だけを
//   使う。jsdom・happy-dom・ブラウザのどの Document を渡しても同じ基準で判定する。
// - 渡された Document は変更しない（加工が必要なときは複製してから行う）。
import type { Locale } from '../utils/i18n';

// ---------------------------------------------------------------------------
// 対象パス
// ---------------------------------------------------------------------------

/** 5 言語の問い合わせページ。6 言語目を足すと satisfies により型エラーになる。 */
export const CONTACT_PAGE_PATHS = {
  ja: '/contact/',
  en: '/en/contact/',
  zh: '/zh/contact/',
  ko: '/ko/contact/',
  es: '/es/contact/',
} as const satisfies Record<Locale, string>;

/** 5 言語のプライバシーポリシー（B-1 の句レベル検査の対象）。 */
export const PRIVACY_PAGE_PATHS = {
  ja: '/privacy/',
  en: '/en/privacy/',
  zh: '/zh/privacy/',
  ko: '/ko/privacy/',
  es: '/es/privacy/',
} as const satisfies Record<Locale, string>;

/**
 * Cloudia SPA の配信パス。本番では別途デプロイされた SPA が配信され、本リポジトリの
 * ビルドでは SPA 未配信時のプレースホルダ（ja のみ・src/pages/contact/chat/index.astro）が出る。
 */
export const CLOUDIA_CHAT_PATH = '/contact/chat/';

// ---------------------------------------------------------------------------
// B-1: 電話導線の不在（2 段構え）
// - /contact（問い合わせの入口）: 電話を指す語・電話番号・tel: リンクが一切出ないこと（語レベル）。
// - /privacy: 収集項目として「電話番号」が正当に載る（zh「电话号码」・ko「전화번호」など）ため、
//   語レベルでは誤検知する。「電話で受け付ける／電話してほしい」を述べる句で判定する（句レベル）。
//   #323 背景 1（zh/ko/es のプライバシーポリシーに「電話でも受け付ける」が残存）はこちらの事故。
// ---------------------------------------------------------------------------

/**
 * /contact に出てはならない、電話を指す語。言語ごとに持ち、satisfies で 5 言語すべてを必須にする。
 * 背景 1 の教訓（日本語・英語のパターンだけで検索して zh/ko/es の残存を見逃した）を当てはめ、
 * ページの言語では絞らず全言語のパターンを全ページに当てる（zh/ko/es に英語文言がそのまま出た
 * 事故もあったため）。Issue #323 の検索式 `電話|电话|전화|[Tt]el[eé]f[oó]n|[Pp]hone|telephone|call us`
 * を包含し、大文字小文字は区別しない（文頭の "Call us" や "PHONE" も拾う）。
 */
export const PHONE_LEAD_PATTERNS = {
  ja: /電話/iu,
  en: /phone|telephone|call us/iu,
  zh: /电话|電話/iu,
  ko: /전화/iu,
  es: /tel[eé]f[oó]n/iu,
} as const satisfies Record<Locale, RegExp>;

/**
 * 電話誘導の検査から除外する meta 要素の name（大文字小文字は区別しない）。
 * `<meta name="format-detection" content="telephone=no">` は iOS Safari の番号自動リンク化を
 * 止める指定で、誘導ではない（ブログ全ページに入っており、除外しないと誤検出する）。
 */
export const PHONE_LEAD_EXCLUDED_META_NAMES = ['format-detection'] as const;

/**
 * 電話番号そのもの（/contact 用）。語を伴わず番号だけが出る回帰を捕まえる。
 * 国際表記（+81 …）と国内表記（0 始まりのハイフン区切り: 070-1234-5678 / 0120-123-456）。
 * base64・SVG のパスデータ・日付や郵便番号・長い数字列の一部に一致しないよう前後を制限している。
 * 実測（2026-09-27・dist 全 481 ページ）で一致したのは、法令で番号を表示する特商法ページ 5 言語だけ。
 */
export const PHONE_NUMBER_PATTERN =
  /(?<![A-Za-z0-9+/])\+81[\s\-.()]*\d|(?<![\d.\-])0\d{1,4}-\d{1,4}-\d{3,4}(?!\d)/u;

/**
 * 「電話で問い合わせ・相談を受け付ける／電話で連絡してほしい」を述べる句（/privacy 用の句レベル）。
 * 「電話番号」のような収集項目には一致しない。PR #324（ad40cd6）が削除した実際の文言
 * （tests/fixtures/phone-inquiry-accidents.ts）にすべて一致することをユニットテストで固定している。
 * zh の実例は「或电话受理」で、「通过电话」「电话咨询」だけでは拾えない点に注意。
 */
export const PHONE_INQUIRY_PHRASE_PATTERNS = {
  ja: /お電話(?!番号)|電話(?:でも|にて|で(?:の)?(?:ご?連絡|お?問い?合わせ|ご?相談|受け?付|承))/u,
  en: /by (?:tele)?phone|over the (?:tele)?phone|via (?:tele)?phone|(?:call|phone|ring) us\b|telephone us/iu,
  zh: /或电话|电话(?:受理|联系|咨询|预约)|通过电话|致电|拨打|或電話|電話(?:受理|聯繫|諮詢)|透過電話/u,
  ko: /전화로|전화\s?(?:문의|상담|접수|연락)/u,
  es: /por tel[eé]fono|v[ií]a telef[oó]nica|telef[oó]nicamente|ll[aá]m(?:enos|anos|arnos)/iu,
} as const satisfies Record<Locale, RegExp>;

export type PhoneLeadFinding = {
  readonly kind: 'text' | 'number' | 'tel-link' | 'phrase';
  readonly match: string;
  readonly context: string;
};

/**
 * /contact 用（語レベル）。本文・属性値・インラインスクリプトを含む HTML 全体に
 * PHONE_LEAD_PATTERNS と PHONE_NUMBER_PATTERN を当て（除外 meta を除く）、加えて tel: リンクを構造で拾う。
 */
export function findPhoneLeads(document: Document): PhoneLeadFinding[] {
  const html = serializeWithoutExcludedMeta(document);
  const textFindings = findingsIn(html, combineGlobal(PHONE_LEAD_PATTERNS), 'text');
  const numberFindings = findingsIn(html, new RegExp(PHONE_NUMBER_PATTERN.source, 'gu'), 'number');
  const telLinkFindings = Array.from(document.querySelectorAll('a[href], area[href]'))
    .map((element) => (element.getAttribute('href') ?? '').trim())
    .filter((href) => /^tel:/iu.test(href))
    .map((href) => ({ kind: 'tel-link' as const, match: href, context: href }));
  return [...textFindings, ...numberFindings, ...telLinkFindings];
}

/** /privacy 用（句レベル）。「電話番号」のような収集項目の記載は拾わない。 */
export function findPhoneInquiryPhrases(document: Document): PhoneLeadFinding[] {
  const html = serializeWithoutExcludedMeta(document);
  return findingsIn(html, combineGlobal(PHONE_INQUIRY_PHRASE_PATTERNS), 'phrase');
}

// ---------------------------------------------------------------------------
// B-2: 文言と DOM の整合（カレンダー）
// ---------------------------------------------------------------------------

/** Google カレンダー埋め込みのホスト（Calendar.astro が https://calendar.google.com/calendar/embed を組み立てる）。 */
export const CALENDAR_EMBED_HOST = 'calendar.google.com';

/**
 * 「打ち合わせ可能な時間を確認できる」系の断言。CloudiaContactEntry.astro の
 * FALLBACK_WITH_CALENDAR（カレンダーあり）の文言には一致し、FALLBACK_WITHOUT_CALENDAR
 * （カレンダーなし）の文言には一致しないこと。この対応は src/config/__tests__/contact-guards.test.ts が
 * ソースを読んで検証する（文言だけ書き換わって判定が空振りするのを防ぐ）。
 */
export const AVAILABILITY_CLAIM_PATTERNS = {
  ja: /打ち合わせ可能|打合せ可能|空き時間/iu,
  en: /available times|available to meet|availability/iu,
  zh: /可洽谈|洽谈的时间|空闲时间/iu,
  ko: /미팅[이가]?\s*가능|가능한\s*시간대/iu,
  es: /horarios disponibles|podemos reunirnos|disponibilidad/iu,
} as const satisfies Record<Locale, RegExp>;

export type CalendarCopyFinding = {
  readonly kind: 'claim-without-calendar' | 'calendar-without-claim';
  readonly detailsId: string | null;
  readonly text: string;
};

/**
 * `<details>` ごとに文言とカレンダーの有無を突き合わせる。
 * - claim-without-calendar: 中身が時間帯に言及しているのに、同じ details 内にカレンダーが無い
 *   （PUBLIC_GCAL_ID 未設定ビルドで説明文だけが断言していた事故 = #323 背景 4）。
 * - calendar-without-claim: カレンダーがあるのに、見出し（summary）がそれを案内していない
 *   （文言の書き換えで AVAILABILITY_CLAIM_PATTERNS が空振りしている兆候でもある）。
 * どちらの状態（PUBLIC_GCAL_ID の有無）のビルドでも、正しい実装なら結果は空になる。
 */
export function findCalendarCopyMismatches(root: ParentNode): CalendarCopyFinding[] {
  return Array.from(root.querySelectorAll('details')).flatMap((details) => {
    const text = normalizeWhitespace(details.textContent);
    const summaryText = normalizeWhitespace(summaryOf(details)?.textContent);
    const hasCalendar = Array.from(details.querySelectorAll('iframe[src]')).some((iframe) =>
      isCalendarEmbedSrc(iframe.getAttribute('src'))
    );
    const claimsAvailability = matchesAny(AVAILABILITY_CLAIM_PATTERNS, text);
    const summaryClaimsAvailability = matchesAny(AVAILABILITY_CLAIM_PATTERNS, summaryText);
    const detailsId = details.getAttribute('id');
    return [
      ...(claimsAvailability && !hasCalendar
        ? [{ kind: 'claim-without-calendar' as const, detailsId, text }]
        : []),
      ...(hasCalendar && !summaryClaimsAvailability
        ? [{ kind: 'calendar-without-claim' as const, detailsId, text: summaryText }]
        : []),
    ];
  });
}

// ---------------------------------------------------------------------------
// B-3: 自己ループの禁止
// ---------------------------------------------------------------------------

/** CloudiaLauncher のフォールバック導線（Cloudia を枠内で開けないときの唯一の出口）。 */
export const LAUNCHER_FALLBACK_LINK_SELECTOR = '[data-cloudia-fallback-link]';

export type SelfLoopFinding = {
  readonly element: string;
  readonly value: string;
  readonly resolved: string;
};

/**
 * 同一ページ判定用のパス正規化。CloudiaLauncher.astro の normalizePath と同じ規則
 * （/index.html を / に畳み、ルート以外の末尾スラッシュを外す）。
 */
export function normalizeSitePath(pathname: string): string {
  const withoutIndex = pathname.replace(/\/index\.html$/u, '/');
  return withoutIndex.length > 1 ? withoutIndex.replace(/\/+$/u, '') : withoutIndex;
}

const NORMALIZED_CONTACT_PAGE_PATHS: ReadonlySet<string> = new Set(
  Object.values(CONTACT_PAGE_PATHS).map(normalizeSitePath)
);

/** いずれかの言語の /contact/ を指すパスか（/contact・/contact/index.html も同じページとみなす）。 */
export function isContactPagePath(pathname: string): boolean {
  return NORMALIZED_CONTACT_PAGE_PATHS.has(normalizeSitePath(pathname));
}

const MAIN_NAVIGATION_SELECTOR = 'main a[href], main area[href], main form[action]';

/**
 * /contact/chat/ から /contact/（全言語）へ送り返す導線を列挙する（#323 背景 2 の無限ループ）。
 * 対象は `<main>` 内のリンク・フォームと、ページ全体の meta refresh。ヘッダー/フッターの
 * 通常ナビは Layout が出す共通導線なので対象外。
 */
export function findContactSelfLoops(root: ParentNode, pageUrl: URL): SelfLoopFinding[] {
  const navigations = Array.from(root.querySelectorAll(MAIN_NAVIGATION_SELECTOR), (element) => ({
    element: element.localName,
    value: element.getAttribute(element.localName === 'form' ? 'action' : 'href') ?? '',
  }));
  const refreshes = Array.from(root.querySelectorAll('meta[http-equiv]'))
    .filter((meta) => (meta.getAttribute('http-equiv') ?? '').toLowerCase() === 'refresh')
    .map((meta) => ({ element: 'meta', value: refreshTargetOf(meta.getAttribute('content')) }));
  return [...navigations, ...refreshes].flatMap(({ element, value }) => {
    const resolved = resolveSameOrigin(value, pageUrl);
    return resolved && isContactPagePath(resolved.pathname)
      ? [{ element, value, resolved: resolved.href }]
      : [];
  });
}

/**
 * ランチャーのフォールバックが「今いるページ」へのリンクになっていないか（#323 背景 3）。
 * 静的 HTML では /contact 上にも自己リンクが出力され、CloudiaLauncher の初期化スクリプトが
 * 実行時に取り除く。したがって初期化スクリプト実行後の DOM に対して使う。
 */
export function findLauncherFallbackSelfLinks(root: ParentNode, pageUrl: URL): SelfLoopFinding[] {
  const currentPath = normalizeSitePath(pageUrl.pathname);
  return Array.from(root.querySelectorAll(LAUNCHER_FALLBACK_LINK_SELECTOR)).flatMap((element) => {
    const value = element.getAttribute('href') ?? '';
    const resolved = resolveSameOrigin(value, pageUrl);
    return resolved && normalizeSitePath(resolved.pathname) === currentPath
      ? [{ element: element.localName, value, resolved: resolved.href }]
      : [];
  });
}

// ---------------------------------------------------------------------------
// C: Cloudia 配信判定（Issue #322 の合成監視と共有）
// ---------------------------------------------------------------------------

/**
 * Cloudia SPA が生きていることを肯定形で判定する要素の id（`<div id="root">`）。
 * CloudiaLauncher.astro の inspectFrame() も同じ要素で readiness を判定しており、
 * 監視とランタイムの「Cloudia が生きている」の定義をここで一致させる。
 */
export const CLOUDIA_SPA_ROOT_ID = 'root';

/** Cloudia SPA のエントリスクリプト。監視はこの URL が 200 を返すことまで確かめる。 */
export const CLOUDIA_SPA_ENTRY_SCRIPT_PATH = /^\/contact\/chat\/assets\/index-[\w-]+\.js$/u;

/**
 * SPA 未配信時に本リポジトリのプレースホルダが出す見出し（src/pages/contact/chat/index.astro）。
 * 素の URL は ja、`?locale=en` のときだけ en。否定形（これが出たら障害）にだけ使い、
 * 出ないことを「生きている」の根拠にしない（アセット 404 の部分障害を取り逃がすため）。
 */
export const CLOUDIA_CHAT_PLACEHOLDER_TITLES = {
  ja: 'AIチャットを準備しています',
  en: 'The AI chat is unavailable',
} as const satisfies Partial<Record<Locale, string>>;

export type CloudiaChatInspection = {
  readonly hasSpaRoot: boolean;
  readonly entryScriptUrls: readonly string[];
  readonly placeholderLocales: readonly string[];
};

/** /contact/chat/ の HTML から、配信判定に使う事実だけを取り出す。 */
export function inspectCloudiaChatDocument(document: Document, pageUrl: URL): CloudiaChatInspection {
  const entryScriptUrls = Array.from(
    document.querySelectorAll('script[src], link[rel="modulepreload"][href]'),
    (element) => resolveSameOrigin(element.getAttribute('src') ?? element.getAttribute('href') ?? '', pageUrl)
  )
    .filter((url): url is URL => url !== null && CLOUDIA_SPA_ENTRY_SCRIPT_PATH.test(url.pathname))
    .map((url) => url.href);
  const bodyText = normalizeWhitespace(document.body?.textContent);
  const placeholderLocales = Object.entries(CLOUDIA_CHAT_PLACEHOLDER_TITLES)
    .filter(([, title]) => bodyText.includes(title))
    .map(([locale]) => locale);
  return {
    hasSpaRoot: document.getElementById(CLOUDIA_SPA_ROOT_ID) !== null,
    entryScriptUrls: [...new Set(entryScriptUrls)],
    placeholderLocales,
  };
}

/**
 * HTML だけで言える範囲の「Cloudia が配信されている」。監視はこれに加えて
 * entryScriptUrls がすべて 200 を返すことを確かめる（HTML は出てもアセット 404 の部分障害がある）。
 */
export function isCloudiaChatHtmlServed(inspection: CloudiaChatInspection): boolean {
  return (
    inspection.hasSpaRoot &&
    inspection.entryScriptUrls.length > 0 &&
    inspection.placeholderLocales.length === 0
  );
}

// ---------------------------------------------------------------------------
// 内部ヘルパ
// ---------------------------------------------------------------------------

function serializeWithoutExcludedMeta(document: Document): string {
  const excluded: ReadonlySet<string> = new Set(PHONE_LEAD_EXCLUDED_META_NAMES);
  // 入力は変更しない。除外 meta を落とすのは複製に対してだけ行う。
  const copy = document.documentElement.cloneNode(true) as Element;
  Array.from(copy.querySelectorAll('meta[name]'))
    .filter((meta) => excluded.has((meta.getAttribute('name') ?? '').trim().toLowerCase()))
    .forEach((meta) => meta.remove());
  return copy.outerHTML;
}

function findingsIn<K extends PhoneLeadFinding['kind']>(
  html: string,
  pattern: RegExp,
  kind: K
): Array<PhoneLeadFinding & { readonly kind: K }> {
  return Array.from(html.matchAll(pattern), (match) => ({
    kind,
    match: match[0],
    context: contextAround(html, match.index ?? 0, match[0].length),
  }));
}

function combineGlobal(patterns: Readonly<Record<string, RegExp>>): RegExp {
  const source = Object.values(patterns)
    .map((pattern) => `(?:${pattern.source})`)
    .join('|');
  return new RegExp(source, 'giu');
}

function matchesAny(patterns: Readonly<Record<string, RegExp>>, text: string): boolean {
  return Object.values(patterns).some((pattern) => pattern.test(text));
}

function contextAround(text: string, index: number, length: number): string {
  const radius = 40;
  return normalizeWhitespace(text.slice(Math.max(0, index - radius), index + length + radius));
}

function normalizeWhitespace(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/gu, ' ').trim();
}

function summaryOf(details: Element): Element | undefined {
  return Array.from(details.children).find((child) => child.localName === 'summary');
}

function isCalendarEmbedSrc(src: string | null): boolean {
  try {
    const url = new URL(src ?? '');
    return url.protocol === 'https:' && url.hostname === CALENDAR_EMBED_HOST;
  } catch {
    return false;
  }
}

function resolveSameOrigin(value: string, pageUrl: URL): URL | null {
  try {
    const url = new URL(value, pageUrl);
    return url.origin === pageUrl.origin ? url : null;
  } catch {
    return null;
  }
}

function refreshTargetOf(content: string | null): string {
  // "0; url=/contact/" / "0;URL='/contact/'" の URL 部分。URL が無い refresh は自ページの再読込。
  return /url\s*=\s*['"]?([^'"]*)/iu.exec(content ?? '')?.[1]?.trim() ?? '';
}
