export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

export interface OgPage {
  slug: string;
  title: string;
  subtitle: string;
}

export interface BlogOgInput {
  title: string;
  description?: string;
  category: string;
  author: string;
}

export const OG_PAGES: OgPage[] = [
  {
    slug: 'home',
    title: 'AIを、安心して使える形で現場へ。',
    subtitle: 'ローカルLLM・Grift・AI受託開発・教育と地域',
  },
  { slug: 'about', title: 'Cor.株式会社について', subtitle: '「きょうそう」を追い続ける' },
  { slug: 'company', title: '会社概要', subtitle: '福岡のAI実装会社・Cor.株式会社' },
  {
    slug: 'works',
    title: '実績・事例',
    subtitle: 'AI受託開発・基幹DB移行・多言語AI受付・建築AI・Grift',
  },
  { slug: 'news', title: 'ニュース', subtitle: 'Cor.株式会社からのお知らせ・更新情報' },
  {
    slug: 'security',
    title: 'セキュリティ',
    subtitle: 'ローカルファースト・機密度ティア・ISMS運用',
  },
  { slug: 'contact', title: 'お問い合わせ', subtitle: 'ご相談・お見積もりはお気軽に' },
  { slug: 'privacy', title: 'プライバシーポリシー', subtitle: '個人情報保護方針' },
];

const PAGE_FONT_STACK =
  "'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'Yu Gothic', Meiryo, sans-serif";

const xmlEscape = (str: string) =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const truncate = (str: string, maxLength: number) =>
  str.length > maxLength ? `${str.substring(0, maxLength)}...` : str;

export function buildBlogOgSvg({ title, description = '', category, author }: BlogOgInput) {
  const safeTitle = xmlEscape(truncate(title, 50));
  const safeDescription = xmlEscape(truncate(description, 100));
  const safeCategory = xmlEscape(truncate(category.toUpperCase(), 16));
  const safeAuthor = xmlEscape(author);

  return `
    <svg width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          .title { font: bold 48px Arial, sans-serif; fill: #1C1917; }
          .description { font: 24px Arial, sans-serif; fill: #57534E; }
          .author { font: 20px Arial, sans-serif; fill: #78716C; }
          .category { font: 16px Arial, sans-serif; fill: white; }
        </style>
      </defs>

      <!-- Background -->
      <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="#F5F5F4"/>

      <!-- Header -->
      <rect x="0" y="0" width="${OG_IMAGE_WIDTH}" height="120" fill="#1C1917"/>

      <!-- Logo -->
      <rect x="60" y="36" width="48" height="48" rx="8" fill="#3B82F6"/>
      <text x="84" y="66" text-anchor="middle" class="category">C</text>

      <!-- Brand -->
      <text x="128" y="70" class="category" style="font-size: 28px;">Cor.inc</text>

      <!-- Category -->
      <rect x="1020" y="45" width="120" height="30" rx="15" fill="#3B82F6"/>
      <text x="1080" y="65" text-anchor="middle" class="category">${safeCategory}</text>

      <!-- Title -->
      <text x="60" y="220" class="title">${safeTitle}</text>

      <!-- Description -->
      <text x="60" y="280" class="description">${safeDescription}</text>

      <!-- Author -->
      <text x="60" y="520" class="author">By ${safeAuthor} • cor-jp.com</text>

      <!-- Footer gradient -->
      <rect x="0" y="622" width="${OG_IMAGE_WIDTH}" height="8" fill="url(#gradient)"/>

      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#3B82F6"/>
          <stop offset="100%" style="stop-color:#6366F1"/>
        </linearGradient>
      </defs>
    </svg>
  `;
}

export function buildPageOgSvg({ title, subtitle }: OgPage) {
  const safeTitle = xmlEscape(title);
  const safeSubtitle = xmlEscape(subtitle);

  return `<svg width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#3B82F6"/>
      <stop offset="100%" stop-color="#6366F1"/>
    </linearGradient>
  </defs>
  <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="url(#bg)"/>
  <rect x="0" y="0" width="${OG_IMAGE_WIDTH}" height="10" fill="url(#accent)"/>
  <text x="80" y="120" font-family="${PAGE_FONT_STACK}" font-size="34" font-weight="700" fill="#ffffff">Cor.inc</text>
  <text x="80" y="160" font-family="${PAGE_FONT_STACK}" font-size="20" fill="#94a3b8">cor-jp.com ・ 福岡発・全国対応</text>
  <text x="80" y="340" font-family="${PAGE_FONT_STACK}" font-size="64" font-weight="700" fill="#ffffff">${safeTitle}</text>
  <text x="80" y="420" font-family="${PAGE_FONT_STACK}" font-size="30" fill="#cbd5e1">${safeSubtitle}</text>
  <rect x="80" y="500" width="120" height="6" rx="3" fill="url(#accent)"/>
</svg>`;
}
