---
title: "Grift: el currículum se puede exagerar; las pruebas, no. Software de código abierto (OSS) que extrae hechos verificables del historial de git"
description: "Grift es un producto propio que extrae hechos verificables (valores de inspección) del historial de git de los ingenieros, en lugar de asignar puntuaciones. Presentamos los antecedentes del cambio de rumbo —desde una aplicación web de apoyo a estimaciones hacia una CLI de código abierto (OSS) y el respaldo a recomendaciones para agencias de empleo y empresas de SES— y su diseño."
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "Selección de personal", "SES"]
publishedAt: 2026-06-30
updatedAt: 2026-10-23
summary: "Grift es un producto propio que extrae «hechos verificables» del historial de git de los ingenieros. No asigna puntuaciones ni clasificaciones. Al no utilizar IA (LLM) para la medición, produce el mismo resultado independientemente de quién lo ejecute, permitiendo que quien lo reciba pueda verificar los cálculos. La CLI está disponible como OSS bajo la licencia MIT."
isDraft: false
featured: true
lang: "es"
translationSourceHash: "534f5ca8a2ffcb8af979ccb72616c1a1a884f89720a7703d659b09456c5ca795"
translatedAt: "2026-10-23T06:30:48.755Z"
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

Las agencias de contratación y los comerciales de SES (servicios de ingeniería de sistemas) deben explicar «por qué recomiendan a esta persona» al presentar candidatos a las empresas. Sin embargo, los únicos materiales de los que disponen son, en su mayoría, el currículum y las impresiones de la entrevista. Aunque ponga «5 años de experiencia en Java», eso no transmite el contenido real del trabajo: qué tipo de cambios implementó ni cómo los fue verificando.

Por otro lado, el «volumen de actividad», como las contribuciones o el número de commits en GitHub, ahora se puede inflar con facilidad mediante IA generativa y agentes. La mera cantidad ya casi no sirve como fundamento para una recomendación. No obstante, si se sintetiza todo en una única puntuación, desaparece la información sobre qué se midió, en qué período y sobre qué muestra base, lo que termina utilizándose como una simple herramienta de descarte. Faltaban «materiales verificables», tanto para quienes recomiendan como para quienes son recomendados.

## Nuestro enfoque

Grift comenzó en febrero de 2026 como una aplicación web concebida para respaldar las estimaciones en proyectos de desarrollo por encargo. Al buscar bases sólidas para dichas estimaciones, nos dimos cuenta de que el material más fidedigno era el propio historial de Git acumulado por los ingenieros. Por ello, en agosto de 2026 separamos la parte de medición para convertirla en una herramienta de línea de comandos. En septiembre dejamos de ofrecer la antigua aplicación web y reorientamos nuestra estrategia para dar soporte a los comerciales de agencias de contratación y empresas de SES.

En el diseño, establecimos tres compromisos previos:

- No convertirlo en una nota: Se proporcionan valores de inspección; las decisiones las toman las personas. No se generan puntuaciones compuestas, clasificaciones, aprobados/suspensos ni niveles; a cada cifra se le asigna siempre su numerador y su denominador.
- El mismo resultado cada vez: No se utiliza IA (LLM) para la medición. Con el mismo repositorio y la misma versión, cualquiera que lo ejecute obtendrá exactamente los mismos valores.
- No se envía a ninguna parte: Funciona únicamente en el ordenador local. La persona interesada decide si comparte los datos y qué repositorios muestra.

Asimismo, establecimos un código de uso de 7 normas (como «no interpretar la ausencia como algo negativo», «no descartar basándose únicamente en cifras» y «no medir a terceros sin su consentimiento»), determinando que cualquier uso que no las respete no podrá denominarse con el nombre de la metodología (TEP: Technical Evidence Pipeline).

## Implementación

Grift CLI extrae observaciones como las siguientes únicamente a partir del historial de Git:

- Distinción de autoría: Clasifica de quién es el trabajo en 11 categorías, entre ellas commits propios de la persona, tareas de terceros, bots, artefactos generados o de proveedores e historiales heredados de bifurcaciones (forks).
- Tasa de modificación conjunta de pruebas: Proporción de commits en los que se modificaron pruebas en el mismo commit que el código de producción.
- Tasa de reelaboración y retoques: Proporción de trabajo rehecho o reexaminado sobre archivos modificados recientemente (se registra como tendencia, no se utiliza para evaluar aprobados/suspensos).
- Contexto del repositorio: Días de trabajo real, número de personas involucradas y porcentaje de autoría del colaborador principal, proporción de cambios revisados, entre otros.

Cuando la muestra base es inferior a 20, no se muestra un porcentaje sino únicamente el número de casos. Aquello que no se haya podido observar se indica como «no observado» con su motivo correspondiente, en lugar de «sin historial». `grift verify` recalcula el informe guardado bajo las mismas condiciones y devuelve coincidencia, discrepancia o imposibilidad de verificación, lo que permite a la parte receptora comprobar posibles alteraciones o inconsistencias.

- Repositorio: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- Distribución: PyPI «grift-cli» (`pipx install grift-cli`, Python 3.11 o superior)
- Licencia: MIT

## Resultados

El 8 de septiembre de 2026 publicamos la versión v0.7.2 en PyPI. Las métricas se validaron en 117 repositorios públicos, y en GitHub compartimos abiertamente tanto las comparaciones que permitieron distinguir resultados como las que aún no lo han logrado (se trata de mediciones internas que no han sido auditadas por terceros).

Actualmente, estamos preparando pruebas piloto (PoC) junto con agencias de empleo y empresas de SES para concretar los motivos de recomendación a partir de los registros que los propios candidatos ejecutan en sus equipos. A partir de los resultados de estas pruebas piloto, nuestro objetivo es comenzar a ofrecer la versión oficial en 2027. Grift también se presenta en [griftai.org](https://griftai.org).

La filosofía de Grift también se explica en nuestros artículos de [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) y [note](https://note.com/cor_instrument/n/nd58ba0955317).
