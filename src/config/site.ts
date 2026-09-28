/**
 * サイト横断の URL / 環境ヘルパ（ADR-0010 / ADR-0011）。
 * 外部ドメインや intent 付き CTA はここ経由のみにする。
 */
import { getLocalizedUrl, type Locale } from '../utils/i18n';

/**
 * ADR-0014 intent 正本（7 キー）。
 * workers/contact-chat の CONTACT_INTENTS と同値（parity テストで一致を担保）。
 */
export const CONTACT_INTENTS = [
  'confidential-ai-assessment',
  'local-llm-poc',
  'grift-team-beta',
  'grift-paid-trial',
  'estimate-audit',
  'contract-dev',
  'press-speaking-other',
] as const;

export type ContactIntent = (typeof CONTACT_INTENTS)[number];

export function isContactIntent(v: unknown): v is ContactIntent {
  return typeof v === 'string' && (CONTACT_INTENTS as readonly string[]).includes(v);
}

/**
 * 自動 Grift ハンドオフ対象（ADR-0014）。
 * 実装は #259（Phase 3）。#250 では定数のみ公開。
 */
export const AUTO_HANDOFF_INTENTS = ['contract-dev'] as const satisfies readonly ContactIntent[];

export type SiteEnv = 'production' | 'preview' | 'development';

const DEFAULT_GRIFT_BASE = 'https://griftai.org';

export function getSiteEnv(): SiteEnv {
  const raw = (import.meta.env.PUBLIC_SITE_ENV || '').toLowerCase();
  if (raw === 'preview' || raw === 'development' || raw === 'production') {
    return raw;
  }
  // 未設定時は production 扱い（ローカル dev でも index 可）。Preview は CI で明示する。
  return 'production';
}

/** Preview / develop チャネルでは noindex */
export function isProductionSite(): boolean {
  return getSiteEnv() === 'production';
}

/**
 * 計測タグ（Analytics.astro）を出力してよいか。ADR-0004。
 *
 * - production 以外（preview / develop）では出力しない。社内確認用のチャネルで
 *   チーム自身の閲覧がセッション録画・計測され、解析データが汚染されるのを防ぐ。
 * - `enabled=false` は呼び出し側からの明示的な無効化。Cloudia ランチャーが
 *   /contact/chat/ を同一オリジンで iframe 読み込みするため、埋め込み先ページで
 *   計測すると同一訪問者に対し Clarity が二重起動し、幻のセッションで解析が汚れる。
 *
 * 両者は AND。どちらか一方でも false なら出力しない。
 */
export function isAnalyticsEnabled(enabled: boolean): boolean {
  return enabled && isProductionSite();
}

/**
 * robots メタタグの値（Layout / BlogSeoMeta 共通）。
 * `noindex` はページ単位の除外（タグ一覧・検証用・404 等。判定の正本は config/indexing.ts）。
 * リンクは辿らせたいので production では `noindex, follow` にする。
 */
export function getRobotsContent({ noindex = false }: { noindex?: boolean } = {}): string {
  if (!isProductionSite()) return 'noindex, nofollow';
  return noindex
    ? 'noindex, follow'
    : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
}

export function getGriftBaseUrl(): string {
  const base = import.meta.env.PUBLIC_GRIFT_BASE_URL || DEFAULT_GRIFT_BASE;
  return String(base).replace(/\/$/, '');
}

export type GriftUrlOptions = {
  intent?: string;
  source?: string;
  utm?: Record<string, string>;
};

/**
 * Grift への絶対 URL を生成する。
 * path は '/' 始まり、または 'grift' センチネル（i18n 用）。
 */
