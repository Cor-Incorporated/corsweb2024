---
title: "Los años en el currículum no muestran cómo trabaja alguien: medimos 4 proyectos reales de código abierto con Grift, sin asignar puntuaciones"
description: "Los años o los meses-persona en un currículum por sí solos no muestran cómo ha trabajado una persona. Para profesionales de ventas de agencias de colocación y SES, así como para ingenieros, explicamos por qué Cor. creó Grift —que no asigna puntuaciones ni clasificaciones—, en qué se diferencia del MBTI y qué reveló y qué no al medir cuatro proyectos reales de OSS."
summary: "Grift analiza el historial de cambios registrado en git para mostrar tendencias de trabajo junto con los recuentos que sirven de evidencia. A diferencia del MBTI, donde la persona responde a preguntas para determinar su tipo, aquí el fundamento son los registros y no las autodeclaraciones: a partir del mismo registro, cualquiera obtendrá exactamente el mismo valor. Al medir cuatro proyectos reales de OSS, se evidenciaron diferencias en las áreas de trabajo y en los intervalos de cambios, pero no la calidad de las revisiones de código, las reuniones ni la experiencia sin el consentimiento de la persona. Las cifras deben interpretarse junto con su denominador y sus reglas; la decisión final corresponde a las personas."
pubDate: 2026-10-25
updatedDate: 2026-10-26
author: "Terisuke"
category: "engineering"
ctaIntent: "grift-team-beta"
tags: ["Grift", "OSS", "CLI", "git", "実測"]
lang: "es"
featured: false
isDraft: false
translationSourceHash: "b6c9b7d77d676cc7d362bd1bf2a315d0eb07c6a72f8dd4d50288ab08761e0456"
translatedAt: "2026-10-26T12:21:54.577Z"
translationModel: "gemini-3.8-flash"
---

Aunque un currículum indique «Python: 5 años», no es posible saber qué tipo de trabajo se ha realizado durante esos 5 años.

Los años de experiencia y las estimaciones en meses-persona sirven como referencia del volumen de trabajo. Sin embargo, no nos indican cómo trabaja esa persona: si avanza redactando pruebas para verificar el funcionamiento, si se preocupa por cuidar la documentación, o si publica pequeños cambios con frecuencia.

En Cor.Inc. consideramos que una de las razones por las que los reclutadores y los comerciales de servicios SES se quedan bloqueados sin poder justificar sus recomendaciones con fundamentos reside en esta brecha.

## Por qué no asignamos puntuaciones

Grift es un producto propio desarrollado para cerrar esta brecha. A partir de los registros que quedan en Git (el mecanismo que registra los cambios de software paso a paso), extrae las tendencias de trabajo y el recuento de casos que sirven de fundamento. No genera puntuaciones ni clasificaciones.

Nuestro representante, Kousuke Terada, experimentó la frustración de no lograr transmitir el valor real cuando trabajaba en ventas de publicidad de empleo en Recruit. Respecto a Grift, afirma: «El currículum se puede inflar. Las pruebas, no».

¿Qué ocurre cuando se asigna una puntuación? Al reducir distintos tipos de registros a un solo número, se desvanece tanto lo que se ha contado como lo que no se ha podido contar. Además, ante una puntuación, quien obtiene una cifra más alta parece mejor profesional. Si se ordenan, se convierten en un ranking.

Lo que buscamos con Grift no es clasificar a las personas en un ranking. Es conectar a las personas con proyectos que se ajusten a su forma de trabajar. Para ello, únicamente mostramos hechos verificables. La decisión queda en manos de las personas.

## Diferencias con el MBTI

Al escuchar que no establecemos clasificaciones, puede que algunos piensen en el MBTI.

En el MBTI, la propia persona responde a preguntas y, a partir de la combinación de cuatro preferencias, se obtienen 16 tipos. La fundación del MBTI (The Myers & Briggs Foundation) señala que todos los tipos tienen valor y que no fue concebido con fines de contratación.

