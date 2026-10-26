---
title: "Grift: el currículum se puede inflar, las pruebas no. Software de código abierto para extraer hechos verificables del historial de git"
description: "Grift, nuestro producto propio que extrae del historial de git de los ingenieros hechos verificables (valores medidos) en lugar de puntuaciones. Presentamos el diseño y el proceso por el cual cambiamos el rumbo de una aplicación web de estimaciones a una CLI de código abierto y al apoyo de recomendaciones para agencias de contratación y SES."
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "Reclutamiento y selección", "SES", "Contratación"]
publishedAt: 2026-06-30
updatedAt: 2026-10-26
summary: "Grift es un producto propio que extrae «hechos verificables» del historial de git de los ingenieros. No asigna puntuaciones ni clasificaciones. Al no utilizar IA (LLM) para la medición, produce el mismo resultado sin importar quién lo ejecute, lo que permite que el receptor pueda verificar los cálculos. La CLI está disponible como software de código abierto bajo licencia MIT."
isDraft: false
featured: true
lang: "es"
translationSourceHash: "55cea17da0f2c5b39ce62e7acd9d278a9f47ee15e380c572f3b4a26ddc531cb7"
translatedAt: "2026-10-26T08:02:23.963Z"
translationModel: "gemini-3.8-flash"
---

<!--
執筆ガイドライン（terisuke向け）:
本文は以下の4見出しで構成してください。各 ## はそのまま記事内に表示されます。
  ## 課題      — 顧客が抱えていた問題・背景
  ## アプローチ — どう考え、どんな方針で臨んだか
  ## 実装      — 実際に作ったもの・技術的なポイント
  ## 成果      — 結果・効果（数値があれば具体的に。NDA案件は抽象化し securityNote を設定）
NDA・機密案件では具体名や数値をぼかし、frontmatter の securityNote を有効化してください。
2026-10-20: 見積支援Webアプリ時代の本文を、CLI への方針転換後の内容に書き換えた（ADR-0022）。
2026-10-25: 観測の層を report-v2（作業領域・変更リズム・検証の形・役割）と grift project / align まで広げ、サイトの訳語と CLI の語の対応表を置いた。
2026-10-26: 「実装」に TEP の 4 つの段階の平易な説明と、griftai.org の TEP ページへのリンクを足した。
-->

## El problema

Los reclutadores de agencias de empleo y de SES necesitan explicar "por qué recomiendan a esta persona" al presentar candidatos a las empresas. Sin embargo, el material del que disponen consiste casi exclusivamente en currículums e impresiones de entrevistas. Incluso si pone "5 años de Java", los detalles reales de su trabajo —qué tipo de cambios implementaron y cómo los validaron a lo largo del camino— no se transmiten.

Por otro lado, el "volumen de actividad", como las contribuciones en GitHub o el número de commits, se ha vuelto fácil de inflar mediante IA generativa y agentes. La mera cantidad ya difícilmente sirve como base para una recomendación. No obstante, si se resume todo en una sola puntuación, se pierde la información sobre qué se midió, en qué período y sobre qué muestra base, convirtiéndose en una herramienta de criba excluyente. Tanto a quienes recomiendan como a quienes son recomendados les faltaban "datos contrastables".

## Nuestro enfoque

Grift comenzó en febrero de 2026 como una aplicación web de apoyo a la estimación de costes en desarrollos por encargo. Al buscar fundamentos sólidos para las estimaciones, nos dimos cuenta de que el material más contrastable es el propio historial de git que acumulan los ingenieros; por ello, en agosto de 2026 extrajimos la parte de medición como una herramienta de línea de comandos. En septiembre dejamos de ofrecer la antigua aplicación web y cambiamos de rumbo para orientarnos a dar soporte a las ventas de las agencias de contratación y empresas de SES.

En el diseño, establecimos tres compromisos previos:

- No puntuar: Proporcionamos valores de inspección; el criterio corresponde a las personas. No generamos puntuaciones compuestas, rankings, aprobados/suspensos ni niveles; los valores numéricos siempre van acompañados de numerador y denominador.
- Mismo resultado cada vez: No utilizamos IA (LLM) para la medición. Con el mismo repositorio y la misma versión, cualquier persona obtendrá exactamente los mismos valores numéricos al ejecutarlo.
- No se envía a ninguna parte: Funciona únicamente en el PC local. Quien decide si se comparte o qué repositorios se muestran es la propia persona.

Asimismo, establecimos un código de uso de 7 artículos —que incluye principios como "no interpretar la ausencia como un aspecto negativo", "no hacer cribas basándose únicamente en números" o "no medir a terceros sin su consentimiento"—, y determinamos que cualquier uso que no lo respete no podrá denominarse con el nombre del método (TEP: Technical Evidence Pipeline).

## Implementación

Grift CLI extrae observaciones como las siguientes a partir únicamente del historial de git:

- Diferenciación de autoría: Separa de quién es el trabajo en 11 clasificaciones, tales como commits propios, trabajo de terceros, bots, artefactos generados/de proveedores e historiales heredados de forks.
- Tasa de co-modificación de pruebas: Porcentaje en el que se modifican pruebas en el mismo commit que los cambios de código de producción.
- Tasa de retrabajo y retoque: Porcentaje de rehaceres o reintervenciones sobre archivos tocados recientemente (es un registro de tendencias y no se utiliza para determinar aptitud).
- Contexto del repositorio: Días de trabajo efectivo, número de personas implicadas, cuota de autoría del creador principal, porcentaje a través de revisiones de código, etc.

