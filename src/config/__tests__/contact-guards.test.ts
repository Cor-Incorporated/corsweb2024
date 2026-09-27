// @vitest-environment node
// Issue #323 の判定基準（src/config/contact-guards.ts）そのものの検証。
// 壊した fixture で必ず検出すること（反証可能性・F2）と、判定基準が参照している
// ソース側の文言・識別子と食い違っていないこと（宣言↔実体の結合）をここで固定する。
// HTML の解析は jsdom（parse5）で行う。happy-dom 18 のパーサは圧縮後の
// `content=telephone=no` のような引用なし属性を途中で切るため、本番 HTML の検査には使わない。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { PHONE_INQUIRY_ACCIDENTS } from '../../../tests/fixtures/phone-inquiry-accidents';
import {
  AVAILABILITY_CLAIM_PATTERNS,
  CLOUDIA_CHAT_PLACEHOLDER_TITLES,
  CLOUDIA_SPA_ROOT_ID,
  CONTACT_PAGE_PATHS,
  LAUNCHER_FALLBACK_LINK_SELECTOR,
  PHONE_INQUIRY_PHRASE_PATTERNS,
  PHONE_LEAD_PATTERNS,
  PRIVACY_PAGE_PATHS,
  findCalendarCopyMismatches,
  findContactSelfLoops,
  findLauncherFallbackSelfLinks,
  findPhoneInquiryPhrases,
  findPhoneLeads,
  inspectCloudiaChatDocument,
  isCloudiaChatHtmlServed,
  isContactPagePath,
  normalizeSitePath,
} from '../contact-guards';

// fixture 用の架空オリジン（実在サイトには一切アクセスしない）。
const ORIGIN = 'https://site.example';
const CALENDAR_IFRAME =
  '<iframe src="https://calendar.google.com/calendar/embed?src=team%40example.com&ctz=Asia%2FTokyo"></iframe>';

function parsePage(body: string, head = ''): Document {
  return new JSDOM(`<!doctype html><html><head>${head}</head><body>${body}</body></html>`).window
    .document;
}

function pageUrl(path: string): URL {
  return new URL(path, ORIGIN);
}

function readSource(relativeToThisFile: string): string {
  return readFileSync(fileURLToPath(new URL(relativeToThisFile, import.meta.url)), 'utf8');
}

describe('判定パターンの網羅性', () => {
  const locales = Object.keys(CONTACT_PAGE_PATHS).sort();

  it('電話誘導（語・句）・時間帯の断言とも 5 言語すべてにパターンがあり、対象パスも 5 言語ある', () => {
    expect(Object.keys(PHONE_LEAD_PATTERNS).sort()).toEqual(locales);
    expect(Object.keys(PHONE_INQUIRY_PHRASE_PATTERNS).sort()).toEqual(locales);
    expect(Object.keys(AVAILABILITY_CLAIM_PATTERNS).sort()).toEqual(locales);
    expect(Object.keys(PRIVACY_PAGE_PATHS).sort()).toEqual(locales);
  });

  it('共有するパターンは状態を持たない（g / y フラグ無し。test() の lastIndex 汚染を防ぐ）', () => {
    const stateful = [
      ...Object.values(PHONE_LEAD_PATTERNS),
      ...Object.values(PHONE_INQUIRY_PHRASE_PATTERNS),
      ...Object.values(AVAILABILITY_CLAIM_PATTERNS),
    ].filter((pattern) => pattern.global || pattern.sticky);
    expect(stateful).toEqual([]);
  });
});

