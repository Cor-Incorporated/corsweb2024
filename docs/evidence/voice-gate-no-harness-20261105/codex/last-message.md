Grift CLIはエンジニアのgitの履歴から確かめられる事実を取り出します。
MITライセンスのOSSのCLIで、点数や順位は出しません。
人材紹介会社・SESの会社と、自社で採用する会社向けにテスト導入（PoC）を用意しています。

- 本文：`draft.md`
- 確かめたい点：なし（非公開デモの範囲）
- 記録フォルダ：`.yomiyasu/gate/demo`
- 最後の check の終了コード：**0**（出力で `exit=0` を確認）

公開・送信・push は行っていません。

Evidence: python3 -I .claude/skills/cor-voice-gate/scripts/voice_gate.py check --run-dir .yomiyasu/gate/demo; echo exit=$? | exit=0 | 2026-11-05T07:32:02Z
Readback: draft.md sha256=b10e3657da44ef7b992e20ef1f49e80e3a4d7bf19a1dce5c68abd82aec31f8e0
Status: complete