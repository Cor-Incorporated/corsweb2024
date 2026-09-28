import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import compress from 'astro-compress';
import compressor from "astro-compressor";
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import { includeInSitemap } from './src/config/indexing';
import { collectBlogLastmod } from './src/config/sitemap';

// 記事 URL → lastmod（updatedDate ?? pubDate）。記事以外の URL には lastmod を付けない（Epic #330 / #334）。
const blogLastmod = collectBlogLastmod(fileURLToPath(new URL('./src/content/blog/', import.meta.url)));

export default defineConfig({
  site: 'https://cor-jp.com',
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover'
  },
  i18n: {
    locales: ["ja", "en", "zh", "ko", "es"],
    defaultLocale: "ja",
    routing: {
      prefixDefaultLocale: false
    }
  },
  markdown: {
    remarkPlugins: [
      'remark-gfm',
      'remark-math',
      ['remark-link-card-plus', { 
        cache: true,
        shortenUrl: true,
        showImage: true,
        imagePosition: 'right'
      }],
    ],
    rehypePlugins: [
      'rehype-slug',
      ['rehype-autolink-headings', { behavior: 'append', properties: { class: 'heading-link' } }],
      'rehype-katex',
    ],
    shikiConfig: {
      theme: 'dracula',
      langs: [],
      wrap: true,
    },
  },
  integrations: [
    tailwind(), 
    compress({
      CSS: true,
      HTML: {
        'remove-comments': true,
        'remove-tags': ['script[type="application/ld+json"]'],
        'minify-js': true,
        'minify-css': true
      },
      Image: false,
      JavaScript: true,
      SVG: true
    }), 
    sitemap({
      changefreq: 'weekly',
      priority: 0.7,
      i18n: {
        defaultLocale: 'ja',
        locales: {
          ja: 'ja',
          en: 'en',
          zh: 'zh',
          ko: 'ko',
          es: 'es'
        }
      },
      // noindex のページ（タグ一覧・検証用・決済コールバック・404・/contact/chat/）と非ページを除外。
      // 判定は Layout の meta robots と同じ src/config/indexing.ts を使う（ずれを構造的に防ぐ）。
      filter: includeInSitemap,
      serialize: (item) => {
        const lastmod = blogLastmod.get(new URL(item.url).pathname);
        return lastmod ? { ...item, lastmod } : item;
      },
    }), 
    compressor({
      gzip: true,
      brotli: true
    })
  ],
  vite: {
    resolve: {
      // 特定のモジュールへのパスエイリアスや依存関係の解決設定
    },
    optimizeDeps: {
      exclude: []
    },
    build: {
      minify: 'terser',
      rollupOptions: {
        output: {
          manualChunks: undefined,
          entryFileNames: '_astro/[name].[hash].js',
          chunkFileNames: '_astro/[name].[hash].js',
          assetFileNames: '_astro/[name].[hash].[ext]'
        }
      }
    },
    plugins: [
      // 必要に応じてViteプラグインを追加
    ],
    envPrefix: 'PUBLIC_',  // クライアントサイドで利用可能な環境変数のプレフィックス
    json: {
      stringify: false
    }
  },
});
