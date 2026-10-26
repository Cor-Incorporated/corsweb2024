# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working
with code in this repository.

## Project Overview

This is the corporate website of Cor.株式会社 (`https://cor-jp.com`), a static
Astro 4 site (`astro@^4.8.7` in `package.json`) deployed to Firebase Hosting,
with a strong focus on loading speed. It is published in five languages
(Japanese, English, Chinese, Korean, Spanish) and has three Content
Collections — blog, news and cases (works) — whose non-Japanese versions are
machine-translated in CI. The site stays static Astro (no SSR, no Next.js
migration: `docs/adr/ADR-0017-static-astro-direction-2026q4.md`).

What the site may say about the company and its services is governed by the
ADRs in `docs/adr/` (index: `docs/adr/README.md`), not by this file. Read
**Content & Public Copy Rules** below before editing any page, component,
locale file or article.

## Development Commands

```bash
npm run dev            # Dev server on localhost:4321
npm run build          # astro check (type check) + astro build → dist/
npm run preview        # Preview the production build
npm run preview:ci     # Preview on 127.0.0.1:4322 (used by the visual-text tests)
npm run build:cms      # Build the Sveltia CMS admin (cms/ → cms/dist)
```

### Tests and Checks

```bash
npm run test:run          # Vitest unit tests: src/**/*.test.* and scripts/**/*.test.* (vitest.config.ts)
npm run test              # Vitest in watch mode (test:ui / test:coverage also exist)
npm run test:dist         # Vitest on the built dist (vitest.dist.config.ts → tests/build-output/); run after `npm run build`
npm run test:e2e          # Playwright e2e/ against `npm run dev` (playwright.config.ts; admin-cms.spec.ts excluded)
npm run test:visual-text  # Playwright e2e/visual-text.spec.ts against preview:ci (playwright.visual.config.ts)
npm run verify:visual-text  # build + test:visual-text
npm run test:e2e:admin    # Playwright CMS admin test (playwright.admin.config.ts; run `npm run build:cms` first)
npm run security:audit:dist      # Audit dist/ (SEO tags, JSON-LD, secrets, allowed origins, no runtime CDN code); run after build
npm run security:audit           # security:audit:firebase + security:audit:workers + security:audit:dist
npm run i18n:check        # Missing/outdated content translations (no API key; exit 1 if any)
npm run check:links       # scripts/check-external-links.mjs: no hard-coded griftai.org, no unbacked "30秒" / multipliers in pages, components, i18n
npm run blog:check -- src/content/blog/ja/your-post.md   # scripts/blog-guardrails.mjs on one article (ADR-0007 wording)
npm run check:grift-version  # ja articles that call an old Grift CLI version "公開中/最新/現在" (ADR-0023; also run by test:run)
npm run seo:snapshot -- --out snapshot.json   # SEO/AIO snapshot of dist (see scripts/seo-snapshot.mjs for --compare)
```

What CI runs (`.github/workflows/`):

- `ci.yml` (job `verify`, PRs to develop/main): `test:run`, the
  `workers/contact-edge` tests, `build`, `security:audit:dist`, `test:dist`
  (also a second build with the calendar enabled), and the Firebase / Worker
  header audits
- `visual-text.yml`: `test:run`, `verify:visual-text`, and
  `build:cms` + `test:e2e:admin`
- `translate-content.yml`: content translation and the `i18n-check` job
- `deploy.yml`: Firebase Hosting deploy (`main` = production, `develop` and
  PRs = preview channels); `deploy-cms.yml` deploys the CMS admin
- `h5-admission.yml` (`scripts/h5-admission-check.sh`) and `guard-base-branch.yml`
- `grift-cli-release-watch.yml` (daily, on `main` only): compares the Grift
  CLI version in `src/config/grift-cli-release.json` with PyPI and opens an
  Issue when they differ (ADR-0023)

`check:links` and `blog:check` are not run by CI — run them yourself when you
touch public copy or articles.

### Branches and Pull Requests

