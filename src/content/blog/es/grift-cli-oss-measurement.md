---
title: "¿Qué ocurre al probar en proyectos OSS reales una herramienta que no califica con puntuaciones? Medimos cuatro repositorios con Grift CLI 0.8.0"
description: "Con la próxima versión de Grift CLI (0.8.0), medimos cuatro proyectos OSS: click, flask, httpx y commander.js. Presentamos los comandos y sus salidas tal cual, detallando qué se pudo observar, qué no y cómo interpretar erróneamente los números. No comparamos la superioridad ni inferioridad entre repositorios."
summary: "Al medir cuatro proyectos OSS con la próxima versión de Grift CLI (0.8.0), cada observación finalizó en menos de 2,5 segundos y todos los elementos coincidieron con el recálculo de grift verify. Si bien se obtienen valores para el área de trabajo, los intervalos de cambio y la forma de validación, aspectos como las revisiones, la gestión de incidencias y la experiencia individual permanecen sin observar, indicando el motivo. Dado que los valores están determinados por las reglas de rutas y la ventana de observación, no es posible comparar los repositorios entre sí para juzgar cuál es mejor."
pubDate: 2026-10-25
author: "Terisuke"
category: "engineering"
ctaIntent: "grift-team-beta"
tags: ["Grift", "OSS", "CLI", "git", "実測"]
lang: "es"
featured: false
isDraft: false
translationSourceHash: "1a6743e05b9509c026319d50ed64815235cd876ba8f948088f196f9f7252180d"
translatedAt: "2026-10-25T14:27:31.750Z"
translationModel: "gemini-3.8-flash"
---

Grift CLI promete extraer hechos comprobables del historial de git, sin asignar puntuaciones ni clasificaciones. Ahora bien, ¿qué ocurre cuando se ejecuta en proyectos OSS reales? El 25 de octubre de 2026, Cor. midió cuatro proyectos OSS con la siguiente versión (0.8.0).

En este artículo presentamos el procedimiento y la salida tal cual. No comparamos la superioridad o inferioridad entre repositorios. Las diferencias en los valores se describen como diferencias en las características de cada repositorio. Lo que se decidió corregir en la versión 0.8 se detalla en el artículo del mismo día: «[Cómo proteger en la implementación el principio de "sin puntuaciones ni clasificaciones"](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/)».

## Lo que no incluimos en este artículo

El informe de un repo incluye también la lista de personas que han participado en ese repositorio. En este artículo no incluimos ni una sola cifra a nivel individual. Publicarlas implicaría ordenar a contribuidores reales mediante números, lo que supondría hacer pública una observación sin el consentimiento de la persona. Tampoco se han utilizado `grift actor`, `--actors` ni `--top`.

A fecha de 25 de octubre de 2026, la versión 0.8.0 no está publicada en PyPI. La versión pública es la 0.7.2, y la 0.8.0 se encuentra en preparación para su publicación.

## Entorno y objetos medidos

- grift 0.8.0 (versión de definición `tep-v0.8.0-2026-10-25`). Se instaló localmente el código fuente previo a la publicación (`87076c8` del repositorio de desarrollo)
- Para comparar, también se ejecutó la versión pública 0.7.2 sobre los mismos cuatro proyectos
- Apple M4 Max, macOS 26.7.1, Python 3.12.9, git 2.54.0

Los objetos medidos son cuatro repositorios locales que no se han actualizado desde que se clonaron el 2 de septiembre de 2026. Se midieron en ese estado, sin volver a clonarlos.

