import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { CONTACT_INTENTS } from '../../../config/site';
import {
  CONTACT_CHAT_SUBMIT_SUCCESS_EVENT,
  LAUNCHER_ENTRY_SURFACES,
  LAUNCHER_ENTRY_SURFACE,
  LAUNCHER_SUBMIT_MESSAGE_TYPE,
  createLauncherSubmitBridge,
  toLauncherEntrySurface,
  type LauncherSubmitMessageEvent,
  type LauncherSubmitWindow,
  type LauncherSubmitFrame,
} from '../launcherSubmitAnalytics';

// ランチャー（iframe, ?embed=1）からの受付成功を、親ページの GA4 に 1 回だけ送る。
// 2026-11-18 の統括判断: GA4 に渡すのは entry_surface だけ。intent は受け取る条件にだけ使い、
// 送らない。entry_surface は候補（LAUNCHER_ENTRY_SURFACES）の中だけに寄せる。
// 落ちるべき変更:
//   - origin / source を見ずに message を受ける（別の枠・別のページからの偽装）
//   - intent を GA4 に渡す、または 7 種以外の intent を受ける
//   - 候補に無い値・URL・自由記述を entry_surface として送る
//   - 氏名・メール・電話・会社名・会話・受付番号などの項目を GA4 に渡す
//   - 同じ iframe の連続した message で 2 回送る
//   - gtag が無い（本番以外）のに送る、または送ったことにする

const PAGE_HREF = 'https://cor-jp.com/contact/';
const FRAME_ORIGIN = 'https://cor-jp.com';
const FRAME_SRC = '/contact/chat/?source=corsweb-launcher&locale=ja&embed=1';

type Gtag = (...args: unknown[]) => void;

function fakeWindow(href: string, gtag?: Gtag) {
  const listeners = new Map<string, Set<(event: LauncherSubmitMessageEvent) => void>>();
  const win = {
    location: { href },
    gtag,
    addEventListener(type: string, listener: (event: LauncherSubmitMessageEvent) => void) {
      const set = listeners.get(type) ?? new Set();
      set.add(listener);
      listeners.set(type, set);
    },
    removeEventListener(type: string, listener: (event: LauncherSubmitMessageEvent) => void) {
      listeners.get(type)?.delete(listener);
    },
    count(type: string) {
      return listeners.get(type)?.size ?? 0;
    },
    emit(type: string, event: LauncherSubmitMessageEvent) {
      for (const listener of [...(listeners.get(type) ?? [])]) listener(event);
    },
  };
  return win;
}

function fakeFrame(src: string, contentWindow: unknown) {
  const listeners = new Set<() => void>();
  const frame = {
    src,
    contentWindow,
    addEventListener(type: string, listener: () => void) {
      if (type === 'load') listeners.add(listener);
    },
    removeEventListener(type: string, listener: () => void) {
      if (type === 'load') listeners.delete(listener);
    },
    load() {
      for (const listener of [...listeners]) listener();
    },
    count() {
      return listeners.size;
    },
  };
  return frame;
}

function setup(options: { href?: string; frameSrc?: string; gtag?: Gtag } = {}) {
  const calls: unknown[][] = [];
  const gtag: Gtag =
    options.gtag ??
    ((...args: unknown[]) => {
      calls.push(args);
    });
  const win = fakeWindow(options.href ?? PAGE_HREF, gtag);
  const frameWindow = { name: 'cloudia-launcher-frame' };
  const frame = fakeFrame(options.frameSrc ?? FRAME_SRC, frameWindow);
  const bridge = createLauncherSubmitBridge({
    win: win as unknown as LauncherSubmitWindow,
    frame: frame as unknown as LauncherSubmitFrame,
  });
  const send = (data: unknown, overrides: Partial<LauncherSubmitMessageEvent> = {}) =>
    bridge.handle({
      origin: FRAME_ORIGIN,
      source: frameWindow,
      data,
      ...overrides,
    });
  return { win, frame, frameWindow, bridge, send, calls };
}

const validMessage = (intent: string = CONTACT_INTENTS[0]) => ({
  type: LAUNCHER_SUBMIT_MESSAGE_TYPE,
  intent,
});