describe('B-1 findPhoneLeads', () => {
  // Issue #323 の検索式 `電話|电话|전화|[Tt]el[eé]f[oó]n|[Pp]hone|telephone|call us` の各語 + 大文字小文字違い。
  it.each([
    '電話',
    '电话',
    '전화',
    'Teléfono',
    'telefono',
    'TELÉFONO',
    'Phone',
    'phone',
    'telephone',
    'call us',
    'Call us',
  ])('本文の「%s」を検出する', (term) => {
    const findings = findPhoneLeads(parsePage(`<main><p>お問い合わせ ${term} まで</p></main>`));
    // es のパターンは語幹（teléfon）で一致する。一致した部分が語の一部であることを確かめる。
    expect(findings).toHaveLength(1);
    expect(term.toLowerCase()).toContain(findings[0].match.toLowerCase());
  });

  it('zh の「电话」を文脈付きで返す', () => {
    const findings = findPhoneLeads(parsePage('<main><p>也可以通过电话联系我们。</p></main>'));
    expect(findings).toEqual([
      expect.objectContaining({ kind: 'text', match: '电话', context: expect.stringContaining('通过电话联系') }),
    ]);
  });

  it('format-detection の meta は除外する（引用あり・圧縮後の引用なし・大文字）', () => {
    const head = [
      '<meta name="format-detection" content="telephone=no">',
      '<meta content=telephone=no name=Format-Detection>',
    ].join('');
    expect(findPhoneLeads(parsePage('<main><p>所在地</p></main>', head))).toEqual([]);
  });

  it('format-detection 以外の meta に書かれた誘導は検出する', () => {
    const head = '<meta name="description" content="お電話でも受け付けています">';
    expect(findPhoneLeads(parsePage('<main></main>', head))).toEqual([
      expect.objectContaining({ kind: 'text', match: '電話' }),
    ]);
  });

  it('文言も番号の形も無くても tel: リンクを構造で検出する', () => {
    const findings = findPhoneLeads(parsePage('<main><a href=" TEL:0000 ">連絡先</a></main>'));
    expect(findings).toEqual([{ kind: 'tel-link', match: 'TEL:0000', context: 'TEL:0000' }]);
  });

  // 語を伴わず番号だけが出る回帰（PR #331 レビュー L6）。番号はすべて架空。
  it.each(['070-0000-0000', '092-000-0000', '0120-000-000', '+81-70-0000-0000', '+81 70 0000 0000', '+81(0)70-0000-0000'])(
    '番号だけの「%s」を検出する',
    (number) => {
      const findings = findPhoneLeads(parsePage(`<main><p>${number}</p></main>`));
      expect(findings.map((finding) => finding.kind)).toEqual(['number']);
    }
  );

  it.each([
    ['日付', '2026-09-27'],
    ['時刻付き日付', '2026-09-27T12:00:00+09:00'],
    ['郵便番号と番地', '810-0001 福岡県 福岡市 中央区天神2丁目3-10'],
    ['SVG のパスデータ', '<svg><path d="M1.05-12-345 0-1.5-2L10.0-120-3456"></path></svg>'],
    ['base64', '<img alt="" src="data:image/png;base64,AB+81Cd9+8100a/+81234==">'],
  ])('番号に似た%sは誤検知しない', (_label, html) => {
    expect(findPhoneLeads(parsePage(`<main><p>${html}</p></main>`))).toEqual([]);
  });

  it('渡した Document を変更しない', () => {
    const document = parsePage('<main></main>', '<meta name="format-detection" content="telephone=no">');
    findPhoneLeads(document);
    expect(document.querySelectorAll('meta[name="format-detection"]')).toHaveLength(1);
  });
});

