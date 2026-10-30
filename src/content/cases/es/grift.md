---
title: "Grift: el currículum se puede inflar, las pruebas no. El software de código abierto que extrae hechos verificables del historial de git"
description: "Grift es nuestro producto propio que extrae hechos verificables (valores de inspección) en lugar de puntuaciones a partir del historial de git de un ingeniero. Presentamos el diseño y el trasfondo de cómo cambiamos el rumbo desde una aplicación web de ayuda para presupuestos hacia una CLI de código abierto y asistencia para recomendaciones dirigida a empresas de colocación y SES."
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "Intermediación laboral", "SES", "Contratación"]
publishedAt: 2026-06-30
updatedAt: 2026-10-28
summary: "Grift es un producto propio que extrae «hechos verificables» del historial de git de un ingeniero. No asigna puntuaciones ni clasificaciones. Al no utilizar IA (LLM) para la medición, cualquier persona que lo ejecute obtiene el mismo resultado y el receptor puede verificarlo. La CLI está disponible como software de código abierto bajo la licencia MIT."
isDraft: false
featured: true
lang: "es"
translationSourceHash: "ce7e4b679a9275c594e1988d06ee37cd223d1c0192af506aa307ea7b0c8f1ff6"
translatedAt: "2026-10-30T12:28:21.001Z"
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
2026-10-30: 0.9.2 の変更（Docker で実行、grift update、grift contribute の同意後の表示、リポジトリの文脈の年とタグの頻度）を「実装」と「成果」に足した。0.9.2 の公開後に出す。公開日は公開したら「成果」に足す。同日、release/v0.9.2 の CHANGELOG（c7e2a6e）と突き合わせ、grift update・grift contribute・文脈の表示の書き方を CHANGELOG と docs/usage.md に揃え、定義の版が変わったことを「成果」に足した。
-->

## Desafíos

Al recomendar a un candidato a una empresa, el personal de ventas de las agencias de selección de personal y de los servicios SES debe explicar por qué recomiendan a esa persona. Sin embargo, el material del que disponen suele limitarse al currículum y a las impresiones de las entrevistas. Aunque el currículum indique "5 años en Java", los detalles del trabajo real no se aprecian: qué tipo de modificaciones se realizaron ni de qué forma se fueron verificando.

Por otra parte, métricas del "volumen de actividad" como las contribuciones en GitHub o la cantidad de commits pueden inflarse fácilmente con agentes o herramientas de IA generativa. La gran cantidad de actividad ya no basta como fundamento para una recomendación. Al mismo tiempo, condensar todo en una única puntuación borra qué se midió, en qué período y sobre qué población base, convirtiéndose en una herramienta para descartar candidatos de forma automática. Tanto para la parte que recomienda como para la recomendada, faltaban datos verificables.

## Enfoque

Grift nació en febrero de 2026 como una aplicación web para respaldar las estimaciones en proyectos de desarrollo por contrato. Mientras se buscaban bases sólidas para dichas estimaciones, quedó claro que la fuente más confiable era el propio historial de Git construido por cada profesional de la ingeniería. Por ello, en agosto de 2026 se extrajo la funcionalidad de medición en forma de herramienta de línea de comandos. En septiembre se interrumpió el servicio de la aplicación web anterior y se reorientó la estrategia hacia el respaldo comercial de agencias de selección de personal y empresas de SES.

En el diseño se establecieron tres premisas iniciales:

- No convertir los datos en puntuaciones: la herramienta genera valores de inspección y las decisiones las toman las personas. No se emiten puntuaciones agregadas, clasificaciones, aptos/no aptos ni categorías profesionales, y los valores numéricos siempre van acompañados de numerador y denominador.
- Mismo resultado en cada ejecución: no se utiliza IA (LLM) en las mediciones. En un mismo repositorio y con la misma versión, cualquier persona que ejecute la herramienta obtendrá exactamente las mismas cifras.
- Sin envíos externos de información: funciona exclusivamente en la máquina local. Cada persona decide si comparte la información y qué repositorios incluye.