- Open PRs against `develop`. Only `develop` may be merged into `main`
  (`guard-base-branch.yml` fails any other PR to `main`); `main` is production
- Fill in `.github/pull_request_template.md`

## Content & Public Copy Rules

These rules come from ADRs; the ADR is the source of truth if this summary
and the ADR disagree.

- **Japanese text and the CEO's voice** — when you write or edit Japanese
  text (pages, components, `src/i18n/locales/ja.json`, articles, PR descriptions,
  commit messages), always proofread it with the yomiyasu skill
  (`.claude/skills/yomiyasu/`, nanaism/yomiyasu v2.1.3, MIT, vendored unchanged)
  and use the cor-voice skill (`.claude/skills/cor-voice/`) to pick the register
  and keep the CEO's (寺田康佑) way of writing. Not needed for reports after code
  changes. Keep `.claude/skills/cor-voice/` identical to the copy in
  Cor-Incorporated/griftai

- **External expression guardrails** —
  `docs/adr/ADR-0007-external-expression-guardrails.md`, partly replaced by
  `docs/adr/ADR-0022-business-pillars-grift-cli.md`:
  - ISMS: you may write that the ISO/IEC 27001 stage 2 audit was completed in
    October 2026 and that certification registration is expected around
    December 2026. Until registration is complete, never write that it has been
    obtained (「取得済み」「認証取得」), and never name the audit body.
    P-mark / SCS are not mentioned at all
  - The retired business lines and product names listed in ADR-0007 were
    removed from the site. Do not reintroduce them anywhere (pages,
    components, `src/i18n/locales/*.json`, articles, structured data).
    `scripts/blog-guardrails.mjs` flags them in articles
  - The company name is 「Cor.株式会社」. Per-locale display names live in
    `ORGANIZATION_NAMES` in `src/config/organization.ts` (the single source for
    company facts used by JSON-LD, footer, RSS and titles); do not hard-code
    other spellings
  - No absolute claims, invented testimonials or unapproved customer names.
    Internal measurements, multipliers and reduction rates only with a linked
    page that explains the conditions; "coming soon" cases never appear in
    the works list
  - Grift is an own product that extracts verifiable facts from engineers'
    git history (OSS CLI `grift-cli`, MIT; trial for recruiting/SES agencies;
    no scores or rankings). It is no longer an estimation tool (ADR-0022).
    Call the agency trial 「テスト導入（PoC）」, never 「試行」
  - Grift CLI versions (ADR-0023): the current version lives only in
    `src/config/grift-cli-release.json` (read via `src/config/grift-cli.ts`).
    Articles write a version as a record of their time (「執筆時点では v0.x」)
    and link that version's GitHub Release (or its PyPI page when there is no
    Release), never 「公開中」「最新」「現在」 plus a version;
    `npm run test:run` fails when they do
  - The business has five pillars (Grift / local LLM & secure AI / hardware AI /
    AI contract development & adoption support / education & community); keep
    their order and wording in sync across `services2026`, `companyPage`, FAQ,
    meta and the Cloudia knowledge (ADR-0022). Of the partners, only Engineer
    Cafe may be named
- **Cross-site links and intents**: the Grift URL comes from
  `PUBLIC_GRIFT_BASE_URL` via `src/config/site.ts` — never hard-code
  `griftai.org` (`npm run check:links`; ADR-0010). Contact intents are the 7
  keys in `CONTACT_INTENTS` (`src/config/site.ts`, ADR-0014); blog CTA intent
  defaults are in ADR-0020
- **Contact**: inquiries are consolidated in Cloudia + the `contact-chat`
  Worker with the fallback form kept (ADR-0005, ADR-0012, ADR-0013); `/contact`
  regression guards are ADR-0021 + `src/config/contact-guards.ts` (checked by
  `npm run test:dist`)
- **Analytics**: Cloudflare Web Analytics + Microsoft Clarity (ADR-0004)

## Internationalization

