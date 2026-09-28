---
title: "Claude Desktop에서 Codex MCP를 사용하기 위한 설정 방법"
description: "Claude Code MCP를 사용할 수 없게 되어 새로 Codex CLI의 MCP를 도입했습니다. 오류가 계속되던 설정 지옥에서 Warp AI의 조언으로 벗어나기까지의 실제 트러블슈팅"
pubDate: 2025-10-16
author: "Terisuke"
category: "lab"
tags: ["MCP", "Claude Desktop", "Codex CLI", "トラブルシューティング", "Warp AI", "ChatGPT"]
image:
  url: "/images/blog/スクリーンショット-2025-10-16-16.52.24.avif"
  alt: "Codex MCPの設定方法"
lang: "ko"
featured: true
translationSourceHash: "1bcd5dea86c80ec5be559d88239bced030c915cf654507f76872a672295482fa"
translatedAt: "2026-09-28T06:09:16.015Z"
translationModel: "adopted-legacy"
---

Claude Desktop에서 Claude Code MCP를 사용할 수 없게 되었다. AI 기반 개발의 든든한 동반자를 잃은 절망감. 하지만 탄식할 시간이 없다. 대체 방안으로 화제가 된 Codex CLI의 MCP를 도입하기로 했다.

그때부터 시작된 설정 지옥. 그리고 마지막 구세주처럼 나타난 Warp AI. 오늘은 그 기록이다.

## 발단: Claude Code MCP의 사라짐

어느 날 갑자기, Claude Desktop에서 Claude Code MCP를 사용할 수 없게 되었다. 프로젝트 디렉토리를 분석해 주는 편리한 기능이 사라졌다. 오류 메시지도 없이, 그저 조용히 작동을 멈췄다.

![Claude Code MCP를 사용할 수 없게 되었다](/images/blog/スクリーンショット-2025-10-16-16.56.23.avif)

"어쩔 수 없지, 새로운 툴로 갈아타자."

최근 화제가 된 OpenAI Codex CLI를 MCP를 통해 사용하면 되지 않을까? Zenn에는 타마야마 씨의 훌륭한 글도 있다. 이걸 참고하면 간단할 것이다.

https://zenn.dev/tmasuyama1114/articles/cdfd4562bdce78

그렇게 생각하던 시절이 나에게도 있었다.

## 첫 번째 시련: args가 다르다

글의 내용대로 `claude_desktop_config.json`에 설정을 추가했다:

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

Claude Desktop을 재시작했다. 오류가 발생했다.

"뭐야, 글대로 했는데?"

터미널에서 확인해 보니, Codex CLI의 명령어는 `mcp-server`였다:

```bash
$ codex mcp-server --help
[experimental] Run the Codex MCP server (stdio transport)

Usage: codex mcp-server [OPTIONS]
```

알겠다, 글과 실제 명령어가 다른 것이다. 버전업으로 바뀌었을 수도 있다. 수정하자:

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

오류는 사라졌다. "좋아, 이제 작동하겠지!"

작동하지 않았다.

## 두 번째 시련: 구독의 벽

몇 번이고 Claude Desktop에서 시도해도, Codex MCP가 반응하지 않는다. 침묵만이 돌아왔다.

"그러고 보니..."

Codex CLI를 구동하려면 OpenAI API 키 또는 ChatGPT 구독이 필요했다는 것을 떠올렸다. 개발에 열중하느라 계정 설정을 완전히 잊고 있었다.

