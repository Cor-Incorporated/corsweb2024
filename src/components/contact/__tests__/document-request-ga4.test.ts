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

const EVENT = ['event', 'document_request_submit_success'];

function html(industry = 'medical'): string {
  const options = ['', 'medical', 'shigyo', 'construction', 'manufacturing', 'education', 'other']
    .map((value) => `<option value="${value}"${value === industry ? ' selected' : ''}>${value}</option>`)
    .join('');
  return `
    <form
      data-document-request
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
      data-msg-error-invalid="入力"
      data-msg-error-storage="保存"
      data-msg-error-rate="回数"
    >
      <input name="name" value="山田太郎" />
      <input name="email" value="taro@example.com" />
      <input name="company" value="株式会社テスト" />
      <select name="industry">${options}</select>
      <input type="checkbox" name="consent" value="yes" checked />
      <input type="hidden" name="locale" value="ja" />
      <input name="website" value="" />
      <button type="submit">送信</button>
    </form>
    <div id="document-request-result"></div>
  `;
}

function mount(industry = 'medical') {
  document.body.innerHTML = html(industry);
  const select = document.querySelector('select[name="industry"]') as HTMLSelectElement;
  select.value = industry;
  const gtag = vi.fn();
  (window as unknown as { gtag: unknown }).gtag = gtag;
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  new Function(script)();
  const form = document.querySelector('[data-document-request]') as HTMLFormElement;
  const submit = () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  };
  return { gtag, fetchMock, submit };
}

function respond(fetchMock: ReturnType<typeof vi.fn>, data: unknown, status = 200) {
  fetchMock.mockImplementationOnce(async () => ({
    status,
    json: async () => data,
  }));
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

describe('資料請求の計測 document_request_submit_success', () => {
  it('保存成功（status stored と受付 ID）の応答のあと、イベント名だけで 1 回送る', async () => {
    const { gtag, fetchMock, submit } = mount();
    respond(fetchMock, SUCCESS);
    submit();
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledTimes(1);
    // 2 引数だけ。document_id・industry・entry_surface などの第 3 引数は付けない。
    expect(gtag.mock.calls[0]).toEqual(EVENT);
  });

  it('同じ受付 ID の 2 回目は送らない', async () => {
    const { gtag, fetchMock, submit } = mount();
    respond(fetchMock, SUCCESS);
    submit();
    await flush();
    respond(fetchMock, SUCCESS);
    submit();
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(gtag).toHaveBeenCalledTimes(1);
  });

  it('重複の応答では送らない（受付 ID が新しくても）', async () => {
    const { gtag, fetchMock, submit } = mount();
    respond(fetchMock, { ...SUCCESS, duplicate: true, receiptId: 'R-20261118-0002' });
    submit();
    await flush();

    expect(gtag).not.toHaveBeenCalled();
  });

  it.each([
    [400, { ok: false, error: 'email' }],
    [429, { ok: false, error: 'rate' }],
    [503, { ok: false, error: 'storage' }],
  ])('失敗の応答（%i）では送らない', async (status, data) => {
    const { gtag, fetchMock, submit } = mount();
    respond(fetchMock, data, status);
    submit();
    await flush();

    expect(gtag).not.toHaveBeenCalled();
  });

  it('通信が失敗したら送らない', async () => {
    const { gtag, fetchMock, submit } = mount();
    fetchMock.mockImplementationOnce(async () => {
      throw new Error('offline');
    });
    submit();
    await flush();

    expect(gtag).not.toHaveBeenCalled();
  });

  it('どの呼び出しにもフォームの値が出ない（引数はイベント名だけ）', async () => {
    const { gtag, fetchMock, submit } = mount('medical');
    respond(fetchMock, SUCCESS);
    submit();
    await flush();

    expect(gtag).toHaveBeenCalledTimes(1);
    const args = gtag.mock.calls[0];
    expect(args).toEqual(EVENT);
    expect(args).toHaveLength(2);

    const serialized = JSON.stringify(args);
    for (const value of [
      '山田太郎',
      'taro@example.com',
      '株式会社テスト',
      'R-20261118-0001',
      'company-deck',
      'materials',
      'medical',
      'discoverySource',
      'discoveryOther',
      'industry',
      'company',
      'email',
      'name',
      'consent',
    ]) {
      expect(serialized).not.toContain(value);
    }
  });

  it('業種を選んでも送る引数は変わらない', async () => {
    const { gtag, fetchMock, submit } = mount('other');
    respond(fetchMock, SUCCESS);
    submit();
    await flush();

    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag.mock.calls[0]).toEqual(EVENT);
  });

  it('gtag が無い環境（本番以外）では何も送らず、画面の処理も壊さない', async () => {
    document.body.innerHTML = html();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    respond(fetchMock, SUCCESS);
    delete (window as unknown as { gtag?: unknown }).gtag;
    new Function(script)();
    const form = document.querySelector('[data-document-request]') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();

    expect(document.getElementById('document-request-result')?.textContent).toContain(SUCCESS.receiptId);
  });
});
