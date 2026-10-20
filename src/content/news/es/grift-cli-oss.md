---
title: "Publicamos «Grift CLI» como OSS, una herramienta para extraer hechos comprobables a partir del historial de Git"
description: "Hemos publicado «Grift CLI», la herramienta de línea de comandos de nuestro producto Grift, como software de código abierto (OSS) bajo la licencia MIT en PyPI y GitHub. No asigna puntuaciones ni clasificaciones, y produce los mismos resultados sin importar quién la ejecute."
publishedAt: 2026-10-20
category: "update"
tags: ["Grift", "OSS", "Productos"]
source: "Grift"
isDraft: false
featured: true
lang: "es"
translationSourceHash: "ae934df96e7ad3b3adfddc1c170e85b9b6e9fa738a4cc0c325d8d629673f73fc"
translatedAt: "2026-10-20T03:24:34.393Z"
translationModel: "gemini-3.8-flash"
---

## Grift CLI ya está disponible

Cor.Inc. ha publicado «Grift CLI», la herramienta de línea de comandos de su producto propio «Grift», como software de código abierto (OSS) bajo la licencia MIT. El 8 de septiembre de 2026 se publicó la versión v0.7.2 en PyPI.

Grift CLI es una herramienta para extraer «hechos verificables (valores de inspección)» a partir del historial de Git de un ingeniero. Su lema es: «La experiencia se puede exagerar. Las pruebas, no».

## Tres compromisos

- **Sin puntuaciones**: No generamos puntuaciones compuestas, clasificaciones ni resultados de aprobado/suspenso. Los valores numéricos siempre van acompañados de numerador y denominador.
- **Los mismos resultados en cada ejecución**: Como no utilizamos IA (LLM) para la medición, cualquier persona obtendrá exactamente los mismos valores numéricos para el mismo repositorio y la misma versión. Los informes guardados se pueden volver a calcular y verificar con `grift verify`.
- **Sin envíos a ningún destino**: Se ejecuta exclusivamente en su propio ordenador. La decisión de compartirlo o no corresponde a la propia persona.

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

## Sobre el cambio de enfoque

Grift comenzó en febrero de 2026 como una aplicación web para respaldar las estimaciones en proyectos de desarrollo por encargo. En agosto de 2026, se separó la parte de medición como CLI y, en septiembre, se puso fin a la antigua aplicación web. Los planes que se habían presentado anteriormente, como Team Beta, se retiraron en octubre de 2026.

Actualmente, atendemos consultas para implementaciones de prueba (PoC) orientadas a que agencias de selección de personal y comerciales de SES (servicios de ingeniería de sistemas) puedan comunicar los motivos de sus recomendaciones con un respaldo fundamentado. Para más información, consulte la [página de casos de éxito de Grift](/works/grift).
