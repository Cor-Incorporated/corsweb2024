---
title: "Grift: el currículum se puede inflar; las pruebas, no. Software de código abierto (OSS) para extraer hechos verificables a partir del historial de git"
description: "Grift, nuestro producto propio para extraer hechos verificables (valores de inspección) en lugar de puntuaciones a partir del historial de git de los ingenieros. Presentamos el diseño y el proceso que nos llevó a pivotar desde una aplicación web de apoyo a la estimación hacia una CLI de código abierto (OSS) y una solución de soporte para la recomendación dirigida a agencias de empleo y empresas SES."
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "Agencias de empleo", "SES", "Contratación"]
publishedAt: 2026-06-30
updatedAt: 2026-10-27
summary: "Grift es un producto propio que extrae «hechos verificables» a partir del historial de git de los ingenieros. No asigna puntuaciones ni clasificaciones. Dado que no utiliza IA (LLM) para la medición, produce el mismo resultado independientemente de quién lo ejecute, permitiendo que la parte receptora verifique los cálculos. La CLI está publicada como OSS bajo la licencia MIT."
isDraft: false
featured: true
lang: "es"
translationSourceHash: "2d0234e5c92330288c63b5013c89e63f3ced54357eaa2a69eb5d59ba4b7873bc"
translatedAt: "2026-10-27T13:43:43.055Z"
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

Los agentes de contratación de personal y los comerciales de SES necesitan explicar "por qué recomiendan a esta persona" cuando presentan candidatos a las empresas. Sin embargo, la mayor parte del material disponible se limita a los currículos y a las impresiones de las entrevistas. Aunque ponga "5 años de Java", no se transmite la naturaleza real del trabajo: qué tipo de cambios se realizaron y cómo se fueron verificando a lo largo del proceso.

Por otra parte, la "cantidad de actividad", como el gráfico de contribuciones de GitHub o el recuento de commits, se ha vuelto fácil de inflar mediante IA generativa o agentes. Un volumen elevado ya no sirve de base para una recomendación. Al mismo tiempo, reducir todo a una única puntuación borra qué se midió, en qué período y sobre qué población base, convirtiéndose en una herramienta de criba excluyente. Tanto a quienes recomiendan como a quienes son recomendados les faltaban "materiales verificables".

## Nuestro enfoque

Grift comenzó en febrero de 2026 como una aplicación web para respaldar las estimaciones en proyectos de desarrollo por encargo. Mientras buscábamos la base de dichas estimaciones, nos dimos cuenta de que el material más fidedigno era el propio historial de Git acumulado por los ingenieros. En agosto de 2026 separamos la parte de medición en una herramienta de línea de comandos. En septiembre dejamos de ofrecer la antigua aplicación web y cambiamos de rumbo para prestar apoyo a las agencias de contratación y a las ventas de SES.

En el diseño establecimos tres compromisos previos:

- No convertir en puntuaciones: lo que se emite son valores de inspección y quien juzga es una persona. No se generan puntuaciones compuestas, clasificaciones, aprobados/suspensos ni niveles; a cada valor numérico se le añaden siempre numerador y denominador.
- Mismo resultado en cada ejecución: no se utiliza IA (LLM) para la medición. Con el mismo repositorio y la misma versión, cualquiera que lo ejecute obtendrá exactamente las mismas cifras.
- No enviar a ninguna parte: funciona únicamente en el ordenador local. La persona en cuestión decide si comparte los datos y qué repositorios muestra.

Asimismo, establecimos 7 normas de uso que incluyen principios como "no interpretar la ausencia como algo negativo", "no realizar cribas basándose únicamente en cifras" y "no medir a terceros sin su consentimiento", disponiendo que cualquier uso que las incumpla no podrá denominarse con el nombre de la metodología (TEP: Technical Evidence Pipeline).

## Implementación

Grift CLI extrae las siguientes observaciones exclusivamente a partir del historial de Git:

- Distinción de autoría: clasifica de quién es el trabajo en 11 categorías, como commits propios de la persona, trabajo de terceros, bots, artefactos generados/de proveedores e historiales heredados del fork de origen.
- Tasa de modificación conjunta de pruebas: porcentaje en el que se modifican también las pruebas en el mismo commit en que se cambia el código de producción.
- Tasa de retrabajo y retoque: porcentaje de repetición o reintervención sobre archivos tocados recientemente (registro de tendencias, no se utiliza para determinar aptitud o no aptitud).
- Contexto del repositorio: días de actividad real, número de personas implicadas y cuota del autor principal, porcentaje realizado mediante revisiones, entre otros.

En `report-v2`, añadido en la v0.6, se incorpora una capa para examinar la forma de trabajo de un ingeniero individual. Todas van acompañadas de numerador y denominador, y no constituyen una evaluación de la ocupación ni de las capacidades.

- Áreas de trabajo (`surface_profile`): cuántos cambios hubo en cada área, repartidos en 11 categorías: test / docs / CI/CD / platform / data / observability / frontend / backend / config / generados o proveedores / otros.
- Ritmo de cambios (`change_rhythm`): número de días en los que se enviaron cambios en los últimos 180 días e intervalos entre envíos (mediana y percentil 90, porcentaje consecutivos en 2 días o menos, porcentaje con una separación de 30 días o más). No representan horas de trabajo ni nivel de motivación.
- Forma de verificación (`verification_profile`): proporción de commits en los que se tocaron pruebas y sus tipos (unit / integration / e2e / contract / desconocido), así como la proporción de commits de corrección (fix) acompañados de pruebas.
- 4 dimensiones de rol (`role_profile`): solo domain / work_type / time / process_position; no se reducen a un único puesto de trabajo. Solo se emiten cuando existe una identidad con el consentimiento registrado de la propia persona.

El cotejo con los requisitos del proyecto también se realiza sin establecer clasificaciones. El lado del proyecto declara las áreas, la verificación, el ritmo y las entradas requeridas mediante `grift project`, y `grift align` las alinea con las observaciones del candidato en cada eje. La correspondencia se limita a 5 posibilidades: solapamiento (overlap), fuera del rango declarado (outside_declared_range), cero casos (observed_zero), no observado (not_observed) y no declarado (not_declared); no se calculan puntuaciones globales, clasificaciones ni resultados de aprobado/suspenso. Al examinar a nivel de equipo mediante `--team`, solo se muestra el número de personas que cumplen los requisitos, y no se realiza agregación si son menos de 3 personas para evitar la identificación individual.

Si la población base es inferior a 20, no se muestran porcentajes sino únicamente el número de casos, y lo que no pudo observarse se emite como "no observado" con su motivo, no como "sin historial". `grift verify` recalcula el informe guardado bajo las mismas condiciones y devuelve coincidencia, discrepancia o no verificable, de modo que el destinatario puede comprobar si hubo alteraciones o incoherencias.

A partir de la versión 0.9.0, al principio del Markdown de `grift actor`, `grift project` y `grift align` se describe en frases breves la forma de trabajar que se desprende del registro. Se redacta indicando el desglose de las partes modificadas, el ritmo de cambios, la forma de añadir pruebas y el modo de participación, acompañados del número de casos y el período; a continuación, se señala lo que no se aprecia en dicho registro y se enumeran en forma de preguntas los aspectos que conviene contrastar en una entrevista. Las frases se seleccionan a partir de cifras mediante una [tabla de decisión](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/trait-profile.md) pública. No se utiliza IA ni se incluye en el JSON.

Las frases y preguntas relativas a una persona solo se emiten con el ID declarado por ella misma y cuando existe un registro de consentimiento. En caso contrario, se indica en una sola frase el motivo por el cual no se emiten. Al mostrar a varias personas de forma conjunta (`--all`, `--top`), no se emiten frases.

El nombre de la metodología es TEP (Technical Evidence Pipeline, flujo para extraer evidencias técnicas). Consta de cuatro etapas: leer el registro de Git, realizar el recuento con reglas fijas, añadir al valor contabilizado el denominador y los motivos de lo que no pudo contarse, y permitir que cualquiera pueda volver a realizar el recuento siguiendo el mismo procedimiento. La explicación detallada se encuentra en la [página de TEP](https://griftai.org/tep) del sitio web de Grift.

A continuación se muestra la correspondencia entre los términos utilizados en esta página y en griftai.org y los términos emitidos por la CLI:

| Término en el sitio | Término en la CLI |
|---|---|
| Valores de inspección | observed value (`kind: observed`; se añaden valor, unidad y denominador) |
| Tasa de modificación conjunta de pruebas | test co-change |
| Tasa de retrabajo | corrective rework |
| Retoque | path retouch |
| Code recency | survival (solo al especificar `--survival`) |
| Contexto del repositorio | context profile |
| Áreas de trabajo, ritmo de cambios, forma de verificación | surface_profile / change_rhythm / verification_profile |

A partir de la versión 0.9.0, el Markdown de la CLI también utiliza para las cuatro perspectivas —desglose de las partes modificadas (áreas de trabajo), ritmo de cambios (ritmo de cambios), forma de añadir pruebas (forma de verificación) y modo de participación— las mismas denominaciones que en griftai.org. Las claves del JSON no cambian.

- Repositorio: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- Distribución: PyPI «grift-cli» (`pipx install grift-cli`, Python 3.11 o superior)
- Licencia: MIT
- Notas de la versión: [github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases) (cambios en cada versión)

## Resultados

El 8 de septiembre de 2026 publicamos la [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/) en PyPI. Las métricas se verificaron en 117 repositorios públicos, y en GitHub se han hecho públicas tanto las comparaciones que se pudieron diferenciar como aquellas que aún no (medición interna, no auditada por terceros).

El 25 de octubre de 2026 cotejamos línea por línea el texto del sitio web con la salida de la CLI. Dado que la lista de múltiples personas (`actor-index`) aparecía ordenada por orden descendente de número de commits a pesar de que en las notas se indicaba "no es una clasificación", en la versión [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0), publicada el 26 de octubre de 2026, se modificó el orden alfabético por ID. Se conservó el valor del número de commits. El contexto y los 5 criterios de aceptación fijados para la serie 0.8 se detallan en el [artículo del blog](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/).

En la versión [0.9.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0), publicada el 27 de octubre de 2026, añadimos las frases iniciales y las preguntas para la entrevista en los informes antes descritos. Al mismo tiempo, eliminamos del Markdown la línea de "intensidad" de las tendencias y la de "orientación" en el cotejo, ya que al colocar dos informes uno al lado del otro podrían interpretarse como personas fuertes o débiles, o personas que encajan o no encajan. También se corrigieron 4 puntos donde podían generarse cifras sobre personas que no correspondían con los hechos.

Actualmente estamos preparando, junto con agencias de contratación y empresas de SES, pruebas de concepto (PoC) para concretar los motivos de recomendación a partir de registros ejecutados localmente por los propios candidatos. También atendemos consultas de responsables de selección de empresas con desarrollo propio que deseen realizar pruebas de concepto (PoC) para comprobar, a partir de registros compartidos por los propios candidatos, qué clase de trabajo han venido realizando. En cuanto a la versión oficial, nuestro objetivo es comenzar a ofrecerla en 2027 tomando en cuenta los resultados de las pruebas de concepto. Grift se presenta también en [griftai.org](https://griftai.org).

La filosofía de Grift también se expone en artículos de [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) y [note](https://note.com/cor_instrument/n/nd58ba0955317).