Grift no formula preguntas. No asigna nombres a los tipos. Tampoco es una herramienta para diagnosticar la personalidad. Cuenta los registros que quedan en Git y extrae las tendencias junto con el número de casos que las fundamentan.

La diferencia resulta fácil de comprender si se analiza a partir de los problemas a los que se enfrentan los comerciales.

No se sabe hasta qué punto confiar en las declaraciones personales de un currículum. Los resultados del MBTI, al igual que el currículum, proceden de las respuestas del propio interesado. La base de Grift son los registros. Si se suministra el mismo registro, cualquier persona que lo cuente obtendrá exactamente el mismo valor.

Los años y los meses-persona no permiten conocer la forma de trabajar. Grift muestra en cifras con qué áreas se ha interactuado (pruebas, documentación, código fuente principal, etc.), con qué frecuencia se publican los cambios y si las modificaciones correctivas van acompañadas de pruebas.

No obstante, lo que no queda registrado no se muestra. El desempeño en reuniones, la calidad de las revisiones de código y el trabajo que no es público no son visibles. Tampoco mostramos la experiencia individual ni los roles sin el consentimiento del interesado.

## El proceso TEP

Grift denomina TEP (Technical Evidence Pipeline, flujo de extracción de pruebas técnicas) al proceso para extraer hechos a partir de los registros. Consta de cuatro etapas:

1. Leer los registros de Git. No se emplean estimaciones basadas en IA.
2. Contabilizar mediante reglas fijas. Por ejemplo, clasificar si se trata de pruebas o documentación según la ubicación y el nombre de los archivos.
3. Añadir a los valores calculados el denominador y el motivo de aquello que no se pudo contabilizar.
4. Permitir que cualquier persona pueda recalcular y verificar los datos siguiendo el mismo procedimiento.

