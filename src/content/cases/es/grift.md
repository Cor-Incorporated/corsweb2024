---
title: "Grift: el currículum se puede exagerar; las pruebas no. Un proyecto OSS que extrae hechos verificables del historial de git"
description: "Grift es nuestro producto propio para extraer hechos verificables (valores de inspección), no puntuaciones, a partir del historial de git de los ingenieros. Presentamos el diseño y el proceso por el que pasó de ser una aplicación web de estimaciones a una CLI de código abierto y una herramienta de apoyo a la recomendación para agencias de empleo y empresas de SES."
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "Agencias de empleo", "SES", "Contratación"]
publishedAt: 2026-06-30
updatedAt: 2026-10-28
summary: "Grift es un producto propio que extrae «hechos verificables» del historial de git de los ingenieros. No asigna puntuaciones ni clasificaciones. Al no utilizar IA (LLM) para la medición, cualquier persona que lo ejecute obtendrá el mismo resultado y el receptor podrá verificarlo. La CLI está publicada como software de código abierto bajo la licencia MIT."
isDraft: false
featured: true
lang: "es"
translationSourceHash: "93cbb0803f562926b2ef1cdbf6ab3a50bfaecdfcb668cd2478e8aa436d42c9a5"
translatedAt: "2026-10-30T03:57:36.697Z"
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
2026-10-30: 0.9.2 の変更（Docker で実行、grift update、grift contribute の同意後の表示、リポジトリの文脈の年とタグの頻度）を「実装」と「成果」に足した。0.9.2 の公開後に出す。公開日は公開したら「成果」に足す。
-->

## El problema

Los agentes de las agencias de colocación y de las empresas de servicios de ingeniería de software (SES) necesitan explicar «por qué recomiendan a esta persona» al presentar un candidato a una empresa. Sin embargo, la mayor parte del material disponible se reduce al currículum vitae y a las impresiones de la entrevista. Aunque figure «5 años de Java», eso no transmite el contenido real del trabajo: qué tipo de cambios se introdujeron y cómo se fueron verificando.

Por otro lado, el «volumen de actividad», como la cuadrícula de contribuciones de GitHub o el número de commits, se infla hoy fácilmente con IA generativa o agentes. La gran cantidad de actividad ya difícilmente sirve de base para una recomendación. Y si se reduce a una sola puntuación, se pierde qué se midió, en qué período y sobre qué población base, convirtiéndose en una mera herramienta de criba. Faltaban «materiales contrastables», tanto para quien recomienda como para quien es recomendado.

## Enfoque

Grift nació en febrero de 2026 como una aplicación web para respaldar las estimaciones en proyectos de desarrollo por encargo. Al buscar la base para tales estimaciones, nos dimos cuenta de que el material más fidedigno es el propio historial de git que el desarrollador ha acumulado con el tiempo, y en agosto de 2026 extrajimos la parte de medición como una herramienta de línea de comandos. En septiembre dejamos de ofrecer la antigua aplicación web y reorientamos el rumbo hacia el apoyo a las ventas de agencias de colocación y empresas de SES.

En el diseño establecimos tres compromisos previos:

- No puntuar: lo que se entrega son valores de inspección y quien juzga es una persona. No se generan puntuaciones compuestas, clasificaciones, aprobados/suspensos ni niveles; a cada cifra se le añaden siempre numerador y denominador
- El mismo resultado cada vez: no se usa IA (LLM) para la medición. Con el mismo repositorio y la misma versión, cualquiera que lo ejecute obtiene exactamente las mismas cifras
- No se envía a ningún sitio: funciona únicamente en el PC local. La persona decide si comparte o no, y qué repositorios muestra

Asimismo, definimos siete normas de uso, entre ellas «no interpretar la ausencia como algo negativo», «no cribar solo por números» y «no medir a terceros sin su consentimiento», y establecimos que todo uso que no las cumpla no podrá denominarse con el nombre de la metodología (TEP: Technical Evidence Pipeline).

## Implementación

Grift CLI extrae observaciones como las siguientes únicamente a partir del historial de git:

- Distinción de autoría: separa el trabajo de cada cual mediante 11 clasificaciones, tales como commits propios de la persona, trabajo de terceros, bots, artefactos generados o de proveedores, e historial heredado del repositorio base bifurcado (fork)
- Tasa de modificación conjunta de pruebas: porcentaje de commits en los que, junto con los cambios en el código de producción, también se modifican las pruebas
- Tasa de retrabajo y retoque: porcentaje de retoques o accesos reiterados a archivos tocados recientemente (registro de tendencias; no se emplea para juzgar aprobados ni suspensos)
- Contexto del repositorio: días de trabajo efectivo, número de participantes y cuota del autor principal, proporción tramitada mediante revisiones de código, etc.

Con `report-v2`, añadido en la v0.6, se suma una capa que permite observar la forma en que trabaja un ingeniero de manera individual. Todas las métricas llevan numerador y denominador; no son una evaluación de puesto ni de competencia:

