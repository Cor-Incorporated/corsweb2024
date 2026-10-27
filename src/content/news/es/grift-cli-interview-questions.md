---
title: "Ahora incluimos al inicio del informe de Grift CLI los puntos que se desean verificar en la entrevista (0.9.0)"
description: "El 27 de octubre de 2026 lanzamos la versión 0.9.0 de Grift CLI. Solo cuando existe un registro de consentimiento con el ID declarado por la propia persona, se redactan al principio del informe, en oraciones breves, la forma de trabajar que se desprende de los registros y los puntos a verificar en la entrevista. Al igual que antes, no se muestran puntuaciones, clasificaciones ni nombres de tipos."
publishedAt: 2026-10-27
category: "update"
tags: ["Grift", "OSS", "Producto"]
source: "Grift"
isDraft: false
featured: false
lang: "es"
translationSourceHash: "ee3b30cd8a4c623febd67cf1ddbe2d672fee01c19b0a7a0c71444603a2de58b7"
translatedAt: "2026-10-27T13:44:20.517Z"
translationModel: "gemini-3.8-flash"
---

## Novedades de la versión 0.9.0

El 27 de octubre de 2026, Cor.Inc. lanzó la versión [0.9.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0) de Grift CLI. Al igual que antes, no se muestran puntuaciones, clasificaciones ni nombres de tipos.

Al principio del Markdown de `grift actor`, `grift project` y `grift align`, se describe brevemente la forma de trabajar que se desprende de los registros. Se detallan la clasificación de las partes modificadas, el ritmo de los cambios, el enfoque de las pruebas y la forma de implicación, acompañados del número de casos y el período; a continuación, se describe lo que no se puede apreciar en este registro y se enumeran, en forma de preguntas, los aspectos que conviene confirmar en una entrevista. Los textos se seleccionan a partir de cifras mediante la [tabla de decisiones](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/trait-profile.md) pública. No se utiliza IA y no se incluyen en el JSON.

Los textos y las preguntas sobre una persona solo se muestran cuando se utiliza el ID declarado por ella misma y existe un registro de consentimiento. En los demás casos, se explica el motivo de su omisión en una sola frase. Las preguntas para la entrevista son material para concretar lo que se consultará al propio candidato, no para determinar el aprobado o suspenso ni para establecer clasificaciones.

Se han eliminado del Markdown la fila de «intensidad» de la tendencia y la fila de «orientación» de la comparación. Esto se debe a que, al comparar dos informes, podían interpretarse erróneamente como personas fuertes o débiles, o personas afines o no afines. Asimismo, se han corregido cuatro puntos en los que podían aparecer cifras que no se correspondían con la realidad acerca de una persona. Las partes corregidas se detallan en las [notas de la versión](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0).

## Antes de actualizar

Debido al cambio en la versión de las definiciones, los informes guardados en la versión 0.8.0 (`analyze`, `actor` y `repo`) y las comparaciones pasarán a mostrarse como «no verificable (`CANNOT_VERIFY`)» en el comando `grift verify` de la versión 0.9.0. Los informes de project se marcarán como «discrepancia (`MISMATCH`)». Por favor, vuelva a generarlos con la versión 0.9.0. Para más información, consulte las [precauciones para la migración](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/migration-v090.md).

```bash
pipx upgrade grift-cli
```

La filosofía y el trasfondo del desarrollo de Grift se resumen en la [página de casos de Grift](/works/grift).
