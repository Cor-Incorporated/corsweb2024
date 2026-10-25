---
title: "Cómo mantener en la implementación el principio de «ni puntuaciones ni clasificaciones»: 5 condiciones definidas por Grift CLI para su próxima versión"
description: "Grift CLI promete no emitir puntuaciones ni clasificaciones. En la verificación de octubre de 2026, se detectó que, aunque las notas aclaraban que no se trataba de un ranking, la tabla estaba ordenada de forma descendente por número de commits. Explicamos de forma sencilla para clientes contratantes, comerciales de SES e ingenieros las 5 condiciones de aceptación impuestas a la próxima versión (0.8)."
summary: "En los listados de múltiples personas de Grift CLI, aunque en las notas se indicaba que «no se trata de una clasificación», las filas estaban ordenadas por número de commits de mayor a menor. En la próxima versión (0.8), el orden pasará a ser alfabético por ID y los valores se conservarán como hechos con su denominador correspondiente. Asimismo, se establecieron cinco condiciones de aceptación: no ordenar a las personas según la cantidad observada, indicar explícitamente en el nombre cuando se filtre o seleccione por cantidad, mostrar la posición en la distribución de referencia únicamente cuando se solicite, revelar el criterio de ponderación sin aplicar correcciones automáticas y separar en ambas direcciones la declaración y la observación."
pubDate: 2026-10-25
author: "Terisuke"
category: "engineering"
ctaIntent: "grift-team-beta"
tags: ["Grift", "OSS", "CLI", "git", "設計"]
lang: "es"
featured: false
isDraft: false
translationSourceHash: "39c0007f6df8fb02d1c8dcdeffbd2f772c87a2f5bccb1059088da8a87d9bd81e"
translatedAt: "2026-10-25T07:39:52.685Z"
translationModel: "gemini-3.8-flash"
---

"No asignamos puntuaciones ni clasificaciones". Grift mantiene esta promesa tanto en griftai.org como en cor-jp.com.

Sin embargo, plasmar una promesa por escrito y que el software la cumpla son dos cosas distintas. En este artículo, exponemos las discrepancias detectadas el 25 de octubre de 2026 dentro de Grift CLI y las cinco condiciones que hemos decidido exigir para la próxima versión (0.8). Lo hemos redactado con la mayor sencillez posible, dirigido a clientes contratantes, profesionales de ventas en agencias de selección y empresas de SES, y a los propios ingenieros propuestos.

## Lo que ocurrió sobre el terreno

Grift CLI incluye una salida que enumera a las personas que han contribuido a un repositorio (`actor-index`). En la versión v0.7.2 disponible públicamente, esta lista incluye la siguiente nota: "Se trata de una simple extracción basada en el número de commits, no de una clasificación de calidad".

Sin embargo, las filas de la tabla aparecían ordenadas de mayor a menor número de commits.

La nota afirma que "no es una clasificación", pero el orden de la tabla lo determina la cantidad de commits. Lo primero que capta la mirada del lector no es la nota, sino la tabla. Si alguien interpreta que la persona de la fila superior es "la que mejor lo ha hecho", consideramos que no es responsabilidad del lector, sino del modo en que se ordenan los datos.

En la confrontación realizada ese mismo día, se detectó otra carencia. `grift align` solo disponía de la dirección para contrastar los requisitos declarados por el proyecto con las observaciones del candidato, sin contar con un punto de entrada para que el ingeniero declarara lo que exige al proyecto. Esto significa que la mitad del compromiso de "tanto para quien recomienda como para quien es recomendado" no estaba implementada.

Ambos casos fueron detectados por Cor. al contrastar línea por línea el texto de su propio sitio web con las salidas de la CLI; no surgieron a partir de señalamientos de los usuarios. El mismo día de su detección, se documentaron como un registro de decisión arquitectónica (ADR).

## Por qué corregimos primero únicamente el orden de clasificación

Existe el punto de vista de que bastaría con dejar de mostrar el número de commits. Grift no optó por eso.

El número de commits es un hecho con denominador. La cifra "73 de 274 casos" que figura en la demo de griftai.org tampoco puede interpretarse sin el tamaño de la muestra. Eliminarlo entraría en conflicto con el Artículo 1 de las normas de uso: "No interpretar la ausencia como algo negativo". Lo que se elimina no es el valor, sino el orden de visualización.

El orden no es un hecho, sino una decisión sobre cómo presentar la información. Colocar primero a quien más tiene es una forma de presentación que induce a quien lo recibe a leerlo como una clasificación. En la próxima versión, el orden predeterminado de la lista pasará a ser el orden lexicográfico del ID. El valor del número de commits se mantendrá. Aunque aumenten los commits, ya no se ascenderá a la parte superior de la tabla.

## Las 5 condiciones impuestas a la próxima versión (0.8)

Hemos decidido aplicar los siguientes cinco criterios de aceptación a todos los cambios de la serie 0.8.

