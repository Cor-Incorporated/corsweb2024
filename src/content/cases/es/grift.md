---
title: "Grift — El currículum se puede exagerar. La evidencia no. El OSS que extrae hechos verificables del historial de git"
description: "Grift, nuestro producto propio que extrae hechos verificables (valores de inspección) en lugar de puntuaciones a partir del historial de git de los ingenieros. Presentamos el diseño y el proceso por el cual cambiamos el rumbo desde una aplicación web de apoyo a estimaciones hacia una CLI de OSS y el soporte de recomendaciones para agencias de empleo y empresas de SES."
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "Reclutamiento y selección", "SES", "Contratación"]
publishedAt: 2026-06-30
updatedAt: 2026-10-27
summary: "Grift es un producto propio que extrae «hechos verificables» del historial de git de los ingenieros. No asigna puntuaciones ni clasificaciones. Al no utilizar IA (LLM) para la medición, produce el mismo resultado sin importar quién lo ejecute, lo que permite que el receptor verifique los cálculos. La CLI está disponible públicamente como OSS bajo la licencia MIT."
isDraft: false
featured: true
lang: "es"
translationSourceHash: "da19a3405dd6186a0445998301689944702384c944e88e2a060326cfa32ee36d"
translatedAt: "2026-10-27T13:52:17.077Z"
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
-->

## El problema

Las agencias de colocación y los comerciales de SES necesitan explicar "por qué recomiendan a esta persona" cuando presentan a un candidato a una empresa. Sin embargo, los únicos materiales con los que cuentan son, en su mayoría, el currículum y las impresiones de la entrevista. Aunque ponga "5 años de Java", no se transmite el contenido real del trabajo: qué tipo de cambios se hicieron ni cómo se fueron verificando a lo largo del proceso.

Por otra parte, la "cantidad de actividad", como el historial de actividad de GitHub o el número de commits, se ha vuelto fácil de inflar mediante IA generativa y agentes. Un volumen elevado ya apenas sirve como justificación para una recomendación. Al mismo tiempo, si se sintetiza en una sola puntuación, se pierde la información sobre qué se midió, en qué período y sobre qué población base, convirtiéndose en un simple filtro eliminatorio. Faltaban "materiales contrastables", tanto para quienes recomiendan como para quienes son recomendados.

## Nuestro enfoque

Grift comenzó en febrero de 2026 como una aplicación web concebida para respaldar las estimaciones de proyectos de desarrollo por encargo. Mientras buscábamos fundamentos fiables para las estimaciones, nos dimos cuenta de que el material más certero era el propio historial de git acumulado por los ingenieros, por lo que en agosto de 2026 extrajimos la parte de medición en forma de herramienta de línea de comandos. En septiembre suspendimos la oferta de la antigua aplicación web y reorientamos el rumbo hacia el apoyo a comerciales de agencias de colocación y de SES.

En el diseño establecimos tres compromisos previos:

- No puntuar: lo que se emite son valores de inspección y quien juzga es una persona. No emitimos puntuaciones compuestas, clasificaciones, aprobados/suspensos ni niveles; a cada cifra se le añaden siempre el numerador y el denominador.
- Mismo resultado en cada ejecución: no utilizamos IA (LLM) para la medición. En el mismo repositorio y con la misma versión, cualquier persona que lo ejecute obtendrá exactamente las mismas cifras.
- No se envía a ninguna parte: funciona exclusivamente en el ordenador local. La persona interesada decide si desea compartirlo y qué repositorios mostrar.

Al mismo tiempo, fijamos un código de uso de siete cláusulas que incluye premisas como "no interpretar la ausencia de datos como algo negativo", "no filtrar candidatos basándose únicamente en cifras" y "no medir a terceros sin su consentimiento", estableciendo la norma de no denominar con el nombre de la metodología (TEP: Technical Evidence Pipeline) a aquellos usos que no las respeten.

## Implementación

Grift CLI extrae observaciones como las siguientes a partir únicamente del historial de git:

- Distinción de atribución: separa de quién es el trabajo mediante 11 clasificaciones, tales como commits propios de la persona, trabajo de terceros, bots, artefactos generados o de proveedores e historiales heredados de bifurcaciones (forks).
- Tasa de modificación conjunta de pruebas: porcentaje de modificaciones en las que las pruebas se cambian dentro del mismo commit que el código de producción.
- Tasa de retrabajo y retoque: porcentaje de rehaceres o nuevos contactos con archivos modificados recientemente (es un registro de tendencias y no se emplea para determinar aptitud).
- Contexto del repositorio: días de actividad real, número de personas implicadas y cuota del autor principal, porcentaje canalizado a través de revisiones, entre otros.

En `report-v2`, añadido en la v0.6, se ha ampliado la capa que observa la forma de trabajar de un ingeniero individual. Todo ello acompañado de numerador y denominador, sin constituir una evaluación de competencias ni de perfiles profesionales.

- Áreas de trabajo (`surface_profile`): número de cambios realizados en cada ámbito, desglosado en 11 categorías: test / docs / CI/CD / platform / data / observability / frontend / backend / config / generados o de proveedores / otros.
- Ritmo de cambios (`change_rhythm`): número de días en los que se enviaron cambios en los últimos 180 días e intervalos entre entregas (mediana y percentil 90, porcentaje de entregas consecutivas en 2 días o menos, porcentaje de pausas de 30 días o más). No mide las horas de trabajo ni la motivación.
- Forma de verificación (`verification_profile`): porcentaje de commits que afectaron a pruebas y sus tipos (unit / integration / e2e / contract / desconocido), así como el porcentaje de commits de corrección (fix) acompañados de pruebas.
- 4 dimensiones del rol (`role_profile`): solo domain / work_type / time / process_position, sin sintetizarlas en un único perfil profesional. Se emiten únicamente cuando existe una identidad con el consentimiento registrado de la propia persona.

El cotejo con los requisitos de la vacante también se realiza sin establecer clasificaciones. La parte demandante declara los ámbitos, la verificación, el ritmo y las entradas que busca en `grift project`, y `grift align` los alinea eje por eje con las observaciones del candidato. Dicha alineación consta únicamente de cinco posibilidades: solapamiento (overlap), fuera del rango declarado (outside_declared_range), cero observado (observed_zero), no observado (not_observed) y no declarado (not_declared); no se calculan puntuaciones globales, clasificaciones ni resultados de aptitud. Al examinar a nivel de equipo mediante `--team`, solo se muestra el número de personas que satisfacen los requisitos y, para menos de tres personas, no se realiza la agregación con el fin de evitar la identificación individual.

Cuando la población base es inferior a 20, no se muestran porcentajes sino únicamente el recuento, y lo que no pudo observarse se presenta, con su motivo correspondiente, como "no observado" en lugar de "sin experiencia". `grift verify` recalcula el informe guardado bajo las mismas condiciones y devuelve coincidencia, discrepancia o imposibilidad de verificación, lo que permite a la parte receptora comprobar posibles manipulaciones o discordancias.

A partir de la versión 0.9.0, al principio del Markdown de `grift actor` se redacta con frases breves la forma de trabajar que se desprende del registro. Se describe la tipología de las partes modificadas, el ritmo de los cambios, la forma de añadir pruebas y el modo de involucrarse, indicando el número de casos y el período; a continuación, se señala lo que no puede apreciarse a partir de este registro y se enumeran, en forma de preguntas, los aspectos que conviene contrastar en una entrevista. `grift project` describe la dinámica del repositorio de la vacante bajo las mismas reglas, sin mostrar las cifras individuales ni el modo de involucrarse de cada persona. `grift align` añade a la correspondencia entre requisitos y registros las preguntas que conviene contrastar en la entrevista. Los textos y las preguntas se seleccionan a partir de las cifras mediante una [tabla de decisión](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/trait-profile.md) pública, sin recurrir a IA. Al no incluirse en el JSON, lo que puede verificarse mediante `grift verify` son precisamente las cifras en las que se fundamentan los textos.

