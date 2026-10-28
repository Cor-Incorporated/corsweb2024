---
title: "Publicamos «Grift CLI» como OSS: una herramienta para extraer hechos comprobables a partir del historial de git"
description: "Hemos publicado «Grift CLI», la herramienta de línea de comandos de nuestro producto Grift, como OSS bajo la licencia MIT en PyPI y GitHub. No asigna puntuaciones ni clasificaciones, y produce el mismo resultado sin importar quién la ejecute."
publishedAt: 2026-10-20
category: "update"
tags: ["Grift", "OSS", "Productos"]
source: "Grift"
isDraft: false
featured: true
lang: "es"
translationSourceHash: "ed5a3adbdd57154b1cbb7ab4f8318fb3e0b08de7c0d8a8e3a1084e6b7179df2e"
translatedAt: "2026-10-26T13:34:01.695Z"
translationModel: "gemini-3.8-flash"
---

## Publicación de Grift CLI

Cor.Inc. ha publicado «Grift CLI», la herramienta de línea de comandos de su producto propio «Grift», como software de código abierto (OSS) bajo la licencia MIT. El 8 de septiembre de 2026 se publicó la versión v0.7.2 en PyPI.

Grift CLI es una herramienta para extraer «hechos verificables (valores de inspección)» a partir del historial de git de los ingenieros. El lema es «La trayectoria profesional se puede exagerar. Las evidencias no.»

## Nuestros 3 compromisos

- No convertir en puntuaciones: No emitimos puntuaciones compuestas, clasificaciones ni resultados de aprobado/suspenso. A las cifras siempre les asignamos numerador y denominador
- Siempre el mismo resultado: Al no utilizar IA (LLM) para la medición, cualquier persona que lo ejecute sobre el mismo repositorio y la misma versión obtendrá las mismas cifras. Los informes guardados se pueden recalcular y verificar con `grift verify`
- No enviar a ninguna parte: Funciona únicamente en su ordenador local. La decisión de compartirlo o no corresponde a la propia persona

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

Grift comenzó en febrero de 2026 como una aplicación web para respaldar las estimaciones en proyectos de desarrollo por encargo. En agosto de 2026 se independizó la parte de medición como CLI, y en septiembre finalizó la provisión de la antigua aplicación web. Los planes anunciados anteriormente, como Team Beta, fueron retirados en octubre de 2026.

Actualmente, aceptamos consultas para implementaciones de prueba (PoC) destinadas a que las agencias de empleo y comerciales de SES comuniquen los motivos de sus recomendaciones con fundamentos sólidos, o a que los responsables de contratación de empresas con desarrollo propio comprueben qué tipo de trabajo ha realizado un candidato a partir de los registros que este decida compartir. Para obtener más información, consulte la [página de casos de éxito de Grift](/works/grift).
