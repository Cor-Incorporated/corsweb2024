---
title: "Grift: el currículum se puede exagerar, pero las pruebas no. El software de código abierto que extrae hechos verificables del historial de git"
description: "Grift es nuestro producto propio para extraer hechos verificables (valores de inspección) y no puntuaciones a partir del historial de git de los ingenieros. Presentamos el diseño y el proceso que nos llevó a pivotar de una aplicación web de apoyo a presupuestos hacia una CLI de código abierto y una solución de soporte para recomendaciones destinada a agencias de empleo y empresas de SES."
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "Agencias de empleo", "SES", "Contratación"]
publishedAt: 2026-06-30
updatedAt: 2026-10-28
summary: "Grift es un producto propio que extrae «hechos verificables» del historial de git de los ingenieros. No asigna puntuaciones ni clasificaciones. Al no utilizar IA (LLM) para la medición, genera el mismo resultado sin importar quién lo ejecute, lo que permite que el receptor verifique los datos. La CLI está disponible como software de código abierto bajo la licencia MIT."
isDraft: false
featured: true
lang: "es"
translationSourceHash: "ed8b2d807036f1d1157b45ef4600db884b5b4e3ba81d095feec7e68f891ccb08"
translatedAt: "2026-10-27T17:18:04.889Z"
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
2026-10-27: 0.9.0 のレポートの形（先頭の進め方の文と面談の問い、本人の同意の条件、観点の呼び名）と、0.9.0 の公開を足した。
2026-10-28: 0.9.1 の公開を「成果」に足した（日付は PyPI に上げた日。#446 の手順で確かめる）。
-->

## El reto

Las agencias de contratación y los comerciales de SES necesitan explicar por qué recomiendan a un candidato concreto al presentarlo a las empresas cliente. Sin embargo, el material del que disponen se limita casi por completo al currículum y a las impresiones de la entrevista. Aunque el documento indique «5 años de experiencia en Java», no transmite la naturaleza real de su trabajo: qué cambios realizaba ni cómo los verificaba a medida que avanzaba.

Por otro lado, la «cantidad de actividad» —como el gráfico de contribuciones de GitHub o el número de commits— ahora puede inflarse fácilmente utilizando IA generativa y agentes. Un volumen elevado ha dejado de servir como base sólida para una recomendación. Al mismo tiempo, reducir todo a una única puntuación borra qué se midió, en qué período y sobre qué muestra base, convirtiéndose en una mera herramienta de criba. Tanto a quienes recomiendan como a quienes son recomendados les faltaban «pruebas contrastables».

## El enfoque

Grift nació en febrero de 2026 como una aplicación web destinada a respaldar las estimaciones en proyectos de desarrollo por encargo. Al buscar fundamentos sólidos para esas estimaciones, nos dimos cuenta de que la prueba más fiable era el propio historial de git acumulado por los desarrolladores. En agosto de 2026, aislamos la parte de medición y la convertimos en una herramienta de línea de comandos. En septiembre suspendimos la oferta de la antigua aplicación web y reorientamos el enfoque para apoyar la labor comercial de agencias de contratación y empresas de SES.

En el diseño, establecimos tres compromisos previos:

- No convertir en puntuaciones: proporcionamos valores de inspección y las personas toman las decisiones. No generamos puntuaciones compuestas, clasificaciones, aptos/no aptos ni rangos; las cifras van siempre acompañadas de numerador y denominador.
- Mismo resultado en cada ejecución: no utilizamos IA (LLM) en la medición. Con el mismo repositorio y la misma versión, cualquier persona que lo ejecute obtendrá exactamente las mismas cifras.
- No se envía a ninguna parte: funciona exclusivamente en el ordenador local. La persona decide libremente si desea compartirlo y qué repositorios mostrar.

Asimismo, establecimos 7 normas de uso que incluyen principios como «no interpretar la ausencia como algo negativo», «no cribar únicamente por cifras» y «no medir a terceros sin su consentimiento». Determinamos que cualquier uso que infrinja estas pautas no podrá denominarse con el nombre del método (TEP: Technical Evidence Pipeline).

## Implementación

Grift CLI extrae observaciones como las siguientes exclusivamente a partir del historial de git:

