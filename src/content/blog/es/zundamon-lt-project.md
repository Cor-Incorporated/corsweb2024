---
title: "【Marp×VOICEVOX×VTubeStudio】Historia de cómo Zundamon hizo una presentación LT"
description: "¡Uso creativo de la tecnología! Un proyecto experimental que combina Marp, VOICEVOX y VTubeStudio para construir un sistema de presentación LT automático con Zundamon."
pubDate: 2024-01-30
author: "Terisuke"
category: "lab"
tags: ["Marp", "VOICEVOX", "VTubeStudio", "自動化", "創造的プロジェクト"]
lang: "es"
translationSourceHash: "1415a08c523813b0effca65908d713100563119940d89a8ecb6f61be7869c763"
translatedAt: "2026-09-28T06:09:16.027Z"
translationModel: "adopted-legacy"
---

# 【Marp×VOICEVOX×VTubeStudio】 La historia de cómo Zundamon hizo una presentación LT

Este proyecto comenzó con la pura curiosidad de "¡Quiero hacer cosas tontas con IA!". Como experimento para utilizar la tecnología de forma divertida y creativa, construimos un sistema para que Zundamon diera presentaciones LT de forma automática.

Ya me aburrí de presentar yo mismo, así que se lo dejé todo a Zundamon. El resultado, en secreto, es que se hizo más popular que yo.

## Componentes del proyecto

### 1. Marp - Creación de presentaciones

```markdown
---
marp: true
theme: default
class: lead
---

# LT de Zundamon
## ¡Juguemos con la tecnología!

---

# Hoy hablaremos de
- ¡La automatización es divertida!
- ¡Disfrutemos de la tecnología juntos!
```

### 2. VOICEVOX - Síntesis de voz

```python
import requests

API_URL = "http://localhost:50021"

def generate_zundamon_voice(text: str) -> bytes:
    """Llama a la API de VOICEVOX para obtener datos de voz (wav)"""

    query_params = {"text": text, "speaker": 3}

    # Generación de consulta de audio
    query_resp = requests.post(f"{API_URL}/audio_query", params=query_params, timeout=10)
    if query_resp.status_code != 200:
        raise RuntimeError(f"audio_query falló → {query_resp.status_code}: {query_resp.text}")

    # Síntesis de voz
    synth_resp = requests.post(
        f"{API_URL}/synthesis",
        params={"speaker": 3},
        data=query_resp.content,
        timeout=30
    )
    if synth_resp.status_code != 200:
        raise RuntimeError(f"synthesis falló → {synth_resp.status_code}: {synth_resp.text}")

    return synth_resp.content
```

### 3. VTubeStudio - Control de personajes

```javascript
// Control de personajes usando la API de VTubeStudio
class VTubeStudioController {
  constructor(wsUrl = "ws://localhost:8001") {
    this.wsUrl = wsUrl;
    this.isOpen = false;
    this.websocket = new WebSocket(this.wsUrl);

    this.websocket.addEventListener("open", () => {
      this.isOpen = true;
      console.log("✅ VTubeStudio WebSocket conectado");
    });

    this.websocket.addEventListener("error", (err) => {
      console.error("❌ Error de WebSocket", err);
    });

    this.websocket.addEventListener("close", () => {
      this.isOpen = false;
      console.warn("⚠️ WebSocket cerrado");
    });
  }

  send(data) {
    if (!this.isOpen) {
      console.warn("El WebSocket no está abierto. Mensaje omitido.");
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
    // Disparar la animación de la boca sincronizada con las marcas de tiempo del audio
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
# Script para generar LT automático

# 1. Generar diapositivas a partir de Markdown
marp presentation.md -o slides.html

# 2. Generar voz a partir del contenido de las diapositivas
python generate_voice.py

# 3. Controlar el personaje en VTubeStudio
node control_vtube.js

# 4. Grabar/transmitir con OBS
obs-cli start-recording
```

## Colaboración con Claudia

En este proyecto, también utilizamos otra personalidad, "Claudia" (un personaje que habla dialecto Hakata), para hacer la presentación tecnológica más accesible.

Se convirtió en algo así como "Un monólogo cómico entre Zundamon y Claudia", y sorprendentemente tuvo éxito. A pesar de ser una presentación técnica.

## Lecciones aprendidas

- **La diversión de combinar tecnologías**: El placer de conectar diferentes herramientas (la cumbre de conectar APIs sin fin).
- **Interacción con la comunidad**: El valor de compartir lo "divertido" ("tonto" es un cumplido).
- **La importancia de la creatividad**: La tecnología es un medio, lo importante es lo que expresas (aunque, sinceramente, solo lo hice porque Zundamon es linda).

## Evolución del proyecto

Este sistema sigue evolucionando y se planea añadir las siguientes funciones:

- **Respuesta a preguntas en tiempo real**: Integración con la API de ChatGPT (el futuro de Zundamon respondiendo preguntas).
- **Mejora de expresiones emocionales**: Animaciones más ricas (también queremos ver a un Zundamon enfadado).
- **Soporte multilingüe**: Función de presentación en inglés (el nacimiento de un Zundamon global).

Fue un proyecto que me hizo darme cuenta una vez más del valor de usar la tecnología no solo "seriamente", sino también "divertidamente".

Al final, tal vez lo importante de la ingeniería sea "cuánto puedes hacer algo ridículo seriamente".

---

*Si tienes ideas interesantes para experimentos tecnológicos, ¡no dudes en hacérnoslas saber a través de [contacto](/contact)!*

Ideas como "Quiero que Zundamon rapee" o "Quiero que Hatsune Miku revise mi código", esas ideas tontas son las que hacen el mundo más interesante.
