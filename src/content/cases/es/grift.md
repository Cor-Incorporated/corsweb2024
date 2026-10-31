---
title: "Grift: el currículum se puede inflar, las pruebas no. Un proyecto OSS que extrae hechos verificables del historial de git"
description: "Grift es nuestro producto propio que extrae hechos verificables (valores de inspección), y no puntuaciones, del historial de git de los ingenieros. Presentamos el diseño y el proceso por el cual cambiamos nuestro rumbo, pasando de una aplicación web para la estimación de costes a una CLI de código abierto (OSS) y al soporte de recomendaciones para agencias de empleo y empresas de SES."
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "agencias de empleo", "SES", "contratación"]
publishedAt: 2026-06-30
updatedAt: 2026-10-31
summary: "Grift es un producto propio que extrae «hechos verificables» del historial de git de los ingenieros. No asigna puntuaciones ni clasificaciones. Al no utilizar IA (LLM) para las mediciones, cualquiera que lo ejecute obtendrá el mismo resultado y el receptor podrá comprobar los cálculos. La CLI está disponible como OSS bajo la licencia MIT."
isDraft: false
featured: true
lang: "es"
translationSourceHash: "6ef8194a514d202c2b450d889b28ec82bda30c14a0122cd1097c0e3a21d0f2b1"
translatedAt: "2026-10-31T06:22:58.156Z"
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
2026-10-30: 0.9.2 の変更（Docker で実行、grift update、grift contribute の同意後の表示、リポジトリの文脈の年とタグの頻度）を「実装」と「成果」に足した。0.9.2 は 2026-10-31 に PyPI へ公開（Release v0.9.2）。2026-10-31 に公開日を「成果」に足した。同日、release/v0.9.2 の CHANGELOG（c7e2a6e）と突き合わせ、grift update・grift contribute・文脈の表示の書き方を CHANGELOG と docs/usage.md に揃え、定義の版が変わったことを「成果」に足した。
-->

## El problema

Los agentes comerciales de las agencias de selección de personal y de las empresas de SES deben explicar "por qué recomiendan a esta persona" al presentar a un candidato a una empresa. Sin embargo, el material del que disponen casi se reduce al currículum y a las impresiones de una entrevista. Aunque conste "5 años en Java", no se transmite el fondo del trabajo: qué cambios realizó y cómo los fue verificando sobre la marcha.

Por otra parte, la "cantidad de actividad", como el historial de contribuciones (los cuadros verdes) o el número de commits en GitHub, se ha vuelto fácil de inflar con IA generativa o agentes. Disponer de un gran volumen ya apenas sirve como justificación de una recomendación. Con todo, si se resume en una sola puntuación, desaparece qué se midió, en qué periodo y sobre qué denominador, acabando por usarse como una herramienta de descarte. Tanto al que recomienda como al que es recomendado les faltaba un "material contrastable".

## Nuestro enfoque

Grift comenzó en febrero de 2026 como una aplicación web concebida para respaldar las estimaciones en proyectos de desarrollo por encargo. Al indagar sobre la base de dichas estimaciones, nos dimos cuenta de que el material más certero era el propio historial de git que el desarrollador había ido acumulando; en agosto de 2026 separamos la parte de medición como una herramienta de línea de comandos. En septiembre dejamos de ofrecer la antigua aplicación web y reorientamos el rumbo hacia el apoyo comercial a las agencias de contratación y de SES.

En el diseño establecimos tres compromisos previos:

- No convertirlo en una nota: Lo que se emite son valores de inspección y quien juzga es una persona. No se generan puntuaciones compuestas, clasificaciones, aprobados/suspensos ni niveles; los valores numéricos van acompañados siempre de numerador y denominador.
- El mismo resultado cada vez: No se utiliza IA (LLM) para la medición. Con el mismo repositorio y la misma versión, cualquiera que lo ejecute obtendrá los mismos valores numéricos.
- No se envía a ninguna parte: Funciona únicamente en el PC local. La propia persona decide si lo comparte y qué repositorios muestra.

