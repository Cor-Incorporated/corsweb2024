/**
 * Sveltia CMS の項目の正本（griftai.org の cms-contract と同じ並び）。
 *
 * cms/public/config.yml は、このファイルと同じ値を手で置いた設定である。
 * scripts/check-cms.mjs（npm run check:cms）がずれを止める。
 * このファイルは他のモジュールを import しない。Node が TypeScript をそのまま読めないとき、
 * 検査スクリプトが transpile して読むため。
 *
 * 認証 Worker の値は、いまデプロイしているものの記録である。OAuth の secret は置かない。
 * 共有パッケージはまだ作らない。サイトをまたいで揃えるのは、この並びだけ。
 */

export interface CmsChoice {
  label: string;
  value: string;
}

export interface CmsField {
  name: string;
  label: string;
  widget: string;
  /** Sveltia の required。省略は true。false のときだけ config.yml に required: false を書く。 */
  required: boolean;
  hint?: string;
  default?: string | boolean;
  options?: readonly CmsChoice[];
  fields?: readonly CmsField[];
  accept?: string;
  format?: string;
  /** config.yml の datetime の type（date）。 */
  dateType?: string;
  modes?: readonly string[];
}

export interface CmsCollection {
  name: string;
  label: string;
  labelSingular: string;
  description: string;
  icon: string;
  folder: string;
  previewPath: string;
  sortableFields: readonly string[];
  sortableField: string;
  sortableDirection: 'ascending' | 'descending';
  /** CMS は日本語を削除し、翻訳 CI が来歴と差分を確かめて訳を削除する。 */
  delete: boolean;
  slugHint: string;
  fields: readonly CmsField[];
}

export const draftField = 'isDraft' as const;

export const authWorker = {
  /** 上流 sveltia/sveltia-cms-auth。src/index.js と LICENSE.txt は改変しない。 */
  upstreamCommit: '4fd08b5d4e009a85fa473fd523824ca9dfee9533',
  indexBlob: '8c4c3beb721245c30b43e8b5e8444be7038f1789',
  licenseBlob: '0d1f75bec76122bd15bcdf7a895119b2fe5a7f71',
  name: 'cor-sveltia-cms-auth',
  compatibilityDate: '2023-03-24',
  workersDevSubdomain: 'company-997',
  accountId: '9973f2d2304b58a1f90d4d9409e9f8cc',
  workersDev: true,
  previewUrls: false,
  /** トークンを渡してよいホスト。cms/firebase.json の hosting.site + .web.app と一致する。 */
  allowedDomains: 'cor-jp-cms-admin.web.app',
} as const;

export const cmsBackend = {
  name: 'github',
  repo: 'Cor-Incorporated/corsweb2024',
  branch: 'develop',
  baseUrl: `https://${authWorker.name}.${authWorker.workersDevSubdomain}.workers.dev`,
  authMethods: ['oauth'] as const,
  authScope: 'public_repo',
  squashMerges: false,
  openAuthoring: false,
  previewContext: 'Deploy Preview',
  publishMode: 'editorial_workflow',
} as const;

export const cmsSite = {
  appTitle: 'Cor.株式会社 コンテンツ管理',
  siteUrl: 'https://cor-jp.com',
  logoSrc: '/logo.png',
  hostingSite: 'cor-jp-cms-admin',
  /** npm run cms:dev の Vite のポート。公開サイトの 4321、e2e の 4323 とは別。 */
  devPort: 5174,
  /** package.json の @sveltia/cms。キャレットや範囲にはしない。 */
  sveltiaCmsVersion: '0.221.7',
} as const;

export const cmsMedia = {
  mediaFolder: 'public/images/blog',
  publicFolder: '/images/blog',
  accept: 'image/avif,image/webp,image/jpeg,image/png,image/heic',
  slugifyFilename: true,
  stockAssets: false,
  transformations: {
    jpeg: { format: 'webp', quality: 85, width: 1600, height: 1600 },
    png: { format: 'webp', quality: 85, width: 1600, height: 1600 },
    heic: { format: 'webp', quality: 85, width: 1600, height: 1600 },
  },
} as const;

