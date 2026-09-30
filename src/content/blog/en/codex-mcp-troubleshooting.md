---
title: "How to Set Up Codex MCP for Claude Desktop"
description: "Claude Code MCP stopped working, so I introduced the new Codex CLI's MCP. A real-life troubleshooting record of escaping from a hellish setup full of errors, with advice from Warp AI."
pubDate: 2025-10-16
author: "Terisuke"
category: "lab"
tags: ["MCP", "Claude Desktop", "Codex CLI", "トラブルシューティング", "Warp AI", "ChatGPT"]
image:
  url: "/images/blog/スクリーンショット-2025-10-16-16.52.24.avif"
  alt: "Codex MCPの設定方法"
lang: "en"
featured: true
translationSourceHash: "1bcd5dea86c80ec5be559d88239bced030c915cf654507f76872a672295482fa"
translatedAt: "2026-09-28T06:09:16.000Z"
translationModel: "adopted-legacy"
---

Claude Code MCP is no longer usable in Claude Desktop. I felt despair losing my reliable AI-driven development companion. However, there's no time to lament. As an alternative, I decided to implement the much-talked-about Codex CLI's MCP.

This is where the configuration hell began. And finally, Warp AI appeared as a savior. Today, I will record that journey.

## The Genesis: The Disappearance of Claude Code MCP

One day, suddenly, Claude Code MCP became unusable in Claude Desktop. The convenient feature that analyzes project directories disappeared. There was no error message, it just silently stopped working.

![Claude Code MCP became unusable](/images/blog/スクリーンショット-2025-10-16-16.56.23.avif)

"Oh well, let's switch to a new tool."

"Why not use OpenAI Codex CLI via MCP, which has been generating buzz lately? There's even a great article on Zenn by T. Masuyama. It should be easy to follow this."

https://zenn.dev/tmasuyama1114/articles/cdfd4562bdce78

There was a time when I thought that.

## The First Trial: Wrong Args

Following the article, I added the configuration to `claude_desktop_config.json`:

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

I restarted Claude Desktop. An error appeared.

"Huh? I did exactly as the article said?"

Checking in the terminal, I found that the command for Codex CLI was `mcp-server`:

```bash
$ codex mcp-server --help
[experimental] Run the Codex MCP server (stdio transport)

Usage: codex mcp-server [OPTIONS]
```

"I see, the command in the article is different from the actual command. Maybe it changed with a version update." I corrected it:

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

The error disappeared. "Alright, this should work!"

It didn't work.

## The Second Trial: The Subscription Wall

No matter how many times I tried in Claude Desktop, Codex MCP didn't respond. Only silence returned.

"Now that I think about it..."

I remembered that to run Codex CLI, an OpenAI API key or a ChatGPT subscription was necessary. I was so engrossed in development that I completely forgot to set up my account.

