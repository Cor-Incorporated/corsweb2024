---
title: "Grift: el currículum se puede exagerar; las pruebas, no. La herramienta de código abierto que extrae hechos verificables del historial de git"
description: "Grift, un producto propio que extrae hechos verificables (valores de inspección) en lugar de puntuaciones a partir del historial de git de los ingenieros. Presentamos el diseño y el proceso que nos llevó a cambiar el rumbo: de una aplicación web para la estimación de presupuestos a una CLI de código abierto y apoyo a la recomendación para agencias de empleo y empresas de SES."
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "Agencias de empleo", "SES", "Contratación"]
publishedAt: 2026-06-30
updatedAt: 2026-10-28
summary: "Grift es un producto propio que extrae «hechos verificables» del historial de git de los ingenieros. No asigna puntuaciones ni clasificaciones. Al no utilizar IA (LLM) para la medición, produce los mismos resultados independientemente de quién lo ejecute y permite que el receptor verifique los cálculos. La CLI está disponible públicamente como software de código abierto bajo la licencia MIT."
isDraft: false
featured: true
lang: "es"
translationSourceHash: "4ca681c34432675973331e8114ce197a04fd07b1460e509367b26bbd93cf1d4e"
translatedAt: "2026-10-28T05:33:11.474Z"
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

## El problema

Las agencias de colocación y los representantes comerciales de SES necesitan explicar por qué recomiendan a un candidato concreto a una empresa. Sin embargo, el material del que disponen se reduce casi siempre al currículum y a las impresiones de la entrevista. Aunque figure «5 años de Java», no se transmite la naturaleza real de su trabajo: qué tipo de modificaciones ha realizado y de qué manera las ha ido verificando a lo largo del proceso.

Por otra parte, indicadores de «volumen de actividad» como la gráfica de contribuciones de GitHub o el recuento de commits se inflan hoy con facilidad mediante IA generativa y agentes. Un volumen elevado ya difícilmente sirve como base para una recomendación. Al mismo tiempo, condensarlo todo en una única puntuación borra qué se midió, en qué periodo y con qué muestra base, convirtiéndose en una mera herramienta de criba. Faltaba «material verificable», tanto para la parte que recomienda como para quien es recomendado.

## El enfoque

Grift comenzó en febrero de 2026 como una aplicación web concebida para respaldar las estimaciones en proyectos de desarrollo por encargo. Al indagar en la base de dichas estimaciones, nos percatamos de que el material más fidedigno era el propio historial de Git que los ingenieros van construyendo con el tiempo, y en agosto de 2026 segregamos la parte de medición en forma de herramienta de línea de comandos. En septiembre suspendimos la antigua aplicación web y reorientamos el rumbo hacia el apoyo a las agencias de colocación y a los representantes comerciales de SES.

En el diseño establecimos tres compromisos previos:

- No puntuar: lo que se emite son valores de inspección y quien juzga es una persona. No se generan puntuaciones compuestas, clasificaciones, aptos/no aptos ni rangos de nivel; todo valor numérico va acompañado necesariamente de numerador y denominador.
- Mismo resultado en cada ejecución: no se utiliza IA (LLM) en la medición. Con el mismo repositorio y la misma versión, cualquiera que lo ejecute obtendrá exactamente los mismos valores numéricos.
- No se envía a ningún sitio: opera únicamente en el equipo local. Si se comparte o no, y qué repositorios se muestran, lo decide la propia persona interesada.

Paralelamente, fijamos siete normas de uso —entre ellas «no interpretar la ausencia como algo negativo», «no cribar únicamente por valores numéricos» y «no medir a terceros sin su consentimiento»—, con la regla de no denominar con el nombre de la metodología (TEP: Technical Evidence Pipeline) a aquellos usos que no las respeten.

## Implementación

Grift CLI extrae del historial de Git, de forma exclusiva, observaciones como las siguientes:

- Distinción de autoría: categoriza de quién es el trabajo en 11 clasificaciones, tales como commits propios de la persona, trabajo de terceros, bots, artefactos generados o de proveedores e historial heredado del fork de origen.
- Tasa de modificación conjunta de pruebas: porcentaje en el que, en el mismo commit de modificación del código de producción, también se modifican las pruebas.
- Tasa de retrabajo y retoque: porcentaje de repetición de trabajo o de nuevo contacto con archivos modificados recientemente (se trata del registro de una tendencia, no se utiliza para determinar aptitud).
- Contexto del repositorio: días de trabajo efectivo, número de participantes y cuota de participación del autor mayoritario, porcentaje a través de revisiones de código, entre otros.

