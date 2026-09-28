---
title: "Migración a la nube de un sistema central heredado — ordenar 25 años de datos para poder heredarlos"
description: "Proyecto de migración progresiva a la nube de la base de datos central de una institución educativa, operada durante unos 25 años, separando los hechos confirmados de las hipótesis por verificar."
category: "ai-contract"
tags: ["migración a la nube", "sistema central", "PostgreSQL", "migración de datos"]
publishedAt: 2026-07-02
summary: "Estamos migrando a la nube la base de datos central de una institución educativa, operada durante unos 25 años, empezando por un análisis que separa hechos de hipótesis y avanzando por fases."
securityNote: "Este proyecto está sujeto a un NDA, por lo que publicamos de forma abstracta la información que podría identificar al cliente o al sistema."
isDraft: false
featured: false
lang: "es"
translationSourceHash: "37960edd140adde429710164d510afa265da98478bd7fcb0f13018c5be949384"
translatedAt: "2026-09-28T06:09:16.043Z"
translationModel: "adopted-legacy"
---

## Desafío

En esta institución educativa había unos 25 años de datos —225 tablas, unos 4,5 millones de filas y unas 11.000 personas— repartidos entre varias bases de datos de SQL Server operadas durante años y FileMaker. No había claves foráneas definidas, de modo que la coherencia entre los datos se sostenía por la operativa del lado de la aplicación. Consideramos que limitarse a trasladar tal cual estos rasgos tan típicos de un sistema heredado suponía el riesgo de perder 25 años de conocimiento tácito y de generar confusión en el día a día.

## Enfoque

En lugar de mover los datos de inmediato, empezamos por analizar la base de datos existente. Lo que más cuidamos aquí fue separar los «hechos confirmados» de las «hipótesis que hay que verificar». Pusimos en palabras las relaciones entre tablas y el significado de los datos contrastándolos no solo con la documentación, sino también con el trabajo real sobre el terreno, para no arrastrar hipótesis sin verificar hasta el diseño. Como destino elegimos Google Cloud (Cloud SQL / PostgreSQL + Cloud Run) y optamos por un rediseño ajustado a la operativa actual, no por una simple réplica.

## Implementación

A partir de la estructura que reveló el análisis, rediseñamos el esquema para que admitiera nombres de personas de distintas nacionalidades. La migración no se hizo de una sola vez: adoptamos un método por fases, con un esquema de doble verificación por parte de un tercero en cada etapa. También en las partes que carecían de claves foráneas identificamos exhaustivamente las relaciones entre datos y las reflejamos en la migración solo después de hacer visible su coherencia.

- Origen: varias bases de datos de SQL Server + FileMaker (unos 25 años, 225 tablas, unos 4,5 millones de filas y unas 11.000 personas)
- Destino: Google Cloud (Cloud SQL / PostgreSQL + Cloud Run)
- Puntos clave: separación entre hechos e hipótesis, rediseño del esquema para nombres multinacionales, doble verificación por un tercero

## Resultados

La migración por fases está completada hasta la segunda fase (migración de la base de datos de producción). Haber separado hechos e hipótesis antes de entrar en el diseño hizo visible una coherencia que hasta entonces dependía del conocimiento tácito, y permitió reducir la inquietud del equipo de operaciones ante la pregunta de si esos datos eran realmente correctos. El trabajo de respetar 25 años de acumulación y, al mismo tiempo, heredarlos hacia una plataforma que se pueda usar con tranquilidad los próximos 25 continúa hoy.
