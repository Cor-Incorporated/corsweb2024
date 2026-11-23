import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DOCUMENT_REQUEST_ENTRY_PATHS } from '../../../config/document-request';

// 画面の inline script をそのまま動かす。実装（DocumentRequestForm.astro）と試験が
// 別々の写しにならないよう、script の本文は 1 か所から読む。隠し欄の静的な形は同じ file の source で確かめる。
const source = readFileSync(resolve(__dirname, '../DocumentRequestForm.astro'), 'utf8');
const match = source.match(/<script is:inline>([\s\S]*?)<\/script>/);
if (!match) throw new Error('資料請求の inline script が見つからない');
const script = match[1];

const INDUSTRIES = ['medical', 'shigyo', 'construction', 'manufacturing', 'education'];
const TOKEN = /^[0-9a-f]{32}$/;
const EVENT = ['event', 'document_request_submit_success'];

const SUCCESS = {
  ok: true,
  status: 'stored',
  delivered: false,
  duplicate: false,
  notification: 'pending',
  receiptId: 'R-20261123-0001',
};

const ORIGIN = window.location.origin;

function html(): string {
  const options = ['', ...INDUSTRIES].map((value) => `<option value="${value}">${value}</option>`).join('');
  return `
    <form
      data-document-request
      data-entry-paths="${DOCUMENT_REQUEST_ENTRY_PATHS.join(' ')}"
      action="/api/contact/document-request"
      method="post"
      data-msg-success="受け付けました"
      data-msg-duplicate="受け付け済みです"
      data-msg-notify-pending="通知は後で送ります"
      data-msg-uncertain="わかりません"
      data-msg-error-name="名前"
      data-msg-error-email="メール"
      data-msg-error-consent="同意"
      data-msg-error-industry="業種"
      data-msg-error-discovery="どこで知ったか"
      data-msg-error-invalid="入力"
      data-msg-error-storage="保存"
      data-msg-error-rate="回数"
    >
      <input name="name" value="山田太郎" />
      <input name="email" value="taro@example.com" />
      <input name="company" value="株式会社テスト" />
      <select name="industry"><option value="medical" selected>medical</option>${options}</select>
      <select name="discoverySource" data-discovery-source><option value="">-</option></select>
      <label data-discovery-other-field hidden>
        <input data-discovery-other name="discoveryOther" type="text" maxlength="100" value="" />
      </label>
      <input type="checkbox" name="consent" value="yes" checked />
      <input type="hidden" name="locale" value="ja" />
      <input type="hidden" name="formToken" value="" />
      <input type="hidden" name="pagePath" value="" />
      <input name="website" value="" />
      <button type="submit">送信</button>
    </form>
    <div id="document-request-result"></div>
  `;
}

interface Display {
  /** document.referrer（このページを開く直前のページ）。 */
  referrer?: string;
  /** Navigation Timing の初回の文書の URL。今の URL と違えばページ内遷移（View Transitions）で来たことになる。 */
  initialDocument?: string | null;
  /** false は crypto.getRandomValues が無い環境。 */
  random?: boolean;
}

function mount(options: Display = {}) {
  document.body.innerHTML = html();
  Object.defineProperty(document, 'referrer', { value: options.referrer ?? '', configurable: true });
  if (options.initialDocument !== undefined) {
    // performance のオブジェクト全体は置き換えない（happy-dom の Event が performance.now を使う）。この関数だけ差し替える。
    const entries = options.initialDocument === null ? [] : [{ name: options.initialDocument }];
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue(entries as never);
  }
  if (options.random === false) vi.stubGlobal('crypto', { getRandomValues: undefined });
  const gtag = vi.fn();
  (window as unknown as { gtag: unknown }).gtag = gtag;
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  new Function(script)();
  const form = document.querySelector('[data-document-request]') as HTMLFormElement;
  const tokenInput = form.querySelector('input[name="formToken"]') as HTMLInputElement | null;
  const pathInput = form.querySelector('input[name="pagePath"]') as HTMLInputElement | null;
  const submit = () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  };
  return { gtag, fetchMock, submit, tokenInput, pathInput };
}

