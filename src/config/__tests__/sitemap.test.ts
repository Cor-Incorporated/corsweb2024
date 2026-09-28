// @vitest-environment node
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { articleLastmod, blogPostPath, collectBlogLastmod } from '../sitemap';

describe('articleLastmod', () => {
  it.each([
    [{ pubDate: '2025-01-21' }, '2025-01-21T00:00:00.000Z'],
    [{ pubDate: '2025-01-21', updatedDate: '2025-03-02' }, '2025-03-02T00:00:00.000Z'],
    [{ pubDate: new Date('2024-12-31T00:00:00Z') }, '2024-12-31T00:00:00.000Z'],
    [{ pubDate: '2025-01-21', updatedDate: 'not a date' }, '2025-01-21T00:00:00.000Z'],
    [{ pubDate: '' }, null],
    [{}, null],
  ])('%o → %s', (dates, expected) => {
    expect(articleLastmod(dates)).toBe(expected);
  });
});

describe('blogPostPath', () => {
  it('matches the route shape of src/pages/{,<lang>/}blog/[...slug].astro', () => {
    expect(blogPostPath('ja', 'a')).toBe('/blog/a/');
    expect(blogPostPath('es', 'a')).toBe('/es/blog/a/');
  });
});

describe('collectBlogLastmod', () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'sitemap-lastmod-'));
    await mkdir(path.join(dir, 'ja'));
    await mkdir(path.join(dir, 'en'));
    await writeFile(path.join(dir, 'ja', 'post.md'), '---\ntitle: a\npubDate: 2025-01-01\nupdatedDate: 2025-02-01\n---\nbody');
    await writeFile(path.join(dir, 'ja', 'draft.md'), '---\ntitle: d\npubDate: 2025-01-01\nisDraft: true\n---\nbody');
    await writeFile(path.join(dir, 'en', 'post.md'), '---\ntitle: a\npubDate: "2025-01-05"\n---\nbody');
    await writeFile(path.join(dir, 'en', 'notes.txt'), 'ignored');
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('maps article URLs to updatedDate ?? pubDate and skips drafts and non-markdown files', () => {
    expect([...collectBlogLastmod(dir)]).toEqual([
      ['/blog/post/', '2025-02-01T00:00:00.000Z'],
      ['/en/blog/post/', '2025-01-05T00:00:00.000Z'],
    ]);
  });

  it('covers every published post in the real content collection', () => {
    const lastmod = collectBlogLastmod(path.resolve('src/content/blog'));
    expect(lastmod.size).toBeGreaterThanOrEqual(60);
    expect(lastmod.get('/blog/complete-markdown-guide/')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // 全記事が同じ時刻（= ビルド時刻）にならないこと
    expect(new Set(lastmod.values()).size).toBeGreaterThan(1);
  });
});
