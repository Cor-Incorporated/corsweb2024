import type { Alpine } from 'alpinejs';

// Alpine のグローバルストア（theme / lang）。以前は Layout / BlogLayout に別々のインライン
// スクリプトで重複定義し、CDN 版 Alpine の読込完了をポーリングして登録していた。
// npm 版 Alpine をバンドルする AlpineInit.astro から、Alpine.start() の前に 1 回だけ登録する。

export const THEME_STORAGE_KEY = 'theme';
export const LOCALE_ORDER = ['ja', 'en', 'zh', 'ko', 'es'] as const;

type StoreHost = Pick<Alpine, 'store'>;
type ThemeStorage = Pick<Storage, 'setItem'> | null;

export type ThemeStore = {
  isDark: boolean;
  toggle(): void;
};

export type LangStore = {
  current: string;
  toggle(): void;
};

/** lang.toggle の遷移先: 次のロケールで同じパスを開く（ja はプレフィックスなし）。 */
export function nextLocalePath(currentLang: string, pathname: string): string {
  const index = (LOCALE_ORDER as readonly string[]).indexOf(currentLang);
  const next = LOCALE_ORDER[(index + 1) % LOCALE_ORDER.length];
  const basePath = pathname.replace(/^\/(en|zh|ko|es)(?=\/|$)/, '') || '/';
  if (next === 'ja') return basePath;
  return basePath === '/' ? `/${next}` : `/${next}${basePath}`;
}

/** テーマストア。<html> の dark クラスが正で、初期値もそこから読む（ThemeInit.astro が先に当てる）。 */
export function createThemeStore(root: HTMLElement, storage: ThemeStorage): ThemeStore {
  return {
    isDark: root.classList.contains('dark'),
    toggle() {
      this.isDark = !this.isDark;
      root.classList.toggle('dark', this.isDark);
      try {
        storage?.setItem(THEME_STORAGE_KEY, this.isDark ? 'dark' : 'light');
      } catch {
        // ストレージ無効（プライベートモード等）でも表示の切替は成立させる
      }
    },
  };
}

export function createLangStore(root: HTMLElement, navigate: (path: string) => void): LangStore {
  return {
    current: root.lang,
    toggle() {
      navigate(nextLocalePath(this.current, window.location.pathname));
    },
  };
}

function safeLocalStorage(): ThemeStorage {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** theme / lang ストアを登録する。Alpine.start() より前に呼ぶこと。 */
export function registerAlpineStores(alpine: StoreHost, root: HTMLElement = document.documentElement): void {
  alpine.store('theme', createThemeStore(root, safeLocalStorage()));
  alpine.store(
    'lang',
    createLangStore(root, (path) => {
      window.location.href = path;
    }),
  );
}
