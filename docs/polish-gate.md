# 記事とニュースの推敲ゲート

ブログとニュースの日本語原稿を、どのエージェントから書いても同じ検査に通すための入口です。作成・更新・削除そのものは CMS と Git の PR が担当します（ADR-0018、ADR-0026）。この入口は原稿の推敲です。

決定は ADR-0027 です。

## 誰が実行するか

Cursor、Codex、Claude Code、Pi、dsh（DeepSeek Harness）、OpenCode、Grok は、どれも同じコマンドを使います。

```bash
npm run polish -- prepare --file src/content/blog/ja/<slug>.md
npm run polish -- check --file src/content/blog/ja/<slug>.md --final <最終稿.md>
```

ニュースも同じです。パスを `src/content/news/ja/<slug>.md` にします。

手順を置くファイルは `skills/article-polish/SKILL.md` です。Claude Code、Codex、Pi、OpenCode、Cursor 用のファイルは、そこへの参照だけです。規則の本文は `.claude/skills/yomiyasu/` と `.claude/skills/cor-voice/` にあり、ここには写しません。

## 場面

原稿の場面は次の既定で決まります。

| 原稿 | 既定の場面 |
|---|---|
| blog の ai / engineering | 会社として書く |
| blog の founder | 代表の名前で書く |
| blog の lab | 技術の記事 |
| news | 会社として書く |

engineering の検証記事を技術の記事にしたいときは、人間が明示します。エージェントは自分の判断で場面を変えません。

場面が変わる印は、指示文の中の次だけです。

- `scene: company` / `founder` / `technical` / `story`
- 「会社として書く」「代表の名前で書く」「技術の記事として書く」「ストーリーとして書く」

印が無い指示は、言い回しの指定として残ります。場面は既定のままです。印が 2 つ以上あると、コマンドは止まります。

```bash
npm run polish -- instruction --file src/content/blog/ja/<slug>.md --text '<人間が書いた文言>'
```

記録は `docs/polish/instructions/` です。消すときは、人間が頼んだうえで `--clear` を付けます。任意で `--issue <番号>` を付けると、ADR-0026 の `voice-feedback` Issue を指せます。

## 見本

`prepare` は、同じ場面の公開済み ja 記事から、新しいものを最大 3 本選び、書き出しと結びの抜粋を出します。下書きと、今直しているファイル自身は除きます。見本の事実、数値、固有名詞は、新しい記事に写しません。

## 学習

公開または採用された記事は、ja の原稿としてリポジトリに残った時点で、次の `prepare` の見本になります。これが自動の半分です。全文のコピーや、モデルの内部メモリは作りません。

人間が「この書き方を次も残す」と指定したときは、抜粋とメモを別ファイルにします。

```bash
npm run polish -- learn --file src/content/blog/ja/<slug>.md --approved --note '<残すこと>'
```

出力は `docs/polish/learned/` です。PR で差分を見られます。下書きや、`--approved` の無い実行は記録しません。cor-voice の本文はこのコマンドでは変えません。規則そのものを変えるのは、ADR-0026 のとおり、人が承認する PR です。

## 検査で止まるもの

`check --final` は終了コード 0 かつ `complete: true` のときだけ完了です。原文と最終稿は別のファイルにします。

- ADR-0007 のガードレール（`blog:check` と同じ規則）
- 会社・技術の場面での「僕」「私」
- 代表の文章で「僕」と「私」が混ざっていること
- story 以外の感嘆符
- 「試行」（「試行錯誤」は除く）
- 「Cor.株式会社」以外の社名
- 原文に無かった「必ず」「確実に」「絶対」
- yomiyasu の `run` と `verify`

`--no-yomiyasu` を付けると、意味の検査を飛ばしたことになり、完了にはなりません。python3 が無いときは終了コード 3 です。

## やらないこと

- 公開サイトの原稿を、この手順の説明のために追加しない
- en / zh / ko / es を手で直さない
- CMS の画面に、推敲ボタンを足さない（ADR-0018 の第 1 段階では、管理画面に AI を入れない）
