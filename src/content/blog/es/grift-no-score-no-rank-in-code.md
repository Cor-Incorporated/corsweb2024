---
title: "Cómo mantener en la implementación el principio de «no puntuar ni clasificar». Las 5 condiciones definidas por Grift CLI para su próxima versión"
description: "Grift CLI promete no emitir puntuaciones ni clasificaciones. En la verificación de octubre de 2026, se descubrió que, si bien una nota indicaba que no se trataba de una clasificación, la tabla estaba ordenada de forma descendente por número de commits. Explicamos de forma sencilla las 5 condiciones de aceptación impuestas para la versión 0.8, dirigidas a clientes contratantes, comerciales de SES e ingenieros."
summary: "En los listados de varias personas de Grift CLI, aunque en las notas se indicaba que «no se trata de una clasificación», las filas se mostraban ordenadas de forma descendente por número de commits. En la versión 0.8, el orden pasará a ser alfabético por ID y los valores se conservarán como hechos con su respectivo denominador. Asimismo, se establecieron como criterios de aceptación cinco condiciones: no ordenar personas por volumen observado, explicitar el criterio en el nombre al seleccionar por volumen, mostrar la posición en la distribución de referencia solo si se solicita, no aplicar correcciones haciendo públicos los métodos de ajuste, y separar en ambas direcciones las declaraciones de las observaciones."
pubDate: 2026-10-25
updatedDate: 2026-10-26
author: "Terisuke"
category: "engineering"
ctaIntent: "grift-team-beta"
tags: ["Grift", "OSS", "CLI", "git", "設計"]
lang: "es"
featured: false
isDraft: false
translationSourceHash: "a47e08fdba13a2b559bd0cf770e29dd7802e01efe33e23eea5205d8b53a2a12d"
translatedAt: "2026-10-26T07:50:02.866Z"
translationModel: "gemini-3.8-flash"
---

«No asignamos puntuaciones ni clasificaciones». Grift mantiene esa promesa tanto en griftai.org como en cor-jp.com.

Sin embargo, poner una promesa por escrito y que el software la cumpla son dos cosas distintas. En este artículo, explico la discrepancia encontrada en Grift CLI el 25 de octubre de 2026 y las cinco condiciones que decidimos imponer a la versión 0.8. He redactado esto de la forma más clara y accesible posible, pensando en clientes contratantes, personal comercial de agencias de colocación o SES, y los propios ingenieros que son recomendados.

> El 26 de octubre de 2026, al día siguiente de escribir este artículo, publicamos la versión 0.8.0. Los detalles del cambio para ordenar la lista de personas por ID se encuentran en las [notas de la versión 0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0). El cuerpo de este texto se mantiene exactamente tal como se redactó en su momento (25 de octubre de 2026).

## Lo que ocurrió en la práctica

Grift CLI cuenta con una salida que lista a las personas que han participado en un repositorio (`actor-index`). En la versión [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/), que era la publicada en el momento de escribir este artículo, dicha lista incluía una nota aclaratoria: «Extraído únicamente por número de commits; no constituye una clasificación cualitativa».

Sin embargo, las filas de la tabla estaban ordenadas de mayor a menor número de commits.

La nota decía «no es una clasificación», pero el orden de la tabla venía determinado por el número de commits. Lo primero que capta la vista del lector no es la nota, sino la tabla. Consideramos que si alguien interpreta a la persona de la primera fila como «quien mejor lo ha hecho», la responsabilidad no es del lector, sino de la forma de ordenarlos.

En el cotejo realizado ese mismo día, se detectó otra carencia. `grift align` solo ofrecía la dirección de alinear los requisitos declarados por el proyecto con las observaciones del candidato, y no disponía de un punto de entrada para que el ingeniero declarase lo que busca en un proyecto. La mitad de la promesa que habíamos formulado como «tanto para quien recomienda como para quien es recomendado» no existía en la implementación.

Ambas cuestiones fueron detectadas por Cor. al contrastar línea por línea el texto de su sitio web con la salida de la CLI. No surgieron a raíz de señalamientos de los usuarios. El mismo día en que se encontraron, quedaron registradas formalmente como un registro de decisión de arquitectura (ADR).

## Por qué corregir primero solo el orden

Existe la postura de que bastaría con dejar de mostrar el número de commits. Grift no optó por eso.

El número de commits es un hecho que incluye un denominador. La cifra de «73 de 274 casos» en la demostración de griftai.org tampoco puede interpretarse sin el total de la muestra. Si se eliminara, entraría en conflicto con el Artículo 1 del código de conducta de uso: «No interpretar la ausencia de forma negativa». Lo que se elimina no es el valor, sino el orden de visualización.

El orden no es un hecho, sino una decisión de presentación. Situar en primer lugar a quien tiene más es una forma de presentación que induce a quien lo recibe a interpretarlo como una clasificación. En la siguiente versión, el orden predeterminado de la lista pasará a ser el orden lexicográfico del ID. El valor del número de commits se mantendrá. Aunque aumenten los commits, ya no se ascenderá a la parte superior de la tabla.

## Las 5 condiciones impuestas a 0.8

Decidimos imponer las siguientes cinco condiciones de aceptación a todos los cambios de la serie 0.8.

### 1. No ordenar a las personas según la cantidad observada

