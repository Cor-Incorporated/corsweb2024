---
title: "Grift: el currículum se puede inflar, las pruebas no. El software de código abierto (OSS) que extrae hechos verificables a partir del historial de git"
description: "Grift es un producto propio que extrae hechos verificables (valores de inspección) a partir del historial de git de los ingenieros, en lugar de asignar puntuaciones. Presentamos el trasfondo y el diseño detrás del cambio de rumbo: de una aplicación web para la estimación de presupuestos a una herramienta CLI de código abierto (OSS) y soporte de recomendación para agencias de contratación y empresas de SES."
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "Contratación de personal", "SES"]
publishedAt: 2026-06-30
updatedAt: 2026-10-20
summary: "Grift es un producto propio que extrae «hechos verificables» a partir del historial de git de los ingenieros. Al no asignar puntuaciones ni clasificaciones y no utilizar IA (LLM) para la medición, cualquier persona que lo ejecute obtiene el mismo resultado, permitiendo que quien lo reciba pueda verificarlo. La herramienta CLI se publica como software de código abierto (OSS) bajo la licencia MIT."
isDraft: false
featured: true
lang: "es"
translationSourceHash: "7f22d1e3435c1051e9b79ad280087a0dc968c2c0e947a92dd6d02a6f8e92f399"
translatedAt: "2026-10-20T01:56:45.742Z"
translationModel: "gemini-3.8-flash"
---

<!--
執筆ガイドライン（terisuke向け）:
本文は以下の4見出しで構成してください。各 ## はそのまま記事内に表示されます。
  ## 課題      — 顧客が抱えていた問題・背景
  ## アプローチ — どう考え、どんな方針で臨んだか
  ## 実装      — 実際に作ったもの・技術的なポイント
  ## 成果      — 結果・効果（数値があれば具体的に。NDA案件は抽象化し securityNote を設定）
NDA・機密案件では具体名や数値をぼかし、frontmatter の securityNote を有効化してください。
2026-10-20: 見積支援Webアプリ時代の本文を、CLI への方針転換後の内容に書き換えた（ADR-0022）。
-->

## El desafío

Los comerciales de las agencias de contratación y de empresas de SES necesitan explicar «por qué recomiendan a esta persona» al presentar un candidato a una empresa. Sin embargo, el material del que disponen se reduce casi siempre al currículum y a las impresiones de la entrevista. Aunque ponga «5 años de Java», no se llega a transmitir el contenido real del trabajo: qué tipo de cambios realizaba ni cómo los verificaba durante el proceso.

Por otra parte, la «cantidad de actividad», como las contribuciones en GitHub o el número de commits, se infla hoy fácilmente con IA generativa o agentes. Un volumen alto ya casi no sirve como base para una recomendación. Y si se sintetiza todo en una única puntuación, desaparece la información sobre qué se midió, en qué periodo y con qué muestra base, convirtiéndose en una mera herramienta de descarte. Faltaba «material verificable», tanto para quien recomienda como para quien es recomendado.

## El enfoque

Grift nació en febrero de 2026 como una aplicación web para respaldar las estimaciones en proyectos de desarrollo por encargo. Al buscar fundamentos sólidos para dichas estimaciones, advertimos que el material más fidedigno era el propio historial de Git acumulado por los desarrolladores; así, en agosto de 2026, aislamos la parte de medición en una herramienta de línea de comandos. En septiembre suspendimos la oferta de la antigua aplicación web y reorientamos el rumbo hacia el apoyo a la fuerza comercial de agencias de contratación y empresas de SES.

En el diseño establecimos tres compromisos previos:

- **No convertirlo en una puntuación** — Ofrecer valores de inspección y dejar el juicio a las personas. No emitir puntuaciones compuestas, clasificaciones, aptos/no aptos ni grados; y adjuntar siempre numerador y denominador a los valores numéricos.
- **Mismo resultado en cada ocasión** — No utilizar IA (LLM) en la medición. Con el mismo repositorio y la misma versión, cualquiera que lo ejecute obtendrá los mismos números.
- **No enviarlo a ningún sitio** — Se ejecuta únicamente en el PC local. La propia persona decide si lo comparte y qué repositorios muestra.

Asimismo, establecimos un código de uso de siete normas («no interpretar la ausencia como algo negativo», «no descartar únicamente por cifras», «no medir a terceros sin su consentimiento», etc.) y acordamos no denominar bajo el nombre de la metodología (TEP: Technical Evidence Pipeline) a los usos que no las respeten.

## Implementación

Grift CLI extrae observaciones como las siguientes a partir únicamente del historial de Git:

- **Diferenciación de autoría**: clasifica de quién es el trabajo en 11 categorías, como commits propios de la persona, trabajo de terceros, bots, artefactos generados o de proveedores, o historiales heredados de bifurcaciones (forks).
- **Tasa de acompañamiento de pruebas**: porcentaje en el que, dentro del mismo commit de cambios en el código de producción, también se modifican las pruebas.
- **Tasa de retroceso y reelaboración**: proporción de revisiones o reintervenciones sobre archivos tocados recientemente (es un registro de tendencias; no se emplea para determinar aptitud).
- **Contexto del repositorio**: días de trabajo efectivo, número de personas implicadas, cuota de autoría del creador mayoritario, porcentaje a través de revisiones de código, etc.

Cuando la muestra base es inferior a 20, no se calcula el porcentaje y solo se indica la cantidad; y aquello que no pudo observarse se muestra motivado como «no observado», en lugar de «sin historial». `grift verify` recalcula los informes guardados bajo las mismas condiciones y devuelve coincidencia, discrepancia o imposibilidad de verificación, lo que permite al receptor comprobar posibles alteraciones o incoherencias.

- Repositorio: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- Distribución: PyPI «grift-cli» (`pipx install grift-cli`, Python 3.11 o superior)
- Licencia: MIT

## Resultados

El 8 de septiembre de 2026 publicamos la v0.7.2 en PyPI. Hemos verificado los indicadores en 117 repositorios públicos y publicado en GitHub tanto las comparaciones en las que se pudo diferenciar como aquellas en las que todavía no ha sido posible (se trata de mediciones internas, sin auditoría de terceros).

Actualmente avanzamos en los preparativos de pruebas de concepto (PoC) con agencias de colocación y empresas de SES para concretar los motivos de recomendación a partir de los registros ejecutados en local por los propios candidatos. Tomando como base los resultados de estas pruebas, el objetivo es iniciar la oferta de la versión oficial en 2027. También presentamos información sobre Grift en [griftai.org](https://griftai.org).