There are two separate mechanisms. Do not mix them up.

1. **UI strings** — `src/i18n/locales/{ja,en,zh,ko,es}.json`, read through
   `src/utils/i18n.ts` (`getTranslations(locale)`, `getJaTranslations()` for
   ja-only sections). Translation CI never touches these files: when you add
   or change a UI string, write the ja, en, zh, ko and es values yourself in
   all five files (ADR-0006 principle, ADR-0019 scope). Every locale is typed
   against `en.json`, so a key missing from any locale file fails the type
   check in `npm run build` (ja may have extra ja-only keys)
2. **Content Collections** — `src/content/{blog,news,cases}/<lang>/*.md`.
   Only `ja/` is edited by humans (and the CMS); `en/zh/ko/es` are generated
   and owned by CI and get overwritten on the next ja change, so do not edit
   them by hand. Fix wording in the ja source instead (ADR-0019,
   `docs/i18n-translation.md`)

## Architecture & Key Patterns

### Tech Stack

- **Framework**: Astro 4 with Islands Architecture (selective hydration),
  built-in i18n routing (`prefixDefaultLocale: false`, so ja has no prefix)
- **Interactivity**: Alpine.js 3.14 bundled from npm (`src/components/layout/AlpineInit.astro`; no CDN)
- **Styling**: Tailwind CSS with stone color palette as primary,
  @tailwindcss/typography for blog content
- **TypeScript**: Custom Alpine.js type definitions in `/types/types.d.ts`;
  public env vars are declared in `src/env.d.ts`
- **AI Translation**: Gemini API (`@google/genai`, default `gemini-3.8-flash`)
  run in CI for incremental content translation (ADR-0019)
- **Content Management**: Astro Content Collections with Zod schema
  validation; Sveltia CMS for Japanese blog posts (ADR-0018)

### Repository Layout

- `src/pages/` — ja pages at the root; `en/`, `zh/`, `ko/`, `es/` hold the
  localized copies of most pages; `[lang]/` serves news, works and
  industries for the non-ja locales; `og/` generates OGP images
- `src/components/` — by feature: `home/`, `about/`, `blog/`, `news/`,
  `works/`, `industry/`, `contact/`, `products/`, `common/`, `layout/`
  (Header, Footer, AlpineInit, ThemeInit), `analytics/`, `youtube/`
- `src/config/` — site facts and single sources: `organization.ts`,
  `author.ts`, `site.ts`, `blog-schema.ts`, `categories.ts`,
  `news-categories.ts`, `indexing.ts` (noindex / sitemap), `contact-guards.ts`
- `src/utils/` — i18n, structured data / JSON-LD, OG image rendering,
  Alpine stores
- `scripts/` — audits and guards (`audit-*.mjs`, `check-external-links.mjs`,
  `blog-guardrails.mjs`, `seo-snapshot.mjs`), `i18n/` (translation pipeline),
  `cms/`
- `cms/` — Sveltia CMS admin (`docs/cms-sveltia.md`)
- `workers/` — Cloudflare Workers: `contact-chat` (`/api/contact/*`),
  `contact-edge` (`/contact/chat/` → Cloudia Pages), `sveltia-cms-auth`
- `services/vertex-gateway/` — Cloud Run gateway to Vertex AI Gemini for Cloudia
- `e2e/` — Playwright specs; `tests/build-output/` — dist tests
- `docs/` — ADRs, i18n guide, CMS guide, blog style guide

Pages use a consistent pattern:

1. Import Layout.astro wrapper
2. Import page-specific components
3. Use Alpine.js for interactivity via x-data directives

### Performance Optimizations

- Images are served as AVIF (e.g. responsive `public/assets/hero-480w.avif`)
- Aggressive compression via astro-compress and astro-compressor plugins
- Firebase Hosting serves JS/CSS/fonts/images with 1-year immutable cache
  headers (`firebase.json`)
- View Transitions API enabled for smooth navigation (`<ViewTransitions />` in
  `src/layouts/Layout.astro`)
