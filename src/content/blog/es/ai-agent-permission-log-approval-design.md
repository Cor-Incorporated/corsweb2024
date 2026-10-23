---
title: "Permisos, registros y flujos de aprobación que deben definirse antes de implementar agentes de IA"
description: "En 2026, con el avance de la adopción de agentes de IA, explicamos el diseño de permisos, los registros de operaciones y los puntos de aprobación humana que deben definirse antes de integrarlos en las operaciones. Estas son directrices de implementación para no quedarse solo en una PoC."
summary: "Lo que se debe decidir antes de implementar agentes de IA no es cuál agente utilizar, sino hasta dónde delegar. Solo las empresas que dividen los permisos en fases, establecen la aprobación humana para la ejecución y el envío externo, y diseñan con anticipación los registros y las condiciones de parada podrán integrarlos con éxito en sus operaciones."
pubDate: 2026-06-12
updatedDate: 2026-10-23
author: "Terisuke"
category: "ai"
tags: ["AIエージェント", "権限管理", "ガバナンス"]
lang: "es"
featured: false
isDraft: false
translationSourceHash: "5088bc7f3a1f0cc684bc8e0a2c3a1ddcff937480121ed6e95b695fa2c533fcc9"
translatedAt: "2026-10-23T05:23:14.598Z"
translationModel: "gemini-3.8-flash"
---

# Permisos, registros y flujos de aprobación que deben definirse antes de implementar agentes de IA

En 2026, con la creciente adopción de los agentes de IA, explicamos las políticas de implementación necesarias para que no se queden en una simple prueba de concepto (PoC), definiendo el diseño de permisos, los registros de operaciones y los puntos de aprobación humana antes de integrarlos en las operaciones del negocio.

Los agentes de IA son diferentes de la IA que solo devuelve texto. Invocan herramientas externas, planifican múltiples pasos y, en algunos casos, operan sistemas empresariales reales. Por ello, lo que debe decidirse antes de la implementación no es «qué agente utilizar», sino «hasta dónde delegar».

En Cor.Inc. consideramos que el mayor peligro al implementar agentes de IA no es subestimar sus capacidades, sino no diseñar su alcance de responsabilidad. Cuanto más competente es la IA, mayor es también el alcance del impacto cuando comete un error.

> **Datos objetivos en los que se basa este artículo**
>
> - Gartner predice que, para finales de 2026, el 40% de las aplicaciones empresariales incorporarán agentes de IA específicos para tareas.
> - La encuesta de McKinsey de 2025 informa que el 23% de las organizaciones están escalando agentes de IA y el 39% se encuentra en fase de experimentación.
> - Gartner predice que, para finales de 2027, más del 40% de los proyectos de Agentic AI se cancelarán debido al aumento de costes, un valor poco claro y una gestión de riesgos inadecuada.

## Los permisos se definen por lo que «está permitido hacer»

Cuantas más cosas pueda hacer un agente, más útil resulta. Sin embargo, en la operativa empresarial, lo que «está permitido» es más importante que lo que «puede hacer». ¿Está bien que redacte un borrador de correo o se le permite enviarlo? ¿Está bien que prepare una propuesta de presupuesto o debe enviarla al cliente? ¿Está bien que busque en la base de datos interna o puede actualizarla?

Si se implementa sin definir hasta dónde delegar, la responsabilidad se vuelve ambigua: no queda claro si se trató de un error de la IA o de una falta de supervisión humana. Al principio, conviene estructurar por fases como visualización, redacción de borradores, propuestas, ejecución y envíos externos, estableciendo la aprobación humana para la ejecución y los envíos externos.

En la práctica, organizar los permisos por niveles estabiliza las operaciones. Por ejemplo, plantear tres etapas: «solo visualización», «hasta la creación de borradores» y «hasta el envío y la ejecución», haciendo obligatoria la aprobación humana a medida que se asciende de nivel. Compartir de antemano el límite de «se puede delegar libremente si es solo visualización, pero cualquier operación con impacto externo debe pasar necesariamente por una persona» evitará problemas posteriores.

## Registros para la reproducibilidad y la rendición de cuentas