Asimismo, establecimos un código de uso de siete artículos ("no interpretar la ausencia como algo negativo", "no descartar solo por los números", "no medir a terceros sin su consentimiento", etc.) y acordamos que cualquier uso que no lo respete no podrá denominarse con el nombre del método (TEP: Technical Evidence Pipeline).

## Implementación

Grift CLI extrae observaciones como las siguientes únicamente a partir del historial de git:

- Distinción de autoría: Separa de quién es el trabajo en 11 clasificaciones, entre las que se incluyen commits propios de la persona, trabajo de terceros, bots, artefactos generados o de proveedores, e historial heredado desde un fork de origen.
- Tasa de modificación conjunta de pruebas: Porcentaje de ocasiones en las que, en el mismo commit donde se modificó el código de producción, también se modificaron pruebas.
- Tasa de retrabajo y retoque: Porcentaje de reelaboraciones o de retoques sobre los archivos tocados recientemente (se trata del registro de una tendencia; no se utiliza para evaluar aptitud).
- Contexto del repositorio: Días de trabajo efectivo, número de personas implicadas y cuota del autor principal, porcentaje canalizado a través de revisiones, etc.

Con `report-v2`, añadido en la v0.6, se amplía la capa para observar la forma de trabajar de un ingeniero. Todas las métricas incluyen numerador y denominador, y no constituyen una valoración del puesto ni de la capacidad.

- Áreas de trabajo (`surface_profile`): Cuántas modificaciones se realizaron en qué áreas, clasificadas en 11 categorías: test / docs / CI/CD / platform / data / observability / frontend / backend / config / generados o proveedores / otros.
- Ritmo de cambios (`change_rhythm`): Días en los que se enviaron cambios en los últimos 180 días e intervalos entre entregas (mediana y percentil 90, porcentaje de entregas consecutivas en 2 días o menos, porcentaje con un espacio de 30 días o más). No indica horas de trabajo ni grado de motivación.
- Forma de verificación (`verification_profile`): Porcentaje de commits en los que se tocaron pruebas y sus tipos (unit / integration / e2e / contract / desconocido), así como el porcentaje de commits de fix que fueron acompañados de pruebas.
- 4 dimensiones del rol (`role_profile`): Únicamente se compone de domain / work_type / time / process_position; no se sintetiza en un único puesto de trabajo. Solo se muestra cuando existe un identity con el consentimiento registrado de la persona.

El cotejo con la vacante o proyecto también se realiza de forma que no se establezcan clasificaciones. El lado del proyecto declara las áreas, la verificación, el ritmo y las entradas que busca en `grift project`, y `grift align` las contrasta eje por eje con las observaciones del candidato. Dicho alineamiento solo se compone de cinco estados: solapamiento (overlap), fuera del rango declarado (outside_declared_range), cero casos (observed_zero), no observado (not_observed) y sin requerimiento (not_declared); no se calculan notas globales, clasificaciones ni resultados de aptitud. Al observarlo a escala de equipo con `--team`, solo se muestra el número de personas que satisfacen el requisito; para menos de 3 personas no se computa el agregado porque se identificaría al individuo.

Si el denominador es inferior a 20, no se muestra un porcentaje sino únicamente el número de casos; aquello que no pudo observarse no se muestra como "sin experiencia/logros", sino como "no observado" con su motivo correspondiente. `grift verify` recalcula el informe guardado bajo las mismas condiciones y devuelve coincidencia, discrepancia o no verificable, de modo que la parte receptora puede confirmar alteraciones o discrepancias.

