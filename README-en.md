# Cor.inc Corporate Website

A corporate website with extreme loading speed optimization. Achieves loading speeds equal to or faster than Hiroshi Abe's homepage. Features an integrated AI-driven blog system with automated Japanese to English, Chinese, Korean, and Spanish translation.

## 🚀 Demo

- Production: <https://corweb.co.jp/>
- Staging: <https://cor-jp.com/>

## 📊 Performance Metrics

- **First Contentful Paint (FCP)**: < 0.5s
- **Largest Contentful Paint (LCP)**: < 1.0s
- **Total Blocking Time (TBT)**: 0ms
- **Cumulative Layout Shift (CLS)**: 0
- **Speed Index**: < 1.0s

## 🏗️ Tech Stack

- **Framework**: Astro 4.8.7 (Islands Architecture)
- **Interactivity**: Alpine.js 3.14 (bundled from npm, no CDN dependency)
- **Styling**: Tailwind CSS + @tailwindcss/typography
- **Hosting**: Firebase Hosting
- **Language**: TypeScript
- **i18n**: 5 language support (Japanese, English, Chinese, Korean, Spanish)
- **AI Translation**: Google Generative AI (Gemini 1.5 Flash)
- **Content Management**: Astro Content Collections with Zod
- **YouTube Integration**: YouTube Data API v3 for dynamic video content

## 🤖 New Feature: AI-Driven Blog System

### Automated Translation
- **Japanese → 4 Languages**: High-quality automated translation to English, Chinese, Korean, and Spanish using Gemini API
- **Simultaneous Translation**: Support for translating to all languages at once
- **Batch Processing**: Support for bulk translation of all articles
- **Metadata Preservation**: Complete preservation of frontmatter and markdown structure

### Blog Features
- **Content Collections**: Type-safe content management
- **SEO Optimization**: Auto-generated OGP images, structured data
- **Rich Markdown**: Math equations (KaTeX), code highlighting, automatic link cards
- **Interactive Features**: Table of contents, share buttons, tip functionality
- **Tip System**: Secure tip functionality via Stripe Payment Link (flexible amount)

### Translation Commands

```bash
# Translate single article to all 4 languages
node scripts/translate-blog-all-languages.js src/content/blog/ja/your-post.md

# Translate single article to specific language
node scripts/translate-blog-multi.js zh src/content/blog/ja/your-post.md
# Language options: en (English), zh (Chinese), ko (Korean), es (Spanish)

# Translate to English only (legacy)
node scripts/translate-blog.js src/content/blog/ja/your-post.md

# Bulk translate all articles to English (legacy)
node scripts/translate-all-blog.js

# Environment variable required
# Set GEMINI_API_KEY in .env file
```

## ⚡ Performance Optimization Details

### 1. Image Optimization
- **AVIF Format**: Adopted AVIF format with even higher compression than WebP
- **Responsive Images**: Multiple sizes prepared (e.g., hero-480w.avif, hero-800w.avif)
- **Lazy Loading**: Images outside viewport are lazy loaded
- **Image Compression**: Additional compression with astro-compress (60% average reduction)

### 2. Asset Delivery Optimization
- **Self-hosted**: Alpine.js is bundled from npm and served from the same origin (a blocked or slow CDN can no longer blank the page)
- **DNS Prefetch**: Pre-resolve DNS for external resources
  ```html
  <link rel="dns-prefetch" href="//fonts.gstatic.com">
  <link rel="dns-prefetch" href="//ssgform.com">
  ```
- **Long-term Cache**: Static assets cached for 1 year in Firebase configuration

### 3. JavaScript Optimization
- **Islands Architecture**: Astro's partial hydration
- **Deferred Execution**: Alpine.js runs as a module script (deferred). `<html>` has no x-cloak, so content renders before Alpine starts
- **Inline Initialization**: Dark mode settings execute inline in `<head>` (prevents flicker; re-applied after View Transitions)
- **Minimal Bundle**: Lightweight implementation with only necessary features

### 4. CSS Optimization
- **Critical CSS**: Essential CSS for initial display is inlined
- **Font Display**: `font-display: optional` prevents font loading from blocking
- **System Fonts**: Initial display uses system fonts, switches after Inter loads
- **Tailwind CSS**: Only used classes extracted at build time

### 5. HTML/Content Optimization
- **HTML Compression**: Remove unnecessary whitespace with astro-compress (10% average reduction)
- **Gzip/Brotli Compression**: All assets compressed with astro-compressor
- **View Transitions API**: Smooth page transitions with prefetching

### 6. Build-time Optimization
- **Static Site Generation**: All pages pre-built
- **TypeScript Type Checking**: Type safety guaranteed at build time
- **Bundle Analysis**: Detect and remove unnecessary code with bundle-analyzer.js

