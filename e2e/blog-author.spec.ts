import { expect, test } from '@playwright/test';

// ADR-0017 / Epic #330（著者は 1 か所で定義し @id で参照）: 記事の著者が frontmatter のハンドル「Terisuke」だけで、実名・肩書・写真・プロフィールへの導線が
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
    // 見出しは h2 で、ランドマーク（aside）の名前になる
    await expect(page.getByRole('complementary', { name: await box.locator('h2').innerText() })).toBeVisible();

    // 64px 表示には 128px の縮小版を使い、氏名が隣にあるので代替テキストは空
    const photo = box.locator('img');
    await expect(photo).toHaveAttribute('src', '/assets/k-terada-128.avif');
    await expect(photo).toHaveAttribute('alt', '');
    await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(128);

    const graph = await page.$$eval('script[type="application/ld+json"]', (scripts) =>
      scripts.map((script) => JSON.parse(script.textContent ?? '{}')),
    );
    const person = graph.find((node) => node['@type'] === 'Person');
    const article = graph.find((node) => node['@type'] === 'TechArticle' || node['@type'] === 'BlogPosting');
    expect(person?.name).toBe(post.name);
    expect(person?.image).toBe('https://cor-jp.com/assets/k-terada.avif');
    expect(article?.author?.['@id']).toBe(person?.['@id']);
  });
}

// 著者ボックスと Person.url のリンク先（About の #founder-story）に、代表の肩書と氏名が出ていること
for (const about of [
  { path: '/about/', byline: '代表取締役 寺田 康佑' },
  { path: '/en/about/', byline: 'Representative Director Kousuke Terada' },
]) {
  test(`shows the founder's title and name at #founder-story on ${about.path}`, async ({ page }) => {
    await page.goto(`${about.path}#founder-story`);
    const section = page.locator('#founder-story');
    await expect(section.getByTestId('founder-byline')).toHaveText(about.byline);
    await expect(section.getByTestId('founder-byline')).toBeVisible();
  });
}
