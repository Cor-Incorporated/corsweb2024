import rss from '@astrojs/rss';
import type { APIContext, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { getNewsCategoryLabel } from '../../config/news-categories';
import { localizeEntries, NON_JA_LOCALES, toCleanSlug } from '../../utils/content-i18n';
import { ORGANIZATION_NAMES } from '../../config/organization';
import { getTranslations, type Locale } from '../../utils/i18n';

// 非ja のニュース一覧から RSS を案内する以上、中身も同じ言語で配信する必要がある。
// ja は /news.xml が担当し、ここは /<lang>/news.xml を生成する（blog の rss.xml と同じ構成）。
export const getStaticPaths: GetStaticPaths = () =>
  NON_JA_LOCALES.map((lang) => ({ params: { lang } }));

// 社名のロケール別表記は config/organization.ts の ORGANIZATION_NAMES が正本（#306 で確定。JSON-LD・
// ブログの <title> と共有）。zh が ja と同じ「Cor.株式会社」なのは翻訳漏れではなく、登記上の商号を
// そのまま用いる判断（中国語圏でも日本法人の商号表記が通用するため）。
const BRAND = ORGANIZATION_NAMES;

// customData は rss() のエスケープを通らない生の XML。i18n 由来の値をそのまま埋めると
// 将来 `&` や `<` が入った時点でフィードが壊れるため、注入する値は必ずここを通す。
const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export async function GET(context: APIContext) {
  const lang = context.params.lang as Locale;
  const t = getTranslations(lang);

  // 一覧・記事ページと同じ localizeEntries を通す。ここだけ data.lang === lang で厳格に絞ると、
  // ja 記事が先行追加されたとき「一覧には出るのに RSS には来ない」状態になり購読者が取りこぼす。
  const news = await getCollection('news', ({ data }) => !data.isDraft);
  const sortedNews = localizeEntries(news, lang).sort(
    (a, b) => new Date(b.data.publishedAt).getTime() - new Date(a.data.publishedAt).getTime(),
  );

  const feedTitle = `${BRAND[lang]} ${t.news.title}`;

  return rss({
    title: feedTitle,
    description: t.meta.news.description,
    site: context.site ?? 'https://cor-jp.com',
    items: sortedNews.map((entry) => {
      const slug = toCleanSlug(entry.slug);
      const path = `/${lang}/news/${slug}/`;
      return {
        title: entry.data.title,
        description: entry.data.description,
        pubDate: entry.data.publishedAt,
        author: entry.data.author,
        categories: [getNewsCategoryLabel(entry.data.category, lang), ...entry.data.tags],
        link: entry.data.externalUrl || path,
        guid: entry.data.externalUrl || `https://cor-jp.com${path}`,
      };
    }),
    customData: `
      <language>${lang}</language>
      <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
      <generator>Astro</generator>
      <webMaster>contact@cor-jp.com (${escapeXml(BRAND[lang])})</webMaster>
      <managingEditor>contact@cor-jp.com (${escapeXml(BRAND[lang])})</managingEditor>
      <copyright>Copyright ${new Date().getFullYear()} ${escapeXml(BRAND[lang])}</copyright>
      <category>News</category>
      <ttl>60</ttl>
      <image>
        <url>https://cor-jp.com/logo.png</url>
        <title>${escapeXml(feedTitle)}</title>
        <link>https://cor-jp.com/${lang}/news</link>
        <width>400</width>
        <height>400</height>
      </image>
    `,
  });
}
