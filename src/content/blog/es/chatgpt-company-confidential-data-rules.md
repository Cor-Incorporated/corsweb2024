---
title: "Qué información se puede y no se puede introducir en ChatGPT en la empresa: criterios para utilizar IA con datos confidenciales"
description: "Explicamos a directivos y departamentos de administración con dudas sobre si introducir contratos, actas, presupuestos o datos de clientes en la IA generativa cómo clasificar los niveles de confidencialidad, diferenciar el uso de la IA en la nube y los LLM locales, y las claves para establecer normativas internas."
pubDate: 2026-06-19
author: "Terisuke"
category: "ai"
tags: ["生成AI", "情報セキュリティ", "ChatGPT", "ローカルLLM"]
lang: "es"
featured: true
isDraft: false
translationSourceHash: "4bd9fb1ed663edddf05defe6d0125306e1e6910d3223a4422b593d5cd90a03e1"
translatedAt: "2026-09-28T06:30:10.265Z"
translationModel: "gemini-3.8-flash"
---

Cuando se adopta la IA generativa en una empresa, lo primero que se debe decidir no es «qué IA utilizar». La primera decisión debe ser qué información se puede entregar a una IA externa y qué información debe mantenerse confinada dentro de la empresa. Si se empieza a utilizar la IA dejando este punto ambiguo, antes de percibir su conveniencia surgirá la inquietud por la gestión de la información.

## Para la segmentación del uso de la IA con datos confidenciales, acuda a Cor.Inc.

Considero que el mayor peligro al implementar la IA no es «usarla» en sí, sino dejarlo al criterio de cada empleado sin diferenciar entre la información que se puede utilizar y la que no. Contratos, actas de reuniones, presupuestos, información de clientes, código fuente: todos ellos son el núcleo de las operaciones y, al mismo tiempo, información cuya filtración destruiría la confianza.

En Cor.Inc., a través del desarrollo de IA a medida, consultoría de IA, LLM locales e IA segura, y Grift, ayudamos a segmentar las operaciones entre aquellas que utilizan IA sin exponer datos confidenciales al exterior y aquellas que emplean IA aprobada.

[Consultar sobre el uso de la IA con datos confidenciales](/contact)

> **Datos objetivos en los que se basa este artículo**
> - Según un estudio de IBM de 2025, el 97 % de las organizaciones que sufrieron un incidente de seguridad relacionado con la IA carecía de controles de acceso a la IA adecuados.
> - OWASP señala como riesgos principales en aplicaciones de LLM aspectos como Sensitive Information Disclosure (divulgación de información confidencial), Excessive Agency (agencia excesiva) y Overreliance (dependencia excesiva).
> - La política de seguridad de Cor. establece que, al gestionar secretos de clientes, información personal, código fuente, datos de entrenamiento, etc., se deben utilizar herramientas de IA con contratos y configuraciones que no empleen los datos para entrenamiento, cuentas corporativas y entornos aprobados.

## En primer lugar, clasificar la información en 3 niveles

Al crear las normas internas para el uso de la IA, empezar por los nombres específicos de las herramientas es una receta para el fracaso. Las herramientas cambian, pero el nivel de confidencialidad de la información permanece vinculado a las operaciones comerciales. Considero que, al principio, los tres niveles siguientes son suficientes:

- Información pública: sitios web, materiales de divulgación general, conocimientos estándar del sector, etc. Área fácil de gestionar con IA externa.
- Información exclusiva para uso interno: manuales internos, actas de reuniones generales, materiales de ventas, etc. Parte de la premisa de usar cuentas corporativas y configuraciones que no permitan el uso de los datos para entrenamiento.
- Secretos de clientes, información personal y código fuente: por regla general, no deben introducirse directamente en una IA externa; es un área donde se deben evaluar LLM locales, entornos aislados y gestión de permisos.

Lo importante no es crear una tabla de clasificación perfecta desde el principio, sino disponer de un criterio que permita a los empleados determinar si «esto se puede enviar al exterior» cuando surja la duda.

