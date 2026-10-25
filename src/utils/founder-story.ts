// 代表の物語（ブログの founder の記事）への入口。About の代表の欄と、トップの「代表ストーリーを読む」が使う。
// 物語の全文は記事に置き、About にはプロフィールと冒頭だけを置く（docs/story-spine.md、代表の決定 2026-10-25）。
// 記事の翻訳は CI が作るので、その言語の記事がまだ無いときは ja の記事へつなぐ（リンク切れにしない）。
import { getCollection } from 'astro:content';
import { getLocalizedUrl, type Locale } from './i18n';

export const FOUNDER_STORY_SLUG = 'founder-story';

export type FounderStoryLink = {
  /** リンク先（その言語の記事、無ければ ja の記事） */
  href: string;
  /** 記事の題名（リンク先と同じ言語） */
  title: string;
  /** リンク先の記事の言語 */
  locale: Locale;
};

export async function getFounderStoryLink(locale: Locale): Promise<FounderStoryLink> {
  const posts = await getCollection(
    'blog',
    ({ slug, data }) => !data.isDraft && (slug === `${locale}/${FOUNDER_STORY_SLUG}` || slug === `ja/${FOUNDER_STORY_SLUG}`),
  );
  const post = posts.find((entry) => entry.slug === `${locale}/${FOUNDER_STORY_SLUG}`) ?? posts.find((entry) => entry.slug === `ja/${FOUNDER_STORY_SLUG}`);
  if (!post) throw new Error(`founder story post is missing: src/content/blog/ja/${FOUNDER_STORY_SLUG}.md`);
  const target = post.slug.split('/')[0] as Locale;
  return { href: getLocalizedUrl(`/blog/${FOUNDER_STORY_SLUG}/`, target), title: post.data.title, locale: target };
}
