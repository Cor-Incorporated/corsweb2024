---
title: "Migración a la nube de un sistema central heredado: organización y traspaso de 25 años de datos"
description: "Caso de éxito de la migración gradual a la nube de la base de datos central de una institución educativa, operada durante aproximadamente 25 años, clasificando hechos e hipótesis."
category: "ai-contract"
tags: ["Migración a la nube", "Sistema central", "PostgreSQL", "Migración de datos"]
publishedAt: 2026-07-02
updatedAt: 2026-10-23
summary: "Comenzando con una investigación para distinguir hechos de hipótesis, estamos traspasando a la nube mediante una migración gradual la base de datos central operada durante aproximadamente 25 años en una institución educativa."
securityNote: "Debido a un acuerdo de confidencialidad (NDA), la información que pueda identificar al cliente o al sistema se presenta de forma anonimizada."
isDraft: false
featured: false
lang: "es"
translationSourceHash: "34dc08cc30b5265ce8c7b5a895e616381ceefd66f400452da73ef5155d775d9d"
translatedAt: "2026-10-23T06:30:49.295Z"
translationModel: "gemini-3.8-flash"
---

## Desafíos

En una institución educativa, los datos acumulados durante aproximadamente 25 años —correspondientes a 225 tablas, cerca de 4,5 millones de filas y alrededor de 11.000 personas— se encontraban divididos entre múltiples bases de datos de SQL Server operadas durante largo tiempo y FileMaker. No se habían definido restricciones de clave externa (foreign key), por lo que la coherencia entre los datos se mantenía únicamente a través de la operativa a nivel de aplicación. En Cor. consideramos que limitarse a transferir estos datos, que presentaban los típicos problemas de los sistemas heredados, conllevaba el riesgo de no transmitir 25 años de conocimiento tácito y generar confusión en las operaciones del día a día.

## Enfoque

En lugar de migrar los datos de forma inmediata, comenzamos por investigar a fondo las bases de datos existentes. Durante la investigación, dimos gran importancia a clasificar y distinguir los "hechos confirmados" de las "hipótesis que requerían verificación". Definimos y verbalizamos las relaciones entre tablas y el significado de los datos, contrastándolos no solo con la documentación, sino también con la operativa real en el lugar de trabajo, para evitar trasladar hipótesis no confirmadas a la fase de diseño. Como destino de la migración se seleccionó Google Cloud (Cloud SQL / PostgreSQL + Cloud Run), optando no por una simple réplica, sino por un rediseño adaptado a las operaciones actuales.

## Implementación

A partir de la estructura esclarecida en la investigación, rediseñamos el esquema para permitir la gestión de nombres multinacionales. La migración no se realizó de una sola vez, sino que se avanzó por etapas, estableciendo en cada una de ellas un sistema de doble verificación por parte de terceros. Respecto a las partes que carecían de restricciones de clave externa, se identificaron exhaustivamente las relaciones entre los datos y se visibilizó su coherencia antes de reflejarla en las tareas de migración.

- Origen de la migración: Múltiples bases de datos de SQL Server + FileMaker (aprox. 25 años de datos, 225 tablas, aprox. 4,5 millones de filas, aprox. 11.000 personas)
- Destino de la migración: Google Cloud (Cloud SQL / PostgreSQL + Cloud Run)
- Medidas destacadas: Clasificación entre hechos e hipótesis, rediseño del esquema compatible con nombres multinacionales, doble verificación por terceros

## Resultados

La migración por etapas se ha completado hasta la fase 2 (migración de la base de datos de producción). Al abordar el diseño tras separar los hechos de las hipótesis, se logró hacer visible la coherencia que antes dependía del conocimiento tácito, reduciendo la inquietud de los responsables de operaciones sobre si los datos eran realmente correctos. Respetando el trabajo acumulado durante 25 años, la iniciativa para realizar la transición hacia una infraestructura que pueda utilizarse con tranquilidad durante los próximos 25 años continúa en marcha actualmente.