- Core Web Vitals field data comes from Cloudflare Web Analytics (the beacon in
  `src/components/analytics/Analytics.astro`, production only). Bundle libraries
  from npm instead of loading them from a public CDN at runtime:
  `npm run security:audit:dist` rejects `import()` / `import … from` of a URL in
  executed scripts and `<script src>` from unpkg, esm.sh, Skypack, jspm, cdnjs and
  jsDelivr (exception: the vendor analytics tags in Analytics.astro)
- Critical CSS inlining for above-the-fold content
- Font optimization with font-display: optional

### Alpine.js Integration

Alpine.js is bundled from npm by `src/components/layout/AlpineInit.astro` (stores are
registered in `src/utils/alpine-stores.ts` before `Alpine.start()`). The theme class is
applied before first paint by `src/components/layout/ThemeInit.astro` (no `x-cloak` on
`<html>`, so the page renders even if JavaScript fails):

```typescript
// Global stores accessible via Alpine.store()
Alpine.store('theme', { isDark: boolean, toggle: function })
// (language switching uses plain links in the Header dropdown; there is no lang store)
// Components use x-data for local state
// Dark mode and language toggle integrated in Header component
```

## Blog System

### Overview

Comprehensive blog functionality with AI-powered translation, featuring:

- **Content Collections**: Astro's built-in content management using Zod schemas
- **Multilingual Support**: Japanese, English, Chinese, Korean, and Spanish blog
  posts with separate routing
- **AI Translation**: CI translates the Japanese source into all other
  languages with the Gemini API (`scripts/i18n/`, ADR-0019)
- **Rich Markdown**: GitHub Flavored Markdown, math equations (KaTeX), syntax
  highlighting, rich link cards with automatic metadata fetching
- **SEO**: Auto-generated OGP images, structured data, meta tags, breadcrumbs
- **Interactive Features**: Category and tag pages, related posts, table of
  contents, share buttons
- **Monetization**: Stripe-powered tip/support functionality
- **Performance**: Optimized with same caching strategies as main site

Writing style: the cor-voice skill (`.claude/skills/cor-voice/SKILL.md`) and
`docs/blog-style-guide.md`. Wording rules: ADR-0007 (see above). The story the
whole site tells (the one-line spine, the five scenes, who narrates each kind of
page, what each page is for and the shared closing line) is
`docs/story-spine.md`, approved by the CEO on 2026-10-25: read it before
rewriting any page, and keep every page within it.

### Content Structure

```text
src/content/
├── blog/{ja,en,zh,ko,es}/*.md    # Blog posts (ja = source, others = CI translations)
├── news/{ja,en,zh,ko,es}/*.md    # News / press releases
├── cases/{ja,en,zh,ko,es}/*.md   # Case studies shown under /works
└── config.ts                     # Collection definitions
```

### Blog Schema

The blog frontmatter schema is `blogFrontmatterSchema` in
`src/config/blog-schema.ts` (used by `src/content/config.ts`). Category ids
come from `BLOG_CATEGORIES` in `src/config/categories.ts`: `ai`, `engineering`,
`founder`, `lab`. `title` and `description` must be non-empty. The CMS field
list in `cms/public/config.yml` mirrors this schema, and
`src/config/__tests__/cms-config.test.ts` fails if only one side changes — update
both together. The translation pipeline keeps a Zod mirror in
`scripts/i18n/schema.mjs`, also linked by a test.

Optional fields used by the post template: `summary` (2–3 sentences shown as
「この記事の要点」 before the body and as `Article.abstract`; translated by CI)
and `ctaIntent` (the consultation the CTA box under the body offers; defaults
per category in `src/config/blog-cta.ts`, ADR-0020). Do not put sales CTAs in
the body. Put sources in a last `## 参考資料` section as a list of links:
`src/utils/remark-article-sources.ts` styles it and emits the links as
`Article.citation`.

News categories: `src/config/news-categories.ts`. Case categories:
`caseCategories` in `src/content/config.ts`.