describe('createLauncherSubmitBridge（ランチャーの受付成功を GA4 へ）', () => {
  it('(a) 正しい message で、entry_surface だけを第 3 引数に 1 回だけ送る', () => {
    expect(LAUNCHER_ENTRY_SURFACES).toEqual(['launcher']);
    for (const intent of CONTACT_INTENTS) {
      const { send, calls } = setup();
      send(validMessage(intent));
      expect(calls).toHaveLength(1);
      expect(calls[0][0]).toBe('event');
      expect(calls[0][1]).toBe(CONTACT_CHAT_SUBMIT_SUCCESS_EVENT);
      expect(calls[0][2]).toEqual({ entry_surface: LAUNCHER_ENTRY_SURFACE });
      // 第 3 引数のキーは entry_surface の 1 つだけ（intent のキーが混ざらない）。
      expect(Object.keys(calls[0][2] as object)).toEqual(['entry_surface']);
    }
    expect(CONTACT_CHAT_SUBMIT_SUCCESS_EVENT).toBe('contact_chat_submit_success');
    expect(LAUNCHER_ENTRY_SURFACE).toBe('launcher');
  });

  it('(b) intent は GA4 に送らない（7 キーの値も intent という語も入らない）', () => {
    for (const intent of CONTACT_INTENTS) {
      const { send, calls } = setup();
      send(validMessage(intent));
      expect(calls).toHaveLength(1);
      for (const call of calls) {
        const serialized = JSON.stringify(call);
        expect(serialized).not.toContain('intent');
        for (const contactIntent of CONTACT_INTENTS) {
          expect(serialized).not.toContain(contactIntent);
        }
      }
    }
    expect(CONTACT_INTENTS).toHaveLength(7);
  });

  it('(c) 候補に無い値・URL・自由記述は entry_surface にせず、候補だけを送る', () => {
    const invalid = [
      'evil',
      'https://example.com/x',
      '山田 太郎 taro@example.com',
      'launcher ',
      'Launcher',
      '',
      7,
      null,
      undefined,
      { entry_surface: 'evil' },
      ['launcher'],
    ];
    for (const raw of invalid) {
      expect(toLauncherEntrySurface(raw)).toBe(LAUNCHER_ENTRY_SURFACE);
      expect(LAUNCHER_ENTRY_SURFACES).toContain(toLauncherEntrySurface(raw));
    }
    expect(toLauncherEntrySurface('launcher')).toBe('launcher');

    // 候補に無い値が message に混ざっても、gtag の引数のどこにも出ない。
    const { send, calls } = setup();
    send({
      ...validMessage('contract-dev'),
      entry_surface: 'evil',
      entrySurface: 'https://example.com/x',
      surface: '山田 太郎 taro@example.com',
    });
    const serialized = JSON.stringify(calls);
    expect(serialized).not.toContain('evil');
    expect(serialized).not.toContain('https://example.com/x');
    expect(serialized).not.toContain('山田 太郎 taro@example.com');
    expect(calls).toEqual([
      ['event', CONTACT_CHAT_SUBMIT_SUCCESS_EVENT, { entry_surface: 'launcher' }],
    ]);
  });

  it('iframe の src の origin と違う origin からの message は受けない', () => {
    const { send, calls } = setup();
    send(validMessage(), { origin: 'https://evil.example' });
    send(validMessage(), { origin: 'https://cor-jp.com.evil.example' });
    send(validMessage(), { origin: 'http://cor-jp.com' });
    expect(calls).toEqual([]);
  });

  it('iframe の contentWindow ではない source からの message は受けない', () => {
    const { send, calls } = setup();
    send(validMessage(), { source: { name: 'another-frame' } });
    send(validMessage(), { source: null });
    expect(calls).toEqual([]);
  });

  it('許可した type 以外（cloudia:ready・ハンドオフ・文字列）は受けない', () => {
    const { send, calls } = setup();
    send({ type: 'cloudia:ready', intent: CONTACT_INTENTS[0] });
    send({ type: 'cloudia:grift-handoff-ready', intent: CONTACT_INTENTS[0] });
    send('cloudia:ready');
    send({ intent: CONTACT_INTENTS[0] });
    expect(calls).toEqual([]);
  });

  it('7 種に無い intent（未知の値・空・数値・個人情報らしい値）は受けない', () => {
    const { send, calls } = setup();
    for (const intent of [
      'unknown-intent',
      '',
      'grift-team-beta ',
      '氏名の値',
      'mail@example.invalid',
      7,
      null,
      undefined,
    ]) {
      send({ type: LAUNCHER_SUBMIT_MESSAGE_TYPE, intent });
    }
    expect(calls).toEqual([]);
  });

  it('message に個人情報らしい項目が付いていても、GA4 には entry_surface だけを渡す', () => {
    const { send, calls } = setup();
    send({
      ...validMessage('contract-dev'),
      receiptNumber: '受付番号の値',
      receiptId: '受付IDの値',
      name: '氏名の値',
      email: 'mail@example.invalid',
      phone: '000-0000-0000',
      company: '会社名の値',
      conversation: '会話の本文',
      note: '自由記述の値',
    });
    expect(calls).toEqual([
      ['event', CONTACT_CHAT_SUBMIT_SUCCESS_EVENT, { entry_surface: 'launcher' }],
    ]);
    expect(JSON.stringify(calls)).not.toContain('氏名の値');
    expect(JSON.stringify(calls)).not.toContain('mail@example.invalid');
    expect(JSON.stringify(calls)).not.toContain('000-0000-0000');
    expect(JSON.stringify(calls)).not.toContain('受付番号の値');
    expect(JSON.stringify(calls)).not.toContain('会話の本文');
    expect(JSON.stringify(calls)).not.toContain('intent');
    for (const intent of CONTACT_INTENTS) {
      expect(JSON.stringify(calls)).not.toContain(intent);
    }
  });

  it('同じ iframe の同じ受付の 2 回目以降は送らない', () => {
    const { send, calls } = setup();
    send(validMessage('local-llm-poc'));
    send(validMessage('local-llm-poc'));
    send(validMessage('local-llm-poc'));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual([
      'event',
      CONTACT_CHAT_SUBMIT_SUCCESS_EVENT,
      { entry_surface: 'launcher' },
    ]);
  });

  it('iframe が読み込み直されたら、次の受付はまた 1 回だけ送れる', () => {
    const { send, frame, calls } = setup();
    send(validMessage('estimate-audit'));
    send(validMessage('estimate-audit'));
    frame.load();
    send(validMessage('estimate-audit'));
    send(validMessage('estimate-audit'));
    expect(calls).toHaveLength(2);
  });

  it('gtag が無い（本番以外のホスト）時は送らず、送った印も付けない（同じ message を後で受けられる）', () => {
    const calls: unknown[][] = [];
    const { win, send } = setup();
    win.gtag = undefined;
    send(validMessage());
    expect(calls).toEqual([]);
    win.gtag = (...args: unknown[]) => calls.push(args);
    send(validMessage());
    expect(calls).toHaveLength(1);
  });

  it('origin は iframe の src から読む（同じ path でもホストが違えば別の origin）', () => {
    const preview = setup({ href: 'https://preview.example/contact/', frameSrc: FRAME_SRC });
    preview.send(validMessage(), { origin: FRAME_ORIGIN });
    expect(preview.calls).toEqual([]);
    preview.send(validMessage(), { origin: 'https://preview.example' });
    expect(preview.calls).toHaveLength(1);

    const absolute = setup({
      href: 'https://preview.example/contact/',
      frameSrc: 'https://cor-jp.com/contact/chat/?embed=1',
    });
    absolute.send(validMessage(), { origin: 'https://preview.example' });
    expect(absolute.calls).toEqual([]);
    absolute.send(validMessage(), { origin: FRAME_ORIGIN });
    expect(absolute.calls).toHaveLength(1);
  });

  it('dispose したら message も load も受けない', () => {
    const { frame, bridge, win, frameWindow, calls } = setup();
    bridge.dispose();
    win.emit('message', { origin: FRAME_ORIGIN, source: frameWindow, data: validMessage() });
    frame.load();
    expect(calls).toEqual([]);
    expect(win.count('message')).toBe(0);
    expect(frame.count()).toBe(0);
  });

  it('CloudiaLauncher.astro は iframe を取ってこの橋を astro:page-load で付け直す', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/contact/CloudiaLauncher.astro'),
      'utf8'
    );
    expect(source).toContain("from './launcherSubmitAnalytics'");
    expect(source).toContain('createLauncherSubmitBridge');
    expect(source).toContain("getElementById('cloudia-launcher-frame')");
    expect(source).toContain("addEventListener('astro:page-load'");
  });
});