export const cmsSlug = {
  encoding: 'ascii',
  cleanAccents: true,
  pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
  patternMessage: '英小文字・数字・ハイフンだけで入力してください（例: ai-adoption-roadmap）',
  editable: ['create'] as const,
  hint: '記事の URL の末尾になります。例 ai-adoption-roadmap → https://cor-jp.com/blog/ai-adoption-roadmap/ 。英小文字・数字・ハイフンだけ。作成後は変更できません。',
} as const;

export const cmsOutput = {
  omitEmptyOptionalFields: true,
  yamlQuote: 'none',
} as const;

export const cmsCommitMessages = {
  create: 'feat(blog): {{slug}} を追加',
  update: 'docs(blog): {{slug}} を更新',
  delete: 'chore(blog): {{slug}} を削除',
  uploadMedia: 'chore(blog): 画像 {{path}} を追加',
  deleteMedia: 'chore(blog): 画像 {{path}} を削除',
} as const;

export const blogCategoryOptions = [
  { label: 'AI', value: 'ai' },
  { label: 'エンジニアリング', value: 'engineering' },
  { label: '創業', value: 'founder' },
  { label: 'ラボ', value: 'lab' },
] as const satisfies readonly CmsChoice[];

/** ADR-0014 の CONTACT_INTENTS と同じ並び。表示名は管理画面用。 */
export const blogCtaIntentOptions = [
  { label: '機密データAI活用診断', value: 'confidential-ai-assessment' },
  { label: 'ローカルLLM / AI基盤PoC', value: 'local-llm-poc' },
  { label: 'Grift（テスト導入・CLI）', value: 'grift-team-beta' },
  { label: 'Grift（旧・有料トライアル）', value: 'grift-paid-trial' },
  { label: '見積監査（旧）', value: 'estimate-audit' },
  { label: 'AI受託開発', value: 'contract-dev' },
  { label: '取材・登壇・その他', value: 'press-speaking-other' },
] as const satisfies readonly CmsChoice[];

const imageFields = [
  {
    name: 'url',
    label: '画像',
    widget: 'image',
    required: true,
    accept: cmsMedia.accept,
  },
  {
    name: 'alt',
    label: '代替テキスト',
    widget: 'string',
    required: true,
    hint: '画像の内容を短く説明します（読み上げ・検索用）。',
  },
] as const satisfies readonly CmsField[];

const dateField = (
  name: string,
  label: string,
  required: boolean,
  withNow: boolean,
  hint?: string
): CmsField => ({
  name,
  label,
  widget: 'datetime',
  required,
  dateType: 'date',
  format: 'YYYY-MM-DD',
  ...(hint ? { hint } : {}),
  ...(withNow ? { default: '{{now}}' } : {}),
});

export const blogFields = [
  {
    name: 'title',
    label: 'タイトル',
    widget: 'string',
    required: true,
    hint: '記事の見出し。検索結果や SNS にもこのまま出ます。',
  },
  {
    name: 'description',
    label: '概要',
    widget: 'text',
    required: true,
    hint: '記事一覧・検索結果・SNS に出る説明文。1〜2 文で、改行は入れません。',
  },
  {
    name: 'summary',
    label: '記事の要点',
    widget: 'text',
    required: false,
    hint: '本文の前の「この記事の要点」に出ます。結論を 2〜3 文で書きます（本文に書いていないことは書きません）。空のままなら出しません。',
  },
  dateField('pubDate', '公開日', true, true),
  dateField('updatedDate', '更新日', false, false, '内容を大きく直したときだけ入れます。空のままなら書き出しません。'),
  { name: 'author', label: '著者', widget: 'string', required: true, default: 'Terisuke' },
  {
    name: 'category',
    label: 'カテゴリ',
    widget: 'select',
    required: true,
    options: blogCategoryOptions,
  },
  {
    name: 'ctaIntent',
    label: '記事の下で案内する相談',
    widget: 'select',
    required: false,
    hint: '空のままならカテゴリの既定（AI は機密データAI活用診断、エンジニアリングは受託開発、創業とラボは取材・登壇）を案内します（ADR-0020）。',
    options: blogCtaIntentOptions,
  },
  {
    name: 'tags',
    label: 'タグ',
    widget: 'list',
    required: false,
    hint: '1 行に 1 つ。Enter で次の行を追加します。',
  },
  {
    name: 'image',
    label: 'アイキャッチ画像',
    widget: 'object',
    required: false,
    hint: '使うときだけチェックを入れて、画像と代替テキストを入れます。',
    fields: imageFields,
  },
  { name: 'lang', label: '言語', widget: 'hidden', required: true, default: 'ja' },
  { name: 'featured', label: 'おすすめに表示', widget: 'boolean', required: true, default: false },
  {
    name: draftField,
    label: '下書き',
    widget: 'hidden',
    required: true,
    default: false,
  },
  {
    name: 'body',
    label: '本文',
    widget: 'markdown',
    required: true,
    modes: ['raw', 'rich_text'],
  },
] as const satisfies readonly CmsField[];

