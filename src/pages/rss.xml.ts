import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { ORGANIZATION_NAMES } from '../config/organization';

export async function GET(context: APIContext) {
  // Get Japanese blog posts from Content Collections
  const allPosts = await getCollection('blog', ({ data }) => {
    return data.lang === 'ja' && !data.isDraft;
  });

  // Sort by date
  const japanesePosts = allPosts.sort(
    (a, b) => new Date(b.data.pubDate).getTime() - new Date(a.data.pubDate).getTime()
  );

  return rss({
    title: 'Cor.inc 技術ブログ',
    description: 'AI・機械学習、エンジニアリング、スタートアップ創業、技術革新に関する最新の技術ブログ。開発者・エンジニア向けの実践的な知識と洞察をお届けします。',
    site: context.site ?? 'https://cor-jp.com',
    items: japanesePosts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      author: post.data.author,
      categories: [post.data.category, ...post.data.tags],
      link: `/blog/${post.slug.replace(/^ja\//, '')}/`,
      guid: `https://cor-jp.com/blog/${post.slug.replace(/^ja\//, '')}/`,
    })),
    customData: `
      <language>ja</language>
      <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
      <generator>Astro</generator>
      <webMaster>contact@cor-jp.com (Terisuke)</webMaster>
      <managingEditor>contact@cor-jp.com (Terisuke)</managingEditor>
      <copyright>Copyright ${new Date().getFullYear()} ${ORGANIZATION_NAMES.ja}</copyright>
      <category>Technology</category>
      <category>AI</category>
      <category>Engineering</category>
      <category>Startup</category>
      <ttl>60</ttl>
      <image>
        <url>https://cor-jp.com/logo.png</url>
        <title>Cor.inc 技術ブログ</title>
        <link>https://cor-jp.com/blog</link>
        <width>400</width>
        <height>400</height>
      </image>
    `,
    // stylesheet: '/rss-styles.xsl', // Commented out: XSL file doesn't exist
  });
}