A este cuarto paso de recálculo lo denominamos verificación en Grift. Puede encontrar una explicación detallada del TEP en la [página del TEP](https://griftai.org/tep) en el sitio web de Grift.

## Prueba en proyectos OSS reales

Para comprobar si con este procedimiento realmente se pueden observar las tendencias de trabajo, el 25 de octubre de 2026 realizamos pruebas con la versión 0.8.0 de Grift CLI (la herramienta por línea de comandos de Grift). En esa fecha, la versión 0.8.0 aún se encontraba en fase de preparación y se publicó al día siguiente, el 26 de octubre ([notas de la versión](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0)).

Para no evaluar a personas reales sin su consentimiento, realizamos la medición a nivel de repositorio (el espacio donde se recopilan los registros de un software) sobre proyectos de código abierto (OSS). En este artículo no se incluye ni una sola cifra a nivel individual.

Medimos cuatro proyectos con características distintas:

- click: biblioteca de Python para crear herramientas por línea de comandos (componente utilizado desde otros programas).
- flask: biblioteca de Python para crear servicios web.
- httpx: biblioteca de Python para comunicarse a través de la web.
- commander.js: biblioteca de JavaScript para crear herramientas por línea de comandos.

## Lo que se observó

En los cuatro proyectos, tanto la medición como la verificación concluyeron en menos de 2,5 segundos. Los resultados de la verificación coincidieron en todos los apartados para los cuatro repositorios.

También salieron a la luz las diferencias de personalidad de cada repositorio.

En click, hubo 187 cambios en los 180 días previos a la última fecha del registro. La mediana del intervalo entre cambios fue de aproximadamente 2 horas. Se observa una serie continua de cambios a intervalos cortos.

En flask, hubo 1.841 cambios que afectaron a la documentación, una cifra superior a los cambios que tocaron el código principal (1.765 cambios).

En httpx, 575 de los 1.335 cambios incluyeron archivos de pruebas.

En commander.js, los archivos principales de JavaScript no se computaron como «código principal», sino que se clasificaron en «otros». Esto se debe a una limitación en las reglas de Grift: la extensión de JavaScript `.js` no estaba incluida entre las extensiones que se cuentan como código principal.

## Errores de interpretación de las cifras

Al realizar las mediciones, comprendimos que comparar los números de forma aislada lleva de inmediato a errores de interpretación. Mostramos cinco ejemplos.

### Número de cambios

Un repositorio con un gran número de cambios no es necesariamente un mejor repositorio. flask registró 3.674 cambios y httpx 1.335. La duración del historial fue de 5.976 días en flask y de 2.517 días en httpx. El volumen de cambios varía en función de la longitud del historial y de si los cambios se integran de forma agrupada o no.

### Modificaciones en la documentación

Que haya muchos cambios en la documentación no significa necesariamente una gran dedicación a su redacción. En click, cerca del 40 % de los cambios contabilizados como documentación correspondían exclusivamente al archivo del historial de cambios. En repositorios donde se actualiza el historial de cambios con cada modificación, el recuento de documentación aumenta.

### Cambios de corrección

Que los cambios cuyo mensaje comienza por «fix» (corrección) no incluyan pruebas no significa que no se redacten pruebas. Al recontar en flask los cambios que comienzan por «fix», 198 de los 407 cambios afectaban únicamente a archivos de documentación o de configuración. Llevaban mensajes como «fix typo» (corrección de errata), entre otros.

### Pocos cambios

Un volumen bajo de cambios no significa que el desarrollo esté detenido. En httpx, solo hubo 11 cambios en la ventana observada de 180 días, por lo que el intervalo figuró como «no observado» (no se pudo medir). La medición se realizó sobre registros clonados localmente el 2 de septiembre y no refleja el estado actual.

### Días de actividad

Los días de actividad (número de días en los que hubo cambios) pueden aumentarse según cómo se dividan los cambios. Creamos dos pequeños repositorios de prueba y añadimos las mismas 5 líneas. Al añadirlas todas juntas en una sola vez, los días de actividad fueron 2; al dividirlas en 5 días a razón de una línea por día, fueron 6 días (en ambos casos se incluye el primer commit). El contenido es idéntico.

Grift no ajusta este valor. En su lugar, incluye una nota junto a la cifra: «Aumenta si se registra un pequeño commit diario, y disminuye si los mismos cambios se agrupan en un solo día».

## Lo que no fue visible

Grift marca como «no observado» aquello que no se pudo medir. «No observado» significa «no se pudo medir», y en ningún caso «no hubo actividad o logros». En estos cuatro proyectos no fueron visibles los siguientes aspectos:

- Revisiones y gestión de incidencias: no observado, ya que no se proporcionaron registros como los de GitHub.
- Experiencia individual y roles: no observado, al no contar con el consentimiento del interesado.
- Si los cambios correspondían a la propia empresa: todo quedó como «indeterminado», al no haberse definido las direcciones de correo corporativas.

También mencionamos lo que no funcionó como se esperaba. Que el código principal de commander.js entrara en «otros» se debió a un vacío en las reglas, tal y como se explicó antes. Asimismo, en un artículo publicado el mismo día mencionamos que «la tasa de actualización conjunta de pruebas (la proporción de veces que se modifican pruebas al mismo tiempo que el código principal) también puede inflarse con cambios superficiales en los tests». En la versión 0.8.0, este aviso todavía no se muestra junto a la cifra. Únicamente se incluyó la frase de advertencia sobre los días de actividad.

## Correcciones introducidas en la versión 0.8.0

En la versión [0.7.2](https://pypi.org/project/grift-cli/0.7.2/) (la versión pública en el momento de la medición), la lista de colaboradores del repositorio se ordenaba de mayor a menor número de cambios. Esto podía inducir a interpretar a la persona situada en primer lugar como «la que mejor trabajo realizó». En la versión 0.8.0 se ordenan por su ID (el identificador asignado a cada individuo).

Comparamos las listas de las versiones 0.7.2 y 0.8.0 en los cuatro repositorios, fijándonos únicamente en el orden y no en los nombres ni en las cantidades. En la versión 0.7.2, en los cuatro casos la primera fila correspondía a la persona con más cambios. En la versión 0.8.0, la fila de esa misma persona ocupó el puesto 120 de 467 líneas en click, el 280 de 870 líneas en flask, el 232 de 258 líneas en httpx y el 15 de 203 líneas en commander.js.

Si en la versión 0.8.0 se reordena la lista por número de cambios, no pasa la verificación. El resto de los valores fueron idénticos entre la 0.7.2 y la 0.8.0.

## Comparación con los requerimientos de un proyecto

Al conectar con un proyecto, los requerimientos que este exige se redactan con antelación. En Grift denominamos a esto «declaración». Se coloca en una columna distinta de lo obtenido a partir de Git («observación»), sin emitir un veredicto de aprobado o suspenso.

A modo de prueba, formulamos la declaración de un proyecto ficticio de pequeña escala: «Mantenimiento de bibliotecas en Python». La declaración requería: contar con 12 o más días de actividad en un periodo de 180 días, que la mediana del intervalo de cambios no superara los 7 días, haber interactuado con el código principal y las pruebas, contar con pruebas unitarias y examinar también registros de plataformas como GitHub.

Al contrastarlo con click, junto al requerimiento de «12 o más días» de la declaración se sitúan los «62 días» de la observación. Como no se suministraron registros de GitHub u otras plataformas, ese campo permanece como no observado.

Incluso tras contrastarlos, los errores de interpretación mencionados en la sección anterior siguen presentes: que en commander.js el «código principal» figure con 0 cambios se debe a un vacío en las reglas, y el intervalo de httpx figura como no observado por falta de registros suficientes. Interpretar cómo deben leerse los valores resultantes es una decisión que corresponde a las personas.

También es posible utilizar este sistema comparando los requerimientos del proyecto con los registros propios de un ingeniero. En ese caso, solo se emplean registros para los que se cuente con el consentimiento del interesado. Como implicaría evaluar a personas reales, no se ha llevado a cabo en este artículo.

## Conclusión

Los registros de Git son un recurso valioso para corroborar lo que afirma un currículum. Sin embargo, hay aspectos del trabajo que no quedan reflejados en los registros.

Lo que ofrece Grift son tendencias, el recuento de casos que las fundamentan y las razones de aquello que no se pudo observar. Las conclusiones que se extraigan a partir de ahí quedan en manos de quien lee la información.

## Datos de respaldo

A fin de que los ingenieros puedan verificarlo en su propio entorno, recopilamos las condiciones y las cifras medidas.

- grift 0.8.0 (versión de definición `tep-v0.8.0-2026-10-25`). Se instaló localmente el código fuente previo al lanzamiento (`87076c8` del repositorio de desarrollo). El código de `src/` (el núcleo del programa) de la versión 0.8.0 publicada es idéntico a este código fuente.
- Para realizar la comparación, se aplicó también la versión pública de entonces, [0.7.2](https://pypi.org/project/grift-cli/0.7.2/), a los mismos cuatro repositorios.
- Apple M4 Max, macOS 26.7.1, Python 3.12.9, git 2.54.0.
- El objeto de análisis fueron las cuatro copias locales clonadas el 2 de septiembre de 2026 y no actualizadas desde entonces.

Los SHA (identificadores únicos de cada commit) y las fechas de los commits (registros de cambios unitarios) analizados son los siguientes:

```text
pallets/click    36baa15ff831b939a22bc527cd76ce653ef6f66d  2026-08-26
pallets/flask    d318b683471101618febed18996405ad26462110  2026-08-16
encode/httpx     b5addb64f0161ff6bfe94c124ef76f6a1fba5254  2026-02-23
tj/commander.js  ba6d13ddb4243e5913367734f8c159089ffe7834  2026-05-29
```

Ejemplo del comando utilizado tomando como referencia click:

```bash
git clone https://github.com/pallets/click
git -C click checkout 36baa15ff831b939a22bc527cd76ce653ef6f66d
grift repo click --format both --out out/click
grift verify out/click/report.json --repo click
```

`grift repo` concluyó en menos de 2,5 segundos en los cuatro casos, y `grift verify` fue `VERIFIED` en todos ellos. Incluso en un clon recién creado de click, los resultados fueron idénticos salvo por la hora de ejecución. Con el código fuente idéntico a la versión pública de entonces, [0.7.2](https://pypi.org/project/grift-cli/0.7.2/), los valores observados aquí presentados fueron los mismos.

| Repositorio | Commits humanos / merges / bots |
|---|---|
| click | 2.000 / 1.131 / 200 |
| flask | 3.674 / 1.691 / 191 |
| httpx | 1.335 / 41 / 147 |
| commander.js | 1.095 / 284 / 138 |

Los commits humanos corresponden a los casos en los que se excluyen los merges (registros de integración de cambios de otra rama). Se han descartado los cambios realizados por bots (programas que integran cambios automáticamente).

Las áreas de trabajo (`surface_profile`) determinan las categorías según la ubicación y la extensión de los archivos, y contabilizan los commits por categoría. Dado que un mismo commit puede abarcar varias categorías, la suma total supera el denominador.

| Repositorio | Denominador | test / docs / backend / other |
|---|---|---|
| click | 1.999 | 562 / 1.024 / 1.158 / 309 |
| flask | 3.673 | 627 / 1.841 / 1.765 / 575 |
| httpx | 1.333 | 575 / 501 / 874 / 112 |
| commander.js | 1.094 | 286 / 468 / 0 / 530 |

El intervalo de cambios (`change_rhythm`) toma como fecha de observación la fecha de HEAD y contabiliza los 180 días anteriores a esta. La fecha de observación es la indicada a la derecha del SHA en la sección anterior.

| Repositorio | Commits / Días de actividad | Mediana del intervalo / p90 |
|---|---|---|
| click | 187 / 62 días | 0,08 días / 3,36 días |
| flask | 32 / 19 días | 0,80 días / 15,60 días |
| httpx | 11 / 8 días | No observado |
| commander.js | 22 / 18 días | 2,88 días / 17,89 días |

El motivo del valor «no observado» en httpx es `insufficient_population`. Al haber solo 11 commits dentro de la ventana, no se alcanzó el umbral mínimo de 20 commits necesario para calcular la tasa.

La modalidad de verificación (`verification_profile`) contabiliza los commits que afectaron a ubicaciones de tests.

| Repositorio | Commits que incluyen tests | Commits con asunto fix que también modificaron tests |
|---|---|---|
| click | 562 / 2.000 | 80 / 249 |
| flask | 627 / 3.674 | 58 / 408 |
| httpx | 575 / 1.335 | 46 / 114 |
| commander.js | 286 / 1.095 | 30 / 106 |

En cuanto al tipo de pruebas, click registró 555 unitarias y 23 desconocidas; flask, 484 unitarias y 204 desconocidas; httpx, 554 unitarias y 101 desconocidas; y commander.js, 286 desconocidas.

Los apartados no observados fueron 23 en click, flask y commander.js, y 27 en httpx. Los motivos principales son los siguientes:

- `forge_export_not_provided`, `tracker_export_not_provided`: revisiones, gestión de incidencias, eventos.
- `consenting_actor_required`: experiencia, roles, contexto de la biblioteca.
- `no_upstream_lineage`, `parent_repo_not_provided`, `template_not_provided`: relación con upstream, herencia desde plantillas.
- `no_tenant_commits`: periodo en el que se concentra el 80 % de los commits corporativos.
- `survival_scan_disabled`: novedad del código (qué tan recientemente se ha escrito el código actual).
- `outcome_declaration_not_provided`: declaración de eventos posteriores a la realización del trabajo.
- `deferred_to_v0.6`: retrabajo a nivel de línea (en la versión 0.8.0 aún conserva el nombre de la 0.6).

En cuanto a la procedencia (`origin`), en los cuatro repositorios todos los commits que no correspondían a bots figuraron como `unresolved`. Esto se debe a que no se proporcionó ni un archivo identity.toml con las direcciones corporativas ni el repositorio matriz del fork.

El desglose de los commits contabilizados como documentación en click y el de los commits de tipo fix en flask no provienen de la salida directa de Grift. Son estimaciones recalculadas localmente aplicando las mismas reglas a git log. En click, en 414 de los 1.025 casos el único cambio correspondiente a documentación fue `CHANGES.rst`. En flask, 198 de los 407 commits cuyo asunto comenzaba por fix modificaban únicamente archivos de documentación o configuración.

Respecto al orden de la lista (`actor_directory`), al reordenar las filas de la versión 0.8.0 por número de commits y pasarlas por `grift verify`, se obtuvo el código de salida 1 con `MISMATCH: 1 field(s) differ`. Al verificar con la versión 0.8.0 un informe guardado con la 0.7.2, se produce `CANNOT_VERIFY` debido a la diferencia en la versión de definición. La frase de advertencia sobre los días de actividad se incluyó en la versión 0.8.0 en `activity.limitations` y `change_rhythm.limitations`, y no existía en la 0.7.2.

Para la declaración del proyecto se emplearon los siguientes archivos:

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

La salida se divide en dos secciones: «Declaración del proyecto» y «Valores observados». Aquellos apartados no contemplados en los requisitos figuraron como `not_declared` (el proyecto no lo requiere; no se considera una carencia). La conciliación entre la declaración y la observación eje por eje se realiza mediante `grift align`, mostrándose según cinco posibles estados: solapamiento, fuera de rango, 0 casos, no observado y sin requerimiento.

## Materiales de referencia

- [grift-cli (GitHub, MIT)](https://github.com/Cor-Incorporated/grift-cli): código fuente del CLI. La versión pública al momento de la medición era la 0.7.2; la 0.8.0 se publicó el 26 de octubre de 2026.
- [Notas de la versión de grift-cli 0.8.0 (GitHub)](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0): novedades de la versión 0.8.0.
- [grift-cli 0.7.2 (PyPI)](https://pypi.org/project/grift-cli/0.7.2/): versión pública al momento de la medición.
- [Grift](https://griftai.org): sitio web del producto.
- [Página del TEP (Grift)](https://griftai.org/tep): explicación detallada del TEP.
- [Guía de lectura de informes de grift (metrics-guide)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/metrics-guide.md): explicación accesible de cada indicador.
- [Normas de uso del TEP (norms)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/norms.md): no interpretar las ausencias como algo negativo, prohibición de ponderaciones y conversiones.
- [Cómo preservar el principio de «no puntuar ni clasificar» en la implementación (Blog de Cor.Inc., 25 de octubre de 2026)](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/): las 5 condiciones establecidas en la versión 0.8.
- [«Fundé una empresa para hacer del entendimiento mutuo algo cotidiano» (Blog de Cor.Inc.)](https://cor-jp.com/blog/founder-story/): palabras del representante y visión que dio origen a Grift.
- [Ethical Use of the MBTI (The Myers & Briggs Foundation)](https://www.myersbriggs.org/unique-features-of-myers-briggs/ethical-use-of-the-mbti/): directrices de uso del MBTI (carácter voluntario, no apto para selección de personal).
- [MBTI Basics (The Myers & Briggs Foundation)](https://www.myersbriggs.org/my-mbti-personality-type/mbti-basics/): las 4 preferencias y los 16 tipos.
- [pallets/click](https://github.com/pallets/click): proyecto OSS analizado (HEAD `36baa15`).
- [pallets/flask](https://github.com/pallets/flask): proyecto OSS analizado (HEAD `d318b68`).
- [encode/httpx](https://github.com/encode/httpx): proyecto OSS analizado (HEAD `b5addb6`).
- [tj/commander.js](https://github.com/tj/commander.js): proyecto OSS analizado (HEAD `ba6d13d`).
