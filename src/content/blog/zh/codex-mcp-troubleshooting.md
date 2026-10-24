---
title: "在Claude Desktop中使用Codex MCP的配置方法"
description: "由于Claude Code MCP无法使用，因此新引入了Codex CLI的MCP。记录从错误不断的配置困境中，借助Warp AI的建议成功脱困的实际故障排查过程"
summary: "Claude Desktop中Codex MCP未响应的原因是缺少env配置，未能正确传递codex命令的路径。将args设置为mcp-server并在env中指定PATH后便恢复正常运行。"
pubDate: 2025-10-16
updatedDate: 2026-10-23
author: "Terisuke"
category: "lab"
tags: ["MCP", "Claude Desktop", "Codex CLI", "トラブルシューティング", "Warp AI", "ChatGPT"]
image:
  url: "/images/blog/スクリーンショット-2025-10-16-16.52.24.avif"
  alt: "Codex MCP的配置方法"
lang: "zh"
featured: true
translationSourceHash: "a889e72c1e2a84040a81c77befce353b5407fafad1b74947813303560fd0b954"
translatedAt: "2026-10-23T06:18:38.907Z"
translationModel: "gemini-3.8-flash"
---

在Claude Desktop中，Claude Code MCP突然无法使用了。失去了AI驱动开发中值得信赖的伙伴，我一度陷入绝望。不过，没有时间在此感叹了。我决定改用最近成为热门话题的Codex CLI MCP。

自此拉开了配置地狱的序幕，最终幸得救世主Warp AI相助。今天就来记录这段经历。

## 起因：Claude Code MCP的消失

某天，Claude Desktop中的Claude Code MCP毫无征兆地无法使用了。那个能为我分析项目目录的便利功能不见了。甚至没有弹出任何报错信息，就只是单纯无法运行。

![Claude Code MCP无法使用了](/images/blog/スクリーンショット-2025-10-16-16.56.23.avif)

“没办法，换个新工具吧。”

既然如此，不如通过MCP来使用最近大热的OpenAI Codex CLI。Zenn上也有Tomada先生写的一篇非常棒的文章。参考那篇文章应该轻而易举吧。

https://zenn.dev/tmasuyama1114/articles/cdfd4562bdce78

曾经的我也曾这样天真地以为。

## 第一重考验：args不同

我按照文章说明在`claude_desktop_config.json`中添加了配置。

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

重启Claude Desktop。报错了。

“咦，我明明是按文章一步步来的啊？”

在终端中确认了一下，发现Codex CLI的命令其实是`mcp-server`。

```bash
$ codex mcp-server --help
[experimental] Run the Codex MCP server (stdio transport)

Usage: codex mcp-server [OPTIONS]
```

原来如此，文章里的命令和实际不同。可能是版本更新导致的改动吧。于是我修正如下。

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

报错消失了。“很好，这样就能用了。”

并没有运行。

## 第二重考验：订阅之墙

无论在Claude Desktop中尝试多少次，Codex MCP都毫无反应。得到的只有一片沉默。

“说起来……”

我想起要运行Codex CLI，需要OpenAI的API密钥或ChatGPT的订阅。只顾着埋头开发，把账号配置完全抛在脑后了。

