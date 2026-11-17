# 配置と改行の決まり（v1）

サイトと製品の画面で、文字をどこに置き、どこで行を替えるかの決まり。
全部の page・全部の製品（会社のサイト・Grift のサイト・問い合わせの chat）に当てる。

## 1. なぜ要るか

- 本文を広い箱に左揃えで流すと、画面が左に寄って見える。1 行が長すぎて読みにくい。
- 題や文が、意味の途中で切れる（例: 「…を、記録の／整理と書類づくりから。」）。
- 読み手が、1 行を 1 つの意味として読める形にする。

## 2. 基準にした実測（2026-11-17、幅 1512px の画面）

| 媒体 | 本文の列 | 文字 | 1 行の字数 | 揃え | 1 行に収まる段落 |
|---|---|---|---|---|---|
| 代表の note の記事 | 中央に 620px | 18px・行間 2.0 | 34 字 | 左揃え（題も同じ列の左端） | 101 のうち 86 |
| 代表の Qiita の記事 | 708px（左右に補助の欄） | 17px・行間 1.7 | 41 字 | 左揃え（題も同じ列の左端） | 55 のうち 42 |

どちらも、短い文を 1 文ずつ置き、列は 1 本で、題・本文・code・表が同じ左右の端に揃っている。

## 3. 決まり

### R1. 行は、意味の区切りで替える

- 本文: 文の終わり（「。」「！」「？」）で行を替える。1 文が 1 行。括弧の中の句点では、文を替えない。丸括弧の中の読点では、行を替えない（題は、長い括弧を折るため、括弧の中でも読点の後で替えてよい）。
- 1 行に収まらない長い文: 読点（「、」）の後で替える。読点の無い長い文は、文節の区切りで折る（`word-break: auto-phrase`）。
- 短い出だし（5 字以下。「まずは、」「一方で、」「AIで、」など）の後では替えない。次の塊と続ける。
- 題（h1〜h3・CTA の見出し）: 読点・句点の後でだけ替える。字数を等分する折り方（`text-wrap: balance`）に任せない。
- 閉じ括弧（」』）)と脚注の印は、前の文に付ける。行の頭に置かない。
- 閉じの無い開き括弧の後ろは、文の終わりまで行を替えない（字は欠かさず、落ちない）。
- 表・code block・数式・link card・脚注の一覧には印を付けない。住所・電話番号・日付の行にも印を付けない。
- 書き手が手で改行（`<br>`）を入れた題は、その改行をそのまま使う（印を重ねない）。
- この決まりは日本語と中国語に当てる。英語などは、本文の折り返しを browser に任せ、題だけ区切り（`,` `:` `—`）で切る。

### R2. 1 行は、全角 40 字まで

- 本文の箱の幅は、全角 40 字ぶん（`40em`。18px なら 720px）まで。
- それより広い箱に、本文をそのまま流さない。
- 読み物の本文（記事・規約・方針・会社情報）の文字は 18px。狭い画面（640px 未満）は 16px のままでよい。
- 表の中の文字の大きさは、本文と別に決めてよい（変えない）。

### R3. 列は画面の中央。揃えは、1 つの塊に 1 つ

- **読み物の page**（記事・業種別の提案・規約・方針・会社情報）: 画面の中央に 1 本の列（幅 48rem）。列の中は左揃え。題・本文・card・表・button・関連の link・出典は、全部この列の左右の端に揃える。
- **LP の節**（top・サービスの紹介・製品の紹介）: 節の外枠（rail。幅 80rem）は header と同じ。節の中の短い copy（題・説明・button）は、中央揃えの 1 つの塊にする。説明の段落は R2 の幅まで。card の並び（grid）は rail いっぱい。
- 1 つの塊の中で、左揃えの文と中央揃えの button を混ぜない。
- 本文や題を、rail の左端に寄せて広い箱に流さない（画面が左に寄って見える）。

### R4. 続く 2 つの面に、同じ色を使わない

- 節の背景と、その直後の card が同じ色にならないようにする。card は、白い面と細い枠線、または背景と違う色にする。

## 4. 作り方の型

- 幅の値は 2 つだけ。`--content-width`（80rem。rail）と `--reading-width`（48rem。読み物の列）。値は 1 か所に置く。
- 文と塊の区切りは、build の時に印を付ける。文 = `span`（`display: block`）、読点までの塊 = `span`（`display: inline-block`）。折り返しは CSS だけで決まる。画面の側の script で測らない。
- 題も同じ塊の印を使う。
- 文（本文・見出し・法務の表記）は 1 字も変えない。変えるのは、印と class だけ。

## 5. 確かめ

- 機械（e2e。幅 1440・1920・390）:
  1. 読み物の page で、`main` の中の箱の左右の端が列と揃い、列が画面の中央に在る（2px 以内）。
  2. 題の塊（読点までの 1 つ）が、広い画面で 2 行に割れていない。
  3. 折り返さない時の文の幅が列に収まる文が、1 行に収まっている（字数では決めない。font によって字の幅が違うため）。
  4. 本文の箱の幅が `40em` を超えない。
- 目: 幅 1440 と 390 の画面の写しを PR に貼り、題と文の切れ方を人が見る。

## 6. この repo での実装の場所

- 幅の値: `src/styles/content-width.css`（`--content-width` と `--reading-width`）、`tailwind.config.cjs`（`max-w-content` と `max-w-reading`）
- 文と塊の印: `src/utils/line-breaks.ts`（`splitSentences` / `splitClauses` / `groupSentences` / `groupClauses`）と `src/utils/__tests__/line-breaks.test.ts`
- 読み物の page の文と題の部品: `src/components/common/LbText.astro`（`mode="sentences"` / `"clauses"`）・`src/components/common/LbHeading.astro`
- Markdown の本文の印: `src/utils/rehype-line-breaks.ts`（`astro.config.mjs` の `rehypePlugins` の最後）と `src/utils/__tests__/rehype-line-breaks.test.ts`
- 業種別の page: `src/components/industry/ProposalPage.astro`・`ProposalBlocks.astro`・`ProposalInline.astro`・`ProposalHeading.astro`・`IndustryPaths.astro`・`ProposalSources.astro`
- 行の CSS: `src/styles/content-width.css` の `.lb-sentence` / `.lb-clause` / `.lb-heading`
- 確かめ: `e2e/visual-text.spec.ts`
