---
title: "Cómo configurar Codex MCP para usar Claude Desktop"
description: "Claude Code MCP dejó de funcionar, así que introduje el nuevo Codex CLI MCP. Un registro de solución de problemas de cómo salí del infierno de configuración lleno de errores con la ayuda de Warp AI."
pubDate: 2025-10-16
author: "Terisuke"
category: "lab"
tags: ["MCP", "Claude Desktop", "Codex CLI", "トラブルシューティング", "Warp AI", "ChatGPT"]
image:
  url: "/images/blog/スクリーンショット-2025-10-16-16.52.24.avif"
  alt: "Codex MCPの設定方法"
lang: "es"
featured: true
translationSourceHash: "1bcd5dea86c80ec5be559d88239bced030c915cf654507f76872a672295482fa"
translatedAt: "2026-09-28T06:09:16.022Z"
translationModel: "adopted-legacy"
---

Claude Desktop ya no puede usar Claude Code MCP. La desesperación de perder a mi fiel compañero de desarrollo impulsado por IA. Sin embargo, no hay tiempo para lamentarse. Como alternativa, decidí implementar el MCP de Codex CLI, que ha estado en boca de todos.

A partir de ahí, comenzó el infierno de la configuración. Y finalmente, Warp AI apareció como un salvador. Hoy, este es mi registro.

## El Comienzo: La Desaparición de Claude Code MCP

Un día, de repente, Claude Code MCP dejó de funcionar en Claude Desktop. La útil función que analizaba mi directorio de proyectos desapareció. No hubo mensajes de error, simplemente dejó de funcionar en silencio.

![Claude Code MCP dejó de funcionar](/images/blog/スクリーンショット-2025-10-16-16.56.23.avif)

"No hay remedio, voy a cambiar a una nueva herramienta."

¿Por qué no usar OpenAI Codex CLI a través de MCP, que ha sido un tema candente últimamente? Hay un excelente artículo de Tmasuyama en Zenn. Debería ser fácil seguir esto.

https://zenn.dev/tmasuyama1114/articles/cdfd4562bdce78

Hubo un tiempo en el que yo también pensaba así.

## Primera Prueba: Los Argumentos son Diferentes

Agregué la configuración a `claude_desktop_config.json` según el artículo:

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

"¿Eh? ¿Si lo hice como decía el artículo?"

Cuando lo comprobé en la terminal, el comando de Codex CLI era `mcp-server`:

```bash
$ codex mcp-server --help
[experimental] Run the Codex MCP server (stdio transport)

Usage: codex mcp-server [OPTIONS]
```

Ya veo, el artículo y el comando real son diferentes. Tal vez cambió debido a una actualización de versión. Corrijámoslo:

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

El error desapareció. "¡Bien, ahora funcionará!"

No funcionó.

## Segunda Prueba: El Muro de la Suscripción

No importa cuántas veces lo intentara en Claude Desktop, Codex MCP no respondía. Solo el silencio regresaba.

"Espera un momento..."

Recordé que para ejecutar Codex CLI, se requería una clave API de OpenAI o una suscripción a ChatGPT. Estaba tan absorto en el desarrollo que olvidé por completo la configuración de la cuenta.

