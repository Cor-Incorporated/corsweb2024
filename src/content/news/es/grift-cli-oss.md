---
title: "Publicamos «Grift CLI» como OSS, una herramienta para extraer hechos comprobables a partir del historial de Git"
description: "Hemos publicado «Grift CLI», la herramienta de línea de comandos de nuestro producto Grift, como OSS bajo la licencia MIT en PyPI y GitHub. No asigna puntuaciones ni clasificaciones, y ofrece el mismo resultado independientemente de quién la ejecute."
publishedAt: 2026-10-20
category: "update"
tags: ["Grift", "OSS", "Productos"]
source: "Grift"
isDraft: false
featured: true
lang: "es"
translationSourceHash: "881ec4903ce970a25ca72acd37f1fa6db515a1cfc8d1278eb12d20837ed7de41"
translatedAt: "2026-10-20T01:58:52.169Z"
translationModel: "gemini-3.8-flash"
---

## Grift CLI ya está disponible

Cor.Inc. ha publicado «Grift CLI», la herramienta de línea de comandos de su producto propio «Grift», como software de código abierto (OSS) bajo la licencia MIT. El 8 de septiembre de 2026 se publicó la versión v0.7.2 en PyPI.

Grift CLI es una herramienta para extraer «hechos verificables (valores de inspección)» a partir del historial de git de un ingeniero. Su lema es: «La experiencia se puede maquillar. Las evidencias, no».

## Tres compromisos

- **Sin puntuaciones**: No generamos puntuaciones compuestas, clasificaciones ni resultados de aprobado/suspenso. Los valores numéricos siempre van acompañados de numerador y denominador.
- **Resultados idénticos en cada ejecución**: Como no utilizamos IA (LLM) para la medición, cualquier persona obtendrá exactamente los mismos valores numéricos para el mismo repositorio y la misma versión. Los informes guardados se pueden verificar y recalcular con `grift verify`.
- **No se envía a ningún sitio**: Funciona exclusivamente en su ordenador local. La decisión de compartirlo o no recae únicamente en el propio usuario.

## Modo de uso

En un entorno con Python 3.11 o superior, puede comenzar con el siguiente comando:

```bash
pipx install grift-cli
cd your-repo
grift report
grift verify
```

- GitHub: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- PyPI: [pypi.org/project/grift-cli](https://pypi.org/project/grift-cli/)

## Acerca del cambio de estrategia

Grift comenzó en febrero de 2026 como una aplicación web para respaldar las estimaciones en proyectos de desarrollo por encargo. En agosto de 2026, aislamos la parte de medición como una herramienta CLI y, en septiembre, finalizamos la prestación de la antigua aplicación web. Los planes que anunciábamos anteriormente, como Team Beta, se retiraron en octubre de 2026.

Actualmente, aceptamos consultas para pruebas de concepto (PoC) orientadas a que agencias de colocación y equipos comerciales de SES puedan transmitir los motivos de sus recomendaciones con un respaldo fundamentado. Para más detalles, consulte la [página de casos prácticos de Grift](/works/grift).
