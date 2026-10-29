---
title: "Cómo cambió la actividad en GitHub al desarrollar con IA: unos 20–40 al mes en la segunda mitad de 2024, unos 300 en mayo de 2025"
description: "Las contribuciones de GitHub fueron unos 20–40 al mes en la segunda mitad de 2024 y unos 300 en mayo de 2025. Es el total estándar de GitHub, que incluye issues, pull requests y revisiones, según el gráfico publicado el 30 de mayo de 2025. No es una tasa de velocidad de desarrollo ni de volumen entregado."
summary: "Las contribuciones de GitHub (el total estándar, con issues, pull requests y revisiones) fueron unos 20–40 al mes en la segunda mitad de 2024 y unos 300 en mayo de 2025. El «7x» de la primera versión fue un redondeo que situaba el periodo anterior al uso de IA en unos 50 al mes. La calidad, el retrabajo y el tiempo de trabajo no se compararon en las mismas condiciones."
pubDate: 2024-01-15
updatedDate: 2026-10-29
author: "Terisuke"
category: "ai"
ctaIntent: "contract-dev"
tags: ["AI", "コントリビュート", "Cursor", "CodeRabbit", "GitHub Copilot"]
lang: "es"
featured: true
translationSourceHash: "955397d96732625a2361532f533d4934ab6c77e0cc2b5d2853afae8f1f9b3d47"
translatedAt: "2026-10-29T05:20:00.000Z"
translationModel: "manual-i18n-sync"
---

Las contribuciones de GitHub (el total estándar, que incluye issues, pull requests y revisiones) fueron unos 20–40 al mes en la segunda mitad de 2024. En mayo de 2025 fueron unos 300 (según el gráfico publicado el 30 de mayo de 2025).

El «7x» de la primera versión fue un redondeo que situaba el periodo anterior al uso de IA en unos 50 al mes.

Esta cifra no muestra que la velocidad de desarrollo o el volumen entregado se multiplicaran.

Este artículo recuerda qué tareas se encomendaron entonces a la IA y qué resultó más fácil de avanzar. La calidad, el retrabajo y el tiempo real de trabajo no se compararon en las mismas condiciones. No se afirman esas tasas de mejora.

Lo que se compara es el recuento mensual de la segunda mitad de 2024 y el recuento de mayo de 2025. Si se incluyen los recuentos de repositorios privados no se sabe por la información pública. No se creó un denominador ni un indicador de calidad nuevo para ajustar las cifras antiguas.

## Cómo se repartía el trabajo entonces

### Escribir código

El código lo escribía Claude Code. Primero se preparaba un pliego de instrucciones en conversación con Claude Desktop y luego se pasaba a Claude Code en el terminal. En unos minutos había código que formaba un esqueleto básico. Después se acumulaban instrucciones concretas, como «añade un método a esta clase y escribe una prueba unitaria».

### Revisión

Al abrir un pull request, CodeRabbit iniciaba la revisión y comentaba en el pull request posibles fallos, notas de seguridad y diferencias respecto a las convenciones. Los puntos señalados se corregían con la función Agent de Cursor. Eso no significa que los comentarios lo encuentren todo.

## Qué se contó

Lo que se contó es el número de contribuciones de GitHub. En la segunda mitad de 2024 fueron unos 20–40 al mes. En mayo de 2025, unos 300. Ambos están en el alcance del gráfico publicado el 30 de mayo de 2025.

Una contribución no es un recuento de commits. En la definición de GitHub, además de los commits entran issues, pull requests y revisiones.

## Herramientas que se usaban

- Cursor: un editor con IA integrada. Los puntos señalados se corregían con la función Agent
- Claude Desktop: preparar instrucciones en conversación
- Claude Code: escribir código a partir de las instrucciones
- CodeRabbit: revisión automática de pull requests

La sensación de entonces se acercaba más a resolver problemas en diálogo con la IA que a escribir código línea a línea. Es una sensación, no una medición del tiempo de trabajo ni del volumen entregado.

## Referencias

El título del artículo de note del 1 de junio de 2025 dice que la velocidad de desarrollo fue 7x. Las cifras de este artículo de la empresa siguen el gráfico del 30 de mayo de 2025. No se tratan como una tasa de velocidad o de volumen entregado.

https://note.com/cor_instrument/n/n800a959f7284

El gráfico mensual de contribuciones está en la publicación del 30 de mayo de 2025.

https://x.com/cor_terisuke/status/1928266812019368121

- [GitHub Docs: Profile contributions](https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference) - descripción oficial de lo que se cuenta como contribución

https://cor-jp.com/

https://github.com
