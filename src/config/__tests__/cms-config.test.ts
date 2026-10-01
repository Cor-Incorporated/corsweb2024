/**
 * CMS（Sveltia CMS, ADR-0018・#329）の設定 cms/public/config.yml と、サイト側の定義を結ぶリンクテスト。
 *
 * 同じ事実が 2 箇所にある:
 *   - カテゴリの選択肢      config.yml ↔ src/config/categories.ts（と blog-schema.ts の enum）
 *   - 必須・任意の項目      config.yml ↔ src/config/blog-schema.ts（Zod）
 *   - 書き込み先・ブランチ  config.yml ↔ ADR-0018（ja のフォルダだけ・develop・PR 経由）
 *   - トークンを渡す先      wrangler.toml [vars] ALLOWED_DOMAINS ↔ cms/firebase.json hosting.site
 *   - 認証 Worker の URL    config.yml backend.base_url ↔ wrangler.toml name
 * 片方だけ変えると、両側の値を並べたメッセージで落ちる。「F3 変異」の describe で、
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
    base_url?: string;
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
type Wrangler = { name?: string; allowedDomains?: string };
type HeaderRule = { source: string; headers: Array<{ key: string; value: string }> };
type CmsHosting = { site?: string; headers?: HeaderRule[] };

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, 'cms/public/config.yml');
const WRANGLER_PATH = path.join(ROOT, 'workers/sveltia-cms-auth/wrangler.toml');
const CMS_FIREBASE_PATH = path.join(ROOT, 'cms/firebase.json');
const DOCS_PATH = path.join(ROOT, 'docs/cms-sveltia.md');
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

// wrangler.toml から name と [vars] の ALLOWED_DOMAINS だけを読む（TOML パーサーは入れない）。
// 見つからないときは undefined になり、下の検査が落ちる。
const readWrangler = (text: string): Wrangler => {
  const top = text.split(/^\[/m)[0];
  const vars = text.split(/^\[vars\][ \t]*$/m)[1]?.split(/^\[/m)[0] ?? '';
  return {
    name: top.match(/^name\s*=\s*"([^"]*)"/m)?.[1],
    allowedDomains: vars.match(/^ALLOWED_DOMAINS\s*=\s*"([^"]*)"/m)?.[1],
  };
};
const loadWranglerText = () => readFileSync(WRANGLER_PATH, 'utf8');
const loadWrangler = () => readWrangler(loadWranglerText());
const loadCmsHosting = (): CmsHosting =>
  (JSON.parse(readFileSync(CMS_FIREBASE_PATH, 'utf8')) as { hosting: CmsHosting }).hosting;

/**
 * (f') wrangler.toml の形: ALLOWED_DOMAINS は [vars] の 1 か所だけで、環境ごとの設定（[env.*]・env.x = …）は置かない。
 * wrangler は `--env` を付けると [env.<名前>.vars] を使うので、そこに別の値があると (f) の照合をすり抜ける。
 */
function checkWranglerShape(text: string): string[] {
  const lines = text
    .split('\n')
    .map((line, index) => ({ line: line.trim(), number: index + 1 }))
    .filter(({ line }) => line !== '' && !line.startsWith('#'));
  const envLines = lines.filter(({ line }) => /^(?:\[{1,2}\s*env\s*[.\]]|env\s*[.=])/.test(line));
  const allowedLines = lines.filter(({ line }) => line.includes('ALLOWED_DOMAINS'));
  const inVars = readWrangler(text).allowedDomains !== undefined;
  const format = (found: typeof lines) =>
    found.map(({ line, number }) => `${number}: ${line}`).join(' / ');
  return [
    ...(envLines.length > 0
      ? [`wrangler.toml に環境ごとの設定がある（[env.*] は照合をすり抜ける）: ${format(envLines)}`]
      : []),
    ...(allowedLines.length !== 1 || !inVars
      ? [
          `ALLOWED_DOMAINS は [vars] に 1 か所だけ置く: 実際 ${allowedLines.length} か所（${format(
            allowedLines
          )}）`,
        ]
      : []),
  ];
}

