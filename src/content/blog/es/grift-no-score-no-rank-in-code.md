---
title: "Cómo mantener en la implementación el principio de «no asignar puntuaciones ni clasificaciones»: las 5 condiciones que Grift CLI ha establecido para la próxima versión"
description: "Grift CLI promete no emitir puntuaciones ni clasificaciones. En la verificación cruzada de octubre de 2026, se descubrió que, si bien una nota indicaba que no se trataba de una clasificación, la tabla estaba ordenada de forma descendente por número de commits. Explicamos de forma sencilla las 5 condiciones de aceptación impuestas para la versión 0.8, dirigidas a clientes, comerciales de SES e ingenieros."
summary: "En las listas de varias personas de Grift CLI, aunque una nota indicaba que «no se trata de una clasificación», las filas estaban ordenadas de forma descendente por número de commits. En la versión 0.8, el orden se cambiará al orden lexicográfico de los ID y los valores se mantendrán como hechos con denominador. Asimismo, se han establecido 5 condiciones de aceptación: no ordenar a las personas por la cantidad observada, indicar explícitamente en el nombre cuando se filtre por cantidad, mostrar la posición en la distribución de referencia solo cuando se solicite, no aplicar correcciones revelando el método de ponderación y separar las declaraciones de las observaciones en ambas direcciones."
pubDate: 2026-10-25
updatedDate: 2026-10-26
author: "Terisuke"
category: "engineering"
ctaIntent: "grift-team-beta"
tags: ["Grift", "OSS", "CLI", "git", "設計"]
lang: "es"
featured: false
isDraft: false
translationSourceHash: "a4f1e0d54ebc897cb5d03c3e4638f4ee95a1186614d552ad4af7870ba227abda"
translatedAt: "2026-10-26T13:32:26.624Z"
translationModel: "gemini-3.8-flash"
---

"No asignamos puntuaciones ni elaboramos clasificaciones". Esta es la promesa que mantiene Grift, tanto en griftai.org como en cor-jp.com.

Sin embargo, plasmar una promesa por escrito y que el software la cumpla son dos cosas distintas. En este artículo, explico la discrepancia detectada el 25 de octubre de 2026 en la CLI de Grift y las cinco condiciones que decidimos imponer a la versión 0.8. Lo he escrito de la forma más accesible posible para clientes contratantes, comerciales de agencias de colocación y empresas de SES, y para los propios ingenieros propuestos.

> El 26 de octubre de 2026, el día siguiente a la redacción de este artículo, publicamos la versión 0.8.0. Los detalles del cambio para ordenar la lista de personas por ID se encuentran en las [notas de la versión 0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0). El cuerpo del texto se conserva exactamente como fue redactado en su momento (25 de octubre de 2026).

## Lo que ocurrió sobre el terreno

La CLI de Grift incluye una salida que lista a las personas que han participado en un repositorio (`actor-index`). En la versión [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/), que era la publicada en el momento de escribir este artículo, esta lista iba acompañada de la siguiente nota: "Esta lista solo se ha extraído por número de commits; no representa una clasificación de calidad".

Sin embargo, las filas de la tabla aparecían ordenadas de mayor a menor número de commits.

La nota afirmaba que "no era una clasificación", pero la ordenación de la tabla venía determinada por el número de commits. Lo primero que capta la vista del lector no es la nota, sino la tabla. Si alguien interpreta que la persona de la primera fila es "quien mejor lo ha hecho", consideramos que no es culpa del lector, sino de cómo se ordenaron los datos.

En la revisión de ese mismo día se detectó otra carencia. `grift align` solo ofrecía la dirección de comparar los requisitos declarados por el proyecto con las observaciones del candidato; no existía un punto de entrada para que el ingeniero declarase lo que busca en un proyecto. Es decir, la mitad del compromiso de servir "tanto a quien recomienda como a quien es recomendado" no estaba presente en la implementación.

Ambas discrepancias las detectó Cor. al contrastar línea por línea el texto de su propio sitio web con las salidas de la CLI. No procedieron de señalamientos de los usuarios. Ese mismo día quedaron registradas formalmente como un registro de decisión de arquitectura (ADR).

## Por qué corregir primero solo el orden

Podría pensarse que bastaría con dejar de mostrar el número de commits. Grift no optó por esa vía.

El número de commits es un hecho que incluye su denominador. En la demostración de griftai.org, "73 de 274 casos" tampoco puede interpretarse sin la cifra total. Eliminarlo entraría en conflicto con el Artículo 1 del código de conducta: "No interpretar la ausencia como algo negativo". Lo que se elimina no es el valor, sino el orden.

El orden no es un hecho: es una decisión de presentación. Situar en primer lugar a quien tiene más commits es una forma de presentación que induce a la otra parte a interpretarlo como un ranking. En la próxima versión, el orden predeterminado de la lista pasará a ser el orden lexicográfico de los ID. El valor del número de commits se mantendrá, pero acumular más commits ya no hará que nadie aparezca en la parte superior de la tabla.

## Las 5 condiciones impuestas a la versión 0.8

Decidimos aplicar los siguientes cinco criterios de aceptación a todos los cambios de la serie 0.8:

### 1. No ordenar a las personas según la cantidad observada

El orden predeterminado de las salidas que enumeran personas será el orden lexicográfico de los ID, sin depender de cantidades observadas como el número de commits, de líneas o de días. Los valores en sí se mantendrán como hechos acompañados de su denominador.

