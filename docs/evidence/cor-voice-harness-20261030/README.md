# cor-voice をハーネスに依らず効かせる比較（2026-10-30）

このフォルダは評価の記録です。ここにある下書きは公開しません。事実の確認もしていません（資料の範囲で書かせたものです）。

## 何を比べたか

同じ 3 つの依頼を、同じ条件で 7 つのハーネスに 1 回ずつ書かせ、指示の入口を直す前（before）と後（after）で採点を比べた。

| 依頼 | 中身 | yomiyasu の種類 | cor-voice の場面 |
|---|---|---|---|
| A-article | cor-jp.com のブログ記事（engineering、書き手は代表） | article | tech |
| B-mail | 紹介会社からの問い合わせへの返信メール（顧客向けの返信の代表） | mail | 採点は両ラウンドとも founder の規則（mail の場面は after で新設） |
| C-manual | 社内向けの手順書（読み手はエンジニアでないスタッフ） | manual | company |

依頼の全文は `prompts/` にある。資料（事実）は依頼の中に置き、資料に無い事実を書かないよう指定した。問い合わせの会社と人物は評価のために作った架空のもの。

- before: corsweb2024 の `feat/cor-voice-harness` の 28a67a4（スキルの編集を取り込んだだけ。入口は origin/develop のまま）から、文章に関わるファイル（CLAUDE.md、AGENTS.md、`.claude/skills/`、`.cursor/`、`.agents/`、`.pi/`、`.opencode/skills/`、`skills/`、`docs/adr/`、`docs/story-spine.md`、`docs/blog-style-guide.md`、`docs/polish-gate.md`、`src/config/`、`src/content/blog/ja/`、`package.json`）だけを取り出したコピー
- after: 同じ範囲を、入口の生成とスキルの改善を入れた後の作業ツリーから取り出したコピー（生成区画は、この時点では日本語の段落の中にあった。中身は今の節と同じ）
- どちらも `node_modules` は無い（`npm run polish` などは、どのハーネスでも動かない条件でそろえた）
- ハーネスごとに別のコピーで動かし、3 つの依頼はその中で順に実行した。利用者のふだんの全体設定（フック、出力の形、H17 の契約）のまま動かした

## ハーネスと実行のしかた

| ハーネス | 実行 | 結果 |
|---|---|---|
| Claude Code | `claude -p --permission-mode acceptEdits --allowedTools=…`（依頼は標準入力。after は `--output-format stream-json --verbose` で全部の返答を残した） | 3 本とも実行 |
| Codex | `codex exec -s workspace-write --skip-git-repo-check --ephemeral -C <コピー> -o <最後の返答>` | 3 本とも実行 |
| Cursor | `cursor-agent -p --trust --force --workspace <コピー>` | 未検証。`Authentication required. Please run 'agent login' first`。ログインは人間ゲート |
| OpenCode | `opencode run --auto -m deepseek/deepseek-flash`（既定のモデルは残高不足と提供元の方針で動かず、方針で許されたモデルのうち動いたもの） | 3 本とも実行 |
| Pi | `pi -p -a --no-session` | C だけ実行。A と B は「`pipx install` を含む依頼」を 0 秒で `No API key found for the selected model.` で止める（before・after とも再現、切り分けの記録は下） |
| dsh | `dsh "<依頼>"`（headless） | 3 本とも実行 |
| Grok | `grok -p … --cwd <コピー> --always-approve` | 未検証。`Not signed in`。ログインは人間ゲート |

本文の取り出し: 依頼で `<<<DOC` と `DOC>>>` の行に挟ませた。H17 の Stop フックが最後の返答を Evidence と Status の行に置き換えることがあったので、(1) 最後の返答の `Readback:` 行が指すファイル、(2) 300 字以上ある最後の DOC 区画（最後の返答、標準出力、標準エラーの記録の順）の順で拾った。両ラウンドに同じ方法を当てた。

## 採点

減点の合計（少ないほどよい）。採点器はラウンドで変えていない（before も最後の版の採点器で付け直した）。

- 機械（`score.py`）
  - cor-voice の機械検査（`cor_voice_lint.py check`）: error 3 点、warn 1 点。文と段落の長さの warn は下の文体で数えるので除く
  - 資料に無い数字（数字と単位の組。日付の書き方の違い、番号、0 と 1 の言い回しは除く）: 2 点ずつ。yomiyasu の事実の穴の候補: 1 点ずつ
  - 文体: 本人の 2026 年の記事 4 本の幅（1 文の平均 17.8〜27.2 字、1 文の読点 0.6〜1.0、1 段落 2.5 文以下、yomiyasu の lint の候補 1000 字あたり 6.0 以下）から外れた分
  - 依頼の指定（frontmatter の項目、「## 参考資料」、本文 2,000〜3,000 字、件名、署名、連絡先と金額を書かない、題と番号つきの手順）: 1 点ずつ
- 伏せ字の採点（別のエージェント。`judge-rubric.md`）: before と after の下書きを混ぜ、書き手を伏せて並べ替えたものを、依頼ごとに 1 回で採点した
  - 資料に無い事実 2 点、依頼の指定 1 点、Semantic Review（S1・S3・S5・S13・S14・S16・S17）2 点、本人らしさ（5 段階）の不足 1 段につき 2 点、AI の下書きらしい所 0.5 点

## 結果

