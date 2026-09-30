---
title: "在 Claude Desktop 中设置使用 Codex MCP 的方法"
description: "Claude Code MCP 无法使用，因此引入了新的 Codex CLI MCP。这是从错误频发的设置地狱中，在 Warp AI 的建议下脱困的实录故障排除。"
pubDate: 2025-10-16
author: "Terisuke"
category: "lab"
tags: ["MCP", "Claude Desktop", "Codex CLI", "トラブルシューティング", "Warp AI", "ChatGPT"]
image:
  url: "/images/blog/スクリーンショット-2025-10-16-16.52.24.avif"
  alt: "Codex MCPの設定方法"
lang: "zh"
featured: true
translationSourceHash: "1bcd5dea86c80ec5be559d88239bced030c915cf654507f76872a672295482fa"
translatedAt: "2026-09-28T06:09:16.008Z"
translationModel: "adopted-legacy"
---

Claude Desktop 突然无法使用 Claude Code MCP。失去 AI 驱动开发的可信赖伙伴，感到绝望。然而，没有时间悲叹。作为替代方案，我决定引入备受瞩目的 Codex CLI 的 MCP。

从那里开始的就是配置地狱。最后，Warp AI 作为救世主出现了。今天，我将记录下这一切。

## 起因：Claude Code MCP 的消失

有一天，Claude Desktop 突然无法使用 Claude Code MCP。那个能分析项目目录的便捷功能消失了。没有错误消息，它只是静静地停止了工作。

![Claude Code MCP 无法使用](/images/blog/スクリーンショット-2025-10-16-16.56.23.avif)

“没办法，换个新工具吧。”

为什么不通过 MCP 使用最近备受关注的 OpenAI Codex CLI 呢？Zenn 上还有 Tmasuyama 先生的精彩文章。参考这个应该很容易。

https://zenn.dev/tmasuyama1114/articles/cdfd4562bdce78

我也有过那样想的时期。

## 第一次试炼：参数不匹配

按照文章的说明，在 `claude_desktop_config.json` 中添加了配置：

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

重新启动 Claude Desktop。出现了错误。

“喂，明明是按照文章做的呀？”

在终端确认后，发现 Codex CLI 的命令是 `mcp-server`：

```bash
$ codex mcp-server --help
[experimental] Run the Codex MCP server (stdio transport)

Usage: codex mcp-server [OPTIONS]
```

原来如此，文章和实际命令不一样。可能是版本升级改变了。修正一下：

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

错误消失了。“太好了，这样应该能用了！”

并没有成功。

## 第二次试炼：订阅的障碍

无论在 Claude Desktop 中尝试多少次，Codex MCP 都没有反应。只有沉默回应。

“说起来……”

我想起了，要运行 Codex CLI 需要 OpenAI 的 API 密钥或 ChatGPT 的订阅。我沉迷于开发，完全忘记了账户设置。

