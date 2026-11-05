# 記録: ハーネスなしで voice 技能を一周させる

- 実行: 2026-11-05T07:02:42Z
- Python: 3.12.9
- voice_gate.py: sha256 8cc4008d7ce1
- cor-voice-gate/SKILL.md: sha256 c917455c5d3b

## 0. 環境: ハーネスの CLI と環境変数が無い

```console
$ if command -v claude; then exit 9; fi; echo "claude: PATH に無い"; env | cut -d= -f1 | sort | tr "\n" " "; echo
claude: PATH に無い
HOME LANG PATH PWD SHLVL _ 
```

終了コード: 0（期待: 0）

## 1. init: 記録のフォルダと記入表を作る

```console
$ python3 -I -B '<repo>/.claude/skills/cor-voice-gate/scripts/voice_gate.py' init --run-dir '<work>/run' --draft '<work>/draft.md' --material '<work>/request.md' --material '<work>/material.md' --scene company --doc-type promo --gate fast
記録のフォルダ: <work>/run
次: <work>/run/review.md に判定と根拠を書き、check --run-dir <work>/run を実行します
```

終了コード: 0（期待: 0）

## 2. check: 直す前の下書き（記入表は空）

```console
$ python3 -I -B '<repo>/.claude/skills/cor-voice-gate/scripts/voice_gate.py' check --run-dir '<work>/run'
# cor-voice-gate の結果: 通らなかった

- 下書き: `../draft.md`（sha256 af6c031a0596）
- 場面: company、種類: promo、ゲート: fast、実行: 2026-11-05T07:02:45Z
- cor_voice_lint.py: error 1、warn 1
- yomiyasu run: executed、meaning_risk 1、事実の穴の候補 0
  - `yomiyasu-check: executed via=run run=20261105T070244Z-5a8a3967 attempt=1 final=sha256:af6c031a0596 mode=compose doc_type=promo checks=lint,diff,materials meaning_risk=1`
- yomiyasu verify: executed
  - `yomiyasu-check: executed via=verify run=20261105T070244Z-5a8a3967 attempt=1 final=sha256:af6c031a0596 mode=compose doc_type=promo checks=lint,diff,materials meaning_risk=1 replay=skipped`
- 記入表: 22 / 22 行、問題 22 件

公開と送信はこの結果で決めません。代表が決めます。

## 通らなかった理由

- cor_voice_lint.py の error が 1 件あります（error は直すまで渡さない）
- yomiyasu run の meaning_risk が 1 件です（0 になるまで渡さない）
- 記入表: T（Whole-post tone check (Step 6)）が未記入です
- 記入表: S1（Sentence completeness）が未記入です
- 記入表: S2（Habit / frequency implication）が未記入です
- 記入表: S3（Motive from the reader’s seat）が未記入です
- 記入表: S4（Relationship / debt）が未記入です
- 記入表: S5（Factual framing）が未記入です
- 記入表: S6（meaning_risk_count == 0）が未記入です
- 記入表: S7（Publish-path preview）が未記入です
- 記入表: S8（No duplicate / orphan posts）が未記入です
- 記入表: S9（Dialect）が未記入です
- 記入表: S10（Mail extras (when email)）が未記入です
- 記入表: S11（No draft / edit URLs in body (hard stop before Postiz or any one-tap publish)）が未記入です
- 記入表: S12（Security / architecture framing (when the piece touches trust boundary, edge, zero trust, cloud vs local, or “what we sell”)）が未記入です
- 記入表: S13（State labeling (2026-10-29 reviewer report §7.1) — hard stop on conflation）が未記入です
- 記入表: S14（Numbers / comparison / safety minimums (§7.2)）が未記入です
- 記入表: S15（P0 vocabulary (§要旨, §3, §4.1–4.5) — hard stop）が未記入です
- 記入表: S16（Story shape (§7.4)）が未記入です
- 記入表: S17（Personal vs company (§2.3)）が未記入です
- 記入表: S18（Boundary / stop-design articles (続稿① n083decbc281b 境界・安全停止 and successors; Terada decision 2026-10-29)）が未記入です
- 記入表: S19（note 編集UI反映（when reflecting into editor.note.com）— hard stop（寺田承認 2026-10-29））が未記入です
- 記入表: S20（公開済み note の更新＝同一 key（when the job is 更新／改稿／リライト of a published note）— hard stop（寺田承認 2026-10-29））が未記入です
- 記入表: S21（技術・安全系の調査／検証レンズ（when the piece is a 技術・安全／フィジカルAI／機能安全／エッジ安全停止／検証記事, or claims 検証した・実証・試験済み）— hard stop on checks 1・2・5; checks 3・4・6 are Full-required（寺田承認 2026-10-29））が未記入です

## cor_voice_lint.py の error（直すまで渡さない）

- 3 行目 trial_word: 「試行」は使わない。紹介会社・採用担当向けは「テスト導入（PoC）」、CTA は「自社でテストしてみる」（cor-voice §6 / ADR-0022）

## yomiyasu の meaning_risk（0 になるまで渡さない）

- certainty_review/strengthened（2 行目）: 前「点数や順位は出さない。」→ 後「点数や順位は出さないので、採用の判断が必ず速くなります。」

## 止めない候補（cor_voice_lint.py の warn）

- 1 行目 exclamation: 感嘆符は使わない（引用と製品名を除く）（cor-voice §4）
```

