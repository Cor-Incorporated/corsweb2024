import { renderUnavailablePage, unavailablePageLocale } from './unavailable';

export interface Env {
  CONTACT_ORIGIN?: string;
  CLOUDIA_PAGES_ORIGIN?: string;
  FIREBASE_ORIGIN?: string;
}

const CHAT_PREFIX = '/contact/chat';
const AMBASSADOR_PATH = `${CHAT_PREFIX}/ambassador/`;

function originUrl(value: string | undefined, fallback: string): URL {
  try {
    const url = new URL(value || fallback);
    url.pathname = url.pathname.replace(/\/+$/, '');
    return url;
  } catch {
    return new URL(fallback);
  }
}

function responseHeaders(response: Response, isHtml: boolean): Headers {
  const headers = new Headers(response.headers);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  headers.set('content-security-policy', "frame-ancestors 'self'; object-src 'none'; base-uri 'self'");
  headers.set('x-frame-options', 'SAMEORIGIN');
  if (isHtml) {
    headers.set('cache-control', 'no-store');
    // Cloudia のチャット画面は検索結果に出すページではない（HP 側の /contact/chat/ も noindex）。
    // 本番はこの Worker が Pages の SPA を返すため HP の meta robots が届かないので、ヘッダで付ける。
    headers.set('x-robots-tag', 'noindex');
  } else if (response.ok) {
    headers.set('cache-control', 'public, max-age=31536000, immutable');
  }
  return headers;
}

async function fetchOrigin(request: Request, origin: URL, stripPrefix: boolean): Promise<Response> {
  const incoming = new URL(request.url);
  const target = new URL(origin.toString());
  const path = stripPrefix
    ? incoming.pathname.slice(CHAT_PREFIX.length) || '/'
    : incoming.pathname;
  target.pathname = path.startsWith('/') ? path : `/${path}`;
  target.search = incoming.search;

  const headers = new Headers(request.headers);
  headers.delete('host');
  const response = await fetch(new Request(target, { method: request.method, headers, redirect: 'manual' }));
  const isHtml = (response.headers.get('content-type') || '').includes('text/html');
  return new Response(response.body, { status: response.status, headers: responseHeaders(response, isHtml) });
}

function isSuccessfulStatic(response: Response): boolean {
  return response.status >= 200 && response.status < 400;
}

function isChatDocumentPath(pathname: string): boolean {
  return pathname === `${CHAT_PREFIX}/` || pathname === AMBASSADOR_PATH;
}

// Cloudia の画面も、サイトの代わりのページも配れないときの応答。
// 文書の要求には、その場で「受け付けられない」と分かるページを 503 で返す。/contact/ へは戻さない
// （/contact/ の主ボタンも同じ /contact/chat/ を開くので、戻すと同じ所を回る。#352）。
// URL と query はそのまま残り、読み込み直せば同じ文脈で試し直せる。資産の要求は短い 503 の text のまま。
function unavailableResponse(request: Request): Response {
  const url = new URL(request.url);
  if (!isChatDocumentPath(url.pathname)) {
    return new Response('Cloudia is temporarily unavailable.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
  const headers = responseHeaders(
    new Response(null, { headers: { 'content-type': 'text/html; charset=utf-8' } }),
    true,
  );
  // script も外の資源も読まない。枠（同じ origin）から読める形は今の HTML の応答と同じに保つ。
  headers.set(
    'content-security-policy',
    "frame-ancestors 'self'; object-src 'none'; base-uri 'self'; default-src 'none'; style-src 'unsafe-inline'",
  );
  const body = request.method === 'HEAD' ? null : renderUnavailablePage(unavailablePageLocale(url.searchParams.getAll('locale')));
  return new Response(body, { status: 503, headers });
}

function fallbackResponse(request: Request, response: Response): Response {
  if (response.status < 400) return response;
  return unavailableResponse(request);
}

export async function fetchContactEdge(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === CHAT_PREFIX && (request.method === 'GET' || request.method === 'HEAD')) {
    url.pathname = `${CHAT_PREFIX}/`;
    return Response.redirect(url.toString(), 301);
  }
  if (url.pathname !== `${CHAT_PREFIX}/` && !url.pathname.startsWith(`${CHAT_PREFIX}/`)) {
    return fetch(request);
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return fetch(request);
  }

  // The ambassador mode is a distinct public entry path, while Pages hosts a
  // single SPA at the Cloudia root. Rewrite only the document request and keep
  // the mode as a query parameter understood by the app.
  const isAmbassador = url.pathname === AMBASSADOR_PATH;
  const pagesRequest = (() => {
    if (!isAmbassador) return request;
    const ambassadorUrl = new URL(`${CHAT_PREFIX}/`, url);
    ambassadorUrl.searchParams.set('mode', 'ambassador');
    return new Request(ambassadorUrl, request);
  })();

  const firebase = originUrl(env.FIREBASE_ORIGIN, 'https://cor-jp-main.web.app');
  const pages = originUrl(env.CLOUDIA_PAGES_ORIGIN, 'https://cloudia-contact.pages.dev');
  const usePages = (env.CONTACT_ORIGIN || 'firebase').toLowerCase() === 'pages';

  if (usePages) {
    try {
      const pagesResponse = await fetchOrigin(pagesRequest, pages, true);
      if (isSuccessfulStatic(pagesResponse)) return pagesResponse;
    } catch {
      // Fall through to the Firebase fallback origin once.
    }
  }

  try {
    return fallbackResponse(request, await fetchOrigin(pagesRequest, firebase, false));
  } catch {
    return unavailableResponse(request);
  }
}

export default {
  fetch: fetchContactEdge,
};