function respond(fetchMock: ReturnType<typeof vi.fn>, data: unknown, status = 200) {
  fetchMock.mockImplementationOnce(async () => ({
    status,
    json: async () => data,
  }));
}

async function sentBody(fetchMock: ReturnType<typeof vi.fn>): Promise<Record<string, unknown>> {
  const init = fetchMock.mock.calls[0][1] as RequestInit;
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete (window as unknown as { gtag?: unknown }).gtag;
  delete (document as unknown as { referrer?: unknown }).referrer;
  document.body.innerHTML = '';
});

describe('資料請求のフォームのトークン（#537）', () => {
  it('静的な HTML の隠し欄は空。ビルドした瞬間の全員共通のトークンは置かない', () => {
    expect(source).toContain("data-entry-paths={DOCUMENT_REQUEST_ENTRY_PATHS.join(' ')}");
    expect(source).toContain('<input type="hidden" name="formToken" value=""');
    expect(source).toContain('<input type="hidden" name="pagePath" value=""');
    // トークンは画面が乱数で作る。Math.random は使わない。
    expect(script).toContain('getRandomValues');
    expect(script).not.toContain('Math.random');
    const values = [...source.matchAll(/name="formToken" value="([^"]*)"/g)].map((item) => item[1]);
    expect(values).toEqual(['']);
  });

  it('フォームを表示したときに 32 桁の hex のトークンを発行し、送信本文に載せる', async () => {
    const random = vi.spyOn(crypto, 'getRandomValues');
    const { fetchMock, submit, tokenInput } = mount();
    expect(random).toHaveBeenCalled();
    expect(tokenInput?.value).toMatch(TOKEN);
    respond(fetchMock, SUCCESS);
    submit();
    await flush();

    expect((await sentBody(fetchMock)).formToken).toBe(tokenInput?.value);
    expect(document.getElementById('document-request-result')?.textContent).toContain(SUCCESS.receiptId);
  });

  it('表示するたびに別のトークンになる', () => {
    const first = mount().tokenInput?.value ?? '';
    const second = mount().tokenInput?.value ?? '';
    expect(first).toMatch(TOKEN);
    expect(second).toMatch(TOKEN);
    expect(second).not.toBe(first);
  });

  it('同じ表示のまま 2 回送っても、トークンは同じ（再送として 1 件にまとめられる）', async () => {
    const { fetchMock, submit } = mount();
    respond(fetchMock, SUCCESS);
    submit();
    await flush();
    respond(fetchMock, { ...SUCCESS, duplicate: true }, 202);
    submit();
    await flush();

    const bodies = fetchMock.mock.calls.map((call) => (JSON.parse(String((call[1] as RequestInit).body)) as { formToken: string }).formToken);
    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toMatch(TOKEN);
    expect(bodies[1]).toBe(bodies[0]);
  });

  it('乱数が使えない環境ではトークンを空で送り、受付の表示は壊さない', async () => {
    const { fetchMock, submit, tokenInput } = mount({ random: false });
    expect(tokenInput?.value).toBe('');
    respond(fetchMock, SUCCESS);
    submit();
    await flush();

    expect((await sentBody(fetchMock)).formToken).toBe('');
    expect(document.getElementById('document-request-result')?.textContent).toContain(SUCCESS.receiptId);
  });

  it('GA4 にはトークンも元のページも載せない（引数はイベント名だけ）', async () => {
    const { gtag, fetchMock, submit } = mount({ referrer: `${ORIGIN}/industries/medical/?utm_source=x` });
    respond(fetchMock, SUCCESS);
    submit();
    await flush();

    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag.mock.calls[0]).toEqual(EVENT);
  });
});

