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

// 番号の区切りとして認める文字（1 か所に 1 文字まで）: 空白・ハイフン類（- ‐ ‑ – —）・ドット。
// 全角の数字・記号（０９２－… / ＋81）は照合前に NFKC で半角へ寄せる（findPhoneLeads など）。
const NUMBER_SEPARATOR = String.raw`[\s\-‐‑–—.]`;

/**
 * 電話番号の候補（/contact・/privacy 用）。語を伴わず番号だけが出る回帰を捕まえる。
 * 国際表記（+81 …、+81 (0)…）と国内表記（0 始まり。括弧・区切りなしも可: (092) 000-0000 /
 * 0920000000）。base64・SVG のパスデータ・長い数字列の一部に一致しないよう前を制限している。
 * これは候補であり、isPlausiblePhoneNumber の桁数判定（国内 10〜11 桁、+81 は国番号を除き 9〜10 桁）
 * を通ったものだけを番号とみなす（09-27-2026 のような日付は 8 桁なので落ちる）。
 * 実測（2026-09-28・dist 全 481 ページ）で番号と判定されたのは、法令で番号を表示する特商法ページ
 * 5 言語だけ。
 */
export const PHONE_NUMBER_PATTERN = new RegExp(
  String.raw`(?<![\w+/])\+81${NUMBER_SEPARATOR}?(?:\(0\)${NUMBER_SEPARATOR}?)?\(?\d{1,4}\)?` +
    String.raw`${NUMBER_SEPARATOR}?\d{1,4}${NUMBER_SEPARATOR}?\d{3,4}(?!\d)` +
    String.raw`|(?<![\w+/.\-‐‑–—])\(?0\d{1,4}\)?${NUMBER_SEPARATOR}?\d{1,4}${NUMBER_SEPARATOR}?\d{3,4}(?!\d)`,
  'u'
);

/** PHONE_NUMBER_PATTERN の候補が、区切りを除いた桁数として日本の電話番号に当たるか。 */
export function isPlausiblePhoneNumber(candidate: string): boolean {
  if (candidate.startsWith('+81')) {
    const national = candidate.slice(3).replace(/\(0\)/u, '').replace(/\D/gu, '');
    return national.length >= 9 && national.length <= 10;
  }
  const digits = candidate.replace(/\D/gu, '');
  return digits.startsWith('0') && digits.length >= 10 && digits.length <= 11;
}

/**
 * 「電話で問い合わせ・相談を受け付ける／電話で連絡してほしい」を述べる句（/privacy 用の句レベル）。
 * 「電話番号」のような収集項目には一致しない。PR #324（ad40cd6）が削除した実際の文言
 * （tests/fixtures/phone-inquiry-accidents.ts）と、#331 再レビューで挙がった見逃し・誤検知の実例を
 * ユニットテストで固定している。zh の実例は「或电话受理」で、「通过电话」「电话咨询」だけでは拾えない。
 * ja は「電話でのお問い合わせは受け付けておりません」のような否定文を除く（同じ文の 40 字以内）。
 * 他言語の否定文は除いていない（該当する文言が出たら誤検知として判定を見直す）。
 */
export const PHONE_INQUIRY_PHRASE_PATTERNS = {
  ja: /(?:お電話(?!番号)|電話(?:でも|にて|受付|窓口|相談|連絡|による|で(?:の)?(?:ご?連絡|お?問い?合わ?せ|ご?相談|受け?付|承))|[（(]\s*電話\s*[)）])(?![^。<]{0,40}?(?:受け付けて(?:おりません|いません)|承って(?:おりません|いません)|お受けして(?:おりません|いません)|できません|ご遠慮))/u,
  en: /by (?:tele)?phone|over the (?:tele)?phone|via (?:tele)?phone|(?:call|phone|ring) us\b|telephone us|(?:tele)?phone (?:inquir\w*|consultations?|support)\b/iu,
  zh: /或电话(?!号码)|电话(?:受理|联系|咨询|预约)|通过电话|致电|拨打|来电|或電話(?!號碼)|電話(?:受理|聯繫|諮詢)|透過電話|來電/u,
  ko: /전화나|전화로|전화\s?(?:문의|상담|접수|연락)/u,
  es: /por tel[eé]fono|v[ií]a telef[oó]nica|telef[oó]nicamente|ll[aá]m(?:enos|anos|arnos)|atenci[oó]n telef[oó]nica|consultas? telef[oó]nicas?|l[ií]nea telef[oó]nica/iu,
} as const satisfies Record<Locale, RegExp>;

