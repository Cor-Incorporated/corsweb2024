---
title: "【Marp×VOICEVOX×VTubeStudio】让ずんだもん做LT发表"
description: "这个项目源于“想用 AI 做些无聊的事情！”的纯粹好奇心。作为一项有趣且富有创造性地利用技术的实验，我们构建了一个能让ずんだもん自动进行 LT 発表（短演讲）的系统。"
pubDate: 2024-01-30
author: "Terisuke"
category: "lab"
tags: ["Marp", "VOICEVOX", "VTubeStudio", "自動化", "創造的プロジェクト"]
lang: "zh"
translationSourceHash: "1415a08c523813b0effca65908d713100563119940d89a8ecb6f61be7869c763"
translatedAt: "2026-09-28T06:09:16.013Z"
translationModel: "adopted-legacy"
---

# 【Marp×VOICEVOX×VTubeStudio】让ずんだもん做LT发表

这个项目源于“想用 AI 做些无聊的事情！”的纯粹好奇心。作为一项有趣且富有创造性地利用技术的实验，我们构建了一个能让ずんだもん自动进行 LT 発表（短演讲）的系统。

反正我自己発表也腻了，就全部交给ずんだもん了。结果，她比我更受欢迎，这是秘密。

## 项目构成要素

### 1. Marp - 演示文稿制作

```markdown
---
marp: true
theme: default
class: lead
---

# ずんだもん的 LT
## 让我们一起玩转技术吧！

---

# 今天聊什么
- 自动化太有趣了！
- 大家一起来享受技术吧！
```

### 2. VOICEVOX - 语音合成

```python
import requests

API_URL = "http://localhost:50021"

def generate_zundamon_voice(text: str) -> bytes:
    """调用 VOICEVOX API 获取音频数据 (wav)"""

    query_params = {"text": text, "speaker": 3}

    # 生成语音查询
    query_resp = requests.post(f"{API_URL}/audio_query", params=query_params, timeout=10)
    if query_resp.status_code != 200:
        raise RuntimeError(f"audio_query 失败 → {query_resp.status_code}: {query_resp.text}")

    # 语音合成
    synth_resp = requests.post(
        f"{API_URL}/synthesis",
        params={"speaker": 3},
        data=query_resp.content,
        timeout=30
    )
    if synth_resp.status_code != 200:
        raise RuntimeError(f"synthesis 失败 → {synth_resp.status_code}: {synth_resp.text}")

    return synth_resp.content
```

### 3. VTubeStudio - 角色控制

```javascript
// 使用 VTubeStudio API 进行角色控制
class VTubeStudioController {
  constructor(wsUrl = "ws://localhost:8001") {
    this.wsUrl = wsUrl;
    this.isOpen = false;
    this.websocket = new WebSocket(this.wsUrl);

    this.websocket.addEventListener("open", () => {
      this.isOpen = true;
      console.log("✅ VTubeStudio WebSocket 已连接");
    });

    this.websocket.addEventListener("error", (err) => {
      console.error("❌ WebSocket 错误", err);
    });

    this.websocket.addEventListener("close", () => {
      this.isOpen = false;
      console.warn("⚠️ WebSocket 已关闭");
    });
  }

  send(data) {
    if (!this.isOpen) {
      console.warn("WebSocket 未打开。消息已跳过。");
      return;
    }
    this.websocket.send(JSON.stringify(data));
  }

  triggerExpression(expressionFile) {
    const message = {
      apiName: "VTubeStudioPublicAPI",
      apiVersion: "1.0",
      requestID: crypto.randomUUID(),
      messageType: "HotkeyTriggerRequest",
      data: { hotkeyID: expressionFile }
    };
    this.send(message);
  }

  syncWithAudio(audioTimestamps) {
    // 根据音频时间戳触发口型同步
    audioTimestamps.forEach((ts) => {
      setTimeout(() => this.triggerExpression("mouth_animation"), ts);
    });
  }
}
```

## 系统集成

### 自动化工作流程

```bash
#!/bin/bash
# 自动 LT 生成脚本

# 1. 从 Markdown 生成幻灯片
marp presentation.md -o slides.html

# 2. 从幻灯片内容生成语音
python generate_voice.py

# 3. 在 VTubeStudio 中控制角色
node control_vtube.js

# 4. 使用 OBS 进行录制/直播
obs-cli start-recording
```

## 与クラウディア（Claudia）的合作

本项目还利用了另一个人物角色“クラウディア”（一位说博多方言的角色），旨在进行更具亲和力的技术発表（演讲）。

感觉就像“ずんだもん和クラウディア的相声”，出乎意料地受欢迎。明明是技术発表（演讲）的说。

## 获得的经验

- **技术组合的乐趣**: 联动不同工具的乐趣（API 连接到极致）
- **与社区的交流**: 分享“有趣”的价值（“无聊”是一种赞美）
- **创造性的重要性**: 技术是手段，重要的是表达什么（虽然这么说，但主要还是因为ずんだもん很可爱）

## 项目的未来发展

该系统目前仍在不断发展，并计划添加以下功能：

- **实时问答**: 与 ChatGPT API 集成（ずんだもん回答问题的未来）
- **表情表现的提升**: 更丰富的动画（也想看生气的ずんだもん）
- **多语言支持**: 英语発表（演讲）功能（全球化ずんだもん的诞生）

这个项目让我再次认识到，不仅仅要“认真”地使用技术，更要“有趣”地使用技术。

归根结底，工程学也许就是“如何一本正经地做些不正经的事情”吧。

---

*如果你有任何有趣的科技实验想法，请务必通过 [联系我们](/contact) 告诉我！*

“让ずんだもん唱说唱”、“让初音未来审查代码”之类的无聊想法，才能让世界变得更有趣。*
