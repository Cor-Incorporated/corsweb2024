---
title: "Cómo mantener en la implementación el principio de «no puntuar ni clasificar». Las 5 condiciones definidas para la próxima versión de Grift CLI"
description: "Grift CLI promete no emitir puntuaciones ni clasificaciones. En la verificación de octubre de 2026, se descubrió que, aunque una nota indicaba que no se trataba de una clasificación, la tabla estaba ordenada por número de commits de mayor a menor. Explicamos de forma sencilla las 5 condiciones de aceptación impuestas a la versión 0.8 para clientes, comerciales de SES e ingenieros."
summary: "En el listado de múltiples personas de Grift CLI, aunque una nota indicaba que «no es una clasificación», las filas estaban ordenadas de mayor a menor número de commits. En la versión 0.8, el orden pasa a ser lexicográfico por ID y los valores se mantienen como hechos con denominador. Asimismo, se establecieron 5 condiciones de aceptación: no ordenar a las personas por volumen observado, indicar explícitamente en el nombre si se selecciona por volumen, mostrar la posición en la distribución de referencia solo cuando se solicite, revelar la lógica de ponderación sin aplicar correcciones, y separar en ambas direcciones las declaraciones de las observaciones."
pubDate: 2026-10-25
updatedDate: 2026-10-26
author: "Terisuke"
category: "engineering"
ctaIntent: "grift-team-beta"
tags: ["Grift", "OSS", "CLI", "git", "設計"]
lang: "es"
featured: false
isDraft: false
translationSourceHash: "b4df3339b952ccaf76a24aeda11f1f5ea378a44ad8a3ea41e018de59e3116d63"
translatedAt: "2026-10-26T04:37:19.862Z"
translationModel: "gemini-3.8-flash"
---

«No asignamos puntuaciones ni clasificaciones». Grift hace esta promesa tanto en griftai.org como en cor-jp.com.

Sin embargo, poner una promesa por escrito y que el software la cumpla son dos cosas distintas. En este artículo, explico la discrepancia que encontramos dentro de Grift CLI el 25 de octubre de 2026 y las cinco condiciones que decidimos imponer a la versión 0.8. Lo he redactado de la forma más accesible posible, pensando en clientes contratantes, personal comercial de agencias de empleo o empresas de SES, y los propios ingenieros que son recomendados.

> El 26 de octubre de 2026, al día siguiente de escribir este artículo, publicamos la versión 0.8.0. Los detalles del cambio que ordena la lista de personas por ID se encuentran en las [notas de la versión 0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0). El cuerpo de este texto se mantiene tal como fue redactado en ese momento (25 de octubre de 2026).

## Lo que ocurrió en el terreno

Grift CLI incluye una salida que lista a las personas que han participado en un repositorio (`actor-index`). En la versión [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/), que era la publicada en el momento de redactar este artículo, dicha lista incluye una nota que aclara: «Extraído únicamente por número de commits; no representa un orden de calidad».

No obstante, las filas de la tabla estaban ordenadas de mayor a menor número de commits.

La nota dice «no es una clasificación», pero el orden de la tabla lo determinaba el número de commits. Lo primero que capta la vista del lector no es la nota, sino la tabla. Si alguien interpreta que la persona de la primera fila es «la que mejor lo ha hecho», consideramos que la responsabilidad no es de quien lee, sino de la forma de ordenar los datos.

En el cotejo de ese mismo día, se detectó otra carencia. `grift align` solo contemplaba la dirección de contrastar los requisitos declarados por el proyecto con las observaciones del candidato, sin ofrecer una vía para que el ingeniero declare lo que busca en un proyecto. Esto significaba que la mitad de la promesa que veníamos escribiendo —«tanto para quien recomienda como para quien es recomendado»— no existía en la implementación.

Ambas cuestiones fueron detectadas por Cor. al contrastar línea por línea el texto de su propio sitio web con las salidas de la CLI. No surgieron de señalamientos de los usuarios. El mismo día en que se detectaron, quedaron registradas como un registro de decisión de arquitectura (ADR).

## Por qué corregir primero solo el orden

Existe la postura de que bastaría con dejar de mostrar el número de commits. Grift no optó por eso.

El número de commits es un hecho que incluye un denominador. El «73 de 274 casos» que aparece en la demo de griftai.org tampoco se puede interpretar sin la población base. Si lo elimináramos, entraría en conflicto con el Artículo 1 de las normas de uso: «No interpretar la ausencia como algo negativo». Lo que se elimina no es el valor, sino el orden.

El orden no es un hecho, sino una decisión de presentación. Colocar primero a quien tiene más es una forma de presentación que induce a la parte receptora a leerlo como una clasificación. En la próxima versión, el orden predeterminado de la lista pasará a ser el orden lexicográfico por ID. El valor del número de commits se mantendrá. Aunque aumenten los commits, ya no se subirá a lo más alto de la tabla.

## Las 5 condiciones impuestas a la versión 0.8

Decidimos imponer las siguientes cinco condiciones de aceptación a todos los cambios de la serie 0.8.

### 1. No ordenar personas por cantidades observadas

