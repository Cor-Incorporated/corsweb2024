---
title: "Grift: el currículum se puede inflar, las pruebas no. Software de código abierto para extraer hechos verificables del historial de Git"
description: "Grift, nuestro producto propio para extraer hechos verificables (valores de inspección) en lugar de puntuaciones a partir del historial de Git de los ingenieros. Presentamos el diseño y el proceso por el cual cambiamos el rumbo desde una aplicación web de asistencia para estimaciones hacia una CLI de código abierto y el apoyo a recomendaciones para agencias de contratación y empresas de SES."
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "Agencias de selección", "SES", "Contratación"]
publishedAt: 2026-06-30
updatedAt: 2026-10-26
summary: "Grift es un producto propio que extrae «hechos verificables» del historial de Git de los ingenieros. No asigna puntuaciones ni clasificaciones. Al no utilizar IA (LLM) para la medición, cualquier persona que lo ejecute obtiene el mismo resultado y el receptor puede verificar los cálculos. La CLI está disponible como software de código abierto bajo la licencia MIT."
isDraft: false
featured: true
lang: "es"
translationSourceHash: "ef5d17e64309f955e1b45bcd0e7d4a45aa3817cb440d60525b4d6d2093965a57"
translatedAt: "2026-10-26T13:33:24.611Z"
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

## El desafío

Los agentes de contratación y los comerciales de SES (servicios de ingeniería de sistemas), al recomendar a un candidato a una empresa, necesitan explicar "por qué recomiendan a esta persona". Sin embargo, el material del que disponen se reduce casi siempre al currículum y a las impresiones de la entrevista. Aunque figure "5 años de Java", no se transmite el contenido real del trabajo: qué tipo de modificaciones ha realizado y cómo las ha ido verificando.

Por otro lado, el "volumen de actividad", como el historial de contribuciones o el número de commits en GitHub, ahora se puede inflar fácilmente utilizando IA generativa o agentes. Una gran cantidad ya difícilmente sirve como base para una recomendación. No obstante, si se sintetiza en una sola puntuación, se pierde la información de qué se midió, en qué periodo y con qué muestra base, terminando por usarse como una herramienta de descarte. Tanto para quien recomienda como para quien es recomendado, faltaba "material verificable".

## El enfoque

Grift comenzó en febrero de 2026 como una aplicación web para respaldar las estimaciones en proyectos de desarrollo por encargo. Al buscar las bases para dichas estimaciones, nos dimos cuenta de que el material más fidedigno es el propio historial de git acumulado por los ingenieros y, en agosto de 2026, extrajimos la parte de medición como una herramienta de línea de comandos. En septiembre dejamos de ofrecer la antigua aplicación web y cambiamos el rumbo hacia el apoyo a comerciales de agencias de empleo y de SES.

En el diseño establecimos previamente tres compromisos:

- No puntuar: lo que se emite son valores de inspección y quien juzga es una persona. No se generan puntuaciones compuestas, clasificaciones, aprobados/suspensos ni niveles; a cada valor numérico se le adjuntan obligatoriamente el numerador y el denominador.
- Mismo resultado en cada ocasión: no se utiliza IA (LLM) para la medición. Con el mismo repositorio y la misma versión, cualquier persona que lo ejecute obtendrá los mismos valores numéricos.
- No se envía a ningún sitio: funciona únicamente en el equipo local. La persona interesada decide si lo comparte y qué repositorios muestra.

Asimismo, establecimos un código de uso de 7 artículos, que incluye normas como "no interpretar la ausencia como algo negativo", "no descartar basándose únicamente en valores numéricos" y "no medir a terceros sin su consentimiento", acordando que los usos que no las respeten no podrán denominarse con el nombre del método (TEP: Technical Evidence Pipeline).

## Implementación

Grift CLI extrae observaciones como las siguientes a partir únicamente del historial de git:

- Distinción de autoría: categoriza de quién es el trabajo en 11 clasificaciones, tales como commits propios de la persona, trabajo de terceros, bots, artefactos generados o de proveedores e historiales heredados de bifurcaciones (forks).
- Tasa de modificación conjunta de pruebas: porcentaje en el que también se modifican las pruebas en el mismo commit que las modificaciones del código de producción.
- Tasa de retrabajo y retoque: porcentaje de reelaboraciones o reintervenciones sobre archivos modificados recientemente (es un registro de tendencias y no se utiliza para evaluar aptitud).
- Contexto del repositorio: días de actividad real, número de personas involucradas y porcentaje de autoría del creador principal, porcentaje a través de revisiones, etc.

Con `report-v2`, añadido en la v0.6, se suma una capa que permite observar la forma de trabajar de un ingeniero individual. Todas van acompañadas de numerador y denominador, y no constituyen una evaluación del puesto ni de la capacidad.

