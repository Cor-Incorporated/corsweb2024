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

  // deploy.yml が ID を渡す式は、行全体を期待値と完全一致で比べる。「文字列が含まれる」だけだと、
  // かっこを外して `&& a || b` の優先順位を変える変更（PR と develop のビルドに値が渡る）を見逃す。
  const GATE = "github.ref == 'refs/heads/main' && github.event_name == 'push'";
  const EXPECTED_EXPRESSION: Record<(typeof NAMES)[number], string> = {
    PUBLIC_CF_BEACON_TOKEN: `\${{ ${GATE} && secrets.PUBLIC_CF_BEACON_TOKEN || '' }}`,
    PUBLIC_CLARITY_ID: `\${{ ${GATE} && secrets.PUBLIC_CLARITY_ID || '' }}`,
    PUBLIC_GA4_ID: `\${{ ${GATE} && (vars.PUBLIC_GA4_ID || secrets.PUBLIC_GA4_ID) || '' }}`,
  };

  it.each(NAMES)('%s は main への push のときだけ deploy.yml から渡す（PR と develop のビルドには渡さない）', (name) => {
    const lines = deployYml.split('\n').filter((l) => new RegExp(`^\\s+${name}:\\s`).test(l));
    const observed = lines.map((l) => l.trim().slice(name.length + 1).trim());
    expect(
      { 行数: lines.length, 式: observed },
      `${name} の行が 1 行でない、または式が期待と違う（観測した式: ${observed.join(' / ')}）`,
    ).toEqual({ 行数: 1, 式: [EXPECTED_EXPRESSION[name]] });
  });

  // 補助の検査（完了の根拠にはしない）: GA4 の ID は resolveAnalyticsTags の戻り値（形式の検査を通った値）だけを
  // Analytics.astro が使う。import.meta.env.PUBLIC_GA4_ID を直接テンプレートに使うと、形式の検査を通らずにタグが出る。
  // 実際の出力は、PUBLIC_GA4_ID を付けた production ビルドの dist で確かめる（PR 本文に実測）。
  it('Analytics.astro は import.meta.env.PUBLIC_GA4_ID を resolveAnalyticsTags への 1 回しか読まない', () => {
    const reads = analyticsAstro.match(/import\.meta\.env\.PUBLIC_GA4_ID/g) ?? [];
    expect(reads.length, `PUBLIC_GA4_ID の読み取りが ${reads.length} 回ある（期待は 1 回）`).toBe(1);
    expect(analyticsAstro).toContain('ga4Id && (');
  });
});