El orden predeterminado en las salidas que enumeran personas será el orden lexicográfico del ID, sin depender de cantidades observadas como el número de commits, de líneas o de días. El valor en sí se mantendrá como un hecho con denominador.

### 2. Al seleccionar por cantidad, explicitar mediante el nombre y notas que se trata de cantidad

La opción `--top N` extrae a las N personas con mayor número de commits observados. Esto es una selección basada en la cantidad. La mantendremos en la siguiente versión, pero continuaremos indicando claramente en la ayuda y en las notas de la salida que «el criterio de selección es el número de commits, y no la calidad ni una clasificación». Cambiar el nombre o retirarla se decidirá en versiones posteriores, ya que supondría un cambio que rompería el uso existente. No crearemos nuevos mecanismos de selección basados en cantidades observadas.

### 3. Mostrar la posición en la distribución de referencia solo cuando se solicite

Grift dispone de una función que muestra en qué franja se sitúa el valor de un repositorio dentro de la distribución de referencia de repositorios públicos. Se trata de la posición del repositorio, no de una persona, pero quien lo ejecuta por sí mismo puede interpretarlo como «mi repositorio está en el top N%». Al subir el porcentaje, también sube la franja. A partir de la siguiente versión, solo se mostrará cuando se solicite indicando explícitamente la versión de la distribución de referencia; de forma predeterminada, figurará como no observado con el motivo: «No se ha solicitado la distribución de referencia».

### 4. Divulgar los modos de «inflar» las cifras, sin aplicar correcciones

La tasa de modificación concurrente de tests puede subir incluso con un cambio formal de una sola línea en un archivo de test. No evalúa el número de líneas modificadas. El número de días con cambios en los últimos 180 días puede completarse con un pequeño commit cada día.

Estas vías se indicarán junto a los valores mediante un texto fijo. No se aplicarán ponderaciones ni correcciones. Esto se debe a que el Artículo 7 del código de conducta de uso prohíbe corregir los valores en función del contexto o la dificultad. La divulgación tiene como fin que el lector conozca las limitaciones de las cifras. No es una función para detectar el inflado de valores.

### 5. No mezclar declaraciones y observaciones. En ambas direcciones

Los requisitos del proyecto son «declaraciones», mientras que el historial de git del candidato es una «observación». `grift align` alinea estos dos elementos por cada eje y los presenta en cinco estados: coincidencia, fuera de rango, 0 casos, no observado o sin requisitos. No genera puntuaciones globales, clasificaciones ni resultados de apto/no apto.

Cuando se cree el punto de entrada para que el ingeniero declare lo que busca en un proyecto, se utilizarán los mismos cinco términos y las mismas prohibiciones. En cualquiera de las dos direcciones, las declaraciones y las observaciones se ubicarán en campos separados.

## Según la perspectiva de cada lector

Para los clientes contratantes: a partir de la próxima versión, ya no será posible interpretar que la persona situada en la parte superior de la lista es la mejor. El orden será por ID. Utilice las cifras como material para concretar los temas a tratar en las entrevistas.

Para el personal comercial de agencias de colocación y SES: reorganizar los registros compartidos por el propio candidato en una tabla de clasificación es un uso contrario al código de conducta de uso. Comunique los motivos de la recomendación acompañados de los valores, sus denominadores y las razones de lo que no pudo observarse.

Para los responsables de selección en empresas de desarrollo interno: derivar clasificaciones o decisiones de apto/no apto a partir de los registros compartidos también es un uso contrario al código de conducta de uso. Utilice las cifras como material para concretar los temas a tratar en las entrevistas.

Para los ingenieros: aunque aumente los commits, no subirá a la parte superior de la lista. El hecho de haber elegido qué repositorios mostrar quedará reflejado de forma comprensible para quien lo recibe. No se prohíbe elegir; lo que se exige es no ocultarlo.

## Resumen

Las promesas no se cumplen simplemente poniéndolas por escrito. Si el texto y la implementación discrepan, se corrige la implementación y se publica el proceso de dicha corrección.

En el momento de redactar este artículo, la versión 0.8 aún no se había publicado. Dado que cambiar el orden provocaría que los resultados de verificación de las listas guardadas en versiones anteriores no coincidieran, estaba previsto lanzarlo junto con la actualización de la versión de las definiciones. [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0) se publicó el 26 de octubre de 2026, incrementando la versión de las definiciones.

## Materiales de referencia

- [Grift](https://griftai.org) - Sitio web del producto. Las tres promesas y los elementos observados
- [grift-cli (GitHub, MIT)](https://github.com/Cor-Incorporated/grift-cli) - Código fuente de la CLI
- [Notas de la versión de grift-cli 0.8.0 (GitHub)](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0) - Cambios de la versión 0.8.0 publicada el 26 de octubre de 2026
- [grift-cli 0.7.2 (PyPI)](https://pypi.org/project/grift-cli/0.7.2/) - Versión publicada en el momento de redactar este artículo
- [Código de conducta de uso de TEP (norms)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/norms.md) - Artículo 1 «No interpretar la ausencia de forma negativa», Artículo 7 «Prohibición de ponderaciones y conversiones», tratamiento de `--top N` y `grift align`
- [Cómo leer el informe de grift (metrics-guide)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/metrics-guide.md) - Explicaciones sencillas de cada métrica y convenciones de notación por deciles
- [Página de casos prácticos de Grift](https://cor-jp.com/works/grift/) - Presentación de logros en cor-jp.com
