---
title: "Los años de experiencia en el currículum no revelan cómo trabaja una persona. Medimos 4 proyectos reales de OSS con Grift, sin asignar puntuaciones"
description: "Los años en el currículum o las horas-hombre por sí solos no muestran cómo ha trabajado realmente una persona. Escribimos para agentes de selección, comerciales de SES e ingenieros sobre por qué Cor. creó Grift sin puntajes ni clasificaciones, en qué se diferencia del MBTI y qué pudimos y no pudimos ver al medir 4 proyectos reales de código abierto (OSS)."
summary: "A partir del historial de cambios registrado en git, Grift extrae tendencias de trabajo junto con el número de casos que sirven de base. A diferencia del MBTI, donde el propio usuario responde preguntas para determinar su tipo, aquí el fundamento son registros y no autodeclaraciones: ante un mismo registro, cualquiera obtendrá exactamente el mismo valor. Al medir 4 proyectos reales de OSS, se apreciaron diferencias en el alcance de las tareas y los intervalos de cambio; sin embargo, no fue posible visualizar la calidad de las revisiones, las reuniones ni las experiencias sin el consentimiento del interesado. Los números deben interpretarse junto con su denominador y sus reglas; la decisión final corresponde a las personas."
pubDate: 2026-10-25
author: "Terisuke"
category: "engineering"
ctaIntent: "grift-team-beta"
tags: ["Grift", "OSS", "CLI", "git", "実測"]
lang: "es"
featured: false
isDraft: false
translationSourceHash: "ef859896fc1d4aa3ef654f35a97cd16672a5019bbb963d9ae3a20559c1fa9303"
translatedAt: "2026-10-25T15:08:12.248Z"
translationModel: "gemini-3.8-flash"
---

Aunque en un currículum ponga «5 años de Python», no es posible saber qué tipo de trabajo se ha realizado durante esos 5 años.

Los años de experiencia o los meses-persona sirven como una referencia aproximada del volumen de trabajo. Sin embargo, no revelan la forma de trabajar: si es una persona que avanza redactando pruebas para verificar el funcionamiento, si cuida y ordena la documentación, o si prefiere publicar cambios pequeños y frecuentes.

Los reclutadores de agencias de empleo y el personal comercial de servicios de ingeniería a menudo se bloquean al no poder justificar el motivo de una recomendación con evidencias. En Cor. consideramos que una de las causas radica en esta brecha.

## La razón de no asignar una puntuación

Grift es un producto propio creado para cerrar esta brecha. A partir de los registros guardados en git (el mecanismo que registra los cambios del software uno a uno), extrae las tendencias de trabajo y el recuento de casos que les sirven de fundamento. No genera puntuaciones ni clasificaciones.

Kousuke Terada, nuestro director ejecutivo, experimentó la frustración de que las palabras no llegaran a transmitirse cuando trabajaba en ventas de publicidad de empleo en Recruit. Sobre Grift, escribió: «Los currículums se pueden inflar. Las evidencias no».

¿Qué ocurre cuando se asigna una puntuación? Al reducir diferentes tipos de registros a un solo número, desaparece lo que se contó y lo que no se pudo contar. Además, ante una puntuación, quien saca una nota más alta parece mejor. Si se ordenan, se convierte en un ranking.

Lo que queremos hacer con Grift no es clasificar a las personas en un ranking. Es conectar a las personas con proyectos que se ajusten a su tendencia de trabajo. Para ello, únicamente mostramos hechos verificables. La decisión corresponde a las personas.

## Diferencias con el MBTI

Al oír que no establece clasificaciones, tal vez algunas personas piensen en el MBTI.

En el MBTI, la propia persona responde a un cuestionario y se obtienen 16 tipos a partir de la combinación de cuatro preferencias. La fundación del MBTI (The Myers & Briggs Foundation) señala que todos los tipos tienen valor y que no fue concebido con fines de contratación.

Grift no hace preguntas. Tampoco asigna nombres a tipos. No es una herramienta para diagnosticar la personalidad. Cuenta los registros que quedan en git y muestra las tendencias junto con el número de casos que las fundamentan.

La diferencia se comprende con mayor claridad si se aplica a las dificultades de los comerciales.

No se sabe hasta qué punto confiar en las autodeclaraciones de un currículum. Los resultados del MBTI también surgen de las respuestas de la propia persona, al igual que el currículum. El fundamento de Grift son los registros. Si se entregan los mismos registros, cualquiera que cuente obtendrá el mismo valor.

