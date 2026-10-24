---
title: "Claude Desktop에서 Codex MCP를 사용하기 위한 설정 방법"
description: "Claude Code MCP를 사용할 수 없게 되어 새롭게 Codex CLI의 MCP를 도입했습니다. 계속되는 오류 설정 지옥에서 Warp AI의 조언을 통해 벗어나기까지의 실제 트러블슈팅 기록"
summary: "Claude Desktop에서 Codex MCP가 반응하지 않았던 이유는 env 설정이 부족하여 codex 명령어로의 경로(PATH)가 전달되지 않았기 때문이었습니다. args를 mcp-server로 설정하고 env에서 PATH를 지정하자 정상적으로 동작했습니다."
pubDate: 2025-10-16
updatedDate: 2026-10-23
author: "Terisuke"
category: "lab"
tags: ["MCP", "Claude Desktop", "Codex CLI", "トラブルシューティング", "Warp AI", "ChatGPT"]
image:
  url: "/images/blog/スクリーンショット-2025-10-16-16.52.24.avif"
  alt: "Codex MCP 설정 방법"
lang: "ko"
featured: true
translationSourceHash: "a889e72c1e2a84040a81c77befce353b5407fafad1b74947813303560fd0b954"
translatedAt: "2026-10-23T06:21:44.629Z"
translationModel: "gemini-3.8-flash"
---

Claude Desktop에서 Claude Code MCP를 사용할 수 없게 되었다. AI 기반 개발의 든든한 파트너를 잃고 절망했다. 그렇다고 한탄하고 있을 시간은 없다. 대신 화제의 Codex CLI MCP를 도입하기로 했다.

거기서부터 설정 지옥이 시작되었고, 결국 구세주 Warp AI의 도움을 받았다. 오늘은 그 기록이다.

## 발단: Claude Code MCP의 소실

어느 날 갑자기, Claude Desktop에서 Claude Code MCP를 사용할 수 없게 되었다. 프로젝트 디렉터리를 분석해 주던 편리한 기능이 사라졌다. 오류 메시지도 띄우지 않고 그냥 멈춰 버렸다.

![Claude Code MCP를 사용할 수 없게 되었다](/images/blog/スクリーンショット-2025-10-16-16.56.23.avif)

'어쩔 수 없지, 새로운 툴로 갈아타자.'

요즘 화제인 OpenAI Codex CLI를 MCP를 통해 쓰면 되지 않을까? Zenn에 토마다(Tomada) 님이 작성한 훌륭한 글도 있다. 이걸 참고하면 간단할 것이다.

https://zenn.dev/tmasuyama1114/articles/cdfd4562bdce78

그렇게 생각하던 시절이 제게도 있었습니다.

## 첫 번째 시련: args가 다르다

글에 적힌 대로 `claude_desktop_config.json`에 설정을 추가했다.

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

Claude Desktop 재시작. 오류가 발생했다.

"어라, 글대로 했는데?"

터미널에서 확인해 보니, Codex CLI 명령어는 `mcp-server`였다.

```bash
$ codex mcp-server --help
[experimental] Run the Codex MCP server (stdio transport)

Usage: codex mcp-server [OPTIONS]
```

그렇구나, 글과 실제 명령어가 다른 건가. 버전 업그레이드로 변경되었을지도 모른다. 다음과 같이 수정했다.

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

오류가 사라졌다. "좋아, 이제 실행된다."

실행되지 않았다.

## 두 번째 시련: 구독의 벽

아무리 Claude Desktop에서 시도해 봐도 Codex MCP는 반응하지 않는다. 침묵만이 돌아올 뿐이다.

"그러고 보니..."

Codex CLI를 실행하려면 OpenAI API 키나 ChatGPT 구독이 필요하다는 사실이 떠올랐다. 개발에 몰두하느라 계정 설정을 완전히 잊고 있었다.

