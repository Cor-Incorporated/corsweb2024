---
title: "【Marp×VOICEVOX×VTubeStudio】让Zundamon来进行LT闪电演讲的故事"
description: "技术的创造性应用！结合Marp、VOICEVOX和VTubeStudio，构建由Zundamon进行自动LT闪电演讲系统的实验项目"
summary: "结合Marp、VOICEVOX和VTubeStudio，制作了一个让Zundamon自动进行LT闪电演讲的系统。这个项目让我再次感受到了不仅要“认真”使用技术，更要“快乐”使用技术的价值。"
pubDate: 2024-01-30
updatedDate: 2026-10-23
author: "Terisuke"
category: "lab"
tags: ["Marp", "VOICEVOX", "VTubeStudio", "自動化", "創造的プロジェクト"]
lang: "zh"
translationSourceHash: "b0bd9e555315e8e86f5120fcb295e7228d9711993aef7027766bb2ad1406c978"
translatedAt: "2026-10-23T06:20:20.429Z"
translationModel: "gemini-3.8-flash"
---

# 【Marp×VOICEVOX×VTubeStudio】让Zundamon来进行LT闪电演讲的故事

这个项目始于“想用AI做点无聊事”的纯粹好奇心。作为一项充满趣味性与创造性地运用技术的实验，我制作了一个让毛豆泥酱（Zundamon）自动进行LT闪电演讲的系统。

因为我已经厌倦了自己上台演讲，索性全甩给了毛豆泥酱。结果，它的人气居然比我还高，这事我可不会到处乱说。

## 项目的组成要素

### 1. Marp - 演示文稿制作

```markdown
---
marp: true
theme: default
class: lead
---

# ずんだもんのLT
## 技術で遊ぼう！

---

# 今日のお話
- 自動化って楽しいのだ！
- みんなで技術を楽しむのだ！
```

### 2. VOICEVOX - 语音合成

```python
import requests

API_URL = "http://localhost:50021"

def generate_zundamon_voice(text: str) -> bytes:
    """VOICEVOX API を呼び出して音声データ (wav) を取得する"""

    query_params = {"text": text, "speaker": 3}

    # 音声クエリ生成
    query_resp = requests.post(f"{API_URL}/audio_query", params=query_params, timeout=10)
    if query_resp.status_code != 200:
        raise RuntimeError(f"audio_query failed → {query_resp.status_code}: {query_resp.text}")

    # 音声合成
    synth_resp = requests.post(
        f"{API_URL}/synthesis",
        params={"speaker": 3},
        data=query_resp.content,
        timeout=30
    )
    if synth_resp.status_code != 200:
        raise RuntimeError(f"synthesis failed → {synth_resp.status_code}: {synth_resp.text}")

    return synth_resp.content
```

### 3. VTubeStudio - 角色控制

```javascript
// VTubeStudio API を使ったキャラクター制御
class VTubeStudioController {
  constructor(wsUrl = "ws://localhost:8001") {
    this.wsUrl = wsUrl;
    this.isOpen = false;
    this.websocket = new WebSocket(this.wsUrl);

    this.websocket.addEventListener("open", () => {
      this.isOpen = true;
      console.log("✅ VTubeStudio WebSocket connected");
    });

    this.websocket.addEventListener("error", (err) => {
      console.error("❌ WebSocket error", err);
    });

    this.websocket.addEventListener("close", () => {
      this.isOpen = false;
      console.warn("⚠️ WebSocket closed");
    });
  }

  send(data) {
    if (!this.isOpen) {
      console.warn("WebSocket is not open. Message skipped.");
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
    // 音声タイムスタンプに合わせて口パクをトリガー
    audioTimestamps.forEach((ts) => {
      setTimeout(() => this.triggerExpression("mouth_animation"), ts);
    });
  }
}
```

## 系统集成

### 自动化工作流

```bash
#!/bin/bash
# 自動LT生成スクリプト

# 1. Markdownからスライド生成
marp presentation.md -o slides.html

# 2. スライド内容から音声生成
python generate_voice.py

# 3. VTubeStudioでキャラクター制御
node control_vtube.js

# 4. OBSで録画・配信
obs-cli start-recording
```

## 与Cloudia的同台合作

在这个项目中，我还让另一个角色“Cloudia”（一个讲博多方言的角色）登场，旨在让技术分享更加亲切近人。

结果变成了类似“毛豆泥酱与Cloudia的漫才对口相声”的感觉，出乎意料地受欢迎。明明是一场技术演讲来着。

## 心得收获

- 将不同的工具组合并联动起来非常有趣（简直是将API疯狂对接到了极致）。
- 在社区中分享“有趣的事物”极具价值（“无聊”其实是一种夸奖）。
- 技术只是手段，重要的是去表达什么的创造力（话虽这么说，其实只是因为毛豆泥酱太可爱才做的）。

## 项目的发展

该系统目前仍在不断演进，计划添加以下功能：

- 实时问答互动：与ChatGPT API对接（毛豆泥酱亲自解答提问的未来）
- 情感表达提升：更加丰富的动画表现（也想看看生气的毛豆泥酱）
- 多语言支持：英语演讲功能（全球化毛豆泥酱的诞生）

这个项目让我再次感受到了技术不仅要“严谨”地使用，更要“快乐”地去使用的价值。

说到底，工程技术的精髓或许就在于“如何把荒唐可笑的事情做得无比认真”。