終了コード: 1（期待: 1）

## 3. 直す: 下書きを直し、記入表を書く（人かハーネスの作業を cp で置き換える）

```console
$ cp '<repo>/docs/evidence/voice-gate-no-harness-20261105/fixtures/draft-v2.md' '<work>/draft.md' && cp '<repo>/docs/evidence/voice-gate-no-harness-20261105/fixtures/review-v2.md' '<work>/run/review.md'

```

終了コード: 0（期待: 0）

## 4. check: 直した下書き

```console
$ python3 -I -B '<repo>/.claude/skills/cor-voice-gate/scripts/voice_gate.py' check --run-dir '<work>/run'
# cor-voice-gate の結果: 通った

- 下書き: `../draft.md`（sha256 6d67baccbe06）
- 場面: company、種類: promo、ゲート: fast、実行: 2026-11-05T07:02:47Z
- cor_voice_lint.py: error 0、warn 0
- yomiyasu run: executed、meaning_risk 0、事実の穴の候補 0
  - `yomiyasu-check: executed via=run run=20261105T070244Z-5a8a3967 attempt=2 final=sha256:6d67baccbe06 mode=compose doc_type=promo checks=lint,diff,materials meaning_risk=0`
- yomiyasu verify: executed
  - `yomiyasu-check: executed via=verify run=20261105T070244Z-5a8a3967 attempt=2 final=sha256:6d67baccbe06 mode=compose doc_type=promo checks=lint,diff,materials meaning_risk=0 replay=skipped`
- 記入表: 22 / 22 行、問題 0 件

公開と送信はこの結果で決めません。代表が決めます。
```

終了コード: 0（期待: 0）

## 5. 2 人目の読み手: 同じフォルダで check をもう一度動かし、結果の要点だけを読む

```console
$ python3 -I -B '<repo>/.claude/skills/cor-voice-gate/scripts/voice_gate.py' check --run-dir '<work>/run' --json | python3 -I -c 'import json, sys; d = json.load(sys.stdin); print("passed", d["passed"], "sha256", d["draft"]["sha256"][:12], "meaning_risk", d["yomiyasu"]["run"]["meaning_risk_count"])'
passed True sha256 6d67baccbe06 meaning_risk 0
```

終了コード: 0（期待: 0）

## 6. 通ったあとに 1 文を足す

```console
$ printf '日本初の仕組みです。\n' >> '<work>/draft.md'

```

終了コード: 0（期待: 0）

## 7. yomiyasu の verify だけを動かす: 記録と最終稿が合わない

```console
$ python3 -I -B '<repo>/.claude/skills/yomiyasu/scripts/yomiyasu_check.py' verify --final '<work>/draft.md' --state-dir '<work>/run/.yomiyasu'
最終稿が、最後に検査した本文と違います。本文を変えたなら yomiyasu_check.py run をもう一度実行し、そのあと verify を実行してください。
yomiyasu-check: final_changed via=verify run=20261105T070244Z-5a8a3967 attempt=3 final=sha256:0a9a134808bd expected=sha256:6d67baccbe06
記録: <work>/run/.yomiyasu/runs/20261105T070244Z-5a8a3967/attempt-3.json
```

終了コード: 1（期待: 1）

## 8. check: 足した 1 文で止まる

```console
$ python3 -I -B '<repo>/.claude/skills/cor-voice-gate/scripts/voice_gate.py' check --run-dir '<work>/run'
# cor-voice-gate の結果: 通らなかった

- 下書き: `../draft.md`（sha256 0a9a134808bd）
- 場面: company、種類: promo、ゲート: fast、実行: 2026-11-05T07:02:53Z
- cor_voice_lint.py: error 1、warn 0
- yomiyasu run: executed、meaning_risk 0、事実の穴の候補 0
  - `yomiyasu-check: executed via=run run=20261105T070244Z-5a8a3967 attempt=4 final=sha256:0a9a134808bd mode=compose doc_type=promo checks=lint,diff,materials meaning_risk=0`
- yomiyasu verify: executed
  - `yomiyasu-check: executed via=verify run=20261105T070244Z-5a8a3967 attempt=4 final=sha256:0a9a134808bd mode=compose doc_type=promo checks=lint,diff,materials meaning_risk=0 replay=skipped`
- 記入表: 22 / 22 行、問題 0 件

公開と送信はこの結果で決めません。代表が決めます。

## 通らなかった理由

- cor_voice_lint.py の error が 1 件あります（error は直すまで渡さない）

## cor_voice_lint.py の error（直すまで渡さない）

- 4 行目 absolute_claim: 根拠と定義のない最上級・保証は書かない（cor-voice §6 / §6A-4）
```

終了コード: 1（期待: 1）

