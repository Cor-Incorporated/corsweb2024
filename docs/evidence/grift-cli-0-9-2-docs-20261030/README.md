# Grift CLI 0.9.2 の文書を、新しい cor-voice で書いた試験（2026-10-30）

このフォルダは評価の記録です。下書きは公開しません。

## 何をしたか

Grift CLI 0.9.2 の変更（Docker で実行、`grift update`、`grift contribute` の同意後の表示、リポジトリの文脈の年とタグの頻度）を、2 か所に書いた。

- P1-cases: cor-jp.com の製品ページ `src/content/cases/ja/grift.md` の「実装」と「成果」への追記
- P2-faq: griftai.org の FAQ「どうやって始めればよいですか？」の答え（griftai の `src/pages/faq.astro`）の書き直し

同じ依頼（`prompts/`）を、旧スキルと新スキルで Claude Code、Codex、OpenCode（deepseek-flash）に 1 回ずつ書かせた。

- before（旧スキル）: corsweb2024 の origin/develop（c943c64）の `.claude/skills/`。cor-voice-gate も、生成した入口も無い
- after（新スキル）: `feat/cor-voice-harness`（2d1ebc5、https://github.com/Cor-Incorporated/corsweb2024/pull/477）の `.claude/skills/` と、そこから生成した入口
- Cursor と Grok は未ログインで未実行。Pi は依頼に「pipx」を含むと止まるので使っていない

採点は、新スキルの `cor_voice_lint.py check --scene company`、yomiyasu の `run` と `verify`（P2 は今の答えを `--source` にした同じ文書の比較）、書き手を伏せた別エージェントの採点（`tools/judge-rubric092.md`）。

## 結果

| 依頼 | 順位 | スキル | ハーネス | 本人らしさ（5 段階） | そのまま出せるか | 資料に無い事実 | Semantic Review の落ち | cor_voice_lint error/warn | meaning_risk（P2、同じ文書） |
|---|---|---|---|---|---|---|---|---|---|
| P1-cases | 1 | after | codex | 4 | yes | 0 | 1 | 0/1 | - |
| P1-cases | 2 | before | codex | 4 | yes | 0 | 2 | 0/1 | - |
| P1-cases | 3 | after | claude | 3 | no | 0 | 1 | 0/1 | - |
| P1-cases | 4 | before | claude | 3 | no | 0 | 2 | 0/1 | - |
| P1-cases | 5 | after | opencode | 3 | no | 1 | 2 | 0/0 | - |
| P1-cases | 6 | before | opencode | 2 | no | 2 | 2 | 0/1 | - |
| P2-faq | 1 | after | codex | 5 | yes | 0 | 0 | 0/0 | 0 |
| P2-faq | 2 | after | claude | 4 | yes | 0 | 0 | 0/0 | 0 |
| P2-faq | 3 | before | claude | 4 | yes | 0 | 0 | 0/0 | 0 |
| P2-faq | 4 | before | codex | 4 | yes | 0 | 0 | 0/0 | 1 |
| P2-faq | 5 | after | opencode | 3 | yes | 0 | 1 | 0/0 | 0 |
| P2-faq | 6 | before | opencode | 3 | no | 0 | 0 | 0/0 | 0 |

- 同じハーネスどうしでは、6 組とも after が before より上の順位だった
- P1 の「そのまま出せる」は before・after とも 3 本中 1 本で、変わらなかった。Claude と OpenCode は、新スキルでも資料を写した 2,400〜2,900 字の 1 段落を書いた（新しい `long_paragraphs` の warn は、書き手が自分では直さなかった）
- P2 は after の 3 本とも「そのまま出せる」。before は 3 本中 2 本

## 最終稿と、採点者が見逃した誤り

- P1 は 1 位（after・codex）を使った。ただし「`grift update` も加え」は誤り。`grift update` は 0.9.1 の `docs/usage.md` にもうある（`final/material-usage-v091.txt`）。0.9.2 で変えたのは更新の仕方で、コマンドを足したのではない。採点者はこの誤りを拾わなかった。一次資料に合わせて「変えました」に直し、「提出情報」は資料の語（提出ID・hash・meta）に戻し、段落を 3 つに分けた
  - `yomiyasu_check.py run --source final/cases.source.md --final final/cases.final.md --material <依頼と usage.md>`: 1 回目 meaning_risk=1（「自動更新や…ありません」を「自動では更新せず…しません」にした否定の位置）。資料の言い方に戻した 2 回目 meaning_risk=0、資料にない数値・名前 0、事実の穴 0。verify はハッシュ一致
  - `cor_voice_lint.py check --scene company`: error 0、warn 2（1 文の平均 36.9 字、1 段落の平均 5.0 文。後者は `@@@` の区切りで 2 段落が 1 つに数えられた分を含む）。オプションと値を含む文で、分けると条件と手順の対応が離れるので残した
