import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Open Graph の文字を描くフォント。
 * sharp（librsvg）は、フォントに字形が無い文字を符号の16進の箱で描く。
 * ビルド環境（GitHub Actions の Ubuntu など）には日本語のフォントが無いので、
 * Noto CJK の言語別 OTF（Sans 2.004、OFL）を assets/og-fonts に同梱する。
 * ライセンスは同じディレクトリの OFL.txt。
 */
export const OG_FONT_SCRIPTS = ['jp', 'sc', 'kr'] as const;

export type OgFontScript = (typeof OG_FONT_SCRIPTS)[number];

export const OG_FONT_FAMILY = {
  jp: 'Noto Sans JP',
  sc: 'Noto Sans SC',
  kr: 'Noto Sans KR',
} as const satisfies Record<OgFontScript, string>;

const FONT_FILE_NAMES = {
  jp: ['NotoSansJP-Regular.otf', 'NotoSansJP-Bold.otf'],
  sc: ['NotoSansSC-Regular.otf', 'NotoSansSC-Bold.otf'],
  kr: ['NotoSansKR-Regular.otf', 'NotoSansKR-Bold.otf'],
} as const satisfies Record<OgFontScript, readonly string[]>;

export function ogFontDirectory() {
  return join(process.cwd(), 'assets/og-fonts');
}

export function ogFontFiles(script: OgFontScript) {
  const directory = ogFontDirectory();
  return FONT_FILE_NAMES[script].map((name: string) => {
    const filePath = join(directory, name);
    if (!existsSync(filePath)) {
      throw new Error(`OG font is missing: ${filePath}`);
    }
    return filePath;
  });
}

/** 記事 slug の先頭（ja/zh/ko/en/es）から、その画像で使うフォントを決める。ページ画像は ja。 */
export function ogFontScriptForSlug(slug: string): OgFontScript {
  const locale = slug.split('/')[0];
  if (locale === 'zh') return 'sc';
  if (locale === 'ko') return 'kr';
  return 'jp';
}
