---
title: "【Marp × VOICEVOX × VTubeStudio】La historia de cómo le pedí a Zundamon que hiciera una presentación relámpago (LT)"
description: "¡Uso creativo de la tecnología! Un proyecto experimental en el que combinamos Marp, VOICEVOX y VTubeStudio para construir un sistema de presentación LT automatizado a cargo de Zundamon"
summary: "Construí un sistema combinando Marp, VOICEVOX y VTubeStudio para que Zundamon realizara una presentación LT de forma automática. Fue un proyecto que me hizo reafirmar el valor de no solo usar la tecnología con «seriedad», sino también de utilizarla de manera «divertida»."
pubDate: 2024-01-30
updatedDate: 2026-10-23
author: "Terisuke"
category: "lab"
tags: ["Marp", "VOICEVOX", "VTubeStudio", "自動化", "創造的プロジェクト"]
lang: "es"
translationSourceHash: "b0bd9e555315e8e86f5120fcb295e7228d9711993aef7027766bb2ad1406c978"
translatedAt: "2026-10-23T06:26:25.975Z"
translationModel: "gemini-3.8-flash"
---

# 【Marp × VOICEVOX × VTubeStudio】La historia de cómo le pedí a Zundamon que hiciera una presentación relámpago (LT)

Este proyecto nació de la pura curiosidad de «querer hacer algo absurdo con IA». Como un experimento para utilizar la tecnología de forma divertida y creativa, creé un sistema para que Zundamon realizara presentaciones LT de manera automática.

Ya me había cansado de presentar yo mismo, así que decidí delegárselo todo por completo a Zundamon. Como resultado, tuvo más éxito que yo, aunque eso queda entre nosotros.

## Componentes del proyecto

### 1. Marp: Creación de presentaciones

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

### 2. VOICEVOX: Síntesis de voz

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

### 3. VTubeStudio: Control del personaje

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

## Integración del sistema

### Flujo de trabajo de automatización

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

## Copresentación con Cloudia

En este proyecto también introduje a otra persona, «Cloudia» (un personaje que habla en dialecto de Hakata), con el objetivo de lograr una presentación técnica más cercana y accesible.

Acabó pareciendo una especie de «comedia en dúo (manzai) entre Zundamon y Cloudia», y sorprendentemente gustó mucho. Y eso que era una presentación técnica.

## Aprendizajes obtenidos

- Combinar e integrar diferentes herramientas es sumamente interesante (el culmen de conectar APIs sin parar).
- Compartir lo «divertido» en la comunidad tiene un gran valor (que te digan «absurdo» es un cumplido).
- La tecnología es un medio; lo importante es la creatividad de lo que se quiere expresar (aunque, a decir verdad, solo lo hice porque Zundamon es adorable).

## Evolución del proyecto

Este sistema sigue evolucionando y se prevé añadir las siguientes funciones:

- Preguntas y respuestas en tiempo real: integración con la API de ChatGPT (un futuro en el que Zundamon responda a las preguntas).
- Mejora de la expresión emocional: animaciones más ricas (también quiero ver a Zundamon enfadado).
- Soporte multilingüe: función de presentación en inglés (el nacimiento del Zundamon global).

Fue un proyecto que me hizo reafirmar el valor de utilizar la tecnología no solo de forma «seria», sino también «divertida».

Al final, puede que la ingeniería consista precisamente en eso: en «con cuánta seriedad nos tomamos el hacer tonterías».
