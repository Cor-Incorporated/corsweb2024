/**
 * CMS（Sveltia CMS, ADR-0018）の設定 cms/public/config.yml と、サイト側の定義を結ぶリンクテスト。
 *
 * 同じ事実が 2 箇所にある:
 *   - カテゴリの選択肢      config.yml ↔ src/config/categories.ts（と blog-schema.ts の enum）
 *   - 必須・任意の項目      config.yml ↔ src/config/blog-schema.ts（Zod）
 *   - 書き込み先・ブランチ  config.yml ↔ ADR-0018（ja のフォルダだけ・develop・PR 経由）
 * 片方だけ変えると、両側の値を並べたメッセージで落ちる。後半の「F3 変異」で、
 * 片側だけを変えた入力に対して検査が実際に赤くなることを毎回確かめている。
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { z } from 'astro/zod';
import { describe, expect, it } from 'vitest';
import { blogFrontmatterSchema } from '../blog-schema';
import { BLOG_CATEGORIES } from '../categories';

type CmsOption = string | { label: string; value: string };
type CmsField = {
  name: string;
  widget?: string;
  required?: boolean | string[];
  default?: unknown;
  options?: CmsOption[];
  fields?: CmsField[];
};
type CmsCollection = {
  name: string;
  folder?: string;
  path?: string;
  i18n?: unknown;
  fields: CmsField[];
};
type CmsConfig = {
  backend: {
    name?: string;
    repo?: string;
    branch?: string;
    squash_merges?: boolean;
    open_authoring?: boolean;
  };
  publish_mode?: string;
  i18n?: unknown;
  output?: { omit_empty_optional_fields?: boolean };
  collections: CmsCollection[];
};
type Schema = z.AnyZodObject;
type Category = { id: string; label: { ja: string } };

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, 'cms/public/config.yml');
const BLOG_JA_DIR = path.join(ROOT, 'src/content/blog/ja');
const JA_FOLDER = /^src\/content\/(?:blog|news|cases)\/ja$/;

const loadConfig = (): CmsConfig => yaml.load(readFileSync(CONFIG_PATH, 'utf8')) as CmsConfig;
const list = (values: Iterable<unknown>): string =>
  `[${[...values].map(String).sort().join(', ')}]`;
const blogFields = (config: CmsConfig): CmsField[] =>
  config.collections.find((collection) => collection.name === 'blog')?.fields ?? [];

// Zod 側: default も optional も無いキーが「必須」。
const zodRequirement = (schema: z.ZodTypeAny): 'required' | 'optional' | 'defaulted' => {
  if (schema._def.typeName === z.ZodFirstPartyTypeKind.ZodDefault) return 'defaulted';
  return schema.isOptional() ? 'optional' : 'required';
};

// CMS 側: Sveltia のフィールドは required を書かなければ必須（既定 true）。
const cmsRequirement = (
  field: CmsField
): 'required' | 'required-with-default' | 'optional' | 'hidden' => {
  if (field.widget === 'hidden') return 'hidden';
  if (field.required === false) return 'optional';
  return field.default === undefined ? 'required' : 'required-with-default';
};

/** (a) カテゴリの選択肢 ↔ categories.ts ↔ Zod の enum */
function checkCategories(config: CmsConfig, categories: Category[], schema: Schema): string[] {
  const field = blogFields(config).find((f) => f.name === 'category');
  const options = (field?.options ?? []).map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o
  );
  const cmsValues = list(options.map((o) => o.value));
  const definedValues = list(categories.map((c) => c.id));
  const enumValues = list((schema.shape.category as z.ZodEnum<[string, ...string[]]>).options);
  const violations: string[] = [];
  if (cmsValues !== definedValues) {
    violations.push(
      `カテゴリの値が違う: config.yml ${cmsValues} / src/config/categories.ts ${definedValues}`
    );
  }
  if (cmsValues !== enumValues) {
    violations.push(
      `カテゴリの値が違う: config.yml ${cmsValues} / blog-schema.ts の enum ${enumValues}`
    );
  }
  const cmsLabels = list(options.map((o) => `${o.value}=${o.label}`));
  const definedLabels = list(categories.map((c) => `${c.id}=${c.label.ja}`));
  if (cmsLabels !== definedLabels) {
    violations.push(
      `カテゴリの表示名が違う: config.yml ${cmsLabels} / categories.ts（ja）${definedLabels}`
    );
  }
  return violations;
}