A partir de la versión 0.9.0, al principio del Markdown de `grift actor` se redacta con frases breves la forma de trabajar que se desprende del registro. Se describe la distribución de las partes modificadas, el ritmo de los cambios, la forma de incorporar pruebas y la manera de participar, aportando el número de casos y el periodo; a continuación, se indica lo que no se aprecia en este registro y se enumeran, en forma de preguntas, los aspectos que conviene contrastar en una entrevista. `grift project` describe la forma de trabajar del repositorio del proyecto siguiendo las mismas reglas, sin mostrar cifras individuales ni la forma de participación. `grift align` añade, a la alineación entre requisitos y registros, los puntos que se sugiere contrastar en una entrevista formulados como preguntas. Tanto las frases como las preguntas se seleccionan a partir de cifras mediante una [tabla de decisión](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/trait-profile.md) pública, sin recurrir a IA. Al no incluirse en el JSON, lo que se puede comprobar con `grift verify` son las cifras que sirven de base a esas frases.

Las frases y las preguntas relativas a una persona solo se muestran cuando se trata de una identidad declarada por el propio interesado y existe constancia de su consentimiento. En caso contrario, se describe en una sola frase el motivo por el cual no se emiten. Cuando se presenta a varias personas de forma conjunta (`--all`, `--top`), no se muestran frases.