/** (f) 認証 Worker がトークンを渡す先 ↔ CMS を配信する Firebase Hosting サイト */
function checkAllowedDomains(wrangler: Wrangler, hosting: CmsHosting): string[] {
  const expected = `${hosting.site}.web.app`;
  const both = `wrangler.toml [vars] ALLOWED_DOMAINS "${
    wrangler.allowedDomains ?? '（未定義）'
  }" / cms/firebase.json hosting.site "${hosting.site}"（期待 ${expected}）`;
  const hosts = (wrangler.allowedDomains ?? '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean);
  if (hosts.length === 0) {
    return [
      `ALLOWED_DOMAINS が空（上流の Worker は空だとどのオリジンにもトークンを渡す）。${both}`,
    ];
  }
  return hosts.flatMap((host) =>
    [
      host.includes('*') && 'ワイルドカード * を含む',
      host.includes('--') && 'Firebase のプレビューチャネル（--）を含む',
      /develop/i.test(host) && 'develop を含む',
      host !== expected && 'CMS のホストと違う',
    ]
      .filter(Boolean)
      .map((problem) => `ALLOWED_DOMAINS の ${host} は不可（${problem}）。${both}`)
  );
}

/**
 * 認証 Worker を置いた Cloudflare アカウント（wrangler.toml の account_id、Company@cor-jp.com）の workers.dev の
 * サブドメイン。2026-10-01 の `wrangler deploy` の出力で確かめた。
 * URL の形（https://<name>.<任意>.workers.dev）だけを見ると、タイプミスや第三者のアカウントにある同名の Worker でも
 * 通り、編集者の GitHub トークン（public_repo,user）をそこへ渡してしまう。だから完全一致で照合する。
 */
const WORKERS_DEV_SUBDOMAIN = 'company-997';
const workerUrlOf = (wrangler: Wrangler) =>
  `https://${wrangler.name}.${WORKERS_DEV_SUBDOMAIN}.workers.dev`;
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** (g) config.yml の base_url ↔ 認証 Worker の URL（wrangler.toml の name と、アカウントのサブドメイン） */
function checkBaseUrl(config: CmsConfig, wrangler: Wrangler): string[] {
  const baseUrl = config.backend.base_url ?? '（未定義）';
  const expected = workerUrlOf(wrangler);
  if (wrangler.name && baseUrl === expected) return [];
  return [
    `base_url が認証 Worker の URL と違う: config.yml base_url "${baseUrl}" / 期待 "${expected}"（wrangler.toml name "${wrangler.name}"・アカウントの workers.dev サブドメイン ${WORKERS_DEV_SUBDOMAIN}）`,
  ];
}

/**
 * (g') 手順書に書いた Worker の URL は、すべて base_url と同じ。http・https と大文字小文字を問わず、ホスト名は
 * 区切りの文字までの全体を取る（…workers.dev.example のようなよく似たホストも拾う）。
 * 対象外は 2-6 の表に残した仮の値（履歴）の完全一致と、<サブドメイン> の説明（< で止まり、一致しない）だけ
 */
function checkDocsWorkerUrls(docs: string, wrangler: Wrangler): string[] {
  const name = wrangler.name ?? '';
  const expected = workerUrlOf(wrangler);
  const placeholder = `https://${name}.REPLACE-WITH-CF-SUBDOMAIN.workers.dev`;
  const pattern = new RegExp(`https?://${escapeRegExp(name)}\\.[^/\\s\`'"()（）<>|、。]+`, 'gi');
  const found = [...docs.matchAll(pattern)]
    .map((match) => match[0])
    .filter((url) => url !== placeholder);
  if (found.length === 0) return [`docs/cms-sveltia.md に Worker の URL が 1 つも無い / 期待 "${expected}"`];
  const wrong = [...new Set(found.filter((url) => url !== expected))];
  if (wrong.length === 0) return [];
  return [
    `docs/cms-sveltia.md の Worker の URL: 期待と違うもの [${wrong.join(', ')}]（${found.length} 件中）/ 期待 "${expected}"`,
  ];
}

const headerValue = (hosting: CmsHosting, source: string, name: string): string =>
  hosting.headers
    ?.find((rule) => rule.source === source)
    ?.headers.find((header) => header.key.toLowerCase() === name.toLowerCase())?.value ??
  '（なし）';

const parseCsp = (csp: string): Map<string, string[]> =>
  new Map(
    csp
      .split(';')
      .map((directive) => directive.trim().split(/\s+/))
      .filter(([name]) => name)
      .map(([name, ...sources]): [string, string[]] => [name, sources])
  );

/** (h) CMS の配信ヘッダー（cms/firebase.json）。実際に付くことは e2e/admin-cms.spec.ts が確かめる */
function checkCmsHeaders(hosting: CmsHosting): string[] {
  const violations: string[] = [];
  const expected: Array<[string, string, string | RegExp]> = [
    ['**', 'X-Frame-Options', 'DENY'],
    ['**', 'X-Content-Type-Options', 'nosniff'],
    ['**', 'Referrer-Policy', 'same-origin'],
    ['**', 'Cross-Origin-Opener-Policy', 'same-origin-allow-popups'],
    ['**', 'X-Robots-Tag', /noindex/],
    ['/assets/**', 'Cache-Control', /immutable/],
    ['/', 'Cache-Control', /^no-cache$/],
  ];
  for (const [source, name, want] of expected) {
    const actual = headerValue(hosting, source, name);
    if (typeof want === 'string' ? actual !== want : !want.test(actual)) {
      violations.push(`${source} の ${name}: 期待 ${want} / cms/firebase.json "${actual}"`);
    }
  }
  const csp = headerValue(hosting, '**', 'Content-Security-Policy');
  const directives = parseCsp(csp);
  const required: Array<[string, string]> = [
    ['default-src', "'none'"],
    ['frame-ancestors', "'none'"],
    ['object-src', "'none'"],
    ['base-uri', "'none'"],
  ];
  for (const [name, source] of required) {
    if (!(directives.get(name) ?? []).includes(source)) {
      violations.push(`CSP の ${name} に ${source} が無い: "${csp}"`);
    }
  }
  const forbidden = /unpkg\.com|jsdelivr\.net|^'unsafe-eval'$|^\*$|^https?:$/;
  for (const [name, sources] of directives) {
    for (const source of sources.filter((value) => forbidden.test(value))) {
      violations.push(`CSP の ${name} に許可しない送信元 ${source} がある: "${csp}"`);
    }
  }
  if ((directives.get('script-src') ?? []).includes("'unsafe-inline'")) {
    violations.push(`CSP の script-src に 'unsafe-inline' がある: "${csp}"`);
  }
  return violations;
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

describe('CMS の配信と認証 Worker（cms/firebase.json ↔ wrangler.toml ↔ config.yml）', () => {
  it('(f) ALLOWED_DOMAINS は CMS のホスト（hosting.site + .web.app）だけ', () => {
    expect(checkAllowedDomains(loadWrangler(), loadCmsHosting())).toEqual([]);
    expect(loadWrangler().allowedDomains).toBe(`${loadCmsHosting().site}.web.app`);
  });

  it("(f') wrangler.toml に [env.*] が無く、ALLOWED_DOMAINS は [vars] の 1 か所だけ", () => {
    expect(checkWranglerShape(loadWranglerText())).toEqual([]);
  });

  it('(g) base_url は認証 Worker（wrangler.toml の name・アカウントのサブドメイン）の URL と完全一致', () => {
    expect(checkBaseUrl(loadConfig(), loadWrangler())).toEqual([]);
  });

  it("(g') 手順書に書いた Worker の URL は、すべて base_url と同じ", () => {
    expect(checkDocsWorkerUrls(readFileSync(DOCS_PATH, 'utf8'), loadWrangler())).toEqual([]);
  });

  it('(h) CSP と保護ヘッダー: frame-ancestors none、CDN なし、キャッシュの区別', () => {
    expect(checkCmsHeaders(loadCmsHosting())).toEqual([]);
  });
});

describe('F3 変異: トークンの渡し先・Worker の URL・CSP の片側だけを変える', () => {
  const hosting = loadCmsHosting();
  const withAllowed = (allowedDomains: string) =>
    checkAllowedDomains({ ...loadWrangler(), allowedDomains }, hosting).join('\n');

  it('ALLOWED_DOMAINS を空にする', () => {
    const message = withAllowed('');
    expect(message).toContain('ALLOWED_DOMAINS が空');
    expect(message).toContain('hosting.site "cor-jp-cms-admin"（期待 cor-jp-cms-admin.web.app）');
  });

  it('ALLOWED_DOMAINS にワイルドカードを使う', () => {
    const message = withAllowed('*.web.app');
    expect(message).toContain('ALLOWED_DOMAINS の *.web.app は不可（ワイルドカード * を含む）');
    expect(message).toContain(
      'ALLOWED_DOMAINS "*.web.app" / cms/firebase.json hosting.site "cor-jp-cms-admin"'
    );
  });

  it('ALLOWED_DOMAINS に PR のプレビューチャネルを足す', () => {
    const message = withAllowed(
      'cor-jp-cms-admin.web.app, cor-jp-main--pr342-feat-cms-abc123.web.app'
    );
    expect(message).toContain('プレビューチャネル（--）を含む');
    expect(message).not.toContain('ALLOWED_DOMAINS の cor-jp-cms-admin.web.app は不可');
  });

  it('ALLOWED_DOMAINS に develop のホストを入れる', () => {
    const message = withAllowed('cor-jp-main--develop-v6sxy3wv.web.app');
    expect(message).toContain('develop を含む');
    expect(message).toContain('CMS のホストと違う');
  });

  it('wrangler.toml に [env.production.vars] で別の ALLOWED_DOMAINS を足す', () => {
    const text = `${loadWranglerText()}\n[env.production.vars]\nALLOWED_DOMAINS = "*"\n`;
    const message = checkWranglerShape(text).join('\n');
    expect(message).toContain('wrangler.toml に環境ごとの設定がある');
    expect(message).toContain('[env.production.vars]');
    expect(message).toContain('ALLOWED_DOMAINS は [vars] に 1 か所だけ置く: 実際 2 か所');
  });

  it('wrangler.toml の先頭に env.production.vars.ALLOWED_DOMAINS を書く（ドット区切りのキー）', () => {
    const text = `env.production.vars.ALLOWED_DOMAINS = "*"\n${loadWranglerText()}`;
    const message = checkWranglerShape(text).join('\n');
    expect(message).toContain('1: env.production.vars.ALLOWED_DOMAINS = "*"');
  });

  it('cms/firebase.json の site だけを変える', () => {
    const message = checkAllowedDomains(loadWrangler(), { ...hosting, site: 'cor-jp-cms-admin-2' });
    expect(message.join('\n')).toContain(
      'ALLOWED_DOMAINS "cor-jp-cms-admin.web.app" / cms/firebase.json hosting.site "cor-jp-cms-admin-2"（期待 cor-jp-cms-admin-2.web.app）'
    );
  });

  it.each([
    ['Worker の URL が決まる前の仮の値', 'https://cor-sveltia-cms-auth.REPLACE-WITH-CF-SUBDOMAIN.workers.dev'],
    ['別のホスト', 'https://auth.example.com'],
    ['アカウントのサブドメインの打ち間違い', 'https://cor-sveltia-cms-auth.company-979.workers.dev'],
    ['第三者のアカウントにある同名の Worker', 'https://cor-sveltia-cms-auth.attacker.workers.dev'],
  ])('base_url を変える: %s', (_, baseUrl) => {
    const config = loadConfig();
    const mutated = { ...config, backend: { ...config.backend, base_url: baseUrl } };
    expect(checkBaseUrl(mutated, loadWrangler())).toEqual([
      `base_url が認証 Worker の URL と違う: config.yml base_url "${baseUrl}" / 期待 "https://cor-sveltia-cms-auth.company-997.workers.dev"（wrangler.toml name "cor-sveltia-cms-auth"・アカウントの workers.dev サブドメイン company-997）`,
    ]);
  });

  it.each([
    ['サブドメインの打ち間違い', 'https://cor-sveltia-cms-auth.company-979.workers.dev'],
    ['大文字のサブドメインの打ち間違い', 'https://cor-sveltia-cms-auth.COMPANY-979.workers.dev'],
    ['http', 'http://cor-sveltia-cms-auth.company-997.workers.dev'],
    ['後ろに文字が付いたよく似たホスト', 'https://cor-sveltia-cms-auth.company-997.workers.dev.evil.example'],
  ])('手順書の Worker の URL を 1 か所だけ変える: %s', (_, wrongUrl) => {
    const docs = readFileSync(DOCS_PATH, 'utf8');
    const mutated = docs.replace(
      'https://cor-sveltia-cms-auth.company-997.workers.dev/callback',
      `${wrongUrl}/callback`
    );
    expect(mutated).not.toBe(docs);
    const [message, ...rest] = checkDocsWorkerUrls(mutated, loadWrangler());
    expect(rest).toEqual([]);
    expect(message).toContain(`期待と違うもの [${wrongUrl}]`);
    expect(message).toContain('期待 "https://cor-sveltia-cms-auth.company-997.workers.dev"');
  });

  it('CSP に unpkg を足し、frame-ancestors を消す', () => {
    const csp = headerValue(hosting, '**', 'Content-Security-Policy')
      .replace("script-src 'self'", "script-src 'self' https://unpkg.com")
      .replace("; frame-ancestors 'none'", '');
    const headers = hosting.headers?.map((rule) =>
      rule.source === '**'
        ? {
            ...rule,
            headers: rule.headers.map((header) =>
              header.key === 'Content-Security-Policy' ? { ...header, value: csp } : header
            ),
          }
        : rule
    );
    const message = checkCmsHeaders({ ...hosting, headers }).join('\n');
    expect(message).toContain("CSP の frame-ancestors に 'none' が無い");
    expect(message).toContain('CSP の script-src に許可しない送信元 https://unpkg.com がある');
  });
});
