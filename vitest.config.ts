import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}',
      // Node で動くスクリプトのテスト: ビルド成果物を検査する scripts/seo-snapshot.mjs 等と、scripts/i18n の
      // 翻訳パイプライン（各ファイルは `// @vitest-environment node` で DOM 環境を使わない）
      'scripts/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}',
    ],
    exclude: ['node_modules', 'dist', '.astro'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '.astro/',
        'src/pages/',
        'src/layouts/',
        'coverage/',
        '**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});