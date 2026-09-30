---
title: "Renovación de una plataforma de encuestas a gran escala — primero, lograr que cambiar no dé miedo"
description: "Proyecto en el que reconstruimos y llevamos a producción una plataforma de recogida y análisis de encuestas recibida a mitad de camino, empezando por preparar las pruebas y el CI/CD."
category: "ai-contract"
tags: ["renovación de plataforma", "CI/CD", "FastAPI", "agentes de IA"]
publishedAt: 2026-07-02
summary: "Reconstruimos una plataforma de encuestas heredada a mitad de camino empezando por las pruebas, el CI/CD y la infraestructura como código, y la renovamos hacia una experiencia en la que la IA dialoga y profundiza en las respuestas."
securityNote: "Este proyecto está sujeto a un NDA, por lo que publicamos de forma abstracta la información que podría identificar al cliente o al producto."
isDraft: false
featured: false
lang: "es"
translationSourceHash: "0c80714cd505e0d78e0c53dc042d0f5dcb00418815fbd3200f8209f3c185f703"
translatedAt: "2026-09-28T06:09:16.044Z"
translationModel: "adopted-legacy"
---

## Desafío

Esta plataforma de recogida y análisis de encuestas es un proyecto que recibimos a mitad de camino. En ese momento las pruebas eran insuficientes y el procedimiento de despliegue no estaba definido, de modo que cada vez que se añadía una funcionalidad hacía falta mucho tiempo para comprobar su impacto en el resto. Se quería ir más allá de un formulario estático y llegar a una experiencia en la que la IA dialoga y profundiza en las respuestas, pero el primer obstáculo era que ni siquiera existía una base sobre la que introducir cambios con tranquilidad.

## Enfoque

Optamos por no rehacerlo todo de inmediato, sino por construir primero «un estado en el que se pueda cambiar con seguridad». Antes de añadir funcionalidades preparamos las pruebas, el CI/CD y la gestión de la infraestructura como código, y solo después de asentar esa base abordamos el objetivo principal: la funcionalidad de diálogo con IA. En paralelo, aprovechamos esta etapa para revisar también quién puede acceder a qué y cómo se tratan los datos.

## Implementación

La base técnica está compuesta por Python, FastAPI y PostgreSQL, con una arquitectura que permite alternar entre varios LLM. En la parte de agentes de IA avanzamos con la migración al kit de desarrollo de agentes de Google (ADK), y la infraestructura pasó a gestionarse como código con Terraform. También renovamos la plataforma de autenticación, revisando a la vez la gestión de permisos y los accesos. Preparamos unas 2.500 pruebas, mantenemos en operación 27 flujos de CI/CD y establecimos la observabilidad mediante registros y trazas.

- Tecnología: Python / FastAPI / PostgreSQL, arquitectura con varios LLM intercambiables, Google ADK, Terraform
- Calidad y operación: unas 2.500 pruebas, 27 flujos de CI/CD, observabilidad y renovación de la gestión de permisos

## Resultados

En la fase posterior al traspaso (de noviembre de 2025 a marzo de 2026) asumimos el 77,5 % de los commits (medición en git), y avanzamos desde la reconstrucción de la plataforma hasta la puesta en producción de la funcionalidad de diálogo con IA. Actualmente la frecuencia de despliegue es de 2,5 veces al día de media y la mediana del tiempo de espera de las pull requests se ha reducido a 24 minutos. El uso real alcanzó 484 casos en 12 proyectos. Haber asentado antes las pruebas y el CI/CD hizo que ya no haga falta ponerse en tensión con cada nueva funcionalidad: sentimos que el mayor resultado es haber pasado a «una plataforma en la que cambiar no da miedo».
