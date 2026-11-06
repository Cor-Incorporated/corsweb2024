---
title: "Qué se ve y qué no se ve en el historial de Git: comprobamos cuatro OSS con Grift"
description: "Separamos qué se puede contar en un historial de git con reglas explícitas y qué no. Comprobamos cuatro OSS reales por repositorio. No garantiza la capacidad de una persona ni que el registro esté completo."
summary: "Lo que Grift comprueba es el resultado de contar un registro entregado con reglas explícitas. Si el alcance de la entrada y el commit, la versión de la CLI y las definiciones y ajustes son los mismos, cualquiera obtiene el mismo valor. Al medir cuatro OSS reales se vieron diferencias de ámbito e intervalo, pero no se garantiza la capacidad de una persona ni la integridad del registro."
pubDate: 2026-10-25
updatedDate: 2026-10-29
author: "Terisuke"
category: "engineering"
ctaIntent: "grift-team-beta"
tags: ["Grift", "OSS", "CLI", "git", "実測"]
lang: "es"
featured: false
isDraft: false
translationSourceHash: "75880e785376c1dd4282d8cbc16ea72155087b188d630bf6e14a8cf249212451"
translatedAt: "2026-10-29T05:20:00.000Z"
translationModel: "manual-i18n-sync"
---

Aunque un currículum diga «5 años de Python», no sabemos qué tipo de trabajo se ha realizado durante esos 5 años.

Los años de experiencia o las personas-mes sirven como referencia de la cantidad de trabajo. Sin embargo, no nos indican la forma de trabajar: si es una persona que avanza redactando pruebas para comprobar el funcionamiento, si cuida la documentación o si realiza cambios pequeños y frecuentes.

El personal de ventas de las agencias de empleo y de servicios de SES se queda atascado sin poder argumentar los motivos de sus recomendaciones con fundamentos concretos. En Cor.Inc. pensamos que una de las causas reside en esta brecha.

## La razón por la que no asignamos puntuaciones

Grift es un producto propio creado para cerrar esta brecha. A partir de los registros conservados en git (el mecanismo que registra los cambios del software uno a uno), extrae las tendencias de trabajo y el recuento de casos que les sirven de fundamento. No genera puntuaciones ni clasificaciones.

Cuando nuestro director ejecutivo, Kousuke Terada, trabajaba en ventas de anuncios de empleo en Recruit, experimentó la frustración de ver que las palabras no transmitían la realidad. La frase de Grift es: «Bases comprobables para explicar una trayectoria».

Lo que Grift comprueba es el resultado de contar un registro entregado con reglas explícitas. El trabajo no registrado, el contexto en el que se hizo el registro y la contribución real a un resultado no se conocen solo con eso. Poder recalcular no garantiza la capacidad de una persona ni la integridad del registro.

¿Qué ocurre cuando se convierte en una puntuación? Al redondear registros de distinta naturaleza en un solo número, desaparece lo que se contó y lo que no se pudo contar. Además, si hay una puntuación, quien tiene la más alta parece la mejor persona. Si se ordenan, se convierte en un ranking.

Lo que Grift busca no es clasificar a las personas en un ranking. Es conservar el resultado de contar un registro entregado con reglas explícitas. El juicio corresponde a los humanos.

## Diferencias con el MBTI

Al escuchar que no establecemos clasificaciones, puede que algunos piensen en el MBTI.

En el MBTI, la propia persona responde a preguntas y se obtienen 16 tipos a partir de la combinación de 4 preferencias. La Fundación MBTI (The Myers & Briggs Foundation) sostiene que todos los tipos tienen valor y que no fue concebido con fines de contratación.

Grift no hace preguntas. Tampoco asigna nombres a tipos. No es una herramienta para diagnosticar la personalidad. Cuenta los registros conservados en git y muestra las tendencias junto con el número de casos que les sirven de fundamento.

La diferencia resulta fácil de entender si la aplicamos a las dificultades del personal comercial.

No saber hasta qué punto confiar en lo autodeclarado en el currículum. Los resultados del MBTI, al igual que el currículum, provienen de las respuestas del propio individuo. El fundamento de Grift son los registros. Si el alcance de la entrada y el commit, la versión de la CLI y las definiciones y ajustes son los mismos, cualquiera obtiene el mismo valor.

Con los años de experiencia o las personas-mes, no se conoce la forma de trabajar. Grift muestra mediante recuentos numéricos qué áreas se han tocado (pruebas, documentación, programa principal, etc.), con qué intervalo se publican los cambios y si los cambios de corrección van acompañados de pruebas.