I accessed [ChatGPT](https://chatgpt.com/) and subscribed to the $20/month plan. To my surprise, the first month is currently free. Lucky me.

Next, I proceeded with the CLI setup, referring to N. Paka's note article. The authentication also passed. This time, it's perfect.

https://note.com/npaka/n/n7b6448020250

```bash
codex login
# ✓ Successfully authenticated!
```

I restarted Claude Desktop. With full confidence, I invoked Codex MCP.

It still didn't work.

## The Third Trial: The Last Resort, Warp AI

I realized I couldn't solve this on my own. At that moment, I remembered Warp, the AI editor. Warp has a built-in AI assistant. I decided to ask it, just in case.

https://www.warp.dev/

> I set codex mcp in /Users/teradakousuke/Library/Application Support/Claude/claude_desktop_config.json and tried to use it from Claude Desktop, but it's not responding. Please identify the cause and resolve it.

Warp AI read the configuration file, executed a few commands, and easily provided an answer.

![God, Buddha, Warp!](/images/blog/スクリーンショット-2025-10-16-17.00.37.avif)

## The Core of the Problem: Insufficient `env` Configuration

Warp AI's diagnosis:

1.  **Missing `env` field**: MCP servers require access to environment variables.
2.  **PATH not set**: The path to the Codex command is not being communicated.
3.  **`type` field is unnecessary**: It defaults to `stdio`, so it's redundant.

Here's the corrected configuration:

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

**The crucial part is the `env` field.** The MCP server is launched as a subprocess of Claude Desktop. Environment variables from the parent process are not automatically inherited.

Especially if you are managing Node.js with NVM, you need to explicitly specify the path to the `codex` command; otherwise, it won't be found.

## The Moment it Worked

```bash
pkill -f "Claude.app" && sleep 2 && open -a Claude
```

I restarted Claude Desktop and invoked Codex MCP.

**It finally responded.**

```text
✓ codex MCP server connected
```

## What I Learned

### 1. Official Documentation Can Also Become Outdated

The Zenn article was excellent, but the `mcp` command in Codex CLI had changed to `mcp-server` due to an update. Make it a habit to always check the official help:

```bash
codex --help
codex mcp-server --help
```

### 2. Explicitly Set Environment Variables for Subprocesses

MCP servers are launched as independent processes from Claude Desktop. Do not expect them to inherit the parent's environment variables. In particular, the PATH needs to be explicitly specified:

```json
"env": {
  "PATH": "/path/to/your/node/bin:..."
}
```

### 3. NVM Users, Be Aware

If you are managing Node.js with NVM, the `codex` command will be installed in NVM's directory. If you don't include this path in `env.PATH`, Claude Desktop won't be able to find it.

Check where your `codex` is located:

```bash
which codex
# Example output: /Users/teradakousuke/.nvm/versions/node/v20.15.0/bin/codex
```

Include this directory in your `PATH`.

### 4. The Era of Using AI to Solve AI Issues

Ultimately, Warp AI resolved the problem. It's a nested structure where you ask another AI when an AI-driven development tool isn't working.

The era of searching for answers on Stack Overflow might be over. When you encounter an error, ask the AI first. That's the development style in 2025.

## The Complete Configuration

For your reference, here is the complete working configuration:

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

### Checklist

Items to check when introducing Codex MCP:

-   [ ] ChatGPT subscription purchased (or OpenAI API key configured)
-   [ ] Authentication completed with `codex login`
-   [ ] Path confirmed with `which codex`
-   [ ] `env.PATH` added to `claude_desktop_config.json`
-   [ ] `args` set to `["mcp-server"]` (not `["mcp"]`)
-   [ ] Claude Desktop completely restarted

## Conclusion: A Journey of Troubleshooting

The path from Claude Code MCP becoming unusable to introducing Codex MCP was more arduous than I anticipated. However, I learned a lot in the process:

-   **Don't Over-rely on Documentation**: Commands change with version updates.
-   **Explicitly Set Environment Variables**: Subprocesses do not inherit the parent's environment.
-   **Seek Help from AI**: Human time is precious.

It's somewhat ironic that Warp AI ultimately provided the solution. Solving the configuration of an AI-driven development tool with another AI-driven development tool. It was a meta experience.

But that's fine. Developers of the future will need to master using AI as a means of problem-solving. While Stack Overflow and documentation are important, the value of an AI assistant that provides immediate answers on the spot is immeasurable.

Codex MCP is finally working. Development is about to accelerate with the powerful combination of Claude Desktop and Codex CLI... it should.

I'm already looking forward to what will break next (really?).

---

## Reference Links

Articles that helped with the configuration:

-   [The Story of Being Able to Call Codex from Claude Code via MCP](https://zenn.dev/tmasuyama1114/articles/cdfd4562bdce78)
-   [Codex CLI Setup](https://note.com/npaka/n/n7b6448020250)
-   [ChatGPT](https://chatgpt.com/)

*I hope this helps others struggling with the same issue. AI-driven development isn't easy, but it's fun.*