En `report-v2`, añadido en la versión v0.6, se amplía la capa para observar la forma de trabajar de un ingeniero individual. Todas las métricas incorporan numerador y denominador, y no constituyen una valoración del puesto ni de la capacidad:

- Áreas de trabajo (`surface_profile`): número de modificaciones en cada una de las 11 categorías: test / docs / CI/CD / platform / data / observability / frontend / backend / config / generados o proveedores / otros.
- Ritmo de cambios (`change_rhythm`): número de días en los que se enviaron cambios dentro de los últimos 180 días e intervalos entre dichos envíos (mediana y percentil 90, porcentaje de envíos sucesivos en un plazo de 2 días, porcentaje con intervalos de 30 días o más). No representa horas de trabajo ni grado de motivación.
- Forma de verificación (`verification_profile`): proporción de commits en los que se modificaron pruebas y su tipología (unit / integration / e2e / contract / desconocida), así como la proporción de commits de corrección (fix) acompañados de pruebas.
- Cuatro dimensiones del rol (`role_profile`): se limita exclusivamente a cuatro aspectos: domain / work_type / time / process_position, sin sintetizarlos en un único perfil profesional. Se muestra únicamente cuando existe una identidad en la que consta el consentimiento de la persona interesada.

El cotejo con los proyectos también se realiza sin establecer clasificaciones ordenadas. Por parte del proyecto se declaran las áreas, verificación, ritmo y entradas requeridas mediante `grift project`, y `grift align` las dispone eje por eje junto a las observaciones del candidato. Dicha alineación se limita estrictamente a cinco posibilidades: solapamiento (overlap), fuera del rango declarado (outside_declared_range), cero casos observados (observed_zero), no observado (not_observed) y sin requerimiento declarado (not_declared), sin calcular puntuaciones globales, clasificaciones ni aptitud. Cuando se analiza a nivel de equipo con `--team`, se indica únicamente el número de personas que satisfacen los requerimientos, y no se realiza agregación si son menos de 3 personas para evitar la identificación individual.

Cuando la muestra base es inferior a 20, no se muestran porcentajes sino únicamente el número de casos, y lo que no pudo observarse no se presenta como «sin historial», sino como «no observado» acompañado de su motivo. `grift verify` recalcula los informes guardados bajo las mismas condiciones y devuelve coincidencia, discrepancia o imposibilidad de verificación, lo que permite a la parte receptora comprobar posibles alteraciones o divergencias.

A partir de la versión 0.9.0, al inicio del Markdown de `grift actor` se redacta una breve descripción del modo en que se aborda el trabajo a partir de los registros. Se describe la distribución de las áreas modificadas, el ritmo de los cambios, la forma de incorporar pruebas y la modalidad de participación, indicando el número de casos y el periodo de tiempo; a continuación, se señala lo que no puede apreciarse a través de dicho registro y se enumeran, en forma de preguntas, aquellos aspectos que conviene contrastar en la entrevista. `grift project` describe la dinámica del repositorio del proyecto siguiendo las mismas reglas, sin mostrar las cifras individuales por persona ni la modalidad de participación. `grift align` acompaña la correlación entre requerimientos y registros con preguntas orientadas a contrastar información en la entrevista. Los textos y las preguntas se seleccionan a partir de las cifras mediante una [tabla de decisión](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/trait-profile.md) publicada, sin recurrir a la IA. No se incluyen en el JSON, por lo que lo verificable mediante `grift verify` son las cifras que sirven de base a dichos textos.

Los textos y las preguntas relativas a una persona se muestran únicamente cuando se trata de un identificador declarado por ella misma y consta el registro de su consentimiento. En los demás casos, se explica el motivo de su omisión en una única frase. Cuando se presenta a varias personas de forma conjunta (`--all`, `--top`), no se emiten estos textos.

