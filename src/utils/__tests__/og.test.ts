import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { ogFontDirectory, ogFontFiles, ogFontScriptForSlug } from '../og-fonts';
import { createPngResponse, renderOgPng } from '../og-png';
import {
  buildBlogOgSvg,
  buildPageOgSvg,
  estimateOgCharWidth,
  ogTextWidth,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  OG_PAGES,
  wrapOgText,
} from '../og-svg';

// フォントを読んで 1200x630 を描くテストだけ上限を延ばす。全体の testTimeout は延ばさない。
const PNG_RENDER_TIMEOUT_MS = 20_000;

const LITELLM_TITLE = '修正版が出てから適用するまで。LiteLLMから考える更新の担当・期限・記録';

function flattenTspans(svg: string) {
  return svg.replace(/<tspan\b[^>]*>/g, '').replace(/<\/tspan>/g, '');
}

async function countDarkPixels(
  png: Buffer,
  region: { left: number; top: number; width: number; height: number }
) {
  const { data, info } = await sharp(png)
    .extract(region)
    .raw()
    .toBuffer({ resolveWithObject: true });
  let dark = 0;
  for (let index = 0; index < data.length; index += info.channels) {
    if ((data[index] ?? 255) < 80) dark += 1;
  }
  return dark;
}

async function countLightPixels(
  png: Buffer,
  region: { left: number; top: number; width: number; height: number }
) {
  const { data, info } = await sharp(png)
    .extract(region)
    .raw()
    .toBuffer({ resolveWithObject: true });
  let light = 0;
  for (let index = 0; index < data.length; index += info.channels) {
    if ((data[index] ?? 0) > 220) light += 1;
  }
  return light;
}