describe('B-1 findPhoneInquiryPhrases（/privacy 用の句レベル）', () => {
  // #323 背景 1 の事故入力そのもの（PR #324 が削除した実際の文言）。
  const accidents = Object.entries(PHONE_INQUIRY_ACCIDENTS).flatMap(([locale, texts]) => [
    [locale, 'privacy', texts.privacy] as const,
    [locale, 'calendarNote', texts.calendarNote] as const,
  ]);

  it.each(accidents)('%s の %s（削除済みの実文言）を検出する', (_locale, _field, text) => {
    const findings = findPhoneInquiryPhrases(parsePage(`<main><p>${text}</p></main>`));
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.every((finding) => finding.kind === 'phrase')).toBe(true);
  });

  // 収集項目としての「電話番号」は正当な記載。語レベル（/contact 用）なら拾うが、句レベルでは拾わない。
  it.each([
    ['ja', '氏名・会社名・部署・役職・メールアドレス・電話番号・取引に関する情報等'],
    ['ja', 'お電話番号をお預かりします'],
    ['en', 'Name, company name, department, job title, email address, telephone number, information'],
    ['zh', '姓名、公司名称、部门、职务、电子邮箱地址、电话号码、与交易相关的信息等'],
    ['ko', '성명·회사명·부서·직책·이메일 주소·전화번호·거래에 관한 정보 등'],
    ['es', 'Nombre, empresa, departamento, cargo, correo electrónico, número de teléfono, información'],
  ])('%s: 収集項目としての電話番号は誤検知しない', (_locale, text) => {
    const document = parsePage(`<main><dd>${text}</dd></main>`);
    expect(findPhoneLeads(document).length).toBeGreaterThan(0);
    expect(findPhoneInquiryPhrases(document)).toEqual([]);
  });

  it('format-detection の meta は句レベルでも誤検出しない', () => {
    const head = '<meta name="format-detection" content="telephone=no">';
    expect(findPhoneInquiryPhrases(parsePage('<main><p>所在地</p></main>', head))).toEqual([]);
  });
});

describe('B-2 findCalendarCopyMismatches', () => {
  const details = (summary: string, inner: string, id = 'contact-form-fallback') =>
    `<details id="${id}" open><summary>${summary}</summary><p>説明</p><div>${inner}</div></details>`;

  it('時間帯に言及し、同じ details にカレンダーがあれば整合', () => {
    const document = parsePage(details('所在地・打ち合わせ可能な時間を見る', CALENDAR_IFRAME));
    expect(findCalendarCopyMismatches(document)).toEqual([]);
  });

  it('時間帯に言及しているのにカレンダーが無ければ検出する（#323 背景 4 の再発）', () => {
    const document = parsePage(details('所在地・打ち合わせ可能な時間を見る', '<p>所在地</p>'));
    expect(findCalendarCopyMismatches(document)).toEqual([
      expect.objectContaining({ kind: 'claim-without-calendar', detailsId: 'contact-form-fallback' }),
    ]);
  });

  it('言及も無くカレンダーも無ければ整合（PUBLIC_GCAL_ID 未設定ビルドの正しい姿）', () => {
    expect(findCalendarCopyMismatches(parsePage(details('所在地を見る', '<p>所在地</p>')))).toEqual([]);
  });

  it.each([
    ['似せたホスト', 'https://calendar.google.com.evil.example/calendar/embed'],
    ['http', 'http://calendar.google.com/calendar/embed'],
    ['相対パス', '/calendar/embed'],
  ])('カレンダーではない iframe（%s）は根拠にしない', (_label, src) => {
    const document = parsePage(details('Our location and available times', `<iframe src="${src}"></iframe>`));
    expect(findCalendarCopyMismatches(document).map((finding) => finding.kind)).toEqual([
      'claim-without-calendar',
    ]);
  });

  it('言及とカレンダーが別の details に分かれていれば両方を検出する', () => {
    const document = parsePage(
      details('Nuestra ubicación y horarios disponibles', '<p>ubicación</p>', 'a') +
        details('地図', CALENDAR_IFRAME, 'b')
    );
    expect(findCalendarCopyMismatches(document)).toEqual([
      expect.objectContaining({ kind: 'claim-without-calendar', detailsId: 'a' }),
      expect.objectContaining({ kind: 'calendar-without-claim', detailsId: 'b' }),
    ]);
  });

  it('カレンダーがあるのに見出しが案内していなければ検出する（文言の書き換えによる空振りの兆候）', () => {
    const document = parsePage(details('所在地を見る', CALENDAR_IFRAME));
    expect(findCalendarCopyMismatches(document)).toEqual([
      expect.objectContaining({ kind: 'calendar-without-claim', text: '所在地を見る' }),
    ]);
  });
});

