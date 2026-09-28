// Sveltia CMS の npm 版（package.json で版固定）を Vite で同梱する。
// npm 版はフォント・翻訳・ライブラリも自オリジンから配信し、CDN（UNPKG / jsDelivr）を読まない。
// 設定は index.html の <link rel="cms-config-url"> が指す /config.yml（cms/public/config.yml）。
import { init } from '@sveltia/cms';

init();
