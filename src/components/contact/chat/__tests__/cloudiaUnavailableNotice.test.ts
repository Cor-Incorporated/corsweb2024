import { describe, expect, it } from 'vitest';
import { CALL_CENTER_TEL_HREF } from '../../../../config/contact';
import { getTranslations } from '../../../../utils/i18n';
import {
  CLOUDIA_UNAVAILABLE_COPY,
  CLOUDIA_UNAVAILABLE_PHONE_VISIBLE,
  UNAVAILABLE_LOCALES,
} from '../cloudiaUnavailableCopy';
import { buildUnavailableNotice, unavailableLocale } from '../cloudiaUnavailableNotice';

// 番号は試験に書かない。サイトの既存の定義（発信の href と、言語ごとの表示値）を読む。
function sitePhone(locale: (typeof UNAVAILABLE_LOCALES)[number]) {
  return { display: getTranslations(locale).contactInfo.phone.value, href: CALL_CENTER_TEL_HREF };
}

const PHONE_WORDS = /電話|phone|电话|전화|teléfono|tel:/i;

describe('Cloudia が開けないときの案内', () => {
  it('電話の行は既定では出さない', () => {
    expect(CLOUDIA_UNAVAILABLE_PHONE_VISIBLE).toBe(false);
  });

  it.each(UNAVAILABLE_LOCALES)('定数が false のとき、%s の案内に番号・tel・電話の語が 1 つも無い', (locale) => {
    for (const kind of ['frame-failed', 'unavailable'] as const) {
      const notice = buildUnavailableNotice({
        kind,
        locale,
        phoneVisible: false,
        phone: sitePhone(locale),
        separateHref: '/contact/chat/?source=corsweb-launcher-fallback&locale=' + locale,
      });
      const text = JSON.stringify(notice);
      expect(notice.phone).toBeUndefined();
      expect(text).not.toMatch(PHONE_WORDS);
      expect(text).not.toContain(sitePhone(locale).display);
      expect(text.replace(/[^0-9]/g, '')).not.toContain(CALL_CENTER_TEL_HREF.replace(/[^0-9]/g, ''));
    }
  });

  it.each(UNAVAILABLE_LOCALES)('定数が true のとき、%s の案内に既存の定義の番号を添える', (locale) => {
    const notice = buildUnavailableNotice({ kind: 'unavailable', locale, phoneVisible: true, phone: sitePhone(locale) });
    expect(notice.message).toBe(CLOUDIA_UNAVAILABLE_COPY[locale].unavailable);
    expect(notice.phone).toEqual({
      lead: CLOUDIA_UNAVAILABLE_COPY[locale].phoneLead,
      label: CLOUDIA_UNAVAILABLE_COPY[locale].phoneLabel,
      display: sitePhone(locale).display,
      href: CALL_CENTER_TEL_HREF,
    });
  });

  it('発信の値の形が正しくない・表示が空のときは、定数が true でも電話の行を出さない', () => {
    for (const phone of [{ display: 'x', href: 'https://example.com' }, { display: ' ', href: CALL_CENTER_TEL_HREF }]) {
      expect(buildUnavailableNotice({ kind: 'unavailable', locale: 'ja', phoneVisible: true, phone }).phone).toBeUndefined();
    }
  });

  it('枠だけ開けないときは別の画面への link を出し、受け付けられないときは link を出さない', () => {
    const href = '/contact/chat/?source=industry-medical&locale=ja';
    const frame = buildUnavailableNotice({ kind: 'frame-failed', locale: 'ja', phoneVisible: false, separateHref: href });
    expect(frame.message).toBe(CLOUDIA_UNAVAILABLE_COPY.ja.frameFailed);
    expect(frame.separate).toEqual({ label: CLOUDIA_UNAVAILABLE_COPY.ja.openSeparately, href });
    const stop = buildUnavailableNotice({ kind: 'unavailable', locale: 'ja', phoneVisible: false, separateHref: href });
    expect(stop.message).toBe(CLOUDIA_UNAVAILABLE_COPY.ja.unavailable);
    expect(stop.separate).toBeUndefined();
  });

  it('知らない言語は ja にする', () => {
    expect(unavailableLocale('fr')).toBe('ja');
    expect(unavailableLocale('ko')).toBe('ko');
  });

  it('電話の文は、人が出る・折り返すと読める言い回しを使わない', () => {
    for (const locale of UNAVAILABLE_LOCALES) {
      expect(CLOUDIA_UNAVAILABLE_COPY[locale].phoneLead).not.toMatch(/担当|折り返|team member|call you back|staff|负责人|回电|담당|회신|equipo|devolverá/i);
    }
  });
});
