import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createThemeStore, registerAlpineStores, THEME_STORAGE_KEY } from '../alpine-stores';

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

describe('registerAlpineStores', () => {
  it('registers only the theme store', () => {
    const stores = new Map<string, unknown>();
    const host = { store: vi.fn((name: string, value?: unknown) => stores.set(name, value)) };
    registerAlpineStores(host as never);
    expect([...stores.keys()]).toEqual(['theme']);
    expect(stores.get('theme')).toMatchObject({ isDark: false });
  });

  // 宣言（登録するストア）と実体（テンプレートの $store 参照）を結ぶ: 参照されないストアを残さず、
  // 登録していないストアを参照しない。
  it('matches the $store references used in src templates', () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const full = path.join(dir, name);
        return statSync(full).isDirectory() ? walk(full) : full.endsWith('.astro') ? [full] : [];
      });
    const referenced = new Set<string>();
    for (const file of walk(path.resolve('src'))) {
      for (const match of readFileSync(file, 'utf8').matchAll(/\$store\.(\w+)/g)) referenced.add(match[1]);
    }
    expect([...referenced].sort()).toEqual(['theme']);
  });
});
