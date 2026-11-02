import { OG_FONT_FAMILY, type OgFontScript } from './og-fonts';
import { SERVICE_PAGES, getServiceOgSlug } from '../config/services';
import { getJaTranslations } from './i18n';

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
  /** 記事 slug の言語。省略時は日本語（Noto Sans JP）。 */
  script?: OgFontScript;
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
  // サービスのページ（ADR-0024）。ページ名と一言は ja の locale と同じ文言（ほかのページと同じく、画像は ja だけ）
  ...SERVICE_PAGES.map((page) => ({
    slug: getServiceOgSlug(page),
    title: getJaTranslations().nav[page.key],
    subtitle: getJaTranslations().servicePages[page.key].catch,
  })),
];

const TEXT_X = 60;
const TEXT_MAX_WIDTH = 1080;
const TITLE_FONT_SIZE = 48;
const TITLE_LINE_HEIGHT = 64;
const TITLE_BASELINE = 210;
const DESCRIPTION_FONT_SIZE = 24;
const DESCRIPTION_LINE_HEIGHT = 36;
const AUTHOR_BASELINE = 548;

const xmlEscape = (str: string) =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const truncate = (str: string, maxLength: number) =>
  str.length > maxLength ? `${str.substring(0, maxLength)}...` : str;

function isFullWidth(codePoint: number) {
  return (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    (codePoint >= 0x2e80 && codePoint <= 0x9fff) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe10 && codePoint <= 0xfe6f) ||
    (codePoint >= 0xff01 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
    codePoint >= 0x1f000
  );
}

// Noto Sans CJK（JP / SC / KR でラテンの幅は同じ）の U+0020..U+007E。単位は em の 1000 分の 1。
const BOLD_ASCII_EM = [
  227, 370, 574, 590, 590, 963, 740, 325, 378, 378, 507, 590, 325, 370, 325, 387, 590, 590, 590,
  590, 590, 590, 590, 590, 590, 590, 325, 325, 590, 590, 590, 514, 1007, 641, 681, 656, 714, 615,
  585, 717, 757, 330, 568, 686, 578, 853, 749, 770, 667, 770, 682, 624, 625, 748, 619, 915, 627,
  580, 613, 378, 387, 378, 590, 567, 626, 591, 644, 527, 644, 581, 372, 597, 640, 304, 306, 604,
  315, 964, 641, 626, 644, 644, 436, 495, 421, 637, 576, 863, 562, 574, 511, 378, 296, 378, 590,
];
const REGULAR_ASCII_EM = [
  224, 323, 474, 555, 555, 921, 680, 278, 338, 338, 467, 555, 278, 347, 278, 392, 555, 555, 555,
  555, 555, 555, 555, 555, 555, 555, 278, 278, 555, 555, 555, 474, 946, 608, 657, 638, 688, 589,
  552, 689, 728, 293, 535, 646, 543, 812, 723, 742, 633, 742, 635, 596, 599, 721, 575, 878, 573,
  531, 603, 338, 392, 338, 555, 559, 606, 563, 618, 510, 620, 554, 325, 564, 607, 275, 275, 552,
  284, 926, 610, 606, 620, 620, 388, 468, 377, 607, 521, 802, 498, 521, 475, 338, 270, 338, 555,
];

/** 全角は 1em。ASCII は同梱フォントの字幅。それ以外は 1em とみて、はみ出さない側に倒す。 */
export function estimateOgCharWidth(char: string, fontSize: number, bold: boolean) {
  const codePoint = char.codePointAt(0) ?? 0;
  if (codePoint >= 32 && codePoint <= 126) {
    const thousandths = (bold ? BOLD_ASCII_EM : REGULAR_ASCII_EM)[codePoint - 32] ?? 1000;
    return (fontSize * thousandths) / 1000;
  }
  if (codePoint === 0x00a0) return fontSize * 0.25;
  return fontSize;
}

export function ogTextWidth(text: string, fontSize: number, bold: boolean) {
  let width = 0;
  for (const char of text) {
    width += estimateOgCharWidth(char, fontSize, bold);
  }
  return width;
}

function tokenizeOgText(text: string) {
  const tokens: string[] = [];
  let latin = '';
  const flushLatin = () => {
    if (!latin) return;
    tokens.push(latin);
    latin = '';
  };

  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (char === ' ' || char === '\u00a0') {
      flushLatin();
      tokens.push(char);
      continue;
    }
    if (isFullWidth(codePoint)) {
      flushLatin();
      tokens.push(char);
      continue;
    }
    latin += char;
  }
  flushLatin();
  return tokens;
}

const PREFERRED_BREAK_CHARS = new Set([
  '。',
  '！',
  '？',
  '、',
  '・',
  '.',
  '!',
  '?',
  ';',
  ':',
  '；',
]);

function preferredBreakEnd(text: string) {
  let end = 0;
  let index = 0;
  for (const char of text) {
    index += char.length;
    if (PREFERRED_BREAK_CHARS.has(char)) end = index;
  }
  return end;
}

