---
title: "Grift — El currículum se puede inflar; las pruebas, no. Software de código abierto (OSS) para extraer hechos verificables a partir del historial de git"
description: "Grift es un producto propio que extrae hechos verificables (valores de inspección) en lugar de puntuaciones a partir del historial de git de los ingenieros. Presentamos el trasfondo y el diseño de la transición de una aplicación web para presupuestos a una herramienta CLI de OSS y apoyo a la recomendación para agencias de contratación y empresas SES."
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "Agencias de selección de personal", "SES", "Contratación"]
publishedAt: 2026-06-30
updatedAt: 2026-10-26
summary: "Grift es un producto propio que extrae «hechos verificables» del historial de git de los ingenieros. No asigna puntuaciones ni clasificaciones. Dado que no utiliza IA (LLM) para la medición, produce los mismos resultados sin importar quién lo ejecute, permitiendo que quien los reciba pueda verificarlos. El CLI está publicado como software de código abierto (OSS) bajo la licencia MIT."
isDraft: false
featured: true
lang: "es"
translationSourceHash: "3ed7c2d9efb97af0e5865299da247aea96639ffd21f806a4c3e5ce3c5e3cc08e"
translatedAt: "2026-10-26T12:22:31.715Z"
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

Los agentes de contratación de personal y los comerciales de SES (servicios de ingeniería de sistemas) necesitan explicar «por qué recomiendan a esta persona» al presentar candidatos a las empresas. Sin embargo, el material del que disponen suele limitarse al currículum y a las impresiones de una entrevista. Aunque ponga «5 años de Java», no se llega a transmitir el fondo del trabajo: qué tipo de cambios realizaba ni cómo los verificaba a medida que avanzaba.

Por otro lado, el «volumen de actividad», como las contribuciones en GitHub o el recuento de commits, se ha vuelto fácil de inflar artificialmente con el uso de IA generativa y agentes. La abundancia de cantidad ya difícilmente sirve como base para una recomendación. No obstante, si se sintetiza en una sola puntuación, se pierde qué se midió, en qué periodo y con qué tamaño de muestra, y termina utilizándose como un simple filtro de descarte. Faltaba «material verificable», tanto para quien recomienda como para quien es recomendado.

## Nuestro enfoque

Grift comenzó en febrero de 2026 como una aplicación web concebida para respaldar las estimaciones en proyectos de desarrollo por encargo. Al indagar en la base de dichas estimaciones, nos dimos cuenta de que el material más certero era el propio historial de git acumulado por los ingenieros, y en agosto de 2026 extrajimos la parte de medición como una herramienta de línea de comandos. En septiembre dejamos de ofrecer la antigua aplicación web y cambiamos de rumbo para apoyar a los comerciales de agencias de empleo y de SES.

En el diseño, establecimos tres compromisos previos:

- No convertir en puntuaciones: lo que se muestra son valores de inspección, y quien juzga es la persona. No se generan puntuaciones compuestas, clasificaciones, aprobados/suspensos ni niveles; los valores numéricos siempre van acompañados de numerador y denominador.
- Mismo resultado en cada ocasión: no se utiliza IA (LLM) para la medición. Para un mismo repositorio y una misma versión, cualquiera que lo ejecute obtendrá los mismos valores numéricos.
- No se envía a ninguna parte: funciona exclusivamente en el PC local. La propia persona decide si lo comparte y qué repositorios muestra.

Asimismo, definimos una norma de uso de siete cláusulas que incluye premisas como «no interpretar las ausencias de forma negativa», «no descartar basándose únicamente en cifras» y «no medir a terceros sin su consentimiento», acordando no denominar con el nombre de la metodología (TEP: Technical Evidence Pipeline) a aquellos usos que no las respeten.

## Implementación

Grift CLI extrae observaciones como las siguientes a partir únicamente del historial de git:

- Distinción de autoría: clasifica de quién es el trabajo en 11 categorías, como commits propios de la persona, trabajo de terceros, bots, artefactos generados o de proveedores, o historiales heredados de bifurcaciones (forks).
- Tasa de modificación conjunta de pruebas: porcentaje de commits en los que se modificaron pruebas en el mismo commit que los cambios del código de producción.
- Tasa de retrabajo y retoque: porcentaje de rectificaciones o de nuevas modificaciones sobre archivos tocados recientemente (se registra como tendencia y no se utiliza para determinar aptitud o no aptitud).
- Contexto del repositorio: días de actividad real, número de personas implicadas y cuota del autor principal, porcentaje realizado mediante revisiones, entre otros.

Con `report-v2`, añadido en la v0.6, se suma un nivel para observar la forma de trabajar de un ingeniero individual. Todos van acompañados de numerador y denominador, y no constituyen una evaluación del puesto ni de las capacidades:

- Áreas de trabajo (`surface_profile`): en 11 categorías (test / docs / CI/CD / platform / data / observability / frontend / backend / config / generados o proveedores / otros), cuántos cambios hubo en cada área.
- Ritmo de cambios (`change_rhythm`): días en los que se enviaron cambios dentro de los últimos 180 días e intervalos entre envíos (mediana y percentil 90, porcentaje de envíos consecutivos en menos de 2 días, porcentaje con intervalos de 30 días o más). No representa horas de trabajo ni nivel de motivación.
- Forma de verificación (`verification_profile`): porcentaje de commits en los que se tocaron pruebas y sus tipos (unit / integration / e2e / contract / desconocido), así como el porcentaje de commits de corrección (fix) acompañados de pruebas.
- Cuatro dimensiones del rol (`role_profile`): se compone únicamente de cuatro aspectos (domain / work_type / time / process_position), sin reducirse a un único puesto de trabajo. Solo se emite cuando existe una identidad con el consentimiento registrado de la propia persona.

El cotejo con los requisitos del proyecto también se realiza sin establecer clasificaciones. La parte del proyecto declara en `grift project` las áreas, la verificación, el ritmo y las entradas solicitadas, y `grift align` las alinea con las observaciones del candidato por cada eje. La alineación solo contempla cinco casos: superposición (overlap), fuera del rango declarado (outside_declared_range), 0 casos (observed_zero), no observado (not_observed) y sin solicitud (not_declared), sin calcular puntuaciones globales, clasificaciones ni apto/no apto. Al analizarse a nivel de equipo con `--team`, solo se muestra el número de personas que cumplen con las solicitudes, y no se realiza agregación si son menos de 3 personas para evitar la identificación individual.

Cuando el tamaño de la muestra es inferior a 20, no se muestran porcentajes sino únicamente el recuento, y aquello que no pudo observarse se indica con su motivo como «no observado», en lugar de como «sin experiencia». `grift verify` recalcula los informes guardados bajo las mismas condiciones y devuelve coincidencia, discrepancia o imposibilidad de verificación, lo que permite a la parte receptora comprobar modificaciones o inconsistencias.

El nombre de la metodología es TEP (Technical Evidence Pipeline, flujo de extracción de evidencia técnica). Consta de cuatro etapas: leer los registros de git, contar según reglas fijas, añadir el denominador y el motivo de lo que no pudo contarse a los valores obtenidos, y permitir que cualquiera pueda volver a realizar el conteo siguiendo el mismo procedimiento. Encontrará una explicación detallada en la [página de TEP](https://griftai.org/tep) del sitio web de Grift.

La terminología utilizada en esta página y en griftai.org se corresponde con las palabras que la CLI incluye en su salida de la siguiente manera:

| Término en el sitio | Término en la CLI |
|---|---|
| Valor de inspección | observed value (`kind: observed`; incluye valor, unidad y denominador) |
| Tasa de modificación conjunta de pruebas | test co-change |
| Tasa de retrabajo | corrective rework |
| Retoque | path retouch |
| Actualidad del código | survival (solo al especificar `--survival`) |
| Contexto del repositorio | context profile |
| Áreas de trabajo, ritmo de cambios y forma de verificación | surface_profile / change_rhythm / verification_profile |

- Repositorio: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- Distribución: PyPI «grift-cli» (`pipx install grift-cli`, Python 3.11 o superior)
- Licencia: MIT
- Notas de la versión: [github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases) (cambios en cada versión)

## Resultados

El 8 de septiembre de 2026 publicamos la versión [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/) en PyPI. Los indicadores se verificaron en 117 repositorios públicos, y tanto las comparaciones que lograron distinguir diferencias como las que aún no lo han conseguido están publicadas en GitHub (se trata de mediciones internas, sin auditoría de terceros).

El 25 de octubre de 2026 cotejamos línea por línea el texto del sitio con la salida de la CLI. Dado que la lista de varias personas (`actor-index`) aparecía ordenada de mayor a menor número de commits a pesar de que la nota aclaratoria indicaba «no es una clasificación», en la versión [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0), publicada el 26 de octubre de 2026, cambiamos la ordenación a orden lexicográfico por ID. El valor del número de commits se mantiene. Los antecedentes y las cinco condiciones de aceptación impuestas a la serie 0.8 se detallan en el [artículo del blog](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/).

Actualmente estamos preparando pruebas piloto (PoC) junto con agencias de colocación y empresas de SES para concretar los motivos de recomendación a partir de los registros ejecutados localmente por los propios candidatos. También atendemos consultas de responsables de selección de empresas con desarrollo propio para realizar pruebas piloto (PoC) orientadas a constatar el tipo de trabajo realizado a partir de los registros compartidos por los propios candidatos. En cuanto a la versión oficial, nuestro objetivo es iniciar su provisión en 2027 a partir de los resultados de las pruebas piloto. Grift también se presenta en [griftai.org](https://griftai.org).

La filosofía de Grift también se expone en artículos de [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) y [note](https://note.com/cor_instrument/n/nd58ba0955317).
