/**
 * Grift（Cor. の OSS CLI。griftai.org）の用語の表と、その訳を固定する手順。
 *
 * 社名・代表の氏名（glossary.mjs）と同じく、訳をモデル任せにしない:
 *   1. 翻訳前に、ja 側の用語を保護トークン ⟦G…⟧ に置き換えてモデルに渡さない
 *      （本文は markdown.mjs の protect()、frontmatter は translate.mjs の protectPayloadNames()）
 *   2. 翻訳後に、トークンを翻訳先言語の正式表記へ戻す（restore / expandTokens に lang を渡す）。
 *      en / es は、文の頭（行の頭・表のセルの頭・文末の句読点の後。en はコロンの後も）だけ 1 文字目を大文字にする
 *   トークンの欠落・重複は既存のプレースホルダ検証（validate.mjs）で落とす。
 *
 * 社名と違うところ:
 *   - Grift の記事でだけ固定する（ja の tags に「Grift」がある記事。isGriftArticle。「作業領域」「検査値」などは
 *     一般の言葉でもあり、ほかの記事では別の意味で使いうるため）
 *   - モデルが自分で書いた訳語はそろえない（言い換えに際限が無い。代わりにトークンが全部残ることを検証で確かめる）
 *   - 記事に出る用語と、その正式表記は、来歴のハッシュ（hash.mjs の translatableSource）に入る。表の値を変えると、
 *     その用語を含む記事の訳は stale になる。docs/i18n-translation.md 6 章のバックフィルで訳し直す
 *
 * 正本（照合は __tests__/grift-terms-link.test.mjs。別のリポジトリなので、値と出典の path・commit をテストに写してある）:
 *   - ja: griftai（Cor-Incorporated/griftai）の src/config/tep.ts。サイトの用語（site。site の無い項目は plain）
 *   - en: grift-cli の docs/en/metrics-guide.md（Markdown の観点の表の Site term と、survival の節の Code recency）と、
 *         docs/metrics-guide.md の対応表の「CLI の語」（英語の文書は、サイトの用語をこの語で呼ぶ）
 *   - es / ko / zh: 正本が無い。事例ページ（src/content/cases/ja/grift.md）の対応表と本文の訳（翻訳 CI の訳）を固定した。
 *     null は（未決）で、en の表記を使う（2026-10-26 時点では「コードの新しさ」。今の訳の「신선도」「新鲜度」は
 *     freshness の意味で、「定着率」を改めたときに退けた読みのため）
 * en / es は、文の途中での形（小文字始まり）で書く。大文字で書いた形（Code recency）は文の途中でも大文字のまま。
 */
import { TARGET_LANGS } from './config.mjs';

/** Grift の用語。id は来歴のハッシュに入る識別子なので変えない（変えるとその用語を含む記事の訳が stale になる）。 */
export const GRIFT_TERMS = Object.freeze(
  [
    {
      id: 'observed-value',
      ja: '検査値',
      // CLI の語は observed（kind: "observed" の value）。訳の文では複数形で使う（「確かめられる事実（検査値）」）
      en: 'observed values',
      es: 'valores de inspección',
      ko: '검사값',
      zh: '检查值',
    },
    {
      id: 'test-cochange',
      ja: 'テスト併修率',
      en: 'test co-change',
      es: 'tasa de modificación conjunta de pruebas',
      ko: '테스트 동시 수정률',
      zh: '测试伴随修改率',
    },
    {
      id: 'corrective-rework',
      ja: '手戻り率',
      en: 'corrective rework',
      es: 'tasa de retrabajo',
      ko: '재작업률',
      zh: '返工率',
    },
    {
      id: 'path-retouch',
      ja: '磨き直し',
      en: 'path retouch',
      es: 'retoque',
      ko: '재접촉',
      zh: '修缮重触',
    },
    {
      id: 'code-recency',
      ja: 'コードの新しさ',
      en: 'Code recency',
      es: null,
      ko: null,
      zh: null,
    },
    {
      id: 'work-surface',
      ja: '作業領域',
      en: 'work surface',
      es: 'áreas de trabajo',
      ko: '작업 영역',
      zh: '工作领域',
    },
    {
      id: 'change-rhythm',
      ja: '変更リズム',
      en: 'change rhythm',
      es: 'ritmo de cambios',
      ko: '변경 리듬',
      zh: '变更节奏',
    },
    {
      id: 'verification-profile',
      ja: '検証の形',
      en: 'verification profile',
      es: 'forma de verificación',
      ko: '검증 형태',
      zh: '验证形态',
    },
  ].map((term) => Object.freeze(term))
);

const TERM_BY_JA = new Map(GRIFT_TERMS.map((term) => [term.ja, term]));

