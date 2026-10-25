---
title: "Engineer Cafe Navigator — Logro de OSS de soporte en recepción mediante IA de voz multilingüe"
description: "Presentamos el caso de éxito del desarrollo como OSS de un agente de recepción con IA de voz multilingüe para el Fukuoka City Engineer Cafe, desarrollado con una arquitectura multiagente."
category: "ai-contract"
tags: ["IA de voz", "Multiagente", "RAG", "OSS", "Soporte multilingüe"]
publishedAt: 2026-07-02
updatedAt: 2026-10-23
summary: "Hemos desarrollado y puesto en funcionamiento real un agente de IA de voz multilingüe que da soporte a la recepción del Fukuoka City Engineer Cafe mediante una arquitectura multiagente, y lo hemos publicado como OSS bajo la licencia ISC."
isDraft: false
featured: true
lang: "es"
translationSourceHash: "4442ebd47cb08d3af1237b352e40f2010c433dbf42ec369dd2a828051ac75421"
translatedAt: "2026-10-23T06:30:27.903Z"
translationModel: "gemini-3.8-flash"
---

## Desafíos

El Engineer Cafe de la ciudad de Fukuoka recibe a una gran diversidad de visitantes, tanto de Japón como del extranjero. Las consultas son muy variadas y abarcan desde los horarios de apertura hasta las instalaciones y la información sobre eventos, siendo habitual la atención a visitantes internacionales. Si bien se consideraba fundamental que el personal respondiera a cada persona con dedicación, la carga de atender a los nuevos visitantes se fue acumulando, lo que generó la preocupación de que los propios usuarios no pudieran acceder de inmediato a la información que necesitaban.

## Enfoque

En Cor., decidimos desde un principio no optar por una estructura que se limitara a enviar la pregunta tal cual a un único LLM para devolver una respuesta. El diseño divide a agentes especializados según funciones específicas —como orientación, horarios de apertura, eventos y memoria de conversación—, coordinados por un agente de enrutamiento. Consideramos que, al evitar delegar la respuesta por completo y permitir el seguimiento de qué agente tomó cada decisión y de qué manera, sería posible consolidar tanto la compatibilidad multilingüe como la precisión de las indicaciones. Asimismo, con el propósito de devolver a la sociedad un sistema perfeccionado en operaciones reales, se estableció la política de publicarlo como OSS (licencia ISC).

## Implementación

El frontend se desarrolló con Next.js 15, implementando una interfaz de usuario tipo quiosco con un personaje 3D VRM. El backend es un sistema multiagente basado en la arquitectura LangGraph Supervisor, en el que colabora un grupo de agentes especializados en enrutamiento, información de instalaciones, horarios de atención, información de eventos y memoria de conversación, entre otros. Para la base de datos se adoptó Supabase (PostgreSQL + pgvector), diseñando un RAG multilingüe (un mecanismo que permite a la IA consultar documentos internos, entre otros) que hace posible utilizar directamente la base de conocimiento en japonés para responder preguntas en otros idiomas. Para el reconocimiento y la síntesis de voz se utilizó Google Cloud. En cuanto a la calidad, se implementó un control de evaluación mediante RAGAS (un marco de evaluación de la calidad de respuestas RAG) y se avanzó en el desarrollo registrando ADR (registros de decisiones arquitectónicas). También se trabajó en el diseño de la memoria de conversación a corto y largo plazo.

- Repositorio: [github.com/terisuke/engineer-cafe-navigator](https://github.com/terisuke/engineer-cafe-navigator)
- Arquitectura: Next.js 15 + LangGraph Supervisor + Supabase(pgvector) + Google Cloud STT/TTS
- Garantía de calidad: control de evaluación con RAGAS, desarrollo guiado por ADR

## Resultados

Engineer Cafe Navigator se encuentra actualmente en funcionamiento real, y los visitantes ahora pueden consultar información sobre las instalaciones, los horarios de apertura y los eventos en varios idiomas. Su envergadura alcanza las 182.368 líneas, 1.506 commits y 8 colaboradores (incluido el personal oficial de Engineer Cafe, según mediciones de git a fecha de junio de 2026), de los cuales la tasa de contribución de Cor. es del 87,7% (medición real de git). Al haberse publicado como código abierto (OSS), se ha establecido una estructura en la que las mejoras continúan también con la participación de la comunidad. Consideramos que el hecho de no haberse limitado a crear algo que simplemente funcionara, sino haber diseñado una arquitectura de producción que abarca desde el enrutamiento y la búsqueda hasta la evaluación, ha sido clave para su actual estabilidad operativa.
