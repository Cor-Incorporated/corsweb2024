export const DOCUMENT_LOCALES = ['ja', 'en', 'zh', 'ko', 'es'] as const;
export type DocumentLocale = (typeof DOCUMENT_LOCALES)[number];

export interface DocumentRequestCopy {
  title: string;
  deckLink: string;
  deckNote: string;
  receiptLabel: string;
  success: string;
  duplicate: string;
  notifyPending: string;
  errorName: string;
  errorEmail: string;
  errorConsent: string;
  errorIndustry: string;
  errorInvalid: string;
  errorStorage: string;
  errorRate: string;
}

/** 画面の i18n と同じ文。パリティテストが locales/*.json の documentRequest と照合する。 */
export const DOCUMENT_REQUEST_COPY: Record<DocumentLocale, DocumentRequestCopy> = {
  ja: {
    title: '会社紹介資料の請求',
    deckLink: '申し込みなしで見る',
    deckNote: 'このリンクは公開のスライドです。請求の記録とは別です。',
    receiptLabel: '受付番号',
    success: '請求を記録しました。受付番号は次のとおりです。資料は送っていません。',
    duplicate: '同じ日の同じメールアドレスの請求は、すでに記録があります。受付番号は次のとおりです。資料は送っていません。',
    notifyPending: '社内への連絡は、まだ送っていません。記録は残っています。',
    errorName: '氏名を入れてください。',
    errorEmail: 'メールの形式を確認してください。',
    errorConsent: '同意がないと記録できません。',
    errorIndustry: '業種は、表示されている5つのうちから選びます。',
    errorInvalid: '入力を確認して、もう一度送ってください。',
    errorStorage: '記録できませんでした。時間をおいて、もう一度送ってください。',
    errorRate: '短時間に送りすぎています。時間をおいて、もう一度送ってください。',
  },
  en: {
    title: 'Request the company introduction',
    deckLink: 'View without a request',
    deckNote: 'This link opens the public slides. It is separate from the request record.',
    receiptLabel: 'Receipt number',
    success: 'The request is recorded. The receipt number is below. The slides were not sent.',
    duplicate: 'A request with this email address is already recorded for today. The receipt number is below. The slides were not sent.',
    notifyPending: 'The internal notice has not been sent. The record remains.',
    errorName: 'Enter a name.',
    errorEmail: 'Check the email address.',
    errorConsent: 'The request cannot be recorded without consent.',
    errorIndustry: 'Choose one of the five industries shown.',
    errorInvalid: 'Check the form and send it again.',
    errorStorage: 'The request was not recorded. Wait and send it again.',
    errorRate: 'Too many requests in a short time. Wait and send it again.',
  },
  zh: {
    title: '索取公司介绍资料',
    deckLink: '不申请，直接查看',
    deckNote: '这个链接打开的是公开幻灯片，和申请记录不是一回事。',
    receiptLabel: '受理编号',
    success: '已记录申请。受理编号如下。资料尚未寄出。',
    duplicate: '这个邮箱今天已经有一条申请记录。受理编号如下。资料尚未寄出。',
    notifyPending: '尚未发送内部通知。记录还在。',
    errorName: '请填写姓名。',
    errorEmail: '请核对邮箱格式。',
    errorConsent: '没有同意，就不能记录。',
    errorIndustry: '请从列出的五个行业中选择。',
    errorInvalid: '请核对输入后再发送。',
    errorStorage: '没有记录下来。请稍后再发送。',
    errorRate: '短时间内发送次数过多。请稍后再发送。',
  },
  ko: {
    title: '회사 소개 자료 청구',
    deckLink: '신청 없이 보기',
    deckNote: '이 링크는 공개 슬라이드입니다. 청구 기록과는 별개입니다.',
    receiptLabel: '접수 번호',
    success: '청구를 기록했습니다. 접수 번호는 아래와 같습니다. 자료는 보내지 않았습니다.',
    duplicate: '같은 날의 같은 메일 주소로 된 청구가 이미 있습니다. 접수 번호는 아래와 같습니다. 자료는 보내지 않았습니다.',
    notifyPending: '사내 연락은 아직 보내지 않았습니다. 기록은 남아 있습니다.',
    errorName: '이름을 입력하세요.',
    errorEmail: '메일 형식을 확인하세요.',
    errorConsent: '동의가 없으면 기록할 수 없습니다.',
    errorIndustry: '표시된 5개 업종 중에서 고르세요.',
    errorInvalid: '입력을 확인하고 다시 보내세요.',
    errorStorage: '기록하지 못했습니다. 잠시 뒤 다시 보내세요.',
    errorRate: '짧은 시간에 너무 많이 보냈습니다. 잠시 뒤 다시 보내세요.',
  },
  es: {
    title: 'Solicitud del material de presentación',
    deckLink: 'Ver sin solicitud',
    deckNote: 'Este enlace abre las diapositivas públicas. No es el registro de la solicitud.',
    receiptLabel: 'Número de recepción',
    success: 'La solicitud quedó registrada. El número de recepción está debajo. El material no se envió.',
    duplicate: 'Ya hay una solicitud registrada hoy con este correo. El número de recepción está debajo. El material no se envió.',
    notifyPending: 'El aviso interno no se ha enviado. El registro sigue guardado.',
    errorName: 'Escriba el nombre.',
    errorEmail: 'Revise el correo.',
    errorConsent: 'Sin consentimiento no se puede registrar.',
    errorIndustry: 'Elija uno de los cinco sectores que se muestran.',
    errorInvalid: 'Revise los datos y envíe de nuevo.',
    errorStorage: 'No se registró. Espere y envíe de nuevo.',
    errorRate: 'Ha enviado demasiadas veces en poco tiempo. Espere y envíe de nuevo.',
  },
};
