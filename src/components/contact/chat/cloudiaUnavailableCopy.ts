/**
 * Cloudia（問い合わせのチャット）が開けないときに出す文と、電話の行を出すかどうかの定数。
 * 浮きボタン（CloudiaLauncher）、/contact/chat/ の代わりのページ、contact-edge の Worker が同じ値を読む。
 *
 * この file は文と定数だけを持つ。サイトや Astro の import を持たない（Worker の bundle にも入るため）。
 * 番号はここに書かない。表示は locale の `contactInfo.phone.value`、発信は `CALL_CENTER_TEL_HREF` から読む。
 */

/**
 * 終わりの文に電話の行を添えるか。既定は出さない（`CALL_CENTER_PHONE_VISIBLE` と同じ値）。
 * 浮きボタン・代わりのページ・contact-edge の 3 か所とも、この値だけで切り替える。
 */
export const CLOUDIA_UNAVAILABLE_PHONE_VISIBLE: boolean = false;

export const UNAVAILABLE_LOCALES = ['ja', 'en', 'zh', 'ko', 'es'] as const;
export type UnavailableLocale = (typeof UNAVAILABLE_LOCALES)[number];

export interface UnavailableCopy {
  /** 枠の中だけで開けないとき。別の画面で開き直せることを伝える。 */
  frameFailed: string;
  /** 別の画面で開く link の文言。 */
  openSeparately: string;
  /** Cloudia が配られない・描かれないとき。受け付けられないと分かる形で止める。 */
  unavailable: string;
  /** 電話の行の前の文。電話の受付は AI が応対する。人が出るとは書かない。 */
  phoneLead: string;
  /** 電話の番号の前の見出し。 */
  phoneLabel: string;
}

export const CLOUDIA_UNAVAILABLE_COPY: Record<UnavailableLocale, UnavailableCopy> = {
  ja: {
    frameFailed: 'この枠ではチャットを開けませんでした。別の画面で開き直してください。',
    openSeparately: 'チャットを別の画面で開く',
    unavailable: '現在AIチャットをご利用いただけません。お手数ですが、時間をおいて再度お試しください。',
    phoneLead: 'お電話でもお問い合わせいただけます（AI が音声で応対します）。',
    phoneLabel: '電話',
  },
  en: {
    frameFailed: 'The chat could not open in this panel. Please reopen it on a separate page.',
    openSeparately: 'Open the chat on a separate page',
    unavailable: 'The AI chat cannot be reached right now. Please try again in a little while.',
    phoneLead: 'You can also contact us by phone (an AI voice assistant answers).',
    phoneLabel: 'Phone',
  },
  zh: {
    frameFailed: '无法在此窗口中打开聊天。请在单独的页面中重新打开。',
    openSeparately: '在单独的页面中打开聊天',
    unavailable: '目前无法使用 AI 聊天。请稍后再试。',
    phoneLead: '您也可以通过电话咨询（由 AI 语音应答）。',
    phoneLabel: '电话',
  },
  ko: {
    frameFailed: '이 창에서 채팅을 열 수 없습니다. 별도 페이지에서 다시 열어 주세요.',
    openSeparately: '별도 페이지에서 채팅 열기',
    unavailable: '현재 AI 채팅을 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    phoneLead: '전화로도 문의하실 수 있습니다(AI 음성이 응대합니다).',
    phoneLabel: '전화',
  },
  es: {
    frameFailed: 'No se pudo abrir el chat en este panel. Vuelva a abrirlo en una página aparte.',
    openSeparately: 'Abrir el chat en una página aparte',
    unavailable: 'El chat con IA no está disponible en este momento. Vuelva a intentarlo en un rato.',
    phoneLead: 'También puede contactarnos por teléfono (responde un asistente de voz con IA).',
    phoneLabel: 'Teléfono',
  },
};
