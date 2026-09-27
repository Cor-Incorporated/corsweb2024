import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchContactEdge, type Env } from './index';

afterEach(() => vi.unstubAllGlobals());

const request = (path: string) => new Request(`https://cor-jp.com${path}`);

describe('cor-contact-edge', () => {
  it('keeps the Firebase origin as the safe default', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('firebase', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchContactEdge(request('/contact/chat/'), {});

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('firebase');
    expect(fetchMock).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://cor-jp-main.web.app/contact/chat/' }));
  });

  it('proxies only the Cloudia chat path when Pages is enabled', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('cloudia', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const env: Env = {
      CONTACT_ORIGIN: 'pages',
      CLOUDIA_PAGES_ORIGIN: 'https://cloudia.example',
    };

    const response = await fetchContactEdge(request('/contact/chat/assets/app.js?rev=1'), env);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('cloudia');
    expect(fetchMock).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://cloudia.example/assets/app.js?rev=1' }));
  });

  it('rewrites the ambassador entry to the Cloudia SPA with its mode', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('cloudia ambassador', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchContactEdge(request('/contact/chat/ambassador/'), {
      CONTACT_ORIGIN: 'pages',
      CLOUDIA_PAGES_ORIGIN: 'https://cloudia.example',
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('cloudia ambassador');
    expect(fetchMock).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://cloudia.example/?mode=ambassador',
    }));
  });

  it('falls back to Firebase when Pages is unavailable', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('pages down', { status: 503 }))
      .mockResolvedValueOnce(new Response('firebase fallback', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchContactEdge(request('/contact/chat/'), { CONTACT_ORIGIN: 'pages' });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('firebase fallback');
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ url: 'https://cor-jp-main.web.app/contact/chat/' }));
  });

  it('falls back to Firebase when Pages does not contain the requested asset', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('not found', { status: 404 }))
      .mockResolvedValueOnce(new Response('firebase fallback', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchContactEdge(request('/contact/chat/'), { CONTACT_ORIGIN: 'pages' });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('firebase fallback');
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ url: 'https://cor-jp-main.web.app/contact/chat/' }));
  });

  it('redirects the chat entry to the existing form when both origins miss it', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('pages down', { status: 503 }))
      .mockResolvedValueOnce(new Response('not found', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchContactEdge(request('/contact/chat/'), { CONTACT_ORIGIN: 'pages' });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://cor-jp.com/contact/');
  });

  it('does not intercept other paths', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('site', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchContactEdge(request('/about/'), {});

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('site');
    expect(fetchMock).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://cor-jp.com/about/' }));
  });

  it('redirects the bare chat path to the canonical trailing slash', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchContactEdge(request('/contact/chat'), {});

    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('https://cor-jp.com/contact/chat/');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the same canonical redirect for HEAD requests', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchContactEdge(new Request('https://cor-jp.com/contact/chat', { method: 'HEAD' }), {});

    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('https://cor-jp.com/contact/chat/');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('marks the Cloudia HTML as noindex but leaves static assets indexable-neutral', async () => {
    const env: Env = { CONTACT_ORIGIN: 'pages', CLOUDIA_PAGES_ORIGIN: 'https://cloudia.example' };
    const html = new Response('<!doctype html><title>Cloudia</title>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
    const asset = new Response('console.log(1)', {
      status: 200,
      headers: { 'content-type': 'application/javascript' },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(html).mockResolvedValueOnce(asset));

    const page = await fetchContactEdge(request('/contact/chat/'), env);
    const script = await fetchContactEdge(request('/contact/chat/assets/app.js'), env);

    expect(page.headers.get('x-robots-tag')).toBe('noindex');
    expect(page.headers.get('cache-control')).toBe('no-store');
    expect(script.headers.get('x-robots-tag')).toBeNull();
    expect(script.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
  });

  it('keeps noindex on the Firebase fallback HTML when Pages is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response('pages down', { status: 503 }))
        .mockResolvedValueOnce(new Response('<!doctype html><title>Cloudia</title>', {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        })),
    );

    const response = await fetchContactEdge(request('/contact/chat/'), { CONTACT_ORIGIN: 'pages' });

    expect(response.status).toBe(200);
    expect(response.headers.get('x-robots-tag')).toBe('noindex');
  });

  it('marks HEAD responses for the chat document as noindex too', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchContactEdge(
      new Request('https://cor-jp.com/contact/chat/', { method: 'HEAD' }),
      { CONTACT_ORIGIN: 'pages', CLOUDIA_PAGES_ORIGIN: 'https://cloudia.example' },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('x-robots-tag')).toBe('noindex');
    expect(fetchMock).toHaveBeenCalledWith(expect.objectContaining({ method: 'HEAD' }));
  });
});
