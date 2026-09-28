---
title: "【Marp×VOICEVOX×VTubeStudio】A Story About Having Zundamon Give an LT Presentation"
description: "Creative utilization of technology! An experimental project that combined Marp, VOICEVOX, and VTubeStudio to build an automatic LT presentation system by Zundamon."
pubDate: 2024-01-30
author: "Terisuke"
category: "lab"
tags: ["Marp", "VOICEVOX", "VTubeStudio", "自動化", "創造的プロジェクト"]
lang: "en"
translationSourceHash: "1415a08c523813b0effca65908d713100563119940d89a8ecb6f61be7869c763"
translatedAt: "2026-09-28T06:09:16.005Z"
translationModel: "adopted-legacy"
---

# 【Marp × VOICEVOX × VTubeStudio】The Story of Having Zundamon Give an LT Presentation

This project began with a pure curiosity: "I want to do silly things with AI!" As an experiment in creatively utilizing technology, I built a system that automatically has Zundamon give Light Talks (LTs).

I was getting tired of presenting myself, so I decided to completely hand it over to Zundamon. As a side note, she ended up becoming more popular than me.

## Project Components

### 1. Marp - Presentation Creation

```markdown
---
marp: true
theme: default
class: lead
---

# Zundamon's LT
## Let's Play with Technology!

---

# Today's Talk
- Automation is fun!
- Let's enjoy technology together!
```

### 2. VOICEVOX - Speech Synthesis

```python
import requests

API_URL = "http://localhost:50021"

def generate_zundamon_voice(text: str) -> bytes:
    """Calls the VOICEVOX API to get audio data (wav)"""

    query_params = {"text": text, "speaker": 3}

    # Generate audio query
    query_resp = requests.post(f"{API_URL}/audio_query", params=query_params, timeout=10)
    if query_resp.status_code != 200:
        raise RuntimeError(f"audio_query failed → {query_resp.status_code}: {query_resp.text}")

    # Synthesize audio
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
// Character control using VTubeStudio API
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
    // Trigger mouth animations based on audio timestamps
    audioTimestamps.forEach((ts) => {
      setTimeout(() => this.triggerExpression("mouth_animation"), ts);
    });
  }
}
```

## System Integration

### Automated Workflow

```bash
#!/bin/bash
# Automatic LT Generation Script

# 1. Generate slides from Markdown
marp presentation.md -o slides.html

# 2. Generate audio from slide content
python generate_voice.py

# 3. Control character in VTubeStudio
node control_vtube.js

# 4. Record and stream with OBS
obs-cli start-recording
```

## Co-starring with Claudia

In this project, I also utilized another persona, "Claudia" (a character who speaks in Hakata dialect), to aim for a more approachable technical presentation.

It turned into something like "A Stand-up Comedy Routine by Zundamon and Claudia," and surprisingly, it was well-received, even though it was a technical presentation.

## Lessons Learned

- **The Joy of Combining Technologies**: The fun of connecting different tools (the pinnacle of API chaining).
- **Community Interaction**: The value of sharing "fun" (calling something "silly" is a compliment).
- **The Importance of Creativity**: Technology is a means; what's important is what you express (although, I mostly did it because Zundamon is cute).

## Project Evolution

This system is continually evolving, and the following features are planned for addition:

- **Real-time Q&A**: Integration with ChatGPT API (a future where Zundamon answers questions).
- **Improved Emotional Expression**: Richer animations (I want to see an angry Zundamon too).
- **Multilingual Support**: English presentation functionality (the birth of Global Zundamon).

This project reaffirmed the value of using technology not just "seriously" but also "joyfully."

In the end, maybe engineering is all about "how seriously you take doing absurd things."

---

*If you have any ideas for interesting technology experiments, please feel free to share them via [Contact](/contact)!*

*Ideas like "I want Zundamon to rap" or "I want Hatsune Miku to review code" – those kinds of absurd ideas are what make the world more interesting.*
