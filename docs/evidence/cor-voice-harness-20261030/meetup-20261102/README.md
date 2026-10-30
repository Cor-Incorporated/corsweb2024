# 北九州フィジカルAIミートアップ #2 の LT を、新しい cor-voice で書いた試験（2026-10-30）

このフォルダは評価の記録と、寺田康佑が 2026年11月2日に使う LT の原稿の案です。公開、送信、主催への連絡はしていません。話すことと配ることを決めるのは寺田です。

## 何をしたか

統括セッションの依頼（寺田の直近の目標）で、北九州フィジカルAIミートアップ #2（2026年11月2日 19:00、ATOMica 北九州、主催 カラビナテクノロジー、LT 5 分）の 3 つを、寺田の声で書いた。

- `final/lt-script.md`: LT の原稿（話す言葉。空白を除いて 1,230 字）
- `final/slides.md`: スライドの構成案（6 枚。見出しと 1 行の説明）
- `final/handout.md`: 配布 1 枚（QR コードなし。URL は cor-jp.com の既存ページ 4 つだけ）

## 事実の出所

- Thor レーンの報告書 `Claude_Code報告_20261030_physical-ai-thor.md`（2026-10-30 22:25 JST の追記まで。sha256 `f791b4ac84720a96e9ae0c14382e1f1476b613aff0cf6f869aec3ab42cfe0ed8`）
- スイカ割りについて外に向けて書ける一文（`materials/suika-external.md`。kotoba-robocon の証跡 `docs/acceptance/evidence/suika-sim-20261030.md` 1〜9 行。Thor レーンが書いたもの）。報告書にない「スイカの真の位置を見ながら」「決定論的な指示語だけ」が入っているので使った。誘導役が LLM で言葉を理解しているように読めるのを防ぐため
- ミートアップの事実（`materials/meetup.md`）と、載せてよい URL（`materials/cor-jp-pages.md`）は、統括の依頼から書いた

Thor レーンの報告書と、ハーネスが書いた下書き 6 本は、このリポジトリに入れていない。このリポジトリは公開で、報告書は非公開のリポジトリのホスト名、ポート、SDK の提供元の名前を含むため。下書きにも、それらを写したものがある。手元の場所は「生の記録」に書いた。

統括経由で届く予定だった Thor レーンの 1 行（v1 6/10、v2 10/10、転倒 0、Mac なしの E2E 3/3 など）は、この時点ではまだ届いていない。依頼に例として書かれていた値は、報告書と同じだった。

## 試験の条件

同じ依頼（`prompts/M1-meetup.txt`）を、旧スキルと新スキルで、3 つのハーネスに 1 回ずつ書かせた。

- before（旧スキル）: corsweb2024 の origin/develop c943c64 の `.claude/skills/`
- after（新スキル）: `feat/cor-voice-harness` 2d1ebc5（https://github.com/Cor-Incorporated/corsweb2024/pull/477）の `.claude/skills/` と、そこから生成した入口
- 作業用のコピーは、grift-cli 0.9.2 の試験（`docs/evidence/grift-cli-0-9-2-docs-20261030/`、https://github.com/Cor-Incorporated/corsweb2024/pull/480）と同じスナップショットに `materials/` を足したもの
- Claude Code 2.1.312（claude-opus-5-5）、codex-cli 0.165.0（gpt-6.1-sol）、OpenCode v2.0.32（`-m deepseek/deepseek-flash`）。コマンドは `tools/run_harness2.sh`。上限 900 秒で、6 本とも rc 0
- Cursor と Grok は未ログインで回していない。Pi は依頼に入れる語で止まることがあるので使っていない

採点は 3 つ。

- `cor_voice_lint.py check`（原稿とスライドは founder、配布は tech）と `stats`
- yomiyasu の `run`（資料は依頼と `materials/` の 4 つ）と `verify`
- 書き手を伏せた別のエージェント（`tools/judge-rubric-meet.md`）。6 本を無作為に並べて採点した

`tools/scoremeet.py` と `tools/prepare_judge_meet.py` が手順で、結果は `scores-meet.json`（数だけ。下書きの引用は入れていない）。

## 結果

