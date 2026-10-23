---
title: "[Marp × VOICEVOX × VTubeStudio] Having Zundamon Deliver a Lightning Talk"
description: "Creative use of technology! An experimental project combining Marp, VOICEVOX, and VTubeStudio to build an automated lightning talk presentation system powered by Zundamon."
summary: "By combining Marp, VOICEVOX, and VTubeStudio, I built a system that lets Zundamon deliver lightning talks automatically. This project reminded me of the value of using technology not just \"seriously,\" but also for \"fun.\""
pubDate: 2024-01-30
updatedDate: 2026-10-23
author: "Terisuke"
category: "lab"
tags: ["Marp", "VOICEVOX", "VTubeStudio", "自動化", "創造的プロジェクト"]
lang: "en"
translationSourceHash: "b0bd9e555315e8e86f5120fcb295e7228d9711993aef7027766bb2ad1406c978"
translatedAt: "2026-10-23T06:17:20.973Z"
translationModel: "gemini-3.8-flash"
---

# [Marp × VOICEVOX × VTubeStudio] Having Zundamon Deliver a Lightning Talk

This project started out of pure curiosity: "I want to use AI to build something silly." As an experiment in using technology in a fun and creative way, I built a system that lets Zundamon deliver a lightning talk automatically.

I was getting tired of presenting myself anyway, so I outsourced the whole thing to Zundamon. Needless to say, she ended up being more popular than I am.

## Project Components

### 1. Marp - Presentation Creation

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

### 2. VOICEVOX - Speech Synthesis

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

### 3. VTubeStudio - Character Control

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

## System Integration

### Automation Workflow

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

## Co-starring with Cloudia

In this project, I also introduced another persona, "Cloudia" (a character who speaks the Hakata dialect), aiming for a more approachable tech presentation.

It turned into something like "a manzai comedy duo with Zundamon and Cloudia," and it was surprisingly well received—even though it was supposed to be a technical presentation.

## Lessons Learned

- Combining and integrating different tools is fun (the ultimate exercise in stringing APIs together).
- Sharing something "fun" with the community has real value ("silly" is a compliment).
- Technology is just a means; what matters is the creativity in what you express (though honestly, I just did it because Zundamon is cute).

## Future Development

This system is still evolving, and I plan to add the following features:

- Real-time Q&A: Integration with the ChatGPT API (a future where Zundamon answers questions)
- Improved emotional expression: Richer animations (I want to see an angry Zundamon too)
- Multilingual support: Ability to present in English (the birth of Global Zundamon)

This project made me realize once again the value of using technology not just "seriously," but "playfully."

In the end, maybe the essence of engineering is all about "how seriously you can pursue something utterly ridiculous."
