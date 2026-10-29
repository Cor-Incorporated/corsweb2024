// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  draftAdditionOnlySince,
  frontmatterIsDraftTrue,
  isDraftAdditionOnly,
  parseNameStatusZ,
} from '../draft-only-diff.mjs';
import { createTempRepo, git, initGitRepo, JA_BLOG } from './helpers.mjs';

const DRAFT = JA_BLOG.replace('lang: "ja"\n', 'lang: "ja"\nisDraft: true\n');

let repo;
afterEach(async () => repo?.cleanup());

describe('frontmatterIsDraftTrue', () => {
  it('frontmatter の isDraft: true だけを認める', () => {
    expect(frontmatterIsDraftTrue(DRAFT)).toBe(true);
    expect(frontmatterIsDraftTrue(JA_BLOG)).toBe(false);
    expect(frontmatterIsDraftTrue('---\nisDraft: false\n---\n')).toBe(false);
    expect(frontmatterIsDraftTrue('---\ntitle: "x"\n---\n\nisDraft: true\n')).toBe(false);
  });
});

describe('isDraftAdditionOnly', () => {
  const read = (file) => {
    if (file.endsWith('draft.md')) return DRAFT;
    if (file.endsWith('live.md')) return JA_BLOG;
    throw new Error(`missing ${file}`);
  };

  it('追加された ja 下書きだけなら true', () => {
    expect(
      isDraftAdditionOnly(
        [{ status: 'A', path: 'src/content/blog/ja/draft.md' }],
        read
      )
    ).toBe(true);
  });

  it('空・変更・公開記事・翻訳ファイルは false', () => {
    expect(isDraftAdditionOnly([], read)).toBe(false);
    expect(
      isDraftAdditionOnly([{ status: 'M', path: 'src/content/blog/ja/draft.md' }], read)
    ).toBe(false);
    expect(
      isDraftAdditionOnly([{ status: 'A', path: 'src/content/blog/ja/live.md' }], read)
    ).toBe(false);
    expect(
      isDraftAdditionOnly(
        [
          { status: 'A', path: 'src/content/blog/ja/draft.md' },
          { status: 'M', path: 'src/content/blog/ja/live.md' },
        ],
        read
      )
    ).toBe(false);
    expect(
      isDraftAdditionOnly([{ status: 'A', path: 'src/content/blog/en/draft.md' }], read)
    ).toBe(false);
  });

  it('parseNameStatusZ は追加を 1 件にする', () => {
    expect(parseNameStatusZ('A\0src/content/blog/ja/draft.md\0')).toEqual([
      { status: 'A', path: 'src/content/blog/ja/draft.md' },
    ]);
  });
});

describe('draftAdditionOnlySince', () => {
  it('git の差分が下書きの追加だけのとき true', async () => {
    repo = await createTempRepo({ 'blog/ja/keep.md': JA_BLOG });
    const base = initGitRepo(repo.root);
    await writeFile(path.join(repo.root, 'src/content/blog/ja/draft.md'), DRAFT);
    git(repo.root, 'add', '--', 'src');
    git(repo.root, 'commit', '-q', '-m', 'add draft');
    expect(draftAdditionOnlySince(base, { cwd: repo.root })).toBe(true);
  });

  it('CLI は下書きの追加だけなら 0、公開記事の追加なら 1', async () => {
    repo = await createTempRepo({ 'blog/ja/keep.md': JA_BLOG });
    const base = initGitRepo(repo.root);
    await writeFile(path.join(repo.root, 'src/content/blog/ja/draft.md'), DRAFT);
    git(repo.root, 'add', '--', 'src');
    git(repo.root, 'commit', '-q', '-m', 'add draft');
    const script = path.resolve('scripts/i18n/draft-only-diff.mjs');
    const ok = spawnSync(process.execPath, [script, '--since', base], {
      cwd: repo.root,
      encoding: 'utf8',
    });
    expect(ok.status, ok.stderr).toBe(0);

    await writeFile(path.join(repo.root, 'src/content/blog/ja/live.md'), JA_BLOG);
    git(repo.root, 'add', '--', 'src');
    git(repo.root, 'commit', '-q', '-m', 'add live');
    const no = spawnSync(process.execPath, [script, '--since', base], {
      cwd: repo.root,
      encoding: 'utf8',
    });
    expect(no.status).toBe(1);
  });
});

describe('translate-content.yml が下書き追加で Gemini の前に止まる', () => {
  it('Detect content changes が draft-only-diff.mjs を呼ぶ', () => {
    const yml = readFileSync('.github/workflows/translate-content.yml', 'utf8');
    expect(yml).toContain('node scripts/i18n/draft-only-diff.mjs --since "$BASE_SHA"');
    expect(yml).toContain('Gemini 翻訳をスキップしました');
  });
});
