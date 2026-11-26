// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// サービス一覧の公開は、deploy.yml が名前を渡し、account-services-route.mjs が同じ名前を読むことで成立する。
//   渡す: .github/workflows/deploy.yml（ビルドの環境変数）
//   読む: src/config/account-services-route.mjs（process.env から読む。公開の判断と Clerk の検査に使う）
// 片方だけ名前を変えると、値が渡らずに公開の判断が「偽」のまま静かに止まる。だから両側を突き合わせる。
// flag の式は行全体を期待値と完全一致で比べる。「含まれる」だけだと、条件を 1 つ外す変更を見逃す。
// 失敗メッセージには、期待の式と観測した式の両方を出す（どちらを直すかが分かるように）。
const root = resolve(__dirname, '../../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const DEPLOY_YML = '.github/workflows/deploy.yml';
const ROUTE_MODULE = 'src/config/account-services-route.mjs';

const EXPECTED_EXPRESSION = {
  PUBLIC_ACCOUNT_SERVICES_ENABLED:
    "${{ github.ref == 'refs/heads/main' && github.event_name == 'push' && vars.PUBLIC_ACCOUNT_SERVICES_ENABLED == 'true' && 'true' || 'false' }}",
  PUBLIC_CLERK_PUBLISHABLE_KEY:
    "${{ github.ref == 'refs/heads/main' && github.event_name == 'push' && vars.PUBLIC_CLERK_PUBLISHABLE_KEY || '' }}",
  CLERK_ISSUER:
    "${{ github.ref == 'refs/heads/main' && github.event_name == 'push' && vars.CLERK_ISSUER || '' }}",
} as const;

const NAMES = Object.keys(EXPECTED_EXPRESSION) as (keyof typeof EXPECTED_EXPRESSION)[];

// deploy.yml の `<名前>:` の行を集め、値の部分だけを取り出す（行の式を丸ごと比べるため）。
const observedExpressions = (source: string, name: string) => {
  const lines = source.split('\n').filter((line) => new RegExp(`^\\s+${name}:\\s`).test(line));
  return lines.map((line) => line.trim().slice(name.length + 1).trim());
};

describe('公開の flag と Clerk の設定: deploy.yml の式 ↔ account-services-route.mjs の読み取り', () => {
  const deployYml = read(DEPLOY_YML);
  const routeModule = read(ROUTE_MODULE);

  it.each(NAMES)('%s は deploy.yml に 1 行だけで、式が期待と完全一致する', (name) => {
    const observed = observedExpressions(deployYml, name);
    expect(
      { 行数: observed.length, 式: observed },
      `${name} の行が 1 行でない、または式が期待と違う（期待の式: ${EXPECTED_EXPRESSION[name]} / 観測した式: ${observed.join(' / ') || '(なし)'}）`,
    ).toEqual({ 行数: 1, 式: [EXPECTED_EXPRESSION[name]] });
  });

  // 名前の後ろに識別子の字が続く場合は別の名前として扱う（CLERK_ISSUER が CLERK_ISSUERX に化けても通さない）。
  it.each(NAMES)('%s は account-services-route.mjs で process.env の同じ名前から読まれている', (name) => {
    const readInModule = new RegExp(`process\\.env\\.${name}(?![A-Za-z0-9_])`).test(routeModule);
    expect(
      { name, 'account-services-route.mjs が読む': readInModule },
      `${name} が account-services-route.mjs の process.env.${name} で読まれていない（deploy.yml が渡す名前と、build の検査が読む名前がずれている）`,
    ).toEqual({ name, 'account-services-route.mjs が読む': true });
  });
});