Con los años de experiencia o los meses-persona, no se conoce la forma de trabajar. Grift muestra con cifras cuantitativas qué áreas se han tocado (pruebas, documentación, programa principal, etc.), con qué frecuencia o intervalo se publican los cambios y si los cambios de corrección van acompañados de pruebas.

No obstante, lo que no queda registrado no aparece. La labor en reuniones, la calidad de las revisiones de código y el trabajo que no se publica no son visibles. Sin el consentimiento del interesado, tampoco se muestran la experiencia individual ni los roles.

## El procedimiento llamado TEP

Grift denomina al procedimiento para extraer hechos a partir de registros TEP (Technical Evidence Pipeline, flujo de extracción de evidencia técnica). Su contenido consta de cuatro etapas:

1. Leer los registros de git. No se emplean estimaciones de IA.
2. Contar mediante reglas fijas. Por ejemplo, a partir de la ubicación y el nombre de los archivos, se distingue si se trata de pruebas o de documentación.
3. Añadir a los valores calculados el denominador y el motivo de lo que no se pudo contar.
4. Permitir que cualquiera pueda volver a realizar el recuento siguiendo el mismo procedimiento.

A este cuarto paso de recálculo lo llamamos en Grift verificación cruzada. La explicación detallada de TEP se encuentra en la [página de TEP](https://griftai.org/tep) del sitio web de Grift.

## Prueba con proyectos de código abierto (OSS) reales

¿Es realmente posible observar las tendencias de trabajo mediante este procedimiento? El 25 de octubre de 2026 lo comprobamos con la próxima versión (0.8.0) de Grift CLI (la herramienta de Grift para línea de comandos). A fecha de ese día, la 0.8.0 se encontraba todavía en fase de preparación para su lanzamiento.

Para evitar medir a personas reales sin su consentimiento, medimos software cuyo código fuente es público (OSS) a nivel de repositorio (el espacio que reúne los registros de un software). En este artículo no se incluye ni una sola cifra individualizada por persona.

Medimos cuatro proyectos con características distintas:

- click: librería en Python para crear herramientas de línea de comandos (componentes para usar desde otros programas)
- flask: librería en Python para crear servicios web
- httpx: librería en Python para comunicarse con la web
- commander.js: librería en JavaScript para crear herramientas de línea de comandos

## Lo que se observó

En los cuatro casos, tanto la medición como la verificación cruzada concluyeron en menos de 2,5 segundos. Los resultados de la verificación cruzada coincidieron en todos los apartados para los cuatro.

También se apreciaron las diferencias de carácter entre cada repositorio.

En click hubo 187 cambios en los 180 días previos a la última fecha de registro. El intervalo entre cambios tuvo un valor mediano de unas 2 horas. Los cambios se suceden a intervalos cortos.

En flask hubo 1.841 cambios que afectaron a la documentación, superando a los que tocaron el programa principal (1.765 cambios).

En httpx, de los 1.335 cambios, 575 incluyeron archivos de pruebas.

En commander.js, los archivos principales de JavaScript no se contaron como «programa principal» y quedaron clasificados en «otros». Se trata de una laguna en las reglas de Grift: la extensión de JavaScript (`.js`) no estaba incluida entre las extensiones que se computan como programa principal.

## Errores de interpretación de las cifras

Al realizar las mediciones, comprendimos que limitarse a alinear números conduce de inmediato a interpretaciones erróneas. Presentamos cinco ejemplos.

### Número de cambios

Un repositorio con un número elevado de cambios no es necesariamente un buen repositorio. Los cambios de flask fueron 3.674; los de httpx, 1.335. La extensión del historial es de 5.976 días para flask y de 2.517 días para httpx. El recuento varía según la duración del historial y según se integren los cambios de forma agrupada o no.

### Cambios en la documentación

Que haya muchos cambios en la documentación no significa necesariamente que haya una gran dedicación a redactarla. En click, en cerca del 40 % de los cambios contabilizados como documentación, el único archivo modificado en esa categoría fue el historial de cambios (changelog). En un repositorio donde se actualiza el historial de cambios con cada modificación, el recuento de documentación aumenta.

### Cambios de corrección

Que los cambios cuyo asunto comience por «fix» (corrección) no incluyan pruebas no significa que no se redacten pruebas. Al recontar en flask los cambios con asunto iniciado por «fix», de 407 casos, 198 fueron modificaciones exclusivas de documentación o de archivos de configuración, con asuntos como «fix typo» (corrección de errata), entre otros.

### Pocos cambios

Que haya pocos cambios no significa que el desarrollo esté detenido. En httpx, solo hubo 11 cambios dentro de los 180 días observados, y el intervalo quedó como «no observado» (no se pudo medir). Lo que se midió fueron los registros clonados en local el 2 de septiembre, no su estado actual.

### Días de actividad

Los días de actividad (número de días en los que hubo cambios) se pueden incrementar según la forma de segmentar los cambios. Creamos dos pequeños repositorios de prueba y añadimos las mismas 5 líneas. Añadiéndolas todas juntas en una sola vez, los días de actividad fueron 2; dividiéndolas en 5 días a razón de una línea por día, fueron 6 (en ambos casos se incluye el primer cambio inicial). El contenido es idéntico.

Grift no ajusta este número. En su lugar, escribe junto a la cifra: «Aumentará si se realiza un commit pequeño cada día, y disminuirá si se concentran los mismos cambios en un solo día».

## Lo que no fue visible

Grift señala como «no observado» aquello que no pudo medir. «No observado» significa «no se pudo medir», no «no hubo actividad». En estos cuatro casos, lo siguiente no fue visible:

- Revisiones de código y gestión de incidencias: no se entregaron registros de plataformas como GitHub, por lo que figura como no observado.
- Experiencia individual y roles: al no haber consentimiento de los interesados, figura como no observado.
- Si se trataba de cambios internos de la empresa: al no haber definido los dominios de correo de la propia empresa, todos resultaron «no determinados».

Mencionamos también lo que no funcionó como se esperaba. Que el núcleo de commander.js cayera en «otros» se debe, como se ha señalado, a una laguna en las reglas. Asimismo, en un artículo publicado el mismo día, se indicó que «el ratio de modificación conjunta de pruebas (proporción de cambios en los que se modifica la prueba a la vez que el núcleo) también puede inflarse mediante modificaciones puramente formales en las pruebas». En la 0.8.0, esta advertencia aún no aparece junto al número; únicamente se añadió la frase sobre los días de actividad.

## Correcciones en la versión 0.8.0

En la 0.7.2 (la versión pública actual), la lista de personas que participaron en el repositorio se ordenaba de mayor a menor número de cambios. Esto permitía interpretar que la persona situada en primer lugar era «quien mejor lo había hecho». En la 0.8.0 se ordenan por su ID (el identificador asignado a cada persona).

Comparamos las listas entre la 0.7.2 y la 0.8.0 en los cuatro repositorios. No nos fijamos en los nombres ni en las cifras, únicamente en el orden. En la 0.7.2, en los cuatro proyectos, la persona con más cambios ocupaba el primer lugar. En la 0.8.0, la fila de esa misma persona pasó a ocupar el puesto 120 de 467 en click, el 280 de 870 en flask, el 232 de 258 en httpx y el 15 de 203 en commander.js.

Si se reordena la lista de la 0.8.0 por número de cambios decreciente, no pasa la verificación cruzada. Los demás valores fueron idénticos entre la 0.7.2 y la 0.8.0.

## Contrastar con los proyectos

Para conectar a una persona con un proyecto, los requisitos solicitados por el proyecto se redactan de antemano. En Grift a esto lo llamamos declaración. Se dispone en una columna separada de lo detectado a partir de git (observación), y no se emite un aprobado o suspenso.

A modo de prueba, declaramos un proyecto ficticio y pequeño: «Mantenimiento de una librería de Python». La declaración especificaba: tener 12 o más días de actividad en 180 días, que la mediana del intervalo entre cambios sea de 7 días o menos, haber tocado el programa principal y las pruebas, contar con pruebas unitarias y examinar también registros de entornos como GitHub.

Al aplicarlo a click, junto a los «12 días o más» de la declaración se sitúan los «62 días» de la observación. Como no se entregaron registros de GitHub u otras plataformas, esa columna permanece como no observada.

Incluso tras alinearlos, los errores de interpretación explicados en la sección anterior persisten. Que en commander.js el «programa principal» sea 0 se debe a una laguna en las reglas, y el intervalo de httpx queda como no observado por falta de registros suficientes. Cómo interpretar los valores alineados es algo que deciden las personas.

También existe la modalidad de alinear con los proyectos los registros del propio ingeniero. En tal caso, se utilizan únicamente los registros que cuentan con el consentimiento de la persona. Dado que implicaría medir a un individuo real, no se ha probado en este artículo.

## Conclusión

Los registros de git constituyen un material útil para corroborar las palabras de un currículum. Sin embargo, también hay labores que no quedan registradas.

Lo que ofrece Grift son las tendencias, el recuento de casos que las fundamentan y los motivos de lo que no fue visible. Lo que se juzgue a partir de ahí es una decisión exclusiva del lector.

## Cifras de respaldo

Para que los ingenieros puedan comprobarlo en sus propios equipos, resumimos las condiciones y las cifras de la medición.

- grift 0.8.0 (versión de definiciones `tep-v0.8.0-2026-10-25`). Se instaló en local el código fuente previo al lanzamiento (`87076c8` del repositorio de desarrollo).
- Para comparar, se ejecutó también la versión pública 0.7.2 sobre los mismos cuatro repositorios.
- Apple M4 Max, macOS 26.7.1, Python 3.12.9, git 2.54.0.
- El objeto de análisis son cuatro repositorios locales no actualizados desde su clonación el 2 de septiembre de 2026.

Los SHA de los commits (registro de un cambio individual) medidos y sus fechas son los siguientes:

```text
pallets/click    36baa15ff831b939a22bc527cd76ce653ef6f66d  2026-08-26
pallets/flask    d318b683471101618febed18996405ad26462110  2026-08-16
encode/httpx     b5addb64f0161ff6bfe94c124ef76f6a1fba5254  2026-02-23
tj/commander.js  ba6d13ddb4243e5913367734f8c159089ffe7834  2026-05-29
```

Comando tomando click como ejemplo:

```bash
git clone https://github.com/pallets/click
git -C click checkout 36baa15ff831b939a22bc527cd76ce653ef6f66d
grift repo click --format both --out out/click
grift verify out/click/report.json --repo click
```

`grift repo` concluyó en menos de 2,5 segundos en los cuatro repositorios, y `grift verify` dio `VERIFIED` en los cuatro. En un clon nuevo de click, los resultados fueron idénticos salvo por la hora de ejecución. Utilizando el mismo código fuente de la versión pública 0.7.2, los valores observados aquí presentados fueron idénticos.

| Repositorio | commits humanos / merge / bot |
|---|---|
| click | 2.000 / 1.131 / 200 |
| flask | 3.674 / 1.691 / 191 |
| httpx | 1.335 / 41 / 147 |
| commander.js | 1.095 / 284 / 138 |

Los commits humanos representan la cantidad excluyendo los merge (registros que integran cambios de otra rama). Se han descartado las modificaciones efectuadas por bots (programas que introducen cambios de forma automática).

En las áreas de trabajo (`surface_profile`), se determinan las categorías en función de la ubicación de los archivos y su extensión, y se contabilizan los commits por categoría. Dado que un mismo commit puede corresponder a varias categorías, la suma supera al denominador.

| Repositorio | Denominador | test / docs / backend / other |
|---|---|---|
| click | 1.999 | 562 / 1.024 / 1.158 / 309 |
| flask | 3.673 | 627 / 1.841 / 1.765 / 575 |
| httpx | 1.333 | 575 / 501 / 874 / 112 |
| commander.js | 1.094 | 286 / 468 / 0 / 530 |

El intervalo de cambios (`change_rhythm`) se calcula tomando como fecha de observación la fecha de HEAD y midiendo los 180 días previos a la misma. La fecha de observación es la indicada a la derecha del SHA arriba expuesto.

| Repositorio | commit / Días de actividad | Mediana del intervalo / p90 |
|---|---|---|
| click | 187 / 62 días | 0,08 días / 3,36 días |
| flask | 32 / 19 días | 0,80 días / 15,60 días |
| httpx | 11 / 8 días | No observado |
| commander.js | 22 / 18 días | 2,88 días / 17,89 días |

El motivo de «no observado» en httpx es `insufficient_population`. Los commits dentro de la ventana fueron 11, sin alcanzar el umbral mínimo de 20 necesario para calcular el ratio.

La modalidad de verificación (`verification_profile`) contabiliza los commits que tocaron ubicaciones clasificadas como test.

| Repositorio | commits con test | commits con asunto fix que también modificaron test |
|---|---|---|
| click | 562 / 2.000 | 80 / 249 |
| flask | 627 / 3.674 | 58 / 408 |
| httpx | 575 / 1.335 | 46 / 114 |
| commander.js | 286 / 1.095 | 30 / 106 |

En cuanto al tipo de test: click tuvo 555 unitarios y 23 no determinados; flask, 484 unitarios y 204 no determinados; httpx, 554 unitarios y 101 no determinados; y commander.js, 286 no determinados.

Los elementos no observados fueron 23 en click, flask y commander.js, y 27 en httpx. Los motivos principales son los siguientes:

- `forge_export_not_provided`, `tracker_export_not_provided`: revisiones, gestión de incidencias, eventos
- `consenting_actor_required`: experiencia, rol, contexto de librerías
- `no_upstream_lineage`, `parent_repo_not_provided`, `template_not_provided`: relación con upstream, herencia desde plantillas
- `no_tenant_commits`: periodo en el que se concentra el 80 % de los commits internos
- `survival_scan_disabled`: tasa de retención
- `outcome_declaration_not_provided`: declaración de eventos posteriores al trabajo
- `deferred_to_v0.6`: retrabajo a nivel de línea (en la 0.8.0 aún conserva el nombre de la 0.6)

En procedencia (`origin`), en los cuatro proyectos todos los commits salvo los de bots figuraron como `unresolved`. Esto se debe a que no se proporcionó ni un archivo identity.toml con los correos corporativos ni la referencia upstream del fork.

El desglose de los commits considerados documentación en click y el de los commits de tipo fix en flask no provienen de la salida de Grift. Son aproximaciones recalculadas en local aplicando las mismas reglas a git log. En click, de 1.025 casos, en 414 el único archivo tocado como documentación fue `CHANGES.rst`. En flask, de 407 commits con asunto de fix, 198 modificaron únicamente archivos de documentación o configuración.

En cuanto al orden de la lista (`actor_directory`), si se reordenan las filas de la 0.8.0 de mayor a menor número de commits y se pasa por `grift verify`, finaliza con código de salida 1 debido a `MISMATCH: 1 field(s) differ`. Si se verifica con la 0.8.0 un informe guardado con la 0.7.2, arroja `CANNOT_VERIFY` por discrepancia en la versión de definiciones. La advertencia sobre los días de actividad aparece en la 0.8.0 en `activity.limitations` y `change_rhythm.limitations`, y no figuraba en la 0.7.2.

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

La salida se divide en dos secciones: «declaración del proyecto» y «valores observados»; las partidas no declaradas resultaron en `not_declared` (el proyecto no lo ha especificado; no implica carencia). La confrontación entre la declaración y la observación eje por eje corresponde a `grift align`, que clasifica los resultados en cinco estados: coincidencia, fuera de rango, 0 casos, no observado o sin requisito.

## Materiales de referencia

- [grift-cli (GitHub, MIT)](https://github.com/Cor-Incorporated/grift-cli) - Código fuente de la CLI. La versión pública es la 0.7.2; la 0.8.0 está en preparación para lanzamiento
- [Grift](https://griftai.org) - Sitio web del producto
- [Página de TEP (Grift)](https://griftai.org/tep) - Explicación detallada de TEP
- [Cómo leer los informes de grift (metrics-guide)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/metrics-guide.md) - Guía accesible de cada métrica
- [Normas de uso de TEP (norms)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/norms.md) - No interpretar la ausencia de forma negativa; prohibición de ponderaciones y conversiones
- [Cómo proteger con la implementación el principio de «no puntuar ni clasificar» (Blog de Cor.Inc., 25 de octubre de 2026)](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/) - Las 5 condiciones definidas en la versión 0.8
- [Fundé una empresa para hacer del «por fin nos entendemos» algo cotidiano (Blog de Cor.Inc.)](https://cor-jp.com/blog/founder-story/) - Relato del representante y filosofía con la que nació Grift
- [Ethical Use of the MBTI (The Myers & Briggs Foundation)](https://www.myersbriggs.org/unique-features-of-myers-briggs/ethical-use-of-the-mbti/) - Normas de uso del MBTI (carácter voluntario, no apto para fines de contratación)
- [MBTI Basics (The Myers & Briggs Foundation)](https://www.myersbriggs.org/my-mbti-personality-type/mbti-basics/) - Las 4 preferencias y los 16 tipos
- [pallets/click](https://github.com/pallets/click) - OSS analizado (HEAD `36baa15`)
- [pallets/flask](https://github.com/pallets/flask) - OSS analizado (HEAD `d318b68`)
- [encode/httpx](https://github.com/encode/httpx) - OSS analizado (HEAD `b5addb6`)
- [tj/commander.js](https://github.com/tj/commander.js) - OSS analizado (HEAD `ba6d13d`)
