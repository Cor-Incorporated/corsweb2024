import { afterEach, describe, expect, it, vi } from 'vitest';

// 計測タグ（Analytics.astro）に渡す ID の決まり方を固定する。ADR-0004。
// 落ちるべき変更:
//   - GA4 の ID が未設定でも ga4Id を返す（未設定でタグが出る）
//   - production 以外（preview / development）で ga4Id を返す（社内閲覧が本番の解析に入る）
//   - enabled=false（iframe 埋め込み先）で ga4Id を返す（同じ訪問者の二重計測）
//   - 形式の崩れた値（引用符・空白・改行を含む）をそのまま返す（スクリプトの URL に混ざる）
// import.meta.env をテストごとに差し替えるため、動的 import する（site.test.ts と同じ形）。
async function load() {
  vi.resetModules();
  return import('./analytics-tags');
}

const ALL_SET = {
  PUBLIC_CF_BEACON_TOKEN: 'cf-token-example',
  PUBLIC_CLARITY_ID: 'clarity-example',
  PUBLIC_GA4_ID: 'G-ABCDE12345',
};

describe('resolveAnalyticsTags (ADR-0004 計測タグの ID)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('production かつ enabled なら、設定された 3 つの ID をそのまま返す', async () => {
    vi.stubEnv('PUBLIC_SITE_ENV', 'production');
    const { resolveAnalyticsTags } = await load();
    expect(resolveAnalyticsTags(true, ALL_SET)).toEqual({
      cfBeaconToken: 'cf-token-example',
      clarityId: 'clarity-example',
      ga4Id: 'G-ABCDE12345',
    });
  });

  it('PUBLIC_GA4_ID が未設定なら ga4Id は空（GA4 のタグを出さない）。他の 2 つは変わらない', async () => {
    vi.stubEnv('PUBLIC_SITE_ENV', 'production');
    const { resolveAnalyticsTags } = await load();
    const { PUBLIC_GA4_ID: _unused, ...withoutGa4 } = ALL_SET;
    expect(resolveAnalyticsTags(true, withoutGa4)).toEqual({
      cfBeaconToken: 'cf-token-example',
      clarityId: 'clarity-example',
      ga4Id: '',
    });
  });

  it.each([
    ['空文字', ''],
    ['空白だけ', '   '],
    ['改行だけ', '\n'],
  ])('PUBLIC_GA4_ID が%sなら ga4Id は空', async (_label, value) => {
    vi.stubEnv('PUBLIC_SITE_ENV', 'production');
    const { resolveAnalyticsTags } = await load();
    expect(resolveAnalyticsTags(true, { ...ALL_SET, PUBLIC_GA4_ID: value }).ga4Id).toBe('');
  });

  it('何も設定していなければ 3 つとも空（dev / 未設定環境では計測ゼロ）', async () => {
    vi.stubEnv('PUBLIC_SITE_ENV', 'production');
    const { resolveAnalyticsTags } = await load();
    expect(resolveAnalyticsTags(true, {})).toEqual({
      cfBeaconToken: '',
      clarityId: '',
      ga4Id: '',
    });
  });

  it.each(['preview', 'development'] as const)(
    '%s では ID を全部設定しても 3 つとも空（社内閲覧で解析が汚れるため）',
    async (siteEnv) => {
      vi.stubEnv('PUBLIC_SITE_ENV', siteEnv);
      const { resolveAnalyticsTags } = await load();
      expect(resolveAnalyticsTags(true, ALL_SET)).toEqual({
        cfBeaconToken: '',
        clarityId: '',
        ga4Id: '',
      });
    },
  );

  it('enabled=false（iframe 埋め込み先）なら production でも 3 つとも空（二重計測の防止）', async () => {
    vi.stubEnv('PUBLIC_SITE_ENV', 'production');
    const { resolveAnalyticsTags } = await load();
    expect(resolveAnalyticsTags(false, ALL_SET)).toEqual({
      cfBeaconToken: '',
      clarityId: '',
      ga4Id: '',
    });
  });

  it('GA4 の ID の前後の空白と改行は取り除く（secret に改行が混ざる失敗への備え）', async () => {
    vi.stubEnv('PUBLIC_SITE_ENV', 'production');
    const { resolveAnalyticsTags } = await load();
    expect(
      resolveAnalyticsTags(true, { ...ALL_SET, PUBLIC_GA4_ID: ' G-ABCDE12345\n' }).ga4Id,
    ).toBe('G-ABCDE12345');
  });

  it.each([
    ['G- で始まらない（Clarity の ID を入れ違えた）', 'z97a0rwaoh'],
    ['UA の旧 ID', 'UA-12345-1'],
    ['引用符を含む', 'G-ABC"onload="x'],
    ['空白を含む', 'G-ABC DEF'],
    ['クエリを足そうとする', 'G-ABC123&l=x'],
    ['バッククォートを含む（手順書のコード表記の混入）', '`G-ABC123`'],
    ['小文字', 'g-abc123'],
    ['前に文字が付いている（先頭の検査が外れると通る）', 'XG-ABC123'],
    ['別の ID の後ろに G- が続く', 'UA-1 G-ABC'],
    ['G- のあとが小文字', 'G-abc123'],
    ['G- だけで中身がない', 'G-'],
    ['アンダースコアを含む', 'G-AB_C'],
    ['ハイフンを含む', 'G-AB-C'],
    ['ドットとスラッシュを含む（パスのたどり。他の文字は大文字と数字だけ）', 'G-AB/../X'],
  ])('形式の崩れた PUBLIC_GA4_ID（%s）は出さない', async (_label, value) => {
    vi.stubEnv('PUBLIC_SITE_ENV', 'production');
    const { resolveAnalyticsTags } = await load();
    expect(resolveAnalyticsTags(true, { ...ALL_SET, PUBLIC_GA4_ID: value }).ga4Id).toBe('');
  });
});
