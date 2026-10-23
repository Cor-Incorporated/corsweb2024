---
title: "Renovación de la infraestructura de recolección y análisis de encuestas a gran escala: Primero crear un entorno donde los cambios no den miedo"
description: "Caso de éxito en el que asumimos a mitad de camino una plataforma de recolección y análisis de encuestas, la reestructuramos mediante pruebas y CI/CD, y la llevamos a producción."
category: "ai-contract"
tags: ["Renovación de infraestructura", "CI/CD", "FastAPI", "Agente de IA"]
publishedAt: 2026-07-02
updatedAt: 2026-10-23
summary: "Reestructuramos una infraestructura de encuestas asumida a mitad de camino mediante la implementación de pruebas, CI/CD e IaC, renovándola hacia una experiencia donde la IA profundiza en las respuestas de forma interactiva."
securityNote: "Debido a un acuerdo de confidencialidad (NDA), la información que pueda identificar al cliente o a los productos se presenta de forma abstracta."
isDraft: false
featured: false
lang: "es"
translationSourceHash: "cae16436a7713a03aac5232249ec9c304999d0efbaa9eafc29099d8f81578cdf"
translatedAt: "2026-10-23T06:31:14.422Z"
translationModel: "gemini-3.8-flash"
---

## Desafíos

Esta plataforma de recopilación y análisis de encuestas es un proyecto que Cor. asumió a mitad de camino. En el momento del traspaso, los tests eran insuficientes y no existía un procedimiento de despliegue establecido, por lo que cada vez que se añadía una funcionalidad se requería mucho tiempo para verificar el impacto en el resto del sistema. Aunque el objetivo era ir más allá de los formularios estáticos y ofrecer una experiencia donde la IA profundizara en las respuestas mediante el diálogo, el primer obstáculo fue que, en primer lugar, el sistema no se encontraba en un estado que permitiera realizar cambios con tranquilidad.

## Enfoque

En lugar de reconstruir todo desde cero de inmediato, Cor. optó por crear primero un «entorno donde realizar cambios de forma segura». Se priorizó la implementación de tests, CI/CD y la gestión de la infraestructura como código antes de añadir nuevas funcionalidades, consolidando la base para luego abordar el núcleo del proyecto: la funcionalidad de diálogo con IA. Paralelamente, en esta fase también se reorganizó la gestión de permisos —definiendo quién puede acceder a qué— y el tratamiento de los datos.

## Implementación

La base tecnológica se estructuró con Python / FastAPI / PostgreSQL, diseñada para permitir la alternancia entre múltiples LLM. En la parte de los agentes de IA, se avanzó en la migración al kit de desarrollo de agentes (ADK) de Google, y la infraestructura pasó a gestionarse como código mediante Terraform. Asimismo, se renovó la infraestructura de autenticación, reorganizando la gestión de permisos y el control de accesos. Se implementaron cerca de 2.500 tests, se operan 27 flujos de trabajo de CI/CD y se estableció la observabilidad mediante logs y trazas.

- Tecnología: Python / FastAPI / PostgreSQL, arquitectura con alternancia de múltiples LLM, Google ADK, Terraform
- Calidad y operaciones: cerca de 2.500 tests, 27 flujos de trabajo de CI/CD, observabilidad, renovación de la gestión de permisos

## Resultados

En la fase posterior al traspaso (noviembre de 2025 a marzo de 2026), Cor. asumió el 77,5 % de los commits (medición real en git), avanzando desde la reestructuración de la base hasta la puesta en producción de la funcionalidad de diálogo con IA. En la actualidad, la frecuencia de despliegue alcanza una media de 2,5 veces al día, y la mediana del tiempo de entrega (lead time) de las pull requests se ha reducido a 24 minutos. El uso real ha alcanzado 484 casos en 12 proyectos. Consideramos que el mayor logro ha sido que, al consolidar primero los tests y el CI/CD, ya no es necesario ponerse a la defensiva ante cada nueva funcionalidad, transformando el entorno en «una base donde cambiar el código ya no da miedo».
