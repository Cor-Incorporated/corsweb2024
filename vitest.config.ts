import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}',
      // ビルド成果物を検査する Node スクリプト（scripts/seo-snapshot.mjs 等）のテスト
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