import {
  CLOUDIA_UNAVAILABLE_COPY,
  UNAVAILABLE_LOCALES,
  type UnavailableLocale,
} from './cloudiaUnavailableCopy';

/** 電話の表示と発信の値。呼ぶ側が既存の定義（locale の表示値と tel の href）から渡す。 */
export interface UnavailablePhone {
  display: string;
  href: string;
}

export interface UnavailablePhoneLine {
  lead: string;
  label: string;
  display: string;
  href: string;
}

export interface UnavailableNotice {
  /** 枠の中の終わりの文（frame-failed）か、受け付けられないと分かる終わりの文（unavailable）。 */
  message: string;
  /** frame-failed のときだけ。別の画面で開く link。 */
  separate?: { label: string; href: string };
  /** 電話の行。定数が true で、番号の形が正しいときだけ。 */
  phone?: UnavailablePhoneLine;
}

const TEL_HREF = /^tel:\+[0-9]{8,15}$/;

export function unavailableLocale(raw: string): UnavailableLocale {
  return (UNAVAILABLE_LOCALES as readonly string[]).includes(raw) ? (raw as UnavailableLocale) : 'ja';
}

function phoneLine(
  locale: UnavailableLocale,
  phoneVisible: boolean,
  phone: UnavailablePhone | undefined,
): UnavailablePhoneLine | undefined {
  if (!phoneVisible || !phone) return undefined;
  const display = phone.display.trim();
  if (!display || !TEL_HREF.test(phone.href)) return undefined;
  const copy = CLOUDIA_UNAVAILABLE_COPY[locale];
  return { lead: copy.phoneLead, label: copy.phoneLabel, display, href: phone.href };
}

export function buildUnavailableNotice(input: {
  kind: 'frame-failed' | 'unavailable';
  locale: UnavailableLocale;
  phoneVisible: boolean;
  phone?: UnavailablePhone;
  separateHref?: string;
}): UnavailableNotice {
  const copy = CLOUDIA_UNAVAILABLE_COPY[input.locale];
  const phone = phoneLine(input.locale, input.phoneVisible, input.phone);
  const base: UnavailableNotice = phone ? { message: '', phone } : { message: '' };
  if (input.kind === 'frame-failed' && input.separateHref) {
    return {
      ...base,
      message: copy.frameFailed,
      separate: { label: copy.openSeparately, href: input.separateHref },
    };
  }
  return { ...base, message: copy.unavailable };
}
