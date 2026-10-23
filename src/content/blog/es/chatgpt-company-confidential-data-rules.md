---
title: "Qué información se puede introducir en ChatGPT en la empresa y cuál no: criterios para usar datos confidenciales con IA"
description: "Para directivos y departamentos de administración que dudan sobre si ingresar contratos, actas de reuniones, presupuestos o datos de clientes en la IA generativa, explicamos cómo clasificar la confidencialidad, diferenciar el uso de la IA en la nube frente a LLM locales y los puntos clave para definir normativas internas."
summary: "Al utilizar IA generativa en la empresa, lo primero que debe decidirse no es qué IA utilizar, sino qué información está permitido entregar a una IA externa. Si clasifica la información en 3 niveles y define mediante normas internas los datos de entrada prohibidos y las herramientas de IA permitidas, podrá transformar el uso de la IA de una «responsabilidad individual» a una «operación corporativa»."
pubDate: 2026-06-19
updatedDate: 2026-10-23
author: "Terisuke"
category: "ai"
tags: ["生成AI", "情報セキュリティ", "ChatGPT", "ローカルLLM"]
lang: "es"
featured: true
isDraft: false
translationSourceHash: "2a15c033801a1941e40c576c33fc31e0355648066d1c20d0272c8bc89c9a6b87"
translatedAt: "2026-10-23T06:24:34.604Z"
translationModel: "gemini-3.8-flash"
---

A la hora de utilizar IA generativa en una empresa, lo primero que se debe decidir no es «qué IA utilizar», sino qué información se puede transferir a una IA externa y qué información debe permanecer estrictamente dentro de la empresa. Si se comienza a utilizar sin aclarar este punto, la inquietud sobre la gestión de la información surgirá antes de que se puedan percibir sus ventajas.

En Cor.Inc., consideramos que el mayor peligro en la adopción de la IA no es «utilizarla» en sí, sino dejar la decisión en manos del personal operativo sin delimitar la información permitida de la que no lo está. Los contratos, las actas de reuniones, las cotizaciones, la información de clientes y el código fuente constituyen el núcleo del negocio y, al mismo tiempo, son datos cuya filtración destruiría la confianza depositada en la empresa.

> **Datos objetivos en los que se fundamenta este artículo**
> - Según un estudio de 2025 de IBM, el 97% de las organizaciones que sufrieron incidentes de seguridad relacionados con la IA carecían de controles de acceso a la IA adecuados.
> - OWASP señala como principales riesgos en aplicaciones LLM la divulgación de información confidencial (Sensitive Information Disclosure), la agencia excesiva (Excessive Agency) y la dependencia excesiva (Overreliance), entre otros.
> - En la política de seguridad de Cor., al manejar información confidencial de clientes, datos personales, código fuente, datos de entrenamiento, etc., se establece el uso de herramientas de IA con contratos o configuraciones que garanticen que los datos no se utilicen para entrenamiento, cuentas corporativas y entornos aprobados.

## Clasificar primero la información en 3 niveles

Al definir las normas internas sobre la IA, comenzar por nombres específicos de herramientas conduce al fracaso. Las herramientas cambian, pero la confidencialidad de la información perdura vinculada a la actividad empresarial. En Cor.Inc., consideramos que, en un principio, basta con los siguientes 3 niveles:

- Información pública: sitios web, materiales públicos, conocimientos generales del sector, etc. Es un ámbito fácil de tratar con IA externa.
- Información de uso interno: manuales internos, actas de reuniones ordinarias, materiales comerciales, etc. Requiere el uso de cuentas corporativas y configuraciones que no permitan el uso de datos para entrenamiento.
- Información confidencial de clientes, datos personales y código fuente: por regla general, no debe introducirse directamente en IA externas; es un ámbito en el que se deben considerar LLM locales, entornos aislados y gestión de permisos.

Lo importante no es elaborar una tabla de clasificación perfecta desde el principio, sino disponer de criterios claros para que el personal operativo, ante cualquier duda, pueda determinar: «¿se puede transferir esto al exterior?».

