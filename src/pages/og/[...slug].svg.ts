import { getCollection } from 'astro:content';
import { ogFontScriptForSlug } from '../../utils/og-fonts';
import { buildBlogOgSvg } from '../../utils/og-svg';

interface Props {
  params: { slug: string };
}

export async function GET({ params }: Props) {
  const { slug } = params;

  // Get the blog post
  const posts = await getCollection('blog');
  const post = posts.find((p) => p.slug === slug);

  if (!post) {
    return new Response('Post not found', { status: 404 });
  }

  const { title, description, category, author } = post.data;
  const svg = buildBlogOgSvg({
    title,
    description,
    category,
    author,
    script: ogFontScriptForSlug(slug),
  });

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

export async function getStaticPaths() {
  const posts = await getCollection('blog', ({ data }) => !data.isDraft);

  return posts.map((post) => ({
    params: { slug: post.slug },
  }));
}
