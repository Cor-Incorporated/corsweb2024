---
name: article-polish
description: cor-jp.com の日本語のブログとニュースを書く・直すときに使う。yomiyasu と cor-voice を、公開済みの記事を見本にして当てる。文体を変えるのは、人間が明示したときだけ。入口は npm run polish。
---

# 記事の推敲ゲート

規則の本文は写さない。次を読んでから手を動かす。

- 推敲: `.claude/skills/yomiyasu/SKILL.md`
- 文体と表現ルール: `.claude/skills/cor-voice/SKILL.md`
- 手順の詳細: `docs/polish-gate.md`
- 決定: `docs/adr/ADR-0027-article-polish-gate.md`

## いつ使うか

`src/content/blog/ja/` と `src/content/news/ja/` を、新しく書くときと直すとき。英語・中国語・韓国語・スペイン語は翻訳 CI のファイルなので、このスキルでは直さない。ページの文言、設定、作業の報告には使わない。

CMS の作成・更新・削除そのものは、このスキルでは置き換えない。ブログの作成と更新は Sveltia CMS（ADR-0018）。削除と、news・cases を CMS で扱うかは ADR-0026 の別作業。

## 手順

1. 人間がこのターンで文体の指示を書いたときだけ、その文言を変えずに渡す。指示文はエージェントが作らない。

   ```bash
   npm run polish -- instruction --file src/content/blog/ja/<slug>.md --text '<人間の文言>'
   ```

   場面が変わる印は、`scene: company|founder|technical|story` か、「会社として書く」「代表の名前で書く」「技術の記事として書く」「ストーリーとして書く」だけである。それ以外の指示は、言い回しの指定として残り、場面は既定のままになる。

2. パケットを出す。`locked_scene` を変えない。

   ```bash
   npm run polish -- prepare --file src/content/blog/ja/<slug>.md
   ```

3. yomiyasu の手順で推敲し、パケットの場面の cor-voice を当てる。見本から、事実・数値・固有名詞は写さない。

4. 検査が完了になるまで直す。原文と最終稿は別のファイルにする。`--no-yomiyasu` の結果は完了ではない。

   ```bash
   npm run polish -- check --file <原文> --final <最終稿>
   ```

5. 人間が採用した記事だけ、抜粋を残して PR に入れる。下書きでは実行しない。cor-voice の本文はこのコマンドでは変えない。

   ```bash
   npm run polish -- learn --file src/content/blog/ja/<slug>.md --approved --note '<次も残す書き方>'
   ```

## どのツールからでも同じコマンド

Cursor、Codex、Claude Code、Pi、dsh（DeepSeek Harness）、OpenCode、Grok は、どれも `npm run polish` を実行する。手順はこのファイルに置く。各ツール用のファイルはここへの参照だけである。