export const newsFields = [
  {
    "name": "title",
    "label": "タイトル",
    "widget": "string",
    "required": true
  },
  {
    "name": "description",
    "label": "概要",
    "widget": "text",
    "required": true
  },
  {
    "name": "publishedAt",
    "label": "公開日",
    "widget": "datetime",
    "required": true,
    "default": "{{now}}",
    "format": "YYYY-MM-DD",
    "dateType": "date"
  },
  {
    "name": "updatedAt",
    "label": "更新日",
    "widget": "datetime",
    "required": false,
    "format": "YYYY-MM-DD",
    "dateType": "date"
  },
  {
    "name": "author",
    "label": "著者",
    "widget": "string",
    "required": true,
    "default": "Terisuke"
  },
  {
    "name": "category",
    "label": "カテゴリ",
    "widget": "select",
    "required": true,
    "options": [
      {
        "label": "お知らせ",
        "value": "info"
      },
      {
        "label": "メディア",
        "value": "media"
      },
      {
        "label": "アップデート",
        "value": "update"
      },
      {
        "label": "イベント",
        "value": "event"
      },
      {
        "label": "受賞",
        "value": "award"
      },
      {
        "label": "プレスリリース",
        "value": "press"
      }
    ]
  },
  {
    "name": "tags",
    "label": "タグ",
    "widget": "list",
    "required": false
  },
  {
    "name": "externalUrl",
    "label": "外部記事の URL",
    "widget": "string",
    "required": false
  },
  {
    "name": "source",
    "label": "掲載元",
    "widget": "string",
    "required": false
  },
  {
    "name": "ogImage",
    "label": "SNS 用画像",
    "widget": "image",
    "required": false,
    "accept": "image/avif,image/webp,image/jpeg,image/png,image/heic"
  },
  {
    "name": "isDraft",
    "label": "下書き",
    "widget": "hidden",
    "required": true,
    "default": false
  },
  {
    "name": "featured",
    "label": "おすすめに表示",
    "widget": "boolean",
    "required": true,
    "default": false
  },
  {
    "name": "lang",
    "label": "言語",
    "widget": "hidden",
    "required": true,
    "default": "ja"
  },
  {
    "name": "body",
    "label": "本文",
    "widget": "markdown",
    "required": true,
    "modes": [
      "raw",
      "rich_text"
    ]
  }
] as const satisfies readonly CmsField[];