No obstante, lo que no queda registrado no aparece. La labor en reuniones, la calidad de las revisiones y el trabajo no publicado no son visibles. Sin el consentimiento de la persona, tampoco se muestran la experiencia individual ni los roles desempeñados.

## El procedimiento llamado TEP

Grift denomina al procedimiento para extraer hechos a partir de registros TEP (Technical Evidence Pipeline, flujo de extracción de pruebas técnicas). Consta de cuatro fases:

1. Leer los registros de git. No se utilizan suposiciones de IA.
2. Contar siguiendo reglas fijas. Por ejemplo, distinguir si se trata de pruebas o documentación a partir de la ubicación y el nombre de los archivos.
3. Añadir a los valores calculados el denominador y las razones de lo que no se pudo contar.
4. Permitir que cualquier persona pueda volver a contar siguiendo el mismo procedimiento.

A este cuarto paso de volver a contar, en Grift lo denominamos verificación cruzada. Encontrará una explicación detallada de TEP en la [página de TEP](https://griftai.org/tep) del sitio web de Grift.

## Prueba con proyectos OSS reales

Para comprobar si con este procedimiento realmente se podían apreciar las tendencias de trabajo, el 25 de octubre de 2026 lo verificamos con Grift CLI (la herramienta de Grift operada por comandos) en su versión 0.8.0. A fecha de ese día, la versión 0.8.0 aún estaba en fase de preparación para su lanzamiento y se publicó al día siguiente, el 26 de octubre ([notas de la versión](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0)).

Para no evaluar a personas reales sin su consentimiento, medimos software de código abierto (OSS) por repositorios (el espacio que agrupa los registros de un software). En este artículo no se incluye ni una sola cifra por individuo.

Medimos cuatro proyectos con naturalezas distintas:

- click: biblioteca (componente usado por otros programas) para crear herramientas de línea de comandos en Python.
- flask: biblioteca para crear servicios web en Python.
- httpx: biblioteca para comunicarse con la web en Python.
- commander.js: biblioteca para crear herramientas de línea de comandos en JavaScript.

## Lo que se pudo observar

En los cuatro casos, tanto la medición como la verificación cruzada finalizaron en menos de 2,5 segundos. Los resultados de la verificación cruzada coincidieron en todos los elementos para los cuatro repositorios.

También se apreciaron las diferencias de naturaleza de cada repositorio.

En click hubo 187 cambios en los 180 días previos a la última fecha del registro. El intervalo mediano entre cambios fue de unas 2 horas. Los cambios se suceden en intervalos breves.

En flask hubo 1.841 cambios que afectaron a la documentación, superando a los cambios que afectaron al programa principal (1.765 veces).

En httpx, los cambios que incluían archivos de prueba fueron 575 de un total de 1.335.

En commander.js, los archivos principales de JavaScript no se contabilizaron como «programa principal», sino que entraron en «otros». Se trata de una laguna en las reglas de Grift: la extensión de JavaScript `.js` no estaba incluida entre las extensiones contabilizadas como programa principal.

## Errores de interpretación de las cifras

Al realizar las mediciones, comprendimos que limitarse a alinear números conduce de inmediato a interpretaciones erróneas. Presentamos cinco ejemplos:

### Número de cambios

Un repositorio con un gran número de cambios no es necesariamente un buen repositorio. Los cambios de flask fueron 3.674; los de httpx, 1.335. La longitud del historial fue de 5.976 días en flask y de 2.517 días en httpx. El número varía según la longitud del historial y según si los cambios se integran por lotes o no.

### Cambios de documentación

Tener muchos cambios de documentación no significa una gran dedicación a redactarla. Alrededor del 40 % de los cambios contabilizados como documentación en click tocaban únicamente archivos del registro de cambios (changelog). En repositorios donde se redacta el historial de cambios con cada modificación, el recuento de documentación aumenta.

### Cambios de corrección

Que un cambio cuyo asunto comienza por «fix» (corrección) no incluya pruebas no significa que no se redacten pruebas. Al volver a contar en flask los cambios que comienzan por «fix», 198 de 407 afectaban únicamente a archivos de documentación o de configuración. Llevaban asuntos como «fix typo» (corrección de errata), entre otros.

### Pocos cambios

Tener pocos cambios no significa que el desarrollo esté detenido. En httpx solo hubo 11 cambios en los 180 días observados, y el intervalo quedó como «no observado» (no se pudo medir). La medición se realizó sobre registros clonados localmente el 2 de septiembre y no refleja el estado actual.

### Días de actividad

Los días de actividad (número de días en los que hubo cambios) pueden aumentarse según la forma de estructurar los cambios. Creamos dos repositorios pequeños para validación y añadimos las mismas 5 líneas. Al añadirlas juntas en una sola vez, los días de actividad fueron 2; al distribuirlas en 5 días añadiendo una línea por día, fueron 6 (en ambos casos se incluye la primera vez). El contenido es exactamente el mismo.

Grift no ajusta este número. En su lugar, escribe junto a la cifra: «Aumenta si se registra 1 commit pequeño al día, y disminuye si se agrupan los mismos cambios en un solo día».

## Lo que no fue visible

Grift clasifica como «no observado» aquello que no pudo medir. «No observado» significa «no se pudo medir», y no «no hubo logros». En estos cuatro casos, no fue visible lo siguiente:

- Revisiones y gestión de incidencias: al no haber suministrado registros como los de GitHub, quedó como no observado.
- Experiencia individual y roles: al no haber consentimiento de la persona, quedó como no observado.
- Si eran cambios internos de la propia empresa: al no haber definido direcciones de correo corporativas, todo quedó como «no determinado».

También exponemos lo que no funcionó bien. Que el código principal de commander.js entrara en «otros» se debió, como ya se mencionó, a una laguna en las reglas. Asimismo, en un artículo del mismo día escribimos que «la tasa de modificación conjunta de pruebas (porcentaje de veces que se modifican pruebas a la vez que el código principal) también sube con cambios meramente formales en las pruebas». En la versión 0.8.0, esta advertencia aún no aparece junto al número. Lo único que se incorporó fue la frase relativa a los días de actividad.

## Lo corregido en la versión 0.8.0

En la versión [0.7.2](https://pypi.org/project/grift-cli/0.7.2/) (la versión pública en el momento de la medición), la lista de participantes en el repositorio se ordenaba de mayor a menor número de cambios. Esto permitía interpretar al primero de la lista como «la persona que mejor lo hizo». En la versión 0.8.0 se ordenan por ID (el identificador asignado a cada persona).

Comparamos la lista entre la 0.7.2 y la 0.8.0 en los cuatro repositorios. Observamos únicamente el orden, sin mirar nombres ni cifras. En la 0.7.2, en los cuatro casos la primera fila correspondía a la persona con más cambios. En la 0.8.0, la fila de esa misma persona ocupaba el puesto 120 de 467 en click, el 280 de 870 en flask, el 232 de 258 en httpx y el 15 de 203 en commander.js.

Si se vuelve a ordenar la lista de la 0.8.0 por número de cambios, no pasa la verificación cruzada. Los demás valores fueron idénticos entre la 0.7.2 y la 0.8.0.

## Cotejo con proyectos

Al conectar con un proyecto, los requisitos demandados por la parte del proyecto se definen de antemano. En Grift denominamos a esto declaración. Se muestran en una columna diferenciada de lo observado a partir de git (observación), y no se emiten veredictos de apto o no apto.

A modo de prueba, declaramos un pequeño proyecto ficticio: «Mantenimiento de biblioteca en Python». Una declaración que estipula: tener 12 o más días de actividad en 180 días, que la mediana del intervalo entre cambios sea de 7 días o menos, haber tocado el programa principal y las pruebas, contar con pruebas unitarias y consultar también registros como los de GitHub.

Al aplicarlo a click, junto a los «12 o más días» de la declaración se colocan los «62 días» observados. Al no haber suministrado registros como los de GitHub, esa casilla permanece como no observada.

Incluso tras cotejarlos, los errores de interpretación de la sección anterior permanecen intactos. Que en commander.js figure 0 veces en «programa principal» responde a una laguna en las reglas, y el intervalo de httpx queda como no observado por falta de registros. Cómo interpretar los valores cotejados es una decisión que corresponde a las personas.

También existe la modalidad de uso consistente en cotejar los registros del propio ingeniero con el proyecto. En ese caso, solo se emplean registros que cuenten con el consentimiento de la persona. Dado que supondría medir a individuos reales, no lo hemos probado en este artículo.

## Conclusión

Los registros de git sirven como material para corroborar lo expresado en los currículums. Sin embargo, también hay labores que no quedan reflejadas en los registros.

Lo que ofrece Grift son las tendencias, el recuento de casos que les sirven de fundamento y las razones de lo que no pudo verse. Qué juzgar a partir de ahí es algo que decide quien lo lee.

## Cifras de respaldo

Para que los ingenieros puedan comprobarlo por sí mismos, resumimos las condiciones y las cifras de la medición.

- grift 0.8.0 (versión de definición `tep-v0.8.0-2026-10-25`). Se instaló en local el código fuente previo a la publicación (`87076c8` del repositorio de desarrollo). El archivo `src/` (el ejecutable del programa) de la versión 0.8.0 publicada es idéntico a este código fuente.
- Para comparar, también se ejecutó sobre los mismos cuatro la versión pública de aquel momento, la [0.7.2](https://pypi.org/project/grift-cli/0.7.2/).
- Apple M4 Max, macOS 26.7.1, Python 3.12.9, git 2.54.0.
- El objeto de análisis son cuatro repositorios locales no actualizados desde su clonación el 2 de septiembre de 2026.

Los SHA (identificadores asignados a cada commit) de los commits (registros de un cambio) medidos y sus fechas son los siguientes:

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

`grift repo` terminó en menos de 2,5 segundos en los cuatro repositorios, y `grift verify` arrojó `VERIFIED` en los cuatro. En un clon nuevo de click, salvo por la hora de ejecución, se obtuvieron los mismos resultados. Con el mismo código fuente de la versión [0.7.2](https://pypi.org/project/grift-cli/0.7.2/), pública por aquel entonces, los valores observados aquí presentados fueron idénticos.

| Repositorio | Commits humanos / merge / bot |
|---|---|
| click | 2.000 / 1.131 / 200 |
| flask | 3.674 / 1.691 / 191 |
| httpx | 1.335 / 41 / 147 |
| commander.js | 1.095 / 284 / 138 |

Los commits humanos corresponden al recuento excluyendo los merge (registros de integración de cambios de otra rama). Se han omitido los cambios realizados por bots (programas que introducen cambios automáticamente).

Las áreas de trabajo (`surface_profile`) determinan la clasificación según la ubicación del archivo y su extensión, y cuentan los commits por cada clasificación. Como un único commit puede corresponder a varias clasificaciones, la suma supera al denominador.

| Repositorio | Denominador | test / docs / backend / other |
|---|---|---|
| click | 1.999 | 562 / 1.024 / 1.158 / 309 |
| flask | 3.673 | 627 / 1.841 / 1.765 / 575 |
| httpx | 1.333 | 575 / 501 / 874 / 112 |
| commander.js | 1.094 | 286 / 468 / 0 / 530 |

El intervalo entre cambios (`change_rhythm`) se contabiliza tomando como fecha de observación la de HEAD y computando los 180 días previos. La fecha de observación es la indicada a la derecha del SHA anterior.

| Repositorio | Commits / Días de actividad | Mediana del intervalo / p90 |
|---|---|---|
| click | 187 / 62 días | 0,08 días / 3,36 días |
| flask | 32 / 19 días | 0,80 días / 15,60 días |
| httpx | 11 / 8 días | No observado |
| commander.js | 22 / 18 días | 2,88 días / 17,89 días |

El motivo de que httpx conste como no observado es `insufficient_population`. Los commits dentro de la ventana fueron 11, sin alcanzar el umbral mínimo de 20 para calcular el ratio.

La forma de verificación (`verification_profile`) contabiliza los commits que afectaron a ubicaciones de test.

| Repositorio | Commits que incluyen test | Commits con asunto fix que también modificaron test |
|---|---|---|
| click | 562 / 2.000 | 80 / 249 |
| flask | 627 / 3.674 | 58 / 408 |
| httpx | 575 / 1.335 | 46 / 114 |
| commander.js | 286 / 1.095 | 30 / 106 |

En cuanto a los tipos de test, click registró unit 555 · desconocido 23; flask, unit 484 · desconocido 204; httpx, unit 554 · desconocido 101; commander.js, desconocido 286.

Los elementos no observados fueron 23 en click, flask y commander.js, y 27 en httpx. Los motivos principales son los siguientes:

- `forge_export_not_provided`, `tracker_export_not_provided`: revisiones, gestión de incidencias, eventos
- `consenting_actor_required`: experiencia, rol, contexto de bibliotecas
- `no_upstream_lineage`, `parent_repo_not_provided`, `template_not_provided`: relación con upstream, herencia desde plantillas
- `no_tenant_commits`: período en el que se concentra el 80 % de los commits internos
- `survival_scan_disabled`: Code recency (cómo de reciente es el código actual)
- `outcome_declaration_not_provided`: declaración de lo ocurrido tras el trabajo
- `deferred_to_v0.6`: reelaboraciones a nivel de línea (en la 0.8.0 aún conserva el nombre de la versión 0.6)

En procedencia (`origin`), en los cuatro casos la totalidad de los commits salvo bots fueron `unresolved`. Esto se debe a que no se proporcionó ni un archivo identity.toml con las direcciones de correo de la empresa ni el upstream del fork.

El desglose de los commits contabilizados como documentación en click y el desglose de los commits fix en flask no provienen de la salida de Grift. Son estimaciones recontadas localmente aplicando las mismas reglas sobre git log. En click, en 414 de 1.025 casos, lo único modificado como documentación fue `CHANGES.rst`. En flask, 198 de los 407 commits con asunto fix modificaban exclusivamente archivos de documentación o de configuración.

En cuanto al orden de la lista (`actor_directory`), al reordenar las filas de la 0.8.0 de mayor a menor número de commits y pasarlo por `grift verify`, se produjo un código de salida 1 con `MISMATCH: 1 field(s) differ`. Al verificar de forma cruzada con la 0.8.0 un informe guardado con la 0.7.2, se obtiene `CANNOT_VERIFY` debido a que difiere la versión de definición. El texto de advertencia sobre los días de actividad aparece en la 0.8.0 en `activity.limitations` y `change_rhythm.limitations`, y no existía en la 0.7.2.

Para la declaración del proyecto se utilizó el siguiente archivo:

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

La salida se divide en dos secciones: «Declaración de la parte del proyecto» y «Valores numéricos observados»; los conceptos no declarados quedaron como `not_declared` (la parte del proyecto no lo ha redactado; no se trata de una carencia). La confrontación de la declaración y la observación para cada eje corresponde a `grift align`, y se muestra según cinco posibles estados: solapamiento, fuera de rango, 0 casos, no observado y sin solicitud.

## Materiales de referencia

- [grift-cli (GitHub, MIT)](https://github.com/Cor-Incorporated/grift-cli) - Código fuente de la CLI. La versión pública al momento de la medición era la 0.7.2, y la 0.8.0 se publicó el 26 de octubre de 2026.
- [Notas de la versión de grift-cli 0.8.0 (GitHub)](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0) - Novedades de la 0.8.0.
- [grift-cli 0.7.2 (PyPI)](https://pypi.org/project/grift-cli/0.7.2/) - Versión pública al momento de la medición.
- [Grift](https://griftai.org) - Sitio web del producto.
- [Página de TEP (Grift)](https://griftai.org/tep) - Explicación detallada de TEP.
- [Cómo leer los informes de grift (metrics-guide)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/metrics-guide.md) - Explicación accesible de cada indicador.
- [Normas de uso de TEP (norms)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/norms.md) - No interpretar la ausencia de forma negativa; prohibición de ponderaciones y conversiones.
- [Cómo cumplir en la implementación con «no asignar puntuaciones ni rankings» (Blog de Cor.Inc., 25 de octubre de 2026)](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/) - Las 5 condiciones establecidas en la 0.8.
- [La historia de cómo el representante fundó la empresa (blog de Cor.Inc.)](https://cor-jp.com/blog/founder-story/) - Palabras del director ejecutivo e ideas que dieron origen a Grift.
- [Ethical Use of the MBTI (The Myers & Briggs Foundation)](https://www.myersbriggs.org/unique-features-of-myers-briggs/ethical-use-of-the-mbti/) - Directrices de uso del MBTI (carácter voluntario, no apto para fines de contratación).
- [MBTI Basics (The Myers & Briggs Foundation)](https://www.myersbriggs.org/my-mbti-personality-type/mbti-basics/) - Las 4 preferencias y los 16 tipos.
- [pallets/click](https://github.com/pallets/click) - OSS medido (HEAD `36baa15`).
- [pallets/flask](https://github.com/pallets/flask) - OSS medido (HEAD `d318b68`).
- [encode/httpx](https://github.com/encode/httpx) - OSS medido (HEAD `b5addb6`).
- [tj/commander.js](https://github.com/tj/commander.js) - OSS medido (HEAD `ba6d13d`).