describe('B-3 パス判定', () => {
  it.each([
    ['/contact/', '/contact'],
    ['/contact', '/contact'],
    ['/contact/index.html', '/contact'],
    ['/en/contact//', '/en/contact'],
    ['/', '/'],
    ['/index.html', '/'],
  ])('normalizeSitePath(%s) は %s（CloudiaLauncher の normalizePath と同じ規則）', (input, expected) => {
    expect(normalizeSitePath(input)).toBe(expected);
  });

  it('5 言語の /contact/ とその表記ゆれだけを問い合わせページとみなす', () => {
    const contactVariants = Object.values(CONTACT_PAGE_PATHS).flatMap((path) => [
      path,
      path.slice(0, -1),
      `${path}index.html`,
    ]);
    expect(contactVariants.filter((path) => !isContactPagePath(path))).toEqual([]);
    expect(['/contact/chat/', '/contacts/', '/', '/about/'].filter(isContactPagePath)).toEqual([]);
  });
});

describe('B-3 findContactSelfLoops', () => {
  const chatUrl = pageUrl('/contact/chat/');

  it.each([
    ['絶対パス', '<a href="/contact/">戻る</a>'],
    ['末尾スラッシュ無し・他言語', '<a href="/en/contact">Back</a>'],
    ['相対パス ../', '<a href="../">戻る</a>'],
    ['同一オリジンの絶対 URL', `<a href="${ORIGIN}/zh/contact/index.html?locale=zh">返回</a>`],
    ['form の送信先', '<form action="/contact/"><button>送信</button></form>'],
  ])('<main> 内の /contact/ への導線を検出する（%s）', (_label, html) => {
    expect(findContactSelfLoops(parsePage(`<main>${html}</main>`), chatUrl)).toHaveLength(1);
  });

  it('入れ子の <main> でも 1 件として数える', () => {
    const document = parsePage('<main><main><a href="/contact/">戻る</a></main></main>');
    expect(findContactSelfLoops(document, chatUrl)).toEqual([
      { element: 'a', value: '/contact/', resolved: `${ORIGIN}/contact/` },
    ]);
  });

  it('meta refresh で /contact/ へ送る場合も検出する', () => {
    const head = '<meta http-equiv="Refresh" content="0; URL=\'/contact/\'">';
    expect(findContactSelfLoops(parsePage('<main></main>', head), chatUrl)).toEqual([
      { element: 'meta', value: '/contact/', resolved: `${ORIGIN}/contact/` },
    ]);
  });

  it('対象外: <main> 外の共通ナビ、別ページ、別オリジン、URL の無い refresh', () => {
    const document = parsePage(
      [
        '<header><a href="/contact/">お問い合わせ</a></header>',
        '<main><a href="/contact/chat/">再読込</a><a href="/about/">会社概要</a>',
        '<a href="https://other.example/contact/">外部</a></main>',
      ].join(''),
      '<meta http-equiv="refresh" content="30">'
    );
    expect(findContactSelfLoops(document, chatUrl)).toEqual([]);
  });
});

describe('B-3 findLauncherFallbackSelfLinks', () => {
  const launcher = (href: string) =>
    `<aside id="cloudia-launcher"><a href="${href}" data-cloudia-fallback-link>開き直す</a></aside>`;

  it.each(['/contact/', '/contact', '/contact/index.html'])(
    '%s 上で /contact/ へのフォールバックが残っていれば自己リンクとして検出する',
    (path) => {
      const document = parsePage(launcher('/contact/?locale=ja&source=corsweb-launcher-fallback'));
      expect(findLauncherFallbackSelfLinks(document, pageUrl(path))).toHaveLength(1);
    }
  );

  it('別ページ上のフォールバックは正しい導線なので検出しない', () => {
    expect(findLauncherFallbackSelfLinks(parsePage(launcher('/contact/')), pageUrl('/about/'))).toEqual([]);
    expect(findLauncherFallbackSelfLinks(parsePage(launcher('/contact/')), pageUrl('/en/contact/'))).toEqual(
      []
    );
  });
});