### AI Translation System

Japanese is the single source of truth. Humans (and the CMS) edit only
`src/content/{blog,news,cases}/ja/*.md`; `en/zh/ko/es` are generated and owned
by CI. Full guide: `docs/i18n-translation.md`. Decision:
`docs/adr/ADR-0019-i18n-auto-translation.md`.

```bash
npm run i18n:check                   # list missing/outdated translations (no API key; exit 1 if any)
npm run i18n:translate -- --dry-run  # show the plan without API calls or writes
node --env-file=.env scripts/i18n/translate-content.mjs --write --only blog/your-post
```

- **Freshness**: the SHA-256 of the translatable parts of the ja file is stored
  as `translationSourceHash` (with `translatedAt` and `translationModel`) in
  each translation; statuses are missing / stale / untracked / meta-drift /
  orphan / invalid / source-error / ok
- **Protection**: code blocks, inline code, URLs, link-card lines, math, HTML
  and image paths are replaced by placeholders and restored exactly. The
  company name and the founder's name become tokens too and come back as each
  locale's official spelling (`scripts/i18n/glossary.mjs`, linked by tests to
  `src/config/organization.ts` and `src/config/author.ts`)
- **Validation**: heading / code block / link / image / table (rows and cells
  per row) parity, the order of link and image destinations per heading, table
  cell, list item and paragraph, untranslated-Japanese detection and a Zod
  mirror of `src/content/config.ts` (linked by a test); a translation that
  fails any check is never written
- **Frontmatter**: only translatable fields are translated (blog keeps the ja
  tags; cases/news translate tags); everything else is copied from ja
- **CI**: `.github/workflows/translate-content.yml` translates the articles
  changed in a PR (`translate`: read-only token, `npm ci --ignore-scripts`,
  outputs a patch) and commits them to that PR (`push`: write token, runs no
  repo code, applies the patch only after checking paths and file modes);
  `i18n-check` verifies
- **Model / secrets**: `GEMINI_MODEL` (default `gemini-3.8-flash`),
  `GEMINI_API_KEY` (required), `TRANSLATION_BOT_TOKEN` (optional; broader and
  longer-lived than GITHUB_TOKEN, see `docs/i18n-translation.md` section 6)

### Blog Routing & Pages

ja has no URL prefix; the other locales use `/en`, `/zh`, `/ko`, `/es` and
have the same files under `src/pages/<lang>/blog/`.

| Page | ja URL | ja file |
|---|---|---|
| List | `/blog/` | `src/pages/blog/[...page].astro` |
| Post | `/blog/<slug>/` | `src/pages/blog/[...slug].astro` |
| Category | `/blog/category/<id>/` | `src/pages/blog/category/[id]/[...page].astro` |
| Tag (noindex) | `/blog/tags/<tag>/` | `src/pages/blog/tags/[tag]/[...page].astro` |

RSS: `src/pages/rss.xml.ts` and `src/pages/<lang>/rss.xml.ts` (blog),
`src/pages/news.xml.ts` and `src/pages/[lang]/news.xml.ts` (news).

#### Individual Post Features (All Languages)

- **Full Navigation**: Previous/Next post navigation with proper slug handling
- **Tag Display**: All post tags shown with responsive design
- **Related Posts**: Same-category posts displayed using PostCard component
- **Reading Time**: Dynamically calculated based on content length
- **Social Sharing**: Share buttons for major social platforms
- **Table of Contents**: Auto-generated for posts with 3+ headings
- **Breadcrumb Navigation**: Structured navigation with proper schema
  markup

#### Blog Layout

- **Shared Layout**: `src/layouts/BlogLayout.astro`
  - Enhanced SEO with structured data (Article, BreadcrumbList) via
    `src/components/blog/seo/`
  - Default OGP image `/og/<slug>.png`, generated by `src/pages/og/`
    (PNG and SVG; `og/page/` for non-article pages)
  - Multilingual hreflang tags (5 languages)
  - KaTeX CSS for math rendering: self-hosted (`katex` from npm, inlined by
    `src/components/blog/KatexStyles.astro`) and emitted only on posts that contain
    math (`remarkPluginFrontmatter.hasMath` from `src/utils/remark-has-math.ts`)
  - Performance optimizations (critical CSS)

