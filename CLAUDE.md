# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working
with code in this repository.

## Project Overview

This is a high-performance corporate website for Cor.inc built with Astro
4.8.7, focusing on extreme loading speed optimization. The site features
multilingual content (Japanese, English, Chinese, Korean, Spanish) and showcases
services in Python data analysis, web/mobile development, and machine learning
solutions. The project includes an integrated blog system with AI-powered automated
translation capabilities.

## Development Commands

```bash
npm run dev      # Start development server on localhost:4321
npm run build    # Type check and build for production
npm run preview  # Preview production build locally
```

## Architecture & Key Patterns

### Tech Stack

- **Framework**: Astro 4.8.7 with Islands Architecture (selective hydration)
- **Interactivity**: Alpine.js 3.14.0 loaded from CDN
- **Styling**: Tailwind CSS with stone color palette as primary,
  @tailwindcss/typography for blog content
- **TypeScript**: Custom Alpine.js type definitions in `/types/types.d.ts`
- **AI Translation**: Gemini API (`@google/genai`, default `gemini-3.8-flash`)
  run in CI for incremental content translation (ADR-0019)
- **Content Management**: Astro Content Collections with Zod schema validation

### Component Structure

Components are organized by feature under `/src/components/`:

- `home/`, `about/`, `contact/`, `products/` - Page-specific components
- `layout/` - Shared Header and Footer components
- `blog/` - Blog-specific components (CategoryBadge, PostCard, ShareButtons,
  TableOfContents, TagList, TipButton)
- `performance/` - WebVitals monitoring component

Pages use a consistent pattern:

1. Import Layout.astro wrapper
2. Import page-specific components
3. Use Alpine.js for interactivity via x-data directives

### Performance Optimizations

- All images use AVIF format with WebP fallbacks
- Multiple responsive image sizes (e.g., hero-480w.avif, hero-800w.avif)
- Aggressive compression via astro-compress and astro-compressor plugins
- Firebase hosting with 1-year cache headers for assets
- View Transitions API enabled for smooth navigation
- Web Vitals monitoring and performance tracking
- Critical CSS inlining for above-the-fold content
- Font optimization with font-display: optional

### Alpine.js Integration

Alpine.js is loaded from CDN with custom TypeScript support:

