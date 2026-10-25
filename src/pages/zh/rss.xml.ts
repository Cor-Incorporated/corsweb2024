import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { ORGANIZATION_NAMES } from '../../config/organization';

export async function GET(context: APIContext) {
  // Get Chinese blog posts from Content Collections
  const allPosts = await getCollection('blog', ({ data }) => {
    return data.lang === 'zh' && !data.isDraft;
  });

  // Sort by date
  const chinesePosts = allPosts.sort(
    (a, b) => new Date(b.data.pubDate).getTime() - new Date(a.data.pubDate).getTime()
  );

  return rss({
    title: 'Cor.inc 技术博客',
    description: '最新技术博客，涵盖AI/机器学习、软件工程、创业历程和创新。为开发者和工程师提供实用见解和知识。',
    site: context.site ?? 'https://cor-jp.com',
    items: chinesePosts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      author: post.data.author,
      categories: [post.data.category, ...post.data.tags],
      link: `/zh/blog/${post.slug.replace(/^zh\//, '')}/`,
      guid: `https://cor-jp.com/zh/blog/${post.slug.replace(/^zh\//, '')}/`,
    })),
    customData: `
      <language>zh</language>
      <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
      <generator>Astro</generator>
      <webMaster>contact@cor-jp.com (Terisuke)</webMaster>
      <managingEditor>contact@cor-jp.com (Terisuke)</managingEditor>
      <copyright>Copyright ${new Date().getFullYear()} ${ORGANIZATION_NAMES.zh}</copyright>
      <category>技术</category>
      <category>人工智能</category>
      <category>工程</category>
      <category>创业</category>
      <ttl>60</ttl>
      <image>
        <url>https://cor-jp.com/logo.png</url>
        <title>Cor.inc 技术博客</title>
        <link>https://cor-jp.com/zh/blog</link>
        <width>400</width>
        <height>400</height>
      </image>
    `,
  });
}