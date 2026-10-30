# ブログのアイキャッチ画像を作る（`npm run blog:eyecatch`）

ja の記事 1 本に、Gemini の画像生成でアイキャッチ（記事ページのヒーロー画像と一覧のカード画像）を作る手順です。
絵の方針（入れてはいけないもの、alt の書き方、出自の記録）は `docs/blog-style-guide.md` の「アイキャッチの方針」にあります。

- スクリプト: `scripts/blog/generate-eyecatch.mjs`（部品は `scripts/blog/eyecatch/`）
- テスト: `scripts/blog/__tests__/generate-eyecatch.test.mjs`（`npm run test:run` に含まれる。API はモック）
- 既定のモデル: `gemini-3.1-flash-image`（16:9、`imageSize: 2K`）。`--model` で変えられる

## 1. 前提

| 項目 | 値 |
|---|---|
| 作業する場所 | リポジトリの根（`package.json` がある所）。worktree でもよい |
| 記事 | `src/content/blog/ja/<slug>.md`。`en/zh/ko/es` は翻訳 CI のものなので受け付けない |
| 鍵の環境変数 | `GEMINI_API_KEY`（生成のときだけ必要。`--dry-run` と `--pick` は不要） |
| 鍵の取り出し方 | `bwenv get NFC_GEMINI_API_KEY`（社内の環境変数の一覧から取り出す。手順は `~/Developer/AGENTS.md`） |

鍵は `.env` などのファイルに書かず、コマンドの環境変数として直接渡します。`bwenv` は警告を標準エラーに出すので、`2>/dev/null` で値だけを受け取ります。
`bwenv` が locked と言ったら、鍵の保管庫を開け直すのは人の作業です（手順は `~/Developer/AGENTS.md`）。

## 2. 手順

### 2-1. プロンプトと出力先を確かめる（API を呼ばない）

```bash
npm run blog:eyecatch -- src/content/blog/ja/<slug>.md --dry-run
```

frontmatter の `title`・`summary`（無ければ `description`）・`category` から組み立てたプロンプトと、書き出す先が出ます。何も書き込みません。`--pick` とは一緒に使えません（使うと終了コード 2 で止まります）。

### 2-2. 候補を作る

```bash
GEMINI_API_KEY="$(bwenv get NFC_GEMINI_API_KEY 2>/dev/null)" npm run blog:eyecatch -- src/content/blog/ja/<slug>.md --max 2
```

- `--max` は 1 回の実行で作る候補の数です。既定 2、最大 6。1 枚ごとに 1 回 API を呼びます
- 候補は `.eyecatch/<slug>/candidate-<番号>.<png|jpg|webp>` に置きます（`.gitignore` 済み。コミットしない）
- 記録 `public/images/blog/<slug>.eyecatch.json` に、候補ごとの番号・モデル id・プロンプト・生成日時・大きさ・sha256 を足します。失敗した回もエラーの 1 行目と一緒に残ります（記録はサイトで公開されるので、鍵と PC の絶対パスは伏せます。全文は標準エラーにだけ出します）
- この段階では、記事と公開用の画像は変えません

候補の画像を開いて、「アイキャッチの方針」の確認項目（文字・顔・ロゴ・偽スクショが無いか）を目で確かめます。

### 2-3. 1 枚を採用する

```bash
npm run blog:eyecatch -- src/content/blog/ja/<slug>.md --pick <番号> --alt "画像に描かれているものの説明"
```

- `public/images/blog/<slug>.avif`（1600×900）と `public/images/blog/<slug>-1200x630.avif`（1200×630）を書きます
- frontmatter の `image` を `{ url: "/images/blog/<slug>.avif", alt: "<--alt の値>" }` にします（ほかの行は変えません）
- 記録の `picked` に、採用した番号・日時・alt・出力 2 枚の大きさと sha256 を書きます
- 画像 2 枚・記事・記録の 4 つは、全部を一時ファイルに書けてから置き換えます。1 つでも書けなければ、どれも変えません
- 公開済みの記事の画像を採り直すときは注意が要ります。`firebase.json` は `*.avif` を 1 年キャッシュする（immutable）ので、同じファイル名のまま置き換えると、一度見た人のブラウザには古い画像が残ります
- すでに画像か `image` があるときは置き換えの確認を出します。対話できない環境（CI やエージェント）では止まるので、置き換えるなら `--force` を付けます

### 2-4. 確かめてコミットする

```bash
npm run build
npm run preview
```

記事ページ（`/blog/<slug>/`）で、「この記事の要点」の下に画像が出ることと、一覧（`/blog/`）のカードを確かめます。
コミットするのは、記事・`<slug>.avif`・`<slug>-1200x630.avif`・`<slug>.eyecatch.json` の 4 つです。

## 3. 終了コード

| コード | 意味 | 例 |
|---|---|---|
| 0 | 成功 | 候補をすべて作れた／採用できた |
| 1 | 実行時の失敗 | API の失敗が 1 回以上あった、候補のファイルが記録の sha256 と違う、記事や画像を書けなかった（このときは何も置き換えない） |
| 2 | 使い方の誤り | 鍵が未設定、`--max 7`、`--pick` に `--alt` が無い、`--pick` と `--dry-run` を一緒に指定、ja 以外の記事 |
| 3 | 置き換えを止めた | 既存の画像があり、`--force` も対話での y も無い |

## 4. うまくいかないとき

| 出力 | 原因と対処 |
|---|---|
| `GEMINI_API_KEY が未設定です` | 鍵を渡していない。`bwenv get` が空を返していないか、`bwenv list GEMINI` で名前を確かめる |
| `API key not valid` | その鍵が Gemini API に通らない。`NFC_GEMINI_API_KEY` を使う |
| `画像が返りませんでした（finishReason=…）` | 安全フィルターなどで画像が出なかった。`--dry-run` でプロンプトを確かめ、もう一度作る |
| `候補 N のファイルが記録の sha256 と違います` | `.eyecatch/` の候補を上書き・削除した。作り直す |
| `対話できないので止めました` | 既存の画像を置き換えようとした。置き換えてよければ `--force` |

## 5. OG 画像との関係

`og:image` は今までどおり `/og/<slug>.png`（題を文字で描いた 1200×630 の PNG。`src/pages/og/`）を使い、アイキャッチは使いません。理由は 2 つです。

- X・Facebook などのカード画像は AVIF を受け付けない（JPEG・PNG・WebP・GIF）
- SNS のカードでは、題が画像の中に読める今の OG のほうが、何の記事かが伝わる

`<slug>-1200x630.avif` は OG と同じ比率で作っておき、OG に絵を使うと決めたときの元画像にします（`src/pages/og/[...slug].png.ts` で PNG に変換して題を重ねる）。使うかどうかは未決です。
