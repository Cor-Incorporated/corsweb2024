---
title: "Engineer Cafe Navigator — un proyecto de código abierto que apoya la recepción con IA de voz multilingüe"
description: "Presentamos el proyecto en el que desarrollamos, con una arquitectura multiagente, un agente de recepción con IA de voz multilingüe para el Engineer Cafe de la ciudad de Fukuoka, publicado como código abierto."
category: "ai-contract"
tags: ["IA de voz", "multiagente", "RAG", "OSS", "soporte multilingüe"]
publishedAt: 2026-07-02
summary: "Desarrollamos y mantenemos en producción un agente de IA de voz multilingüe con arquitectura multiagente que apoya la recepción del Engineer Cafe de Fukuoka, publicado como código abierto bajo licencia ISC."
isDraft: false
featured: true
lang: "es"
translationSourceHash: "f1d9811033cd2eeb1dce387db8407c3fd02863f9cae4c4cff8084d191ca6fdd3"
translatedAt: "2026-09-28T06:09:16.041Z"
translationModel: "adopted-legacy"
---

## Desafío

Al Engineer Cafe de la ciudad de Fukuoka acuden visitantes muy diversos, de Japón y del extranjero. Las consultas son muy variadas —horarios de apertura, instalaciones, información de eventos— y atender a visitantes internacionales forma parte del día a día. Por un lado se quiere preservar la atención cuidadosa del personal, consulta por consulta; por otro, la carga de atender a los nuevos visitantes se acumulaba y los propios usuarios no llegaban con rapidez a la información que buscaban.

## Enfoque

Lo primero que decidimos fue no construir un sistema que lanzara la pregunta directamente a un único LLM y devolviera su respuesta. El diseño separa agentes especializados por función —orientación, horarios, eventos, memoria de conversación— y añade un componente de enrutamiento que los coordina. Pensamos que, si no delegábamos la respuesta por completo y manteníamos una arquitectura en la que se puede rastrear qué agente decidió qué y cómo, podríamos construir el soporte multilingüe y la precisión de la orientación paso a paso. Además, decidimos publicarlo como código abierto (licencia ISC) para devolver a la sociedad un sistema pulido en operación real.

## Implementación

El frontend está construido con Next.js 15 y ofrece una interfaz tipo quiosco con un personaje 3D en formato VRM. El backend es un sistema multiagente con arquitectura LangGraph Supervisor, en el que colaboran agentes especializados en enrutamiento, orientación sobre las instalaciones, horarios, información de eventos y memoria de conversación. Como base de datos adoptamos Supabase (PostgreSQL + pgvector), con un diseño de RAG multilingüe (un mecanismo que permite a la IA consultar documentos internos) que reutiliza la base de conocimiento en japonés para preguntas formuladas en otros idiomas. El reconocimiento y la síntesis de voz se apoyan en Google Cloud. En cuanto a la calidad, establecimos una puerta de evaluación con RAGAS (un marco de evaluación de la calidad de las respuestas RAG), avanzamos dejando registro de las decisiones de diseño mediante ADR y trabajamos también el diseño de la memoria de conversación a corto y largo plazo.

- Repositorio: [github.com/terisuke/engineer-cafe-navigator](https://github.com/terisuke/engineer-cafe-navigator)
- Arquitectura: Next.js 15 + LangGraph Supervisor + Supabase (pgvector) + Google Cloud STT/TTS
- Garantía de calidad: puerta de evaluación con RAGAS, desarrollo guiado por ADR

## Resultados

Engineer Cafe Navigator está en operación y los visitantes pueden preguntar en varios idiomas por la orientación sobre las instalaciones, los horarios o la información de eventos. Su tamaño es de 182.368 líneas, 1.506 commits y 8 colaboradores (incluido el personal oficial del Engineer Cafe; medición en git, junio de 2026), con una contribución propia del 87,7 % (medición en git). Al publicarlo como código abierto, la mejora continúa con la participación de la comunidad. Creemos que la estabilidad actual en operación viene de no habernos quedado en construir algo que simplemente funcionara, sino de haber llegado a una arquitectura de producción que incluye enrutamiento, búsqueda y evaluación.