- Áreas de trabajo (`surface_profile`): número de cambios realizados en cada una de 11 categorías: test / docs / CI/CD / platform / data / observability / frontend / backend / config / generados o de proveedores / otros
- Ritmo de cambios (`change_rhythm`): días en los que se enviaron cambios dentro de los últimos 180 días e intervalos entre envíos (mediana y percentil 90, proporción de envíos sucesivos en menos de 2 días y proporción de pausas de 30 días o más). No representan horas de trabajo ni motivación
- Forma de verificación (`verification_profile`): proporción de commits que modificaron pruebas y su tipología (unit / integration / e2e / contract / desconocida), así como la proporción de commits de corrección (fix) acompañados de pruebas
- Cuatro dimensiones del rol (`role_profile`): solo domain / work_type / time / process_position; no se colapsan en una sola categoría profesional. Se emiten únicamente cuando existe una identidad con consentimiento registrado de la persona

El cotejo con los requisitos del proyecto también se realiza sin asignar clasificaciones ni rankings. El lado del proyecto declara en `grift project` las áreas, la verificación, el ritmo y las entradas solicitadas, y `grift align` las alinea con las observaciones del candidato en cada eje. La correspondencia se clasifica únicamente en cinco estados: solapamiento (overlap), fuera del rango declarado (outside_declared_range), cero observado (observed_zero), no observado (not_observed) y no declarado (not_declared); no se calculan puntuaciones globales, clasificaciones ni decisiones de aptitud. Al analizar a nivel de equipo mediante `--team`, solo se muestra el número de personas que cumplen los requisitos, y no se agregan datos para grupos de menos de tres miembros a fin de evitar la identificación individual.

Cuando la población base es inferior a 20, no se muestran tasas porcentuales sino solo el recuento de casos, y aquello que no pudo observarse no se muestra como «sin trayectoria», sino como «no observado» con su motivo correspondiente. `grift verify` recalcula el informe guardado bajo las mismas condiciones y devuelve coincidencia, discrepancia o no verificable, de modo que quien lo recibe puede comprobar si ha habido alteraciones o inconsistencias.

A partir de la versión 0.9.0, al principio del Markdown de `grift actor` se describe brevemente la forma de trabajar que se desprende del registro. Se detallan las categorías de las partes modificadas, el ritmo de los cambios, la forma de incorporar pruebas y la modalidad de participación, acompañados de recuentos y períodos; a continuación se indica aquello que no se puede apreciar a partir de este registro y se plantean preguntas para contrastar en la entrevista. `grift project` describe la dinámica del repositorio del proyecto con las mismas reglas, sin mostrar cifras individuales por persona ni su modalidad de participación. `grift align` añade preguntas para la entrevista junto a la correspondencia entre requisitos y registros. Los textos y las preguntas se eligen a partir de cifras mediante una [tabla de decisión](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/trait-profile.md) pública, sin emplear IA. No se incluyen en el JSON, por lo que lo que se puede comprobar con `grift verify` son las cifras que sirvieron de base a los textos.

Los textos y las preguntas sobre una persona solo se emiten cuando se trata del identificador que la propia persona ha indicado y existe un registro de su consentimiento. En los demás casos, se explica el motivo de su omisión en una sola frase. Cuando se presentan varias personas de forma conjunta (`--all`, `--top`), no se incluyen estos textos.

