import { afterEach, describe, expect, it, vi } from 'vitest';

// import.meta.env をテストごとに差し替えるため、動的 import する
async function loadSite() {
  vi.resetModules();
  return import('../site');
}

describe('getGriftUrl / getContactUrl (ADR-0010)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('defaults to griftai.org when env is unset', async () => {
    vi.stubEnv('PUBLIC_GRIFT_BASE_URL', '');
    const { getGriftBaseUrl, getGriftUrl } = await loadSite();
    expect(getGriftBaseUrl()).toBe('https://griftai.org');
    expect(getGriftUrl('/')).toBe('https://griftai.org/');
  });

  it('uses PUBLIC_GRIFT_BASE_URL for Preview/Prod switch', async () => {
    vi.stubEnv('PUBLIC_GRIFT_BASE_URL', 'https://preview.grift.example');
    const { getGriftUrl } = await loadSite();
    expect(getGriftUrl('/team-beta')).toBe('https://preview.grift.example/team-beta');
  });

  it('appends intent and source query params', async () => {
    vi.stubEnv('PUBLIC_GRIFT_BASE_URL', 'https://griftai.org');
    const { getGriftUrl } = await loadSite();
    const url = getGriftUrl('/', {
      intent: 'grift-team-beta',
      source: 'home-hero',
      utm: { utm_source: 'cor' },
    });
    const u = new URL(url);
    expect(u.searchParams.get('intent')).toBe('grift-team-beta');
    expect(u.searchParams.get('source')).toBe('home-hero');
    expect(u.searchParams.get('utm_source')).toBe('cor');
  });

  it('getContactUrl localizes path and intent', async () => {
    const { getContactUrl } = await loadSite();
    expect(getContactUrl('ja', { intent: 'confidential-ai-assessment', source: 'header' })).toBe(
      '/contact?intent=confidential-ai-assessment&source=header',
    );
    expect(getContactUrl('en', { intent: 'local-llm-poc' })).toBe(
      '/en/contact?intent=local-llm-poc',
    );
  });

  it('resolveExternalHref rewrites grift sentinel and absolute griftai URLs', async () => {
    vi.stubEnv('PUBLIC_GRIFT_BASE_URL', 'https://preview.example');
    const { resolveExternalHref } = await loadSite();
    expect(resolveExternalHref('grift', { source: 'works' })).toContain('preview.example');
    expect(resolveExternalHref('https://griftai.org', { source: 'works' })).toContain(
      'preview.example',
    );
    expect(resolveExternalHref('/works/foo')).toBe('/works/foo');
    expect(resolveExternalHref(null)).toBeNull();
  });
});

describe('isProductionSite (ADR-0010 noindex)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('treats unset env as production', async () => {
    vi.stubEnv('PUBLIC_SITE_ENV', '');
    const { isProductionSite, getSiteEnv } = await loadSite();
    expect(getSiteEnv()).toBe('production');
    expect(isProductionSite()).toBe(true);
  });

  it('preview is not production', async () => {
    vi.stubEnv('PUBLIC_SITE_ENV', 'preview');
    const { isProductionSite } = await loadSite();
    expect(isProductionSite()).toBe(false);
  });
});

// meta robots の値。環境（production / preview）× ページ単位 noindex の 4 通りを固定する。
describe('getRobotsContent (環境 × ページ単位 noindex)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it.each([
    ['production', false, 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'],
    ['production', true, 'noindex, follow'],
    ['preview', false, 'noindex, nofollow'],
    ['preview', true, 'noindex, nofollow'],
  ])('%s / noindex=%s → %s', async (env, noindex, expected) => {
    vi.stubEnv('PUBLIC_SITE_ENV', env);
    const { getRobotsContent } = await loadSite();
    expect(getRobotsContent({ noindex })).toBe(expected);
  });

  it('defaults to indexable in production', async () => {
    vi.stubEnv('PUBLIC_SITE_ENV', 'production');
    const { getRobotsContent } = await loadSite();
    expect(getRobotsContent()).toMatch(/^index, follow/);
  });
});

// 計測タグの出力可否（ADR-0004）。Analytics.astro はこの関数の戻り値だけで
// タグを出す/出さないを決めるため、ここが両条件の AND を守っているかを固定する。
// 落ちるべき変更: `enabled && isProductionSite()` を `||` にする / どちらかの条件を落とす。
describe('isAnalyticsEnabled (ADR-0004 計測ゲート)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('production かつ enabled のときだけ出力する', async () => {
    vi.stubEnv('PUBLIC_SITE_ENV', 'production');
    const { isAnalyticsEnabled } = await loadSite();
    expect(isAnalyticsEnabled(true)).toBe(true);
  });

  it('preview では enabled でも出力しない（社内閲覧で解析が汚れるため）', async () => {
    vi.stubEnv('PUBLIC_SITE_ENV', 'preview');
    const { isAnalyticsEnabled } = await loadSite();
    expect(isAnalyticsEnabled(true)).toBe(false);
  });

  it('development でも出力しない', async () => {
    vi.stubEnv('PUBLIC_SITE_ENV', 'development');
    const { isAnalyticsEnabled } = await loadSite();
    expect(isAnalyticsEnabled(true)).toBe(false);
  });

  it('enabled=false なら production でも出力しない（iframe 埋め込み先の二重計測防止）', async () => {
    vi.stubEnv('PUBLIC_SITE_ENV', 'production');
    const { isAnalyticsEnabled } = await loadSite();
    expect(isAnalyticsEnabled(false)).toBe(false);
  });

  it('preview かつ enabled=false でも出力しない', async () => {
    vi.stubEnv('PUBLIC_SITE_ENV', 'preview');
    const { isAnalyticsEnabled } = await loadSite();
    expect(isAnalyticsEnabled(false)).toBe(false);
  });
});

