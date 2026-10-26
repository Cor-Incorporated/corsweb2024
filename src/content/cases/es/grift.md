---
title: "Grift: el currículum se puede exagerar, las pruebas no. Un proyecto OSS para extraer hechos comprobables del historial de git"
description: "Grift es un producto propio que extrae hechos comprobables (valores de inspección), no puntuaciones, del historial de git de los ingenieros. Presentamos el diseño y la evolución de su enfoque: de una aplicación web para estimaciones a una CLI de código abierto (OSS) y soporte para recomendaciones dirigidas a agencias de empleo y empresas SES."
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "Agencias de empleo", "SES"]
publishedAt: 2026-06-30
updatedAt: 2026-10-26
summary: "Grift es un producto propio que extrae «hechos comprobables» del historial de git de los ingenieros. No asigna puntuaciones ni clasificaciones. Al no utilizar IA (LLM) en las mediciones, ofrece los mismos resultados independientemente de quién lo ejecute, permitiendo que quien los reciba pueda verificarlos. La CLI está disponible como OSS bajo la licencia MIT."
isDraft: false
featured: true
lang: "es"
translationSourceHash: "a8dfe812f53fcb36961bc564396c501ad8a746b23ccaa423c7c09d13cd6b686f"
translatedAt: "2026-10-26T04:38:18.598Z"
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

Los agentes de contratación y de ventas de SES (servicios de ingeniería de sistemas) deben explicar «por qué recomiendan a esta persona» cuando presentan un candidato a una empresa. Sin embargo, el material del que disponen suele limitarse a un currículum y a la impresión que causó la entrevista. Aunque figure «5 años de Java», es imposible transmitir los detalles concretos del trabajo: qué tipo de modificaciones realizó y cómo las fue verificando.

Por otro lado, la «cantidad de actividad», como las contribuciones en GitHub o el recuento de commits, se ha vuelto fácil de inflar con el uso de IA generativa y agentes. El mero volumen ya difícilmente sirve de respaldo para una recomendación. No obstante, si se sintetiza en una sola puntuación, se pierde la información sobre qué se midió, en qué período y sobre qué población base, convirtiéndose en una herramienta de descarte arbitrario. Faltaba «material verificable», tanto para la parte que recomienda como para la recomendada.

## Enfoque

Grift nació en febrero de 2026 como una aplicación web para respaldar las estimaciones en proyectos de desarrollo por encargo. Al indagar en la base de dichas estimaciones, nos dimos cuenta de que el material más fidedigno es el propio historial de Git acumulado por los ingenieros. Por ello, en agosto de 2026 separamos la parte de medición y la convertimos en una herramienta de línea de comandos. En septiembre suspendimos la oferta de la antigua aplicación web y reorientamos el rumbo hacia el apoyo comercial para agencias de contratación y empresas de SES.

En el diseño establecimos de antemano tres compromisos:

- No puntuar: lo que se entrega son valores de inspección; el criterio corresponde a las personas. No se generan puntuaciones compuestas, rankings, aprobados/suspensos ni niveles salariales o jerárquicos; todo valor numérico incluye obligatoriamente numerador y denominador.
- Mismo resultado en cada ejecución: no se utiliza IA (LLM) en la medición. Si el repositorio y la versión son idénticos, cualquier persona que lo ejecute obtendrá exactamente los mismos valores.
- No se envía a ningún sitio: opera únicamente en el ordenador local. La persona decide si comparte o no la información y qué repositorios muestra.

Asimismo, establecimos un código de uso de siete cláusulas que incluye premisas como «no interpretar la ausencia como un factor negativo», «no filtrar ni descartar únicamente por cifras numéricas» y «no medir a terceros sin su consentimiento». Se determinó que cualquier uso que incumpla estas normas no podrá denominarse bajo el nombre del método (TEP: Technical Evidence Pipeline).

## Implementación

Grift CLI extrae únicamente del historial de Git observaciones como las siguientes:

- Distinción de autoría: clasifica de quién es el trabajo mediante 11 categorías, tales como commits propios de la persona, trabajo de otros, bots, artefactos generados o de terceros proveedores, e historial heredado del repositorio original bifurcado.
- Tasa de modificación conjunta de pruebas: proporción de commits que modifican pruebas al mismo tiempo que el código de producción.
- Tasa de reprocesos y retoques: proporción de revisiones y vueltas a tocar archivos editados recientemente (se registra como tendencia; no se utiliza para determinar aptitud).
- Contexto del repositorio: días de trabajo efectivos, número de participantes, cuota del autor con mayor volumen de creación, porcentaje de cambios realizados mediante revisión, etc.

Con `report-v2`, incorporado en la v0.6, se añade una capa para observar la forma de trabajo individual de cada ingeniero. Todas las métricas se presentan con numerador y denominador, y no constituyen una evaluación del perfil profesional ni de la capacidad.

