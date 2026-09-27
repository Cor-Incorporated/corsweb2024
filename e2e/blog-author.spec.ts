import { expect, test } from '@playwright/test';

// H3: 記事の著者が frontmatter のハンドル「Terisuke」だけで、実名・肩書・写真・プロフィールへの導線が
// 無かった。全ロケールの記事に著者ボックスを出し、JSON-LD の Person と同じ人物を指すことを確かめる。
const POSTS = [
  { path: '/blog/complete-markdown-guide/', name: '寺田 康佑', profile: '/about/#founder-story' },
  { path: '/en/blog/complete-markdown-guide/', name: 'Kousuke Terada', profile: '/en/about/#founder-story' },
  { path: '/zh/blog/complete-markdown-guide/', name: '寺田 康佑', profile: '/zh/about/#founder-story' },
  { path: '/ko/blog/complete-markdown-guide/', name: '데라다 코스케', profile: '/ko/about/#founder-story' },
  { path: '/es/blog/complete-markdown-guide/', name: 'Kousuke Terada', profile: '/es/about/#founder-story' },
];

for (const post of POSTS) {
  test(`shows the author box and a matching Person JSON-LD on ${post.path}`, async ({ page }) => {
    await page.goto(post.path);
    const box = page.getByTestId('author-box');
    await box.scrollIntoViewIfNeeded();
    await expect(box).toBeVisible();
    await expect(box).toContainText(post.name);
    await expect(box.locator(`a[href="${post.profile}"]`)).toBeVisible();

    const photo = box.locator('img');
    await expect(photo).toHaveAttribute('src', '/assets/k-terada.avif');
    await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

    const graph = await page.$$eval('script[type="application/ld+json"]', (scripts) =>
      scripts.map((script) => JSON.parse(script.textContent ?? '{}')),
    );
    const person = graph.find((node) => node['@type'] === 'Person');
    const article = graph.find((node) => node['@type'] === 'TechArticle' || node['@type'] === 'BlogPosting');
    expect(person?.name).toBe(post.name);
    expect(article?.author?.['@id']).toBe(person?.['@id']);
  });
}