Accedí a [ChatGPT](https://chatgpt.com/) y me suscribí al plan de $20/mes. Sorprendentemente, ahora es gratuito el primer mes. Qué suerte.

A continuación, seguí la configuración de la CLI basándome en la nota del Sr. Npaka. La autenticación también se completó. Ahora todo está perfecto.

https://note.com/npaka/n/n7b6448020250

```bash
codex login
# ✓ Successfully authenticated!
```

Reinicié Claude Desktop. Llamé a Codex MCP con gran expectación.

Todavía no funcionaba.

## Tercera Prueba: Último Recurso, Warp AI

Ya no podía hacerlo solo. En el momento en que me di cuenta de esto, recordé Warp, el editor de IA. Warp tiene un asistente de IA integrado. Voy a preguntarles por si acaso.

https://www.warp.dev/

> I set codex mcp in /Users/teradakousuke/Library/Application Support/Claude/claude_desktop_config.json and tried to use it from Claude Desktop, but it's not responding. Please identify the cause and resolve it.

Warp AI leyó el archivo de configuración, ejecutó algunos comandos y llegó a una respuesta fácilmente.

![Dios, Buda, Warp](/images/blog/スクリーンショット-2025-10-16-17.00.37.avif)

## La Esencia del Problema: Falta la Configuración de `env`

Diagnóstico de Warp AI:

1. **Falta el campo `env`**: El servidor MCP necesita acceso a las variables de entorno.
2. **PATH no configurado**: La ruta al comando Codex no se está pasando.
3. **El campo `type` es innecesario**: Es redundante ya que `stdio` es el valor predeterminado.

Aquí está la configuración corregida:

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

**Lo importante es el campo `env`**. El servidor MCP se inicia como un subproceso de Claude Desktop. Las variables de entorno del proceso padre no se heredan automáticamente.

Especialmente si estás administrando Node.js con NVM, la ruta al comando `codex` no se encontrará a menos que se especifique explícitamente.

## El Momento en que Funcionó

```bash
pkill -f "Claude.app" && sleep 2 && open -a Claude
```

Reinicié Claude Desktop y llamé a Codex MCP.

**Finalmente respondió.**

```text
✓ codex MCP server connected
```

## Lo Que Aprendí

### 1. La Documentación Oficial También Envejece

El artículo de Zenn fue excelente, pero el comando `mcp` de Codex CLI cambió a `mcp-server` con una actualización. Acostúmbrate a consultar siempre la ayuda oficial:

```bash
codex --help
codex mcp-server --help
```

### 2. Especificar Explícitamente las Variables de Entorno de los Subprocesos

El servidor MCP es un proceso independiente iniciado desde Claude Desktop. No esperes que herede las variables de entorno del padre. Especialmente, la variable PATH debe especificarse explícitamente:

```json
"env": {
  "PATH": "/path/to/your/node/bin:..."
}
```

### 3. Usuarios de NVM, Tengan Cuidado

Si administra Node.js con NVM, el comando `codex` se instalará en el directorio de NVM. Si no incluye esta ruta en `env.PATH`, Claude Desktop no podrá encontrarlo.

Verifique dónde está su `codex`:

```bash
which codex
# Ejemplo de salida: /Users/teradakousuke/.nvm/versions/node/v20.15.0/bin/codex
```

Incluya este directorio en su `PATH`.

### 4. La Era de Usar IA para Resolver Problemas de IA

Finalmente, Warp AI resolvió el problema. Una estructura anidada donde le preguntas a otra IA cuando una herramienta de desarrollo impulsada por IA no funciona.

La era de buscar respuestas en Stack Overflow podría haber terminado. Si aparece un error, pregúntale a la IA. Ese es el estilo de desarrollo de 2025.

## Visión General de la Configuración Completa

Como referencia, aquí está la configuración completa y funcional:

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

### Lista de Verificación

Cosas que verificar al implementar Codex MCP:

- [ ] Suscripción a ChatGPT contratada (o clave API de OpenAI configurada)
- [ ] Autenticación completada con `codex login`
- [ ] Ruta verificada con `which codex`
- [ ] `env.PATH` agregado a `claude_desktop_config.json`
- [ ] Los `args` son `["mcp-server"]` (no `["mcp"]`)
- [ ] Claude Desktop reiniciado completamente

## Resumen: Un Viaje de Resolución de Problemas

El camino desde que Claude Code MCP dejó de funcionar hasta la implementación de Codex MCP fue más arduo de lo esperado. Sin embargo, aprendí mucho en este proceso:

- **No confíes ciegamente en la documentación**: Los comandos cambian con las actualizaciones de versiones.
- **Especifica explícitamente las variables de entorno**: Los subprocesos no heredan el entorno del padre.
- **Busca ayuda de la IA**: El tiempo humano es valioso.

Que Warp AI finalmente resolviera el problema es, en cierto modo, irónico. Resolver la configuración de una herramienta de desarrollo de IA con otra herramienta de desarrollo de IA. Fue una experiencia meta.

Pero está bien. Los desarrolladores del futuro necesitarán dominar el uso de la IA como medio para resolver problemas. Stack Overflow y la documentación siguen siendo importantes, pero el valor de un asistente de IA que brinda respuestas instantáneas en el campo es inconmensurable.

Codex MCP finalmente comenzó a funcionar. A partir de ahora, el desarrollo se acelerará con la poderosa combinación de Claude Desktop y Codex CLI... o eso espero.

¿Qué será lo próximo que se rompa? Ya estoy deseando saberlo (¿en serio?).

---

## Enlaces de Referencia

Artículos que me ayudaron con la configuración:

- [Claude Code ahora puede llamar a Codex con MCP](https://zenn.dev/tmasuyama1114/articles/cdfd4562bdce78)
- [Configuración de Codex CLI](https://note.com/npaka/n/n7b6448020250)
- [ChatGPT](https://chatgpt.com/)

*Espero que esto ayude a quienes tienen el mismo problema. El desarrollo impulsado por IA no es fácil, pero es divertido.*