/** 用語の翻訳先言語の正式表記（null の言語は en の表記）。 */
export function griftTermForm(ja, lang) {
  const term = TERM_BY_JA.get(ja);
  if (!term) throw new Error(`Grift の用語ではありません: ${ja}`);
  if (!TARGET_LANGS.includes(lang))
    throw new Error(`Grift の用語の表記が未定義の言語です: ${lang}`);
  return term[lang] ?? term.en;
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 語の後に続くと、別の語の一部になる文字（「検証の形式」「作業領域内」など）。どの語にも効かせる
const COMPOUND_NEXT = '\\p{Script=Han}\\p{Script=Katakana}ー';
// 動詞としても使う語だけ、活用した形（「磨き直した」「磨き直して」「磨き直します」）も外す。
// 「作業領域までを見る」「検査値または」のように、ほかの語の後の「た」「て」「ま」は用語のまま
const VERB_ENDINGS = Object.freeze({ 磨き直し: 'たてま' });

/**
 * ja 側に現れる Grift の用語。長い語から順に試す。語の後に漢字・カタカナが続く場合（別の語の一部）と、
 * 「磨き直し」の動詞の活用（VERB_ENDINGS）は用語として扱わない。
 */
export const SOURCE_GRIFT_TERM_PATTERN = new RegExp(
  `(?:${[...TERM_BY_JA.keys()]
    .sort((a, b) => b.length - a.length)
    .map((ja) => `${escapeRegExp(ja)}(?![${COMPOUND_NEXT}${VERB_ENDINGS[ja] ?? ''}])`)
    .join('|')})`,
  'gu'
);

/** markdown.mjs と translate.mjs が名前の表（glossary.mjs の NAME_TOKENS）の後に適用する、用語のトークンの定義。 */
export const GRIFT_TERM_TOKEN = Object.freeze({
  kind: 'grift-term',
  prefix: 'G',
  pattern: SOURCE_GRIFT_TERM_PATTERN,
});

/** Grift の記事に付ける ja の tag。 */
export const GRIFT_ARTICLE_TAG = 'Grift';

/**
 * 用語を固定する記事か（Grift の記事）。ja の frontmatter の tags に「Grift」（完全一致）がある記事。
 * 本文に「Grift」が出るかでは決めない（記事の末尾の事業の一覧など、Grift の記事でなくても「Grift」は出る）。
 * @param {{ tags?: unknown }} data ja の frontmatter
 */
export function isGriftArticle(data) {
  return Array.isArray(data?.tags) && data.tags.some((tag) => String(tag) === GRIFT_ARTICLE_TAG);
}

/**
 * 記事に出る Grift の用語（表の順）。Grift の記事でなければ空。
 * @param {{ tags?: unknown }} data ja の frontmatter（isGriftArticle で判定する）
 * @param {{ fields: Record<string, string>, tags?: string[], body: string }} source
 *   hash.mjs の translatableSource と同じ形（訳すフィールド・訳す tags・本文）
 * data.tags は Grift の記事かどうかを決めるだけで、用語を探すのは source（tags を訳すコレクションでは source.tags も）。
 */
export function griftTermsIn(data, source) {
  if (!isGriftArticle(data)) return [];
  const texts = [...Object.values(source.fields), ...(source.tags ?? []), source.body];
  const found = new Set(texts.flatMap((text) => text.match(SOURCE_GRIFT_TERM_PATTERN) ?? []));
  return GRIFT_TERMS.filter((term) => found.has(term.ja));
}

/** 来歴のハッシュに入れる値: 記事に出る用語の id と、ja と各言語の正式表記。用語が無ければ null。 */
export function griftTermFingerprint(data, source) {
  const terms = griftTermsIn(data, source);
  if (terms.length === 0) return null;
  return terms.map((term) => [
    term.id,
    term.ja,
    ...TARGET_LANGS.map((lang) => griftTermForm(term.ja, lang)),
  ]);
}

// ---- 訳した後の大文字・小文字（en / es） ----------------------------------------------
const CASED_LANGS = new Set(['en', 'es']);
// 強調・引用符・開き括弧（スペイン語の ¿ ¡ を含む）は飛ばして、その前で判断する
const OPENERS_RE = /[*_~"'“‘«¿¡[]+$/;
// 行の頭（引用 > ・リストの記号・見出しの # の後）
const LINE_HEAD_RE = /^[ \t]*(?:>[ \t]*)*(?:(?:[-*+]|\d{1,9}[.)])[ \t]+)?(?:#{1,6}[ \t]+)?$/;
const CELL_HEAD_RE = /\|[ \t]*$/;
const SENTENCE_END_RE = /[.!?]["'”’»)\]]*[ \t]+$/;
const COLON_RE = /:[ \t]+$/;

/** トークンの前の文字列（同じ行の分だけ見る）から、文の頭かどうかを決める。 */
export function startsSentence(before, lang) {
  const line = before.slice(before.lastIndexOf('\n') + 1).replace(OPENERS_RE, '');
  return (
    LINE_HEAD_RE.test(line) ||
    CELL_HEAD_RE.test(line) ||
    SENTENCE_END_RE.test(line) ||
    (lang === 'en' && COLON_RE.test(line))
  );
}

/** トークンを戻す文字列。en / es で文の頭なら 1 文字目を大文字にする。 */
export function griftTermOutput(ja, lang, before) {
  const form = griftTermForm(ja, lang);
  return CASED_LANGS.has(lang) && startsSentence(before, lang)
    ? form.charAt(0).toUpperCase() + form.slice(1)
    : form;
}

/**
 * プロンプトで伝える、この記事の用語のトークンと正式表記（表記ごとにトークンをまとめる）。
 * @param {Map<string, { kind: string, original: string }>} store protect() / protectPayloadNames() の store
 * @returns {{ tokens: string[], form: string }[]}
 */
export function griftTermTokens(store, lang) {
  const byForm = new Map();
  for (const [id, entry] of store) {
    if (entry.kind !== GRIFT_TERM_TOKEN.kind) continue;
    const form = griftTermForm(entry.original, lang);
    byForm.set(form, [...(byForm.get(form) ?? []), `⟦${id}⟧`]);
  }
  return [...byForm].map(([form, tokens]) => ({ tokens, form }));
}