- P2 は 1 位（after・codex）を、改行だけ外して使った。meaning_risk=0、資料にない数値・名前 0、cor_voice_lint 0 件、verify はハッシュ一致

## 試験中に起きたこと

- OpenCode（`opencode run --auto`）の after は、依頼に書いた griftai の `src/pages/faq.astro` を、評価用のコピーではなく本物の worktree（`~/Developer/griftai/.worktrees/claude/grift-cli-0-9-2/`）に絶対パスで書き込んだ。git で元に戻してから、ゲートを通した最終稿を入れた。ほかの worktree への書き込みは無かった（全 worktree の `git status` と OpenCode の記録で確かめた）
- 製品ページの題に「経歴は盛れる。証拠は盛れない。」がある。新しい `cor_voice_lint.py` は error で止め、`npm run blog:check` は通した。題の差し替えは代表の承認が要るので、この PR では変えていない

## CHANGELOG の 0.9.2 の節との突き合わせ（2026-10-30 21:18〜）

grift-cli-dev の release/v0.9.2 に `chore(release): 0.9.2`（c7e2a6e）が入り、CHANGELOG に `## [0.9.2] — 2026-10-30` の節ができた。上の最終稿は PR #111〜#113・#115 の本文から書いたので、この節と、同じ commit の `docs/usage.md`・`docs/metrics-guide.md`・`docs/migration-v092.md`・README の「Docker で使う」に突き合わせた（抜き出しは `final/material-changelog-v092.txt`）。

- 数え方: CHANGELOG は Added 1・Changed 1・Fixed 3。Changed と Fixed の #51 はどちらも `grift update` なので、話題は Docker・`grift update`・`grift contribute`・文脈の表示の 4 つで、`docs/migration-v092.md` の「変わるのは次の 4 つ」と同じ。製品ページの本文は数を書いていない
- 直したところ（`final/cases-changelog.source.md` → `final/cases-changelog.final.md`）
  - `grift update`: 「実行中の環境を明示的に更新」→「実行中の環境だけを更新」。PATH の別の環境を使わないことを足した
  - `grift contribute`: 既定の `--door local` では提出ID・PR内のファイル名・meta行を出さず、`--door public-pr` で作り直す手順だけを出す、に直した（前は既定でも「提出に必要な情報と提出先を表示」と読めた）。「提出ID・hash・meta」は CHANGELOG と `docs/usage.md` の語「提出ID・PR内のファイル名・meta行」に揃えた。コードの文言（`src/tep_cli/__main__.py` の local draft の案内、c7e2a6e）とも同じ
  - 文脈の表示: 出るのは `grift report`（report-v1）の Markdown で、JSON の値は変わらないこと、活動期間が 20 日未満なら年換算しないことを足した
  - 定義の版: `DEFINITION_VERSION` が `tep-v0.9.1-2026-10-28` → `tep-v0.9.2-2026-10-30` になり、0.9.1 で保存したレポートと照らし合わせは 0.9.2 の `grift verify` で検算できない（CANNOT_VERIFY）ことを、0.9.1 の段落と同じ形で「成果」に足した。例外（要求だけから作った案件のレポート、actor collection）は移行の注意へのリンクに任せた
- 使っていないフラグ: `--open`・`--out`・`-P -m pip` は本文に書いていない。書いた `--door local`・`--door public-pr`・`grift update --check`・`/repo`・`git worktree` は資料と同じ
- 書き写さなかった所: CHANGELOG の Changed の段落で「exit 2 になったinstaller は」と 2 文がつながっている所（grift-cli 側で直す）。`docs/migration-v092.md` の contribute の段落は「引数なしの `grift contribute` も…提出 ID…を表示する」とあり、CHANGELOG・`docs/usage.md`・コードと違うので、使っていない
- ゲート（スキルは feat/cor-voice-harness 2d1ebc5）: `yomiyasu_check.py run --source final/cases-changelog.source.md --final final/cases-changelog.final.md --material final/material-changelog-v092.txt --doc-type article --fact-gaps` は meaning_risk=7。7 件とも資料にある値・語（2つ、20日、0.9.1、`grift report`、移行の注意のリンク、「ため」は CHANGELOG の「上げたので」）で、意図した変更として直さなかった。資料にない数値・名前は移行の注意の URL 1 件（0.9.1 の段落と同じ形のリンク。公開前は開けない）。事実の穴 0。verify はハッシュ一致。`cor_voice_lint.py check --scene company` は error 0 / warn 2（1 文の平均 40.5 字、1 段落の平均 5.0 文）
