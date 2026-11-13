import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CLOUDIA_UNAVAILABLE_COPY,
  CLOUDIA_UNAVAILABLE_PHONE_VISIBLE,
  UNAVAILABLE_LOCALES,
} from '../../../src/components/contact/chat/cloudiaUnavailableCopy';
import { CLOUDIA_CHAT_PLACEHOLDER_TITLES } from '../../../src/config/contact-guards';
import { fetchContactEdge } from './index';
import { UNAVAILABLE_PAGE_TITLES, renderUnavailablePage } from './unavailable';

afterEach(() => vi.unstubAllGlobals());

const ORIGIN = 'https://cor-jp.com';

function bothOriginsDown(kind: 'status' | 'throw') {
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response('pages down', { status: 503 }));
  if (kind === 'status') fetchMock.mockResolvedValueOnce(new Response('firebase down', { status: 500 }));
  else fetchMock.mockRejectedValueOnce(new Error('network'));
  vi.stubGlobal('fetch', fetchMock);
}

async function unavailable(path: string, kind: 'status' | 'throw' = 'status', method = 'GET') {
  bothOriginsDown(kind);
  return fetchContactEdge(new Request(`${ORIGIN}${path}`, { method }), { CONTACT_ORIGIN: 'pages' });
}

describe('Cloudia の画面も代わりのページも配れないとき（文書の要求）', () => {
  for (const kind of ['status', 'throw'] as const) {
    it.each(UNAVAILABLE_LOCALES)(`%s: その場で 503 の終わりのページを返し、/contact/ へは戻さない（${kind}）`, async (locale) => {
      const response = await unavailable(`/contact/chat/?source=industry-medical&locale=${locale}`, kind);
      const body = await response.text();
      expect(response.status).toBe(503);
      expect(response.headers.get('location')).toBeNull();
      expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('x-robots-tag')).toBe('noindex');
      expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN');
      expect(response.headers.get('content-security-policy')).toBe(
        "frame-ancestors 'self'; object-src 'none'; base-uri 'self'; default-src 'none'; style-src 'unsafe-inline'",
      );
      expect(body).toBe(renderUnavailablePage(locale));
      expect(body).toContain(`<html lang="${locale}">`);
      expect(body).toContain(CLOUDIA_UNAVAILABLE_COPY[locale].unavailable);
      expect(body).not.toMatch(/href=|<a\b|<script|<form|<iframe|id="root"/i);
    });
  }

  it.each(['fr', '', 'ja-JP', 'EN'])('知らない言語（%j）は ja で返す', async (locale) => {
    const response = await unavailable(`/contact/chat/?locale=${encodeURIComponent(locale)}`);
    expect(await response.text()).toBe(renderUnavailablePage('ja'));
  });

  it('ambassador の入口も同じ終わりのページを返す', async () => {
    const response = await unavailable('/contact/chat/ambassador/?locale=en');
    expect(response.status).toBe(503);
    expect(await response.text()).toBe(renderUnavailablePage('en'));
  });

  it('HEAD は同じ header で本文なし', async () => {
    const response = await unavailable('/contact/chat/', 'status', 'HEAD');
    expect(response.status).toBe(503);
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(await response.text()).toBe('');
  });

  it('資産の要求は今のまま短い 503 の text を返す', async () => {
    const response = await unavailable('/contact/chat/assets/index.js');
    expect(response.status).toBe(503);
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(await response.text()).toBe('Cloudia is temporarily unavailable.');
  });

  it('要求の値（query）を本文に写さない。本文は言語ごとの固定の文だけ', async () => {
    const attack = '"><script>alert(1)</script><img src=x onerror=alert(2)>';
    const query = new URLSearchParams({ locale: `ja${attack}`, source: attack, intent: attack, embed: '1', q: attack });
    const response = await unavailable(`/contact/chat/?${query.toString()}`);
    const body = await response.text();
    expect(body).toBe(renderUnavailablePage('ja'));
    expect(body).not.toMatch(/alert|onerror|<script|<img/i);
  });

  it('ja と en の終わりのページは、代わりのページと同じ見出しを持つ（合成監視はこの見出しで判定する）', () => {
    expect(
      UNAVAILABLE_PAGE_TITLES,
      `edge=${JSON.stringify(UNAVAILABLE_PAGE_TITLES)} contact-guards=${JSON.stringify(CLOUDIA_CHAT_PLACEHOLDER_TITLES)}`,
    ).toEqual(CLOUDIA_CHAT_PLACEHOLDER_TITLES);
    expect(renderUnavailablePage('ja')).toContain(`<h1>${CLOUDIA_CHAT_PLACEHOLDER_TITLES.ja}</h1>`);
    expect(renderUnavailablePage('en')).toContain(`<h1>${CLOUDIA_CHAT_PLACEHOLDER_TITLES.en}</h1>`);
  });
});

describe('電話の行', () => {
  it('edge は電話の行をまだ描かない（定数が true になったら、edge の描き方を先に決めて足す）', () => {
    expect(
      CLOUDIA_UNAVAILABLE_PHONE_VISIBLE,
      'CLOUDIA_UNAVAILABLE_PHONE_VISIBLE が true になった。edge（workers/contact-edge）は電話の行をまだ描かない。出すなら edge の描き方を先に決めて足す',
    ).toBe(false);
    for (const locale of UNAVAILABLE_LOCALES) {
      expect(renderUnavailablePage(locale)).not.toMatch(/tel:|電話|phone|电话|전화|teléfono/i);
    }
  });
});
