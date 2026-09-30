---
title: "Diagnóstico de IA con datos confidenciales — ordenamos juntos cómo tratarlos antes de exponerlos"
description: "Presentamos en qué consiste el servicio de diagnóstico con el que pensamos contigo el diseño de la información antes de aprovechar con IA datos confidenciales como contratos o información de clientes."
category: "confidential-ai"
tags: ["datos confidenciales", "diagnóstico de uso de IA", "LLM local", "seguridad"]
publishedAt: 2026-07-02
summary: "Quieres usar contratos, actas de reunión e información de clientes con IA, pero no puedes enviarlos tal cual a una IA externa. Es un servicio de diagnóstico que atiende esa preocupación ordenando la información antes de construir nada."
relatedSlugs: ["local-llm-poc"]
isDraft: false
featured: true
lang: "es"
translationSourceHash: "eaac26262096196ef50f76a62b92316ea31feaa5bf1239f905556a365edb685e"
translatedAt: "2026-09-28T06:09:16.040Z"
translationModel: "adopted-legacy"
---

## Desafío

Contratos, actas de reunión, información de clientes, presupuestos, conocimiento interno. Dentro de la empresa hay mucha información que parece aprovechable con IA, pero con frecuencia escuchamos que no se sabe si puede enviarse tal cual a una IA en la nube. El tiempo pasa sin saber por dónde empezar y, al consultar con un proveedor, la conversación se convierte de entrada en un gran proyecto de desarrollo. Este diagnóstico está pensado para directivos y responsables de administración de pymes que se encuentran en esa situación.

## Enfoque

Lo que Cor. valora es la idea de «diseñar la información que se va a tratar antes de usar IA». No construimos de inmediato. Cada tipo de información tiene su propio nivel de confidencialidad y se divide entre lo que puede enviarse a una IA en la nube y lo que debe tratarse con un LLM local, que funciona en tu propio entorno sin que los datos salgan al exterior. Empezamos por ordenar juntos ese criterio de separación. A veces el diagnóstico concluye que «todavía es mejor no construir nada», y también eso te lo decimos con franqueza.

## Implementación

El diagnóstico avanza con el siguiente recorrido.

- Entrevistas sobre el terreno para entender el trabajo y sus dificultades
- Análisis de los procesos existentes e inventario de las tareas que podrían apoyarse en IA
- Clasificación de los datos que se manejan (ordenar su nivel de confidencialidad)
- Separación entre IA en la nube y LLM local
- Análisis de riesgos (cuatro perspectivas de diseño: límites de entrada, permisos de acceso, registros de operación y aprobación humana)
- Definición del criterio para decidir si se pasa a una PoC

En lugar de entrar por la parte técnica, damos prioridad a poner en palabras qué información se maneja y cómo debe tratarse.

## Resultados

Al terminar el diagnóstico te quedan documentos útiles para la siguiente decisión: el inventario de tareas candidatas a apoyarse en IA, la clasificación de los datos y su forma de tratamiento, los riesgos y las medidas previstas, y una propuesta de enfoque si se decide avanzar hacia una PoC.

A partir de ahí hay tres caminos: avanzar hacia una PoC de LLM local o de plataforma de IA (desde 3 millones de yenes por 3 meses, variable según el reto y el alcance), pasar a una implementación en producción de forma acotada, o concluir que por ahora no conviene construir nada. Sea cual sea la opción, el diagnóstico está diseñado para servir como base con la que decidir el siguiente paso. El coste ronda entre 100.000 y 300.000 yenes (variable según el reto y el alcance). Empecemos por conversar.