- Áreas de trabajo (`surface_profile`): distribución y recuento de cambios clasificados en 11 categorías: test / docs / CI/CD / platform / data / observability / frontend / backend / config / generados o de proveedores / otros.
- Ritmo de cambios (`change_rhythm`): días con envíos de cambios dentro de los últimos 180 días e intervalos entre envíos (mediana, percentil 90, porcentaje de envíos consecutivos en menos de 2 días y porcentaje de intervalos superiores a 30 días). No refleja horas trabajadas ni nivel de compromiso.
- Forma de verificación (`verification_profile`): proporción de commits que tocan pruebas y sus tipos (unit / integration / e2e / contract / desconocido), así como la proporción de commits de corrección (fix) acompañados de pruebas.
- 4 dimensiones del rol (`role_profile`): domain / work_type / time / process_position; no se simplifican en un único puesto de trabajo. Solo se emite cuando existe una identidad registrada con el consentimiento de la persona.

La contrastación con los requisitos del proyecto también se realiza sin establecer clasificaciones ordenadas. La parte solicitante declara las áreas, la verificación, el ritmo y las entradas necesarias mediante `grift project`, y `grift align` las alinea eje por eje con las observaciones del candidato. Esta comparación se limita a 5 estados: solapamiento (overlap), fuera del rango declarado (outside_declared_range), cero observaciones (observed_zero), no observado (not_observed) y no declarado (not_declared), sin calcular notas globales, clasificaciones ni resultados de selección. Al analizar a nivel de equipo mediante `--team`, únicamente se muestra el número de personas que cumplen los requisitos; para colectivos de menos de 3 personas no se genera el agregado a fin de preservar la identidad individual.

Cuando la población base es inferior a 20, no se muestran porcentajes sino únicamente el número de casos, y lo que no pudo observarse se presenta como «no observado» detallando el motivo, en lugar de «sin experiencia». `grift verify` recalcula un informe guardado bajo las mismas condiciones y devuelve coincidencia, discrepancia o imposibilidad de verificación, lo que permite al receptor comprobar si hubo manipulaciones o inconsistencias.

El método se denomina TEP (Technical Evidence Pipeline, flujo de extracción de evidencia técnica). Consta de cuatro etapas: leer el registro de Git, contar según reglas fijas, añadir a las cifras resultantes el denominador y los motivos de lo no contabilizado, y garantizar que cualquiera pueda repetir el recuento siguiendo el mismo procedimiento. Encontrará una explicación detallada en la [página de TEP](https://griftai.org/tep) dentro del sitio web de Grift.

La correspondencia entre la terminología utilizada en esta página y en griftai.org con respecto a los términos de salida de la CLI es la siguiente:

| Término en el sitio web | Término en la CLI |
|---|---|
| Valor de inspección | observed value (`kind: observed`; incluye valor, unidad y denominador) |
| Tasa de modificación conjunta de pruebas | test co-change |
| Tasa de reprocesos | corrective rework |
| Retoques | path retouch |
| Tasa de permanencia | survival (solo al especificar `--survival`) |
| Contexto del repositorio | context profile |
| Áreas de trabajo, ritmo de cambios y forma de verificación | surface_profile / change_rhythm / verification_profile |

- Repositorio: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- Distribución: PyPI «grift-cli» (`pipx install grift-cli`, Python 3.11 o superior)
- Licencia: MIT
- Notas de la versión: [github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases) (cambios en cada versión)

## Resultados

El 8 de septiembre de 2026 publicamos la versión [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/) en PyPI. Las métricas se verificaron en 117 repositorios públicos, y tanto las comparaciones donde fue posible distinguir como aquellas donde aún no se logró están publicadas en GitHub (se trata de mediciones internas que no han sido auditadas por terceros).

El 25 de octubre de 2026 cotejamos línea por línea el texto del sitio web con la salida de la CLI. Dado que la lista con varias personas (`actor-index`) aparecía ordenada de mayor a menor número de commits a pesar de indicar en las notas que «no se trata de un ranking», cambiamos el orden a orden lexicográfico por ID en la versión [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0), publicada el 26 de octubre de 2026. Se conserva el valor del número de commits. El contexto y los 5 criterios de aceptación fijados para la serie 0.8 se detallan en una [entrada de blog](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/).

Actualmente avanzamos con agencias de empleo y empresas de SES en la preparación de pruebas piloto (PoC) destinadas a fundamentar las razones de recomendación a partir de registros ejecutados localmente por los propios candidatos. Tras analizar los resultados de estas implementaciones de prueba, tenemos como objetivo el lanzamiento de la versión oficial para 2027. Grift también se presenta en [griftai.org](https://griftai.org).

La filosofía de Grift también se expone en artículos de [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) y [note](https://note.com/cor_instrument/n/nd58ba0955317).