### Blog Components

- **AuthorBox.astro**: Author photo, name, title, bio, profile link, the
  author's accounts (`sameAs`) and a short company profile (`companyPage.lead`)
  for every locale. Author facts live in `src/config/author.ts` (also used for
  the Person JSON-LD referenced by `Article.author`); add new authors there
- **ArticleSummary.astro**: 「この記事の要点」 box from frontmatter `summary`
- **BlogCta.astro**: The one CTA box under the body (ADR-0020): consultation
  link with `intent` and `source=blog/<slug>`, plus the company deck
- **BlogArchiveHeader.astro** / **BlogCategoryNav.astro**: List page header and
  category navigation
- **CategoryBadge.astro**: Color-coded category badges with responsive design
- **PostCard.astro**: Responsive blog post preview cards for lists with hover
  effects
- **ShareButtons.astro**: Social media sharing (Twitter, Facebook, LinkedIn)
  with proper meta tags
- **TableOfContents.astro**: Auto-generated table of contents for long posts
  with smooth scrolling
- **TagList.astro**: Tag display with consistent styling and hover effects
- **TipButton.astro**: Stripe-powered support/tip functionality with Payment
  Links integration (`PUBLIC_STRIPE_PAYMENT_LINK`)

### SEO & Performance Features

- **Structured Data**: JSON-LD for Article and BreadcrumbList schemas;
  Organization / Person come from `src/config/organization.ts` and
  `src/config/author.ts`
- **Multilingual SEO**: Proper hreflang tags and canonical URLs for 5 languages
- **Meta Tags**: Comprehensive OpenGraph and Twitter Card support
- **Sitemap**: @astrojs/sitemap, filtered by `src/config/indexing.ts` (the same
  rules as the meta robots tag); blog posts get `lastmod`
- **robots.txt**: generated by `src/pages/robots.txt.ts` (`src/config/robots.ts`)
- **Performance**: critical CSS, font optimization (Core Web Vitals field data:
  Cloudflare Web Analytics)

### Writing New Blog Posts

Add a markdown file and it appears on the site after the next build — lists,
category pages, navigation, related posts, sitemap and RSS update
automatically. Posts can also be written in the CMS
(`https://cor-jp-cms-admin.web.app/`, `docs/cms-sveltia.md`), which opens a PR
to `develop`.

1. **Create Japanese Post**: Write markdown file in `/src/content/blog/ja/your-post-name.md`
2. **Use Proper Frontmatter**:

   ```yaml
   ---
   title: "Your Post Title"
   description: "Brief description for SEO and previews"
   pubDate: 2024-01-01
   category: "ai"  # One of: "ai", "engineering", "founder", "lab"
   tags: ["tag1", "tag2", "tag3"]
   author: "Terisuke"
   lang: "ja"
   featured: true  # Optional: feature on homepage
   # image:  # Optional
   #   url: "/images/blog/your-image.avif"
   #   alt: "Image description"
   ---
   ```

3. **Check wording**: `npm run blog:check -- src/content/blog/ja/your-post-name.md`
4. **Auto-translate**: open a PR to `develop`; CI translates to en/zh/ko/es and
   commits the translations to the PR (local runs: `npm run i18n:translate`,
   see `docs/i18n-translation.md`)
5. **Build**: `npm run build` must pass (invalid frontmatter fails the build)

### Rich Content Support

#### Link Cards

Automatically generates rich preview cards for URLs:

```markdown
https://cor-jp.com/
https://github.com
```

- **Auto-fetches**: Title, description, favicon, and OG images
- **Caches**: Images saved to `/public/remark-link-card-plus/`
- **Responsive**: Adapts to light/dark themes
- **Interactive**: Hover effects and smooth animations

