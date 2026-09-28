/** ブログ記事の公開 URL パス（src/pages/{,<lang>/}blog/[...slug].astro と同じ規則）。 */
export function blogPostPath(lang: string, slug: string): string {
  return lang === 'ja' ? `/blog/${slug}/` : `/${lang}/blog/${slug}/`;
}