El nombre del método es TEP (Technical Evidence Pipeline, flujo de extracción de evidencias técnicas). Consta de cuatro etapas: leer los registros de Git, cuantificar conforme a reglas fijas, añadir a los valores obtenidos el denominador y los motivos de aquello que no pudo cuantificarse, y hacer posible que cualquiera pueda recalcularlo siguiendo el mismo procedimiento. Encontrará una explicación detallada en la [página sobre TEP](https://griftai.org/tep) del sitio web de Grift.

La correspondencia entre la terminología utilizada en esta página y en griftai.org y los términos que emite la CLI es la siguiente:

| Terminología del sitio web | Término en la CLI |
|---|---|
| Valores de inspección | observed value (`kind: observed`; se acompaña de valor, unidad y denominador) |
| Tasa de modificación conjunta de pruebas | test co-change |
| Tasa de retrabajo | corrective rework |
| Retoque | path retouch |
| Code recency | survival (únicamente al especificar `--survival`) |
| Contexto del repositorio | context profile |
| Áreas de trabajo, ritmo de cambios y forma de verificación | surface_profile / change_rhythm / verification_profile |

A partir de la versión 0.9.0, el formato Markdown de la CLI designa también las cuatro perspectivas —la clasificación de las áreas modificadas (áreas de trabajo), el ritmo de los cambios (ritmo de cambios), la forma de incorporar pruebas (forma de verificación) y la modalidad de participación— con las mismas denominaciones que en griftai.org. Las claves del JSON no sufren modificaciones.

- Repositorio: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- Distribución: PyPI «grift-cli» (`pipx install grift-cli`, compatible con Python 3.11 o superior)
- Licencia: MIT
- Notas de la versión: [github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases) (cambios en cada versión)

## Resultados

El 8 de septiembre de 2026 publicamos la versión [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/) en PyPI. Las métricas se validaron en 117 repositorios públicos, y tanto las comparaciones en las que se apreciaron diferencias como aquellas en las que aún no ha sido posible distinguirlas se encuentran publicadas en GitHub (se trata de mediciones internas, sin auditoría por parte de terceros).

El 25 de octubre de 2026 cotejamos línea por línea el redactado del sitio web con los resultados de la CLI. Dado que la lista con varias personas (`actor-index`) se mostraba ordenada de mayor a menor número de commits a pesar de que en las notas se indicaba que «no constituye una clasificación», en la versión [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0), publicada el 26 de octubre de 2026, modificamos la ordenación a un orden lexicográfico por identificador, conservando el valor del recuento de commits. Las circunstancias y los cinco criterios de aceptación fijados para la serie 0.8 se detallan en el [artículo del blog](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/).

En la versión [0.9.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0), publicada el 27 de octubre de 2026, incorporamos el texto inicial de los informes y las preguntas para la entrevista mencionados anteriormente. Al mismo tiempo, retiramos del Markdown la línea correspondiente a la «intensidad» de la tendencia y la relativa a la «orientación» del cotejo, puesto que al contrastar dos informes podían interpretarse erróneamente como personas más o menos competentes, o bien como personas idóneas o no idóneas. También se corrigieron cuatro puntos en los que podían generarse cifras discordantes con la realidad respecto a una persona.

En la versión [0.9.1](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.1), publicada el 28 de octubre de 2026, subsanamos los puntos detectados con posterioridad a la 0.9.0 en los que podían producirse cifras no conformes a la realidad respecto a personas o proyectos. No se incorporan nuevos comandos y se mantiene intacto el principio de no emitir puntuaciones, clasificaciones ni denominaciones de perfiles tipológicos. Debido al cambio en la versión de las definiciones, los informes y cotejos guardados con la versión 0.9.0 ya no pueden ser verificados con el comando `grift verify` de la versión 0.9.1 (las excepciones, como los informes de proyectos elaborados exclusivamente a partir de requerimientos, se recogen en las [notas de migración](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.1/docs/migration-v091.md)).

Actualmente estamos preparando, conjuntamente con agencias de intermediación y empresas de SES, pruebas de concepto (PoC) orientadas a dotar de concreción a los motivos de recomendación a partir de los registros ejecutados localmente por los propios candidatos. Asimismo, atendemos consultas de responsables de selección de empresas de desarrollo interno interesadas en realizar pruebas de concepto (PoC) para contrastar el trabajo que ha desempeñado el candidato a partir de los registros compartidos por él mismo. De cara a la versión oficial, prevemos iniciar su disponibilidad en 2027 tomando en consideración los resultados de estas pruebas piloto. Puede consultar también la presentación de Grift en [griftai.org](https://griftai.org).

La filosofía que fundamenta a Grift se expone igualmente en artículos publicados en [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) y [note](https://note.com/cor_instrument/n/nd58ba0955317).