### 1. No ordenar a las personas según la cantidad observada

El orden predeterminado en las salidas que enumeran personas será el orden lexicográfico del ID, desvinculándolo de cantidades observadas como el número de commits, de líneas o de días. El valor en sí se mantendrá como un hecho con denominador.

### 2. Al seleccionar por cantidad, explicitar mediante el nombre y notas que se trata de cantidad

La opción `--top N` extrae a las N personas con mayor número de commits observados. Se trata de una selección por cantidad. La mantendremos en la próxima versión, pero continuaremos indicando en la ayuda y en las notas de salida que "el criterio de selección es el número de commits, no la calidad ni una clasificación". Evaluar si cambiamos su nombre o si la eliminamos es un cambio que rompería el uso existente, por lo que se decidirá en versiones posteriores. No crearemos nuevos mecanismos de selección basados en cantidades observadas.

### 3. Mostrar la posición en la distribución de referencia solo cuando se solicite

Grift dispone de una función que muestra en qué banda se sitúa el valor de un repositorio dentro de la distribución de referencia de repositorios públicos. Aunque se trata de la posición del repositorio y no de una persona, quien lo ejecuta puede interpretarlo como "mi repositorio está en el top N%". Al elevar el porcentaje, también sube la banda. A partir de la próxima versión, solo se mostrará cuando se solicite indicando explícitamente la versión de la distribución de referencia; de forma predeterminada, se marcará como no observado con el motivo: "No se ha solicitado la distribución de referencia".

### 4. Revelar cómo se pueden "inflar" las cifras y no aplicar correcciones

La tasa de modificación simultánea de pruebas puede aumentar incluso con un cambio formal de una sola línea en un archivo de prueba. No se contabilizan las líneas modificadas. El número de días con modificaciones en los últimos 180 días puede completarse con un pequeño commit cada día.

Estas vías se indicarán de forma explícita junto a las cifras mediante un texto fijo. No aplicaremos ponderaciones ni correcciones, ya que el Artículo 7 de las normas de uso prohíbe corregir cifras en función del contexto o la dificultad. Esta divulgación tiene como objetivo que el lector conozca las limitaciones de los valores numéricos. No es una función para detectar cifras infladas.

### 5. No mezclar declaraciones con observaciones, en ambas direcciones

Los requisitos del proyecto son una "declaración"; el historial git del candidato es una "observación". `grift align` alinea ambos elementos en cada eje y los muestra según cinco estados: coincidencia, fuera de rango, 0 casos, no observado o sin requisitos. No se generan puntuaciones globales, clasificaciones ni resultados de aprobado/suspenso.

Cuando se habilite la entrada para que los ingenieros declaren lo que buscan en un proyecto, se utilizarán los mismos cinco términos y las mismas prohibiciones. En cualquiera de las dos direcciones, la declaración y la observación se situarán en campos separados.

## Para cada perfil de lector

A los clientes contratantes: a partir de la próxima versión ya no se podrá interpretar que quien está arriba en la lista es la persona más destacada. El orden seguirá los ID. Utilice los datos numéricos como base para formular preguntas concretas durante las entrevistas.

A los profesionales de ventas en agencias de selección y SES: reorganizar los registros compartidos por los propios candidatos para convertirlos en una tabla de clasificación infringe las normas de uso. Al presentar los motivos de una recomendación, acompáñelos con el valor, el denominador y las razones por las que no se pudo observar cierta información.

A los ingenieros: aumentar el número de commits no hará que ascienda en la lista. El hecho de haber seleccionado qué repositorios mostrar quedará registrado de forma visible para quien recibe la información. No prohibimos seleccionar; lo que exigimos es no ocultar.

## Conclusión

Las promesas no se cumplen limitándose a ponerlas por escrito. Si el texto y la implementación difieren, corregimos la implementación y publicamos el proceso de rectificación.

La versión 0.8 todavía no se ha publicado. Puesto que cambiar el orden provocaría que los resultados de verificación de listas guardadas con versiones anteriores ya no coincidan, se publicará junto con la actualización de la versión de las definiciones.

## Materiales de referencia

- [Grift](https://griftai.org) - Sitio web del producto. Las tres promesas y los elementos observados
- [grift-cli (GitHub, MIT)](https://github.com/Cor-Incorporated/grift-cli) - Código fuente de la CLI
- [Normas de uso de TEP (norms)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/norms.md) - Artículo 1: "No interpretar la ausencia como algo negativo", Artículo 7: "Prohibición de ponderaciones y conversiones", tratamiento de `--top N` y `grift align`
- [Cómo leer el informe de Grift (metrics-guide)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/metrics-guide.md) - Explicación sencilla de cada métrica y convenciones de notación por deciles
- [Página de casos prácticos de Grift](https://cor-jp.com/works/grift/) - Casos de éxito en cor-jp.com
