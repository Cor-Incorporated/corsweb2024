---
title: "Grift — El currículum se puede exagerar. Las pruebas no. OSS para extraer hechos verificables a partir del historial de git"
description: "Grift, un producto propio que extrae hechos verificables (valores de inspección) en lugar de puntuaciones a partir del historial de git de los ingenieros. Presentamos el diseño y el proceso por el cual cambiamos el rumbo desde una aplicación web de apoyo a presupuestos hacia una CLI de código abierto (OSS) y el apoyo a recomendaciones para agencias de contratación y SES."
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "Agencias de contratación", "SES"]
publishedAt: 2026-06-30
updatedAt: 2026-10-20
summary: "Grift es un producto propio que extrae «hechos verificables» del historial de git de los ingenieros. Al no asignar puntuaciones ni clasificaciones y no utilizar IA (LLM) para la medición, cualquier persona que lo ejecute obtiene el mismo resultado y el receptor puede verificar los cálculos. La CLI está disponible públicamente como OSS bajo la licencia MIT."
isDraft: false
featured: true
lang: "es"
translationSourceHash: "50b777323f44c9fba4e13fe092c2a49e5ad8d2299c657eda38c22deedf720613"
translatedAt: "2026-10-20T03:23:50.245Z"
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

Los comerciales de las agencias de contratación y de las empresas de SES (servicios de ingeniería de sistemas) deben explicar «por qué recomiendan a esta persona» al presentar un candidato a una empresa. Sin embargo, el material del que disponen suele limitarse al currículum y a las impresiones de una entrevista. Aunque ponga «5 años con Java», no se llega a apreciar la esencia real de su trabajo: qué tipo de modificaciones ha realizado ni cómo las ha ido verificando.

Por otro lado, el «volumen de actividad», como las contribuciones en GitHub o el número de commits, se ha vuelto fácil de inflar con IA generativa o agentes. La mera abundancia cuantitativa ya difícilmente sirve como base para una recomendación. Al mismo tiempo, resumirlo todo en una única puntuación borra qué se midió, en qué periodo y con qué muestra base, convirtiéndose en una mera herramienta de criba. Faltaba «material contrastable», tanto para quienes recomiendan como para quienes son recomendados.

## Nuestro enfoque

Grift comenzó en febrero de 2026 como una aplicación web concebida para respaldar las estimaciones en proyectos de desarrollo por encargo. Al buscar las bases para esas estimaciones, nos dimos cuenta de que el material más fidedigno era el propio historial de git acumulado por los desarrolladores. En agosto de 2026, aislamos la parte de medición en una herramienta de línea de comandos. En septiembre dejamos de ofrecer la antigua aplicación web y reorientamos el rumbo para dar soporte a los comerciales de agencias de contratación y SES.

En el diseño, establecimos tres compromisos previos:

- **No convertir en puntuación**: lo que se ofrece son valores de inspección; el juicio corresponde a las personas. No generamos puntuaciones compuestas, rankings, aprobados/suspensos ni niveles de clasificación, y las cifras siempre van acompañadas de su numerador y denominador.
- **Mismos resultados en cada ejecución**: no usamos IA (LLM) para la medición. Con el mismo repositorio y la misma versión, cualquier persona que lo ejecute obtendrá exactamente los mismos valores numéricos.
- **No se envía a ninguna parte**: funciona exclusivamente en el ordenador local. La propia persona decide si desea compartir los resultados y qué repositorios mostrar.

Asimismo, definimos una norma de uso de siete principios —que incluye «no interpretar las ausencias de forma negativa», «no hacer cribas basándose únicamente en números» o «no medir a terceros sin su consentimiento»—, y establecimos que los usos que no la respeten no podrán denominarse con el nombre de la metodología (TEP: Technical Evidence Pipeline).

## Implementación

Grift CLI extrae observaciones como las siguientes a partir únicamente del historial de git:

- **Distinción de autoría**: clasifica de quién es el trabajo en 11 categorías, entre ellas commits propios del autor, trabajo de otros, bots, artefactos generados o de terceros (vendors) e historiales heredados de bifurcaciones (forks).
- **Tasa de desarrollo conjunto de pruebas**: porcentaje de commits en los que se modifican pruebas al mismo tiempo que el código de producción.
- **Tasa de retrabajo y retoque**: proporción de revisiones o modificaciones repetidas sobre archivos tocados recientemente (es un registro de tendencias, no se utiliza para determinar aptitud).
- **Contexto del repositorio**: días de trabajo efectivo, número de personas implicadas y cuota del autor principal, proporción de cambios integrados mediante revisión de código, entre otros.

Cuando la muestra base es inferior a 20, no se muestran porcentajes sino únicamente el número de casos. Aquello que no pudo observarse no se marca como «sin historial», sino como «no observado», indicando el motivo. `grift verify` recalcula el informe guardado bajo las mismas condiciones y devuelve coincidencia, discrepancia o no verificable, lo que permite al receptor comprobar si ha habido alteraciones o inconsistencias.

- Repositorio: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- Distribución: PyPI «grift-cli» (`pipx install grift-cli`, Python 3.11 o superior)
- Licencia: MIT

## Resultados

El 8 de septiembre de 2026 publicamos la versión v0.7.2 en PyPI. Las métricas se han validado con 117 repositorios públicos, y hemos publicado en GitHub tanto las comparaciones que permitieron establecer distinciones como las que todavía no lo han logrado (se trata de mediciones internas; no han sido auditadas por terceros).

Actualmente estamos preparando pruebas de concepto (PoC) con agencias de contratación y empresas de SES para fundamentar los motivos de recomendación a partir de los registros ejecutados localmente por los propios candidatos. Tomando como base los resultados de estas pruebas de concepto, nuestro objetivo es lanzar la versión oficial en 2027. También presentamos Grift en [griftai.org](https://griftai.org).

Asimismo, explicamos la filosofía detrás de Grift en sendos artículos en [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) y [note](https://note.com/cor_instrument/n/nd58ba0955317).
