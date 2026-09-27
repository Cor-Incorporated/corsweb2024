// jsdom の最小限の型宣言。@types/jsdom は入れていない（Issue #323 では新規依存を足さない）。
// 回帰ガードのテスト（tests/build-output/・src/config/__tests__/contact-guards.test.ts）が
// 使う範囲だけを宣言する。実 API とのずれはテスト実行時に落ちて表面化する。
// @types/jsdom を導入したら、宣言が重複するのでこのファイルを削除すること。
declare module 'jsdom' {
  export class VirtualConsole {
    on(event: 'jsdomError', listener: (error: Error) => void): this;
  }

  export interface ConstructorOptions {
    url?: string;
    runScripts?: 'dangerously' | 'outside-only';
    virtualConsole?: VirtualConsole;
  }

  export class JSDOM {
    constructor(html?: string, options?: ConstructorOptions);
    readonly window: Window & typeof globalThis;
  }
}