- Áreas de trabajo (`surface_profile`): número de modificaciones por área en 11 categorías: test / docs / CI/CD / platform / data / observability / frontend / backend / config / generados o proveedores / otros.
- Ritmo de cambios (`change_rhythm`): días en los que se enviaron cambios en los últimos 180 días y el intervalo de los envíos (mediana y percentil 90, porcentaje de continuidad en 2 días o menos, porcentaje de intervalos de 30 días o más). No representa horas de trabajo ni motivación.
- Forma de verificación (`verification_profile`): proporción de commits en los que se intervinieron pruebas y sus tipos (unit / integration / e2e / contract / desconocido), así como la proporción en la que los commits de corrección (fix) fueron acompañados de pruebas.
- 4 dimensiones del rol (`role_profile`): se compone únicamente de domain / work_type / time / process_position, sin sintetizarlas en un único puesto de trabajo. Solo se muestra cuando existe una identidad con el consentimiento registrado de la persona.

El contraste con los requisitos del proyecto también se realiza sin establecer clasificaciones. La parte del proyecto declara las áreas, verificación, ritmo y entradas requeridas mediante `grift project`, y `grift align` las alinea con las observaciones del candidato en cada eje. La correspondencia se clasifica únicamente en 5 estados: superposición (overlap), fuera del rango declarado (outside_declared_range), 0 casos (observed_zero), no observado (not_observed) y no declarado (not_declared), sin calcular puntuaciones globales, clasificaciones ni resultados de aprobado/suspenso. Al visualizar por unidades de equipo con `--team`, solo se muestra el número de personas que cumplen con los requisitos, y para menos de 3 personas no se computa con el fin de evitar la identificación individual.

Cuando la muestra base es inferior a 20, no se muestra un porcentaje sino únicamente el número de casos, y lo que no se pudo observar se presenta con su motivo como "no observado" en lugar de "sin experiencia". `grift verify` recalcula el informe guardado bajo las mismas condiciones y devuelve coincidencia, discrepancia o no verificable, lo que permite al receptor comprobar si ha habido alteraciones o inconsistencias.

El método se denomina TEP (Technical Evidence Pipeline, flujo para la extracción de evidencias técnicas). Consta de 4 etapas: leer el registro de git, contar según reglas fijas, añadir al valor contado el denominador y los motivos de lo que no se pudo contabilizar, y permitir que cualquiera pueda volver a realizar el conteo siguiendo el mismo procedimiento. La explicación detallada se encuentra en la [página sobre TEP](https://griftai.org/tep) del sitio web de Grift.

La correspondencia entre las expresiones utilizadas en esta página y en griftai.org y los términos emitidos en la salida de la CLI es la siguiente:

| Expresión en el sitio | Término en la CLI |
|---|---|
| Valores de inspección | observed value (`kind: observed`; acompañado de valor, unidad y denominador) |
| Tasa de modificación conjunta de pruebas | test co-change |
| Tasa de retrabajo | corrective rework |
| Retoque | path retouch |
| Code recency | survival (únicamente al especificar `--survival`) |
| Contexto del repositorio | context profile |
| Áreas de trabajo, ritmo de cambios y forma de verificación | surface_profile / change_rhythm / verification_profile |

- Repositorio: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- Distribución: PyPI «grift-cli» (`pipx install grift-cli`, Python 3.11 o superior)
- Licencia: MIT
- Notas de la versión: [github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases) (cambios por versión)

## Resultados

El 8 de septiembre de 2026 publicamos la versión [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/) en PyPI. Los indicadores se han validado en 117 repositorios públicos, y tanto las comparaciones que lograron distinguir como las que aún no lo han conseguido están publicadas en GitHub (son mediciones internas y no han sido sometidas a una auditoría por parte de terceros).

El 25 de octubre de 2026 cotejamos línea por línea el texto del sitio web con la salida de la CLI. Dado que la lista de múltiples personas (`actor-index`) aparecía ordenada de mayor a menor número de commits a pesar de que la nota indicaba que "no era una clasificación", en la versión [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0), publicada el 26 de octubre de 2026, cambiamos la ordenación a orden lexicográfico por ID. El valor del número de commits se mantiene. Los antecedentes y los 5 criterios de aceptación fijados para la serie 0.8 se detallan en el [artículo del blog](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/).

En la actualidad, nos encontramos preparando pruebas piloto (PoC) con agencias de colocación y empresas de SES para concretar los motivos de recomendación a partir de los registros que los propios candidatos ejecutan en sus equipos locales. También atendemos consultas de responsables de selección de empresas de desarrollo propio para realizar pruebas piloto (PoC) orientadas a verificar qué tipo de trabajo han realizado a partir de los registros compartidos por los propios candidatos. En cuanto a la versión oficial, nuestro objetivo es iniciar su oferta en 2027 a partir de los resultados de estas pruebas piloto. Grift también se presenta en [griftai.org](https://griftai.org).

La filosofía de Grift también se expone en artículos en [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) y [note](https://note.com/cor_instrument/n/nd58ba0955317).