| Repositorio | Características | HEAD medido | Fecha del HEAD |
|---|---|---|---|
| [pallets/click](https://github.com/pallets/click) | Biblioteca de CLI para Python | `36baa15ff831b939a22bc527cd76ce653ef6f66d` | 2026-08-26 |
| [pallets/flask](https://github.com/pallets/flask) | Framework web para Python | `d318b683471101618febed18996405ad26462110` | 2026-08-16 |
| [encode/httpx](https://github.com/encode/httpx) | Cliente HTTP para Python | `b5addb64f0161ff6bfe94c124ef76f6a1fba5254` | 2026-02-23 |
| [tj/commander.js](https://github.com/tj/commander.js) | Biblioteca de CLI para JavaScript | `ba6d13ddb4243e5913367734f8c159089ffe7834` | 2026-05-29 |

## Comandos ejecutados

Para permitir reproducir los mismos valores de forma local, mostramos los comandos tomando click como ejemplo.

```bash
git clone https://github.com/pallets/click
git -C click checkout 36baa15ff831b939a22bc527cd76ce653ef6f66d
grift repo click --format both --out out/click
grift verify out/click/report.json --repo click
```

`grift repo` observa todo el repositorio y escribe `report.json` y `report.md`. `grift verify` recalcula bajo las condiciones registradas en el informe y compara todos los elementos. Incluso con un click recién clonado y ajustado a este SHA, el resultado fue idéntico al local, salvo por la hora de ejecución (`analyzed_at`).

También se midió con el mismo código fuente de la versión pública 0.7.2 (la versión instalada mediante `pipx install grift-cli`), y los valores observados mostrados en este artículo fueron idénticos a los de la 0.8.0. Lo que cambió en la 0.8.0 fue el orden de la lista de personas y las notas. Las diferencias se verifican en una sección posterior.

## Resultados de la observación de los cuatro proyectos

| Elemento | click | flask | httpx | commander.js |
|---|---|---|---|---|
| Tiempo de ejecución de `grift repo` | 1,57 s | 2,32 s | 1,16 s | 1,14 s |
| Resultado de `grift verify` | VERIFIED (1,62 s) | VERIFIED (2,40 s) | VERIFIED (1,33 s) | VERIFIED (1,28 s) |
| Commits humanos (excluyendo merge) | 2.000 | 3.674 | 1.335 | 1.095 |
| Merge commits | 1.131 | 1.691 | 41 | 284 |
| Commits de bots excluidos | 200 | 191 | 147 | 138 |
| Denominador del área de trabajo (commits humanos con path obtenido) | 1.999 | 3.673 | 1.333 | 1.094 |
| Área de trabajo test | 562 | 627 | 575 | 286 |
| Área de trabajo docs | 1.024 | 1.841 | 501 | 468 |
| Área de trabajo backend | 1.158 | 1.765 | 874 | 0 |
| Área de trabajo other | 309 | 575 | 112 | 530 |
| Ventana para contar intervalos de cambios (180 días) | 2026-02-27 a 2026-08-26 | 2026-02-17 a 2026-08-16 | 2025-08-27 a 2026-02-23 | 2025-11-30 a 2026-05-29 |
| Commits dentro de la ventana / Días de actividad | 187 commits / 62 días | 32 commits / 19 días | 11 commits / 8 días | 22 commits / 18 días |
| Mediana del intervalo / p90 | 0,08 días / 3,36 días | 0,80 días / 15,60 días | No observado (muestra insuficiente) | 2,88 días / 17,89 días |
| Commits que incluyen test | 562 / 2.000 | 627 / 3.674 | 575 / 1.335 | 286 / 1.095 |
| Commits con asunto de fix que también modificaron test | 80 / 249 | 58 / 408 | 46 / 114 | 30 / 106 |
| Tipo de test (determinado por path) | unit 555, desconocido 23 | unit 484, desconocido 204 | unit 554, desconocido 101 | desconocido 286 |
| Origen (origin) | Todos los commits excepto bots son unresolved | Mismo | Mismo | Mismo |
| Elementos no observados (not_observed) | 23 | 23 | 27 | 23 |

Dado que un único commit puede corresponder a varias categorías, la suma de las áreas de trabajo supera el denominador.

No es posible determinar qué repositorio es mejor leyendo esta tabla horizontalmente. El motivo se detalla más adelante, en la sección «Interpretaciones erróneas de los números».

## Lo que no fue visible

«No observado» (not_observed) significa «no se pudo medir» y no «no hubo actividad o logros». El informe incluye la razón correspondiente a cada elemento no observado. Las razones de los 23 elementos que aparecieron comúnmente en los cuatro proyectos son las siguientes. Las razones duplicadas en el campo de entrada se han agrupado en una sola fila.

| Elemento no observado | Razón (reason) | Requisitos para observar |
|---|---|---|
| Revisiones, gestión de incidencias, eventos y sus intervalos | `forge_export_not_provided`, `tracker_export_not_provided` | Archivos de exportación de forge y tracker (`--forge-export`, `--tracker-export`) |
| Experiencia, rol, contexto de la biblioteca | `consenting_actor_required` | Identity de la persona con consentimiento registrado |
| Relación con upstream, herencia de plantillas | `no_upstream_lineage`, `parent_repo_not_provided`, `template_not_provided` | Rutas del repositorio padre o de la plantilla |
| Período en el que se concentra el 80% de los commits de la propia empresa | `no_tenant_commits` | Identity con las direcciones de correo corporativas definidas |
| Tasa de permanencia (survival) | `survival_scan_disabled` | `--survival` (requiere tiempo) |
| Declaración de eventos posteriores al trabajo | `outcome_declaration_not_provided` | `--outcome-declaration` |
| Retrabajo a nivel de línea | `deferred_to_v0.6` | No aparece en la versión 0.8.0 |

En httpx se añadieron cuatro elementos correspondientes a los intervalos de cambios (mediana, p90, porcentaje dentro de 2 días y porcentaje de 30 días o más). La razón es `insufficient_population`. Hubo 11 commits dentro de la ventana, sin alcanzar el umbral mínimo de 20 commits necesario para calcular porcentajes. La razón para el retrabajo a nivel de línea sigue manteniendo en la versión 0.8.0 el nombre de la versión 0.6 (`deferred_to_v0.6`).

El hecho de que todos los orígenes (origin) resultaran unresolved fue también algo que no se pudo vislumbrar. El origen se clasifica cuando se proporciona un identity.toml con las direcciones de correo de la empresa o bien el repositorio padre de un fork. Al medir proyectos OSS tal cual, no se suministra ninguno de los dos, por lo que todos los commits aparte de los bots resultan en «no determinado». En la misma tabla, valores como `tenant_unique` son 0, pero esto significa «no hubo coincidencias». Su significado difiere de unresolved.

## Interpretaciones erróneas de los números

### Número de commits

El número de commits varía según la extensión del historial y el método de integración. Los commits humanos de flask son 3.674, mientras que en httpx son 1.335. Esta diferencia no denota si uno es mejor o peor. Los días transcurridos desde el primer commit son 5.976 en flask y 2.517 en httpx. Los merge commits fueron 1.691 en flask y 41 en httpx. Ante un mismo cambio, el número varía en función de si se integran agrupados o manteniendo los commits individuales.

### Nombres de las áreas de trabajo

Los nombres de las áreas de trabajo son nombres de reglas de rutas (paths). En commander.js, backend fue 0 y other fue 530. Esto se debe a que los archivos de `.js`, que constituyen el núcleo de commander.js, no están contemplados en las reglas de backend. Las reglas de backend se determinan por directorios como `api/` o `services/` y extensiones como `.py`, `.go` y `.rs`.

A la inversa, el hecho de que click tenga 1.158 en backend se debe a que todos los archivos en `.py` entran dentro de backend. click no es un programa de servidor. El propio informe aclara que «se trata de la observación de áreas de trabajo basada en rutas y extensiones».

### Número de docs

Que el número de docs sea alto no significa necesariamente que haya una gran dedicación a la documentación. Las reglas de docs abarcan extensiones como `.md` y `.rst`, así como directorios como `docs/`. En repositorios donde se añade contenido al archivo de historial de cambios con cada modificación, el número de docs aumentará.

En click, al volver a contar desde git log con las mismas reglas el desglose de los commits clasificados como docs, de los 1.025 commits, en 414 de ellos el único archivo tocado dentro de docs fue el historial de cambios (`CHANGES.rst`). Este desglose no es una salida de grift, sino un recuento aproximado realizado manualmente. El informe describe para click una «tendencia a una superficie relativamente alta en docs», catalogando su fuerza como weak y su certeza como directional.

### Asunto de fix

Los «commits con asunto de fix que también modificaron test» son aquellos cuyo asunto comienza por `fix`, `bug`, `revert`, etc., y que además modificaron archivos de test. En flask representaron 58 de 408.

Al volver a contar el git log de flask bajo las mismas reglas, de los 407 commits con asunto de fix, 198 solo modificaron archivos de docs o de configuración. Los asuntos eran del tipo «fix typo» o correcciones de enlaces. Dado que casi la mitad de los «fix» no implican tests, interpretar este valor como «no escriben tests cuando corrigen bugs» resulta erróneo.

### Ventana para contar intervalos de cambios

El intervalo de cambios se cuenta en una ventana de 180 días desde la fecha de observación. Si no se especifica la fecha de observación con `--as-of`, la fecha del commit HEAD pasa a ser la fecha de observación (`window_basis=legacy_head_date`). Por este motivo, las ventanas de los cuatro proyectos abarcan períodos completamente distintos.

En la ventana de httpx (2025-08-27 a 2026-02-23) solo hubo 11 commits, por lo que el valor del intervalo figuró como no observado. Interpretar esto como «el desarrollo está detenido» también es erróneo. Lo que se midió fue el checkout local, no el estado actual en upstream.

### Días de actividad

Por último, creamos dos repositorios pequeños de prueba para verificarlo. En ambos, tras el commit inicial, se añade el mismo archivo de 5 líneas. En uno se hicieron las 5 líneas en un solo commit; en el otro, se hizo un commit de 1 línea por día a lo largo de 5 días.

| Método de creación | Commits (incluyendo el inicial) | Tree final | Días de actividad |
|---|---|---|---|
| Commit de 5 líneas en una sola vez | 2 | `880a82d` | 2 días |
| Commit de 1 línea dividida en 5 días | 6 | `880a82d` | 6 días |

A pesar de que el contenido es idéntico, los días de actividad resultan ser 2 días y 6 días. La versión 0.8.0 no corrige esta cifra. En su lugar, incluye junto al valor numérico la frase: «Aumenta si se realiza un commit pequeño cada día, y disminuye si se agrupan los mismos cambios en un solo día».

## Lo que se corrigió en 0.8.0

Como se expuso en el artículo publicado el mismo día, en la versión 0.8.0 se modificó el orden de la lista de personas y se divulgó el mecanismo por el cual pueden inflarse los días de actividad. Comparamos la lista de personas del informe de repo (`actor_directory`) entre las salidas de 0.7.2 y 0.8.0 para los mismos cuatro proyectos. No observamos nombres ni cantidades, sino únicamente la forma de ordenación.

| Elemento | 0.7.2 | 0.8.0 |
|---|---|---|
| Orden de las filas | En los 4, en orden descendente de número de commits | En los 4, en orden de actor_id |
| ¿La primera fila es la persona con más commits? | En los 4, sí | En los 4, no |
| Posición de la fila de la persona con más commits | Fila 1 en los 4 | click: fila 120 (de 467 filas); flask: fila 280 (de 870 filas); httpx: fila 232 (de 258 filas); commander.js: fila 15 (de 203 filas) |
| Frase sobre cómo inflar los días de actividad | Ninguna | Presente en `activity.limitations` y `change_rhythm.limitations` |

En 0.7.2, el encabezado en Markdown era «actor 一覧（品質ランキングではない）» (Lista de actores [no es una clasificación de calidad]), pero las filas seguían ordenadas de mayor a menor número de commits. En 0.8.0, bajo el mismo encabezado se indica: «Las filas están en orden de actor_id (no por número de commits). La posición de la fila no significa nada».

Al reordenar las filas de la salida de 0.8.0 de mayor a menor número de commits y pasarlas por `grift verify`, arrojó `MISMATCH: 1 field(s) differ` (`actor_directory.actors`) con código de salida 1. La lista reordenada no supera la verificación.

Los demás valores no han cambiado. Los valores de áreas de trabajo, tipos de verificación, origen y tamaño muestral fueron idénticos entre 0.7.2 y 0.8.0 en los cuatro proyectos. La única diferencia en los intervalos de cambios fue que las notas (limitations) pasaron de 3 a 4 oraciones. Al someter un informe guardado con 0.7.2 al `grift verify` de 0.8.0, resulta en `CANNOT_VERIFY`, ya que la versión de definición es `tep-v0.7.2-2026-09-07`, distinta a la versión actual.

También comprobamos si era capaz de detectar la alteración de valores. En el informe de click, al cambiar el valor combinado de fix y test (`fix_with_test_pairing`) de 0,3213 a 0,9 y pasarlo por `grift verify`, se detuvo con código de salida 1 señalando ambos valores: `report=0.9 recomputed=0.3213`.

Por otra parte, hubo aspectos que todavía no se han incorporado. En la condición 4 del artículo del mismo día, se indicó que la tasa de modificación concurrente de tests también puede aumentarse mediante un cambio formal de una línea en un archivo de test. En el informe de repo de 0.8.0, esta vía todavía no se indica junto al valor numérico. Lo único que se colocó junto al valor numérico en la versión 0.8.0 fue la frase relativa a los días de actividad.

## Comparación con la declaración del proyecto

`grift project` presenta en secciones separadas los requisitos definidos por la parte del proyecto (declaración) y el modo de operación visto desde git (observación). Declaramos un proyecto hipotético pequeño («Mantenimiento de biblioteca de Python») y lo ejecutamos sobre los cuatro repositorios.

```toml
schema_version = "tep-project-v1"
project_id = "example-python-lib-maintenance"
title = "Python ライブラリの保守（架空の案件）"

[requirements.change_rhythm]
active_days_180d_min = 12
median_gap_days_max = 7

[requirements.surfaces]
required = ["backend", "test"]

[requirements.verification]
required = ["unit"]

[requirements.inputs]
required = ["git", "forge"]
```

```bash
grift project click --requirements python-lib-maintenance.toml --format both --out project/click
```

La salida se divide en dos secciones: «declaración de la parte del proyecto» y «valores numéricos observados», sin calificaciones de aprobado o suspenso. El p90 del intervalo no declarado pasa a ser `not_declared`, y el informe señala: «No especificado por la parte del proyecto. No constituye una carencia». Aunque la declaración exija forge, al no haber suministrado una exportación de forge, la revisión por el lado observado permanece como no observada. En click, la disposición fue la siguiente:

| Eje | Declaración | Observación de click |
|---|---|---|
| Días de actividad en 180 días | 12 días o más | 62 días (187 commits en la ventana) |
| Mediana del intervalo | 7 días o menos | 0,08 días |
| p90 del intervalo | Sin declaración (not_declared) | 3,36 días |
| Área de trabajo | backend, test | backend 1.158 commits, test 562 commits |
| Tipo de test | unit | unit 555 commits |
| Entrada | git, forge | Solo git (forge no observado) |

Los otros tres proyectos se presentan de la misma forma. Incluso tras la comparación, persisten las interpretaciones erróneas mencionadas en la sección anterior. Que backend en commander.js sea 0 se debe a que `.js` no está contemplado en las reglas, y la mediana del intervalo en httpx figura como no observada por falta de muestra suficiente en la ventana.

El cotejo de la declaración con la observación por cada eje corresponde a `grift align`, el cual clasifica en 5 resultados: coincidencia, fuera de rango, 0 casos, no observado y sin requerimiento. No obstante, `grift align` toma como entrada la observación del lado del candidato. Dado que implicaría medir a individuos reales, no se ejecuta en este artículo.

## Conclusión

En los cuatro proyectos, los valores se obtuvieron en menos de 2,5 segundos y coincidieron con la verificación. Sin embargo, cualquier valor se prestará a interpretaciones equívocas si no se lee conjuntamente con el denominador, la ventana de observación y las reglas de rutas. Qué fue visible y qué no lo fue queda especificado en el propio informe con sus motivos correspondientes.

Puede comprobarlo en su propio repositorio mediante los mismos comandos. La decisión de qué juzgar a partir de los valores presentados corresponde exclusivamente a quien los lee.

## Materiales de referencia

- [grift-cli (GitHub, MIT)](https://github.com/Cor-Incorporated/grift-cli) - Código fuente del CLI. La versión pública es 0.7.2, y la 0.8.0 está en preparación para su publicación
- [Grift](https://griftai.org) - Sitio web del producto
- [Cómo leer el informe de grift (metrics-guide)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/metrics-guide.md) - Explicación clara de cada indicador
- [Normas de uso de TEP (norms)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/norms.md) - Prohibición de interpretar la ausencia de forma negativa, ponderar y convertir
- [Cómo proteger en la implementación el principio de "sin puntuaciones ni clasificaciones" (Blog de Cor.Inc., 25 de octubre de 2026)](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/) - Las 5 condiciones establecidas en 0.8
- [pallets/click](https://github.com/pallets/click) - OSS medido (HEAD `36baa15`)
- [pallets/flask](https://github.com/pallets/flask) - OSS medido (HEAD `d318b68`)
- [encode/httpx](https://github.com/encode/httpx) - OSS medido (HEAD `b5addb6`)
- [tj/commander.js](https://github.com/tj/commander.js) - OSS medido (HEAD `ba6d13d`)
