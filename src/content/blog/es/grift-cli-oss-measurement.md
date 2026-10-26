---
title: "Los años en el currículum no muestran cómo trabaja una persona. Medimos 4 proyectos reales de OSS con Grift, la herramienta sin puntuaciones"
description: "Los años de experiencia o las horas-persona en un currículum no bastan para saber cómo trabaja alguien. Explicamos a profesionales de agencias de empleo, ventas de SES e ingenieros por qué Cor. creó Grift —que no asigna puntuaciones ni clasificaciones—, en qué se diferencia del MBTI y qué reveló (y qué no) el análisis de 4 proyectos reales de OSS."
summary: "Grift analiza el historial de cambios en git para mostrar las tendencias de trabajo y las cifras que las respaldan. A diferencia del MBTI, donde la propia persona responde preguntas para definir su perfil, el fundamento no son autodeclaraciones sino registros, por lo que cualquiera obtendrá el mismo valor a partir del mismo historial. Al medir 4 proyectos reales de OSS, se apreciaron diferencias en las áreas de trabajo y en los intervalos de cambio, mientras que la calidad de las revisiones, las reuniones y la experiencia no consentida por el autor quedaron fuera de la vista. Las cifras deben interpretarse junto con su denominador y sus reglas; la decisión final siempre corresponde a las personas."
pubDate: 2026-10-25
updatedDate: 2026-10-26
author: "Terisuke"
category: "engineering"
ctaIntent: "grift-team-beta"
tags: ["Grift", "OSS", "CLI", "git", "実測"]
lang: "es"
featured: false
isDraft: false
translationSourceHash: "61adea75f963a89f574f1cd38d9f408c55358ef125e28f24b4119267c8a3c4a5"
translatedAt: "2026-10-26T04:37:30.467Z"
translationModel: "gemini-3.8-flash"
---

Aunque en un currículum ponga «Python: 5 años», eso no nos dice qué tipo de trabajo se ha realizado durante esos 5 años.

Los años o las personas-mes sirven como referencia de la cantidad de trabajo. Sin embargo, no revelan la forma de trabajar: si la persona avanza escribiendo pruebas para verificar el funcionamiento, si cuida la documentación o si realiza cambios pequeños de forma frecuente.

Los comerciales de agencias de empleo y de servicios de ingeniería (SES) a menudo se bloquean al no poder justificar sus recomendaciones con pruebas tangibles. En Cor.Inc. creemos que una de las causas radica en esta brecha.

## Por qué no asignamos una puntuación

Grift es un producto propio desarrollado para cerrar esta brecha. A partir de los registros conservados en git (el sistema que registra cada modificación de software paso a paso), extrae las tendencias de trabajo y el recuento exacto de casos que las respaldan. No genera puntuaciones ni clasificaciones.

Kousuke Terada, nuestro representante, experimentó en primera persona la frustración de que las palabras no transmitieran la realidad cuando trabajaba en ventas de publicidad de empleo en Recruit. Sobre Grift ha escrito: «El currículum se puede inflar. Las pruebas no.»

¿Qué ocurre cuando se reduce todo a una puntuación? Al comprimir registros de distinta naturaleza en un único número, desaparece qué se contó y qué no se pudo contar. Además, ante una puntuación, quien obtiene una más alta parece mejor profesional. Si se ordenan, se convierte en un ranking.

Lo que buscamos con Grift no es clasificar a las personas en un ranking. Es conectar a las personas con proyectos que encajen con su tendencia de trabajo. Para lograrlo, solo mostramos hechos verificables. Quien juzga es la persona.

## Diferencias con el MBTI

Al oír que no se asigna un ranking, tal vez algunos piensen en el MBTI.

En el MBTI, la propia persona responde a preguntas y, a partir de la combinación de cuatro preferencias, se obtienen 16 tipos. La fundación del MBTI (The Myers & Briggs Foundation) sostiene que todos los tipos tienen valor y que no fue concebido para fines de contratación.

Grift no hace preguntas. Tampoco asigna nombres de tipos. No es una herramienta para diagnosticar la personalidad. Cuenta los registros que quedan en git y extrae las tendencias junto con el número de casos que sirven de evidencia.

La diferencia se entiende con facilidad si la aplicamos a las dificultades de los comerciales.

No saber hasta qué punto confiar en lo declarado en el currículum: los resultados del MBTI, al igual que el currículum, proceden de las respuestas del propio interesado. La base de Grift son los registros. Si se entregan los mismos registros, cualquier persona que cuente obtendrá el mismo valor.