### 2. Al seleccionar por cantidad, explicitar mediante el nombre y notas que se trata de cantidad

La opción `--top N` extrae a las N personas con mayor número de commits observados. Se trata de una selección por cantidad. La mantendremos en la próxima versión, pero seguiremos indicando tanto en la ayuda como en las notas de la salida que "el criterio de selección es el número de commits, no la calidad ni una clasificación". Cambiarle el nombre o retirarla supondría una modificación que rompería los flujos de uso existentes, por lo que se valorará en versiones posteriores. No crearemos ningún mecanismo nuevo de selección basado en cantidades observadas.

### 3. Mostrar la posición en la distribución de referencia solo cuando se solicite

Grift dispone de una función que muestra en qué franja se sitúan los valores de un repositorio dentro de una distribución de referencia de repositorios públicos. Aunque se trata de la posición del repositorio y no de la persona, quien ejecuta la herramienta puede interpretarlo como "mi repositorio está en el N% superior". Si se eleva el porcentaje, se sube de franja. A partir de la próxima versión, esta información solo se mostrará cuando se solicite de forma explícita especificando la versión de la distribución de referencia; de forma predeterminada, se marcará como no observada indicando el motivo: "No se ha solicitado la distribución de referencia".

### 4. Divulgar las vías para "inflar" las cifras, sin aplicar correcciones

La tasa de modificación conjunta de pruebas puede aumentar incluso con una modificación formal de una sola línea en un archivo de pruebas. No se examina el número de líneas modificadas. Los días con modificaciones en los últimos 180 días se pueden completar con un único commit pequeño al día.

Estas particularidades se indicarán junto a los valores mediante un texto fijo. No se aplicarán ponderaciones ni correcciones, ya que el Artículo 7 del código de conducta prohíbe corregir los valores en función del contexto o la dificultad. Esta divulgación busca que el lector conozca las limitaciones de las métricas; no es una función concebida para detectar el inflado artificial de cifras.

### 5. No mezclar declaraciones y observaciones, en ninguna de las dos direcciones

Los requisitos del proyecto son "declaraciones"; el historial de Git del candidato son "observaciones". `grift align` alinea ambos elementos en torno a diferentes ejes y los clasifica en cinco estados: coincidencia, fuera de rango, 0 casos, no observado y sin requisito. No genera puntuaciones globales, clasificaciones ni resultados de apto/no apto.

Cuando se habilite la vía para que los ingenieros declaren lo que buscan en un proyecto, se utilizarán los mismos cinco términos y las mismas restricciones. En ambas direcciones, las declaraciones y las observaciones figurarán en campos separados.

## Para cada tipo de lector

A los clientes contratantes: a partir de la próxima versión, ya no será posible asumir que quien aparece arriba en la lista es mejor profesional. El orden responderá a los ID. Utilicen las cifras como material para formular preguntas concretas durante las entrevistas.

A los comerciales de agencias de colocación y SES: reordenar en forma de ranking los registros compartidos por los propios candidatos vulnera el código de conducta. Al presentar una candidatura, expongan los motivos acompañados de los valores, sus denominadores y las razones por las que ciertos aspectos no pudieron observarse.

A los responsables de selección de empresas de desarrollo propio: utilizar los registros compartidos para elaborar clasificaciones o emitir veredictos de apto/no apto también infringe el código de conducta. Empleen las cifras como material para dotar de concreción a las entrevistas.

A los ingenieros: acumular commits no hará que aparezcan más arriba en la lista. Por otro lado, la decisión de qué repositorios se han mostrado quedará visible para el receptor. Seleccionar repositorios no está prohibido; lo que se exige es transparencia y no ocultar información.

## Conclusión

Las promesas no se cumplen simplemente poniéndolas por escrito. Si el texto y la implementación difieren, se corrige la implementación y se publica el proceso de rectificación.

En el momento de redactar este artículo, la versión 0.8 aún no se había publicado. Dado que cambiar el orden causaría discrepancias en las verificaciones de listas guardadas con versiones anteriores, estaba previsto lanzarlo junto con la actualización de la versión de las definiciones. La versión [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0), que incrementó la versión de las definiciones, se publicó el 26 de octubre de 2026.

## Materiales de referencia

- [Grift](https://griftai.org) - Sitio del producto. Los tres compromisos y los elementos observados.
- [grift-cli (GitHub, MIT)](https://github.com/Cor-Incorporated/grift-cli) - Código fuente de la CLI.
- [Notas de la versión de grift-cli 0.8.0 (GitHub)](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0) - Cambios introducidos en la versión 0.8.0 publicada el 26 de octubre de 2026.
- [grift-cli 0.7.2 (PyPI)](https://pypi.org/project/grift-cli/0.7.2/) - Versión publicada en el momento de escribir este artículo.
- [Código de conducta de TEP (norms)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/norms.md) - Artículo 1 "No interpretar la ausencia como algo negativo", Artículo 7 "Prohibición de ponderaciones y conversiones", tratamiento de `--top N` y `grift align`.
- [Cómo leer los informes de Grift (metrics-guide)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/metrics-guide.md) - Explicación accesible de cada métrica y convenciones de notación de deciles.
- [Página de casos prácticos de Grift](https://cor-jp.com/works/grift/) - Casos de éxito y trayectoria en cor-jp.com.
