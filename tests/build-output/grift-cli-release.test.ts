// ビルド済み dist の Grift CLI の版の検査（設定: vitest.dist.config.ts。`npm run build` の後に `npm run test:dist`）。
// ADR-0023: いまの版を出すページは、版を文字で書かずに正本（src/config/grift-cli-release.json）から入れる。
// /llms.txt の版の行が正本と同じで、ほかの版を「最新」として書いていないことを照合する。
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIST_DIR = path.resolve(process.env.CONTACT_GUARD_DIST_DIR || 'dist');
const LLMS = path.join(DIST_DIR, 'llms.txt');
const release = JSON.parse(readFileSync(path.resolve('src/config/grift-cli-release.json'), 'utf8')) as {
  version: string;
  releasedOn: string;
};

describe('dist の Grift CLI の版', () => {
  it('/llms.txt がある', () => {
    expect(existsSync(LLMS), `${LLMS} が無い。先に npm run build を実行する`).toBe(true);
  });

  it('/llms.txt の最新の公開版の行が、正本の版・公開日・リリースノートと同じ', () => {
    const lines = readFileSync(LLMS, 'utf8')
      .split('\n')
      .filter((line) => line.includes('最新の公開版'));
    expect(lines).toEqual([
      `- Grift CLI の最新の公開版: v${release.version}（${release.releasedOn} 公開。変更点: https://github.com/Cor-Incorporated/grift-cli/releases/tag/v${release.version}）`,
    ]);
  });
});
