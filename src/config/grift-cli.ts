import { z } from 'astro/zod';
import release from './grift-cli-release.json';
import { GRIFT_CLI_GITHUB_URL } from './site';

/**
 * Grift CLI の「いま公開している版」（ADR-0023）。値は grift-cli-release.json の 1 か所だけに書き、ここはそれを読む。
 *
 * - いまの版を出すページ（/llms.txt）は、ここを読む。版を文字で書かない
 * - 記事は版を「執筆時点では v0.x」のように、その時点の記録として書き、ここを読まない。
 *   「公開中」「最新」「現在」と一緒に書いた版がここと違えば、scripts/check-grift-version-claims.mjs（npm run test:run）が落とす
 * - .github/workflows/grift-cli-release-watch.yml が毎日 PyPI の最新と照合し、違えば Issue を開く
 * - 次の版が出たら `node scripts/grift-cli-release-watch.mjs --write` で JSON を書き換える（手順は ADR-0023）
 *
 * JSON の形は scripts/lib/grift-cli-release.mjs の validateRelease も確かめる（照合の workflow は npm ci をしないため、
 * Node の組み込みだけで読む）。src/config/__tests__/grift-cli.test.ts が、両方が同じ値を受け付けることを照合する。
 */
export const griftCliReleaseSchema = z
  .object({
    version: z.string().regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/),
    releasedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();

const parsed = griftCliReleaseSchema.parse(release);

export const GRIFT_CLI_RELEASE = {
  ...parsed,
  releaseNotesUrl: `${GRIFT_CLI_GITHUB_URL}/releases/tag/v${parsed.version}`,
  pypiUrl: `https://pypi.org/project/grift-cli/${parsed.version}/`,
} as const;