/** 1行に収まらない題と説明を折り返す。句点があれば、そこで行を切る。 */
export function wrapOgText(
  text: string,
  maxWidth: number,
  fontSize: number,
  bold: boolean,
  maxLines = 4
) {
  const tokens = tokenizeOgText(text);
  const lines: string[] = [];
  let current = '';
  let width = 0;

  const commit = () => {
    const trimmed = current.trimEnd();
    if (trimmed) lines.push(trimmed);
    current = '';
    width = 0;
  };

  const breakBefore = (nextWidth: number) => {
    if (!current || width + nextWidth <= maxWidth) return;
    const breakEnd = preferredBreakEnd(current);
    const head = breakEnd > 0 ? current.slice(0, breakEnd).trimEnd() : '';
    if (head && breakEnd < current.length && ogTextWidth(head, fontSize, bold) >= maxWidth * 0.45) {
      lines.push(head);
      current = current.slice(breakEnd).trimStart();
      width = ogTextWidth(current, fontSize, bold);
    } else {
      commit();
    }
    if (current && width + nextWidth > maxWidth) commit();
  };

  for (const token of tokens) {
    const tokenWidth = ogTextWidth(token, fontSize, bold);
    breakBefore(tokenWidth);
    if (!current && token.trim() === '') continue;

    if (tokenWidth > maxWidth && [...token].length > 1) {
      for (const char of token) {
        const charWidth = estimateOgCharWidth(char, fontSize, bold);
        breakBefore(charWidth);
        current += char;
        width += charWidth;
      }
      continue;
    }

    current += token;
    width += tokenWidth;
  }
  commit();

  if (lines.length <= maxLines) return lines;

  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1] ?? '';
  const ellipsis = '...';
  while (last && ogTextWidth(last + ellipsis, fontSize, bold) > maxWidth) {
    last = last.slice(0, -1);
  }
  kept[maxLines - 1] = `${last.trimEnd()}${ellipsis}`;
  return kept;
}

function svgText(lines: string[], x: number, firstY: number, lineHeight: number, attrs: string) {
  if (lines.length === 0) return '';
  const spans = lines
    .map((line, index) => {
      const position = index === 0 ? `y="${firstY}"` : `dy="${lineHeight}"`;
      return `<tspan x="${x}" ${position}>${xmlEscape(line)}</tspan>`;
    })
    .join('');
  return `<text ${attrs}>${spans}</text>`;
}

export function buildBlogOgSvg({
  title,
  description = '',
  category,
  author,
  script = 'jp',
}: BlogOgInput) {
  const family = OG_FONT_FAMILY[script];
  const safeCategory = xmlEscape(truncate(category.toUpperCase(), 16));
  const safeAuthor = xmlEscape(author);
  const titleLines = wrapOgText(truncate(title, 50), TEXT_MAX_WIDTH, TITLE_FONT_SIZE, true, 3);
  const descriptionLines = wrapOgText(
    truncate(description, 100),
    TEXT_MAX_WIDTH,
    DESCRIPTION_FONT_SIZE,
    false,
    3
  );
  const descriptionBaseline = TITLE_BASELINE + titleLines.length * TITLE_LINE_HEIGHT + 8;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="footer" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#3B82F6"/>
      <stop offset="100%" stop-color="#6366F1"/>
    </linearGradient>
  </defs>
  <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="#F5F5F4"/>
  <rect x="0" y="0" width="${OG_IMAGE_WIDTH}" height="120" fill="#1C1917"/>
  <rect x="60" y="36" width="48" height="48" rx="8" fill="#3B82F6"/>
  <text x="84" y="66" text-anchor="middle" font-family="${family}" font-size="16" font-weight="400" fill="#ffffff">C</text>
  <text x="128" y="70" font-family="${family}" font-size="28" font-weight="400" fill="#ffffff">Cor.inc</text>
  <rect x="1020" y="45" width="120" height="30" rx="15" fill="#3B82F6"/>
  <text x="1080" y="65" text-anchor="middle" font-family="${family}" font-size="16" font-weight="400" fill="#ffffff">${safeCategory}</text>
  ${svgText(
    titleLines,
    TEXT_X,
    TITLE_BASELINE,
    TITLE_LINE_HEIGHT,
    `font-family="${family}" font-size="${TITLE_FONT_SIZE}" font-weight="700" fill="#1C1917"`
  )}
  ${svgText(
    descriptionLines,
    TEXT_X,
    descriptionBaseline,
    DESCRIPTION_LINE_HEIGHT,
    `font-family="${family}" font-size="${DESCRIPTION_FONT_SIZE}" font-weight="400" fill="#57534E"`
  )}
  <text x="${TEXT_X}" y="${AUTHOR_BASELINE}" font-family="${family}" font-size="20" font-weight="400" fill="#78716C">By ${safeAuthor} • cor-jp.com</text>
  <rect x="0" y="622" width="${OG_IMAGE_WIDTH}" height="8" fill="url(#footer)"/>
</svg>`;
}

export function buildPageOgSvg({ title, subtitle }: OgPage) {
  const family = OG_FONT_FAMILY.jp;
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
  <text x="80" y="120" font-family="${family}" font-size="34" font-weight="700" fill="#ffffff">Cor.inc</text>
  <text x="80" y="160" font-family="${family}" font-size="20" fill="#94a3b8">cor-jp.com ・ 福岡発・全国対応</text>
  <text x="80" y="340" font-family="${family}" font-size="64" font-weight="700" fill="#ffffff">${safeTitle}</text>
  <text x="80" y="420" font-family="${family}" font-size="30" fill="#cbd5e1">${safeSubtitle}</text>
  <rect x="80" y="500" width="120" height="6" rx="3" fill="url(#accent)"/>
</svg>`;
}
