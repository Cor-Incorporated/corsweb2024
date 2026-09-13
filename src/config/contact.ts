// お問い合わせ AI チャットの機能フラグ。
//
// false（既定）: ContactChat は描画しない。/contact の見え方は CLOUDIA_CONTACT_PRIMARY_ENABLED
//               に従う（既定では Cloudia のみ。電話は取り下げ、フォームは描画しない）。
// 注意: この定数を true にすると ContactChat.astro が最初の分岐で描画されるが、同コンポーネントは
//       <form> を持たない一方で intro / piiNotice / readyNotice が「フォーム」を案内する文言のまま。
//       有効化する際は必ずそれらの文言を先に直すこと。
// true        : AI チャット ウィジェット（ContactChat.astro）を描画する。
//
// バックエンド Worker（workers/contact-chat/, cor-jp.com/api/contact/*）が
// 本番にデプロイ・検証されるまでは必ず false のままにすること。
// 本番切替はこの 1 行を true にするだけ（デプロイ + 動作確認の後に行う）。
export const CONTACT_CHAT_ENABLED = false;

// Cloudia を /contact/ の主導線にする。false に戻すと既存フォームをページ本体へ戻せる。
// Cloudia 自体の停止時に、既存の ContactForm fallback を残したまま切り戻すためのビルド時フラグ。
//
// 重要: Cloudia が主導線のとき（＝既定）、ContactForm はページに描画しない。Cloudia が
// 導線であり、フォームは出さない方針のため。ただしコンポーネントは残す。このフラグを false に
// した瞬間にフォームが非常口として復活する必要があり、消すとこの切り戻し自体が空振りになる。
export const CLOUDIA_CONTACT_PRIMARY_ENABLED =
  import.meta.env.PUBLIC_CLOUDIA_CONTACT_PRIMARY_ENABLED !== 'false';

// AI 自動音声で応対するコールセンター。表示用の番号は i18n（contactInfo.phone.value）側で
// ロケール別に持つ（ja は国内表記、他は +81 表記）。href は国際表記で統一し、海外からの
// 発信でも繋がるようにする。
export const CALL_CENTER_TEL_HREF = 'tel:+817085611659';

// /contact に電話導線を出すかどうか。false の間は番号・tel リンク・注記をまとめて描画しない。
// 番号だけ隠すと「担当者から折り返します」の注記だけが残り、何の導線か分からないカードになるため、
// カードごと落とす。番号自体は i18n（contactInfo.phone）と特商法ページに残しているので、
// この定数を true に戻すだけで復帰できる。
export const CALL_CENTER_PHONE_VISIBLE = false;

// 代表スケジュールのカレンダーは PUBLIC_GCAL_ID 依存で、未設定だと描画されない
// （CI の visual-text は空文字で流している）。説明文が「打ち合わせ可能な時間を確認できる」と
// 述べる以上、同じ条件を参照しないと中身と文言が食い違う。判定はここに集約する。
export const CONTACT_CALENDAR_VISIBLE = !!import.meta.env.PUBLIC_GCAL_ID;

// CloudiaLauncher は既存フォームを残したまま、Cloudia への入口だけを追加する。
// CONTACT_CHAT_ENABLED（旧ContactChat.astroの置換）とは独立して切り替える。
// 未指定時は有効。無効化する場合は PUBLIC_CLOUDIA_LAUNCHER_ENABLED=false をビルド時に設定する。
export const CLOUDIA_LAUNCHER_ENABLED = import.meta.env.PUBLIC_CLOUDIA_LAUNCHER_ENABLED !== 'false';

// Cloudia iframe から受け取る Grift 公開ポータル URL の許可 origin。
// Preview を追加する場合は、path や query を含まない HTTPS origin をカンマ区切りで指定する。
const DEFAULT_GRIFT_HANDOFF_ORIGIN = 'https://app.griftai.org';

export const CLOUDIA_GRIFT_HANDOFF_MAX_TTL_MS = 24 * 60 * 60 * 1000;

function normalizeAllowedHttpsOrigin(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function getCloudiaGriftHandoffAllowedOrigins(): readonly string[] {
  const configured = (import.meta.env.PUBLIC_GRIFT_HANDOFF_ALLOWED_ORIGINS || '')
    .split(',')
    .map(normalizeAllowedHttpsOrigin)
    .filter((origin: string | null): origin is string => origin !== null);

  return [...new Set([DEFAULT_GRIFT_HANDOFF_ORIGIN, ...configured])];
}

export const CLOUDIA_GRIFT_HANDOFF_ALLOWED_ORIGINS = getCloudiaGriftHandoffAllowedOrigins();
