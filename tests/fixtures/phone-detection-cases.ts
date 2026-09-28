// 電話の判定（docs/adr/ADR-0021-contact-guard-phone-detection.md）の実例。
// 見逃し・誤検知が見つかったら、ここに 1 行足すだけでよい。src/config/__tests__/contact-guards.test.ts が
// 全件を検査する（DETECT は検出すること、IGNORE は検出しないこと）。
// html は <main> の中にそのまま入れる HTML 断片（文字参照やタグで分断された表記も書ける）。番号はすべて架空。

export type DetectionCase = readonly [note: string, html: string];
export type LocalizedCase = readonly [locale: string, html: string];

/** 電話番号として検出するもの（findPhoneLeads / findPhoneInquiryLeads の kind 'number'）。 */
export const PHONE_NUMBER_DETECT: readonly DetectionCase[] = [
  ['国内・ハイフン', '070-0000-0000'],
  ['国内・市外局番 3 桁', '092-000-0000'],
  ['フリーダイヤル', '0120-000-000'],
  ['+81・ハイフン', '+81-70-0000-0000'],
  ['+81・空白', '+81 70 0000 0000'],
  ['+81 (0)', '+81(0)70-0000-0000'],
  ['全角', '０９２－０００－００００'],
  ['空白区切り', '092 000 0000'],
  ['市外局番の括弧', '(092) 000-0000'],
  ['区切りなし', '0920000000'],
  ['en dash', '092–000–0000'],
  ['U+2010 のハイフン', '092‐000‐0000'],
  ['全角の＋', '＋81-92-000-0000'],
  ['ドット区切り', '092.000.0000'],
  ['日本語の直後', '電話092-000-0000'],
  ['タグで分断', '<span>092</span>-000-0000'],
  // #331 最終レビュー MEDIUM-1: 6fb4722 では検出していたのに 8845499 で見逃すようになった退行
  ['英字ラベル直結 TEL', 'TEL092-000-0000'],
  ['英字ラベル直結 Tel', 'Tel092-000-0000'],
  ['ラベル FAX/TEL', 'FAX/TEL092-000-0000'],
  ['℡（NFKC で TEL）', '℡092-000-0000'],
  ['ラベル TEL.', 'TEL.092-000-0000'],
  // #331 最終レビュー LOW-1: 以前からの見逃し
  ['中間群の括弧', '03(1234)5678'],
  ['U+2212 の区切り', '092−000−0000'],
  ['U+30FC の区切り', '092ー000ー0000'],
  ['U+2015 の区切り', '092―000―0000'],
  ['NBSP の区切り（文字参照）', '092&nbsp;000&nbsp;0000'],
  ['空白付きハイフン', '092 - 000 - 0000'],
];

/** 電話番号として検出しないもの。 */
export const PHONE_NUMBER_IGNORE: readonly DetectionCase[] = [
  ['日付', '2026-09-27'],
  ['時刻付き日付', '2026-09-27T12:00:00+09:00'],
  ['月-日-年の日付', '更新日 09-27-2026'],
  ['es の日付', 'Fecha: 05-12-2025'],
  ['英数字の ID', 'id=A012-34-5678'],
  ['英単語の途中（hotel）', 'hotel0120-000-000'],
  ['英単語の途中（Intel）', 'Intel090-0000-0000'],
  ['版番号', 'ver 0.12-3-456'],
  ['郵便番号と番地', '810-0001 福岡県 福岡市 中央区天神2丁目3-10'],
  ['パスデータ風の本文', 'M1.05-12-345 0-1.5-2L10.0-120-3456'],
  ['base64 風の本文', 'AB+81Cd9+8100a/+81234=='],
  ['SVG のパスデータ（属性）', '<svg><path d="M1.05-12-345 0-1.5-2L10.0-120-3456"></path></svg>'],
  // 静的な照合では data-* を対象にしない。スクリプトが実行時に表示する文言（CloudiaLauncher の
  // data-fallback-same-page など）は、dist 検査でスクリプトを実行した後の DOM で見る（ADR-0021 §1）。
  ['data-* 属性の値（静的な照合では対象外）', '<div data-tel="092-000-0000"></div>'],
  ['表のセルをまたぐ数字', '<table><tr><td>092</td><td>000-0000</td></tr></table>'],
];

/** /privacy の句として検出するもの（findPhoneInquiryPhrases）。 */
export const PHONE_INQUIRY_PHRASE_DETECT: readonly LocalizedCase[] = [
  // #331 再レビュー LOW-2
  ['ja', '電話受付：平日10時〜17時'],
  ['ja', '電話によるお問い合わせも可能です'],
  ['ja', '電話で問合せいただけます'],
  ['ja', '苦情窓口（電話）'],
  ['en', 'telephone inquiries are accepted'],
  ['es', 'atención telefónica'],
  ['ko', '전화나 이메일로 문의'],
  ['zh', '也可来电咨询'],
  ['zh', '也可以通过邮件或电话与我们联系'], // 「或电话」だけが拾う（他の句では拾えない）
  ['zh', '也可透過郵件或電話與我們聯繫'], // 「或電話」だけが拾う
  // #331 最終レビュー LOW-2
  ['ja', 'お<strong>電話</strong>でのお問い合わせも承ります'],
  ['ja', '電話受付：平日10時〜17時（営業時間外は受け付けておりません）'],
  ['ja', 'お電話でもご予約いただけます（メールでの予約変更はできません）'],
  ['en', 'We also take phone calls on weekdays'],
  ['en', 'Please give us a call'],
  ['en', 'You can reach us by&nbsp;phone'],
  ['es', 'También aceptamos una llamada telefónica'],
  ['ko', '궁금하신 점은 전화 주세요'],
  ['zh', '欢迎打电话'],
  ['zh', '欢迎电话垂询'],
];

/** /privacy の判定（句・電話番号・tel:）で検出しないもの（findPhoneInquiryLeads）。 */
export const PHONE_INQUIRY_PHRASE_IGNORE: readonly LocalizedCase[] = [
  // 収集項目としての「電話番号」（語レベルなら拾うが、/privacy では正当な記載）
  ['ja', '氏名・会社名・部署・役職・メールアドレス・電話番号・取引に関する情報等'],
  ['ja', 'お電話番号をお預かりします'],
  ['en', 'Name, company name, department, job title, email address, telephone number, information'],
  ['zh', '姓名、公司名称、部门、职务、电子邮箱地址、电话号码、与交易相关的信息等'],
  ['ko', '성명·회사명·부서·직책·이메일 주소·전화번호·거래에 관한 정보 등'],
  ['es', 'Nombre, empresa, departamento, cargo, correo electrónico, número de teléfono, información'],
  // #331 再レビュー LOW-2 の誤検知
  ['zh', '电子邮箱或电话号码'],
  ['zh', '電子郵件或電話號碼'],
  ['en', 'email or phone number'],
  ['es', 'correo o número de teléfono'],
  ['ko', '이메일 또는 전화번호'],
  // ja の否定（句の直後の否定だけを除外する）
  ['ja', '電話でのお問い合わせは受け付けておりません'],
  ['ja', 'お電話でのお問い合わせは受け付けておりません'],
];
