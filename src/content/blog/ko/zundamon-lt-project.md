---
title: "【Marp×VOICEVOX×VTubeStudio】즈한다몬에게 LT 발표를 시켜본 이야기"
description: "기술의 창의적 활용! Marp, VOICEVOX, VTubeStudio를 조합하여 즈한다몬을 이용한 자동 LT 발표 시스템을 구축한 실험 프로젝트"
pubDate: 2024-01-30
author: "Terisuke"
category: "lab"
tags: ["Marp", "VOICEVOX", "VTubeStudio", "自動化", "創造的プロジェクト"]
lang: "ko"
translationSourceHash: "1415a08c523813b0effca65908d713100563119940d89a8ecb6f61be7869c763"
translatedAt: "2026-09-28T06:09:16.020Z"
translationModel: "adopted-legacy"
---

# 【Marp×VOICEVOX×VTubeStudio】ずんだもんにLT 발표 맡긴 이야기

「AI로 쓸데없는 짓을 하고 싶다!」라는 순수한 호기심에서 시작된 이 프로젝트. 기술을 재미있고 창의적으로 활용하는 실험으로서,ずんだもん(즈다몽)에게 자동 LT 발표를 시키는 시스템을 구축했습니다.

더 이상 직접 발표하는 것도 질렸기에,ずんだもん에게 전부 맡겨보았습니다. 결과적으로, 저보다 인기가 많아진 것은 비밀입니다.

## 프로젝트 구성 요소

### 1. Marp - 프레젠테이션 작성

```markdown
---
marp: true
theme: default
class: lead
---

# ずんだもん의 LT
## 기술로 놀자!

---

# 오늘 이야기
- 자동화는 즐겁다!
- 다 함께 기술을 즐기자!
```

### 2. VOICEVOX - 음성 합성

```python
import requests

API_URL = "http://localhost:50021"

def generate_zundamon_voice(text: str) -> bytes:
    """VOICEVOX API를 호출하여 음성 데이터 (wav)를 가져옵니다."""

    query_params = {"text": text, "speaker": 3}

    # 음성 쿼리 생성
    query_resp = requests.post(f"{API_URL}/audio_query", params=query_params, timeout=10)
    if query_resp.status_code != 200:
        raise RuntimeError(f"audio_query 실패 → {query_resp.status_code}: {query_resp.text}")

    # 음성 합성
    synth_resp = requests.post(
        f"{API_URL}/synthesis",
        params={"speaker": 3},
        data=query_resp.content,
        timeout=30
    )
    if synth_resp.status_code != 200:
        raise RuntimeError(f"synthesis 실패 → {synth_resp.status_code}: {synth_resp.text}")

    return synth_resp.content
```

### 3. VTubeStudio - 캐릭터 제어

```javascript
// VTubeStudio API를 이용한 캐릭터 제어
class VTubeStudioController {
  constructor(wsUrl = "ws://localhost:8001") {
    this.wsUrl = wsUrl;
    this.isOpen = false;
    this.websocket = new WebSocket(this.wsUrl);

    this.websocket.addEventListener("open", () => {
      this.isOpen = true;
      console.log("✅ VTubeStudio WebSocket 연결됨");
    });

    this.websocket.addEventListener("error", (err) => {
      console.error("❌ WebSocket 오류", err);
    });

    this.websocket.addEventListener("close", () => {
      this.isOpen = false;
      console.warn("⚠️ WebSocket 닫힘");
    });
  }

  send(data) {
    if (!this.isOpen) {
      console.warn("WebSocket가 열려 있지 않습니다. 메시지가 건너뛰었습니다.");
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
    // 음성 타임스탬프에 맞춰 입 모양 애니메이션 트리거
    audioTimestamps.forEach((ts) => {
      setTimeout(() => this.triggerExpression("mouth_animation"), ts);
    });
  }
}
```

## 시스템 통합

### 자동화 워크플로우

```bash
#!/bin/bash
# 자동 LT 생성 스크립트

# 1. Markdown에서 슬라이드 생성
marp presentation.md -o slides.html

# 2. 슬라이드 내용에서 음성 생성
python generate_voice.py

# 3. VTubeStudio에서 캐릭터 제어
node control_vtube.js

# 4. OBS로 녹화/방송
obs-cli start-recording
```

## 클라우디아와의 협연

이 프로젝트에서는 또 다른 페르소나인 "클라우디아"(하카타 사투리를 구사하는 캐릭터)도 활용하여, 더욱 친근한 기술 발표를 목표로 했습니다.

"ずんだもん과 클라우디아의 만담" 같은 느낌이 되어 의외로 반응이 좋았습니다. 기술 발표인데도 말이죠.

## 얻은 학습

- **기술 조합의 재미**: 서로 다른 도구를 연계시키는 즐거움 (API를 잔뜩 연결하는 극치)
- **커뮤니티와의 교류**: "재미있다"를 공유하는 가치 ("쓸데없다"는 칭찬)
- **창의성의 중요성**: 기술은 수단, 중요한 것은 무엇을 표현하는가 (라고 말하지만,ずんだもん이 귀여워서 했을 뿐)

## 프로젝트의 발전

이 시스템은 현재도 계속 발전하고 있으며, 다음과 같은 기능 추가를 예정하고 있습니다:

- **실시간 질의응답**: ChatGPT API와의 연동 (ずんだもん이 질문에 답하는 미래)
- **감정 표현 향상**: 더욱 풍부한 애니메이션 (화난ずんだもん도 보고 싶다)
- **다국어 지원**: 영어 발표 기능 (글로벌ずんだもん의 탄생)

기술을 "진지하게" 사용하는 것뿐만 아니라, "즐겁게" 사용하는 것의 가치를 다시 한번 느낀 프로젝트였습니다.

결국 엔지니어링이란 "얼마나 황당한 일을 진지하게 하느냐"가 중요한 것인지도 모릅니다.

---

*재미있는 기술 실험 아이디어가 있다면, 언제든지 [문의](/contact)를 통해 알려주세요!*

"ずんだもんに 랩 시키고 싶다"거나 "하츠네 미쿠에게 코드 리뷰 시키고 싶다" 같은, 그런 황당한 아이디어가 세상을 재미있게 만드는 것이니까요.
