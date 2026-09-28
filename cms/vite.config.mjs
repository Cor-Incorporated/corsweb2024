// CMS 管理画面のビルド（npm run build:cms）。公開サイトの Astro とは独立した Vite ビルドで、出力は cms/dist。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// config.yml の logo.src（/logo.png）に、公開サイトのロゴ public/logo.png を使う。
// 画像を cms/ に複製しないよう、ビルド時に出力へ加える。
const siteLogo = () => ({
  name: 'cor-site-logo',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'logo.png',
      source: readFileSync(new URL('../public/logo.png', import.meta.url)),
    });
  },
});

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  publicDir: 'public',
  plugins: [siteLogo()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // ハッシュ付きのファイルはすべて assets/ に出る。cms/firebase.json は assets/ だけを長期キャッシュにする。
    assetsDir: 'assets',
    // CMS 本体のチャンクは約 2.1 MB（構文定義・翻訳などは遅延読み込みの別チャンク）。既定 500 kB の警告を抑える。
    chunkSizeWarningLimit: 2500,
  },
});
