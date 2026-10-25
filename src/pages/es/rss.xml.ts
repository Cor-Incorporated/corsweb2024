import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { ORGANIZATION_NAMES } from '../../config/organization';

export async function GET(context: APIContext) {
  // Get Spanish blog posts from Content Collections
  const allPosts = await getCollection('blog', ({ data }) => {
    return data.lang === 'es' && !data.isDraft;
  });

  // Sort by date
  const spanishPosts = allPosts.sort(
    (a, b) => new Date(b.data.pubDate).getTime() - new Date(a.data.pubDate).getTime()
  );

  return rss({
    title: 'Blog Técnico de Cor.inc',
    description: 'Último blog técnico sobre IA/Machine Learning, ingeniería de software, viaje emprendedor e innovación. Conocimientos prácticos para desarrolladores e ingenieros.',
    site: context.site ?? 'https://cor-jp.com',
    items: spanishPosts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      author: post.data.author,
      categories: [post.data.category, ...post.data.tags],
      link: `/es/blog/${post.slug.replace(/^es\//, '')}/`,
      guid: `https://cor-jp.com/es/blog/${post.slug.replace(/^es\//, '')}/`,
    })),
    customData: `
      <language>es</language>
      <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
      <generator>Astro</generator>
      <webMaster>contact@cor-jp.com (Terisuke)</webMaster>
      <managingEditor>contact@cor-jp.com (Terisuke)</managingEditor>
      <copyright>Copyright ${new Date().getFullYear()} ${ORGANIZATION_NAMES.es}</copyright>
      <category>Tecnología</category>
      <category>IA</category>
      <category>Ingeniería</category>
      <category>Startup</category>
      <ttl>60</ttl>
      <image>
        <url>https://cor-jp.com/logo.png</url>
        <title>Blog Técnico de Cor.inc</title>
        <link>https://cor-jp.com/es/blog</link>
        <width>400</width>
        <height>400</height>
      </image>
    `,
  });
}