访问 [ChatGPT](https://chatgpt.com/)，购买了每月 20 美元的套餐。现在竟然是第一个月免费。太幸运了。

接着，我参考 Npaka 老师的 Note 文章，继续进行 CLI 的设置。认证也通过了。这次应该是万无一失了。

https://note.com/npaka/n/n7b6448020250

```bash
codex login
# ✓ Successfully authenticated!
```

重新启动 Claude Desktop。满怀期待地调用 Codex MCP。

结果还是不行。

## 第三次试炼：最后的手段 Warp AI

我已经无法靠自己解决了。就在我领悟到这一点时，我想起了 AI 编辑器 Warp。Warp 内置了 AI 助手。抱着试一试的心态问了问。

https://www.warp.dev/

> I set codex mcp in /Users/teradakousuke/Library/Application Support/Claude/claude_desktop_config.json and tried to use it from Claude Desktop, but it's not responding. Please identify the cause and resolve it.

Warp AI 读取了配置文件，执行了一些命令，轻松地给出了答案。

![神様仏様ワープ様](/images/blog/スクリーンショット-2025-10-16-17.00.37.avif)

## 问题本质：环境变量设置不足

Warp AI 的诊断结果：

1.  **缺少 `env` 字段**：MCP 服务器需要访问环境变量。
2.  **PATH 环境变量未设置**：Codex 命令的路径没有传递。
3.  **`type` 字段不必要**：默认是 `stdio`，所以冗余。

修正后的配置如下：

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

**关键在于 `env` 字段**。MCP 服务器作为 Claude Desktop 的子进程启动。父进程的环境变量不会自动继承。

特别是，如果您使用 NVM 管理 Node.js，不明确指定 codex 命令的路径，就无法找到它。

## 成功运行的瞬间

```bash
pkill -f "Claude.app" && sleep 2 && open -a Claude
```

重新启动 Claude Desktop，调用 Codex MCP。

**终于有了反应。**

```text
✓ codex MCP server connected
```

## 学到的东西

### 1. 官方文档也会过时

Zenn 上的文章非常精彩，但 Codex CLI 更新后，`mcp` 命令变成了 `mcp-server`。要养成随时查阅官方帮助的习惯：

```bash
codex --help
codex mcp-server --help
```

### 2. 子进程的环境变量需要明确指定

MCP 服务器是 Claude Desktop 启动的独立进程。不要指望继承父进程的环境变量。特别是 PATH 需要明确指定：

```json
"env": {
  "PATH": "/path/to/your/node/bin:..."
}
```

### 3. NVM 用户请注意

如果您使用 NVM 管理 Node.js，codex 命令会安装在 NVM 的目录下。如果不将此路径包含在 `env.PATH` 中，Claude Desktop 将找不到它。

请检查您的 codex 在哪里：

```bash
which codex
# 示例输出: /Users/teradakousuke/.nvm/versions/node/v20.15.0/bin/codex
```

将此目录包含在 `PATH` 中。

### 4. AI 时代，用 AI 解决 AI 的问题

最终是 Warp AI 解决了问题。AI 驱动开发工具无法工作时，询问另一个 AI，这种嵌套结构。

也许通过 Stack Overflow 寻找答案的时代已经结束了。出现错误时，先问 AI。这才是 2025 年的开发风格。

## 完成的配置整体概览

仅供参考，这是可用的完整配置：

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

### 清单

导入 Codex MCP 时的检查事项：

- [ ] 已签订 ChatGPT 订阅（或已设置 OpenAI API 密钥）。
- [ ] 通过 `codex login` 完成认证。
- [ ] 通过 `which codex` 确认路径。
- [ ] 在 `claude_desktop_config.json` 中添加 `env.PATH`。
- [ ] `args` 为 `["mcp-server"]`（不是 `["mcp"]`）。
- [ ] 完全重新启动 Claude Desktop。

## 总结：故障排除之旅

从 Claude Code MCP 无法使用到导入 Codex MCP 的过程比预想的要艰难得多。但是，在这个过程中我学到了很多：

-   **不要过分依赖文档**：版本升级会导致命令变化。
-   **明确指定环境变量**：子进程不会继承父进程的环境。
-   **向 AI 求助**：人类的时间是宝贵的。

最终 Warp AI 解决了问题，这在某种意义上是讽刺的。用另一个 AI 开发工具来解决 AI 开发工具的配置问题。这是一种元体验。

但是，这样很好。未来的开发者需要能够熟练使用 AI 作为解决问题的手段。Stack Overflow 和文档都很重要，但即时提供现场答案的 AI 助手的价值是无法估量的。

Codex MCP，终于开始工作了。从现在开始，Claude Desktop 和 Codex CLI 的强大组合将加速开发……应该会的。

接下来会坏什么呢，我已经开始期待了（真的吗？）。

---

## 参考链接

帮助配置的文章：

-   [Claude Code 调用 Codex MCP 的故事](https://zenn.dev/tmasuyama1114/articles/cdfd4562bdce78)
-   [Codex CLI 的设置](https://note.com/npaka/n/n7b6448020250)
-   [ChatGPT](https://chatgpt.com/)

*希望这能帮助到遇到同样问题的人。AI 驱动开发，虽然不容易，但很有趣。*