| 順位 | スキル | ハーネス | 本人らしさ（5 段階） | そのまま出せるか | 資料に無い事実 | 意味の落ち | 原稿の字数 | 原稿の 1 文の平均 |
|---|---|---|---|---|---|---|---|---|
| 1 | after | claude | 5 | yes | 1 | 1 | 1,237 | 23.4 |
| 2 | before | claude | 4 | yes | 0 | 0 | 1,268 | 25.1 |
| 3 | before | codex | 3 | no | 2 | 2 | 1,282 | 26.1 |
| 4 | after | codex | 3 | no | 1 | 1 | 1,220 | 25.4 |
| 5 | before | opencode | 4 | no | 4 | 3 | 1,296 | 24.0 |
| 6 | after | opencode | 3 | no | 6 | 4 | 1,253 | 19.7 |

- 同じハーネスどうしで after が上だったのは claude だけだった（1 位と 2 位）。codex（3 位 → 4 位）と OpenCode（5 位 → 6 位）は after が下だった。grift-cli 0.9.2 の試験では 6 組とも after が上だったので、それとは違う結果になった
- 「そのまま出せる」は before・after とも 3 本中 1 本で、どちらも claude
- after の OpenCode は、資料に無い方針（危険源と安全側の定義）を言い切り、x86_64 の再測定を「同じ指示で」と書いた（実際は同じ計画のファイルを使った）。スイカ割りを、言葉から計画を作る流れと同じものとして話した
- after の codex は、スイカ割りの段落に外向けの一文を括弧ごと写し、話す言葉になっていなかった
- 機械の検査では、6 本とも cor_voice_lint の error 0、字数 1,200〜1,400、スライド 6 枚、URL は 4 つの中だけ、主催と Cor.株式会社のほかの会社名なしだった。違いは伏せ字の採点でだけ出た

## 最終稿の作り方

1 位（after・claude）を元に、採点者が挙げた所を直した。

- 「承認された計画と、ロボットに届いた計画が同じだったということです」を消した。資料が言うのは、承認のときと送るときの sha256 が一致したことまでで、ロボットの側で受け取ったものは照らし合わせていない。直前の文の言い直しでもあった
- 「言葉でロボットが動いた。そこまでは、シミュレーションで確かめました」を、言葉の指示で前に進んだことと、決まった指示の言葉でスイカに当たったことに分けた。スイカ割りまで言葉の指示で動いたように読めたため
- 「だから今日は言えることと言えないことを分けて置いていきます」を、配布 1 枚を指す文にした
- 「交流の時間にスイカ割りを動かしているので」を「持ってきています」にした（原稿と配布）。資料にあるのは持っていくことまで

ゲート（スキルは after と同じ 2d1ebc5）:

- yomiyasu `run --source <1 位の下書き> --final <最終稿> --material <依頼と materials/ の 4 つ> --doc-type article --reader informed --fact-gaps`
  - 原稿: meaning_risk=1（「〜ということです」を消して文の種類の印が変わった 1 件。意図した変更）。資料にない数値・名前 0、事実の穴 0
  - スライド: 変更なし、meaning_risk=0
  - 配布: meaning_risk=0、資料にない数値・名前 0
  - 3 つとも `verify` でハッシュが記録と一致
- `cor_voice_lint.py check`: 3 つとも error 0。warn は原稿 1（1 段落の平均 3.24 文。話す区切りで改行した行がまとめて 1 段落に数えられる）、スライド 1（1 文の平均 30.3 字。見出しと説明を 1 文に数える）、配布 1（1 文の平均 31.6 字）。意味を変えずに分けられる所が無いので残した

最終稿は、伏せ字の採点者にもう一度は見せていない。

## 確かめていないこと

- 5 分で話し切れるか。声に出して測っていない
- スライドは構成案だけで、作っていない
- 配布が A4 1 枚に収まるか。版面に組んで確かめていない
- Thor レーンの 1 行との照らし合わせ（まだ届いていない）

## 生の記録（コミットしていない）

`/private/tmp/claude-501/-Users-teradakousuke-Developer-corsweb/a2241786-9f74-4878-9959-b0e0081db075/scratchpad/evalmeet/` の `<before|after>/<harness>/M1-meetup.{raw,err,jsonl,last,rc,secs}`、採点の全文 `judge-M1-meetup.json`、対応表 `judge-mapping-meet.json`、`scoresmeet.json`、最終稿の yomiyasu の記録 `final/ystate-*`。
