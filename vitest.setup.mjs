/**
 * テストのたびに event loop を 1 回まわす（vitest.config.ts の setupFiles）。
 *
 * 同期のテスト（spawnSync・execFileSync で外部のコマンドを待つもの）が続くと、テストの間の await はマイクロタスクで
 * 終わり、vitest の worker は親プロセスとの RPC の返事（I/O）を受け取れない。それがファイル全体で 60 秒（birpc の
 * 既定の時間切れ）を超えると、テストはすべて通っても `[vitest-worker]: Timeout calling "onTaskUpdate"` が出て、
 * npm run test:run が exit 1 になる。2026-10-25 に、scripts/__tests__/h5-admission-check.test.mjs が 68〜73 秒
 * かかった 3 回とも起き、47〜55 秒の 3 回は起きなかった。同期で 4 秒 × 18 件をふさぐだけのテストでも再現し、
 * このフックを足すと起きなかった。
 */
import { afterEach } from 'vitest';

const nextMacrotask = globalThis.setImmediate ?? ((callback) => setTimeout(callback, 0));

afterEach(() => new Promise((resolve) => nextMacrotask(resolve)));
