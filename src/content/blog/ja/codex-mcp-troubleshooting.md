---
title: "Claude DesktopでCodex MCPを使うための設定方法"
description: "Claude Code MCPが使えなくなったので新しくCodex CLIのMCPを導入。エラー続きの設定地獄から、Warp AIの助言で抜け出すまでの実録トラブルシューティング"
summary: "Claude DesktopからCodex MCPが反応しなかったのは、envの設定が足りず、codexコマンドへのパスが伝わっていなかったからだ。argsをmcp-serverにし、envでPATHを指定すると動いた。"
pubDate: 2025-10-16
updatedDate: 2026-10-23
author: "Terisuke"
category: "lab"
tags: ["MCP", "Claude Desktop", "Codex CLI", "トラブルシューティング", "Warp AI", "ChatGPT"]
image:
  url: "/images/blog/スクリーンショット-2025-10-16-16.52.24.avif"
  alt: "Codex MCPの設定方法"
lang: "ja"
featured: true
---

Claude DesktopでClaude Code MCPが使えなくなった。AI駆動開発の頼れる相棒を失って、絶望した。とはいえ、嘆いている暇はない。代わりに、話題のCodex CLIのMCPを導入することにした。

そこから設定地獄が始まり、最後は救世主のWarp AIに助けられた。今日はその記録だ。

## 発端：Claude Code MCPの消失

ある日突然、Claude DesktopでClaude Code MCPが使えなくなった。プロジェクトのディレクトリを分析してくれる便利な機能が消えた。エラーメッセージも出さずに、ただ動かなくなった。

![Claude Code MCPが使えなくなった](/images/blog/スクリーンショット-2025-10-16-16.56.23.avif)

「仕方ない、新しいツールに乗り換えよう」

最近話題のOpenAI Codex CLIをMCP経由で使えばいいじゃないか。Zennにとまださんの素晴らしい記事もある。これを参考にすれば簡単だろう。

https://zenn.dev/tmasuyama1114/articles/cdfd4562bdce78

そう思っていた時期が僕にもありました。

## 第一の試練：argsが違う

記事の通りに`claude_desktop_config.json`に設定を追加した。

```json
{
  "mcpServers": {
    "codex": {
      "type": "stdio",
      "command": "codex",
      "args": ["mcp"]
    }
  }
}
```

Claude Desktopを再起動。エラーが出た。

「え、記事通りにやったのに？」

ターミナルで確認してみると、Codex CLIのコマンドは`mcp-server`だった。

```bash
$ codex mcp-server --help
[experimental] Run the Codex MCP server (stdio transport)

Usage: codex mcp-server [OPTIONS]
```

なるほど、記事と実際のコマンドが違うのか。バージョンアップで変わったのかもしれない。次のように修正した。

```json
{
  "mcpServers": {
    "codex": {
      "command": "codex",
      "args": ["mcp-server"]
    }
  }
}
```

エラーは消えた。「よし、これで動く」

動かなかった。

## 第二の試練：サブスクリプションの壁

何度Claude Desktopで試しても、Codex MCPが反応しない。沈黙だけが返ってくる。

「そういえば・・・」

Codex CLIを動かすには、OpenAIのAPIキーかChatGPTのサブスクリプションが必要だったことを思い出した。開発に夢中で、アカウントの設定を完全に忘れていた。

