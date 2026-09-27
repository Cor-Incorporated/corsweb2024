import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createLangStore,
  createThemeStore,
  nextLocalePath,
  registerAlpineStores,
  THEME_STORAGE_KEY,
} from '../alpine-stores';

describe('nextLocalePath', () => {
  it.each([
    ['ja', '/', '/en'],
    ['ja', '/about/', '/en/about/'],
    ['en', '/en/about/', '/zh/about/'],
    ['ko', '/ko', '/es'],
    ['es', '/es/blog/post/', '/blog/post/'],
    ['es', '/es', '/'],
    // ロケール接頭辞は語境界でだけ外す（/escape を /cape にしない）
    ['ja', '/escape/', '/en/escape/'],
    // 未知の lang は ja 扱いの次（= 先頭 ja）へ
    ['xx', '/en/about/', '/about/'],
  ])('%s %s → %s', (lang, path, expected) => {
    expect(nextLocalePath(lang, path)).toBe(expected);
  });
});

describe('createThemeStore', () => {
  afterEach(() => {
    document.documentElement.classList.remove('dark');
  });

  it('reads the initial state from the <html> dark class applied by ThemeInit', () => {
    document.documentElement.classList.add('dark');
    expect(createThemeStore(document.documentElement, null).isDark).toBe(true);
  });

  it('toggles the dark class and persists the choice', () => {
    const storage = { setItem: vi.fn() };
    const store = createThemeStore(document.documentElement, storage);
    store.toggle();
    expect(store.isDark).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(storage.setItem).toHaveBeenLastCalledWith(THEME_STORAGE_KEY, 'dark');
    store.toggle();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(storage.setItem).toHaveBeenLastCalledWith(THEME_STORAGE_KEY, 'light');
  });

  it('still toggles when storage throws (private mode)', () => {
    const storage = {
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    const store = createThemeStore(document.documentElement, storage);
    expect(() => store.toggle()).not.toThrow();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});

describe('createLangStore / registerAlpineStores', () => {
  it('navigates to the next locale path from the current <html lang>', () => {
    const root = document.createElement('html');
    root.lang = 'zh';
    const navigate = vi.fn();
    window.history.replaceState(null, '', '/zh/about/');
    createLangStore(root, navigate).toggle();
    expect(navigate).toHaveBeenCalledWith('/ko/about/');
  });

  it('registers theme and lang stores on the given Alpine host', () => {
    const stores = new Map<string, unknown>();
    const host = { store: vi.fn((name: string, value?: unknown) => stores.set(name, value)) };
    registerAlpineStores(host as never);
    expect([...stores.keys()]).toEqual(['theme', 'lang']);
    expect(stores.get('theme')).toMatchObject({ isDark: false });
    expect(stores.get('lang')).toMatchObject({ current: document.documentElement.lang });
  });
});
