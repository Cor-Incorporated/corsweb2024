import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { ORGANIZATION_NAMES } from '../../config/organization';

export async function GET(context: APIContext) {
  // Get English blog posts from Content Collections
  const allPosts = await getCollection('blog', ({ data }) => {
    return data.lang === 'en' && !data.isDraft;
  });

  // Sort by date
  const englishPosts = allPosts.sort(
    (a, b) => new Date(b.data.pubDate).getTime() - new Date(a.data.pubDate).getTime()
  );

  return rss({
    title: 'Cor.inc Tech Blog',
    description: 'Latest tech blog covering AI/Machine Learning, software engineering, startup journey, and innovation. Practical insights and knowledge for developers and engineers.',
    site: context.site ?? 'https://cor-jp.com',
    items: englishPosts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      author: post.data.author,
      categories: [post.data.category, ...post.data.tags],
      link: `/en/blog/${post.slug.replace(/^en\//, '')}/`,
      guid: `https://cor-jp.com/en/blog/${post.slug.replace(/^en\//, '')}/`,
    })),
    customData: `
      <language>en</language>
      <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
      <generator>Astro</generator>
      <webMaster>contact@cor-jp.com (Terisuke)</webMaster>
      <managingEditor>contact@cor-jp.com (Terisuke)</managingEditor>
      <copyright>Copyright ${new Date().getFullYear()} ${ORGANIZATION_NAMES.en}</copyright>
      <category>Technology</category>
      <category>AI</category>
      <category>Engineering</category>
      <category>Startup</category>
      <ttl>60</ttl>
      <image>
        <url>https://cor-jp.com/logo.png</url>
        <title>Cor.inc Tech Blog</title>
        <link>https://cor-jp.com/en/blog</link>
        <width>400</width>
        <height>400</height>
      </image>
    `,
    // stylesheet: '/rss-styles.xsl', // Commented out: XSL file doesn't exist
  });
}