```typescript
// Global stores accessible via Alpine.store()
Alpine.store('theme', { isDark: boolean, toggle: function })
Alpine.store('lang', { current: string, toggle: function })
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
- **Interactive Features**: Category filtering, related posts, table of
  contents, share buttons
- **Monetization**: Stripe-powered tip/support functionality
- **Performance**: Optimized with same caching strategies as main site

### Content Structure

```text
src/content/
├── blog/
│   ├── ja/          # Japanese blog posts (source)
│   │   ├── post-1.md
│   │   └── post-2.md
│   ├── en/          # English blog posts (auto-translated)
│   │   ├── post-1.md
│   │   └── post-2.md
│   ├── zh/          # Chinese blog posts (auto-translated)
│   │   ├── post-1.md
│   │   └── post-2.md
│   ├── ko/          # Korean blog posts (auto-translated)
│   │   ├── post-1.md
│   │   └── post-2.md
│   └── es/          # Spanish blog posts (auto-translated)
│       ├── post-1.md
│       └── post-2.md
├── config.ts        # Content collection schemas
└── content_backup/  # Backup of old content (can be removed)
```

### Blog Schema (Zod)

```typescript
const blogCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.string().default('Terisuke'),
    category: z.enum([
      'ai-driven-futures',
      'high-performance-engineering', 
      'founders-journey',
      'tech-lab-creativity'
    ]),
    tags: z.array(z.string()).default([]),
    image: z.object({
      url: z.string(),
      alt: z.string()
    }).optional(),
    ogImage: z.string().optional(),
    isDraft: z.boolean().default(false),
    featured: z.boolean().default(false),
    lang: z.enum(['ja', 'en', 'zh', 'ko', 'es']).default('ja'),
    readingTime: z.number().optional(),
  }),
});
```

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
  and image paths are replaced by placeholders and restored exactly
- **Validation**: heading / code block / link / image / table parity,
  untranslated-Japanese detection and a Zod mirror of `src/content/config.ts`
  (linked by a test); a translation that fails any check is never written
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

#### Japanese Blog

- **List Page**: `/blog/` → `src/pages/blog/[...page].astro`
- **Post Page**: `/blog/[slug]` → `src/pages/blog/[...slug].astro`
- **Category Pages**: `/blog/category/[category]/` →
  `src/pages/blog/category/[category]/[...page].astro`

#### English Blog

- **List Page**: `/en/blog/` → `src/pages/en/blog/[...page].astro`
- **Post Page**: `/en/blog/[slug]` → `src/pages/en/blog/[...slug].astro`
- **Category Pages**: `/en/blog/category/[category]/` →
  `src/pages/en/blog/category/[category]/[...page].astro`

#### Chinese Blog

- **List Page**: `/zh/blog/` → `src/pages/zh/blog/[...page].astro`
- **Post Page**: `/zh/blog/[slug]` → `src/pages/zh/blog/[...slug].astro`
- **Category Pages**: `/zh/blog/category/[category]/` →
  `src/pages/zh/blog/category/[category]/[...page].astro`

#### Korean Blog

- **List Page**: `/ko/blog/` → `src/pages/ko/blog/[...page].astro`
- **Post Page**: `/ko/blog/[slug]` → `src/pages/ko/blog/[...slug].astro`
- **Category Pages**: `/ko/blog/category/[category]/` →
  `src/pages/ko/blog/category/[category]/[...page].astro`

#### Spanish Blog

- **List Page**: `/es/blog/` → `src/pages/es/blog/[...page].astro`
- **Post Page**: `/es/blog/[slug]` → `src/pages/es/blog/[...slug].astro`
- **Category Pages**: `/es/blog/category/[category]/` →
  `src/pages/es/blog/category/[category]/[...page].astro`

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
  - Enhanced SEO with structured data (Article, BreadcrumbList)
  - Auto-generated OGP images at `/og/[slug].svg`
  - Multilingual hreflang tags (5 languages)
  - KaTeX CSS for math rendering
  - Performance optimizations (critical CSS, Web Vitals)

### Blog Components

- **CategoryBadge.astro**: Color-coded category badges with responsive design
- **PostCard.astro**: Responsive blog post preview cards for lists with hover
  effects
- **ShareButtons.astro**: Social media sharing (Twitter, Facebook, LinkedIn)
  with proper meta tags
- **TableOfContents.astro**: Auto-generated table of contents for long posts
  with smooth scrolling
- **TagList.astro**: Tag display with consistent styling and hover effects
- **TipButton.astro**: Stripe-powered support/tip functionality with Payment
  Links integration

### Navigation Features

- **Previous/Next Posts**: Automatic chronological navigation between posts
- **Related Posts**: Dynamic display of same-category posts (max 3)
- **Category Filtering**: Dedicated pages for each category with pagination
- **Multilingual Support**: Separate navigation for all 5 languages:
  - Japanese (`/blog/`)
  - English (`/en/blog/`)
  - Chinese (`/zh/blog/`)
  - Korean (`/ko/blog/`)
  - Spanish (`/es/blog/`)
- **Responsive Design**: Mobile-first approach with touch-friendly navigation
- **SEO**: Proper canonical URLs and hreflang tags for all navigation links

### SEO & Performance Features

- **Auto-generated OGP Images**: Dynamic SVG generation at
  `/og/[slug].svg.ts`
- **Structured Data**: JSON-LD for Article and BreadcrumbList schemas
- **Multilingual SEO**: Proper hreflang tags and canonical URLs for 5 languages
- **Meta Tags**: Comprehensive OpenGraph and Twitter Card support
- **Sitemap**: Auto-generated with @astrojs/sitemap
- **Performance**: Web Vitals tracking, critical CSS, font optimization

### Writing New Blog Posts

**✅ FULLY AUTOMATED SYSTEM**
The blog system now uses Astro Content Collections throughout, providing
complete automation for blog post management. Simply add markdown files and
they'll automatically appear on the site.

#### **Step-by-Step Process**

1. **Create Japanese Post**: Write markdown file in `/src/content/blog/ja/your-post-name.md`
2. **Use Proper Frontmatter**:

   ```yaml
   ---
   title: "Your Post Title"
   description: "Brief description for SEO and previews"
   pubDate: 2024-01-01
   category: "ai"  # Options: "ai", "engineering", "founder", "lab"
   tags: ["tag1", "tag2", "tag3"]
   author: "Terisuke"
   lang: "ja"
   featured: true  # Optional: feature on homepage
   # image:  # Optional - currently commented out
   #   url: "/images/blog/your-image.avif"
   #   alt: "Image description"
   ---
   ```

3. **Auto-translate**: open a PR; CI translates to en/zh/ko/es and commits the
   translations to the PR (local runs: `npm run i18n:translate`, see
   `docs/i18n-translation.md`)
4. **Build & Deploy**: Run `npm run build` - the post automatically appears

#### **Automatic Features**

- **✅ Automatic HTML Generation**: Markdown → `/blog/your-post-name/index.html`
- **✅ Auto-updating Navigation**: Previous/Next links automatically
  recalculate
- **✅ Dynamic Related Posts**: Same-category posts automatically linked
- **✅ SEO Generation**: OGP images, meta tags, structured data
  auto-generated
- **✅ Sitemap Integration**: New posts automatically added to sitemap
- **✅ RSS Feed Updates**: All 5 language RSS feeds auto-update (ja, en, zh, ko, es)
- **✅ Category Pages**: Posts automatically appear in category listings
- **✅ Reading Time Calculation**: Dynamically calculated from content length

#### **Content Collections Benefits**

- **Type Safety**: Zod schema validation at build time
- **Hot Reloading**: Changes appear instantly in development
- **Build Optimization**: Only builds when content actually changes
- **Error Detection**: Invalid frontmatter caught during build
- **Performance**: Static generation with optimal caching

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
assets while keeping HTML fresh. Blog OGP images (SVG) are cached with
immutable headers.

## Important Notes

- **No test framework configured** - verify changes manually with
  `npm run build` and `npm run dev`
- **Content Collections**: All blog functionality now uses Astro Content
  Collections for type safety and performance
- **Automatic Features**: Posts, navigation, and related content update
  automatically - no manual configuration needed
- **Image Management**: Images currently commented out in frontmatter -
  uncomment `image:` section when adding images
- **Performance Goal**: Match or exceed Hiroshi Abe's website loading speed
  through aggressive optimization
- **Multilingual Workflow**:

  1. Write Japanese post in `/src/content/blog/ja/`
  2. Open a PR; CI translates to all languages (`npm run i18n:check` verifies)
  3. Review translations for accuracy (optional)
  4. Deploy with `npm run build`
- **Environment Variables**: `GEMINI_API_KEY` is a GitHub secret for CI; for
  local translation runs pass it via `node --env-file=.env`
- **Category System**: Use exact category names: `"ai"`, `"engineering"`,
  `"founder"`, `"lab"`
- **URL Structure**: Posts are available in all languages:
  - Japanese: `/blog/post-name/`
  - English: `/en/blog/post-name/`
  - Chinese: `/zh/blog/post-name/`
  - Korean: `/ko/blog/post-name/`
  - Spanish: `/es/blog/post-name/`

## Product & Service Names

### Current Product Portfolio

The site features three main product lines with updated branding:

1. **TapForge** - NFC Smart Business Cards
   - Previous name: NFCデジタル名刺作成
   - Description: Next-gen business networking with just a tap
   - Pricing: ¥3,000 initial cost, ¥500/additional card

2. **BoltSite** - Ultra-Fast Website Development
   - Previous name: 高性能ホームページ制作
   - Description: Lightning-fast 0.3s loading with perfect SEO scores
   - Features: Astro 4.8.7, SSG architecture, CDN optimization
   - Pricing: ¥15,000-50,000+/month

3. **IoTRealm** - AI/IoT Integration Platform
   - Previous name: AI・IoTソリューション開発
   - Description: Bridging digital innovation with physical reality
   - Pricing: ¥1M-5M+ for development, ¥100K+/month maintenance

## YouTube Integration

### Random Video Player Component

The site includes a sophisticated YouTube integration system:

**Location**: `/src/components/youtube/RandomPlayer.astro`

**Features**:

- **API Integration**: Uses YouTube Data API v3 to fetch channel videos
- **Random Selection**: Automatically selects random videos from the channel
- **Error Handling**: Comprehensive error management and fallbacks
- **Performance**: Optimized loading with proper iframe attributes
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
6. Preloads YouTube API for faster initialization on navigation

**Usage**: Integrated into ProductsTable.astro for dynamic video content
display

**Recent Improvements**:

- Fixed postMessage origin warnings
- Added View Transitions API support for smooth navigation
- Implemented loading states for better UX
- Optimized initialization timing
- Added prefetch strategy adjustments

## Image Optimization

### Team Member Images

- **Format**: AVIF for optimal compression and quality
- **Sizing**: Standardized to 400x400px for consistency
- **Processing**: Automatic cropping and centering for profile images
- **Performance**: Significant file size reduction (80%+ compression)

### Image Pipeline

- Original images stored in PNG format for editing
- AVIF conversion for web delivery
- Responsive sizing with proper aspect ratios
- Automatic optimization via Astro's built-in image processing

## Team Component

### Team Member Display Pattern

The Team component (`/src/components/about/Team.astro`) follows a unified design pattern for displaying team member profiles:

**Icon Link Strategy**:
- **Priority System**: `zennLink` takes precedence over `link` when both are available
- **Consistent UX**: All team members have clickable profile icons, no separate text links
- **Simplified Design**: Removed per-member link lists below profiles for visual consistency

**Link Priority Logic**:
```typescript
function getIconLink(item) {
  return item.zennLink || item.link || null;
}
```

**Team Data Structure** (in `i18n.ts`):
- `link`: Primary profile link (e.g., TapForge profile, personal website)
- `zennLink`: Zenn profile link (takes priority for icon linking)
- Icon automatically uses `zennLink` if available, otherwise falls back to `link`

**Current Team Setup**:
- **Kousuke Terada (CEO)**: Icon links to TapForge profile
- **Cloudia Sorano (AI Ambassador)**: Icon links to Zenn profile (prioritized over X/Twitter)
- **Nagisa Terada (Staff)**: Icon links to personal website

This approach ensures a clean, uniform presentation across all team members while maintaining flexibility for different profile link types.

## External Media Integration

### Media Section Updates

- **Title**: Changed from "メディア紹介" to "外部メディア" (External Media)
- **Layout**: Center-aligned components for better visual hierarchy
- **Responsive**: Mobile-first design with proper spacing

### External Media Component Structure

- Note articles displayed in centered card layout
- YouTube content in dedicated full-width section
- Proper semantic HTML with accessibility considerations