Cuando los agentes de IA se incorporan a las operaciones, es necesario poder explicar a posteriori «por qué se llegó a ese resultado». Si no se registra la información introducida, los datos consultados, las herramientas ejecutadas, las personas que aprobaron y los elementos modificados, no será posible corregir los problemas cuando ocurran.

Facilitará el seguimiento posterior mantener registros que incluyan elementos como el ejecutor (qué agente y bajo las órdenes de quién), los datos objetivo, el contenido de la ejecución, el aprobador, la marca de tiempo y el resultado (éxito o fallo). No se trata de un «registro para culpar a alguien», sino de la base operativa para no repetir el mismo error.

El diseño de registros no existe para vigilar a los empleados, sino para proteger el negocio. La política de seguridad de Cor. también adopta el criterio de no recopilarlo todo, sino limitarse a la telemetría de seguridad relacionada con las operaciones y visibilizarla en la medida necesaria.

## En la primera PoC, defina incluso las «condiciones de parada»

En una PoC de agentes de IA, se deben definir no solo las condiciones de éxito, sino también las de parada. Por ejemplo, se establecen reglas para detener automáticamente el proceso, escalar a una persona y esperar su confirmación cuando la operación parezca extenderse más allá del alcance previsto, cuando el mismo procesamiento falle sucesivamente o cuando se acerque a operaciones definidas previamente como de alto riesgo (envío externo, eliminación de datos, cambios en entornos de producción, etc.). En el momento en que se produzca un comportamiento de este tipo, se detiene y se revisa el diseño.

Definir de antemano las condiciones de parada permite un margen para la intervención humana antes de que la IA se descontrole.

Los agentes de IA no generan resultados automáticamente con solo implementarlos. Solo las empresas que diseñen previamente los permisos, los registros y los flujos de aprobación podrán integrarlos en sus operaciones. En Cor.Inc. brindamos soporte para el diseño de la implementación de IA, incluyendo permisos, registros, aprobaciones, flujos de trabajo y seguridad.

## Preguntas frecuentes

### P. ¿En qué se diferencian los agentes de IA de la IA generativa habitual?

La IA generativa habitual se centra principalmente en generar respuestas. Los agentes de IA se diferencian en que planifican múltiples pasos y avanzan en las tareas coordinándose con herramientas externas y sistemas empresariales.

### P. ¿Qué tareas está bien delegarles en primer lugar?

Debería comenzar por tareas en las que se pueda intercalar la aprobación humana, como la redacción de borradores, la elaboración de resúmenes, la creación de propuestas de opciones o el apoyo en la búsqueda de información interna.

### P. ¿Cuál es el diseño más importante al implementar agentes de IA?

Los permisos, los registros, los flujos de aprobación y las condiciones de parada. En particular, si se les delega el envío externo o la actualización de sistemas empresariales, se debe mantener una confirmación final humana.

## Materiales de referencia

- [Gartner: 40% of Enterprise Apps Will Feature Task-Specific AI Agents by 2026](https://www.gartner.com/en/newsroom/press-releases/2025-08-26-gartner-predicts-40-percent-of-enterprise-apps-will-feature-task-specific-ai-agents-by-2026-up-from-less-than-5-percent-in-2025) - Predicción de que el 40% de las aplicaciones empresariales incorporarán agentes de IA específicos para tareas para finales de 2026.
- [McKinsey: The State of AI: Global Survey 2025](https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai) - El 88% utiliza IA de forma habitual en al menos una función empresarial, aproximadamente un tercio la escala, el 23% escala agentes de IA y el 39% se encuentra en fase de experimentación.
- [Gartner: Over 40% of Agentic AI Projects Will Be Canceled by End of 2027](https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-predicts-over-40-percent-of-agentic-ai-projects-will-be-canceled-by-end-of-2027) - Predicción de que más del 40% de los proyectos de agentes de IA se cancelarán para finales de 2027 debido al aumento de costes, un valor poco claro y una gestión de riesgos inadecuada.
- [Cor. HP: Seguridad](https://cor-jp.com/security/) - Consulte el enfoque local-first, el registro mínimo, los niveles de confidencialidad, la política de uso de IA y la certificación ISMS (se completó la auditoría de fase 2 en octubre de 2026 y se prevé el registro de la certificación hacia diciembre de 2026).
