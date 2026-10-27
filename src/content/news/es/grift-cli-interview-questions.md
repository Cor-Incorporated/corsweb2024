---
title: "Ahora los informes de Grift CLI incluyen aspectos a verificar durante la entrevista (0.9.0)"
description: "El 27 de octubre de 2026 publicamos la versión 0.9.0 de Grift CLI. Únicamente cuando existe un registro de consentimiento con el ID declarado por la propia persona, se redactan al principio del informe, en oraciones breves, su forma de trabajar reflejada en los registros y los aspectos a verificar durante la entrevista. Al igual que antes, no se muestran puntuaciones, clasificaciones ni nombres de tipos de perfil."
publishedAt: 2026-10-27
category: "update"
tags: ["Grift", "OSS", "Producto"]
source: "Grift"
isDraft: false
featured: false
lang: "es"
translationSourceHash: "1af911264961073a5818f1745fa3379f031c6cefe30d129970b18a44e89409c5"
translatedAt: "2026-10-27T13:53:07.295Z"
translationModel: "gemini-3.8-flash"
---

## Novedades en la versión 0.9.0

El 27 de octubre de 2026, Cor.Inc. lanzó la versión [0.9.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0) de Grift CLI. Al igual que antes, no mostramos puntuaciones, clasificaciones ni nombres de tipos.

Al principio del Markdown de `grift actor`, se describe en frases cortas la forma de trabajar que se desprende de los registros. Se detallan las categorías de las partes modificadas, el ritmo de los cambios, la forma de añadir pruebas y el modo de participación, acompañados del número de casos y el período; a continuación, se describe aquello que no puede apreciarse en estos registros y se enumeran, en forma de preguntas, los aspectos que conviene comprobar en la entrevista. `grift project` describe la forma de avanzar en el repositorio del proyecto bajo las mismas reglas, sin mostrar las cifras individuales por persona ni su modo de participación. `grift align` añade, a la correspondencia entre requisitos y registros, los aspectos que conviene comprobar en la entrevista en forma de preguntas. Las frases y preguntas se seleccionan a partir de cifras mediante una [tabla de decisión](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/trait-profile.md) pública, sin utilizar IA. Dado que no se incluyen en el JSON, lo que se puede verificar con `grift verify` son las cifras en las que se basan dichas frases.

Las frases y preguntas relativas a una persona solo se muestran cuando se dispone del ID indicado por el propio interesado y existe constancia de su consentimiento. En los demás casos, se explica el motivo de no mostrarlas en una sola frase. Las preguntas para la entrevista son material para concretar qué consultar al propio candidato. No tienen como fin determinar la admisión/rechazo ni establecer clasificaciones.

Se han eliminado del Markdown la fila de «intensidad» de la tendencia y la fila de «orientación» de la contrastación. Esto se debe a que, al comparar dos informes, podían interpretarse como personas fuertes o débiles, o personas adecuadas o no adecuadas. Además, se han corregido cuatro puntos en los que podían aparecer cifras que no coincidían con la realidad respecto a una persona. Los puntos corregidos se encuentran en las [notas de la versión](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0).

## Antes de actualizar

Debido al cambio de versión de las definiciones, los informes (`analyze`, `actor` y `repo`) y las contrastaciones guardados en la versión 0.8.0 pasarán a ser «no comprobable (`CANNOT_VERIFY`)» en `grift verify` de la versión 0.9.0. Los informes de project pasarán a ser «discrepancia (`MISMATCH`)». Por favor, vuelva a generarlos en la versión 0.9.0. Encontrará más detalles en las [notas sobre la migración](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/migration-v090.md).

```bash
pipx upgrade grift-cli
```

La filosofía y el trasfondo del desarrollo de Grift se encuentran recopilados en la [página de casos prácticos de Grift](/works/grift).
