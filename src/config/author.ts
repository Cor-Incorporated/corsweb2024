/**
 * ブログ著者（Person）の正本（H3）。著者ボックス・Article.author・Organization.founder がここを読む。
 *
 * 事実の出典（推測で足さない。変えるときは出典側も確認する）:
 * - 日本語名「寺田 康佑」/ 役職: privacy.businessTable・security.basicPolicy.signatureName（5 言語）
 * - 英字名「Kousuke Terada」: i18n teamData.name（5 言語）。Git の作者名 "Terada Kousuke"、LinkedIn / Facebook の
 *   URL（kousuketerada / kousuke.terada）とも一致するため、en/es の "Kosuke" 表記はこちらに統一した
 * - 韓国語表記「데라다 코스케」: ko の privacy / security / aboutPage.founderLead
 * - 写真 /assets/k-terada.avif と紹介文: i18n teamData（紹介文は teamData から読む）
 * - ハンドル「Terisuke」: 全記事の frontmatter author。X アカウント cor_terisuke
 * - sameAs: 以前 Organization.sameAs に載っていた代表個人のアカウント（LinkedIn は kousuketerada を採用。
 *   2025-09-23 に sameAs を見直した際も残った側。記事側の teradakousuke は 2025-06-22 以降の機械的な複写）
 */
import { getLocalizedUrl, getTranslations, type Locale } from '../utils/i18n';
import { ORGANIZATION_ID, SITE_ORIGIN } from './organization';

export type AuthorProfile = {
  /** URL / @id 用の識別子 */
  id: string;
  /** schema.org の @id（https://cor-jp.com/#person-<id>） */
  personId: string;
  /** frontmatter の author に書かれる値（大文字小文字は区別しない） */
  handles: readonly string[];
  /** 画面表示と JSON-LD の name（ロケール別） */
  names: Record<Locale, string>;
  jobTitles: Record<Locale, string>;
  /** 同一人物の別表記（JSON-LD の alternateName） */
  alternateNames: readonly string[];
  image: string;
  /** プロフィールのあるページ（ロケールで接頭辞を付ける） */
  profilePath: string;
  sameAs: readonly string[];
};

export const KOUSUKE_TERADA: AuthorProfile = {
  id: 'kousuke-terada',
  personId: `${SITE_ORIGIN}/#person-kousuke-terada`,
  handles: ['terisuke'],
  names: {
    ja: '寺田 康佑',
    zh: '寺田 康佑',
    ko: '데라다 코스케',
    en: 'Kousuke Terada',
    es: 'Kousuke Terada',
  },
  jobTitles: {
    ja: '代表取締役',
    zh: '代表董事',
    ko: '대표이사',
    en: 'Representative Director',
    es: 'Director Representante',
  },
  alternateNames: ['寺田康佑', '寺田 康佑', 'テラダコウスケ', 'Kousuke Terada', '데라다 코스케', 'terisuke'],
  image: '/assets/k-terada.avif',
  profilePath: '/about/#founder-story',
  sameAs: [
    'https://x.com/cor_terisuke',
    'https://www.linkedin.com/in/kousuketerada/',
    'https://www.facebook.com/kousuke.terada.35',
    'https://qiita.com/terisuke',
  ],
};

const AUTHORS: readonly AuthorProfile[] = [KOUSUKE_TERADA];

/** frontmatter の author（例: "Terisuke"）から著者プロフィールを引く。未登録なら undefined。 */
export function findAuthor(handle: string | undefined): AuthorProfile | undefined {
  const key = (handle ?? '').trim().toLowerCase();
  return AUTHORS.find((author) => author.handles.includes(key));
}

/** 紹介文は i18n の teamData（写真で同一人物を特定）から読む。二重管理しない。 */
export function authorBio(author: AuthorProfile, locale: Locale): string | undefined {
  const members = getTranslations(locale).teamData as readonly { image?: string; description?: string }[];
  return members.find((member) => member.image === author.image)?.description;
}

export function authorProfileUrl(author: AuthorProfile, locale: Locale): string {
  return `${SITE_ORIGIN}${getLocalizedUrl(author.profilePath, locale)}`;
}

/** Person JSON-LD（記事ページに出し、Article.author から @id で参照する）。 */
export function buildPersonJsonLd(author: AuthorProfile, locale: Locale): Record<string, unknown> {
  const bio = authorBio(author, locale);
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': author.personId,
    name: author.names[locale],
    alternateName: author.alternateNames.filter((name) => name !== author.names[locale]),
    jobTitle: author.jobTitles[locale],
    worksFor: { '@id': ORGANIZATION_ID },
    image: `${SITE_ORIGIN}${author.image}`,
    url: authorProfileUrl(author, locale),
    ...(bio && { description: bio }),
    sameAs: [...author.sameAs],
  };
}
