import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import compress from 'astro-compress';
import compressor from "astro-compressor";
import { defineConfig } from 'astro/config';
import { remarkHasMath } from './src/utils/remark-has-math';
import { remarkArticleSources } from './src/utils/remark-article-sources';
import { rehypeContactLinks } from './src/utils/rehype-contact-links';
import { rehypeLineBreaks } from './src/utils/rehype-line-breaks';
import { fileURLToPath } from 'node:url';
import { includeInSitemap } from './src/config/indexing';
import { collectBlogLastmod } from './src/config/sitemap';

// 記事 URL → lastmod（updatedDate ?? pubDate）。記事以外の URL には lastmod を付けない（Epic #330 / #334）。
const blogLastmod = collectBlogLastmod(fileURLToPath(new URL('./src/content/blog/', import.meta.url)));

// 見出しテキスト用の span の id。aria-labelledby が題自身を指すと、Chrome が題の名前を
// 計算する時に link の名前（題自身への参照）がもう一度入り、題の名前が 2 回現れる。
// 参照先を見出し link の外の span にすれば重複しない。
function headingTextIdOf(heading) {
  const id = heading.properties?.id;
  return typeof id === 'string' && id !== '' ? `${id}--text` : null;
}

// 見出し link（rehype-autolink-headings が題に足す a.heading-link）。className は配列と文字列の両方を受ける。
function isHeadingLinkNode(node) {
  if (node?.type !== 'element' || node.tagName !== 'a') return false;
  const className = node.properties?.className;
  if (Array.isArray(className)) return className.includes('heading-link');
  if (typeof className === 'string') return className.split(/\s+/).includes('heading-link');
  return false;
}

// rehypePlugins の最後（rehype-line-breaks の後）に掛ける。題の直接の子のうち見出し link
// 以外を 1 つの span にまとめ、題と link の両方の aria-labelledby の参照先にする。
// 文字は変えない。link の入れ子も名前の参照の輪も作らず、空の題は参照を作らない（試験で落ちる）。
function rehypeHeadingNameSpan() {
  const collectIds = (node, ids) => {
    const id = node.properties?.id;
    if (typeof id === 'string' && id !== '') ids.add(id);
    for (const child of node.children ?? []) collectIds(child, ids);
  };
  const transform = (node, usedIds) => {
    if (node.type !== 'element' || !/^h[1-6]$/.test(node.tagName) || !Array.isArray(node.children)) return;
    const textId = headingTextIdOf(node);
    if (!textId) return;
    // slug が --text で終わる題が同じ page に在る時は、重ならない suffix を決める
    let spanId = textId;
    let suffix = 2;
    while (usedIds.has(spanId)) spanId = `${textId}-${suffix++}`;
    const textChildren = node.children.filter((child) => !isHeadingLinkNode(child));
    const headingLinks = node.children.filter((child) => isHeadingLinkNode(child));
    if (textChildren.length === 0 || headingLinks.length === 0) return;
    usedIds.add(spanId);
    node.children = [
      { type: 'element', tagName: 'span', properties: { id: spanId }, children: textChildren },
      ...headingLinks,
    ];
    node.properties.ariaLabelledBy = spanId;
    for (const link of headingLinks) link.properties.ariaLabelledBy = spanId;
  };
  const walk = (node, usedIds) => {
    transform(node, usedIds);
    for (const child of node.children ?? []) walk(child, usedIds);
  };
  return (tree) => {
    const usedIds = new Set();
    collectIds(tree, usedIds);
    walk(tree, usedIds);
  };
}

export default defineConfig({
  site: 'https://cor-jp.com',
  // ブラウザ検査では、開発ツールバーが固定ボタンへのクリックを遮らないようにする。
  devToolbar: { enabled: process.env.COR_BROWSER_TEST !== '1' },
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
      // 数式の有無を remarkPluginFrontmatter.hasMath に記録（KaTeX CSS を数式記事だけで読むため）
      remarkHasMath,
      // 最後の「参考資料」の節のリンクを remarkPluginFrontmatter.citations に記録（Article.citation に出す）
      remarkArticleSources,
    ],
    rehypePlugins: [
      'rehype-slug',
      ['rehype-autolink-headings', {
        behavior: 'append',
        // aria-labelledby は rehypeHeadingNameSpan で題と一緒に付ける（参照先の決め方を 1 つに揃えるため）
        properties: { className: ['heading-link'] },
      }],
      'rehype-katex',
      // 記事の本文の問い合わせページへの link を、その記事の言語の Cloudia のチャットへ向ける（本文と訳は変えない）
      rehypeContactLinks,
      // 本文と題に、文と塊の印を付ける（docs/design/layout-rules.md の R1）。文字は変えない
      rehypeLineBreaks,
      // 題の名前の参照先の span（rehypeHeadingNameSpan を参照）。line-breaks の後で掛け、塊の構造を残す
      rehypeHeadingNameSpan,
    ],
    shikiConfig: {
      theme: 'dracula',
      langs: [],
      wrap: true,
    },
  },
  integrations: [
    tailwind(), 
    // HTML キーは指定しない（= astro-compress 既定の html-minifier-terser 設定。これまでの実効設定と同じ）。
    // 以前ここにあった 'remove-comments' / 'remove-tags' / 'minify-js' / 'minify-css' は astro-compress 2.x が
    // 読まない無効キーだった（効いていれば JSON-LD を全削除する 'remove-tags' まで含んでいた）。
    compress({
      CSS: true,
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
    // rollupOptions.output の出力名を上書きしない。上書きは Astro のサーバー描画（SSR）ビルドにも効き、
    // 記事本文を含む SSR チャンクが公開ディレクトリ dist/_astro/*.js に残っていた（Epic #330 / #337）。
    // クライアント用の名前は Astro 既定でも _astro/[name].[hash].js になる。
    build: {
      minify: 'terser',
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