Los años o las personas-mes no permiten saber la forma de trabajar: Grift muestra con cifras qué áreas se han tocado (pruebas, documentación, código principal, etc.), con qué frecuencia se publican los cambios y si los cambios de corrección van acompañados de pruebas.

No obstante, lo que no queda registrado no aparece. La labor en reuniones, la calidad de las revisiones o el trabajo no publicado no son visibles. Si no existe el consentimiento del interesado, tampoco se muestran la experiencia ni los roles individuales.

## El proceso denominado TEP

En Grift llamamos TEP (Technical Evidence Pipeline, flujo de extracción de evidencia técnica) al procedimiento para extraer hechos a partir de los registros. Consta de cuatro etapas:

1. Leer los registros de git. No se emplean conjeturas de IA.
2. Contar siguiendo reglas fijas. Por ejemplo, clasificar si es prueba o documentación según la ubicación y el nombre del archivo.
3. Añadir a los valores calculados el denominador y los motivos de aquello que no se pudo contabilizar.
4. Permitir que cualquiera pueda recalcularlos siguiendo el mismo procedimiento.

A este cuarto paso de recálculo lo llamamos verificación en Grift. Encontrará una explicación detallada del TEP en la [página de TEP](https://griftai.org/tep) del sitio web de Grift.

## Prueba con proyectos OSS reales

Para comprobar si con este procedimiento se aprecian realmente las tendencias de trabajo, realizamos una verificación el 25 de octubre de 2026 con la versión 0.8.0 de Grift CLI (la herramienta de Grift para línea de comandos). La versión 0.8.0 estaba aún preparándose para su publicación en esa fecha y se publicó al día siguiente, el 26 de octubre ([notas de lanzamiento](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0)).

Para no evaluar a personas reales sin su consentimiento, medimos software de código abierto (OSS) a nivel de repositorio (el espacio donde se recopilan los registros de un software). En este artículo no se incluye ni una sola cifra individualizada por persona.

Analizamos cuatro proyectos con características distintas:

- click: librería de Python para crear herramientas de línea de comandos (componentes para usar desde otros programas)
- flask: librería para crear servicios web en Python
- httpx: librería para la comunicación web en Python
- commander.js: librería de JavaScript para crear herramientas de línea de comandos

## Lo que pudimos observar

En los cuatro casos, tanto la medición como la verificación concluyeron en menos de 2,5 segundos. Los resultados de la verificación coincidieron en todos los apartados para los cuatro proyectos.

También se observaron las diferencias de características entre repositorios.

En click, en los 180 días previos a la última fecha del registro, hubo 187 cambios. El intervalo entre cambios tuvo una mediana de unas 2 horas. Los cambios se suceden a intervalos cortos.

En flask, hubo 1.841 cambios que tocaron la documentación, una cifra superior a los cambios que tocaron el código principal (1.765 veces).

En httpx, 575 de los 1.335 cambios incluyeron archivos de pruebas.

En commander.js, los archivos principales de JavaScript no se contabilizaron como «código principal», sino que entraron en «otros». Esto se debe a un vacío en las reglas de Grift: la extensión de JavaScript `.js` no estaba incluida entre las extensiones que se cuentan como código principal.

## Interpretaciones erróneas de las cifras

Al realizar las mediciones, comprobamos que limitarse a alinear números conduce fácilmente a interpretaciones erróneas. Presentamos cinco ejemplos.

### Número de cambios

Un repositorio con más cambios no es necesariamente un repositorio mejor. flask tuvo 3.674 cambios y httpx, 1.335. La extensión del historial fue de 5.976 días en flask y de 2.517 días en httpx. El recuento varía según la longitud del historial y según si los cambios se integran en bloque o no.

### Cambios de documentación

Tener muchos cambios de documentación no significa necesariamente una gran dedicación a redactarla. En click, en cerca del 40 % de los cambios contabilizados como documentación, el único archivo tocado fue el archivo del historial de cambios (changelog). En repositorios donde se actualiza el historial en cada cambio, la cifra de documentación aumenta.

### Cambios de corrección

Que los cambios cuyo asunto empieza por «fix» (corrección) no incluyan pruebas no significa que no se escriban pruebas. Al volver a contar los cambios con «fix» en flask, 198 de 407 consistían únicamente en modificaciones de documentación o de archivos de configuración. Eran asuntos como «fix typo» (corrección de errata), entre otros.

### Pocos cambios

Tener pocos cambios no significa que el desarrollo esté detenido. En httpx, solo hubo 11 cambios dentro de los 180 días observados, y el intervalo figuró como «no observado» (no se pudo medir). La medición se hizo sobre un registro clonado localmente el 2 de septiembre y no refleja el estado actual.

### Días activos

Los días activos (días en que hubo cambios) se pueden aumentar según cómo se dividan los cambios. Creamos dos repositorios pequeños para la prueba y añadimos las mismas 5 líneas. Añadiéndolas todas de golpe en una sola vez, los días activos fueron 2; dividiéndolas en 5 días a razón de una línea por día, fueron 6 (en ambos casos se incluye el primer commit inicial). El contenido es el mismo.

Grift no ajusta este número de forma artificial. En su lugar, incluye una nota junto al dato: «Aumenta si se realiza 1 commit pequeño al día, y disminuye si se agrupan los mismos cambios en un solo día.»

## Lo que no fue visible

Grift señala como «no observado» aquello que no se pudo medir. «No observado» significa que no se pudo medir, no que no existan resultados. En estos cuatro proyectos, no fue posible observar lo siguiente:

- Revisiones y gestión de incidencias: no se entregaron registros de GitHub u otras plataformas, por lo que quedaron como no observados.
- Experiencia y roles individuales: al no haber consentimiento del interesado, quedaron como no observados.
- Si los cambios correspondían a la propia empresa: al no definir los correos de la empresa, todos quedaron como «no determinado».

También explicamos lo que no funcionó bien. Que el código principal de commander.js entrara en «otros» fue, como se indicó antes, un vacío en las reglas. Asimismo, en un artículo del mismo día señalamos que «la tasa de pruebas concurrentes (la proporción en que se modifica el código principal y las pruebas a la vez) también sube con cambios triviales en las pruebas». En la versión 0.8.0, esta advertencia todavía no aparece junto a la cifra; solo se incluyó la frase sobre los días activos.

## Correcciones en la versión 0.8.0

En la versión [0.7.2](https://pypi.org/project/grift-cli/0.7.2/) (la versión pública en el momento de la medición), la lista de participantes del repositorio se ordenaba de mayor a menor número de cambios. Esto permitía interpretar al primero de la lista como «el que más trabajó». En la versión 0.8.0, se ordenan según el identificador (ID asignado a cada persona).

Comparamos las listas de 0.7.2 y 0.8.0 en los cuatro repositorios, observando únicamente la forma de ordenación, sin fijarnos en nombres ni cifras. En 0.7.2, en los cuatro casos, la persona con más cambios encabezaba la lista. En 0.8.0, la fila de esa misma persona ocupó el puesto 120 de 467 filas en click, el 280 de 870 en flask, el 232 de 258 en httpx y el 15 de 203 en commander.js.

Si se reordena la lista de 0.8.0 por número de cambios, no supera la verificación. El resto de los valores fueron idénticos entre 0.7.2 y 0.8.0.

## Comparación con los requerimientos de un proyecto

Al conectar con un proyecto, los requerimientos solicitados por la parte contratante se definen previamente. En Grift llamamos a esto «declaración». Se coloca en una columna distinta de lo apreciado en git (las «observaciones») y no se emite un resultado de apto o no apto.

A modo de prueba, declaramos un proyecto ficticio de pequeña escala: «Mantenimiento de librería de Python». La declaración pedía: tener actividad durante 12 o más días en 180 días, que la mediana del intervalo entre cambios fuera de 7 días o menos, haber tocado el código principal y las pruebas, contar con pruebas unitarias y revisar también los registros de GitHub u otras fuentes.

Al aplicarlo a click, junto a los «12 días o más» de la declaración se colocan los «62 días» observados. Al no haber entregado registros de GitHub u otras plataformas, esa casilla permanece como no observada.

Incluso tras compararlos, persisten los riesgos de interpretación errónea expuestos en la sección anterior: que en commander.js el «código principal» sea 0 se debe a un vacío en las reglas, y el intervalo de httpx queda no observado por falta de registros. Cómo interpretar los valores contrastados es algo que decide la persona.

También es posible contrastar los registros del propio ingeniero con los del proyecto. En tal caso, solo se emplean registros con el consentimiento de la persona. Dado que implicaría medir a un individuo real, no lo hemos probado en este artículo.

## Conclusión

Los registros de git constituyen un material útil para contrastar las palabras de un currículum. Sin embargo, hay trabajos que no quedan registrados.

Lo que ofrece Grift son las tendencias, el recuento de casos que las respaldan y los motivos de aquello que no se pudo observar. Las conclusiones que se extraigan a partir de ahí quedan en manos del lector.

## Cifras que sirven de base

Para que los ingenieros puedan comprobarlo en sus propios equipos, resumimos las condiciones y las cifras medidas.

- grift 0.8.0 (versión de definiciones `tep-v0.8.0-2026-10-25`). Se instaló localmente el código fuente previo a su publicación (`87076c8` del repositorio de desarrollo). El ejecutable `src/` (cuerpo del programa) de la versión 0.8.0 publicada coincide con este código fuente.
- Para comparar, se aplicó también a los mismos cuatro repositorios la versión pública en ese momento, [0.7.2](https://pypi.org/project/grift-cli/0.7.2/).
- Apple M4 Max, macOS 26.7.1, Python 3.12.9, git 2.54.0.
- El objeto de análisis son cuatro repositorios locales que no se han actualizado desde su clonación el 2 de septiembre de 2026.

Los SHA (identificadores de cada commit) de los commits (registros de cambios unitarios) analizados y sus fechas son los siguientes:

```text
pallets/click    36baa15ff831b939a22bc527cd76ce653ef6f66d  2026-08-26
pallets/flask    d318b683471101618febed18996405ad26462110  2026-08-16
encode/httpx     b5addb64f0161ff6bfe94c124ef76f6a1fba5254  2026-02-23
tj/commander.js  ba6d13ddb4243e5913367734f8c159089ffe7834  2026-05-29
```

Comandos tomando click como ejemplo:

```bash
git clone https://github.com/pallets/click
git -C click checkout 36baa15ff831b939a22bc527cd76ce653ef6f66d
grift repo click --format both --out out/click
grift verify out/click/report.json --repo click
```

`grift repo` concluyó en menos de 2,5 segundos en los cuatro repositorios, y `grift verify` dio `VERIFIED` en los cuatro. Al clonar click de nuevo, los resultados fueron idénticos salvo por la hora de ejecución. Con el código fuente de [0.7.2](https://pypi.org/project/grift-cli/0.7.2/), la versión pública en ese momento, los valores observados aquí presentados fueron idénticos.

| Repositorio | commits humanos / merge / bot |
|---|---|
| click | 2.000 / 1.131 / 200 |
| flask | 3.674 / 1.691 / 191 |
| httpx | 1.335 / 41 / 147 |
| commander.js | 1.095 / 284 / 138 |

Los commits humanos indican la cantidad excluyendo los merges (registros de integración de cambios de otra rama). Se han omitido los cambios de bots (programas que introducen cambios de forma automatizada).

En cuanto a las áreas de trabajo (`surface_profile`), se determinan las categorías según la ubicación y la extensión de los archivos, y se contabilizan los commits por cada categoría. Como un commit puede abarcar varias categorías, la suma total supera el denominador.

| Repositorio | Denominador | test / docs / backend / other |
|---|---|---|
| click | 1.999 | 562 / 1.024 / 1.158 / 309 |
| flask | 3.673 | 627 / 1.841 / 1.765 / 575 |
| httpx | 1.333 | 575 / 501 / 874 / 112 |
| commander.js | 1.094 | 286 / 468 / 0 / 530 |

El intervalo entre cambios (`change_rhythm`) toma como fecha de observación la fecha de HEAD y contabiliza los 180 días previos. La fecha de observación es la indicada a la derecha del SHA anterior.

| Repositorio | commits / Días activos | Mediana de intervalo / p90 |
|---|---|---|
| click | 187 / 62 días | 0,08 días / 3,36 días |
| flask | 32 / 19 días | 0,80 días / 15,60 días |
| httpx | 11 / 8 días | No observado |
| commander.js | 22 / 18 días | 2,88 días / 17,89 días |

El motivo por el que httpx figura como no observado es `insufficient_population`. Al haber 11 commits dentro de la ventana, no se alcanzó el umbral mínimo de 20 commits necesario para calcular la tasa.

La modalidad de verificación (`verification_profile`) contabiliza los commits correspondientes a la ubicación de pruebas (test).

| Repositorio | commits con test | commits con asunto fix que también modificaron test |
|---|---|---|
| click | 562 / 2.000 | 80 / 249 |
| flask | 627 / 3.674 | 58 / 408 |
| httpx | 575 / 1.335 | 46 / 114 |
| commander.js | 286 / 1.095 | 30 / 106 |

Respecto a las tipologías de test, click tuvo 555 unitarios y 23 no determinados; flask, 484 unitarios y 204 no determinados; httpx, 554 unitarios y 101 no determinados; y commander.js, 286 no determinados.

Los elementos no observados fueron 23 en click, flask y commander.js, y 27 en httpx. Los motivos principales son los siguientes:

- `forge_export_not_provided`, `tracker_export_not_provided`: revisiones, gestión de incidencias, eventos
- `consenting_actor_required`: experiencia, roles, contexto de librerías
- `no_upstream_lineage`, `parent_repo_not_provided`, `template_not_provided`: relación con upstream, herencia desde plantillas
- `no_tenant_commits`: periodo en el que se concentra el 80 % de los commits de la propia empresa
- `survival_scan_disabled`: tasa de retención
- `outcome_declaration_not_provided`: declaración de eventos posteriores al trabajo
- `deferred_to_v0.6`: retrocesos o retrabajos por líneas (en la versión 0.8.0 se mantiene el nombre de la época de la 0.6)

En procedencia (`origin`), en los cuatro repositorios todos los commits que no eran de bots figuraron como `unresolved`. Esto se debe a que no se proporcionó ni un archivo identity.toml con las direcciones de correo corporativas ni la referencia del repositorio original en bifurcaciones (fork).

El desglose de los commits de click contabilizados como documentación y el de los commits de fix en flask no provienen de la salida de Grift. Son estimaciones recalculadas localmente aplicando las mismas reglas sobre git log. En click, en 414 de los 1.025 casos el único archivo tocado como documentación fue `CHANGES.rst`. En flask, de los 407 commits con «fix» en el asunto, 198 modificaban únicamente archivos de documentación o de configuración.

En el orden de la lista (`actor_directory`), al reordenar las filas de 0.8.0 de mayor a menor número de commits y pasarlas por `grift verify`, se obtuvo un código de salida 1 en `MISMATCH: 1 field(s) differ`. Si se verifica con 0.8.0 un informe guardado en 0.7.2, se obtiene `CANNOT_VERIFY` debido a que las versiones de definición son distintas. La advertencia sobre los días activos figura en `activity.limitations` y `change_rhythm.limitations` en la versión 0.8.0, mientras que no existía en la 0.7.2.

Para la declaración de requerimientos del proyecto se utilizaron los siguientes archivos:

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

La salida se divide en dos secciones: «Declaración de requerimientos del proyecto» y «Valores observados»; los apartados no declarados quedaron como `not_declared` (no especificado por el proyecto; no implica carencia). La conciliación entre declaración y observación eje por eje se muestra con `grift align`, que arroja uno de 5 resultados posibles: coincidencia, fuera de rango, 0 casos, no observado o sin requisito.

## Documentación de referencia

- [grift-cli (GitHub, MIT)](https://github.com/Cor-Incorporated/grift-cli): código fuente de la CLI. La versión pública al momento de la medición era la 0.7.2; la 0.8.0 se publicó el 26 de octubre de 2026.
- [Notas de lanzamiento de grift-cli 0.8.0 (GitHub)](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0): cambios introducidos en la versión 0.8.0.
- [grift-cli 0.7.2 (PyPI)](https://pypi.org/project/grift-cli/0.7.2/): versión pública en el momento de la medición.
- [Grift](https://griftai.org): sitio web del producto.
- [Página de TEP (Grift)](https://griftai.org/tep): explicación detallada de TEP.
- [Guía de lectura de informes grift (metrics-guide)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/metrics-guide.md): explicación accesible de cada indicador.
- [Normas de uso de TEP (norms)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/norms.md): no interpretar las ausencias como algo negativo, prohibición de ponderaciones y conversiones.
- [Cómo garantizar en la implementación el principio de «no poner notas ni rankings» (blog de Cor.Inc., 25 de octubre de 2026)](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/): las 5 condiciones establecidas en la versión 0.8.
- [Fundé una empresa para hacer del «por fin se ha entendido» algo cotidiano (blog de Cor.Inc.)](https://cor-jp.com/blog/founder-story/): palabras del representante e ideas que originaron Grift.
- [Ethical Use of the MBTI (The Myers & Briggs Foundation)](https://www.myersbriggs.org/unique-features-of-myers-briggs/ethical-use-of-the-mbti/): directrices de uso ético del MBTI (carácter voluntario, no apto para fines de contratación).
- [MBTI Basics (The Myers & Briggs Foundation)](https://www.myersbriggs.org/my-mbti-personality-type/mbti-basics/): las 4 preferencias y los 16 tipos.
- [pallets/click](https://github.com/pallets/click): proyecto OSS analizado (HEAD `36baa15`).
- [pallets/flask](https://github.com/pallets/flask): proyecto OSS analizado (HEAD `d318b68`).
- [encode/httpx](https://github.com/encode/httpx): proyecto OSS analizado (HEAD `b5addb6`).
- [tj/commander.js](https://github.com/tj/commander.js): proyecto OSS analizado (HEAD `ba6d13d`).
