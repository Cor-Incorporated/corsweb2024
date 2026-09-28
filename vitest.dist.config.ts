import { defineConfig } from 'vitest/config';

// ビルド済み dist に対する回帰ガード（Issue #323）。`npm run build` の後に `npm run test:dist` で実行する。
// 通常のユニットテスト（vitest.config.ts・src/**）とは分ける: dist が無い段階で走ると必ず落ちるため。
// 判定基準は src/config/contact-guards.ts。dist の場所は CONTACT_GUARD_DIST_DIR で差し替えられる
// （反証の実測で、壊した dist の複製を検査するため）。
// 注意: テストの置き場所を tests/dist/ にしないこと。.gitignore の `dist/` と vitest 既定の
// exclude（**/dist/**）の両方に掛かり、コミットされず実行もされない（「0 件で緑」にはならず
// No test files found で落ちるが、置き場所ごと消えると気づけない）。
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/build-output/**/*.test.ts'],
  },
});
