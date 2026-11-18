import { isContactIntent, type ContactIntent } from '../../config/site';

/**
 * Cloudia ランチャー（iframe, ?embed=1）の受付成功を、親ページの GA4 に 1 回だけ送る。
 *
 * 枠の中では gtag を読み込まない（同じ訪問者を二重に計測しないため）。受付が成功したら
 * 枠が親へ 1 つの message を送り、親がここで受けて `contact_chat_submit_success` を送る。
 * GA4 に渡すのは `entry_surface` だけ。`intent`（ADR-0014 の 7 キー）は message を
 * 受ける条件としてだけ確かめ、GA4 には渡さない（2026-11-18 統括判断）。
 * 氏名・メール・電話・会社名・会話の本文・受付番号・受付 ID・自由記述は読まない。
 *
 * 受ける条件:
 * - `event.source` がランチャーの iframe の contentWindow と一致する
 * - `event.origin` が iframe の src から読んだ origin と一致する（code が決めた src を使う）
 * - `event.data.type` が決めた 1 つで、`intent` が 7 キーのどれか
 * - gtag が在る（本番の cor-jp.com だけ。preview / develop では何もしない）
 *
 * 1 つの iframe の文書につき 1 回だけ送る。iframe が読み込み直されたら（load）、
 * 次の受付のために 1 回分を戻す。
 */

export const LAUNCHER_SUBMIT_MESSAGE_TYPE = 'cloudia:contact-chat-submit-success';
export const CONTACT_CHAT_SUBMIT_SUCCESS_EVENT = 'contact_chat_submit_success';

/**
 * GA4 の `entry_surface` に送ってよい候補。ここに無い値・URL・自由記述は送らない。
 * 候補を増やすときは、この配列と `toLauncherEntrySurface` の既定値を一緒に見直す。
 */
export const LAUNCHER_ENTRY_SURFACES = ['launcher'] as const;

export type LauncherEntrySurface = (typeof LAUNCHER_ENTRY_SURFACES)[number];

/** 候補に無い値を寄せる既定値。 */
export const LAUNCHER_ENTRY_SURFACE: LauncherEntrySurface = 'launcher';

/**
 * `entry_surface` の元になる値（設定・属性・message など）を、候補の中だけに寄せる。
 * 候補に無い値・URL・自由記述・文字列以外は、すべて既定の `launcher` にする。
 */
export function toLauncherEntrySurface(raw: unknown): LauncherEntrySurface {
  return typeof raw === 'string' && (LAUNCHER_ENTRY_SURFACES as readonly string[]).includes(raw)
    ? (raw as LauncherEntrySurface)
    : LAUNCHER_ENTRY_SURFACE;
}

/** message から読む項目だけを持つ形（それ以外の項目は読まない）。 */
export interface LauncherSubmitMessageEvent {
  readonly origin: string;
  readonly source: unknown;
  readonly data: unknown;
}

export interface LauncherSubmitWindow {
  readonly location: { readonly href: string };
  gtag?: (...args: unknown[]) => void;
  addEventListener(type: 'message', listener: (event: LauncherSubmitMessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (event: LauncherSubmitMessageEvent) => void): void;
}

export interface LauncherSubmitFrame {
  readonly src: string;
  readonly contentWindow: unknown;
  addEventListener(type: 'load', listener: () => void): void;
  removeEventListener(type: 'load', listener: () => void): void;
}

export interface LauncherSubmitBridge {
  /** 親の message listener が受け取った 1 件を判定して送る。 */
  handle(event: LauncherSubmitMessageEvent): void;
  /** iframe の読み込み直しで、次の受付を 1 回送れるようにする。 */
  reset(): void;
  /** listener を外す（ViewTransitions で frame が替わるとき）。 */
  dispose(): void;
}

/**
 * message の data から、受付成功として受けてよい intent だけを取り出す（GA4 へは渡さない）。
 * type が決めた 1 つと違う、intent が 7 キーに無い、object でない、のどれかなら null。
 */
export function readLauncherSubmitIntent(data: unknown): ContactIntent | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const message = data as { type?: unknown; intent?: unknown };
  if (message.type !== LAUNCHER_SUBMIT_MESSAGE_TYPE) return null;
  return isContactIntent(message.intent) ? message.intent : null;
}

/** iframe の src（code が決めた値）から、受け付ける origin を読む。 */
export function launcherFrameOrigin(frameSrc: string, pageHref: string): string | null {
  try {
    const src = new URL(frameSrc, pageHref);
    // javascript: などの origin は文字列 "null" になり、sandbox の枠と区別できない。
    if (src.protocol !== 'https:' && src.protocol !== 'http:') return null;
    return src.origin;
  } catch {
    return null;
  }
}

export function createLauncherSubmitBridge(options: {
  win: LauncherSubmitWindow;
  frame: LauncherSubmitFrame;
}): LauncherSubmitBridge {
  const { win, frame } = options;
  const expectedOrigin = launcherFrameOrigin(frame.src, win.location.href);
  let sent = false;

  const handle = (event: LauncherSubmitMessageEvent): void => {
    if (sent || !expectedOrigin) return;
    // frame.contentWindow が無い時に event.source も null だと一致してしまうので、先に確かめる。
    if (!frame.contentWindow || event.source !== frame.contentWindow) return;
    if (event.origin !== expectedOrigin) return;
    // intent は「許可リストのどれか」を確かめるためだけに読み、GA4 へは渡さない。
    const intent = readLauncherSubmitIntent(event.data);
    if (!intent) return;
    // gtag は message のたびに読む（Analytics.astro が後から定義しても、無ければ何もしない）。
    const gtag = win.gtag;
    if (typeof gtag !== 'function') return;
    sent = true;
    gtag('event', CONTACT_CHAT_SUBMIT_SUCCESS_EVENT, {
      entry_surface: toLauncherEntrySurface(LAUNCHER_ENTRY_SURFACE),
    });
  };

  const reset = (): void => {
    sent = false;
  };

  win.addEventListener('message', handle);
  frame.addEventListener('load', reset);

  return {
    handle,
    reset,
    dispose() {
      win.removeEventListener('message', handle);
      frame.removeEventListener('load', reset);
    },
  };
}