## Uso diferenciado de la IA en la nube y los LLM locales

La IA en la nube no es intrínsecamente negativa. Resulta muy eficaz en términos de velocidad y calidad para la redacción de textos, el contraste de ideas, la organización de información pública o la revisión de código que no sea confidencial. Sin embargo, el panorama cambia por completo si se manejan nombres de clientes, condiciones contractuales, cotizaciones no publicadas, bases de conocimiento internas o datos personales.

Los LLM locales y los entornos aislados autorizados no son «magia que maximiza el rendimiento en cualquier situación». No obstante, en tareas operativas donde evitar la salida innecesaria de información aporta un valor en sí mismo, constituyen una opción que se debe considerar seriamente.

## Normas internas para crear un «entorno operativo viable»

El propósito de establecer normas de uso de la IA no es limitar a los empleados, sino facilitar su adopción en los equipos operativos aclarando el marco en el que pueden utilizarla de forma segura. Las normas basadas exclusivamente en prohibiciones no hacen más que incrementar la proliferación del Shadow AI.

Los aspectos mínimos indispensables que se deben definir son: la información cuya introducción está prohibida, las herramientas de IA permitidas, las condiciones de uso de cuentas corporativas, el registro y la aprobación, la revisión humana de los resultados y los contactos de emergencia ante incidentes. Al definir estos puntos, el uso de la IA pasa de ser una «responsabilidad individual» a convertirse en una «operación corporativa».

Si desea gestionar contratos, actas, cotizaciones, información de clientes o conocimiento interno mediante IA, pero no tiene certeza sobre si es seguro introducirlos en una IA externa, le recomendamos comenzar por un inventario de la información. En Cor.Inc., estructuramos qué áreas son adecuadas para IA en la nube y cuáles requieren considerar LLM locales o entornos aislados, formulando además normativas operativas viables para su implementación.

## Preguntas frecuentes

### P. ¿Es peligroso en sí mismo utilizar ChatGPT en la empresa?

R. Utilizarlo no es peligroso en sí mismo; lo peligroso es hacerlo sin verificar la información que se introduce, así como los contratos y la configuración. Si bien resulta muy práctico para información pública y redacción de textos generales, la información confidencial de clientes y los datos personales requieren un tratamiento diferente.

### P. ¿Cuáles son las primeras normas de uso de la IA que se deben establecer?

R. Definir la información no permitida, las herramientas de IA que se pueden utilizar, el uso de cuentas corporativas, el registro y las autorizaciones, la revisión humana de los resultados y los contactos de notificación en caso de incidentes.

### P. ¿Para qué tipo de empresas son adecuados los LLM locales?

R. Son idóneos para aquellas empresas que desean utilizar IA con contratos, actas, presupuestos, documentación interna, código fuente y otra información que no deba exponerse innecesariamente a servicios externos.

## Documentos de referencia

- [IBM: Cost of a Data Breach Report 2025](https://www.ibm.com/reports/data-breach): El 97% de las organizaciones con incidentes relacionados con la IA carecían de controles de acceso adecuados; el 63% carecía de políticas de gobernanza de la IA.
- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/): Sistematización de los principales riesgos en aplicaciones LLM, tales como Sensitive Information Disclosure, Excessive Agency y Overreliance.
- [Sitio web de Cor.: Seguridad](https://cor-jp.com/security/): Enfoque prioritario en local (local-first), registros mínimos, niveles de confidencialidad, políticas de uso de IA e ISMS (con la finalización de la fase 2 de auditoría prevista para octubre de 2026 y la obtención del registro de certificación estimada hacia diciembre de 2026).
- [Sitio web de Cor.: AI × CO-CREATION / Descripción del negocio](https://cor-jp.com/): Información sobre las áreas de negocio de Cor., Grift, LLM locales e IA segura, desarrollo impulsado por IA y mensajes de cocreación.