El orden predeterminado en las salidas que enumeran personas será el orden lexicográfico por ID, sin depender de cantidades observadas como el número de commits, líneas o días. Los valores en sí se mantendrán como hechos acompañados de su denominador.

### 2. Al seleccionar por cantidad, indicar claramente que se trata de cantidad mediante el nombre y notas

La opción `--top N` extrae a las N personas con mayor número de commits observados. Se trata de una selección por cantidad. La mantendremos en la próxima versión, pero continuaremos indicando tanto en la ayuda como en las notas de salida que «el criterio de selección es el número de commits, no la calidad ni una clasificación». Cambiarle el nombre o eliminarla rompería los usos existentes, por lo que se evaluará en versiones posteriores. No crearemos nuevos mecanismos de selección basados en cantidades observadas.

### 3. La posición en la distribución de referencia solo se mostrará si se solicita

Grift cuenta con una función para mostrar en qué franja se sitúan los valores de un repositorio dentro de la distribución de referencia de repositorios públicos. Aunque se trata de la posición del repositorio y no de una persona, quien lo ejecuta puede interpretarlo como «mi repositorio está en el N% superior». Si aumenta la tasa, la franja también sube. A partir de la próxima versión, solo se mostrará cuando se solicite de forma explícita especificando la versión de la distribución de referencia; por defecto, quedará como no observado con el motivo «distribución de referencia no solicitada».

### 4. Divulgar los modos de «inflar» las cifras, sin aplicar correcciones

La tasa de modificación conjunta de pruebas puede subir incluso con un cambio formal de una sola línea en un archivo de test. No se contabiliza el número de líneas modificadas. El número de días con modificaciones en los últimos 180 días se puede llenar con un commit pequeño al día.

Estas vías se indicarán de forma fija junto a los valores numéricos. No se aplicarán ponderaciones ni correcciones, ya que el Artículo 7 de las normas de uso prohíbe la corrección de cifras en función del contexto o la dificultad. Esta divulgación busca que el lector conozca las limitaciones de los valores numéricos, no es una función para detectar cifras infladas.

### 5. No mezclar declaraciones con observaciones, en ambas direcciones

Los requisitos del proyecto son «declaraciones»; el historial de git del candidato es una «observación». `grift align` contrasta ambos elementos eje por eje y los presenta en cinco estados: coincidencia, fuera de rango, 0 casos, no observado o sin requisitos. No se generan puntuaciones globales, clasificaciones ni resultados de aprobado/reprobado.

En caso de habilitar una vía para que los ingenieros declaren lo que buscan en un proyecto, se utilizarán los mismos cinco estados y las mismas prohibiciones. En cualquiera de las dos direcciones, las declaraciones y las observaciones se ubicarán en campos separados.

## Para cada perfil de lector

A los clientes contratantes: a partir de la próxima versión, ya no será posible interpretar que quien está arriba en la lista es mejor. El orden será por ID. Utilicen los valores numéricos como material para concretar las preguntas en las entrevistas.

Al personal comercial de agencias y SES: reconfigurar los registros compartidos por los propios candidatos para utilizarlos como una tabla clasificatoria infringe las normas de uso. Al presentar los motivos de una recomendación, incluyan los valores, los denominadores y las razones de lo que no se pudo observar.

A los ingenieros: aunque aumenten los commits, no subirán a los primeros lugares de la lista. El hecho mismo de haber seleccionado qué repositorios mostrar quedará reflejado de forma visible para quien lo reciba. Seleccionar no está prohibido; lo que se exige es no ocultarlo.

## Conclusión

Las promesas no se cumplen limitándose a ponerlas por escrito. Si el texto y la implementación difieren, se corrige la implementación y se publica el proceso de la corrección.

En el momento de redactar este artículo, la versión 0.8 aún no se había publicado. Como cambiar el orden de clasificación provocaría que los resultados de verificación de las listas guardadas en versiones anteriores no coincidieran, estaba previsto lanzarlo junto con la actualización de la versión de las definiciones. [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0) se publicó el 26 de octubre de 2026, tras actualizar la versión de las definiciones.

## Materiales de referencia

- [Grift](https://griftai.org) - Sitio del producto. Las tres promesas y los elementos observados
- [grift-cli (GitHub, MIT)](https://github.com/Cor-Incorporated/grift-cli) - Código fuente de la CLI
- [Notas de la versión de grift-cli 0.8.0 (GitHub)](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0) - Cambios de la versión 0.8.0 publicada el 26 de octubre de 2026
- [grift-cli 0.7.2 (PyPI)](https://pypi.org/project/grift-cli/0.7.2/) - Versión publicada en el momento de redactar este artículo
- [Normas de uso de TEP (norms)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/norms.md) - Artículo 1: «No interpretar la ausencia como algo negativo», Artículo 7: «Prohibición de ponderaciones y conversiones», tratamiento de `--top N` y `grift align`
- [Cómo leer los reportes de grift (metrics-guide)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/metrics-guide.md) - Explicación accesible de cada métrica y convenciones de notación de deciles
- [Página de casos de Grift](https://cor-jp.com/works/grift/) - Presentación de casos de éxito en cor-jp.com
