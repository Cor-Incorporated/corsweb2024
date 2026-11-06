import { Resvg } from '@resvg/resvg-js';
import { OG_FONT_FAMILY, ogFontFiles, type OgFontScript } from './og-fonts';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from './og-svg';

export async function renderOgPng(svg: string, script: OgFontScript = 'jp') {
  const family = OG_FONT_FAMILY[script];
  const resvg = new Resvg(svg, {
    font: {
      fontFiles: ogFontFiles(script),
      // システムのフォントに任せると、CI では日本語が16進の箱になる。
      loadSystemFonts: false,
      defaultFontFamily: family,
      sansSerifFamily: family,
    },
  });
  const png = resvg.render().asPng();
  return Buffer.from(png);
}

export function createPngResponse(png: BodyInit) {
  return new Response(png, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Length': String(png instanceof Uint8Array ? png.byteLength : 0),
    },
  });
}

export { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH };
