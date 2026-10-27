---
title: "Grift: el currículum se puede inflar; las pruebas, no. Software de código abierto (OSS) para extraer hechos verificables a partir del historial de git"
description: "Grift es nuestro producto propio para extraer hechos verificables (valores de inspección), y no puntuaciones, a partir del historial de git de los ingenieros. Presentamos el diseño y el proceso que nos llevó a cambiar el rumbo desde una aplicación web de estimaciones hacia una CLI de OSS y el apoyo a recomendaciones para agencias de empleo y empresas de SES."
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "agencias de empleo", "SES", "contratación"]
publishedAt: 2026-06-30
updatedAt: 2026-10-27
summary: "Grift es un producto propio que extrae «hechos verificables» del historial de git de los ingenieros. No asigna puntuaciones ni clasificaciones. Al no utilizar IA (LLM) para la medición, produce los mismos resultados sin importar quién lo ejecute, permitiendo que quien los reciba pueda verificarlos. La CLI está disponible como software de código abierto (OSS) bajo la licencia MIT."
isDraft: false
featured: true
lang: "es"
translationSourceHash: "243d83e70e58999eaaf5f0fa0c07149254f208dd3d4884fc32eb667b1ca2c839"
translatedAt: "2026-10-27T13:35:32.752Z"
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

## El desafío

Los agentes de contratación de personal y los comerciales de SES (servicios de ingeniería de sistemas) necesitan explicar «por qué recomiendan a esta persona» al presentar candidatos a las empresas. Sin embargo, el material del que disponen suele limitarse al currículum y a las impresiones de una entrevista. Aunque ponga «5 años de Java», no se transmite la verdadera naturaleza del trabajo: qué tipo de modificaciones ha realizado y de qué manera las ha ido verificando.

Por otra parte, el «volumen de actividad», como el gráfico de contribuciones de GitHub o el recuento de commits, se ha vuelto fácil de engordar mediante IA generativa y agentes. La mera cantidad ya casi no sirve como fundamento para una recomendación. Al mismo tiempo, si todo se reduce a una única puntuación, desaparece el detalle de qué se midió, en qué período y sobre qué población base, convirtiéndose en una mera herramienta de descarte. Faltaba «material verificable», tanto para quienes recomiendan como para quienes son recomendados.

## El enfoque

Grift comenzó en febrero de 2026 como una aplicación web destinada a respaldar las estimaciones en proyectos de desarrollo subcontratados. Al buscar los fundamentos de dichas estimaciones, nos dimos cuenta de que el material más certero era el propio historial de git acumulado por los ingenieros, y en agosto de 2026 extrajimos la parte de medición como una herramienta de línea de comandos. En septiembre dejamos de ofrecer la antigua aplicación web y reorientamos nuestro rumbo para dar soporte a los comerciales de agencias de empleo y de SES.

En el diseño establecimos tres compromisos previos:

- No convertirlo en una puntuación: lo que se emite son valores de inspección y quien juzga es una persona. No se generan puntuaciones compuestas, rankings, aprobados/suspensos ni niveles, y a los valores numéricos siempre se les añade numerador y denominador.
- Mismo resultado en cada ejecución: no se utiliza IA (LLM) para la medición. Con el mismo repositorio y la misma versión, cualquiera que lo ejecute obtendrá exactamente las mismas cifras.
- No se envía a ninguna parte: funciona exclusivamente en el PC local. La propia persona decide si desea compartirlo y qué repositorios mostrar.

Asimismo, establecimos un código de conducta de 7 artículos («no interpretar la ausencia como algo negativo», «no hacer descartes basándose únicamente en números», «no medir a terceros sin su consentimiento», entre otros) y determinamos que cualquier uso que no lo respete no podrá denominarse con el nombre de la metodología (TEP: Technical Evidence Pipeline).

## La implementación

Grift CLI extrae observaciones como las siguientes únicamente a partir del historial de git:

- Distinción de autoría: categoriza de quién es el trabajo en 11 clasificaciones, tales como commits propios, trabajo de otros, bots, artefactos generados o de proveedores, o historiales heredados de un fork.
- Tasa de modificación conjunta de pruebas: proporción en la que se modifican también los tests en el mismo commit que introduce cambios en el código de producción.
- Tasa de retrabajo y retoque: proporción de correcciones o reintervenciones sobre archivos tocados recientemente (es un registro de tendencias y no se emplea para determinar aptitudes).
- Contexto del repositorio: días de trabajo efectivo, número de personas implicadas, cuota de autoría del creador principal, porcentaje a través de revisiones de código, etc.

Con `report-v2`, añadido en la versión v0.6, se amplían las capas que permiten ver la forma de trabajar de un ingeniero individual. Todas ellas van acompañadas de numerador y denominador, y no constituyen una evaluación del puesto ni de la capacidad:

- Áreas de trabajo (`surface_profile`): número de modificaciones por área entre 11 categorías: test / docs / CI/CD / platform / data / observability / frontend / backend / config / generados y proveedores / otros.
- Ritmo de cambios (`change_rhythm`): días en los que se enviaron cambios dentro de los últimos 180 días e intervalos de envío (mediana y percentil 90, proporción de envíos sucesivos en menos de 2 días y proporción de pausas de 30 días o más). No representa horas de trabajo ni motivación.
- Forma de verificación (`verification_profile`): proporción de commits en los que se tocaron tests y su tipología (unit / integration / e2e / contract / desconocido), así como la proporción de commits de corrección (fix) acompañados de tests.
- 4 dimensiones del rol (`role_profile`): se estructura únicamente en cuatro ejes: domain / work_type / time / process_position, sin sintetizarlos en un único título de puesto. Solo se emite cuando existe una identidad con el consentimiento registrado de la persona.

El cotejo con los requerimientos del proyecto también se realiza sin establecer clasificaciones jerárquicas. El lado del proyecto declara en `grift project` las áreas, la verificación, el ritmo y las entradas requeridas, y `grift align` las contrasta eje por eje con las observaciones del candidato. Dicha correspondencia solo contempla cinco estados: solapamiento (overlap), fuera del rango declarado (outside_declared_range), cero casos observados (observed_zero), no observado (not_observed) y no declarado (not_declared), sin calcular puntuaciones globales, clasificaciones ni resultados de aprobado/suspenso. Cuando se evalúa a nivel de equipo mediante `--team`, solo se muestra el número de personas que satisfacen los requerimientos, omitiendo el cómputo si hay menos de 3 personas para evitar la identificación individual.

Si la población base es inferior a 20, no se muestran tasas sino únicamente el recuento de casos, y aquello que no pudo ser observado no se reporta como «sin experiencia», sino como «no observado» junto con su motivo. `grift verify` recalcula los informes guardados bajo las mismas condiciones y devuelve coincidencia, discrepancia o no verificable, lo que permite a la parte receptora comprobar posibles alteraciones o inconsistencias.

A partir de la versión 0.9.0, al principio del Markdown de `grift actor`, `grift project` y `grift align` se redacta en breves frases la forma de trabajar que se desprende del registro. Se describen las categorías de las partes modificadas, el ritmo de cambios, la manera de incorporar tests y la forma de implicación, indicando el número de casos y el período, seguido de una serie de preguntas que señalan lo que este registro no permite ver y lo que convendría confirmar en una entrevista. Las frases se seleccionan a partir de cifras mediante una [tabla de decisión](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/trait-profile.md) pública. No se utiliza IA ni se incluye en el JSON.

Las frases y preguntas relativas a una persona se emiten exclusivamente cuando se trata de un identificador declarado por ella misma y existe constancia de su consentimiento. En cualquier otro caso, se redacta en una sola frase el motivo por el que no se muestran. Cuando se presenta a varias personas de forma conjunta (`--all`, `--top`), no se emiten estas frases.

El nombre de la metodología es TEP (Technical Evidence Pipeline, flujo de extracción de evidencias técnicas). Consta de cuatro etapas: leer el historial de git, contabilizar según reglas predefinidas, añadir a los valores obtenidos el denominador y el motivo de lo que no pudo contabilizarse, y permitir que cualquiera pueda recalcularlo siguiendo el mismo procedimiento. Encontrará una explicación detallada en la [página de TEP](https://griftai.org/tep) dentro del sitio de Grift.

La correspondencia entre las expresiones utilizadas en esta página y en griftai.org y los términos que la CLI muestra en su salida es la siguiente:

| Expresión en el sitio web | Término en la CLI |
|---|---|
| Valores de inspección | observed value (`kind: observed`; incluye valor, unidad y denominador) |
| Tasa de modificación conjunta de pruebas | test co-change |
| Tasa de retrabajo | corrective rework |
| Retoque | path retouch |
| Code recency | survival (solo al especificar `--survival`) |
| Contexto del repositorio | context profile |
| Áreas de trabajo, ritmo de cambios y forma de verificación | surface_profile / change_rhythm / verification_profile |

A partir de la versión 0.9.0, el Markdown de la CLI también redacta los cuatro aspectos —la categoría de las partes modificadas (áreas de trabajo), el ritmo de cambios (ritmo de cambios), la manera de incorporar tests (forma de verificación) y la forma de implicación— utilizando las mismas denominaciones que griftai.org. Las claves del JSON se mantienen sin cambios.

- Repositorio: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- Distribución: PyPI «grift-cli» (`pipx install grift-cli`, Python 3.11 o superior)
- Licencia: MIT
- Notas de la versión: [github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases) (cambios en cada versión)

## Logros

El 8 de septiembre de 2026 publicamos la versión [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/) en PyPI. Las métricas se verificaron en 117 repositorios públicos, y tanto las comparaciones que lograron distinguir patrones como las que aún no lo han conseguido están publicadas en GitHub (se trata de mediciones internas, sin auditoría de terceros).

El 25 de octubre de 2026 cotejamos línea por línea el texto del sitio web con la salida de la CLI. Dado que la lista colectiva de personas (`actor-index`) aparecía ordenada de mayor a menor número de commits pese a advertir en una nota que «no era un ranking», en la versión [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0), publicada el 26 de octubre de 2026, cambiamos la ordenación a un orden lexicográfico por identificador. El dato del número de commits se mantiene. Los antecedentes y los cinco criterios de aceptación establecidos para la serie 0.8 se detallan en un [artículo del blog](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/).

En la versión [0.9.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0), publicada el 27 de octubre de 2026, añadimos las frases iniciales del informe y las preguntas para entrevistas mencionadas anteriormente. Asimismo, eliminamos del Markdown la línea referida a la «intensidad» de las tendencias y la correspondiente al «sentido» del cotejo. La razón de ello es que, al poner dos informes uno al lado del otro, podían interpretarse erróneamente como personas más fuertes o más débiles, o perfiles adecuados o no adecuados. También corregimos cuatro puntos en los que podían generarse cifras sobre una persona que no se correspondían con los hechos reales.

En la actualidad, nos encontramos preparando pruebas piloto (PoC) junto a agencias de intermediación laboral y empresas de SES para dotar de argumentos específicos a las recomendaciones a partir de los registros ejecutados localmente por los propios candidatos. Igualmente, recibimos consultas de responsables de contratación de empresas con desarrollo propio para realizar pruebas piloto (PoC) orientadas a verificar, a partir de registros compartidos por los propios candidatos, qué tipo de labor han venido desempeñando. Con base en los resultados de estas pruebas piloto, nuestro objetivo es iniciar la disponibilidad de la versión oficial a lo largo de 2027. Grift también se presenta en [griftai.org](https://griftai.org).

La filosofía de Grift también se describe en artículos publicados en [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) y [note](https://note.com/cor_instrument/n/nd58ba0955317).