export type PhoneLeadFinding = {
  readonly kind: 'text' | 'number' | 'tel-link' | 'phrase';
  readonly match: string;
  readonly context: string;
};

/**
 * /contact 用（語レベル）。本文・属性値・インラインスクリプトを含む HTML 全体（除外 meta を除き、
 * NFKC で正規化したもの）に PHONE_LEAD_PATTERNS と電話番号の判定を当て、加えて tel: リンクを構造で拾う。
 * match / context は正規化後の文字列（全角は半角になっている）。
 */
export function findPhoneLeads(document: Document): PhoneLeadFinding[] {
  const text = scanTextOf(document);
  return [
    ...findingsIn(text, combineGlobal(PHONE_LEAD_PATTERNS), 'text'),
    ...phoneNumberFindingsIn(text),
    ...telLinkFindingsIn(document),
  ];
}

/** 句レベルだけの判定（/privacy の判定の一部。ユニットテストで句パターン単体を検証するのに使う）。 */
export function findPhoneInquiryPhrases(document: Document): PhoneLeadFinding[] {
  return findingsIn(scanTextOf(document), combineGlobal(PHONE_INQUIRY_PHRASE_PATTERNS), 'phrase');
}

/**
 * /privacy 用。句レベル（「電話で受け付ける」旨）に加え、電話番号と tel: リンクも拾う。
 * 語レベル（「電話番号」という語）は収集項目として正当に載るので当てない。
 */
export function findPhoneInquiryLeads(document: Document): PhoneLeadFinding[] {
  const text = scanTextOf(document);
  return [
    ...findingsIn(text, combineGlobal(PHONE_INQUIRY_PHRASE_PATTERNS), 'phrase'),
    ...phoneNumberFindingsIn(text),
    ...telLinkFindingsIn(document),
  ];
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
 * root の中に Google カレンダーの埋め込み（https の calendar.google.com を src に持つ iframe）があるか。
 * B-2 の判定と、「そのビルドで実際にカレンダーが描画されたか」の確認（dist 検査）が同じ定義を使う。
 */
export function hasCalendarEmbed(root: ParentNode): boolean {
  return Array.from(root.querySelectorAll('iframe[src]')).some((iframe) =>
    isCalendarEmbedSrc(iframe.getAttribute('src'))
  );
}

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
    const hasCalendar = hasCalendarEmbed(details);
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

// 電話誘導の検査対象の文字列: 除外 meta を落とした HTML を NFKC で正規化したもの（全角→半角）。
function scanTextOf(document: Document): string {
  return serializeWithoutExcludedMeta(document).normalize('NFKC');
}

function phoneNumberFindingsIn(text: string): PhoneLeadFinding[] {
  return findingsIn(text, new RegExp(PHONE_NUMBER_PATTERN.source, 'gu'), 'number').filter((finding) =>
    isPlausiblePhoneNumber(finding.match)
  );
}

function telLinkFindingsIn(document: Document): PhoneLeadFinding[] {
  return Array.from(document.querySelectorAll('a[href], area[href]'))
    .map((element) => (element.getAttribute('href') ?? '').trim())
    .filter((href) => /^tel:/iu.test(href))
    .map((href) => ({ kind: 'tel-link' as const, match: href, context: href }));
}

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
