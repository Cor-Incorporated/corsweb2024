---
title: "Cómo configurar Codex MCP para usarlo en Claude Desktop"
description: "Dado que Claude Code MCP dejó de funcionar, introduje el nuevo MCP de Codex CLI. Un registro real de resolución de problemas, desde el calvario de la configuración plagada de errores hasta la solución gracias a los consejos de Warp AI."
summary: "El motivo por el cual Codex MCP no respondía desde Claude Desktop era que la configuración de env era insuficiente y no se transmitía la ruta al comando codex. Funcionó al cambiar args a mcp-server y especificar el PATH en env."
pubDate: 2025-10-16
updatedDate: 2026-10-23
author: "Terisuke"
category: "lab"
tags: ["MCP", "Claude Desktop", "Codex CLI", "トラブルシューティング", "Warp AI", "ChatGPT"]
image:
  url: "/images/blog/スクリーンショット-2025-10-16-16.52.24.avif"
  alt: "Método de configuración de Codex MCP"
lang: "es"
featured: true
translationSourceHash: "a889e72c1e2a84040a81c77befce353b5407fafad1b74947813303560fd0b954"
translatedAt: "2026-10-23T06:24:43.557Z"
translationModel: "gemini-3.8-flash"
---

Claude Code MCP dejó de funcionar en Claude Desktop. Desesperé al perder a ese compañero de confianza para el desarrollo impulsado por IA. Aun así, no había tiempo para lamentarse. Decidí implementar en su lugar el MCP del popular Codex CLI.

A partir de ahí comenzó un infierno de configuración, hasta que al final fui rescatado por mi salvador: Warp AI. Esta es la crónica de lo sucedido.

## El detonante: la desaparición de Claude Code MCP

Un día, de repente, Claude Code MCP dejó de funcionar en Claude Desktop. La práctica función que analizaba los directorios de los proyectos desapareció. Dejó de funcionar sin mostrar ningún mensaje de error.

![Claude Code MCP dejó de funcionar](/images/blog/スクリーンショット-2025-10-16-16.56.23.avif)

«No hay más remedio, tendré que cambiar a una nueva herramienta».

¿Por qué no usar el tan comentado OpenAI Codex CLI a través de MCP? Además, había un artículo excelente de Tomada en Zenn. Basándome en él, seguro que sería fácil.

https://zenn.dev/tmasuyama1114/articles/cdfd4562bdce78

Hubo un tiempo en el que yo también pensaba así.

## La primera prueba: los args son diferentes

Añadí la configuración a `claude_desktop_config.json` siguiendo el artículo.

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

Reinicié Claude Desktop. Apareció un error.

«¿Cómo? ¿Si lo hice exactamente como decía el artículo?».

Al comprobarlo en la terminal, el comando de Codex CLI era `mcp-server`.

```bash
$ codex mcp-server --help
[experimental] Run the Codex MCP server (stdio transport)

Usage: codex mcp-server [OPTIONS]
```

Ya veo, el comando real era distinto al del artículo. Quizás cambió con una actualización de versión. Lo corregí de la siguiente manera:

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

El error desapareció. «Listo, con esto funcionará».

No funcionó.

## La segunda prueba: la barrera de la suscripción

Por más que lo intentaba en Claude Desktop, Codex MCP no reaccionaba. Solo devolvía silencio.

«Ahora que lo pienso...»

Recordé que para ejecutar Codex CLI se necesitaba una clave de API de OpenAI o una suscripción a ChatGPT. Absorto en el desarrollo, me había olvidado por completo de configurar la cuenta.