### 7. SEO Optimization
- **Structured Data**: Provide company information with JSON-LD (including company name variations)
- **Meta Tag Optimization**: Open Graph, Twitter Card support
- **Automatic Sitemap Generation**: Search engine optimization with @astrojs/sitemap
- **Multilingual Support**: SEO optimization for 5 languages (Japanese, English, Chinese, Korean, Spanish)
- **Blog SEO**: Automatic OGP images, hreflang tags, breadcrumb lists

## 🛠️ Development Environment

```bash
# Start development server
npm run dev

# Build (including type checking)
npm run build

# Production preview
npm run preview

# Bundle analysis
node bundle-analyzer.js

# Blog translation to all languages
node scripts/translate-blog-all-languages.js src/content/blog/ja/your-post.md
# Translation to specific language
node scripts/translate-blog-multi.js zh src/content/blog/ja/your-post.md
```

### Environment Variable Configuration

```bash
# Set the following in .env file
GEMINI_API_KEY=your_gemini_api_key_here              # Gemini API key (for blog auto-translation)
PUBLIC_STRIPE_PAYMENT_LINK=your_stripe_payment_link_here  # Stripe Payment Link URL (for tip functionality)
PUBLIC_YOUTUBE_API_KEY=your_youtube_api_key_here     # YouTube Data API v3 key (for random video display)
```

## 📁 Project Structure

```
src/
├── components/       # Page and feature-specific components
│   ├── blog/        # Blog-specific components
│   ├── home/        # Homepage components
│   ├── layout/      # Shared layouts
│   ├── performance/ # Performance monitoring
│   ├── products/    # Product showcase components
│   └── youtube/     # YouTube API integration components
├── content/         # Content collections
│   └── blog/
│       ├── ja/      # Japanese blog posts (source)
│       ├── en/      # English blog posts (auto-translated)
│       ├── zh/      # Chinese blog posts (auto-translated)
│       ├── ko/      # Korean blog posts (auto-translated)
│       └── es/      # Spanish blog posts (auto-translated)
├── i18n/           # Internationalization files
├── layouts/        # Layout components
├── pages/          # Routing pages
├── utils/          # Utility functions
└── types/          # TypeScript type definitions

scripts/            # Automation scripts
├── translate-blog-all-languages.js  # Single article to all 4 languages
├── translate-blog-multi.js         # Single article to specified language
├── translate-blog.js               # Single article to English (legacy)
└── translate-all-blog.js          # Bulk articles to English (legacy)
```

## 📝 Blog Posting Workflow

1. **Create Japanese Article**: Create Markdown file in `/src/content/blog/ja/`
2. **Utilize Rich Content**: Use link cards, math equations, code highlighting
3. **Run Auto-translation**: Generate all 4 language versions with `node scripts/translate-blog-all-languages.js`
4. **Review Content**: Check and adjust translated articles in each language (optional)
5. **Deploy**: Auto-deploy to Firebase Hosting

## ✨ Supported Markdown Features

### Basic Syntax
- **GitHub Flavored Markdown**: Tables, strikethrough, task lists
- **Code Highlighting**: 30+ languages supported (Dracula theme)
- **Math Display**: LaTeX notation support via KaTeX

### Rich Link Cards
```markdown
https://cor-jp.com/
https://github.com
```
- **Auto-fetch Metadata**: Automatically fetches title, description, OG images
- **Cache Feature**: Locally saved to `/public/remark-link-card-plus/`
- **Responsive Design**: Supports both desktop and mobile
- **Dark Mode Support**: Automatically follows theme switching

### YouTube Integration
- **Dynamic Content**: Random video display via YouTube Data API v3
- **Channel Integration**: Connected to Cor.Incorporated official channel
- **Auto-updates**: New videos automatically added to display candidates

### Advanced Features
- **Automatic Table of Contents**: Auto-generated from heading structure
- **Anchor Links**: Automatically adds link anchors to headings
- **Structured Data**: Auto-generates JSON-LD for SEO
- **OGP Images**: Dynamic SVG image generation per article

## 🎯 Future Improvements

- Service Worker for offline support
- Additional optimization of Resource Hints
- Improved image Lazy Loading strategy
- Enhanced Web Vitals monitoring
- Further improvement of translation accuracy
- Blog management UI/CMS implementation
- Tip history management feature
- Special content for tip supporters

## 📚 References

- [Astro Documentation](https://astro.build/)
- [Alpine.js Documentation](https://alpinejs.dev/)
- [Firebase Hosting](https://firebase.google.com/)
- [Web.dev Performance](https://web.dev/performance/)
- [Google Generative AI](https://ai.google.dev/)
- [Hiroshi Abe's Homepage](http://abehiroshi.la.coocan.jp/)

## 📝 License

MIT License