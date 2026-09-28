// #323 背景 1 の事故入力: PR #324（commit ad40cd6）が削除した、電話での受付・連絡を案内する実際の文言。
// 句レベルの判定（PHONE_INQUIRY_PHRASE_PATTERNS）がこれらを必ず拾うことを、ユニットテストと dist の
// 注入テストの両方で固定する。現行の文言ではない（現行サイトに戻ってはならない入力）。
import type { Locale } from '../../src/utils/i18n';

type PhoneInquiryAccident = {
  /** プライバシーポリシーの苦情・相談の受付経路（src/i18n/locales/*.json から削除された値）。 */
  readonly privacy: string;
  /** カレンダー下部の注記（calendar.note から削除された値）。 */
  readonly calendarNote: string;
};

export const PHONE_INQUIRY_ACCIDENTS = {
  ja: {
    privacy:
      '個人情報の取扱いに関する苦情・ご相談は、お問い合わせページのCloudia（AIチャット）またはお電話でも承ります。',
    calendarNote: '※ ご希望の日時が見つからない場合は、お電話にてご連絡ください。',
  },
  en: {
    privacy:
      'Complaints and consultations regarding the handling of personal information are also accepted via Cloudia (AI chat) or by phone on our contact page.',
    calendarNote: '* If you cannot find a suitable time, please contact us by phone.',
  },
  zh: {
    privacy: '有关个人信息处理的投诉与咨询，也可通过咨询页面的 Cloudia（AI 聊天）或电话受理。',
    calendarNote: '※ 如未找到合适的时间，请通过电话与我们联系。',
  },
  ko: {
    privacy: '개인정보 취급에 관한 고충·상담은 문의 페이지의 Cloudia(AI 채팅) 또는 전화로도 접수합니다.',
    calendarNote: '※ 원하시는 일시를 찾을 수 없는 경우, 전화로 연락해 주십시오.',
  },
  es: {
    privacy:
      'Las reclamaciones y consultas relativas al tratamiento de información personal también se atienden a través de Cloudia (chat con IA) o por teléfono en nuestra página de contacto.',
    calendarNote: '* Si no encuentra un horario adecuado, contáctenos por teléfono.',
  },
} as const satisfies Record<Locale, PhoneInquiryAccident>;