[ChatGPT](https://chatgpt.com/)에 접속하여 월 $20 플랜에 가입. 놀랍게도 지금이라면 첫 달 무료다. 럭키.

다음으로 npaka 님의 note 글을 참고하여 CLI 설정을 진행한다. 인증도 완료되었다. 이제 완벽하다.

https://note.com/npaka/n/n7b6448020250

```bash
codex login
# ✓ Successfully authenticated!
```

Claude Desktop을 재시작했다. 만반의 준비를 마치고 Codex MCP를 호출한다.

역시 실행되지 않는다.

## 세 번째 시련: 최후의 수단 Warp AI

이제 내 힘으로는 무리다. 그렇게 깨달았을 때, AI 에디터 Warp가 떠올랐다. Warp에는 내장 AI 어시스턴트가 있다. 밑져야 본전이라는 생각으로 물어보기로 했다.

https://www.warp.dev/

> I set codex mcp in /Users/teradakousuke/Library/Application Support/Claude/claude_desktop_config.json and tried to use it from Claude Desktop, but it's not responding. Please identify the cause and resolve it.

Warp AI는 설정 파일을 읽고 몇 가지 명령어를 실행하더니, 싱거울 정도로 쉽게 답을 내놓았다.

![신이시여 부처시여 워프님이시여](/images/blog/スクリーンショット-2025-10-16-17.00.37.avif)

## 문제의 본질: 부족한 env 설정

Warp AI의 진단 결과는 다음 세 가지였다.

1. MCP 서버는 환경 변수에 접근해야 하는데, `env` 필드가 없다.
2. PATH가 잡혀 있지 않아 Codex 명령어로의 경로가 전달되지 않는다.
3. `type` 필드는 필요 없다. 기본값이 `stdio`이므로 불필요하다.

수정된 설정은 다음과 같다.

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

`env` 필드가 특히 중요하다. MCP 서버는 Claude Desktop의 하위 프로세스로 실행된다. 상위 프로세스의 환경 변수가 자동으로 인계되는 것은 아니다.

특히 NVM으로 Node.js를 관리하고 있다면 codex 명령어로의 경로를 명시적으로 지정하지 않으면 찾지 못한다.

## 작동한 순간

```bash
pkill -f "Claude.app" && sleep 2 && open -a Claude
```

Claude Desktop을 재시작하고 Codex MCP를 호출한다.

**마침내 반응했다**.

```text
✓ codex MCP server connected
```

## 배운 점

### 1. 공식 문서도 낡는다

Zenn 글은 훌륭했지만 Codex CLI 업데이트로 `mcp` 명령어가 `mcp-server`로 변경되어 있었다. 항상 공식 도움말을 확인하는 습관을 들이자.

```bash
codex --help
codex mcp-server --help
```

### 2. 하위 프로세스의 환경 변수는 명시적으로

MCP 서버는 Claude Desktop에서 실행되는 독립적인 프로세스다. 상위 환경 변수를 기대해서는 안 된다. 특히 PATH는 명시적으로 지정해야 한다.

```json
"env": {
  "PATH": "/path/to/your/node/bin:..."
}
```

### 3. NVM 사용자는 주의

NVM으로 Node.js를 관리하고 있는 경우 codex 명령어는 NVM 디렉터리에 설치된다. 이 경로를 `env.PATH`에 포함하지 않으면 Claude Desktop에서는 찾지 못한다.

자신의 codex가 어디에 있는지 확인하자.

```bash
which codex
# 出力例: /Users/teradakousuke/.nvm/versions/node/v20.15.0/bin/codex
```

이 디렉터리를 `PATH`에 포함한다.

### 4. AI로 AI 문제를 해결하는 시대

결국 Warp AI가 문제를 해결해 주었다. AI 기반 개발 툴이 작동하지 않을 때 다른 AI에게 묻는 중첩 구조다.

이제 Stack Overflow에서 답을 찾는 시대는 끝난 것일지도 모른다. 오류가 발생하면 일단 AI에게 묻는다. 그것이 2025년의 개발 스타일이다.

## 완성된 설정의 전체 모습

참고를 위해 작동하는 완전한 설정을 실어 둔다.

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

Codex MCP를 도입할 때의 확인 사항은 다음과 같다.

- [ ] ChatGPT 구독 계약 완료(또는 OpenAI API 키 설정 완료)
- [ ] `codex login`로 인증 완료
- [ ] `which codex`로 경로 확인
- [ ] `claude_desktop_config.json`에 `env.PATH` 추가
- [ ] `args`는 `["mcp-server"]`(`["mcp"]`가 아님)
- [ ] Claude Desktop을 완전히 재시작

## 정리: 트러블슈팅의 여정

Claude Code MCP를 사용할 수 없게 된 후 Codex MCP를 도입하기까지의 여정은 예상보다 험난했다. 그래도 이 과정을 통해 많은 것을 배웠다.

- 문서를 과신하지 말자. 버전 업그레이드로 명령어는 바뀐다.
- 환경 변수를 명시하자. 하위 프로세스는 상위 환경을 인계받지 않는다.
- AI에게 도움을 구하자. 사람의 시간은 소중하다.

최종적으로 Warp AI가 해결해 준 것은 어떤 의미에서는 아이러니하다. AI 개발 툴 설정을 또 다른 AI 개발 툴로 해결한다. 메타적인 경험이었다.

하지만 그래도 좋다. 앞으로의 개발자는 문제 해결 수단으로서 AI를 능숙하게 활용할 필요가 있다. Stack Overflow도 문서도 중요하지만, 현장에서 즉시 답을 주는 AI 어시스턴트의 가치는 헤아릴 수 없다.

Codex MCP가 드디어 움직이기 시작했다. 앞으로 Claude Desktop과 Codex CLI의 강력한 조합으로 개발이 가속화될... 터이다.

다음에는 또 어떤 것이 먹통이 될지 벌써부터 기대된다(정말일까?).

동일한 문제로 곤란을 겪고 있는 분들께 도움이 되기를 바란다. AI 기반 개발, 만만치 않지만 즐겁다.

---

## 참고 자료

설정에 도움이 된 글들.

- [Claude Code에서 Codex를 MCP로 호출할 수 있게 된 이야기](https://zenn.dev/tmasuyama1114/articles/cdfd4562bdce78)
- [Codex CLI 설정](https://note.com/npaka/n/n7b6448020250)
- [ChatGPT](https://chatgpt.com/)