describe('C inspectCloudiaChatDocument（#322 合成監視と共有）', () => {
  const chatUrl = pageUrl('/contact/chat/');
  const entryScript = '<script type="module" crossorigin src="/contact/chat/assets/index-AbC_12-3.js"></script>';

  it('#root と同一オリジンのエントリスクリプトがあれば配信中とみなす', () => {
    const inspection = inspectCloudiaChatDocument(parsePage('<div id="root"></div>', entryScript), chatUrl);
    expect(inspection).toEqual({
      hasSpaRoot: true,
      entryScriptUrls: [`${ORIGIN}/contact/chat/assets/index-AbC_12-3.js`],
      placeholderLocales: [],
    });
    expect(isCloudiaChatHtmlServed(inspection)).toBe(true);
  });

  it('#root だけでエントリスクリプトが無ければ配信中とみなさない', () => {
    const inspection = inspectCloudiaChatDocument(parsePage('<div id="root"></div>'), chatUrl);
    expect(isCloudiaChatHtmlServed(inspection)).toBe(false);
  });

  it('別オリジンのスクリプトはエントリとして数えない', () => {
    const script = '<script src="https://cdn.example/contact/chat/assets/index-AbC.js"></script>';
    expect(inspectCloudiaChatDocument(parsePage('<div id="root"></div>', script), chatUrl).entryScriptUrls).toEqual(
      []
    );
  });

  it.each(Object.entries(CLOUDIA_CHAT_PLACEHOLDER_TITLES))(
    'プレースホルダ（%s）は未配信として判定する',
    (locale, title) => {
      const inspection = inspectCloudiaChatDocument(parsePage(`<main><h1>${title}</h1></main>`), chatUrl);
      expect(inspection.placeholderLocales).toEqual([locale]);
      expect(isCloudiaChatHtmlServed(inspection)).toBe(false);
    }
  );
});

// 判定基準と、それが前提にしているソース側の文言・識別子を機械的に結ぶ。
// ソースだけ書き換えると、ここが両側の値を挙げて落ちる。
describe('判定基準 ↔ ソースの結合', () => {
  const extractCopy = (source: string, name: string): string[] => {
    const start = source.indexOf(`const ${name} = {`);
    const end = source.indexOf('} as const satisfies', start);
    if (start < 0 || end < 0) {
      throw new Error(`CloudiaContactEntry.astro に ${name} の定義が見つからない（判定基準の更新が必要）`);
    }
    return Array.from(source.slice(start, end).matchAll(/(?:title|description):\s*'([^']*)'/gu), (m) => m[1]);
  };
  const claims = (text: string) =>
    Object.values(AVAILABILITY_CLAIM_PATTERNS).some((pattern) => pattern.test(text));
  const entrySource = readSource('../../components/contact/CloudiaContactEntry.astro');
  const localeCount = Object.keys(CONTACT_PAGE_PATHS).length;

  it('カレンダーありの文言（全言語の title / description）はすべて時間帯の断言として検出できる', () => {
    const withCalendar = extractCopy(entrySource, 'FALLBACK_WITH_CALENDAR');
    expect(withCalendar).toHaveLength(localeCount * 2);
    expect(withCalendar.filter((text) => !claims(text))).toEqual([]);
  });

  it('カレンダーなしの文言は時間帯の断言として検出しない', () => {
    const withoutCalendar = extractCopy(entrySource, 'FALLBACK_WITHOUT_CALENDAR');
    expect(withoutCalendar).toHaveLength(localeCount * 2);
    expect(withoutCalendar.filter(claims)).toEqual([]);
  });

  it('プレースホルダの見出しは src/pages/contact/chat/index.astro の文言と一致する', () => {
    const chatSource = readSource('../../pages/contact/chat/index.astro');
    const missing = Object.values(CLOUDIA_CHAT_PLACEHOLDER_TITLES).filter(
      (title) => !chatSource.includes(`title: '${title}'`)
    );
    expect(missing).toEqual([]);
  });

  it('ランチャーの readiness 判定とフォールバック導線は判定基準と同じ識別子を使う', () => {
    const launcherSource = readSource('../../components/contact/CloudiaLauncher.astro');
    expect(launcherSource).toContain(`getElementById('${CLOUDIA_SPA_ROOT_ID}')`);
    expect(launcherSource).toContain(LAUNCHER_FALLBACK_LINK_SELECTOR.slice(1, -1));
  });
});
