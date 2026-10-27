---
title: "Ahora incluimos al inicio del informe de Grift CLI los puntos que se desean verificar en la entrevista (0.9.0)"
description: "Lanzamos la versión 0.9.0 de Grift CLI el 27 de octubre de 2026. Solo cuando exista un registro de consentimiento con el ID declarado por la propia persona, se redactarán al inicio del informe, en oraciones breves, la forma de trabajar que se desprende de los registros y los puntos que se desean verificar en la entrevista. Al igual que antes, no se muestran puntuaciones, clasificaciones ni nombres de tipos."
publishedAt: 2026-10-27
category: "update"
tags: ["Grift", "OSS", "Productos"]
source: "Grift"
isDraft: false
featured: false
lang: "es"
translationSourceHash: "a7fe0fafe296a0da9774befadd179855e488c4514793080dd3360f94cbaa222b"
translatedAt: "2026-10-27T13:36:07.524Z"
translationModel: "gemini-3.8-flash"
---

## Novedades de la versión 0.9.0

El 27 de octubre de 2026, Cor.Inc. lanzó la versión [0.9.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0) de Grift CLI. Como hasta ahora, no se emiten puntuaciones, clasificaciones ni nombres de tipos.

Al principio del Markdown de `grift actor`, `grift project` y `grift align`, se describe en frases breves la forma de trabajar que se desprende de los registros. Se detallan las categorías de las partes modificadas, el ritmo de los cambios, la forma de añadir pruebas y el modo de involucrarse, acompañados del número de casos y el período; a continuación, se enumeran en forma de preguntas tanto los aspectos que no se aprecian en estos registros como aquello que se desea comprobar en la entrevista. Los textos se seleccionan a partir de cifras mediante una [tabla de decisión](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/trait-profile.md) pública. No se utiliza IA y no se incluyen en el JSON.

Las frases y preguntas sobre la persona se emiten únicamente cuando existe un registro de consentimiento con el ID declarado por ella misma. En los demás casos, se explica el motivo de la no emisión en una sola frase. Las preguntas de la entrevista son material para concretar qué consultar al propio candidato. No están destinadas a determinar el aprobado/desaprobado ni el orden de clasificación.

Se han eliminado del Markdown la fila de «intensidad» de las tendencias y la de «orientación» del cotejo. Esto se debe a que, al comparar dos informes, podían interpretarse como personas fuertes o débiles, o personas afines o no afines. Asimismo, se han corregido cuatro puntos en los que podían aparecer cifras no acordes con la realidad sobre una persona. Los puntos corregidos figuran en las [notas de la versión](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0).

## Antes de actualizar

Debido al cambio en la versión de las definiciones, los informes (`analyze`, `actor` y `repo`) y cotejos guardados con la versión 0.8.0 pasarán a figurar como «no se puede verificar (`CANNOT_VERIFY`)» en el comando `grift verify` de la versión 0.9.0. Los informes de project pasarán a figurar como «discrepancia (`MISMATCH`)». Por favor, vuelva a generarlos con la versión 0.9.0. Encontrará más detalles en las [precauciones para la migración](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/migration-v090.md).

```bash
pipx upgrade grift-cli
```

El enfoque de Grift y el historial de su desarrollo se recogen en la [página de casos de Grift](/works/grift).