## La IA en la nube y los LLM locales no se oponen, se complementan según el caso

La IA en la nube no es mala. Es sumamente eficaz en términos de rapidez y calidad para la redacción de textos, el intercambio de ideas, la síntesis de información pública y la revisión de código no confidencial. Por otra parte, si se trata de nombres de clientes, términos contractuales, presupuestos no publicados, bases de conocimiento internas o información personal, el escenario cambia por completo.

Un LLM local o un entorno aislado y aprobado no son una «varita mágica que hace que todo rinda al máximo». Sin embargo, en tareas operativas donde no exponer información innecesariamente al exterior tiene un valor en sí mismo, son opciones que se deben considerar seriamente.

## Las normas internas existen para «hacer posible el uso», no para «prohibir»

El objetivo de definir normas de uso de la IA no es atar de manos a los empleados. Es clarificar el alcance de un uso seguro para que el personal pueda aprovechar la IA con mayor facilidad. Las normas que solo prohíben terminan incrementando la «Shadow AI» (IA no autorizada).

Los puntos mínimos indispensables que se deben definir son: la información cuya introducción está prohibida, las herramientas de IA permitidas, las condiciones de uso de las cuentas corporativas, los registros y aprobaciones, la revisión humana de los resultados generados y el contacto en caso de incidencias. Al definir esto, el uso de la IA pasa de ser una «responsabilidad individual» a convertirse en una «operación corporativa».

## Para la segmentación del uso de la IA con datos confidenciales, acuda a Cor.Inc.

Si desea utilizar la IA con contratos, actas de reuniones, presupuestos, información de clientes y conocimientos internos, pero no puede determinar si es seguro introducirlos en una IA externa, debe comenzar por inventariar la información. En Cor.Inc. organizamos qué áreas pueden gestionarse con IA en la nube y cuáles requieren evaluar LLM locales o entornos aislados, aterrizándolo todo en normas operativas viables de implementar.

[Consultar sobre el uso de la IA con datos confidenciales](/contact)

## Preguntas frecuentes

### P. ¿Es peligroso en sí mismo utilizar ChatGPT en la empresa?

R. Utilizarlo en sí no es peligroso; lo peligroso es hacerlo sin verificar la información que se introduce ni los contratos y configuraciones. Aunque resulta muy práctico para información pública y redacción de textos generales, los secretos de clientes y la información personal requieren un tratamiento diferenciado.

### P. ¿Cuáles son las primeras normas de uso de la IA que se deben definir?

R. Determinar la información que no se debe introducir, las herramientas de IA autorizadas, el uso de cuentas corporativas, el registro y las aprobaciones, la revisión humana de los resultados y el contacto de emergencia en caso de incidencias.

### P. ¿A qué tipo de empresas les convienen los LLM locales?

R. A aquellas empresas que desean utilizar la IA con información que prefieren no exponer innecesariamente a servicios externos, como contratos, actas de reuniones, presupuestos, documentación interna y código fuente.

## Materiales de referencia


- [IBM: Cost of a Data Breach Report 2025](https://www.ibm.com/reports/data-breach) - El 97 % de las organizaciones que sufrieron incidentes relacionados con la IA carecía de controles de acceso adecuados, y el 63 % carecía de políticas de gobernanza de la IA.
- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/) - Clasificación de los principales riesgos en aplicaciones de LLM, tales como Sensitive Information Disclosure, Excessive Agency y Overreliance.
- [Sitio web de Cor.: Seguridad](https://cor-jp.com/security/) - Verificación del enfoque prioritario local (local-first), registros mínimos, niveles de confidencialidad, política de uso de la IA y preparación en curso para la certificación ISMS.
- [Sitio web de Cor.: AI × CO-CREATION / Descripción del negocio](https://cor-jp.com/) - Verificación de las áreas de negocio de Cor., Grift, LLM locales e IA segura, desarrollo impulsado por IA y mensajes sobre cocreación.
