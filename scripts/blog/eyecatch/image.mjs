/**
 * 生成した画像を、記事に載せる AVIF 2 サイズに変換する（sharp）。
 * - ヒーロー: 1600×900（記事ページの「この記事の要点」の下と一覧のカード。frontmatter の image.url）
 * - 1200×630: OG 画像と同じ比率。og:image には使わない（docs/blog-eyecatch.md「OG 画像との関係」）
 */
import { createHash } from 'node:crypto';
import sharp from 'sharp';

export const EYECATCH_VARIANTS = Object.freeze([
  Object.freeze({ key: 'hero', width: 1600, height: 900, suffix: '' }),
  Object.freeze({ key: 'og', width: 1200, height: 630, suffix: '-1200x630' }),
]);

/** 既存の public/images/blog/*.avif と同じ程度の画質。写真ではなく平らな絵なので、これ以上上げても見た目は変わらない。 */
const AVIF_OPTIONS = Object.freeze({ quality: 55, effort: 4 });

export function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

/** @param {Buffer} buffer */
export async function readImageSize(buffer) {
  const { width, height, format } = await sharp(buffer).metadata();
  return { width, height, format };
}

/**
 * 中央を基準に切り抜いて 2 サイズの AVIF を作る。書き込みはしない（呼び出し側が全部そろってから書く）。
 * @param {Buffer} source
 * @returns {Promise<Array<{ key: string, width: number, height: number, suffix: string, buffer: Buffer, sha256: string }>>}
 */
export async function renderEyecatchVariants(source) {
  return Promise.all(
    EYECATCH_VARIANTS.map(async (variant) => {
      const buffer = await sharp(source)
        .resize(variant.width, variant.height, { fit: 'cover', position: 'centre' })
        .avif(AVIF_OPTIONS)
        .toBuffer();
      return { ...variant, buffer, sha256: sha256(buffer) };
    })
  );
}
