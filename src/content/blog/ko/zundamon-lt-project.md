---
title: "【Marp×VOICEVOX×VTubeStudio】준다몬에게 LT 발표를 시켜본 이야기"
description: "기술의 창의적 활용! Marp, VOICEVOX, VTubeStudio를 결합하여 준다몬이 진행하는 자동 LT 발표 시스템을 구축한 실험 프로젝트"
summary: "Marp, VOICEVOX, VTubeStudio를 결합하여 준다몬이 자동으로 LT 발표를 진행하는 시스템을 만들었다. 기술을 '진지하게' 사용하는 것뿐만 아니라 '즐겁게' 사용하는 것의 가치를 다시금 느낄 수 있었던 프로젝트였다."
pubDate: 2024-01-30
updatedDate: 2026-10-23
author: "Terisuke"
category: "lab"
tags: ["Marp", "VOICEVOX", "VTubeStudio", "自動化", "創造的プロジェクト"]
lang: "ko"
translationSourceHash: "b0bd9e555315e8e86f5120fcb295e7228d9711993aef7027766bb2ad1406c978"
translatedAt: "2026-10-23T06:23:21.783Z"
translationModel: "gemini-3.8-flash"
---

# 【Marp×VOICEVOX×VTubeStudio】준다몬에게 LT 발표를 시켜본 이야기

이 프로젝트는 "AI로 쓸데없는 짓을 해보고 싶다"는 순수한 호기심에서 시작되었다. 기술을 재미있고 창의적으로 사용하는 실험으로서, 준다몬이 자동으로 LT 발표를 진행하는 시스템을 만들었다.

이제 직접 발표하는 것도 질려서 준다몬에게 전부 떠넘겨 보았다. 결과적으로 나보다 인기가 더 많아진 건 비밀이다.

## 프로젝트 구성 요소

### 1. Marp - 프레젠테이션 제작

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

### 2. VOICEVOX - 음성 합성

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

### 3. VTubeStudio - 캐릭터 제어

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

## 시스템 통합

### 자동화 워크플로

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

## Cloudia와의 협연

이 프로젝트에서는 또 다른 페르소나인 'Cloudia'(하카타 사투리를 쓰는 캐릭터)도 등장시켜, 더욱 친근하게 다가갈 수 있는 기술 발표를 목표로 삼았다.

"준다몬과 Cloudia의 만담 콤비" 같은 느낌이 되어 기술 발표인데도 의외로 반응이 좋았다.

## 얻은 배움

- 서로 다른 툴을 조합해 연동하는 것은 흥미롭다 (API 마구 연결하기의 극치).
- 커뮤니티에서 '재미'를 공유하는 것은 가치가 있다 ("쓸데없다"는 건 칭찬이다).
- 기술은 수단일 뿐이며, 중요한 것은 무엇을 표현하는가라는 창의성이다 (라고 그럴듯하게 말하지만, 그냥 준다몬이 귀여워서 했을 뿐이다).

## 프로젝트의 발전

이 시스템은 지금도 계속 진화하고 있으며, 다음과 같은 기능을 추가할 예정이다.

- 실시간 질의응답: ChatGPT API와의 연동 (준다몬이 질문에 답하는 미래)
- 감정 표현 향상: 더욱 풍부해진 애니메이션 (화난 준다몬도 보고 싶다)
- 다국어 지원: 영어 발표 기능 (글로벌 준다몬의 탄생)

기술을 '진지하게' 사용하는 것뿐만 아니라, '재미있게' 활용하는 것의 가치를 다시금 느낄 수 있었던 프로젝트였다.

결국 엔지니어링이란 '얼마나 터무니없는 짓을 진지하게 하느냐'가 중요한 것일지도 모른다.