export const casesFields = [
  {
    "name": "title",
    "label": "タイトル",
    "widget": "string",
    "required": true
  },
  {
    "name": "description",
    "label": "概要",
    "widget": "text",
    "required": true
  },
  {
    "name": "category",
    "label": "カテゴリ",
    "widget": "select",
    "required": true,
    "options": [
      {
        "label": "Grift",
        "value": "grift"
      },
      {
        "label": "機密データ AI 活用",
        "value": "confidential-ai"
      },
      {
        "label": "ローカル LLM",
        "value": "local-llm"
      },
      {
        "label": "AI 受託開発",
        "value": "ai-contract"
      },
      {
        "label": "教育・コミュニティ",
        "value": "tech-culture"
      }
    ]
  },
  {
    "name": "tags",
    "label": "タグ",
    "widget": "list",
    "required": false
  },
  {
    "name": "publishedAt",
    "label": "公開日",
    "widget": "datetime",
    "required": true,
    "default": "{{now}}",
    "format": "YYYY-MM-DD",
    "dateType": "date"
  },
  {
    "name": "updatedAt",
    "label": "更新日",
    "widget": "datetime",
    "required": false,
    "format": "YYYY-MM-DD",
    "dateType": "date"
  },
  {
    "name": "heroImage",
    "label": "アイキャッチ画像",
    "widget": "object",
    "required": false,
    "fields": [
      {
        "name": "url",
        "label": "画像",
        "widget": "image",
        "required": true,
        "accept": "image/avif,image/webp,image/jpeg,image/png,image/heic"
      },
      {
        "name": "alt",
        "label": "代替テキスト",
        "widget": "string",
        "required": true
      }
    ]
  },
  {
    "name": "ogImage",
    "label": "SNS 用画像",
    "widget": "image",
    "required": false,
    "accept": "image/avif,image/webp,image/jpeg,image/png,image/heic"
  },
  {
    "name": "summary",
    "label": "リード文",
    "widget": "text",
    "required": true
  },
  {
    "name": "securityNote",
    "label": "機密情報に関する注記",
    "widget": "text",
    "required": false
  },
  {
    "name": "ctaType",
    "label": "記事の下で案内する相談",
    "widget": "select",
    "required": false,
    "options": [
      {
        "label": "Grift",
        "value": "grift"
      },
      {
        "label": "機密データ AI 活用",
        "value": "confidential-ai"
      },
      {
        "label": "ローカル LLM",
        "value": "local-llm"
      },
      {
        "label": "AI 受託開発",
        "value": "ai-contract"
      },
      {
        "label": "教育・コミュニティ",
        "value": "tech-culture"
      }
    ]
  },
  {
    "name": "relatedSlugs",
    "label": "関連記事のスラッグ",
    "widget": "list",
    "required": false
  },
  {
    "name": "isDraft",
    "label": "下書き",
    "widget": "hidden",
    "required": true,
    "default": false
  },
  {
    "name": "featured",
    "label": "おすすめに表示",
    "widget": "boolean",
    "required": true,
    "default": false
  },
  {
    "name": "lang",
    "label": "言語",
    "widget": "hidden",
    "required": true,
    "default": "ja"
  },
  {
    "name": "body",
    "label": "本文",
    "widget": "markdown",
    "required": true,
    "modes": [
      "raw",
      "rich_text"
    ]
  }
] as const satisfies readonly CmsField[];

export const cmsCollections: readonly CmsCollection[] = [
  {
    name: 'blog',
    label: 'ブログ',
    labelSingular: 'ブログ記事',
    description:
      '日本語の記事だけを編集します。英語・中国語・韓国語・スペイン語は、翻訳 CI（#339 のマージ後）がレビューに送った PR に自動で追加します。',
    icon: 'article',
    folder: 'src/content/blog/ja',
    previewPath: '/blog/{{slug}}/',
    sortableFields: ['pubDate', 'title'],
    sortableField: 'pubDate',
    sortableDirection: 'descending',
    delete: true,
    slugHint: cmsSlug.hint,
    fields: blogFields,
  },
  {
    "name": "news",
    "label": "ニュース",
    "labelSingular": "ニュース記事",
    "description": "日本語のニュースを編集します。翻訳は CI が PR に追加します。削除時は訳の削除も PR で確認してください。",
    "icon": "newspaper",
    "folder": "src/content/news/ja",
    "previewPath": "/news/{{slug}}/",
    "sortableFields": [
      "publishedAt",
      "title"
    ],
    "sortableField": "publishedAt",
    "sortableDirection": "descending",
    "delete": true,
    "slugHint": "記事の URL の末尾になります。例 company-news → https://cor-jp.com/news/company-news/ 。英小文字・数字・ハイフンだけ。作成後は変更できません。",
    "fields": newsFields
  },
  {
    "name": "cases",
    "label": "実績",
    "labelSingular": "実績記事",
    "description": "日本語の実績を編集します。翻訳は CI が PR に追加します。削除時は訳の削除も PR で確認してください。",
    "icon": "work",
    "folder": "src/content/cases/ja",
    "previewPath": "/works/{{slug}}/",
    "sortableFields": [
      "publishedAt",
      "title"
    ],
    "sortableField": "publishedAt",
    "sortableDirection": "descending",
    "delete": true,
    "slugHint": "記事の URL の末尾になります。例 project-case → https://cor-jp.com/works/project-case/ 。英小文字・数字・ハイフンだけ。作成後は変更できません。",
    "fields": casesFields
  },
];
