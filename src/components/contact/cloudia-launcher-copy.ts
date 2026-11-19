import type { Locale } from '../../utils/i18n';

// 右下の浮きボタン（CloudiaLauncher.astro）の文字の定義。試験から読めるようにここへ切り出した。
// 開く前の文字（label・title）は業界 page の CTA（locales の industryXxx.proposal.cta.primary）と
// 同じ文字を 2 か所で定義しているため、片方だけ直って食い違わないよう、
// __tests__/cloudia-cta-copy.test.ts が両者を結んでいる。
// 以前は ja/非ja の 2 分岐で、zh・ko・es のページでは英語のボタンが出ていた。
// satisfies により、6 言語目を足したときに翻訳漏れが型エラーになる。
export type LauncherCopy = {
  label: string;
  title: string;
  close: string;
  // 開いている間の右下のボタンの文言。× ボタン（close）と同じ名前にすると、読み上げで 2 つの「閉じる」が並ぶ。
  closeLauncher: string;
};

export const LAUNCHER_COPY = {
  ja: {
    label: 'お問い合わせ（AI受付）',
    title: 'お問い合わせ（AI受付）',
    close: '閉じる',
    closeLauncher: 'お問い合わせを閉じる',
    // Cloudia が開けないときの文は ./chat/cloudiaUnavailableCopy.ts に置く（代わりのページと contact-edge と共通）。
  },
  en: {
    label: 'Contact us (AI reception)',
    title: 'Contact us (AI reception)',
    close: 'Close',
    closeLauncher: 'Close contact',
  },
  zh: {
    label: '联系我们（AI 接待）',
    title: '联系我们（AI 接待）',
    close: '关闭',
    closeLauncher: '关闭联系窗口',
  },
  ko: {
    label: '문의하기 (AI 접수)',
    title: '문의하기 (AI 접수)',
    close: '닫기',
    closeLauncher: '문의 닫기',
  },
  es: {
    label: 'Contacto (recepción con IA)',
    title: 'Contacto (recepción con IA)',
    close: 'Cerrar',
    closeLauncher: 'Cerrar contacto',
  },
} as const satisfies Record<Locale, LauncherCopy>;