Asimismo, se redactó una norma de uso de siete artículos —que incluye principios como "no interpretar la ausencia como un aspecto negativo", "no descartar candidatos basándose únicamente en cifras" o "no medir a terceros sin su consentimiento explícito"— y se estableció que todo uso que incumpla esta norma no se considerará parte del método TEP (Technical Evidence Pipeline).

## Implementación

Grift CLI extrae observaciones directamente del historial de Git, tales como:

- Distinción de autoría: categorización en 11 clases para desglosar de quién es el trabajo (commits propios, trabajo de terceros, bots, artefactos generados o de proveedores, historiales heredados de forks, etc.).
- Tasa de modificación conjunta de pruebas: porcentaje de commits en los que se modifican pruebas al mismo tiempo que el código de producción.
- Tasa de retrabajo y retoque: tasa de correcciones y retoques sobre archivos modificados recientemente (se registra como una tendencia; no se utiliza como criterio de aprobado/reprobado).
- Contexto del repositorio: días de actividad efectiva, número de participantes y porcentaje del autor principal, proporción de cambios mediante revisión de código, entre otros.

Con `report-v2`, añadido en la versión v0.6, se incorporó una capa adicional para observar la forma de trabajar del profesional de la ingeniería. Todas las métricas se presentan con numerador y denominador, sin emitir juicios sobre puestos o capacidades:

- Áreas de trabajo (`surface_profile`): número de modificaciones por área según 11 categorías: test / docs / CI/CD / platform / data / observability / frontend / backend / config / generados o proveedores / otros.
- Ritmo de cambios (`change_rhythm`): días con envíos de cambios dentro de los últimos 180 días e intervalos entre dichos envíos (mediana y percentil 90, porcentaje de envíos continuados en un lapso de 2 días y porcentaje de intervalos de 30 días o más). No mide horas de trabajo ni nivel de motivación.
- Forma de verificación (`verification_profile`): proporción de commits con cambios en pruebas y su desglose por tipo (unit / integration / e2e / contract / desconocido), así como la proporción de commits de corrección (fix) acompañados de pruebas.
- 4 dimensiones de rol (`role_profile`): domain / work_type / time / process_position; no se simplifican en un único puesto laboral. Solo se generan si existe una identidad vinculada al consentimiento explícito de la persona.

El contraste con los requisitos de las vacantes se realiza también sin asignar clasificaciones o posiciones. Quien gestiona la vacante declara mediante `grift project` las áreas, la verificación, el ritmo y las entradas solicitadas; a continuación, `grift align` alinea cada eje con las observaciones del candidato. Dicha correspondencia solo admite 5 estados: solapamiento (overlap), fuera del rango declarado (outside_declared_range), cero observado (observed_zero), no observado (not_observed) y no declarado (not_declared), sin calcular puntuaciones globales, clasificaciones ni resultados de aptitud. Al analizar a nivel de equipo mediante `--team`, solo se indica el número de personas que satisfacen los requisitos; si el grupo es menor a 3 personas, no se agrega para evitar la identificación individual.

Si la población base es menor a 20, no se muestran tasas porcentuales sino únicamente el recuento absoluto; aquello que no haya podido observarse se clasifica como "no observado" con su respectiva justificación, en lugar de "sin historial". Mediante `grift verify` es posible recalcular los informes guardados bajo las mismas condiciones y comprobar si coinciden, discrepan o no se pueden verificar, lo que permite a la parte receptora certificar la ausencia de alteraciones o discrepancias.