[ChatGPT](https://chatgpt.com/)にアクセスして、$20/月のプランに加入。なんと今なら初月無料だ。ラッキー。

次にnpaka先生のnote記事を参考にCLIのセットアップを進める。認証も通った。これで完璧だ。

https://note.com/npaka/n/n7b6448020250

```bash
codex login
# ✓ Successfully authenticated!
```

Claude Desktopを再起動。満を持してCodex MCPを呼び出す。

やはり動かない。

## 第三の試練：最終手段Warp AI

もう自力では無理だ。そう悟ったとき、AIエディターのWarpを思い出した。Warpには組み込みのAIアシスタントがある。ダメ元で聞いてみよう。

https://www.warp.dev/

> I set codex mcp in /Users/teradakousuke/Library/Application Support/Claude/claude_desktop_config.json and tried to use it from Claude Desktop, but it's not responding. Please identify the cause and resolve it.

Warp AIは設定ファイルを読み込み、いくつかのコマンドを実行して、あっさり答えを出してきた。

![神様仏様ワープ様](/images/blog/スクリーンショット-2025-10-16-17.00.37.avif)

## 問題の本質：env設定が足りない

Warp AIの診断結果は次の3つだった。

1. MCPサーバーは環境変数へのアクセスが必要なのに、`env`フィールドがない。
2. PATHが通っておらず、Codexコマンドへのパスが伝わっていない。
3. `type`フィールドは要らない。デフォルトで`stdio`なので冗長だ。

修正された設定は次のとおり。

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/teradakousuke/Desktop",
        "/Users/teradakousuke/Downloads",
        "/Users/teradakousuke/Developer"
      ]
    },
    "codex": {
      "command": "codex",
      "args": ["mcp-server"],
      "env": {
        "PATH": "/Users/teradakousuke/.nvm/versions/node/v20.15.0/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
      }
    }
  }
}
```

`env`フィールドがとくに重要だ。MCPサーバーはClaude Desktopのサブプロセスとして起動される。親プロセスの環境変数が自動的に引き継がれるわけではないのだ。

特に、NVMでNode.jsを管理している場合、codexコマンドへのパスを明示的に指定しないと見つからない。

## 動いた瞬間

```bash
pkill -f "Claude.app" && sleep 2 && open -a Claude
```

Claude Desktopを再起動して、Codex MCPを呼び出す。

**ついに反応した**。

```text
✓ codex MCP server connected
```

## 学んだこと

### 1. 公式ドキュメントも古くなる

Zennの記事は素晴らしかったが、Codex CLIのアップデートで`mcp`コマンドが`mcp-server`に変わっていた。常に公式のヘルプを確認する癖をつけよう。

```bash
codex --help
codex mcp-server --help
```

### 2. サブプロセスの環境変数は明示的に

MCPサーバーはClaude Desktopから起動される独立したプロセスだ。親の環境変数を期待してはいけない。特にPATHは明示的に指定する必要がある。

```json
"env": {
  "PATH": "/path/to/your/node/bin:..."
}
```

### 3. NVMユーザーは要注意

NVMでNode.jsを管理している場合、codexコマンドはNVMのディレクトリにインストールされる。このパスを`env.PATH`に含めないと、Claude Desktopからは見つからない。

自分のcodexがどこにあるか確認しよう。

```bash
which codex
# 出力例: /Users/teradakousuke/.nvm/versions/node/v20.15.0/bin/codex
```

このディレクトリを`PATH`に含める。

### 4. AIでAIのトラブルを解決する時代

最終的にWarp AIが問題を解決してくれた。AI駆動開発のツールが動かないとき、別のAIに聞くという入れ子構造だ。

もはやStack Overflowで答えを探す時代は終わったのかもしれない。エラーが出たら、とりあえずAIに聞く。それが2025年の開発スタイルだ。

## 完成した設定の全体像

参考までに、動作する完全な設定を載せておく。

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/teradakousuke/Desktop",
        "/Users/teradakousuke/Downloads",
        "/Users/teradakousuke/Developer",
        "/Users/teradakousuke/Library",
        "/Users/teradakousuke"
      ]
    },
    "codex": {
      "command": "codex",
      "args": ["mcp-server"],
      "env": {
        "PATH": "/Users/teradakousuke/.nvm/versions/node/v20.15.0/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
      }
    }
  }
}
```

### チェックリスト

Codex MCPを導入するときの確認事項は次のとおり。

- [ ] ChatGPTのサブスクリプション契約済み（または OpenAI API キー設定済み）
- [ ] `codex login`で認証完了
- [ ] `which codex`でパスを確認
- [ ] `claude_desktop_config.json`に`env.PATH`を追加
- [ ] `args`は`["mcp-server"]`（`["mcp"]`ではない）
- [ ] Claude Desktopを完全に再起動

## まとめ：トラブルシューティングの旅

Claude Code MCPが使えなくなってから、Codex MCPを導入するまでの道のりは予想以上に険しかった。それでも、この過程で多くのことを学んだ。

- ドキュメントを過信しない。バージョンアップでコマンドは変わる。
- 環境変数を明示する。サブプロセスは親の環境を引き継がない。
- AIに助けを求める。人間の時間は貴重だ。

最終的にWarp AIが解決してくれたのは、ある意味皮肉だ。AI開発ツールの設定を、別のAI開発ツールで解決する。メタ的な体験だった。

しかし、それでいいのだ。これからの開発者は問題解決の手段としてAIを使いこなす必要がある。Stack Overflowもドキュメントも大事だが、現場で即座に答えをくれるAIアシスタントの価値は計り知れない。

Codex MCPがようやく動き始めた。これからClaude DesktopとCodex CLIの強力なコンビネーションで開発が加速する・・・はずだ。

次は何が使えなくなるのか、今から楽しみである（本当か？）。

同じ問題で困っている人の助けになれば幸いだ。AI駆動開発、楽じゃないけど楽しい。

---

## 参考資料

設定に役立った記事たち。

- [Claude CodeからCodexをMCPで呼び出せるようになった話](https://zenn.dev/tmasuyama1114/articles/cdfd4562bdce78)
- [Codex CLI のセットアップ](https://note.com/npaka/n/n7b6448020250)
- [ChatGPT](https://chatgpt.com/)
