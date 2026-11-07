/**
 * 計測タグ（Analytics.astro）に渡す ID を決める。ADR-0004。
 *
 * 出すかどうかの条件は 1 か所にまとめる（Analytics.astro は戻り値の空文字かどうかだけを見る）:
 * - production 以外（preview / develop）では 3 つとも空。社内確認で解析が汚れるのを防ぐ
 * - `enabled=false`（iframe 埋め込み先）では 3 つとも空。同じ訪問者の二重計測を防ぐ
 * - 環境変数が未設定なら、その ID は空。何も出さない
 * - GA4 の測定 ID は形式を確かめる。secret に改行や別の ID が混ざっても、スクリプトの URL には入らない
 *
 * 前半の 2 つの判定は `isAnalyticsEnabled`（config/site.ts）が正本。
 */
import { isAnalyticsEnabled } from '../../config/site';

export interface AnalyticsEnv {
  readonly PUBLIC_CF_BEACON_TOKEN?: string;
  readonly PUBLIC_CLARITY_ID?: string;
  readonly PUBLIC_GA4_ID?: string;
}

export interface AnalyticsTags {
  readonly cfBeaconToken: string;
  readonly clarityId: string;
  readonly ga4Id: string;
}

// GA4 の測定 ID は「G-」に英数字が続く（Google アナリティクスのヘルプ）。引用符・空白・&・バッククォートは通さない。
const GA4_MEASUREMENT_ID = /^G-[A-Z0-9]+$/;

/** 前後の空白と改行を取り除き、GA4 の測定 ID の形でなければ空文字にする */
export function normalizeGa4Id(raw: string | undefined): string {
  const id = (raw ?? '').trim();
  return GA4_MEASUREMENT_ID.test(id) ? id : '';
}

export function resolveAnalyticsTags(enabled: boolean, env: AnalyticsEnv): AnalyticsTags {
  if (!isAnalyticsEnabled(enabled)) {
    return { cfBeaconToken: '', clarityId: '', ga4Id: '' };
  }
  return {
    cfBeaconToken: env.PUBLIC_CF_BEACON_TOKEN ?? '',
    clarityId: env.PUBLIC_CLARITY_ID ?? '',
    ga4Id: normalizeGa4Id(env.PUBLIC_GA4_ID),
  };
}
