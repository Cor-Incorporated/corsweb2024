import type { Alpine } from 'alpinejs';

// Alpine のグローバルストア（theme）。以前は Layout / BlogLayout に別々のインラインスクリプトで
// 重複定義し、CDN 版 Alpine の読込完了をポーリングして登録していた。npm 版 Alpine をバンドルする
// AlpineInit.astro から、Alpine.start() の前に 1 回だけ登録する。
// 言語切替はヘッダーのドロップダウン（通常のリンク）で行うため、以前の lang ストアは参照 0 件で削除した。

export const THEME_STORAGE_KEY = 'theme';

type StoreHost = Pick<Alpine, 'store'>;
type ThemeStorage = Pick<Storage, 'setItem'> | null;

export type ThemeStore = {
  isDark: boolean;
  toggle(): void;
};

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

function safeLocalStorage(): ThemeStorage {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** theme ストアを登録する。Alpine.start() より前に呼ぶこと。 */
export function registerAlpineStores(alpine: StoreHost, root: HTMLElement = document.documentElement): void {
  alpine.store('theme', createThemeStore(root, safeLocalStorage()));
}
