import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import compress from 'astro-compress';
import compressor from "astro-compressor";
import { defineConfig } from 'astro/config';
import { readFile, writeFile } from 'node:fs/promises';

// CMS の管理画面（dist/admin/index.html、ADR-0018）からサイトの CSS を外す。
// @astrojs/tailwind は全ページに Tailwind の base CSS を注入するが、Sveltia CMS は自前のスタイルで描画し、
// 追加の CSS を想定していない（読み込むと入力欄などのフォントが変わる）。compress より前に実行する。
// dev サーバーでは外れない（build:done はビルド時のみ）。e2e/admin-cms.spec.ts が stylesheet 0 本を確認する。
const stripSiteCssFromCmsAdmin = () => ({
  name: 'strip-site-css-from-cms-admin',
  hooks: {
    'astro:build:done': async ({ dir }) => {
      const file = new URL('admin/index.html', dir);
      const html = await readFile(file, 'utf8').catch((error) => {
        throw new Error(`[strip-site-css-from-cms-admin] ${file.pathname} を読めない。src/pages/admin/index.astro を消したなら、この integration も消す。(${error.message})`);
      });
      await writeFile(file, html.replace(/<link\b[^>]*\brel=["']?stylesheet["']?[^>]*>/gi, ''));
    },
  },
});

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
    stripSiteCssFromCmsAdmin(),
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
      lastmod: new Date(),
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
      customPages: [
        'https://cor-jp.com/blog',
        'https://cor-jp.com/en/blog',
        'https://cor-jp.com/news',
        'https://cor-jp.com/blog/category/ai',
        'https://cor-jp.com/blog/category/engineering',
        'https://cor-jp.com/blog/category/founder',
        'https://cor-jp.com/blog/category/lab',
      ],
      filter: (page) => {
        // Exclude API routes and build assets.
        if (page.includes('/api/') ||
            page.includes('/_astro/') ||
            page.includes('/remark-link-card-plus/')) {
          return false;
        }
        // Exclude non-indexable utility / test / payment-callback pages
        // (slug must be the final path segment, optionally locale-prefixed, so
        //  real blog posts like /blog/test-blog-foo are NOT excluded).
        if (/\/(styleguide|test-blog|tip-success|tip-cancelled)\/?$/.test(page)) {
          return false;
        }
        // Exclude the CMS admin (ADR-0018). robots.txt disallows /admin/ as well.
        if (new URL(page).pathname.startsWith('/admin/')) {
          return false;
        }
        return true;
      }
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
