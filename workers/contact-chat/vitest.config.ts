import { defineConfig } from 'vitest/config';

// このディレクトリに設定ファイルが無いと、vitest は親を遡ってリポジトリのルートの vitest.config.ts を読む。
// ルートの node_modules が無ければ読み込みに失敗し、あれば happy-dom の環境で scripts/**/*.test.* まで集めて、
// node:test で書かれた scripts/sync-public-knowledge.test.mjs を「No test suite found」で落とす（exit 1）。
// そのテストは vitest に含めず、`npm run knowledge:test`（node --test）で実行する。
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