describe('ContactIntent 7 keys (ADR-0014 / #250)', () => {
  it('exports contract-dev and isContactIntent', async () => {
    const { CONTACT_INTENTS, isContactIntent, AUTO_HANDOFF_INTENTS, getContactUrl } = await loadSite();
    expect(CONTACT_INTENTS).toContain('contract-dev');
    expect(CONTACT_INTENTS).toHaveLength(7);
    expect(isContactIntent('contract-dev')).toBe(true);
    expect(isContactIntent('nope')).toBe(false);
    expect([...AUTO_HANDOFF_INTENTS]).toEqual(['contract-dev']);
    expect(getContactUrl('ja', { intent: 'contract-dev', source: 'header-ai-dev' })).toBe(
      '/contact?intent=contract-dev&source=header-ai-dev',
    );
  });
});

describe('福岡100選エンブレムの掲載ガード（#276 掲載期限）', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  // 掲載期間の境界は production の isWithinFukuoka100DisplayPeriod を直接呼んで検証する。
  // （テスト内でロジックを再実装すると、定数を書き換えても落ちない空虚なテストになる）
  it('掲載開始前（JST 2026-07-15 23:59:59）は掲載期間外', async () => {
    const { isWithinFukuoka100DisplayPeriod } = await loadSite();

    expect(isWithinFukuoka100DisplayPeriod(new Date('2026-07-15T23:59:59+09:00'))).toBe(false);
  });

  // IOBI 和田様の回答（2026-07-16）「本日からのご掲載で問題ありません」。
  it('掲載開始日 JST 2026-07-16 0:00 ちょうどから掲載期間内（ホストTZに依存しない）', async () => {
    const { isWithinFukuoka100DisplayPeriod } = await loadSite();

    // 2026-07-15T15:00:00Z === JST 2026-07-16 00:00
    expect(isWithinFukuoka100DisplayPeriod(new Date('2026-07-15T15:00:00Z'))).toBe(true);
  });

  it('掲載最終日（JST 2027-07-31 23:59）は掲載期間内', async () => {
    const { isWithinFukuoka100DisplayPeriod } = await loadSite();

    expect(isWithinFukuoka100DisplayPeriod(new Date('2027-07-31T23:59:00+09:00'))).toBe(true);
  });

  // 終端は「終了日の翌日0時」＝排他的。23:59:59 等に退行すると最終日の末尾が欠けるため固定する。
  it('掲載最終日の最終秒（JST 2027-07-31 23:59:59.500）も掲載期間内＝終端は翌日0時', async () => {
    const { isWithinFukuoka100DisplayPeriod } = await loadSite();

    expect(isWithinFukuoka100DisplayPeriod(new Date('2027-07-31T23:59:59.500+09:00'))).toBe(true);
  });

  it('掲載期限（2027年7月末）経過後は掲載期間外＝許諾期間を超えて出さない', async () => {
    const { isWithinFukuoka100DisplayPeriod } = await loadSite();

    expect(isWithinFukuoka100DisplayPeriod(new Date('2027-08-01T00:00:00+09:00'))).toBe(false);
  });

  // 掲載期限を過ぎたら、フラグを false に戻し忘れても表示されないことを担保する
  // （本番は main への push でのみ再ビルドされるため、実運用ではフラグ操作が必須。
  //   ここでは「期間ガードが最後の砦として効く」ことを固定する）。
  it('掲載期限後はフラグが有効でも表示しない', async () => {
    const { isFukuoka100EmblemVisible } = await loadSite();

    expect(isFukuoka100EmblemVisible(new Date('2027-08-01T00:00:00+09:00'))).toBe(false);
  });

  // IOBI より掲載許諾を取得済みのため有効。掲載期限（2027-07-31）到来時は false に戻すこと。
  it('掲載期間内かつフラグ有効なら表示する', async () => {
    const { isFukuoka100EmblemVisible, isWithinFukuoka100DisplayPeriod } = await loadSite();
    const inWindow = new Date('2026-09-01T00:00:00+09:00');

    expect(isWithinFukuoka100DisplayPeriod(inWindow)).toBe(true);
    expect(isFukuoka100EmblemVisible(inWindow)).toBe(true);
  });
});
