import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    // scripts/i18n の翻訳パイプライン（Node 実行）のテストも含める。各ファイルは
    // `// @vitest-environment node` で DOM 環境を使わない。
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}', 'scripts/**/*.{test,spec}.{js,mjs}'],
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