A partir de la versión 0.9.0, al inicio del Markdown generado por `grift actor` se añade un breve texto descriptivo sobre la forma de trabajar que reflejan los registros. Se detallan las áreas modificadas, el ritmo de cambios, la cobertura de pruebas y la forma de participación, indicando recuentos y períodos; a continuación, se describe lo que este registro no permite ver y se formulan preguntas sugeridas para profundizar durante las entrevistas. `grift project` describe la dinámica del repositorio del proyecto siguiendo las mismas reglas, omitiendo las cifras individuales y la forma de implicación por persona. `grift align` acompaña la comparativa de requisitos y registros con preguntas orientadas a la entrevista. Tanto las descripciones como las preguntas se seleccionan a partir de los datos numéricos mediante una [tabla de decisiones](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/trait-profile.md) pública, sin recurrir a IA. Al no incluirse en el JSON, la verificación cruzada mediante `grift verify` comprueba las cifras que originaron el texto.

Los textos y preguntas sobre una persona se muestran únicamente si esta cuenta con una identidad declarada y un registro formal de consentimiento. En caso contrario, se incluye una frase explicando el motivo de la omisión. No se generan textos descriptivos al listar a varias personas de forma conjunta (`--all`, `--top`).

La metodología se denomina TEP (Technical Evidence Pipeline, flujo de extracción de evidencias técnicas). Se compone de cuatro fases: leer los registros de Git, cuantificar conforme a reglas predeterminadas, acompañar los valores con denominadores y los motivos de lo que no pudo medirse, y permitir que cualquiera pueda repetir el cálculo siguiendo el mismo procedimiento. Encontrará información detallada en la [página de TEP](https://griftai.org/tep) dentro del sitio web de Grift.

A continuación se muestra la correspondencia entre los términos empleados en esta página y en griftai.org y los utilizados en la salida de la CLI:

| Términos en la web | Términos en la CLI |
|---|---|
| Valores de inspección | observed value (`kind: observed`; se acompaña de valor, unidad y denominador) |
| Tasa de modificación conjunta de pruebas | test co-change |
| Tasa de retrabajo | corrective rework |
| Retoque | path retouch |
| Code recency | survival (únicamente al especificar `--survival`) |
| Contexto del repositorio | context profile |
| Áreas de trabajo, ritmo de cambios y forma de verificación | surface_profile / change_rhythm / verification_profile |

A partir de la versión 0.9.0, el formato Markdown de la CLI adopta para los cuatro aspectos —distribución de modificaciones (áreas de trabajo), ritmo de cambios (ritmo de cambios), verificación de pruebas (forma de verificación) y grado de implicación— las mismas denominaciones que en griftai.org. Las claves del JSON permanecen sin cambios.

En la versión 0.9.2 se habilitó la posibilidad de ejecución mediante una imagen de Docker construida desde el repositorio de grift-cli, sin necesidad de instalar Python en el sistema anfitrión. Es preciso descargar el historial completo del repositorio que se desea analizar y pasarlo a `/repo`. No se admiten árboles de trabajo creados con `git worktree`.

`grift update` se modificó para que actualice exclusivamente el entorno en ejecución y muestre la versión instalada tras la actualización, sin afectar a otros entornos presentes en PATH. `grift update --check` se limita a consultar la información de la última versión en PyPI sin aplicar actualizaciones. No se realizan actualizaciones automáticas ni conexiones para comprobar versiones en los comandos habituales de medición.

`grift contribute` guarda el archivo para presentación de forma local tras obtener el consentimiento del usuario. No se envía de forma automática. Los archivos generados con el comando predeterminado `--door local` no pueden remitirse a canales públicos; por ello, no se muestran el ID de envío, el nombre de archivo dentro del PR ni las líneas meta, indicándose únicamente los pasos para regenerarlos con `--door public-pr`. Para envíos públicos se utilizan el ID de presentación, el nombre de archivo en el PR y las líneas meta generados al rehacer el proceso, junto con las URL de las dos vías de entrega disponibles. El contenido del archivo será público, con independencia de si el PR público lo realiza la propia persona o se tramita de forma delegada y anónima.

- Repositorio: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- Distribución: PyPI "grift-cli" (`pipx install grift-cli`, requiere Python 3.11 o superior)
- Licencia: MIT
- Notas de la versión: [github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases) (detalles de cambios por versión)

## Resultados

El 8 de septiembre de 2026 se publicó la versión [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/) en PyPI. Las métricas se evaluaron sobre 117 repositorios públicos, publicándose en GitHub tanto las comparaciones donde fue posible distinguir diferencias como aquellas en las que aún no (medición interna, sin auditoría de terceros).

El 25 de octubre de 2026 se revisaron línea por línea las discrepancias entre la web y la salida de la CLI. Al comprobar que la lista de múltiples personas (`actor-index`) aparecía ordenada por número de commits —a pesar de indicar en las notas que no implicaba un ranking—, se corrigió en la versión [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0), lanzada el 26 de octubre de 2026, pasando a ordenarse por orden alfabético de ID. Se conservó el valor de número de commits. Los detalles y los cinco criterios de aceptación fijados para la serie 0.8 se describen en este [artículo del blog](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/).

En la versión [0.9.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0), lanzada el 27 de octubre de 2026, se incorporaron el texto descriptivo inicial y las preguntas para la entrevista en el informe. Al mismo tiempo, se retiraron del Markdown las líneas sobre la "intensidad" de las tendencias y la "orientación" en las comparativas, dado que al contrastar dos informes podían interpretarse erróneamente en términos de personas fuertes/débiles o compatibles/incompatibles. También se subsanaron cuatro aspectos que podían dar lugar a recuentos inexactos sobre las personas.

En la versión [0.9.1](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.1), publicada el 28 de octubre de 2026, se corrigieron discrepancias detectadas con posterioridad a la versión 0.9.0 que podían inducir a cifras no ajustadas a la realidad sobre personas o proyectos. No se añadieron comandos nuevos ni se modificó la política de no emitir puntuaciones, posiciones ni categorías. Dado el cambio de versión en las definiciones, los informes y comparativas guardados en 0.9.0 ya no se pueden verificar con el comando `grift verify` de 0.9.1 (las excepciones, como informes de proyectos creados únicamente a partir de requisitos, se detallan en las [notas de migración](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.1/docs/migration-v091.md)).

En la versión [0.9.2](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.2), dentro de la sección de contexto del repositorio en el Markdown de `grift report`, se muestran el primer y último año con actividad registrada en el historial analizado, así como el numerador y denominador de la frecuencia de etiquetas (tags). Los valores de JSON se mantienen sin cambios. El último año registrado también se muestra en perfiles que continúan en activo, por lo que no debe interpretarse como desvinculación o baja laboral. La frecuencia de etiquetas es un valor anualizado obtenido de "número de etiquetas ÷ días del período de actividad × 365,25", y no equivale a la cantidad real de lanzamientos registrados. En repositorios con menos de 20 días de actividad no se realiza el cálculo anualizado, mostrándose únicamente la cantidad de etiquetas y los días.

No se introdujeron nuevos comandos ni se alteró el principio de omitir puntuaciones, clasificaciones o veredictos de aptitud. Tampoco se modificaron los valores de análisis; sin embargo, al actualizarse la versión de las definiciones, los informes y contrastes guardados con la versión 0.9.1 dejan de ser verificables con `grift verify` en 0.9.2 (las excepciones, como los informes de vacantes generados solo a partir de requisitos, pueden consultarse en las [notas de migración](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.2/docs/migration-v092.md)).

Actualmente se coordinan pruebas de concepto (PoC) con agencias de selección y firmas de SES para fundamentar los motivos de recomendación mediante registros generados localmente por los propios candidatos. Asimismo, se atienden consultas de equipos de selección de empresas de producto propio interesados en realizar PoC para validar la experiencia técnica a partir de registros compartidos por los postulantes. El lanzamiento de la versión formal está previsto para 2027 a partir de los resultados de estas pruebas piloto. Dispone de más detalles sobre Grift en [griftai.org](https://griftai.org).

Los fundamentos y filosofía de Grift se encuentran también explicados en los artículos de [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) y [note](https://note.com/cor_instrument/n/nd58ba0955317).