Los textos y preguntas relativos a una persona solo se emiten bajo un ID declarado por ella misma y cuando existe un registro de consentimiento. De lo contrario, se indica en una sola frase el motivo por el cual no se han emitido. Al presentar a varias personas agrupadas (`--all`, `--top`), no se emiten estos textos.

El nombre de la metodología es TEP (Technical Evidence Pipeline, flujo de extracción de evidencias técnicas). Consta de cuatro etapas: leer los registros de git, realizar el cómputo según reglas predeterminadas, asociar a los valores calculados su denominador y los motivos de aquello que no pudo computarse, y permitir que cualquiera pueda recalcularlos siguiendo el mismo procedimiento. Encontrará una explicación detallada en la [página de TEP](https://griftai.org/tep) del sitio web de Grift.

La correspondencia entre la terminología empleada en esta página y en griftai.org y los términos emitidos en la salida de la CLI es la siguiente:

| Terminología del sitio web | Término en la CLI |
|---|---|
| Valores de inspección | observed value (`kind: observed`; se acompañan de valor, unidad y denominador) |
| Tasa de modificación conjunta de pruebas | test co-change |
| Tasa de retrabajo | corrective rework |
| Retoque | path retouch |
| Code recency | survival (solo al especificar `--survival`) |
| Contexto del repositorio | context profile |
| Áreas de trabajo, ritmo de cambios y forma de verificación | surface_profile / change_rhythm / verification_profile |

A partir de la versión 0.9.0, el Markdown de la CLI también redacta las cuatro perspectivas —la tipología de las partes modificadas (áreas de trabajo), el ritmo de los cambios (ritmo de cambios), la forma de añadir pruebas (forma de verificación) y el modo de involucrarse— empleando las mismas denominaciones que griftai.org. Las claves del JSON no sufren cambios.

- Repositorio: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- Distribución: PyPI "grift-cli" (`pipx install grift-cli`, Python 3.11 o superior)
- Licencia: MIT
- Notas de la versión: [github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases) (cambios en cada versión)

## Resultados

El 8 de septiembre de 2026 publicamos la [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/) en PyPI. Las métricas se validaron en 117 repositorios públicos, y tanto las comparaciones que permitieron establecer distinciones como las que todavía no lo lograron están publicadas en GitHub (se trata de mediciones internas que no han sido sometidas a auditoría de terceros).

El 25 de octubre de 2026 cotejamos línea por línea el redactado del sitio web con la salida de la CLI. Dado que la lista colectiva de personas (`actor-index`) se ordenaba de mayor a menor número de commits a pesar de indicar en las notas que "no constituía una clasificación", en la versión [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0), publicada el 26 de octubre de 2026, modificamos la ordenación a orden alfabético por ID. El valor del recuento de commits se mantiene. Los antecedentes y los cinco criterios de aceptación fijados para la serie 0.8 se detallan en el [artículo del blog](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/).

En la versión [0.9.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0), publicada el 27 de octubre de 2026, añadimos los textos iniciales de los informes y las preguntas para la entrevista mencionados anteriormente. Asimismo, retiramos del Markdown la línea relativa a la "fuerza" de la tendencia y la correspondiente al "sentido" del cotejo, puesto que al contrastar dos informes podían interpretarse como personas fuertes o débiles, o bien como personas adecuadas o inadecuadas. También corregimos cuatro puntos en los que podían generarse cifras discordantes con los hechos en relación con una persona.

En la actualidad, estamos preparando pruebas de concepto (PoC) junto a empresas de selección de personal y de SES para fundamentar con datos concretos los motivos de recomendación a partir de registros ejecutados localmente por los propios candidatos. Asimismo, atendemos consultas de responsables de selección de empresas de desarrollo propio interesadas en realizar pruebas de concepto (PoC) para contrastar, a partir de los registros compartidos por los propios candidatos, qué tipo de trabajo han venido realizando. Prevemos iniciar la oferta de la versión definitiva en 2027, en función de los resultados de las pruebas de concepto. Grift también se presenta en [griftai.org](https://griftai.org).

Los fundamentos y la filosofía de Grift se presentan también en sendos artículos en [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) y [note](https://note.com/cor_instrument/n/nd58ba0955317).