[ChatGPT](https://chatgpt.com/)에 접속하여 월 20달러 요금제에 가입했다. 마침 지금은 첫 달 무료다. 운이 좋다.

다음으로 나파카 선생님의 note 글을 참고하여 CLI 설정을 진행했다. 인증도 통과했다. 이제 완벽하다.

https://note.com/npaka/n/n7b6448020250

```bash
codex login
# ✓ Successfully authenticated!
```

Claude Desktop을 재시작했다. 만반의 준비를 하고 Codex MCP를 호출한다.

결국 작동하지 않았다.

## 세 번째 시련: 최후의 수단 Warp AI

이제 혼자서는 무리다. 그렇게 깨달은 순간, AI 에디터 Warp를 떠올렸다. Warp에는 내장 AI 어시스턴트가 있다. 밑져야 본전이라 생각하고 물어보자.

https://www.warp.dev/

> I set codex mcp in /Users/teradakousuke/Library/Application Support/Claude/claude_desktop_config.json and tried to use it from Claude Desktop, but it's not responding. Please identify the cause and resolve it.

Warp AI는 설정 파일을 읽고 몇 가지 명령어를 실행하여, 쉽게 답을 찾아냈다.

![신이시여 부처님이시여 워프님이시여](/images/blog/スクリーンショット-2025-10-16-17.00.37.avif)

## 문제의 본질: env 설정이 부족하다

Warp AI의 진단 결과:

1. **`env` 필드가 없다**: MCP 서버는 환경 변수에 대한 접근이 필요하다.
2. **PATH가 설정되지 않았다**: Codex 명령어에 대한 경로가 전달되지 않았다.
3. **`type` 필드가 불필요하다**: 기본적으로 `stdio`이므로 불필요하다.

수정된 설정은 다음과 같다:

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

**중요한 것은 `env` 필드다**. MCP 서버는 Claude Desktop의 하위 프로세스로 실행된다. 상위 프로세스의 환경 변수가 자동으로 상속되는 것은 아니다.

특히 NVM으로 Node.js를 관리하는 경우, `codex` 명령어에 대한 경로를 명시적으로 지정하지 않으면 찾을 수 없다.

## 작동하는 순간

```bash
pkill -f "Claude.app" && sleep 2 && open -a Claude
```

Claude Desktop을 재시작하고, Codex MCP를 호출한다.

**드디어 반응했다.**

```text
✓ codex MCP server connected
```

## 배운 점

### 1. 공식 문서도 오래될 수 있다

Zenn의 글은 훌륭했지만, Codex CLI의 업데이트로 `mcp` 명령어가 `mcp-server`로 바뀌었다. 항상 공식 도움말을 확인하는 습관을 들이자:

```bash
codex --help
codex mcp-server --help
```

### 2. 하위 프로세스의 환경 변수는 명시적으로

MCP 서버는 Claude Desktop에서 실행되는 독립 프로세스다. 상위 프로세스의 환경 변수를 기대해서는 안 된다. 특히 PATH는 명시적으로 지정할 필요가 있다:

```json
"env": {
  "PATH": "/path/to/your/node/bin:..."
}
```

### 3. NVM 사용자 주의

NVM으로 Node.js를 관리하는 경우, `codex` 명령어는 NVM 디렉토리에 설치된다. 이 경로를 `env.PATH`에 포함하지 않으면 Claude Desktop에서 찾을 수 없다.

자신의 `codex`가 어디에 있는지 확인하자:

```bash
which codex
# 출력 예: /Users/teradakousuke/.nvm/versions/node/v20.15.0/bin/codex
```

이 디렉토리를 `PATH`에 포함시킨다.

### 4. AI로 AI의 문제를 해결하는 시대

결국 Warp AI가 문제를 해결해 주었다. AI 기반 개발 툴이 작동하지 않을 때, 다른 AI에게 묻는 중첩 구조.

이제 Stack Overflow에서 답을 찾는 시대는 끝났을지도 모른다. 오류가 발생하면, 일단 AI에게 묻자. 그것이 2025년의 개발 스타일이다.

## 완성된 설정의 전체 모습

참고로, 작동하는 완전한 설정을 게재한다:

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

### 체크리스트

Codex MCP를 도입할 때 확인 사항:

- [ ] ChatGPT 구독 계약 완료 (또는 OpenAI API 키 설정 완료)
- [ ] `codex login`으로 인증 완료
- [ ] `which codex`로 경로 확인
- [ ] `claude_desktop_config.json`에 `env.PATH` 추가
- [ ] `args`는 `["mcp-server"]` (`["mcp"]`가 아님)
- [ ] Claude Desktop 완전히 재시작

## 요약: 트러블슈팅의 여정

Claude Code MCP를 사용할 수 없게 된 이후, Codex MCP를 도입하기까지의 과정은 예상보다 훨씬 험난했다. 하지만 이 과정에서 많은 것을 배웠다:

- **문서를 과신하지 말자**: 버전 업데이트로 명령어는 바뀐다.
- **환경 변수를 명시하자**: 하위 프로세스는 상위 프로세스의 환경을 상속하지 않는다.
- **AI에게 도움을 구하자**: 인간의 시간은 소중하다.

결국 Warp AI가 해결해 준 것은, 어떤 의미에서는 아이러니하다. AI 기반 개발 툴의 설정을, 다른 AI 기반 개발 툴로 해결하는 것. 메타적인 경험이었다.

하지만 그래도 괜찮다. 앞으로의 개발자는 문제 해결 수단으로 AI를 능숙하게 다루어야 한다. Stack Overflow도 문서도 중요하지만, 현장에서 즉각적으로 답을 주는 AI 어시스턴트의 가치는 헤아릴 수 없다.

Codex MCP, 드디어 작동하기 시작했다. 이제부터 Claude Desktop과 Codex CLI의 강력한 조합으로 개발이 가속될... 것이다.

다음은 무엇이 망가질지, 지금부터 기대된다 (정말인가?).

---

## 참고 링크

설정에 도움이 된 글들:

- [Claude Code에서 Codex를 MCP로 호출할 수 있게 된 이야기](https://zenn.dev/tmasuyama1114/articles/cdfd4562bdce78)
- [Codex CLI 설정](https://note.com/npaka/n/n7b6448020250)
- [ChatGPT](https://chatgpt.com/)

*같은 문제로 어려움을 겪는 사람들에게 도움이 되기를 바란다. AI 기반 개발, 쉽지 않지만 즐겁다.*