Con `report-v2`, añadido en la v0.6, se suma una capa para observar la forma de trabajar de un ingeniero individual. Todas van acompañadas de numerador y denominador, y no constituyen una evaluación del puesto ni de la capacidad.

- Áreas de trabajo (`surface_profile`): Cantidad de cambios realizados en cada área dentro de 11 categorías: test / docs / CI/CD / platform / data / observability / frontend / backend / config / generados o de proveedores / otros.
- Ritmo de cambios (`change_rhythm`): Días en los que se enviaron cambios en los últimos 180 días y el intervalo entre envíos (mediana y percentil 90, porcentaje consecutivos en 2 días o menos, y porcentaje con pausas de 30 días o más). No mide horas de trabajo ni motivación.
- Forma de verificación (`verification_profile`): Porcentaje de commits que tocaron pruebas y sus tipos (unit / integration / e2e / contract / desconocido), así como el porcentaje de commits de corrección (fix) acompañados de pruebas.
- 4 dimensiones del rol (`role_profile`): domain / work_type / time / process_position exclusivamente, sin reducirlas a un único puesto. Solo se emite cuando existe una identidad con el consentimiento registrado de la propia persona.

El cotejo con los requerimientos del proyecto también se realiza sin establecer clasificaciones jerárquicas. El lado del proyecto declara las áreas, verificación, ritmo y entradas requeridas mediante `grift project`, y `grift align` las alinea eje por eje con las observaciones del candidato. La correspondencia se limita únicamente a cinco posibilidades: solapamiento (overlap), fuera del rango declarado (outside_declared_range), 0 casos observados (observed_zero), no observado (not_observed) y no requerido (not_declared), sin calcular puntuaciones globales, rankings ni aptitud. Al analizar a nivel de equipo con `--team`, solo se indica el número de personas que cumplen los requisitos, y no se agregan datos para menos de 3 personas a fin de evitar la identificación individual.

Cuando la muestra base es inferior a 20, no se muestran porcentajes sino únicamente el recuento de casos, y lo que no se pudo observar no se presenta como "sin logros", sino como "no observado" con su motivo correspondiente. `grift verify` recalcula un informe guardado bajo las mismas condiciones y devuelve coincidencia, discrepancia o no verificable, permitiendo a la parte receptora confirmar manipulaciones o discrepancias.

El método se denomina TEP (Technical Evidence Pipeline, flujo de extracción de evidencias técnicas). Consta de cuatro etapas: leer el registro de git, contar según reglas predeterminadas, acompañar los valores contados con denominadores y los motivos de lo que no se pudo contar, y permitir que cualquiera pueda volver a realizar el recuento siguiendo el mismo procedimiento. La explicación detallada se encuentra en la [página de TEP](https://griftai.org/tep) dentro del sitio web de Grift.

La correspondencia entre la terminología empleada en este sitio y en griftai.org y los términos emitidos por la CLI es la siguiente:

| Expresión en el sitio | Término en la CLI |
|---|---|
| Valor de inspección | observed value (`kind: observed`; incluye valor, unidad y denominador) |
| Tasa de co-modificación de pruebas | test co-change |
| Tasa de retrabajo | corrective rework |
| Retoque | path retouch |
| Tasa de permanencia | survival (solo al especificar `--survival`) |
| Contexto del repositorio | context profile |
| Áreas de trabajo, ritmo de cambios y forma de verificación | surface_profile / change_rhythm / verification_profile |

- Repositorio: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- Distribución: PyPI "grift-cli" (`pipx install grift-cli`, Python 3.11 o superior)
- Licencia: MIT
- Notas de la versión: [github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases) (cambios en cada versión)

## Resultados

El 8 de septiembre de 2026 publicamos la [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/) en PyPI. Las métricas se verificaron en 117 repositorios públicos, y tanto las comparaciones que lograron diferenciar como las que aún no lo han conseguido están publicadas en GitHub (son mediciones internas y no han sido sometidas a auditorías de terceros).

El 25 de octubre de 2026 cotejamos línea por línea el texto del sitio web con las salidas de la CLI. Dado que la lista de múltiples personas (`actor-index`) se ordenaba de mayor a menor número de commits a pesar de que la nota indicaba "no es un ranking", en la versión [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0), publicada el 26 de octubre de 2026, cambiamos el orden al orden lexicográfico de los identificadores. El valor del número de commits se mantiene. Los antecedentes y los cinco criterios de aceptación exigidos a la serie 0.8 se detallan en el [artículo del blog](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/).

Actualmente estamos preparando, junto con agencias de contratación y empresas de SES, pruebas de adopción (PoC) para fundamentar los motivos de recomendación a partir de registros ejecutados localmente por los propios candidatos. También atendemos consultas de responsables de selección de empresas con desarrollo propio interesadas en pruebas de adopción (PoC) para verificar el trabajo realizado a partir de los registros compartidos por los propios candidatos. En cuanto a la versión oficial, nuestro objetivo es iniciar su comercialización en 2027 a partir de los resultados de las pruebas piloto. Grift también se presenta en [griftai.org](https://griftai.org).

La filosofía de Grift también se presenta en artículos de [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) y [note](https://note.com/cor_instrument/n/nd58ba0955317).
