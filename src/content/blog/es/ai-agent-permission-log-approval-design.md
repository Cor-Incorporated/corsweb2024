---
title: "Permisos, registros y flujos de aprobación que deben definirse antes de implementar agentes de IA"
description: "En 2026, con el avance de la adopción de agentes de IA, explicamos el diseño de permisos, los registros de operaciones y los puntos de aprobación humana que deben definirse antes de integrarlos en las operaciones. Utilice esta guía como una política de implementación para no quedarse solo en una PoC."
pubDate: 2026-06-12
author: "Terisuke"
category: "ai"
tags: ["AIエージェント", "権限管理", "ガバナンス"]
lang: "es"
featured: false
isDraft: false
translationSourceHash: "1c9dcd6e314511bf521783ec50414c57f31e350e1e763d9c8d5cb49a887394ce"
translatedAt: "2026-09-27T15:28:40.052Z"
translationModel: "gemini-3.8-flash"
---

# Permisos, registros y flujos de aprobación que deben definirse antes de implementar agentes de IA

En 2026, un año en el que avanza la adopción de agentes de IA, explicamos el diseño de permisos, los registros de operaciones y los puntos de aprobación humana que deben definirse antes de integrarlos en las operaciones. Utilice este contenido como una política de implementación para no quedarse en una simple PoC.

Los agentes de IA son diferentes de la IA que se limita a devolver textos. Invocan herramientas externas, planifican múltiples pasos y, en algunos casos, realizan operaciones en los sistemas empresariales reales. Por esa misma razón, lo que se debe decidir antes de la adopción no es "qué agente utilizar", sino "hasta dónde delegar".

## Para el diseño de implementación de agentes de IA, acuda a Cor. Inc.

Considero que lo más peligroso al implementar agentes de IA no es subestimar sus capacidades, sino no diseñar el alcance de sus responsabilidades. Cuanto más competente se vuelve la IA, mayor es el impacto de sus fallos.

En Cor. Inc., en la práctica de desarrollo de IA por contrato y asesoría en IA, enfatizamos un diseño que deja claros los permisos, los registros y los puntos de aprobación humana antes de integrar la IA en los flujos de trabajo.

[Consultar sobre la implementación de agentes de IA](/contact)

> **Datos objetivos en los que se basa este artículo**
>
> - Gartner predice que, para finales de 2026, el 40 % de las aplicaciones empresariales incorporará agentes de IA especializados en tareas.
> - En una encuesta de McKinsey de 2025, se informa que el 23 % de las organizaciones escala agentes de IA y el 39 % se encuentra en fase de experimentación.
> - Gartner predice que, para finales de 2027, más del 40 % de los proyectos de Agentic AI se cancelarán debido al aumento de costes, valor poco claro y gestión insuficiente de riesgos.

## Los permisos se determinan por "lo que está permitido hacer", no por "lo que se puede hacer"

Cuanto más amplía sus capacidades un agente, más conveniente resulta. Sin embargo, en el trabajo diario, "lo que está permitido" es más importante que "lo que se puede". ¿Está bien redactar un borrador de correo o se le debe permitir enviarlo? ¿Está bien preparar una propuesta de presupuesto o debe presentarse directamente al cliente? ¿Está bien buscar en la base de datos interna o debe modificarla?

Si se implementa sin definir este límite, las responsabilidades se vuelven ambiguas: ¿fue un error de la IA o una falta de supervisión humana? Al principio, debe dividirse en etapas como visualización, redacción de borradores, propuesta, ejecución y envío externo, estableciendo la aprobación humana para la ejecución y el envío externo.

En la práctica, estructurar los permisos por niveles de granularidad estabiliza las operaciones. Por ejemplo, dividirlos en 3 etapas: "solo visualización", "hasta creación de borradores" y "hasta envío y ejecución", exigiendo la aprobación humana obligatoria a medida que se sube de nivel. Compartir de antemano el límite de que la visualización puede delegarse libremente, pero cualquier operación con impacto externo debe pasar necesariamente por una persona, evitará problemas posteriores.

## Los registros no son para vigilar, sino que son necesarios para la reproducibilidad y la rendición de cuentas

Cuando un agente de IA entra en las operaciones, es necesario poder explicar a posteriori "por qué se obtuvo ese resultado". Si no se registran la información introducida, los datos consultados, las herramientas ejecutadas, la persona que aprobó y el objetivo modificado, no será posible introducir mejoras cuando ocurra un problema.

