import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { ORGANIZATION_NAMES } from '../../config/organization';

export async function GET(context: APIContext) {
  // Get Korean blog posts from Content Collections
  const allPosts = await getCollection('blog', ({ data }) => {
    return data.lang === 'ko' && !data.isDraft;
  });

  // Sort by date
  const koreanPosts = allPosts.sort(
    (a, b) => new Date(b.data.pubDate).getTime() - new Date(a.data.pubDate).getTime()
  );

  return rss({
    title: 'Cor.inc 기술 블로그',
    description: 'AI/머신러닝, 소프트웨어 엔지니어링, 창업 여정 및 혁신을 다루는 최신 기술 블로그. 개발자와 엔지니어를 위한 실용적인 통찰과 지식.',
    site: context.site ?? 'https://cor-jp.com',
    items: koreanPosts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      author: post.data.author,
      categories: [post.data.category, ...post.data.tags],
      link: `/ko/blog/${post.slug.replace(/^ko\//, '')}/`,
      guid: `https://cor-jp.com/ko/blog/${post.slug.replace(/^ko\//, '')}/`,
    })),
    customData: `
      <language>ko</language>
      <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
      <generator>Astro</generator>
      <webMaster>contact@cor-jp.com (Terisuke)</webMaster>
      <managingEditor>contact@cor-jp.com (Terisuke)</managingEditor>
      <copyright>Copyright ${new Date().getFullYear()} ${ORGANIZATION_NAMES.ko}</copyright>
      <category>기술</category>
      <category>AI</category>
      <category>엔지니어링</category>
      <category>창업</category>
      <ttl>60</ttl>
      <image>
        <url>https://cor-jp.com/logo.png</url>
        <title>Cor.inc 기술 블로그</title>
        <link>https://cor-jp.com/ko/blog</link>
        <width>400</width>
        <height>400</height>
      </image>
    `,
  });
}