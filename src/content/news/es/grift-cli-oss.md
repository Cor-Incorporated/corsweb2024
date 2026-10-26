---
title: "Publicamos «Grift CLI» como OSS, una herramienta para extraer hechos comprobables a partir del historial de Git"
description: "Publicamos la herramienta de línea de comandos de nuestro producto propio Grift, «Grift CLI», como OSS bajo la licencia MIT en PyPI y GitHub. No asigna puntuaciones ni clasificaciones, y produce el mismo resultado sin importar quién la ejecute."
publishedAt: 2026-10-20
category: "update"
tags: ["Grift", "OSS", "Producto"]
source: "Grift"
isDraft: false
featured: true
lang: "es"
translationSourceHash: "4222aeac7141923a5addb79b67f78e0daa2a303ad46dc6ddf790958ef9196a28"
translatedAt: "2026-10-26T08:02:59.314Z"
translationModel: "gemini-3.8-flash"
---

## Lanzamiento de Grift CLI

Cor.Inc. ha publicado «Grift CLI», la herramienta de línea de comandos de su producto propio «Grift», como OSS bajo la licencia MIT. El 8 de septiembre de 2026 se publicó la versión v0.7.2 en PyPI.

Grift CLI es una herramienta para extraer «hechos verificables (valores de inspección)» a partir del historial de git de un ingeniero. Su eslogan es: «La experiencia se puede maquillar. La evidencia, no.»

## Nuestros 3 compromisos

- Sin puntuaciones: No emitimos puntuaciones compuestas, clasificaciones ni resultados de aprobado/suspenso. Las cifras siempre van acompañadas de su numerador y denominador
- Siempre el mismo resultado: Al no utilizar IA (LLM) para las mediciones, cualquier persona que lo ejecute obtendrá exactamente las mismas cifras en el mismo repositorio y con la misma versión. Los informes guardados se pueden volver a calcular y verificar mediante `grift verify`
- No se envía a ninguna parte: Funciona exclusivamente en su ordenador local. La persona decide si desea compartirlo o no

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

## Cambio de enfoque

Grift comenzó en febrero de 2026 como una aplicación web para respaldar las estimaciones en proyectos de desarrollo por encargo. En agosto de 2026, aislamos la parte de medición como una herramienta CLI y, en septiembre, finalizamos la disponibilidad de la antigua aplicación web. Los planes que habíamos anunciado previamente, como Team Beta, se retiraron en octubre de 2026.

Actualmente, aceptamos consultas para implementaciones piloto (PoC) destinadas a que los agentes de agencias de empleo y ventas de SES transmitan los motivos de recomendación con fundamentos sólidos, o para que los responsables de contratación de empresas con desarrollo propio verifiquen, a partir de los registros compartidos por los propios candidatos, qué tipo de trabajo han realizado. Para obtener más información, consulte la [página de casos de éxito de Grift](/works/grift).