El nombre de la metodología es TEP (Technical Evidence Pipeline, flujo de extracción de evidencia técnica). Consta de cuatro etapas: leer el historial de git, contar conforme a reglas predeterminadas, añadir a los valores contados el denominador y los motivos de lo que no pudo contabilizarse, y permitir que cualquiera pueda volver a realizar el recuento mediante el mismo procedimiento. La explicación detallada se encuentra en la [página de TEP](https://griftai.org/tep) del sitio web de Grift.

A continuación se muestra la correspondencia entre los términos utilizados en esta página y en griftai.org y los términos que la CLI escribe en la salida:

| Términos en el sitio web | Término en la CLI |
|---|---|
| Valores de inspección | observed value (`kind: observed`; se acompaña de valor, unidad y denominador) |
| Tasa de modificación conjunta de pruebas | test co-change |
| Tasa de retrabajo | corrective rework |
| Retoque | path retouch |
| Code recency | survival (únicamente al especificar `--survival`) |
| Contexto del repositorio | context profile |
| Áreas de trabajo, ritmo de cambios, forma de verificación | surface_profile / change_rhythm / verification_profile |

A partir de la versión 0.9.0, el Markdown de la CLI también redacta las cuatro perspectivas —categorías de partes modificadas (áreas de trabajo), ritmo de cambios (ritmo de cambios), forma de verificación mediante pruebas (forma de verificación) y modalidad de participación— con las mismas denominaciones que griftai.org. Las claves del JSON no cambian.

En la versión 0.9.2, se habilitó la ejecución mediante una imagen de Docker construida a partir del repositorio grift-cli, sin necesidad de instalar Python en la máquina anfitriona. Los repositorios que se deseen analizar deben obtenerse con todo su historial y pasarse a `/repo`. No pueden utilizarse árboles de trabajo creados con `git worktree`.

`grift update` se modificó para actualizar de manera explícita el entorno en ejecución y mostrar la versión resultante de la actualización. `grift update --check` se limita a consultar la información de la última versión en PyPI, sin realizar actualizaciones. No existen comunicaciones automáticas de actualización ni verificaciones de versión en los comandos de medición habituales.

`grift contribute` guarda localmente el archivo de entrega tras el consentimiento de la persona e indica la información necesaria y el destino para la presentación. No realiza envíos de forma automática. Si se desea publicar y presentar un archivo generado con el valor predeterminado `--door local`, se debe volver a generar con `--door public-pr` y utilizar el identificador de entrega, el hash y los metadatos recién mostrados. Tanto en las PR públicas enviadas por la propia persona como en las PR delegadas bajo anonimato, el contenido del archivo queda expuesto públicamente.

- Repositorio: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- Distribución: PyPI «grift-cli» (`pipx install grift-cli`, Python 3.11 o superior)
- Licencia: MIT
- Notas de la versión: [github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases) (cambios por versión)

## Resultados

El 8 de septiembre de 2026 publicamos la versión [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/) en PyPI. Las métricas se verificaron en 117 repositorios públicos, y tanto las comparaciones que permitieron discriminar como las que aún no lo han logrado se encuentran publicadas en GitHub (se trata de mediciones internas que no han sido sometidas a auditorías de terceros).

El 25 de octubre de 2026 cotejamos línea por línea el texto del sitio web con la salida de la CLI. Dado que la lista de varias personas (`actor-index`) aparecía ordenada de mayor a menor número de commits a pesar de que en la nota aclaratoria se indicaba que «no es una clasificación», en la versión [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0), publicada el 26 de octubre de 2026, modificamos la ordenación al orden lexicográfico de los identificadores. Se mantiene el valor del número de commits. Los antecedentes y los cinco criterios de aceptación fijados para la serie 0.8 se detallan en el [artículo del blog](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/).

En la versión [0.9.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0), publicada el 27 de octubre de 2026, añadimos los textos introductorios y las preguntas para la entrevista descritos anteriormente. Al mismo tiempo, eliminamos del Markdown la línea de «intensidad» de las tendencias y la de «orientación» del cotejo, ya que al poner dos informes uno al lado del otro podían interpretarse como personas fuertes o débiles, o personas que encajan o no encajan. También corregimos cuatro puntos en los que podían aparecer cifras no conformes a la realidad acerca de las personas.

En la versión [0.9.1](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.1), publicada el 28 de octubre de 2026, se corrigieron puntos detectados con posterioridad a la 0.9.0 en los que podían mostrarse cifras no conformes a la realidad acerca de personas o proyectos. No se añadieron comandos nuevos y se mantiene la política de no emitir puntuaciones, clasificaciones ni nombres de tipologías. Debido a la modificación de las versiones de las definiciones, los informes y cotejos guardados con la 0.9.0 ya no se pueden recalcular ni verificar con el `grift verify` de la 0.9.1 (las excepciones, como los informes de proyectos generados únicamente a partir de requisitos, se detallan en las [notas de migración](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.1/docs/migration-v091.md)).

En la versión [0.9.2](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.2), en la salida que muestra el contexto del repositorio se incluyeron el año de la primera actividad y el de la última actividad observadas en el historial, así como el numerador y el denominador de la frecuencia de etiquetas (tags). Dado que el año de última actividad se muestra también para las personas que siguen en activo, no indica abandono ni baja laboral. La frecuencia de etiquetas es un valor anualizado calculado como «número de etiquetas ÷ días de actividad × 365,25», y no el recuento de lanzamientos observados. Se mantiene invariable la directriz de no generar puntuaciones, clasificaciones ni decisiones de aptitud.

Actualmente avanzamos en los preparativos de pruebas piloto (PoC) con agencias de empleo y empresas de SES para fundamentar de forma concreta las razones de recomendación a partir de registros ejecutados localmente por los propios candidatos. También atendemos consultas de responsables de selección de empresas con desarrollo propio que deseen realizar pruebas piloto (PoC) para contrastar el trabajo que ha desempeñado un candidato a partir de los registros que él mismo comparta. Con base en los resultados de estas pruebas piloto, nuestro objetivo es iniciar la oferta de la versión definitiva en 2027. Grift también se presenta en [griftai.org](https://griftai.org).

La filosofía de Grift se presenta asimismo en artículos publicados en [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) y [note](https://note.com/cor_instrument/n/nd58ba0955317).