El método recibe el nombre de TEP (Technical Evidence Pipeline, flujo de extracción de evidencia técnica). Se compone de cuatro fases: leer los registros de git, realizar el cómputo mediante reglas fijas, añadir al valor computado el denominador y el motivo de lo que no pudo contarse, y permitir que cualquiera pueda recalcularlo siguiendo el mismo procedimiento. Encontrará una explicación detallada en la [página de TEP](https://griftai.org/tep) del sitio web de Grift.

La correspondencia entre los términos usados en esta página y en griftai.org y las palabras que la CLI imprime en la salida es la siguiente:

| Términos en la web | Términos de la CLI |
|---|---|
| Valores de inspección | observed value (`kind: observed`; se acompañan de valor, unidad y denominador) |
| Tasa de modificación conjunta de pruebas | test co-change |
| Tasa de retrabajo | corrective rework |
| Retoque | path retouch |
| Code recency | survival (solo al especificar `--survival`) |
| Contexto del repositorio | context profile |
| Áreas de trabajo, ritmo de cambios y forma de verificación | surface_profile / change_rhythm / verification_profile |

A partir de la versión 0.9.0, el Markdown de la CLI también redacta las cuatro perspectivas —distribución de las partes modificadas (áreas de trabajo), ritmo de los cambios (ritmo de cambios), forma de incorporar pruebas (forma de verificación) y manera de participar— con la misma denominación que en griftai.org. Las claves del JSON no cambian.

En la versión 0.9.2, hicimos posible la ejecución con una imagen Docker creada a partir del repositorio grift-cli, sin necesidad de instalar Python en el host. El repositorio que se desee leer debe obtenerse con su historial completo y pasarse a `/repo`. No se pueden utilizar árboles de trabajo creados con `git worktree`.

Se ha modificado `grift update` para que actualice únicamente el entorno en ejecución y muestre la versión instalada tras la actualización. No utiliza otro entorno que se encuentre en el PATH. `grift update --check` solo lee la información de la última versión en PyPI; no actualiza. No existen actualizaciones automáticas ni comunicaciones en los comandos habituales de medición para comprobar la versión.

`grift contribute` guarda localmente el archivo para la presentación tras obtener el consentimiento del interesado. No se envía de forma automática. Dado que el archivo generado con el valor predeterminado `--door local` no puede remitirse al canal público de recepción, no se muestran el ID de entrega, el nombre del archivo en la PR ni la línea meta, sino únicamente las instrucciones para regenerarlo con `--door public-pr`. Al presentarlo públicamente, se utilizan el ID de entrega, el nombre del archivo en la PR y la línea meta mostrados por la ejecución regenerada, junto con las URL de las dos vías de presentación. Tanto si es una PR pública remitida por el interesado como si es una PR delegada con la identidad preservada, el contenido del archivo será público.

- Repositorio: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- Distribución: PyPI «grift-cli» (`pipx install grift-cli`, Python 3.11 o superior)
- Licencia: MIT
- Notas de la versión: [github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases) (cambios entre versiones)

## Resultados

El 8 de septiembre de 2026 publicamos la versión [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/) en PyPI. Las métricas se verificaron en 117 repositorios públicos, y en GitHub se han hecho públicas tanto las comparaciones donde se pudo discriminar como aquellas donde aún no ha sido posible (se trata de mediciones internas; no han sido sometidas a auditorías de terceros).

El 25 de octubre de 2026 contrastamos, línea por línea, la redacción del sitio web con las salidas de la CLI. Dado que el listado de múltiples personas (`actor-index`) se ordenaba de mayor a menor número de commits a pesar de que en las notas se advertía de que "no es una clasificación", en la versión [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0), publicada el 26 de octubre de 2026, cambiamos el orden alfabético por ID. El valor del número de commits se mantiene. Los antecedentes y los cinco criterios de aceptación fijados para la serie 0.8 se detallan en una [entrada de blog](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/).

En la versión [0.9.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0), publicada el 27 de octubre de 2026, añadimos las frases iniciales del informe y las preguntas para la entrevista descritas anteriormente. Al mismo tiempo, retiramos del Markdown la línea de "intensidad" de las tendencias y la línea de "orientación" en el cotejo. Esto se debe a que, al contrastar dos informes, podían interpretarse como personas fuertes o débiles, o personas idóneas o no idóneas. También corregimos cuatro puntos en los que podían aparecer cifras discrepantes con la realidad en lo relativo a las personas.

En la versión [0.9.1](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.1), publicada el 28 de octubre de 2026, corregimos los puntos detectados tras la 0.9.0 en los que podían aparecer cifras discrepantes con la realidad acerca de personas o proyectos. No se añadieron comandos nuevos y se mantiene la política de no emitir puntuaciones, clasificaciones ni nombres de tipologías. Debido al cambio en la versión de las definiciones, los informes y cotejos guardados con la 0.9.0 ya no se pueden recalcular con `grift verify` de la 0.9.1 (las excepciones, como los informes de proyectos elaborados exclusivamente a partir de requisitos, se detallan en las [notas de migración](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.1/docs/migration-v091.md)).

En la versión [0.9.2](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.2), publicada el 31 de octubre de 2026, hicimos que en la sección de contexto del repositorio del Markdown de `grift report` se muestren el primer y el último año con actividad en el historial observado, así como el numerador y el denominador de la frecuencia de etiquetas. Los valores del JSON no cambian. Dado que el último año de actividad también se muestra a quienes siguen activos actualmente, no denota desvinculación o abandono. La frecuencia de etiquetas es un valor anualizado de «número de etiquetas ÷ días del periodo de actividad × 365,25», y no representa el número de lanzamientos observados. En repositorios con un periodo de actividad inferior a 20 días no se anualiza y solo se muestra el número de etiquetas y de días.

No hay comandos nuevos y se mantiene el criterio de no emitir puntuaciones, clasificaciones ni decisiones de aptitud. Tampoco hay correcciones que alteren los valores del análisis, pero, al haberse incrementado la versión de las definiciones, los informes y cotejos guardados con la 0.9.1 ya no se podrán recalcular con `grift verify` de la 0.9.2 (las excepciones, como los informes de proyectos elaborados exclusivamente a partir de requisitos, se detallan en las [notas de migración](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.2/docs/migration-v092.md)).

Actualmente estamos preparando pruebas piloto (PoC) con agencias de colocación y empresas de SES para concretar las razones de recomendación a partir de los registros que los propios candidatos han ejecutado en local. Asimismo, atendemos consultas de responsables de selección de empresas de desarrollo propio que deseen realizar pruebas piloto (PoC) para verificar el trabajo realizado por los candidatos a partir de los registros compartidos por ellos mismos. En cuanto a la versión oficial, prevemos comenzar a ofrecerla en 2027 tomando como base los resultados de estas pruebas piloto. Grift también se presenta en [griftai.org](https://griftai.org).

La filosofía de Grift también se expone en sendos artículos en [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) y [note](https://note.com/cor_instrument/n/nd58ba0955317).
