---
title: "Cómo crear directrices internas para el uso de IA generativa | Gestión de riesgos a partir de informes de OWASP e IBM"
description: "Una guía para directivos y departamentos de administración que buscan elaborar directrices de uso de IA generativa, estructurando información restringida, IA autorizadas, registros, formación y respuesta ante incidentes. Dirigido a empresas que desean compaginar el aprovechamiento de la IA con la seguridad de la información."
summary: "Las directrices internas para el uso de la IA generativa no se crean para impedir su uso, sino para aprovecharla de forma segura. Es fundamental comenzar con 5 puntos clave (herramientas de IA permitidas, información restringida, tareas en las que se autoriza su uso, revisión humana, y registros y notificación) y continuar actualizándolas según la respuesta operativa."
pubDate: 2026-06-17
updatedDate: 2026-10-23
author: "Terisuke"
category: "ai"
tags: ["生成AI", "社内ルール", "セキュリティ", "ガバナンス"]
lang: "es"
featured: true
isDraft: false
translationSourceHash: "7fd67394fcdeb12c96567e8bdf8c1004667438099fd688ec12be2c0ee942ded0"
translatedAt: "2026-10-23T05:23:47.782Z"
translationModel: "gemini-3.8-flash"
---

# Cómo crear directrices internas para el uso de IA generativa | Gestión de riesgos a partir de informes de OWASP e IBM

Las normas sobre IA generativa se crean no para «impedir su uso», sino para «aprovecharla al máximo de forma segura».

Las directrices internas para el uso de IA generativa no funcionan si se limitan a enumerar prohibiciones. Los equipos de trabajo utilizarán aquello que les resulte práctico. Por ello, la empresa debe determinar qué IA se pueden usar, qué información no se debe introducir, qué tareas requieren aprobación y cómo verificar los resultados, creando así un entorno en el que los empleados puedan utilizarlas sin dudas.

En Cor.Inc., consideramos que las empresas que no establecen normas para la IA generativa no son empresas que no utilicen IA, sino empresas donde la IA se utiliza sin visibilidad. Este es el problema conocido como Shadow AI.

> **Datos objetivos en los que se basa este artículo**
> - Según un estudio de IBM de 2025, el 97 % de las organizaciones que reportaron incidentes de seguridad relacionados con IA carecían de controles de acceso a IA adecuados, y el 63 % carecía de políticas de gobernanza de IA.
> - OWASP señala riesgos clave en aplicaciones con LLM, tales como Sensitive Information Disclosure, Excessive Agency y Overreliance, entre otros.
> - El perfil de IA generativa del NIST se ha publicado como material de referencia para incorporar la gestión de riesgos en el diseño, desarrollo, uso y evaluación de la IA.

## Elementos indispensables que deben incluirse en las normas

- Herramientas de IA permitidas: especificar los servicios de IA aprobados por la empresa, así como las cuentas y configuraciones autorizadas.
- Información de introducción prohibida: clasificar datos personales, información confidencial de clientes, condiciones contractuales, código fuente, información financiera no pública, etc.
- Tareas permitidas: indicar en primer lugar las áreas aplicables, como la redacción de textos, resúmenes, generación de ideas y asistencia en búsquedas.
- Revisión humana: determinar quién será el revisor en caso de que los resultados de la IA se utilicen para entregas a clientes, contratos, asuntos legales o decisiones de contratación.
- Registros y reportes: definir los contactos y la respuesta inicial ante la aparición de problemas.

Al definir estos cinco puntos, los equipos de trabajo podrán discernir «hasta dónde se puede usar» en lugar de asumir que «todo está prohibido».

## Normas basadas solo en prohibiciones y la Shadow AI

Los empleados no recurren a la IA para eludir responsabilidades, sino porque la carga de trabajo diaria (actas de reuniones, correos electrónicos, elaboración de presentaciones, investigación, revisión de código, etc.) es pesada. Si en ese contexto solo se impone una «prohibición», habrá quienes la utilicen a través de sus cuentas personales.

Por eso, las normas deben crearse con el propósito de incrementar la productividad operativa. Lo fundamental es preparar una vía autorizada mediante el acondicionamiento de cuentas corporativas, configuraciones que impidan el uso de los datos para entrenamiento, información de introducción prohibida y revisión de resultados.

## Empezar poco a poco y actualizar mediante la práctica

Las normas de IA generativa no se terminan con redactarlas una sola vez. Los modelos, las funciones, las condiciones contractuales y los procesos internos cambian. Aunque sea una vez al mes, es necesario revisar el estado de uso, los incidentes potenciales (*near-misses*), la información prohibida y la actualización de las herramientas de IA aprobadas.

En la adopción de la IA, lo importante no es contar con un reglamento perfecto, sino disponer de una operativa sujeta a mejoras continuas. Solo las empresas que cuentan con un ciclo en el que trasladan las directrices a los equipos operativos y las actualizan según su respuesta pueden seguir utilizando la IA de forma segura. En Cor.Inc. ofrecemos soporte integral, abarcando desde políticas de uso de IA, información de introducción prohibida, IA aprobadas y aprovechamiento de LLM locales, hasta formación para empleados.

## Preguntas frecuentes

### ¿Por dónde se debe empezar a crear las normas de uso de IA generativa?

Lo más realista es comenzar con estos cinco elementos: herramientas de IA permitidas, información de introducción prohibida, tareas permitidas, revisión humana y registros y reportes.

### ¿Se debe prohibir el uso de IA mediante cuentas personales?

Debe evitarse en aquellas tareas que gestionen información confidencial de clientes o datos personales. Es crucial proporcionar cuentas corporativas, configuraciones que impidan el uso de datos para entrenamiento y entornos aprobados.

### ¿Basta con crear las normas para estar seguros?

Las normas por sí solas no son suficientes. Estas cobran sentido y funcionan de forma efectiva únicamente cuando se llevan a la práctica mediante la capacitación, el registro de uso, las aprobaciones, las revisiones periódicas y la respuesta ante incidentes.

## Materiales de referencia

- [IBM: Cost of a Data Breach Report 2025](https://www.ibm.com/reports/data-breach): el 97 % de las organizaciones que sufrieron incidentes relacionados con IA carecían de controles de acceso adecuados, y el 63 % carecía de una política de gobernanza de IA.
- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/): clasificación de los principales riesgos en aplicaciones con LLM, como Sensitive Information Disclosure, Excessive Agency y Overreliance.
- [NIST AI 600-1: Generative AI Profile](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence): perfil para IA generativa del NIST AI RMF 1.0. Referencia para integrar confiabilidad y gestión de riesgos en el diseño, desarrollo, uso y evaluación.
- [Cor. HP: Seguridad](https://cor-jp.com/security/): información sobre el enfoque *local-first*, registro mínimo, niveles de confidencialidad, política de uso de IA e ISMS (se completó la fase 2 de auditoría en octubre de 2026 y se prevé el registro de certificación en torno a diciembre de 2026).