#### Supported Markdown Features

- **GitHub Flavored Markdown**: Tables, strikethrough, task lists
- **Math Equations**: KaTeX support for mathematical expressions
- **Syntax Highlighting**: Code blocks with Dracula theme
- **Auto-linking**: Headings with anchor links
- **Rich Typography**: @tailwindcss/typography styling

### Firebase Deployment

The site deploys to Firebase Hosting with specific caching rules defined in
`firebase.json`. Production builds are optimized for long-term caching of
assets while keeping HTML fresh. `.github/workflows/deploy.yml` deploys `main`
to production and `develop` / PRs to preview channels.

## Important Notes

- **Verify changes** with `npm run test:run` and `npm run build`; after a build
  also `npm run security:audit:dist` and `npm run test:dist`. Run
  `npm run test:visual-text` for layout/text changes and `npm run check:links`
  for public copy changes
- **Performance Goal**: Match or exceed Hiroshi Abe's website loading speed
  through aggressive optimization
- **Multilingual Workflow**:

  1. Write Japanese post in `/src/content/blog/ja/`
  2. Open a PR to `develop`; CI translates to all languages (`npm run i18n:check` verifies)
  3. Review translations for accuracy (optional)
  4. Merge; `develop` → `main` releases deploy to production
- **Environment Variables**: `GEMINI_API_KEY` is a GitHub secret for CI; for
  local translation runs pass it via `node --env-file=.env`. Public build-time
  variables (`PUBLIC_*`) are listed in `src/env.d.ts`
- **Category System**: Use exact category ids: `"ai"`, `"engineering"`,
  `"founder"`, `"lab"`
- **URL Structure**: Posts are available in all languages:
  - Japanese: `/blog/post-name/`
  - English: `/en/blog/post-name/`
  - Chinese: `/zh/blog/post-name/`
  - Korean: `/ko/blog/post-name/`
  - Spanish: `/es/blog/post-name/`

## YouTube Integration

### Random Video Player Component

**Location**: `/src/components/youtube/RandomPlayer.astro`, used by
`src/components/about/FounderNote.astro` on the About page

**Features**:

- **API Integration**: Uses YouTube Data API v3 to fetch channel videos
- **Random Selection**: Automatically selects random videos from the channel
- **Error Handling**: Shows a fallback message (from the `messages` prop) when
  the API key is missing, no videos are found or loading fails
- **View Transitions Support**: Seamless player re-initialization on page navigation
- **Loading States**: Visual feedback during video loading
- **Origin Security**: Explicit origin parameter to prevent postMessage warnings

**Environment Variables**:

```env
PUBLIC_YOUTUBE_API_KEY=your_youtube_api_key_here
```

**Target Channel**: `UCmivQ0Dndw81cLjkc9lgIOw` (Cor.Incorporated)

**Implementation**:

1. Fetches channel upload playlist via YouTube Data API
2. Retrieves up to 50 recent videos
3. Randomly selects one video per page load
4. Embeds using YouTube IFrame API with optimized settings
5. Handles View Transitions with automatic re-initialization

## About Page

`src/pages/about.astro` (and `src/pages/<lang>/about.astro`) is built from
`src/components/about/` (AboutHero, MvvSection, KyousouDefinition, WhyFocus,
FounderNote, TeamIntro). Its text lives in the `aboutPage` keys of
`src/i18n/locales/*.json`. Company facts (legal name, IDs, social links) come
from `src/config/organization.ts`; author facts from `src/config/author.ts`.

The founder section (`FounderNote.astro`, `#founder-story`) shows the
founder's profile, a timeline and the opening scene of the founder's story.
The full story is the blog post `src/content/blog/ja/founder-story.md`; About
and the top page link to it through `src/utils/founder-story.ts`, which falls
back to the ja post when a locale has no translation yet. The story and every
page follow the narrative in `docs/story-spine.md`.
