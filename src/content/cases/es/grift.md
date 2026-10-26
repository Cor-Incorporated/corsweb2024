---
title: "Grift: el currículum se puede inflar; las pruebas, no. La herramienta de código abierto (OSS) que extrae hechos verificables del historial de git"
description: "Grift es un producto propio que extrae hechos verificables (valores medidos) del historial de git de los ingenieros, en lugar de asignar puntuaciones. Presentamos el diseño y el proceso que nos llevó a pivotar desde una aplicación web de estimación hacia una CLI de OSS y el apoyo a las recomendaciones para agencias de contratación y empresas SES."
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "Agencias de contratación", "SES", "Contratación"]
publishedAt: 2026-06-30
updatedAt: 2026-10-26
summary: "Grift es un producto propio que extrae «hechos verificables» del historial de git de los ingenieros. No asigna puntuaciones ni clasificaciones. Al no utilizar IA (LLM) para la medición, produce el mismo resultado sin importar quién lo ejecute, lo que permite al receptor verificar los cálculos de forma independiente. La CLI se publica como software de código abierto (OSS) bajo la licencia MIT."
isDraft: false
featured: true
lang: "es"
translationSourceHash: "c46c32cd0131a2bb6afc55a971d8dd86ce2270ed68c889bfacfec9bdbe39ffbf"
translatedAt: "2026-10-26T07:50:50.421Z"
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

## Desafío

Los agentes de contratación y los comerciales de SES (servicios de ingeniería de sistemas) deben explicar «por qué recomiendan a esta persona» al presentar un candidato a una empresa. Sin embargo, el material del que disponen suele limitarse al currículum y a las impresiones de una entrevista. Aunque ponga «5 años de Java», no transmite la sustancia real del trabajo: qué cambios realizó ni cómo los fue verificando sobre la marcha.

Por otra parte, la «cantidad de actividad», como el historial de actividad de GitHub o el número de commits, se infla con facilidad recurriendo a IA generativa o a agentes. Un volumen alto ya apenas sirve como justificación para una recomendación. No obstante, si se reduce todo a una sola puntuación, desaparece qué se midió, en qué periodo y sobre qué tamaño de muestra, y termina utilizándose como una herramienta de descarte tajante. Faltaba «material comprobable», tanto para quien recomienda como para quien es recomendado.

## Enfoque

Grift nació en febrero de 2026 como una aplicación web para respaldar las estimaciones en proyectos de desarrollo por encargo. Al indagar en la justificación de esas estimaciones, nos dimos cuenta de que el material más certero era el propio historial de git que acumulan los ingenieros. En agosto de 2026 se extrajo la parte de medición como una herramienta de línea de comandos. En septiembre se interrumpió la provisión de la antigua aplicación web, cambiando el rumbo para respaldar a los comerciales de agencias de contratación y empresas de SES.

En el diseño se establecieron tres compromisos de antemano:

- No convertirlo en una puntuación: lo que se emite son valores de inspección; quien juzga es la persona. No se generan puntuaciones compuestas, clasificaciones, aptos/no aptos ni rangos; los valores numéricos siempre van acompañados de numerador y denominador.
- Mismo resultado en cada ocasión: no se utiliza IA (LLM) en la medición. Para un mismo repositorio y una misma versión, cualquier persona que lo ejecute obtendrá exactamente las mismas cifras.
- No se envía a ninguna parte: funciona exclusivamente en el PC local. La propia persona decide si compartirlo o no, y qué repositorios presentar.

Además, se definieron siete normas de uso (como «no interpretar la ausencia como algo negativo», «no descartar tajantemente solo por valores numéricos» o «no medir a terceros sin su consentimiento») y se acordó que los usos que no las respeten no podrán denominarse con el nombre de la metodología (TEP: Technical Evidence Pipeline).

## Implementación

Grift CLI extrae observaciones como las siguientes a partir únicamente del historial de git:

- Distinción de autoría: separa de quién es el trabajo mediante 11 clasificaciones, entre ellas commits propios del autor, trabajo de otros, bots, artefactos generados/de proveedores o historial heredado de bifurcaciones (forks).
- Tasa de modificación conjunta de tests: proporción de commits en los que se modifican tests al mismo tiempo que el código de producción.
- Tasa de retrabajo y retoque de rutas: proporción de reescrituras o reintervenciones sobre archivos tocados recientemente (se registra como tendencia y no se usa para evaluar aptitud).
- Contexto del repositorio: días de actividad efectiva, número de personas implicadas, cuota del autor principal, proporción de cambios aprobados mediante revisión, entre otros.

En `report-v2`, incorporado en la v0.6, se añade un nivel para examinar la forma de trabajar de un ingeniero individual. Todos los datos incluyen numerador y denominador, y no constituyen una valoración del puesto ni de la capacidad:

- Áreas de trabajo (`surface_profile`): cuántos cambios hubo en cada área, repartidos en 11 categorías: test / docs / CI/CD / platform / data / observability / frontend / backend / config / generados y proveedores / otros.
- Ritmo de cambios (`change_rhythm`): días con envíos de cambios en los últimos 180 días e intervalos entre entregas (mediana y percentil 90, porcentaje de entregas consecutivas en 2 días o menos, porcentaje con pausas de 30 días o más). No representa horas trabajadas ni nivel de motivación.
- Forma de verificación (`verification_profile`): porcentaje de commits que tocaron tests y su tipo (unit / integration / e2e / contract / desconocido), así como la proporción de commits de corrección (fix) acompañados de tests.
- 4 dimensiones del rol (`role_profile`): se compone únicamente de domain / work_type / time / process_position, sin sintetizarse en un solo cargo profesional. Solo se genera cuando existe una identidad con el consentimiento registrado de la persona.

El cotejo con los requisitos de las vacantes también se realiza sin establecer clasificaciones. La parte demandante declara en `grift project` las áreas, la verificación, el ritmo y las entradas que busca, y `grift align` las alinea eje por eje con las observaciones del candidato. Esta comparación se clasifica únicamente en 5 estados: solapamiento (overlap), fuera del rango declarado (outside_declared_range), cero observado (observed_zero), no observado (not_observed) o no declarado (not_declared), sin calcular puntuaciones globales, clasificaciones ni aptos/no aptos. Al consultar por equipos mediante `--team`, solo se indica el número de personas que cumplen los requisitos; si son menos de 3 personas, no se calcula la agregación para evitar que se identifique a individuos.

Cuando el tamaño de la muestra es inferior a 20, no se muestran tasas, sino solo el recuento de casos; y lo que no se pudo observar no se indica como «sin experiencia», sino como «no observado», especificando el motivo. `grift verify` recalcula un informe guardado bajo las mismas condiciones y devuelve si coincide, si discrepa o si no se puede verificar, lo que permite al receptor comprobar si hubo manipulaciones o discrepancias.

El nombre de la metodología es TEP (Technical Evidence Pipeline, flujo de extracción de evidencias técnicas). Consta de cuatro etapas: leer los registros de git, contar según reglas fijas, añadir denominador a los valores calculados y el motivo de lo que no pudo contabilizarse, y permitir que cualquiera pueda volver a realizar el recuento siguiendo el mismo procedimiento. Encontrará una explicación detallada en la [página de TEP](https://griftai.org/tep) dentro del sitio web de Grift.

La correspondencia entre los términos utilizados en esta página y en griftai.org y los vocablos que la CLI incluye en su salida es la siguiente:

| Expresión en el sitio | Término en la CLI |
|---|---|
| Valor de inspección | observed value (`kind: observed`; incluye valor, unidad y denominador) |
| Tasa de modificación conjunta de tests | test co-change |
| Tasa de retrabajo | corrective rework |
| Retoque | path retouch |
| Tasa de permanencia | survival (solo cuando se especifica `--survival`) |
| Contexto del repositorio | context profile |
| Áreas de trabajo / Ritmo de cambios / Forma de verificación | surface_profile / change_rhythm / verification_profile |

- Repositorio: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- Distribución: PyPI «grift-cli» (`pipx install grift-cli`, Python 3.11 o superior)
- Licencia: MIT
- Notas de la versión: [github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases) (cambios en cada versión)

## Resultados

El 8 de septiembre de 2026 publicamos la [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/) en PyPI. Las métricas se validaron en 117 repositorios públicos, y tanto las comparaciones que lograron distinguir diferencias como las que aún no lo han conseguido están publicadas en GitHub (son mediciones internas que no han sido auditadas por terceros).

El 25 de octubre de 2026 cotejamos línea por línea los textos del sitio web con la salida de la CLI. Dado que la lista de varias personas (`actor-index`) aparecía ordenada de mayor a menor número de commits pese a que en las notas se advertía de que «no constituía una clasificación», en la versión [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0), publicada el 26 de octubre de 2026, modificamos la ordenación para que fuera alfabética según el ID. Se conserva el valor del número de commits. Los antecedentes de esta decisión y los 5 criterios de aceptación fijados para la serie 0.8 se detallan en una [entrada de blog](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/).

Actualmente avanzamos con agencias de empleo y empresas de SES en la preparación de pruebas piloto (PoC) destinadas a fundamentar las razones de recomendación a partir de registros generados localmente por los propios candidatos. También atendemos consultas de responsables de selección de empresas con desarrollo propio interesados en pruebas piloto para verificar, mediante registros compartidos por los propios candidatos, qué tipo de trabajo han venido realizando. En función de los resultados de estas pruebas piloto, nuestro objetivo es comenzar a ofrecer la versión oficial en 2027. También presentamos Grift en [griftai.org](https://griftai.org).

La filosofía de Grift se explica asimismo en artículos de [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) y [note](https://note.com/cor_instrument/n/nd58ba0955317).