/** (b) 必須・任意 ↔ Zod スキーマ */
function checkRequirements(config: CmsConfig, schema: Schema): string[] {
  const fields = blogFields(config).filter((f) => f.name !== 'body');
  const byName = new Map(fields.map((f) => [f.name, f]));
  const zodKeys = Object.keys(schema.shape);
  const zodRequired = zodKeys.filter((k) => zodRequirement(schema.shape[k]) === 'required');
  const cmsRequired = fields
    .filter((f) => cmsRequirement(f).startsWith('required'))
    .map((f) => f.name);
  const context = `Zod の必須項目 ${list(zodRequired)} / config.yml の必須フィールド ${list(
    cmsRequired
  )}`;
  const violations: string[] = [];
  for (const key of zodRequired) {
    const field = byName.get(key);
    const actual = field ? cmsRequirement(field) : '（フィールドなし）';
    if (!actual.startsWith('required'))
      violations.push(`${key} は Zod で必須だが config.yml では ${actual}。${context}`);
  }
  for (const field of fields) {
    if (!zodKeys.includes(field.name)) {
      violations.push(
        `${field.name} は Zod スキーマに無い（保存しても捨てられる）。Zod のキー ${list(zodKeys)}`
      );
    } else if (
      cmsRequirement(field) === 'required' &&
      zodRequirement(schema.shape[field.name]) !== 'required'
    ) {
      violations.push(`${field.name} は config.yml で必須だが Zod では任意。${context}`);
    }
  }
  for (const key of zodKeys.filter(
    (k) => zodRequirement(schema.shape[k]) === 'optional' && byName.has(k)
  )) {
    const actual = cmsRequirement(byName.get(key) as CmsField);
    if (actual !== 'optional')
      violations.push(
        `${key} は Zod で optional なので config.yml も required: false にする（現在 ${actual}）`
      );
  }
  if (config.output?.omit_empty_optional_fields !== true) {
    violations.push(
      `output.omit_empty_optional_fields が true でない（${config.output?.omit_empty_optional_fields}）。空の任意項目が '' や null で書かれ Zod で落ちる`
    );
  }
  return violations;
}

/** (c) CMS が書くのは ja のフォルダだけ（en / zh / ko / es は翻訳 CI の専有） */
function checkJaOnly(config: CmsConfig): string[] {
  const folders = config.collections.map((c) => c.folder ?? '（folder なし）');
  const violations: string[] = [];
  for (const collection of config.collections) {
    const folder = collection.folder ?? '';
    if (!JA_FOLDER.test(folder))
      violations.push(
        `${
          collection.name
        } の folder が ja ではない: ${folder}（許可: ${JA_FOLDER}）。全 folder ${list(folders)}`
      );
    if (collection.path !== undefined && collection.path !== '{{slug}}')
      violations.push(
        `${collection.name} の path は既定の {{slug}} だけ（他のフォルダを指しうる）: ${collection.path}`
      );
    if (collection.i18n)
      violations.push(
        `${collection.name} に i18n がある（他言語ファイルを CMS が書く）: ${JSON.stringify(
          collection.i18n
        )}`
      );
  }
  if (config.i18n)
    violations.push(
      `全体の i18n がある（他言語ファイルを CMS が書く）: ${JSON.stringify(config.i18n)}`
    );
  return violations;
}

/** (d) 編集は develop への PR 経由（ADR-0018 決定 2） */
function checkBranch(config: CmsConfig): string[] {
  const { backend, publish_mode: publishMode } = config;
  const expected: Array<[string, unknown, unknown]> = [
    ['backend.branch', 'develop', backend.branch],
    ['backend.repo', 'Cor-Incorporated/corsweb2024', backend.repo],
    ['publish_mode', 'editorial_workflow', publishMode],
    ['backend.squash_merges', false, backend.squash_merges ?? false],
    ['backend.open_authoring', false, backend.open_authoring ?? false],
  ];
  return expected
    .filter(([, want, actual]) => want !== actual)
    .map(
      ([key, want, actual]) =>
        `${key} が違う: ADR-0018 ${String(want)} / config.yml ${String(actual)}`
    );
}

/** (e) 既存の ja 記事の frontmatter キーはすべて config.yml に定義がある（保存で落ちない） */
function checkExistingKeys(config: CmsConfig, keysByFile: Map<string, string[]>): string[] {
  const defined = new Set(blogFields(config).map((f) => f.name));
  return [...keysByFile].flatMap(([file, keys]) =>
    keys
      .filter((k) => !defined.has(k))
      .map((k) => `${file} の ${k} が config.yml に無い。定義済み ${list(defined)}`)
  );
}

const readFrontmatterKeys = (dir: string): Map<string, string[]> => {
  const entries = readdirSync(dir).filter((name) => name.endsWith('.md'));
  return new Map(
    entries.map((name) => {
      const head =
        readFileSync(path.join(dir, name), 'utf8').match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
      return [name, Object.keys((yaml.load(head) as Record<string, unknown>) ?? {})];
    })
  );
};