describe('OG image utilities', () => {
  it('escapes blog SVG text before embedding it in markup', () => {
    const svg = buildBlogOgSvg({
      title: 'Title <script>alert("x")</script>',
      description: 'Description & details',
      category: 'ai<ops>',
      author: 'A&B',
    });
    const flat = flattenTspans(svg);

    expect(svg).not.toContain('<script>');
    expect(flat).toContain('&lt;script&gt;');
    expect(flat).toContain('Description &amp; details');
    expect(svg).toContain('AI&lt;OPS&gt;');
    expect(svg).toContain('A&amp;B');
    expect(svg).toContain('Noto Sans JP');
    expect(svg).not.toContain('Arial');
  });

  it('keeps page SVG dimensions and escapes page copy', () => {
    const svg = buildPageOgSvg({
      slug: 'test',
      title: 'Page <Title>',
      subtitle: 'Subtitle & detail',
    });

    expect(svg).toContain(`width="${OG_IMAGE_WIDTH}"`);
    expect(svg).toContain(`height="${OG_IMAGE_HEIGHT}"`);
    expect(svg).toContain('Page &lt;Title&gt;');
    expect(svg).toContain('Subtitle &amp; detail');
    expect(svg).toContain('Noto Sans JP');
  });

  it('uses the bundled font advance for ASCII and a full em for kana', () => {
    expect(estimateOgCharWidth(' ', 1000, true)).toBe(227);
    expect(estimateOgCharWidth('~', 1000, true)).toBe(590);
    expect(estimateOgCharWidth('M', 1000, false)).toBe(812);
    expect(estimateOgCharWidth('修', 1000, true)).toBe(1000);
    expect(estimateOgCharWidth('あ', 1000, false)).toBe(1000);
  });

  it('wraps the LiteLLM title onto two lines without splitting the Latin name', () => {
    const lines = wrapOgText(LITELLM_TITLE, 1080, 48, true, 3);

    expect(lines).toEqual([
      '修正版が出てから適用するまで。',
      'LiteLLMから考える更新の担当・期限・記録',
    ]);
    for (const line of lines) {
      expect(ogTextWidth(line, 48, true)).toBeLessThanOrEqual(1080);
    }
  });

  it('picks a CJK font from the article slug', () => {
    expect(ogFontScriptForSlug('ja/litellm-private-registry-patch-window')).toBe('jp');
    expect(ogFontScriptForSlug('en/litellm-private-registry-patch-window')).toBe('jp');
    expect(ogFontScriptForSlug('es/litellm-private-registry-patch-window')).toBe('jp');
    expect(ogFontScriptForSlug('zh/litellm-private-registry-patch-window')).toBe('sc');
    expect(ogFontScriptForSlug('ko/litellm-private-registry-patch-window')).toBe('kr');
    expect(ogFontScriptForSlug('home')).toBe('jp');

    const zh = buildBlogOgSvg({
      title: '简体',
      description: '',
      category: 'ai',
      author: 'Terisuke',
      script: 'sc',
    });
    const ko = buildBlogOgSvg({
      title: '한글',
      description: '',
      category: 'ai',
      author: 'Terisuke',
      script: 'kr',
    });
    expect(zh).toContain('Noto Sans SC');
    expect(ko).toContain('Noto Sans KR');
  });

  it('ships the OFL fonts the renderer loads', () => {
    for (const script of ['jp', 'sc', 'kr'] as const) {
      for (const filePath of ogFontFiles(script)) {
        expect(readFileSync(filePath).byteLength).toBeGreaterThan(1_000_000);
      }
    }
    expect(readFileSync(`${ogFontDirectory()}/OFL.txt`, 'utf8')).toContain('SIL OPEN FONT LICENSE');
  });

  it(
    'renders Japanese blog text as glyphs, not an empty or clipped card',
    async () => {
      const svg = buildBlogOgSvg({
        title: LITELLM_TITLE,
        description:
          'LiteLLMの非公開レジストリでの修正配布を手がかりに、ローカルLLMの更新担当・適用期限・記録を考えます。',
        category: 'ai',
        author: 'Terisuke',
      });
      const png = await renderOgPng(svg, 'jp');
      const metadata = await sharp(png).metadata();

      expect(metadata.format).toBe('png');
      expect(metadata.width).toBe(OG_IMAGE_WIDTH);
      expect(metadata.height).toBe(OG_IMAGE_HEIGHT);
      // 題の帯。フォントが読めないと、この範囲は背景のままになる。
      expect(
        await countDarkPixels(png, { left: 60, top: 160, width: 1000, height: 160 })
      ).toBeGreaterThan(8_000);
      // 右端 24px に字がはみ出していない。
      expect(
        await countDarkPixels(png, { left: 1176, top: 140, width: 24, height: 400 })
      ).toBeLessThan(20);
    },
    PNG_RENDER_TIMEOUT_MS
  );

  it(
    'renders simplified Chinese and Hangul with their own fonts',
    async () => {
      const zh = await renderOgPng(
        buildBlogOgSvg({
          title: '简体中文的标题',
          description: '更新',
          category: 'ai',
          author: 'Terisuke',
          script: 'sc',
        }),
        'sc'
      );
      const ko = await renderOgPng(
        buildBlogOgSvg({
          title: '한글 제목',
          description: '업데이트',
          category: 'ai',
          author: 'Terisuke',
          script: 'kr',
        }),
        'kr'
      );

      expect(
        await countDarkPixels(zh, { left: 60, top: 160, width: 700, height: 120 })
      ).toBeGreaterThan(2_000);
      expect(
        await countDarkPixels(ko, { left: 60, top: 160, width: 700, height: 120 })
      ).toBeGreaterThan(2_000);
    },
    PNG_RENDER_TIMEOUT_MS
  );

  it(
    'renders page SVG output to a nonblank 1200x630 PNG with light title text',
    async () => {
      const svg = buildPageOgSvg({
        slug: 'home',
        title: 'AIで、現場の課題を一緒に形にする。',
        subtitle: 'AI受託開発・DXコンサルティング・ローカルLLM',
      });
      const png = await renderOgPng(svg);
      const metadata = await sharp(png).metadata();
      const stats = await sharp(png).stats();

      expect(metadata.format).toBe('png');
      expect(metadata.width).toBe(OG_IMAGE_WIDTH);
      expect(metadata.height).toBe(OG_IMAGE_HEIGHT);
      expect(stats.channels.some((channel) => channel.stdev > 0)).toBe(true);
      expect(
        await countLightPixels(png, { left: 80, top: 280, width: 1000, height: 80 })
      ).toBeGreaterThan(1_000);
    },
    PNG_RENDER_TIMEOUT_MS
  );

  it('caps a long title at three lines', () => {
    const lines = wrapOgText('あ'.repeat(80), 1080, 48, true, 3);
    expect(lines).toHaveLength(3);
    expect(lines[2]).toMatch(/\.\.\.$/);
    expect(ogTextWidth(lines[2] ?? '', 48, true)).toBeLessThanOrEqual(1080);
  });

  it(
    'keeps static page titles inside the card',
    async () => {
      for (const slug of ['home', 'works', 'service-local-llm-poc']) {
        const page = OG_PAGES.find((item) => item.slug === slug);
        if (!page) throw new Error(`missing OG page: ${slug}`);
        const png = await renderOgPng(buildPageOgSvg(page));
        // 白文字が右端で切れると、この帯に明るい画素が残る。
        expect(
          await countLightPixels(png, { left: 1176, top: 250, width: 24, height: 220 }),
          slug
        ).toBeLessThan(15);
      }
    },
    PNG_RENDER_TIMEOUT_MS
  );

  it(
    'returns PNG response headers with cache metadata',
    async () => {
      const png = await renderOgPng(
        buildPageOgSvg({
          slug: 'home',
          title: 'Cor.inc',
          subtitle: 'cor-jp.com',
        })
      );
      const response = createPngResponse(png);

      expect(response.headers.get('Content-Type')).toBe('image/png');
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
      expect(response.headers.get('Content-Length')).toBe(String(png.byteLength));
    },
    PNG_RENDER_TIMEOUT_MS
  );
});
