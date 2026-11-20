// 資料請求の同意の文の中のポリシーの語を、リンクにするために切り出す関数の試験。
// 見るもの: 5 言語とも切り出せて、切り出しても文面が変わらず、語は privacyLink と同じ（大文字小文字を除く）。
import { describe, expect, it } from 'vitest';
import en from '../../i18n/locales/en.json';
import es from '../../i18n/locales/es.json';
import ja from '../../i18n/locales/ja.json';
import ko from '../../i18n/locales/ko.json';
import zh from '../../i18n/locales/zh.json';
import { splitConsentAtPolicy } from '../consent-link';

type DocumentRequestCopy = { privacyLink: string; consent: string };
const LOCALES: Record<string, { documentRequest: DocumentRequestCopy }> = { ja, en, zh, ko, es };

describe('splitConsentAtPolicy', () => {
  it('finds the policy term in the consent of every language without changing the text', () => {
    for (const locale of Object.keys(LOCALES)) {
      const { consent, privacyLink } = LOCALES[locale].documentRequest;
      const parts = splitConsentAtPolicy(consent, privacyLink);
      expect(parts, locale).not.toBeNull();
      if (!parts) continue;
      expect(parts.before + parts.term + parts.after, locale).toBe(consent);
      expect(parts.term.toLowerCase(), locale).toBe(privacyLink.toLowerCase());
      expect(parts.term, locale).not.toBe('');
    }
  });

  it('uses the spelling in the consent, not the spelling of the policy term', () => {
    const parts = splitConsentAtPolicy('I have read the privacy policy.', 'Privacy policy');
    expect(parts).not.toBeNull();
    expect(parts?.term).toBe('privacy policy');
    expect(parts?.before).toBe('I have read the ');
    expect(parts?.after).toBe('.');
  });

  it('returns null when the policy term is not in the consent', () => {
    expect(splitConsentAtPolicy('I agree to this request being recorded.', 'Privacy policy')).toBeNull();
  });

  it('returns null for an empty policy term', () => {
    expect(splitConsentAtPolicy('Privacy policy', '')).toBeNull();
  });

  it('does not treat regex special characters as patterns', () => {
    expect(splitConsentAtPolicy('axb', 'a.b')).toBeNull();
    expect(splitConsentAtPolicy('a.b and axb', 'a.b')).toEqual({ before: '', term: 'a.b', after: ' and axb' });
  });

  it('splits only at the first occurrence', () => {
    expect(splitConsentAtPolicy('privacy policy and privacy policy', 'privacy policy')).toEqual({
      before: '',
      term: 'privacy policy',
      after: ' and privacy policy',
    });
  });
});
