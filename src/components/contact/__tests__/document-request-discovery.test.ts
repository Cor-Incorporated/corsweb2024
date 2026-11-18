import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

// 画面の inline script をそのまま動かす。実装（DocumentRequestForm.astro）と試験が
// 別々の写しにならないよう、script の本文は 1 か所から読む。
const source = readFileSync(resolve(__dirname, '../DocumentRequestForm.astro'), 'utf8');
const match = source.match(/<script is:inline>([\s\S]*?)<\/script>/);
if (!match) throw new Error('資料請求の inline script が見つからない');
const script = match[1];

const SUCCESS = {
  ok: true,
  status: 'stored',
  delivered: false,
  duplicate: false,
  notification: 'pending',
  receiptId: 'R-20261118-0001',
};

function html(sourceValue = '', otherValue = ''): string {
  const options = ['', 'x', 'linkedin', 'note', 'qiita', 'search', 'referral', 'event', 'other']
    .map((value) => `<option value="${value}"${value === sourceValue ? ' selected' : ''}>${value}</option>`)
    .join('');
  return `
    <form
      data-document-request
      action="/api/contact/document-request"
      method="post"
      data-document-id="company-deck"
      data-entry-surface="materials"
      data-industries="medical,shigyo,construction,manufacturing,education"
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
      <select name="industry"><option value="medical" selected>medical</option></select>
      <input type="checkbox" name="consent" value="yes" checked />
      <input type="hidden" name="locale" value="ja" />
      <input name="website" value="" />
      <label data-discovery-other-field hidden>
        <input data-discovery-other name="discoveryOther" type="text" maxlength="100" value="${otherValue}" />
      </label>
      <select name="discoverySource" data-discovery-source>${options}</select>
      <button type="submit">送信</button>
    </form>
    <div id="document-request-result"></div>
  `;
}

function mount(sourceValue = '', otherValue = '') {
  document.body.innerHTML = html(sourceValue, otherValue);
  const select = document.querySelector('[data-discovery-source]') as HTMLSelectElement;
  select.value = sourceValue;
  const gtag = vi.fn();
  (window as unknown as { gtag: unknown }).gtag = gtag;
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  new Function(script)();
  const form = document.querySelector('[data-document-request]') as HTMLFormElement;
  const submit = () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  };
  return { gtag, fetchMock, submit, select };
}

function respond(fetchMock: ReturnType<typeof vi.fn>, data: unknown, status = 200) {
  fetchMock.mockImplementationOnce(async () => ({
    status,
    json: async () => data,
  }));
}

function sentBody(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const init = fetchMock.mock.calls[0][1] as RequestInit;
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete (window as unknown as { gtag?: unknown }).gtag;
  document.body.innerHTML = '';
});

describe('資料請求のどこで知りましたか', () => {
  it('空のままでも送れて、空で送る', async () => {
    const { fetchMock, submit } = mount();
    respond(fetchMock, SUCCESS);
    submit();
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = sentBody(fetchMock);
    expect(body.discoverySource).toBe('');
    expect(body.discoveryOther).toBe('');
    expect(document.getElementById('document-request-result')?.textContent).toContain(SUCCESS.receiptId);
  });

  it('選択した選択肢を本文に載せる', async () => {
    const { fetchMock, submit } = mount('qiita');
    respond(fetchMock, SUCCESS);
    submit();
    await flush();

    expect(sentBody(fetchMock).discoverySource).toBe('qiita');
    expect(sentBody(fetchMock).discoveryOther).toBe('');
  });

  it('その他を選ぶと自由記述の欄が出て、本文に載る', async () => {
    const { fetchMock, submit } = mount('other', '知人の紹介');
    respond(fetchMock, SUCCESS);
    const field = document.querySelector('[data-discovery-other-field]') as HTMLElement;
    expect(field.hidden).toBe(false);
    submit();
    await flush();

    expect(sentBody(fetchMock).discoverySource).toBe('other');
    expect(sentBody(fetchMock).discoveryOther).toBe('知人の紹介');
  });

  it('その他以外では自由記述を送らない（欄も閉じる）', async () => {
    const { fetchMock, submit, select } = mount('x', '知人の紹介');
    respond(fetchMock, SUCCESS);
    select.value = 'search';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    const field = document.querySelector('[data-discovery-other-field]') as HTMLElement;
    const other = document.querySelector('[data-discovery-other]') as HTMLInputElement;
    expect(field.hidden).toBe(true);
    expect(other.value).toBe('');
    submit();
    await flush();

    expect(sentBody(fetchMock).discoverySource).toBe('search');
    expect(sentBody(fetchMock).discoveryOther).toBe('');
  });

  it('自由記述の欄は 100 文字まで', () => {
    mount();
    const input = document.querySelector('[data-discovery-other]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.getAttribute('maxlength')).toBe('100');
  });

  it('GA4 の送る項目は 3 つのままで、どこで知ったかを混ぜない', async () => {
    const { gtag, fetchMock, submit } = mount('other', '知人の紹介');
    respond(fetchMock, SUCCESS);
    submit();
    await flush();

    expect(gtag).toHaveBeenCalledTimes(1);
    const args = gtag.mock.calls[0];
    expect(Object.keys(args[2] as Record<string, unknown>).sort()).toEqual([
      'document_id',
      'entry_surface',
      'industry',
    ]);
    const serialized = JSON.stringify(args);
    expect(serialized).not.toContain('other');
    expect(serialized).not.toContain('知人の紹介');
    expect(serialized).not.toContain('discovery');
  });

  it('選択肢の外は 400 discovery で弾かれ、画面にその文を出す', async () => {
    const { gtag, fetchMock, submit } = mount('x');
    respond(fetchMock, { ok: false, error: 'discovery' }, 400);
    submit();
    await flush();

    expect(gtag).not.toHaveBeenCalled();
    expect(document.getElementById('document-request-result')?.textContent).toBe('どこで知ったか');
  });
});
