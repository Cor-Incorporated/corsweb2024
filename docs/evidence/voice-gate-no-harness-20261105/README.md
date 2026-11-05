# voice 技能をハーネスなしで一周させた記録（2026-11-05）

このフォルダは評価の記録です。サイトには載せません。下書きは資料の範囲で書いたデモ用の文で、公開しません。

## 何を確かめたか

voice 技能（yomiyasu、cor-voice、cor-voice-gate）の検査が、ファイルと `bash`、`python3` のコマンドだけで一周するかを確かめました。

偽になる条件は、手順のどこかで特定のハーネスの機能が要ることです。スキルの自動起動、フック、ハーネスの CLI や環境変数がこれに当たります。

## 手順

どのハーネスでも、人が端末で打っても同じ手順です。入口（AGENTS.md、CLAUDE.md、`.cursor/rules/cor-voice.mdc`）の手順 4 にも同じことを書きました。

1. `voice_gate.py init` で記録のフォルダを作ります。`gate.json`（入力と場面）と `review.md`（意味の確認の記入表）ができます。
2. 下書きを直し、`review.md` に項目ごとの判定と根拠を書きます。記入表の項目は、そのたびに cor-voice-gate の SKILL.md から作ります。
3. `voice_gate.py check` を実行します。`cor_voice_lint.py check`、`yomiyasu_check.py run --fact-gaps` と `verify` が中で動き、`result.json` と `result.md` に結果が残ります。通ったと言えるのは、終了コードが 0 のときだけです。

## 動かし方

```bash
bash docs/evidence/voice-gate-no-harness-20261105/run-demo.sh
```

各手順は `env -i` で始めた bash で動きます。PATH には python3 だけを置いたフォルダと `/usr/bin`、`/bin` だけを入れ、HOME は空のフォルダにします。期待と違う終了コードが出ると、そこで止まります。記録は `log/transcript.md` に残ります。

## 結果（log/transcript.md）

| 手順 | 中身 | 終了コード |
|---|---|---|
| 0 | `claude` は PATH に無い。環境変数は HOME、LANG、PATH、PWD、SHLVL、_ だけ | 0 |
| 1 | init で記録のフォルダと記入表を作る | 0 |
| 2 | 直す前の下書きで check。使わない語（trial_word）で lint の error 1、「必ず速くなります」で meaning_risk 1、記入表は全行が未記入 | 1 |
| 3 | 下書きと記入表を、用意したファイル（fixtures）で置き換える | 0 |
| 4 | 直した下書きで check。error 0、meaning_risk 0、記入表の問題 0 | 0 |
| 5 | 2 人目の読み手が同じフォルダで check をもう一度動かす。同じ sha256 で通る | 0 |
| 6 | 通ったあとに、最上級の言い切りの 1 文を足す（中身は run-demo.sh の手順 6） | 0 |
| 7 | yomiyasu の verify だけを動かす。最終稿が記録と合わない（final_changed） | 1 |
| 8 | check。lint の error（absolute_claim）で止まる | 1 |

## Codex で同じ手順を回した記録（codex/）

Claude Code 以外のハーネスでも同じ手順が通るかを、Codex で 1 回だけ確かめました。

- 実行: `codex exec -s workspace-write --skip-git-repo-check --ephemeral`（codex-cli 0.166.0）。AGENTS.md、3 つのスキル、依頼、資料だけを写したフォルダで動かしました。
- 依頼の全文は `codex/prompt.txt` にあります。AGENTS.md の節の手順に従うことと、記録のフォルダの場所だけを指定しました。
- Codex は init（Full を選択）、記入表 32 行の記入、check を自分で回し、最後の check は終了コード 0 でした。記録は `codex/gate.json`、`codex/review.md`、`codex/result.md`、最後の返答は `codex/last-message.md` です。
- 2 人目の読み手として、同じフォルダで check を動かし直しました（Claude Code から実行）。終了コードは 0 で、下書きの sha256 は `4497c832…` です。Codex の最後の返答にある Readback と一致しました。
- Cursor、OpenCode、Pi、dsh では、今回は動かしていません。

## 分かった限界

- 推敲そのものと記入表の判定は、人かモデルがします。このデモでは cp で置き換えました。機械が見るのは、記入表に未記入、fail、n/a 不可の項目の n/a が無いことまでで、判定が正しいかは見ません。たとえば Codex は、デモの文の P10（更新担当と再確認の条件）を pass にしました。
- 資料に無い効果は、機械では止まらないことがあります。「必ず採用の判断が速くなります。」を原文に足すと、yomiyasu の meaning_risk は 0 で、事実の穴の候補が 1 件でした。`result.md` に候補を並べ、記入表の S5 と S14 で止めます（`test_voice_gate.py` の `test_unbacked_effect_is_listed_and_stopped_by_review`）。
- 依頼と資料を 1 つのファイルで `--material` に渡すと、誤った meaning_risk が出ました。資料が下書きに似ていたため、yomiyasu が資料を原文とみなして diff をかけ、依頼の「3 文」を消えた数字として数えました（meaning_risk 1）。依頼と資料は別のファイルで渡します。入口の手順 4 にもそう書きました。
- 手順 8 で足した最上級の 1 文は lint の error（absolute_claim）で止まりましたが、yomiyasu の meaning_risk は 0 でした。
- note の編集画面への反映（cor-voice-gate の 19 と 20）はブラウザでの作業なので、このコマンドでは閉じません。
- yomiyasu の本文と scripts は、nanaism/yomiyasu v2.1.3 を手を加えずに同梱しています。本文には、各ホストでの呼び名（`/yomiyasu`、`$yomiyasu`）と配置先の例（`${CLAUDE_SKILL_DIR}`）、任意のフック（`yomiyasu_hook.py`）が残ります。どれも検査のコマンドには要りません。`test_voice_gate.py` の検査が見るのは、Cor. が足した節、cor-voice、cor-voice-gate です。

## ファイル

- `run-demo.sh`: デモ本体
- `fixtures/`: 依頼、資料、直す前と後の下書き、記入済みの記入表
- `log/`: デモの記録と、手順 2、4、8 の `result.json`
- `codex/`: Codex で回した記録
