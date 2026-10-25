---
title: "Grift — El currículum se puede inflar. La evidencia no. Software de código abierto para extraer hechos verificables del historial de Git"
description: "Grift, nuestro producto propio para extraer hechos verificables (valores de inspección) en lugar de puntuaciones a partir del historial de Git de los ingenieros. Presentamos el trasfondo y el diseño de cómo cambiamos el rumbo: desde una aplicación web de apoyo a estimaciones hacia una CLI de código abierto y asistencia para recomendaciones dirigida a agencias de empleo y empresas de SES."
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "Agencias de empleo", "SES"]
publishedAt: 2026-06-30
updatedAt: 2026-10-25
summary: "Grift es un producto propio que extrae «hechos verificables» del historial de Git de los ingenieros. No asigna puntuaciones ni clasificaciones. Al no utilizar IA (LLM) para la medición, produce los mismos resultados sin importar quién lo ejecute, permitiendo que el receptor verifique los cálculos. La CLI está disponible como software de código abierto bajo la licencia MIT."
isDraft: false
featured: true
lang: "es"
translationSourceHash: "0c724e7e86ea6f90f6f9849a4cbea6fd163e7d36fe697b9a345d8eb38f42ca18"
translatedAt: "2026-10-25T07:40:41.893Z"
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
-->

## El problema

Los agentes de contratación y los comerciales de SES (servicios de ingeniería de sistemas) deben explicar a las empresas «por qué recomiendan a esta persona» al presentar a un candidato. Sin embargo, en la práctica casi todo el material del que disponen se reduce al currículum y a las impresiones de la entrevista. Aunque figure «5 años de Java», esto no transmite la sustancia real del trabajo: qué tipo de cambios se realizaron y cómo se fueron verificando a lo largo del proceso.

Por otra parte, métricas de «volumen de actividad» como el gráfico de contribuciones o el número de commits en GitHub se pueden inflar fácilmente hoy en día utilizando IA generativa o agentes. La mera cantidad ya casi no sirve como fundamento para una recomendación. Y si se intenta condensar todo en una única puntuación, desaparece el detalle de qué se midió, en qué período y sobre qué población base, convirtiéndose en una herramienta de criba indiscriminada. Faltaba «material verificable», tanto para quienes recomiendan como para quienes son recomendados.

## Nuestro enfoque

Grift comenzó en febrero de 2026 como una aplicación web concebida para respaldar las estimaciones en proyectos de desarrollo por encargo. Al indagar en la base de dichas estimaciones, nos dimos cuenta de que la evidencia más sólida era el propio historial de git que los ingenieros van acumulando. Así, en agosto de 2026 desacoplamos la parte de medición para convertirla en una herramienta de línea de comandos. En septiembre suspendimos la antigua aplicación web y reorientamos el rumbo para apoyar a los comerciales de agencias de colocación y empresas de SES.

En el diseño establecimos tres compromisos previos:

- No convertir en puntuación: ofrecemos valores de inspección; el criterio corresponde a las personas. No generamos puntuaciones sintéticas, rankings, apto/no apto ni niveles de calificación; a cada cifra se le añaden siempre numerador y denominador.
- Mismo resultado en cada ejecución: no utilizamos IA (LLM) para la medición. Con el mismo repositorio y la misma versión, cualquier persona que lo ejecute obtendrá exactamente las mismas cifras.
- No se envía a ningún sitio: opera exclusivamente en el ordenador local. La persona decide si comparte o no la información y qué repositorios muestra.

Asimismo, fijamos un código de uso de siete normas, entre ellas «no interpretar la ausencia como algo negativo», «no cribar basándose únicamente en cifras» y «no medir a terceros sin su consentimiento», acordando no denominar con el nombre del método (TEP: Technical Evidence Pipeline) a ningún uso que no las respete.

## Implementación

Grift CLI extrae observaciones como las siguientes a partir únicamente del historial de git:

- Distinción de autoría: clasifica el trabajo de cada persona en 11 categorías, diferenciando entre commits propios del autor, trabajo ajeno, bots, artefactos generados o de proveedores, historiales heredados de bifurcaciones (forks), etc.
- Tasa de modificación conjunta de tests: proporción de commits en los que se modifican tests al mismo tiempo que el código de producción.
- Tasa de retrabajo y retoque: porcentaje de rectificaciones o reintervenciones sobre archivos modificados recientemente (se registra como tendencia; no se emplea para determinar aptitud).
- Contexto del repositorio: días de actividad real, número de personas implicadas, cuota del autor principal, porcentaje de cambios realizados mediante revisión, etc.

