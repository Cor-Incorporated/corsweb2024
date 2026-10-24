---
title: "Hemos publicado «Grift CLI» como OSS, una herramienta para extraer hechos comprobables a partir del historial de git"
description: "Hemos publicado «Grift CLI», la herramienta de línea de comandos de nuestro producto Grift, como software de código abierto (OSS) bajo la licencia MIT en PyPI y GitHub. No asigna puntuaciones ni clasificaciones, y produce los mismos resultados sin importar quién la ejecute."
publishedAt: 2026-10-20
category: "update"
tags: ["Grift", "OSS", "Producto"]
source: "Grift"
isDraft: false
featured: true
lang: "es"
translationSourceHash: "ca3bd16b31d7cfb3ef5a887e1a418c09148f54c78921c9a44becf0375c495c1b"
translatedAt: "2026-10-23T06:33:36.219Z"
translationModel: "gemini-3.8-flash"
---

## Lanzamiento de Grift CLI

Cor.Inc. ha publicado «Grift CLI», la herramienta de línea de comandos de su producto propio «Grift», como software de código abierto (OSS) bajo la licencia MIT. El 8 de septiembre de 2026, se publicó la versión v0.7.2 en PyPI.

Grift CLI es una herramienta para extraer «hechos verificables (valores de inspección)» a partir del historial de git de un ingeniero. Su lema es: «La trayectoria se puede inflar. Las pruebas, no».

## 3 promesas

- Sin puntuaciones: No emitimos puntuaciones compuestas, clasificaciones ni resultados de aprobado/suspenso. Los valores numéricos siempre van acompañados de numerador y denominador.
- Siempre el mismo resultado: Al no utilizar IA (LLM) para la medición, cualquier persona obtendrá las mismas cifras si utiliza el mismo repositorio y la misma versión. Los informes guardados se pueden recalcular y verificar con `grift verify`.
- No se envía a ninguna parte: Funciona únicamente en su ordenador local. La decisión de compartirlo depende exclusivamente del propio usuario.

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

## Cambio de rumbo

Grift comenzó en febrero de 2026 como una aplicación web para respaldar las estimaciones de proyectos de desarrollo por encargo. En agosto de 2026, se separó la parte de medición como CLI y, en septiembre, se dio por finalizada la oferta de la antigua aplicación web. Planes como el Team Beta, anunciados anteriormente, se retiraron en octubre de 2026.

Actualmente, aceptamos consultas para implementaciones de prueba (PoC) destinadas a que los agentes de contratación y de ventas de SES (servicios de ingeniería de sistemas) puedan comunicar los motivos de sus recomendaciones con base en evidencias. Para más detalles, consulte la [página de casos prácticos de Grift](/works/grift).