describe('CMS 設定（cms/public/config.yml）とサイト定義の照合', () => {
  const config = loadConfig();

  it('(a) カテゴリの選択肢がカテゴリ定義・Zod の enum と一致する', () => {
    expect(checkCategories(config, BLOG_CATEGORIES, blogFrontmatterSchema)).toEqual([]);
  });

  it('(b) 必須・任意の区別が Zod スキーマと一致する', () => {
    expect(checkRequirements(config, blogFrontmatterSchema)).toEqual([]);
  });

  it('(c) 書き込み先は ja のフォルダだけ', () => {
    expect(checkJaOnly(config)).toEqual([]);
    expect(config.collections.map((c) => c.folder)).toEqual(['src/content/blog/ja']);
  });

  it('(d) develop への PR（editorial workflow・merge commit）で編集する', () => {
    expect(checkBranch(config)).toEqual([]);
  });

  it('(e) 既存の ja 記事の frontmatter キーはすべて config.yml に定義がある', () => {
    const keysByFile = readFrontmatterKeys(BLOG_JA_DIR);
    expect(keysByFile.size).toBeGreaterThan(0);
    expect(checkExistingKeys(config, keysByFile)).toEqual([]);
  });
});

describe('F3 変異: 片側だけ変えると両側の値を出して落ちる', () => {
  const mutate = (change: (config: CmsConfig) => void): CmsConfig => {
    const config = structuredClone(loadConfig());
    change(config);
    return config;
  };
  const categoryField = (config: CmsConfig) =>
    blogFields(config).find((f) => f.name === 'category') as CmsField;
  const field = (config: CmsConfig, name: string) =>
    blogFields(config).find((f) => f.name === name) as CmsField;

  it('config.yml からカテゴリを 1 つ消す', () => {
    const config = mutate((c) => {
      categoryField(c).options = categoryField(c).options?.filter(
        (o) => typeof o === 'string' || o.value !== 'lab'
      );
    });
    const message = checkCategories(config, BLOG_CATEGORIES, blogFrontmatterSchema).join('\n');
    expect(message).toContain('config.yml [ai, engineering, founder]');
    expect(message).toContain('src/config/categories.ts [ai, engineering, founder, lab]');
  });

  it('categories.ts にだけカテゴリを足す', () => {
    const categories = [...BLOG_CATEGORIES, { id: 'news', label: { ja: 'ニュース', en: 'News' } }];
    const message = checkCategories(loadConfig(), categories, blogFrontmatterSchema).join('\n');
    expect(message).toContain('config.yml [ai, engineering, founder, lab]');
    expect(message).toContain('src/config/categories.ts [ai, engineering, founder, lab, news]');
  });

  it('config.yml で必須項目を任意にする', () => {
    const config = mutate((c) => {
      field(c, 'description').required = false;
    });
    const message = checkRequirements(config, blogFrontmatterSchema).join('\n');
    expect(message).toContain('description は Zod で必須だが config.yml では optional');
    expect(message).toContain('Zod の必須項目 [category, description, pubDate, title]');
    expect(message).toContain(
      'config.yml の必須フィールド [author, category, featured, pubDate, title]'
    );
  });

  it('Zod にだけ必須項目を足す', () => {
    const schema = blogFrontmatterSchema.extend({ summary: z.string() });
    const message = checkRequirements(loadConfig(), schema).join('\n');
    expect(message).toContain('summary は Zod で必須だが config.yml では （フィールドなし）');
    expect(message).toContain('Zod の必須項目 [category, description, pubDate, summary, title]');
  });

  it('Zod でだけ必須項目を任意にする', () => {
    const schema = blogFrontmatterSchema.extend({ description: z.string().optional() });
    const message = checkRequirements(loadConfig(), schema).join('\n');
    expect(message).toContain('description は config.yml で必須だが Zod では任意');
    expect(message).toContain('Zod の必須項目 [category, pubDate, title]');
  });

  it('空の任意項目を書き出す設定にする', () => {
    const config = mutate((c) => {
      c.output = { omit_empty_optional_fields: false };
    });
    expect(checkRequirements(config, blogFrontmatterSchema).join('\n')).toContain(
      'omit_empty_optional_fields が true でない（false）'
    );
  });

  it('書き込み先に en のフォルダを足す', () => {
    const config = mutate((c) => {
      c.collections.push({ name: 'blog-en', folder: 'src/content/blog/en', fields: [] });
    });
    const message = checkJaOnly(config).join('\n');
    expect(message).toContain('blog-en の folder が ja ではない: src/content/blog/en');
    expect(message).toContain('全 folder [src/content/blog/en, src/content/blog/ja]');
  });

  it('ブランチを main にする', () => {
    const config = mutate((c) => {
      c.backend.branch = 'main';
    });
    expect(checkBranch(config)).toEqual([
      'backend.branch が違う: ADR-0018 develop / config.yml main',
    ]);
  });

  it('既存記事にだけ未定義のキーがある', () => {
    const keysByFile = new Map([['example.md', ['title', 'ogImage']]]);
    const message = checkExistingKeys(loadConfig(), keysByFile).join('\n');
    expect(message).toContain('example.md の ogImage が config.yml に無い');
    expect(message).toContain('title');
  });
});