Los elementos a registrar se pueden rastrear con mayor facilidad si se estructuran con un nivel de detalle que incluya el ejecutor (qué agente o bajo la instrucción de quién), los datos objetivo, el contenido de la ejecución, el aprobador, la marca de tiempo y el resultado (éxito/fracaso). Esto no es un "registro para culpar a alguien", sino una base operativa para no repetir los mismos fallos.

El diseño de registros no existe para vigilar a los empleados, sino para proteger las operaciones. En la política de seguridad de Cor., también adoptamos el enfoque de no recopilar todo de forma desmedida, sino limitarlo a la telemetría de seguridad relevante para el negocio y llevar a cabo la visualización necesaria.

## En la primera PoC, defina incluso las "condiciones de parada"

En la PoC de un agente de IA, deben definirse no solo las condiciones de éxito, sino también las condiciones de parada. Por ejemplo, un diseño en el que se detenga automáticamente y se escale a una persona si las operaciones están a punto de afectar a un alcance no previsto, antes de una operación de alto riesgo o cuando se produzcan fallos consecutivos. En el momento en que se produzca un comportamiento de este tipo, se detiene y se revisa el diseño.

Específicamente, se establecen reglas para detener el procesamiento de forma automática y esperar la confirmación de una persona si el alcance objetivo supera lo previsto, si el mismo proceso falla de forma consecutiva o si se llega a una operación definida previamente como de alto riesgo (envíos externos, eliminación de datos, cambios en el entorno de producción, etc.). Al determinar las condiciones de parada con antelación, se genera margen para que las personas intervengan antes de que la IA actúe sin control.

Los agentes de IA no generan resultados automáticamente solo con implementarlos. Solo las empresas que diseñan con antelación los permisos, los registros y los flujos de aprobación logran integrarlos en sus operaciones.

## Para el diseño de implementación de agentes de IA, acuda a Cor. Inc.

Si desea incorporar agentes de IA en sus operaciones, el diseño de prompts o la selección de modelos no bastan por sí solos. En Cor. Inc., apoyamos el diseño de implementación de IA incluyendo permisos, registros, aprobaciones, flujos de trabajo y seguridad.

[Consultar sobre la implementación de agentes de IA](/contact)

## Preguntas frecuentes

### P. ¿En qué se diferencia un agente de IA de la IA generativa habitual?

La IA generativa habitual se dedica principalmente a generar respuestas. Los agentes de IA se diferencian en que planifican múltiples pasos y avanzan en las tareas coordinándose con herramientas externas y sistemas empresariales.

### P. ¿Qué tareas se pueden delegar al principio?

Se debe comenzar con tareas en las que se pueda intercalar la aprobación humana, como redacción de borradores, resúmenes, creación de propuestas de opciones o apoyo en la búsqueda de información interna.

### P. ¿Cuál es el diseño más importante al implementar agentes de IA?

Los permisos, los registros, los flujos de aprobación y las condiciones de parada. En especial, si se delegan envíos externos o la actualización de sistemas empresariales, se debe mantener la confirmación final por parte de un humano.

## Materiales de referencia


- [Gartner: 40% of Enterprise Apps Will Feature Task-Specific AI Agents by 2026](https://www.gartner.com/en/newsroom/press-releases/2025-08-26-gartner-predicts-40-percent-of-enterprise-apps-will-feature-task-specific-ai-agents-by-2026-up-from-less-than-5-percent-in-2025) - Predicción de que el 40 % de las aplicaciones empresariales incorporará agentes de IA especializados en tareas para finales de 2026.
- [McKinsey: The State of AI: Global Survey 2025](https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai) - El 88 % utiliza IA con regularidad en al menos una función empresarial, cerca de un tercio la escala, el 23 % escala agentes de IA y el 39 % está en fase de experimentación.
- [Gartner: Over 40% of Agentic AI Projects Will Be Canceled by End of 2027](https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-predicts-over-40-percent-of-agentic-ai-projects-will-be-canceled-by-end-of-2027) - Predicción de que más del 40 % de los proyectos de agentes de IA se cancelarán para finales de 2027 debido al aumento de costes, valor poco claro y gestión insuficiente de riesgos.
- [Página web de Cor.: Seguridad](https://cor-jp.com/security/) - Confirmación de local-first, registros mínimos, niveles de confidencialidad, políticas de uso de IA y preparación en curso para ISMS.