Accedí a [ChatGPT](https://chatgpt.com/) y me suscribí al plan de 20 $/mes. Y para colmo, ahora el primer mes es gratis. Qué suerte.

A continuación, avancé con la configuración de la CLI tomando como referencia el artículo de note del profesor npaka. La autenticación también fue correcta. Ahora sí estaba perfecto.

https://note.com/npaka/n/n7b6448020250

```bash
codex login
# ✓ Successfully authenticated!
```

Reinicié Claude Desktop. Con altas expectativas, llamé a Codex MCP.

Seguía sin funcionar.

## La tercera prueba: el último recurso, Warp AI

Ya no podía solucionarlo por mi cuenta. Al darme cuenta, me acordé del editor con IA, Warp. Warp cuenta con un asistente de IA integrado. Decidí preguntar por si acaso.

https://www.warp.dev/

> I set codex mcp in /Users/teradakousuke/Library/Application Support/Claude/claude_desktop_config.json and tried to use it from Claude Desktop, but it's not responding. Please identify the cause and resolve it.

Warp AI leyó el archivo de configuración, ejecutó algunos comandos y dio con la respuesta sin despeinarse.

![Bendito sea Warp](/images/blog/スクリーンショット-2025-10-16-17.00.37.avif)

## La esencia del problema: falta la configuración de env

El resultado del diagnóstico de Warp AI constaba de los siguientes tres puntos:

1. El servidor MCP necesita acceso a las variables de entorno, pero falta el campo `env`.
2. El PATH no está configurado y no se transmite la ruta al comando de Codex.
3. El campo `type` no es necesario. Dado que por defecto es `stdio`, resulta redundante.

La configuración corregida quedó de la siguiente manera:

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

El campo `env` es especialmente importante. El servidor MCP se inicia como un subproceso de Claude Desktop. Las variables de entorno del proceso padre no se heredan automáticamente.

En particular, si gestionas Node.js con NVM, no se encontrará a menos que especifiques de forma explícita la ruta al comando codex.

## El momento en que funcionó

```bash
pkill -f "Claude.app" && sleep 2 && open -a Claude
```

Reinicié Claude Desktop y llamé a Codex MCP.

**Por fin reaccionó**.

```text
✓ codex MCP server connected
```

## Lecciones aprendidas

### 1. La documentación oficial también se queda obsoleta

El artículo de Zenn era fantástico, pero con la actualización de Codex CLI el comando `mcp` había cambiado a `mcp-server`. Acostumbrémonos a consultar siempre la ayuda oficial.

```bash
codex --help
codex mcp-server --help
```

### 2. Especificar explícitamente las variables de entorno de los subprocesos

El servidor MCP es un proceso independiente iniciado desde Claude Desktop. No se debe asumir que heredará las variables de entorno del padre. En particular, es necesario especificar el PATH de forma explícita.

```json
"env": {
  "PATH": "/path/to/your/node/bin:..."
}
```

### 3. Atención especial para usuarios de NVM

Si gestionas Node.js con NVM, el comando codex se instala en el directorio de NVM. Si no incluyes esta ruta en `env.PATH`, Claude Desktop no podrá encontrarlo.

Comprueba dónde se encuentra tu codex:

```bash
which codex
# 出力例: /Users/teradakousuke/.nvm/versions/node/v20.15.0/bin/codex
```

Incluye este directorio en `PATH`.

### 4. La era de resolver problemas de IA con otra IA

Al final fue Warp AI quien solucionó el problema. Una estructura anidada en la que, cuando una herramienta de desarrollo impulsado por IA no funciona, le preguntas a otra IA.

Tal vez ya haya terminado la época de buscar respuestas en Stack Overflow. Si sale un error, de momento se le pregunta a la IA. Ese es el estilo de desarrollo de 2025.

## Visión general de la configuración completa

A modo de referencia, dejo la configuración completa y operativa.

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

### Lista de verificación

Los puntos a verificar al implementar Codex MCP son los siguientes:

- [ ] Suscripción a ChatGPT contratada (o clave de API de OpenAI configurada)
- [ ] Autenticación completada con `codex login`
- [ ] Ruta confirmada con `which codex`
- [ ] `env.PATH` añadido a `claude_desktop_config.json`
- [ ] `args` establecido como `["mcp-server"]` (no `["mcp"]`)
- [ ] Claude Desktop reiniciado por completo

## Conclusión: el viaje de la resolución de problemas

Desde que Claude Code MCP dejó de funcionar hasta que implementé Codex MCP, el camino fue más empinado de lo esperado. Aun así, aprendí mucho durante este proceso:

- No confiar ciegamente en la documentación. Los comandos cambian con las actualizaciones de versión.
- Especificar explícitamente las variables de entorno. Los subprocesos no heredan el entorno del padre.
- Pedir ayuda a la IA. El tiempo de los humanos es valioso.

Que al final lo haya resuelto Warp AI resulta, en cierto modo, irónico. Solucionar la configuración de una herramienta de desarrollo con IA utilizando otra herramienta de desarrollo con IA: una experiencia de lo más meta.

Sin embargo, así está bien. A partir de ahora, los desarrolladores debemos dominar la IA como medio para resolver problemas. Tanto Stack Overflow como la documentación son importantes, pero el valor de un asistente de IA que te da la respuesta al instante sobre la marcha es incalculable.

Codex MCP por fin ha empezado a funcionar. A partir de aquí, con la potente combinación de Claude Desktop y Codex CLI, el desarrollo se acelerará... o eso espero.

Ya tengo curiosidad por ver qué será lo próximo que deje de funcionar (¿en serio?).

Espero que esto sirva de ayuda a quienes se encuentren con el mismo problema. El desarrollo impulsado por IA no es fácil, pero sí muy divertido.

---

## Materiales de referencia

Artículos que resultaron útiles para la configuración:

- [Claude CodeからCodexをMCPで呼び出せるようになった話](https://zenn.dev/tmasuyama1114/articles/cdfd4562bdce78)
- [Codex CLI のセットアップ](https://note.com/npaka/n/n7b6448020250)
- [ChatGPT](https://chatgpt.com/)