- Distinción de autoría: clasifica de quién es el trabajo en 11 categorías, como commits propios del desarrollador, trabajo ajeno, bots, artefactos de proveedores/generados e historiales heredados del repositorio bifurcado (fork).
- Tasa de modificación conjunta de pruebas: porcentaje de commits en los que se modifican las pruebas junto con los cambios en el código de producción.
- Tasa de retrabajo y retoque: porcentaje de reintentos o modificaciones adicionales sobre los archivos tocados recientemente (registra una tendencia, no se utiliza para evaluar aptitud).
- Contexto del repositorio: días de actividad real, número de personas implicadas y cuota del autor principal, porcentaje de contribuciones mediante revisión de código, entre otros.

En `report-v2`, añadido en la v0.6, se amplía la capa para observar la forma de trabajo individual del desarrollador. Todos los indicadores incluyen numerador y denominador, y no constituyen una evaluación del perfil ni de la capacidad profesional:

- Áreas de trabajo (`surface_profile`): número de cambios realizados clasificados en 11 áreas: test / docs / CI/CD / platform / data / observability / frontend / backend / config / generados y proveedores / otros.
- Ritmo de cambios (`change_rhythm`): días con envíos de cambios en los últimos 180 días e intervalos entre entregas (mediana y percentil 90, porcentaje de entregas consecutivas en 2 días o menos, y porcentaje de pausas de 30 días o más). No mide horas de trabajo ni nivel de motivación.
- Forma de verificación (`verification_profile`): porcentaje de commits que modificaron pruebas y sus tipos (unit / integration / e2e / contract / desconocido), así como el porcentaje de commits de corrección (fix) acompañados de pruebas.
- Cuatro dimensiones del rol (`role_profile`): se limita a cuatro ejes (domain / work_type / time / process_position) sin encasillarlos en una única categoría profesional. Solo se genera cuando existe una identidad con el consentimiento registrado de la persona.

El cotejo con los requisitos del puesto también se realiza sin clasificaciones ni rankings. El proyecto declara las áreas, la verificación, el ritmo y las entradas que busca mediante `grift project`, y `grift align` alinea las observaciones del candidato por cada eje. Dicha alineación se limita estrictamente a cinco resultados: superposición (overlap), fuera de rango (outside_declared_range), cero casos (observed_zero), no observado (not_observed) y no declarado (not_declared), sin calcular notas globales, clasificaciones ni resultados de apto/no apto. Al analizarse por equipos con `--team`, solo se muestra el número de personas que satisfacen los requisitos; si hay menos de 3 personas, no se agrega para evitar la identificación individual.

Cuando el tamaño de la muestra base es inferior a 20, se muestra únicamente el recuento de casos sin porcentajes. Aquello que no pudo observarse se indica como «no observado» detallando el motivo, nunca como «sin historial». El comando `grift verify` recalcula el informe guardado bajo las mismas condiciones y devuelve coincidencia, discrepancia o imposibilidad de verificación, lo que permite al receptor comprobar si ha habido manipulaciones o incongruencias.

A partir de la versión 0.9.0, al inicio del Markdown generado por `grift actor` se redacta una breve descripción del método de trabajo deducido de los registros. Se detallan, junto con el número de casos y el período, las áreas modificadas, el ritmo de cambios, la cobertura de pruebas y la forma de implicación; a continuación se indica qué aspectos no pueden apreciarse a través de estos registros y se sugieren preguntas para profundizar en la entrevista. En `grift project` se describe la dinámica de trabajo del repositorio del proyecto con las mismas pautas, sin incluir métricas individuales ni la forma de implicación por persona. En `grift align` se complementa la comparativa entre requisitos y registros con preguntas orientadas a la entrevista. Tanto las descripciones como las preguntas se seleccionan a partir de cifras mediante una [tabla de decisión](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/trait-profile.md) pública, sin recurrir a la IA. No se incluyen en el JSON, por lo que lo verificable mediante `grift verify` son los datos numéricos que originaron el texto.

Los textos y preguntas sobre una persona solo se muestran si corresponden a una identidad declarada por ella misma y si consta su consentimiento. En cualquier otro caso, se incluye una frase explicando el motivo por el que no se muestran. Cuando se visualizan varias personas de forma conjunta (`--all`, `--top`), no se incluyen estos textos.