Con `report-v2`, incorporado en la versión v0.6, se amplía la capa para observar la forma de trabajar de un ingeniero individual. En todos los casos se muestran con numerador y denominador, y no constituyen una evaluación del perfil profesional ni de la capacidad:

- Superficie de trabajo (`surface_profile`): contabiliza cuántas modificaciones hubo en 11 categorías: test / docs / CI/CD / platform / data / observability / frontend / backend / config / generación y proveedores / otros.
- Ritmo de cambios (`change_rhythm`): días en los que se enviaron cambios en los últimos 180 días y el intervalo entre envíos (mediana y percentil 90, proporción de envíos sucesivos en menos de 2 días y proporción de pausas de 30 días o más). No mide horas de trabajo ni motivación.
- Forma de verificación (`verification_profile`): porcentaje de commits que tocaron tests y su tipología (unit / integration / e2e / contract / desconocida), junto con la proporción de commits de corrección (fix) acompañados de tests.
- 4 dimensiones del rol (`role_profile`): domain / work_type / time / process_position; no se reducen a un único puesto o titulación. Se emiten exclusivamente cuando existe una identidad con el consentimiento registrado de la persona.

El contraste con los requisitos de cada vacante también se realiza sin establecer clasificaciones ordenadas. La vacante declara en `grift project` las áreas, verificación, ritmo y entradas requeridas, y `grift align` las alinea eje por eje con las observaciones del candidato. Dicha alineación solo admite 5 estados: superposición (overlap), fuera de rango (outside_declared_range), 0 casos (observed_zero), no observado (not_observed) y no declarado (not_declared), sin calcular notas globales, clasificaciones ni resultados de apto/no apto. Al visualizarlo a escala de equipo con `--team`, solo se muestra el número de personas que satisfacen los requisitos; si son menos de 3 personas, no se agrega para evitar la identificación individual.

Cuando la población base es inferior a 20, no se calculan porcentajes y solo se indica el número de casos. Aquello que no se ha podido observar no se marca como «sin trayectoria», sino como «no observado» indicando el motivo. `grift verify` recalcula los informes guardados bajo las mismas condiciones y devuelve coincidencia, discrepancia o imposibilidad de verificación, lo que permite al receptor confirmar alteraciones o inconsistencias.

El método se denomina TEP (Technical Evidence Pipeline). La correspondencia entre los términos utilizados en esta página y en griftai.org y los empleados en la salida de la CLI es la siguiente:

| Término en el sitio | Término en la CLI |
|---|---|
| Valor de inspección | observed value (`kind: observed`; incluye valor, unidad y denominador) |
| Tasa de modificación conjunta de tests | test co-change |
| Tasa de retrabajo | corrective rework |
| Retoque | path retouch |
| Tasa de permanencia | survival (solo al especificar `--survival`) |
| Contexto del repositorio | context profile |
| Superficie de trabajo, ritmo de cambios, forma de verificación | surface_profile / change_rhythm / verification_profile |

- Repositorio: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- Distribución: PyPI «grift-cli» (`pipx install grift-cli`, Python 3.11 o superior)
- Licencia: MIT

## Resultados

El 8 de septiembre de 2026 publicamos la versión v0.7.2 en PyPI. Las métricas se verificaron en 117 repositorios públicos, y en GitHub se han hecho públicas tanto las comparaciones donde fue posible distinguir diferencias como aquellas donde aún no ha sido posible (se trata de mediciones internas, sin auditoría de terceros).

El 25 de octubre de 2026 cotejamos línea por línea el texto del sitio web con la salida de la CLI. Observamos que el listado de varias personas (`actor-index`) se ordenaba de mayor a menor número de commits, a pesar de que en la nota aclaratoria se indicaba que «no es una clasificación ordenada»; por ello, en la próxima versión (0.8) el orden pasará a ser lexicográfico por ID. El valor del número de commits se mantendrá. El trasfondo y las 5 condiciones de aceptación impuestas para la rama 0.8 se detallan en el [artículo del blog](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/).

Actualmente avanzamos con agencias de empleo y empresas de SES en la preparación de pruebas piloto (PoC) para fundamentar de manera concreta los motivos de recomendación a partir de los registros ejecutados localmente por los propios candidatos. De cara a la versión oficial, nuestro objetivo es iniciar su oferta en 2027 a partir de los resultados de dichas pruebas piloto. Grift también se presenta en [griftai.org](https://griftai.org).

Asimismo, la filosofía de Grift se explica en artículos de [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) y [note](https://note.com/cor_instrument/n/nd58ba0955317).
