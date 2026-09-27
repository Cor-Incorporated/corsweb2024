// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { main, parseCliArgs } from '../cli.mjs';
import { parseDocument } from '../frontmatter.mjs';
import {
  createMockClient,
  createOut,
  createTempRepo,
  dropFirstBlockToken,
  FIXED_NOW,
  JA_BLOG,
  JA_NEWS,
} from './helpers.mjs';

let repo;
afterEach(async () => repo?.cleanup());

const file = (rel) => path.join(repo.root, 'src/content', rel);

async function cli(args, { client = createMockClient(), env = {}, runGit } = {}) {
  const out = createOut();
  let created = 0;
  const code = await main([...args, '--root', repo.root], {
    out,
    env,
    now: FIXED_NOW,
    runGit,
    createClient: async () => {
      created += 1;
      return client;
    },
  });
  return { code, out, created, client };
}

describe('i18n CLI', () => {
  it('--check lists missing translations and exits 1; --write fills them; then --check exits 0', async () => {
    repo = await createTempRepo({ 'blog/ja/alpha.md': JA_BLOG, 'news/ja/beta.md': JA_NEWS });
    const check = await cli(['--check']);
    expect(check.code).toBe(1);
    expect(check.out.text()).toContain('[missing] 8 件');
    expect(check.out.text()).toContain('blog/alpha → en, zh, ko, es');

    const write = await cli(['--write']);
    expect(write.code).toBe(0);
    expect(existsSync(file('blog/es/alpha.md'))).toBe(true);
    expect(parseDocument(readFileSync(file('news/zh/beta.md'), 'utf8')).data.lang).toBe('zh');

    const again = await cli(['--check']);
    expect(again.code).toBe(0);
    expect(again.out.text()).toContain('✓ すべての翻訳が ja と同期しています');
  });

  it('is idempotent: a second --write makes no API call', async () => {
    repo = await createTempRepo({ 'blog/ja/alpha.md': JA_BLOG });
    await cli(['--write', '--langs', 'en']);
    const second = await cli(['--write', '--langs', 'en']);
    expect(second.code).toBe(0);
    expect(second.created).toBe(0);
    expect(second.client.calls).toHaveLength(0);
  });

  it('F2: a translation that drops a code fence is not written and the run exits 1', async () => {
    repo = await createTempRepo({ 'blog/ja/alpha.md': JA_BLOG });
    const result = await cli(['--write', '--langs', 'en'], {
      client: createMockClient({ mutateBody: dropFirstBlockToken }),
    });
    expect(result.code).toBe(1);
    expect(result.out.text()).toMatch(
      /✗ translate blog\/alpha \[en\]: 本文 の翻訳が検証に通りませんでした/
    );
    expect(existsSync(file('blog/en/alpha.md'))).toBe(false);
  });

  it('re-translates when ja changes (stale) and re-syncs copied fields without the API (meta-drift)', async () => {
    repo = await createTempRepo({ 'blog/ja/alpha.md': JA_BLOG });
    await cli(['--write', '--langs', 'en']);

    await writeFile(file('blog/ja/alpha.md'), JA_BLOG.replace('featured: true', 'featured: false'));
    expect((await cli(['--check'])).out.text()).toContain('[meta-drift] 1 件');
    const resync = await cli(['--write', '--langs', 'en']);
    expect(resync.code).toBe(0);
    expect(resync.created).toBe(0);
    expect(parseDocument(readFileSync(file('blog/en/alpha.md'), 'utf8')).data.featured).toBe(false);

    await writeFile(
      file('blog/ja/alpha.md'),
      JA_BLOG.replace('## はじめに', '## はじめに（改訂）')
    );
    expect((await cli(['--check'])).out.text()).toContain('[stale] 1 件');
    const retranslate = await cli(['--write', '--langs', 'en']);
    expect(retranslate.code).toBe(0);
    expect(retranslate.client.calls.length).toBeGreaterThan(0);
  });

  it('deletes a translation whose ja was deleted (orphan), but never when the ja folder is empty', async () => {
    repo = await createTempRepo({ 'blog/ja/alpha.md': JA_BLOG, 'blog/ja/keep.md': JA_BLOG });
    await cli(['--write', '--langs', 'en']);
    await rm(file('blog/ja/alpha.md'));
    const prune = await cli(['--write', '--langs', 'en']);
    expect(prune.code).toBe(0);
    expect(existsSync(file('blog/en/alpha.md'))).toBe(false);
    expect(existsSync(file('blog/en/keep.md'))).toBe(true);

    await rm(file('blog/ja/keep.md'));
    const guarded = await cli(['--write', '--langs', 'en']);
    expect(guarded.code).toBe(1);
    expect(guarded.out.text()).toContain('安全装置');
    expect(existsSync(file('blog/en/keep.md'))).toBe(true);
  });

  it('leaves legacy (untracked) translations alone unless adopted or explicitly re-translated', async () => {
    const legacy = JA_BLOG.replace('lang: "ja"', 'lang: "en"').replace(
      'テスト記事：翻訳パイプライン',
      'Legacy title'
    );
    repo = await createTempRepo({ 'blog/ja/alpha.md': JA_BLOG, 'blog/en/alpha.md': legacy });
    const skipped = await cli(['--write', '--langs', 'en']);
    expect(skipped.code).toBe(1);
    expect(readFileSync(file('blog/en/alpha.md'), 'utf8')).toBe(legacy);

    const adopt = await cli(['--adopt', '--langs', 'en']);
    expect(adopt.code).toBe(0);
    const adopted = parseDocument(readFileSync(file('blog/en/alpha.md'), 'utf8')).data;
    expect(adopted).toMatchObject({
      title: 'Legacy title',
      translationModel: 'adopted-legacy',
      lang: 'en',
    });
    expect((await cli(['--check', '--langs', 'en'])).code).toBe(0);
  });

  it('--retranslate-untracked overwrites legacy translations', async () => {
    const legacy = JA_BLOG.replace('lang: "ja"', 'lang: "en"');
    repo = await createTempRepo({ 'blog/ja/alpha.md': JA_BLOG, 'blog/en/alpha.md': legacy });
    const result = await cli(['--write', '--langs', 'en', '--retranslate-untracked']);
    expect(result.code).toBe(0);
    expect(
      parseDocument(readFileSync(file('blog/en/alpha.md'), 'utf8')).data.translationModel
    ).toBe('mock-model');
  });

  it('--dry-run shows the plan without creating a client or writing files', async () => {
    repo = await createTempRepo({ 'blog/ja/alpha.md': JA_BLOG });
    const result = await cli(['--write', '--dry-run']);
    expect(result.code).toBe(0);
    expect(result.created).toBe(0);
    expect(result.out.text()).toContain('(dry-run) translate blog/alpha [en]（missing）');
    expect(existsSync(file('blog/en/alpha.md'))).toBe(false);
  });

  it('fails before touching files when GEMINI_API_KEY is missing', async () => {
    repo = await createTempRepo({ 'blog/ja/alpha.md': JA_BLOG });
    const out = createOut();
    const code = await main(['--write', '--root', repo.root], { out, env: {} });
    expect(code).toBe(2);
    expect(out.text()).toContain('GEMINI_API_KEY が未設定です');
    expect(existsSync(file('blog/en/alpha.md'))).toBe(false);
  });

  it('--since limits the run to articles changed in the diff', async () => {
    repo = await createTempRepo({ 'blog/ja/alpha.md': JA_BLOG, 'blog/ja/other.md': JA_BLOG });
    const runGit = () => 'M\0src/content/blog/ja/alpha.md\0';
    const result = await cli(['--check', '--since', 'origin/develop'], { runGit });
    expect(result.code).toBe(1);
    expect(result.out.text()).toContain('blog/alpha → en, zh, ko, es');
    expect(result.out.text()).not.toContain('blog/other');
  });

  it('treats an --only entry that matches no article as a usage error (exit 2), not "nothing to do"', async () => {
    repo = await createTempRepo({ 'blog/ja/alpha.md': JA_BLOG });
    const typo = await cli(['--check', '--only', 'blog/alpah']);
    expect(typo.code).toBe(2);
    expect(typo.out.text()).toContain('--only に該当する記事がありません: blog/alpah');
    const wrongCollection = await cli(['--check', '--only', 'news/alpha']);
    expect(wrongCollection.code).toBe(2);
    expect((await cli(['--check', '--only', 'alpha'])).code).toBe(1);
  });
});

describe('argument validation', () => {
  it.each([
    [['--check', '--write'], /1 つだけ/],
    [['--collections', 'blog,wiki'], /--collections/],
    [['--langs', 'fr'], /--langs/],
    [['--only', 'a b'], /--only/],
    [['--only', 'x', '--since', 'HEAD~1'], /同時に指定できません|git の ref/],
    [['--since', '--foo'], /./],
    [['--since', 'a..b'], /git の ref/],
    [['--dry-run'], /--dry-run/],
    [['--retranslate-untracked'], /--write/],
    [['--prune-untracked'], /--write/],
    [['--adopt', '--prune-untracked'], /--write/],
    [['--unknown'], /Unknown option/],
  ])('rejects %j', (argv, pattern) => {
    expect(() => parseCliArgs(argv)).toThrow(pattern);
  });

  it('treats empty CI inputs as "all"', () => {
    expect(
      parseCliArgs(['--write', '--collections', '', '--langs', ' ', '--only', ''])
    ).toMatchObject({
      collections: null,
      langs: null,
      only: null,
    });
  });
});
