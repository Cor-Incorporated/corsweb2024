---
title: "Grift: el currículum se puede inflar; las pruebas no. Software de código abierto (OSS) para extraer hechos verificables a partir del historial de git"
description: "Grift, nuestro producto propio que extrae hechos verificables (valores de inspección) en lugar de puntuaciones a partir del historial de git de los ingenieros. Presentamos el diseño y el proceso que nos llevó a pivotar desde una aplicación web de apoyo a presupuestos hacia una CLI de OSS y una solución de apoyo a recomendaciones para agencias de contratación y SES."
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "Agencias de selección", "SES"]
publishedAt: 2026-06-30
updatedAt: 2026-10-26
summary: "Grift es un producto propio que extrae «hechos verificables» del historial de git de los ingenieros. No asigna puntuaciones ni clasificaciones. Dado que no utiliza IA (LLM) para la medición, produce los mismos resultados sin importar quién lo ejecute, permitiendo que la parte receptora verifique los cálculos. La CLI está publicada como OSS bajo la licencia MIT."
isDraft: false
featured: true
lang: "es"
translationSourceHash: "3e040444b57b65105b31020423b445f7e2670d2f2e3b6da65bf6bbeaed4d4660"
translatedAt: "2026-10-25T15:06:24.516Z"
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

Los consultores de agencias de contratación y los equipos de ventas de SES (servicios de ingeniería de sistemas) deben explicar a las empresas clientes «por qué recomiendan a este candidato» al presentar una postulación. Sin embargo, en la práctica casi todo lo que tienen a mano es el currículum y las impresiones de una entrevista. Aunque diga «5 años en Java», esto no transmite la sustancia real del trabajo: qué tipo de modificaciones llevó a cabo la persona ni cómo las fue validando a medida que avanzaba.

Por otro lado, métricas de «volumen de actividad» como la gráfica de contribuciones («el césped») o el recuento de commits en GitHub se han vuelto fáciles de inflar con IA generativa y agentes. El mero volumen ya casi no sirve como fundamento sólido para una recomendación. Al mismo tiempo, reducir todo a una sola puntuación borra qué se midió, en qué período y sobre qué muestra o denominador, convirtiéndose en una simple herramienta de descarte. Faltaba «evidencia verificable», tanto para quienes recomiendan como para quienes son recomendados.

## Nuestro enfoque

Grift comenzó en febrero de 2026 como una aplicación web concebida para respaldar las estimaciones en proyectos de desarrollo por encargo. Al indagar en qué justificaba una estimación, nos dimos cuenta de que la evidencia más fiable es el propio historial de git que acumulan los ingenieros. En agosto de 2026, aislamos la parte de medición y la convertimos en una herramienta de línea de comandos. En septiembre, dejamos de ofrecer la antigua aplicación web y reorientamos el rumbo para respaldar la labor comercial de las agencias de contratación y empresas de SES.

En la etapa de diseño, establecimos tres compromisos previos:

- No emitir puntuaciones: Grift ofrece valores de observación; el criterio de evaluación queda en manos humanas. No calcula puntuaciones compuestas, rankings, decisiones de apto/no apto ni calificaciones por niveles, y a cada cifra le añade siempre su numerador y su denominador.
- Mismo resultado en cada ejecución: no utiliza IA (LLM) para la medición. Con el mismo repositorio y la misma versión, cualquiera que lo ejecute obtendrá exactamente los mismos valores numéricos.
- No envía datos a ninguna parte: funciona exclusivamente en la máquina local. La persona decide si comparte la información y qué repositorios incluye.

Paralelamente, definimos un código de uso de siete principios —que incluye «no interpretar las ausencias de forma negativa», «no realizar descartes basándose únicamente en cifras» y «no medir a terceros sin su consentimiento»— y establecimos que cualquier uso que no los respete no podrá denominarse con el nombre de nuestra metodología (TEP: Technical Evidence Pipeline).

## Implementación

Grift CLI extrae observaciones como las siguientes valiéndose únicamente del historial de git:

- Distinción de autoría: clasifica el trabajo en 11 categorías (commits propios de la persona, trabajo de terceros, bots, artefactos generados o de proveedores, historiales heredados de un fork, etc.) para identificar de quién es cada aportación.
- Tasa de modificación conjunta de pruebas (test co-change): porcentaje de cambios en el código de producción en los que también se modificaron pruebas dentro del mismo commit.
- Tasa de retrabajo y retoque de rutas: proporción de reelaboraciones o nuevas intervenciones sobre archivos tocados recientemente (registra tendencias; no se emplea para dictámenes de aptitud).
- Contexto del repositorio: días de actividad real, cantidad de colaboradores e índice de acaparamiento del autor principal, porcentaje de aportaciones canalizadas a través de revisiones de código, etc.

Con la incorporación de `report-v2` en la v0.6, se sumaron capas para observar la forma de trabajar de un ingeniero individual. Todas ellas cuentan con numerador y denominador, y no constituyen una evaluación del perfil profesional ni de las competencias:

- Áreas de trabajo (`surface_profile`): distribución y recuento de cambios en 11 categorías: test / docs / CI/CD / platform / data / observability / frontend / backend / config / generados o proveedores / otros.
- Ritmo de cambios (`change_rhythm`): días en los que se enviaron cambios en los últimos 180 días y los intervalos entre envíos (mediana, percentil 90, porcentaje de envíos con menos de 2 días de separación y porcentaje con más de 30 días de intervalo). No mide horas de trabajo ni motivación.
- Estilo de verificación (`verification_profile`): porcentaje de commits que tocaron pruebas y sus tipos (unit / integration / e2e / contract / desconocido), así como la proporción de commits de corrección (fix) acompañados de pruebas.
- Cuatro dimensiones del rol (`role_profile`): domain / work_type / time / process_position; no se reducen a un único puesto de trabajo. Solo se muestran cuando existe una identidad con el consentimiento expreso de la persona registrado.

El cotejo con los requerimientos del proyecto también se realiza sin establecer clasificaciones ordenadas. La parte del proyecto declara las áreas, verificación, ritmo y entradas requeridas mediante `grift project`, y `grift align` las alinea eje por eje con las observaciones del candidato. Esta comparación se clasifica únicamente en 5 estados: coincidencia (overlap), fuera del rango declarado (outside_declared_range), cero observado (observed_zero), no observado (not_observed) y no declarado (not_declared), sin calcular puntuaciones globales, posiciones en ranking ni aprobados o suspensos. Cuando se examina a nivel de equipo con `--team`, solo se muestra el número de personas que satisfacen el requerimiento; si son menos de 3 personas, no se genera el agregado para evitar identificar a individuos concretos.

Cuando el tamaño de la muestra es inferior a 20, no se muestran porcentajes, sino únicamente el número de casos. Aquello que no pudo observarse no se etiqueta como «sin experiencia», sino como «no observado», indicando el motivo. `grift verify` recalcula un informe guardado bajo las mismas condiciones y devuelve si coincide, si discrepa o si no se puede verificar, lo que permite a la parte receptora comprobar si hubo alteraciones o discrepancias.

Nuestra metodología se denomina TEP (Technical Evidence Pipeline, flujo de extracción de evidencia técnica). Consta de cuatro fases: leer los registros de git, realizar el conteo con reglas predefinidas, asociar a los valores contabilizados su denominador y las razones de lo que no pudo contarse, y permitir que cualquiera pueda repetir el cálculo siguiendo el mismo procedimiento. Encontrará una explicación detallada en la [página de TEP](https://griftai.org/tep) en el sitio web de Grift.

La correspondencia entre las expresiones utilizadas en esta página y en griftai.org y los términos de salida de la CLI es la siguiente:

| Expresión en el sitio | Término en la CLI |
|---|---|
| Valor de inspección / observación | observed value (`kind: observed`; incluye valor, unidad y denominador) |
| Tasa de modificación conjunta de pruebas | test co-change |
| Tasa de retrabajo | corrective rework |
| Retoque de rutas | path retouch |
| Tasa de consolidación | survival (solo al especificar `--survival`) |
| Contexto del repositorio | context profile |
| Áreas de trabajo / Ritmo de cambios / Estilo de verificación | surface_profile / change_rhythm / verification_profile |

- Repositorio: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- Distribución: PyPI «grift-cli» (`pipx install grift-cli`, Python 3.11 o superior)
- Licencia: MIT

## Resultados

El 8 de septiembre de 2026 publicamos la versión v0.7.2 en PyPI. Las métricas se verificaron en 117 repositorios públicos, y en GitHub compartimos abiertamente tanto las comparativas que arrojaron distinciones claras como aquellas que aún no lo logran (se trata de mediciones internas, sin auditoría de terceros).

El 25 de octubre de 2026 cotejamos línea por línea el texto del sitio web con los datos de salida de la CLI. Detectamos que el listado de varias personas (`actor-index`), a pesar de indicar en una nota aclaratoria que «no se trata de un ranking», aparecía ordenado de mayor a menor número de commits. Por ello, en la próxima versión (0.8) cambiaremos este orden al orden lexicográfico de sus ID, manteniendo los valores del recuento de commits. Los detalles de estos antecedentes y los cinco criterios de aceptación fijados para la serie 0.8 se explican en nuestro [artículo de blog](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/).

En la actualidad, nos encontramos preparando pruebas piloto (PoC) junto a agencias de selección y empresas de SES para concretar los fundamentos de sus recomendaciones a partir de los registros que los propios candidatos ejecutan en su entorno local. Sobre la base de los resultados de estas pruebas piloto, nuestro objetivo es comenzar a ofrecer la versión oficial en 2027. También puede conocer más acerca de Grift en [griftai.org](https://griftai.org).

La filosofía detrás de Grift se expone asimismo en nuestros artículos de [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) y [note](https://note.com/cor_instrument/n/nd58ba0955317).