El método se denomina TEP (Technical Evidence Pipeline, flujo de extracción de pruebas técnicas). Consta de cuatro fases: leer el historial de git, contar según reglas predefinidas, añadir a los valores calculados su denominador y los motivos de lo que no pudo contabilizarse, y garantizar que cualquier persona pueda repetir el cálculo siguiendo el mismo procedimiento. La explicación detallada se encuentra en la [página sobre TEP](https://griftai.org/tep) del sitio web de Grift.

La correspondencia entre los términos empleados en esta página y en griftai.org y los utilizados en la salida de la CLI es la siguiente:

| Término en el sitio | Término en la CLI |
|---|---|
| Valores de inspección | observed value (`kind: observed`; incluye valor, unidad y denominador) |
| Tasa de modificación conjunta de pruebas | test co-change |
| Tasa de retrabajo | corrective rework |
| Retoque | path retouch |
| Code recency | survival (solo al especificar `--survival`) |
| Contexto del repositorio | context profile |
| Áreas de trabajo, ritmo de cambios y forma de verificación | surface_profile / change_rhythm / verification_profile |

A partir de la versión 0.9.0, el Markdown de la CLI también utiliza la misma terminología que griftai.org para las cuatro perspectivas: áreas modificadas (áreas de trabajo), ritmo de cambios (ritmo de cambios), cobertura de pruebas (forma de verificación) y forma de implicación. Las claves del JSON permanecen sin cambios.

- Repositorio: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- Distribución: PyPI «grift-cli» (`pipx install grift-cli`, Python 3.11 o superior)
- Licencia: MIT
- Notas de la versión: [github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases) (cambios entre versiones)

## Resultados

El 8 de septiembre de 2026 publicamos la [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/) en PyPI. Las métricas se validaron en 117 repositorios públicos, y publicamos en GitHub tanto las comparaciones que permitieron establecer diferencias como aquellas en las que todavía no fue posible (mediciones internas, sin auditoría de terceros).

El 25 de octubre de 2026 cotejamos línea por línea el contenido del sitio web con la salida de la CLI. Detectamos que el listado de múltiples personas (`actor-index`) se ordenaba de mayor a menor número de commits, a pesar de que la nota aclaratoria indicaba «no constituye una clasificación». Por ello, en la versión [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0), publicada el 26 de octubre de 2026, modificamos el orden alfabético por ID, manteniendo el valor del número de commits. Los antecedentes y los cinco criterios de aceptación fijados para la serie 0.8 se detallan en esta [entrada del blog](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/).

En la versión [0.9.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0), publicada el 27 de octubre de 2026, incorporamos el texto inicial y las preguntas para la entrevista en los informes antes descritos. Asimismo, retiramos del Markdown la línea referida a la «intensidad» de las tendencias y la línea de «adecuación» en el cotejo, ya que al comparar dos informes podían interpretarse erróneamente como personas más o menos capaces, o personas adecuadas o no adecuadas. También corregimos cuatro puntos en los que podían generarse cifras inexactas sobre las personas.

En la versión [0.9.1](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.1), publicada el 28 de octubre de 2026, corregimos fallos detectados tras la 0.9.0 que podían dar lugar a cifras inexactas relativas a personas o proyectos. No se añadieron nuevos comandos y se mantiene la política de no emitir puntuaciones, clasificaciones ni etiquetas de perfil. Debido al cambio en la versión de las definiciones, los informes guardados con la 0.9.0 no pueden verificarse mediante el `grift verify` de la versión 0.9.1.

Actualmente estamos preparando pruebas piloto (PoC) en colaboración con agencias de contratación y empresas de SES para concretar las razones de recomendación a partir de registros generados localmente por los propios candidatos. También atendemos consultas de responsables de selección de empresas de desarrollo propio interesados en realizar pruebas piloto (PoC) para verificar la trayectoria profesional a partir de los datos compartidos por los candidatos. Con base en los resultados de estas pruebas piloto, nuestro objetivo es poner en marcha el servicio oficial en 2027. Grift también se presenta en [griftai.org](https://griftai.org).

Asimismo, explicamos la filosofía de Grift en nuestros artículos de [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) y [note](https://note.com/cor_instrument/n/nd58ba0955317).