| ハーネス | 依頼 | before 減点（機械＋採点） | after 減点 | before 本人らしさ | after 本人らしさ | before 文長 | after 文長 |
|---|---|---|---|---|---|---|---|
| claude | A-article | 12.7 | 10.6 | 4 | 4 | 28.7 | 28.8 |
| claude | B-mail | 30.5 | 12.9 | 2 | 4 | 31.5 | 31.0 |
| claude | C-manual | 23.9 | 7.2 | 3 | 4 | 23.5 | 24.8 |
| codex | A-article | 18.8 | 11.6 | 2 | 3 | 33.4 | 28.4 |
| codex | B-mail | 17.8 | 12.9 | 4 | 3 | 31.5 | 26.0 |
| codex | C-manual | 7.6 | 7.3 | 4 | 4 | 24.6 | 22.5 |
| opencode | A-article | 15.1 | 22.2 | 3 | 3 | 28.8 | 27.1 |
| opencode | B-mail | 15.3 | 11.4 | 3 | 4 | 28.7 | 29.0 |
| opencode | C-manual | 42.7 | 11.3 | 2 | 4 | 24.4 | 21.9 |
| pi | C-manual | 54.0 | 33.0 | 1 | 2 | 26.7 | 29.1 |
| dsh | A-article | 28.2 | 18.3 | 3 | 3 | 29.9 | 22.9 |
| dsh | B-mail | 18.6 | 16.9 | 3 | 3 | 29.7 | 28 |
| dsh | C-manual | 17.4 | 14.0 | 3 | 3 | 21.8 | 23.0 |

| ハーネス | before 合計（揃った依頼） | after 合計（同じ依頼） | 差 | 判定 |
|---|---|---|---|---|
| claude | 67.1（A-article, B-mail, C-manual） | 30.7 | -36.4 | after が上回る（減点が少ない） |
| codex | 44.2（A-article, B-mail, C-manual） | 31.8 | -12.4 | after が上回る（減点が少ない） |
| cursor | - | - | - | 未検証 |
| opencode | 73.1（A-article, B-mail, C-manual） | 44.9 | -28.2 | after が上回る（減点が少ない） |
| pi | 54.0（C-manual） | 33.0 | -21.0 | after が上回る（減点が少ない） |
| dsh | 64.2（A-article, B-mail, C-manual） | 49.2 | -15.0 | after が上回る（減点が少ない） |
| grok | - | - | - | 未検証 |

依頼ごとの順位（伏せ字の採点。1 がもっともよい。a = after、b = before）:

| 依頼 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| A-article | a:claude | a:codex | b:claude | a:opencode | b:opencode | b:codex | a:dsh | b:dsh | | |
| B-mail | a:opencode | a:claude | a:codex | b:codex | a:dsh | b:opencode | b:dsh | b:claude | | |
| C-manual | a:claude | a:codex | b:codex | a:opencode | b:dsh | b:claude | a:dsh | b:opencode | a:pi | b:pi |

まとめ（両ラウンドで比べられた 13 本ずつ）:

| 指標 | before | after |
|---|---|---|
| 資料に無い事実（採点者が挙げた数） | 52 | 24 |
| 本人らしさの平均（5 段階） | 2.85 | 3.38 |
| Semantic Review で落ちた数 | 18（S1 8、S5 4、S16 3、S3 2、S13 1） | 15（S5 5、S16 4、S1 3、S3 3） |
| 3 つの依頼の 1 位と 2 位 | 0 / 6 | 6 / 6 |

## 読み方と限界

- 1 ハーネス 1 依頼 1 回ずつで、ばらつきは測っていない。差の小さい組（Codex の手順書 7.6 → 7.3、dsh の返信 18.6 → 16.9）は、回し直すと逆になりうる
- OpenCode の記事だけ悪くなった（15.1 → 22.2）。after の下書きが、資料に無いリリースノートと版を指定した PyPI の URL を足した（採点者の指摘 4 件）。入口の 3 の「足さない事実」に URL を挙げていない。次の 1 回で足す候補
- 「数字が推薦の理由の材料になる」という書き方（S5）は before 4 件、after 5 件で減っていない。cor-voice 6 章は「人材紹介会社・SES の営業…それぞれの使い方を書く」とし、採点の基準は「推薦・評価に読める書き方」を落とすので、どこまで書いてよいかは代表に確かめる
- 本人らしさの採点者は、手本 3 本と cor-voice の要点を読んだ別のエージェント（Claude）。代表本人の判定ではない
- Cursor と Grok はログインが無く、Pi の記事と返信は Pi の不具合で、どちらのラウンドも書けていない
- before のコピーには、疎通確認のときにフックが作った記録用のファイル（`.claude/memory/session-log.md` の雛形など）が入っていた。文章の指示は含まない
- Claude Code の before は、記事と返信を `--output-format text`、手順書を `stream-json` で取った（text だと最後の返答が H17 の Evidence 行に置き換わり、本文を取れなかったため）。after は 3 本とも `stream-json`

## ファイル

- `prompts/`: 3 つの依頼（資料を含む）
- `drafts/<before|after>/<ハーネス>/<依頼>.md`: 採点した下書き（公開しない、事実の確認なし）
- `scores/before.json`、`scores/after.json`: 機械の採点。`scores/summary.json`: 機械と伏せ字の採点の合計。`scores/judge-mapping.json`: 伏せ字の D 番号と書き手の対応。`scores/exemplar-stats.json`: 手本 4 本の統計
- `judge/judge-<依頼>.json`: 伏せ字の採点の結果
- `tools/`: 実行と採点に使ったスクリプト（scratchpad のパスのまま。そのままでは動かない）
- `task3/`: 強制点の実測（実 worktree での 15+3 入力、測定器の末尾）
