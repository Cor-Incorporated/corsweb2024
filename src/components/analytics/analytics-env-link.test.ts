// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// 計測の環境変数の名前は 3 か所に書かれている。
//   宣言: .github/workflows/deploy.yml（ビルドへ渡す）と src/env.d.ts（型）
//   強制: src/components/analytics/Analytics.astro（import.meta.env から読む）
// 片方だけ名前を変えると、ビルドに値が渡らず、タグが「何も出ない」まま静かに止まる。
// 失敗メッセージには両側の観測値を出す（どちらを直すかが分かるように）。
const root = resolve(__dirname, '../../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const NAMES = ['PUBLIC_CF_BEACON_TOKEN', 'PUBLIC_CLARITY_ID', 'PUBLIC_GA4_ID'] as const;

describe('計測の環境変数の名前: deploy.yml ↔ env.d.ts ↔ Analytics.astro', () => {
  const deployYml = read('.github/workflows/deploy.yml');
  const envDts = read('src/env.d.ts');
  const analyticsAstro = read('src/components/analytics/Analytics.astro');

  it.each(NAMES)('%s は 3 か所すべてに同じ名前である', (name) => {
    const inDeploy = new RegExp(`^\\s+${name}:\\s`, 'm').test(deployYml);
    const inTypes = new RegExp(`readonly ${name}\\?: string;`).test(envDts);
    const inComponent = analyticsAstro.includes(`import.meta.env.${name}`);
    expect(
      { name, 'deploy.yml が渡す': inDeploy, 'env.d.ts が宣言する': inTypes, 'Analytics.astro が読む': inComponent },
      `${name} の名前が 3 か所でそろっていない`,
    ).toEqual({
      name,
      'deploy.yml が渡す': true,
      'env.d.ts が宣言する': true,
      'Analytics.astro が読む': true,
    });
  });

  it.each(NAMES)('%s は main への push のときだけ deploy.yml から渡す（PR と develop のビルドには渡さない）', (name) => {
    const line = deployYml.split('\n').find((l) => new RegExp(`^\\s+${name}:\\s`).test(l)) ?? '';
    expect(line, `${name} の行が main への push に限られていない（観測した行: ${line.trim()}）`).toContain(
      "github.ref == 'refs/heads/main' && github.event_name == 'push'",
    );
  });
});