describe('資料請求の元のページ（どのページから来たか）', () => {
  it.each(INDUSTRIES)('自社の %s のページから来たときは、query と hash を除いた path を送る', async (slug) => {
    const { fetchMock, submit, pathInput } = mount({
      referrer: `${ORIGIN}/industries/${slug}/?utm_source=x&email=taro@example.com#cta`,
    });
    expect(pathInput?.value).toBe(`/industries/${slug}/`);
    respond(fetchMock, SUCCESS);
    submit();
    await flush();

    const body = await sentBody(fetchMock);
    expect(body.pagePath).toBe(`/industries/${slug}/`);
    expect(body.pagePath).not.toContain('?');
    expect(body.pagePath).not.toContain('#');
  });

  it.each(['', '/en', '/zh', '/ko', '/es'].flatMap((prefix) =>
    ['/company/', ...INDUSTRIES.map((slug) => `/industries/${slug}/`)].map((path) => prefix + path)
  ))('公開ページ %s の標準パスを送る', (path) => {
    expect(mount({ referrer: ORIGIN + path }).pathInput?.value).toBe(path);
  });

  it.each(['/members/fixturemember/', '/ja/company/', '/blog/company/', '/en/industries/notpublished/'])(
    '同一 origin でも公開起点でない %s を送らない', (path) => {
      expect(mount({ referrer: ORIGIN + path }).pathInput?.value).toBe('');
    }
  );

  const OTHER_SCHEME = ORIGIN.startsWith('https:') ? ORIGIN.replace('https:', 'http:') : ORIGIN.replace('http:', 'https:');

  it.each([
    ['無し', ''],
    ['別 origin（検索エンジン）', 'https://www.google.com/search?q=%E5%B1%B1%E7%94%B0'],
    ['別 origin（自社に似た host）', 'https://cor-jp.com.example.com/industries/medical/'],
    ['別 scheme', `${OTHER_SCHEME}/industries/medical/`],
    ['別 port', `${ORIGIN}:444/industries/medical/`],
    ['解釈できない文字列', 'not a url'],
  ])('referrer が「%s」のときは空を送る', async (_label, referrer) => {
    const { fetchMock, submit, pathInput } = mount({ referrer });
    expect(pathInput?.value).toBe('');
    respond(fetchMock, SUCCESS);
    submit();
    await flush();

    const body = await sentBody(fetchMock);
    expect(body.pagePath).toBe('');
    // referrer の host も path も本文に入らない（フォームの欄にあるメールの domain は別）。
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('www.google.com');
    expect(serialized).not.toContain('cor-jp.com.example.com');
    expect(serialized).not.toContain('industries/medical');
    expect(Object.keys(body)).not.toContain('referrer');
  });

  it('path に個人情報らしい並び（メールアドレス・長い数字）があれば送らない', async () => {
    const first = mount({ referrer: `${ORIGIN}/users/taro@example.com/` });
    expect(first.pathInput?.value).toBe('');
    const second = mount({ referrer: `${ORIGIN}/tel/09012345678` });
    expect(second.pathInput?.value).toBe('');
  });

  it('ページ内遷移（View Transitions）で来たときは、残っている古い referrer を元のページとして送らない', async () => {
    const navigated = mount({ referrer: `${ORIGIN}/company/`, initialDocument: `${ORIGIN}/company/` });
    expect(navigated.pathInput?.value).toBe('');
    respond(navigated.fetchMock, SUCCESS);
    navigated.submit();
    await flush();

    expect((await sentBody(navigated.fetchMock)).pagePath).toBe('');
  });

  it('初回の読み込みで来たとき（＝遷移前のページではない）は referrer を使う', () => {
    const loaded = mount({ referrer: `${ORIGIN}/company/?from=header#links`, initialDocument: window.location.href });
    expect(loaded.pathInput?.value).toBe('/company/');
    // hash だけが違っても同じ文書。
    const hashed = mount({ referrer: `${ORIGIN}/company/`, initialDocument: `${window.location.href}#form` });
    expect(hashed.pathInput?.value).toBe('/company/');
  });
});