访问[ChatGPT](https://chatgpt.com/)，订阅了$20/月的方案。没想到现在首月免费，太走运了。

接着参考npaka老师在note上的文章进行CLI的安装配置。认证也顺利通过。这下万无一失了。

https://note.com/npaka/n/n7b6448020250

```bash
codex login
# ✓ Successfully authenticated!
```

重启Claude Desktop。万事俱备，调用Codex MCP。

依然毫无动静。

## 第三重考验：终极手段Warp AI

我意识到靠自己已经无法解决了。就在此时，我想起了AI终端编辑器Warp。Warp内置了AI助手。抱着死马当活马医的心态问问看吧。

https://www.warp.dev/

> I set codex mcp in /Users/teradakousuke/Library/Application Support/Claude/claude_desktop_config.json and tried to use it from Claude Desktop, but it's not responding. Please identify the cause and resolve it.

Warp AI读取了配置文件，执行了几条命令后，轻而易举地给出了答案。

![Warp大显神通](/images/blog/スクリーンショット-2025-10-16-17.00.37.avif)

## 问题的本质：缺少env配置

Warp AI给出的诊断结果有以下3点：

1. MCP服务器需要访问环境变量，但缺少`env`字段。
2. PATH未生效，未能传递Codex命令的路径。
3. 不需要`type`字段。默认值即为`stdio`，属于多余配置。

修正后的配置如下。

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

`env`字段尤为关键。MCP服务器是作为Claude Desktop的子进程启动的，并不会自动继承父进程的环境变量。

特别是使用NVM管理Node.js时，如果不明确指定codex命令的路径，就会找不到它。

## 成功运行的瞬间

```bash
pkill -f "Claude.app" && sleep 2 && open -a Claude
```

重启Claude Desktop，调用Codex MCP。

**终于有反应了**。

```text
✓ codex MCP server connected
```

## 经验与总结

### 1. 官方文档也会过时

Zenn上的文章虽然写得很好，但随着Codex CLI的更新，`mcp`命令已经变更为`mcp-server`。要养成随时查看官方帮助信息的习惯。

```bash
codex --help
codex mcp-server --help
```

### 2. 子进程的环境变量必须显式指定

MCP服务器是由Claude Desktop启动的独立进程。切勿指望它能继承父进程的环境变量。尤其是PATH，必须显式指定。

```json
"env": {
  "PATH": "/path/to/your/node/bin:..."
}
```

### 3. NVM用户需格外注意

使用NVM管理Node.js时，codex命令会被安装在NVM目录下。如果不把该路径加入`env.PATH`，Claude Desktop将无法找到该命令。

请确认自己的codex位于何处。

```bash
which codex
# 出力例: /Users/teradakousuke/.nvm/versions/node/v20.15.0/bin/codex
```

将该目录添加到`PATH`中。

### 4. 用AI解决AI故障的时代

最终是Warp AI帮我解决了问题。AI驱动开发工具失灵时，求助于另一个AI，构成了这样一层套娃结构。

在Stack Overflow上寻找答案的时代或许已经落幕。遇到报错，先问AI。这就是2025年的开发风格。

## 完整配置总览

供大家参考，以下附上能够正常运行的完整配置。

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

### 检查清单

引入Codex MCP时的核对事项如下：

- [ ] 已订阅ChatGPT（或已设置OpenAI API密钥）
- [ ] 已通过`codex login`完成认证
- [ ] 已通过`which codex`确认路径
- [ ] `claude_desktop_config.json`中已添加`env.PATH`
- [ ] `args`为`["mcp-server"]`（而非`["mcp"]`）
- [ ] 已彻底重启Claude Desktop

## 结语：排错之旅

从Claude Code MCP失效，到成功引入Codex MCP，一路走来的曲折远超预期。但在这个过程中，我确实收获良多。

- 不要过分迷信文档。版本更新会导致命令变动。
- 显式声明环境变量。子进程不会继承父进程的环境。
- 寻求AI的帮助。人类的时间弥足珍贵。

最终由Warp AI解决问题，某种意义上有些讽刺。用一款AI开发工具解决另一款AI开发工具的配置问题，真是一次充满元意味的体验。

然而，这并没有什么不好。未来的开发者本就需要将AI作为解决问题的手段灵活运用。Stack Overflow和文档固然重要，但能在现场即时给出答案的AI助手，其价值不可估量。

Codex MCP终于跑起来了。接下来，Claude Desktop与Codex CLI的强强联合将让开发全面提速……理应如此。

我已经开始期待下一次会有什么工具突然失效了（真的吗？）。

希望能为遇到同样问题的朋友提供帮助。AI驱动开发，虽不易，却有趣。

---

## 参考资料

在配置过程中提供帮助的文章：

- [通过MCP从Claude Code调用Codex的实践记录](https://zenn.dev/tmasuyama1114/articles/cdfd4562bdce78)
- [Codex CLI 的安装配置](https://note.com/npaka/n/n7b6448020250)
- [ChatGPT](https://chatgpt.com/)