export function getGriftUrl(path = '/', opts: GriftUrlOptions = {}): string {
  let pathname = path || '/';
  if (pathname === 'grift' || pathname === 'grift:') {
    pathname = '/';
  }
  // 誤って絶対 URL が入っていても base を env で上書き
  if (/^https?:\/\//i.test(pathname)) {
    try {
      const incoming = new URL(pathname);
      pathname = `${incoming.pathname}${incoming.search}` || '/';
    } catch {
      pathname = '/';
    }
  }
  if (!pathname.startsWith('/')) {
    pathname = `/${pathname}`;
  }

  const url = new URL(pathname, `${getGriftBaseUrl()}/`);
  if (opts.intent) url.searchParams.set('intent', opts.intent);
  if (opts.source) url.searchParams.set('source', opts.source);
  if (opts.utm) {
    for (const [key, value] of Object.entries(opts.utm)) {
      if (value) url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

export type ContactUrlOptions = {
  intent?: ContactIntent | string;
  source?: string;
};

/** Cor /contact への locale + intent 付き URL */
export function getContactUrl(locale: Locale, opts: ContactUrlOptions = {}): string {
  const base = getLocalizedUrl('/contact', locale);
  const params = new URLSearchParams();
  if (opts.intent) params.set('intent', opts.intent);
  if (opts.source) params.set('source', opts.source);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * i18n / CMS 由来の href を解決する。
 * - 'grift' / griftai.org を含む → getGriftUrl
 * - それ以外はそのまま
 */
export function resolveExternalHref(
  href: string | null | undefined,
  opts: GriftUrlOptions = {},
): string | null {
  if (href == null || href === '') return null;
  if (href === 'grift' || href.startsWith('grift:') || /griftai\.org/i.test(href)) {
    return getGriftUrl('/', opts);
  }
  return href;
}

/**
 * 会社紹介資料（Google スライド）の公開 URL（#291）。
 * 閲覧専用の /preview を使い、共有元 URL の個人アカウント ID（ouid）等は載せない。
 * 外部リンクとして別タブで開く（利用側で target=_blank / rel=noopener を付与）。
 */
export const COMPANY_DECK_URL =
  'https://docs.google.com/presentation/d/1bl7eyuHc_pohcdyzWzOWibWisz-IQFe3/preview';

/**
 * 福岡を代表する企業100選 公式エンブレム（#276）。
 * 掲載は運営（株式会社IOBI）の許諾条件に従う:
 *  - 条件②: エンブレムのクリックで選出企業の特設ページへ遷移させること（FUKUOKA100_PAGE_URL）
 *  - 条件③: 掲載期間は 2027年7月末まで（当初回答「2026年8月から1年間」→ 2026-07-16 の
 *    和田様回答「本日からのご掲載で問題ありません」によりサイト公開日から掲載可に前倒し）
 *
 * ⚠️ 判定は「明示フラグ AND 期間」。日付だけに頼らない理由:
 * 本番デプロイは main への push でのみ走り、定期ビルドが無い（.github/workflows/deploy.yml）。
 * 日付を跨いでも再ビルドされなければ表示・非表示は切り替わらないため、日付単独では
 * 「自動で期限が切れる」という誤った安心感を与える。人手の操作をフラグで明示する。
 *
 * 運用:
 *  - 掲載終了（FUKUOKA100_DISPLAY_END）までに FUKUOKA100_EMBLEM_ENABLED = false へ戻し、
 *    main へ反映する。取り下げ忘れは掲載期限違反になるため、期限のリマインダ
 *    （Issue/カレンダー）を必ず併用する。
 *  - 2027年版を継続する場合は IOBI から新エンブレムが送付される。期限が近づいたら
 *    更新可否を IOBI へ連絡し、素材と掲載期間を差し替える。
 */
export const FUKUOKA100_PAGE_URL = 'https://madeinlocal.jp/category/companies/fukuoka062';
/**
 * 掲載開始日（ISO・JST）。IOBI 和田様の回答（2026-07-16）で「本日からのご掲載で問題ありません」
 * と前倒し許諾を取得したため、当初回答の 2026-08-01 からサイト公開日へ変更。
 */
export const FUKUOKA100_DISPLAY_START = '2026-07-16';
/** 掲載終了日（ISO・JST）。IOBI 回答「2026年版の掲載期限は2027年7月末まで」。この日いっぱいで終了。 */
export const FUKUOKA100_DISPLAY_END = '2027-07-31';
/** 掲載の明示スイッチ。IOBI より掲載許諾を取得済みのため有効（掲載期限到来時は false へ戻す）。 */
export const FUKUOKA100_EMBLEM_ENABLED = true;

/**
 * 掲載期間内かどうか（条件③）。フラグとは独立に公開し、期間ロジック単体を検証可能にする。
 * （フラグ込みの判定だけだと、フラグ off の間は常に false になり期間の境界をテストで固定できない）
 */
export function isWithinFukuoka100DisplayPeriod(now: Date): boolean {
  const start = new Date(`${FUKUOKA100_DISPLAY_START}T00:00:00+09:00`);
  // 終端は排他的（終了日の 24:00 = 翌日 0:00 以降は非表示）。
  const end = new Date(`${FUKUOKA100_DISPLAY_END}T24:00:00+09:00`);
  return now >= start && now < end;
}

/** 福岡100選エンブレムを表示してよいか（明示フラグ AND 掲載期間内）。 */
export function isFukuoka100EmblemVisible(now: Date = new Date()): boolean {
  return FUKUOKA100_EMBLEM_ENABLED && isWithinFukuoka100DisplayPeriod(now);
}
