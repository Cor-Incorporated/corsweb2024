---
title: "Por qué las estimaciones en desarrollo de IA y por encargo dependen de cada persona: cómo convertir los fundamentos en activos de la empresa"
description: "Explicamos por qué las estimaciones en el desarrollo por encargo varían según la persona y cómo crear fundamentos explicables utilizando el historial de GitHub, los precios de mercado y el desglose de horas de trabajo. También presentamos el enfoque para utilizar Grift."
summary: "Las estimaciones en el desarrollo por encargo se vuelven dependientes de las personas porque la información necesaria está dispersa entre proyectos anteriores, la memoria del equipo comercial y la experiencia de los responsables. Al estructurar la información de cada proyecto y registrarla en cada estimación, los fundamentos pueden reutilizarse en futuros proyectos como un activo de la empresa."
pubDate: 2026-06-20
updatedDate: 2026-10-29
author: "Terisuke"
category: "engineering"
ctaIntent: "contract-dev"
tags: ["見積もり", "受託開発", "Grift", "ナレッジ"]
lang: "es"
featured: false
isDraft: false
translationSourceHash: "246c11fb7726ed09c0d91d13d600d615714ef7162889006cdd1ccf49b4e2048e"
translatedAt: "2026-10-29T05:20:00.000Z"
translationModel: "manual-i18n-sync"
---

¿Por qué la estimación en el desarrollo por encargo depende tanto de personas concretas? La razón es sencilla: la información necesaria para estimar está dispersa entre proyectos anteriores, GitHub, horas de trabajo, riesgos, la memoria del equipo comercial y la experiencia de cada responsable. Si esto se queda únicamente en la cabeza de las personas, la calidad de las propuestas del equipo no podrá ser estable.

> **Nota agregada el 20 de octubre de 2026**
> Grift finalizó la oferta de su aplicación web de asistencia en estimaciones en septiembre de 2026 y actualmente ha cambiado su orientación hacia una CLI de código abierto ([griftai.org](https://griftai.org)) que extrae hechos verificables a partir del historial de Git de los ingenieros. Las descripciones sobre Grift en este artículo corresponden al contenido en el momento de su publicación. Para consultas sobre estimaciones de desarrollo por encargo y desarrollo de IA, las recibimos como desarrollo de IA por encargo a través de nuestra página de [contacto](/contact).

La primera versión de este artículo presentaba la aplicación web de Grift para apoyar estimaciones, que se ofrecía entonces. Esa oferta terminó en septiembre de 2026. El Grift CLI actual es otra forma de oferta: ordena hechos comprobables a partir de los registros de desarrollo. Este artículo conserva la forma de pensar las estimaciones y actualiza a dónde consultar ahora. El destino actual es el desarrollo de IA por encargo y el apoyo a la adopción.

La página del servicio es [Infraestructura de IA y desarrollo por encargo](/services/ai-development/).

La consulta empieza en [contacto](/contact?intent=contract-dev). Esa entrada es distinta de una prueba (PoC) de Grift.

En Cor.Inc. consideramos que una estimación no es un simple cálculo de importes, sino la construcción de confianza con el cliente. No se trata de si es barato o caro, sino de si se puede explicar "por qué tiene este importe". Si no se puede responder a esto, la negociación comercial se convierte en un simple regateo de precios.

> **Datos objetivos tomados como premisa en este artículo**
> - En la página de presentación de Grift al momento de su publicación, se explicaba que cotejaba el historial de GitHub con los precios de mercado, estructuraba las especificaciones mediante entre 5 y 10 sesiones de consultas con IA y generaba un informe comparativo entre el estándar de mercado y la propuesta de la empresa.
> - En GitHub Octoverse 2025, se resume que la IA generativa se está estandarizando en el desarrollo, y que la IA, los agentes y los lenguajes tipados están generando uno de los mayores cambios en el desarrollo en más de una década. En el informe, «2025» es del 1 de septiembre de 2024 al 31 de agosto de 2025. Desarrollador significa una persona con cuenta de GitHub, y los indicadores sin nota especial son actividad pública.
> - Al momento de su publicación, en la página de casos de éxito de Cor. se posicionaba a Grift como una "plataforma propia de estimación y evaluación con IA que genera presupuestos de referencia explicables a partir del historial de GitHub y los precios de mercado".

## Las 3 causas por las que las estimaciones se vuelven personalistas

- Es difícil buscar proyectos pasados y, aunque exista un proyecto similar, solo queda en la memoria de alguien.
- El desglose entre frontend, backend, infraestructura, gestión de proyectos (PM) y pruebas es difuso, por lo que no se pueden justificar las horas estimadas.
- La falta de definición en las especificaciones, las integraciones externas, el número de revisiones y los retrasos en las confirmaciones por parte del cliente no se incluyen en la estimación, por lo que los riesgos no se reflejan en el precio.

En este estado, la empresa se vuelve incapaz de presentar propuestas si no cuenta con profesionales veteranos. Aunque aumenten los contratos adjudicados, si los responsables de estimar no dan abasto, el crecimiento se detendrá.

## Cómo transformar la justificación en un activo de la empresa

Para convertir las estimaciones en un activo de la empresa, es necesario estructurar la información de cada proyecto. Si cada vez que se realiza una estimación se registran el resumen del proyecto, los requisitos funcionales, los requisitos no funcionales, el desglose de horas, los riesgos, los proyectos similares, el código implementado y los textos explicativos para el cliente, estos podrán reutilizarse en el siguiente proyecto.

El papel de la IA no es decidir el importe, sino organizar la información dispersa y aportar los elementos necesarios para que una persona pueda juzgar. La decisión final debe tomarla un ser humano.

## Lo que se buscaba con Grift

Lo que buscaba Grift en el momento de su publicación no era reemplazar a los responsables de las estimaciones, sino transformar la justificación de las estimaciones en un activo empresarial y crear una situación en la que fuera posible explicársela al cliente.

En concreto, el plan consistía en observar la velocidad de desarrollo del equipo a partir de su historial de GitHub, contrastarla con los precios de mercado y generar un informe con el desglose de horas para cada proyecto. El objetivo era permitir que los equipos de desarrollo por encargo pudieran explicar las cosas no "por intuición", sino diciendo: "Bajo estas condiciones, este es el importe".

## Preguntas frecuentes

### P. ¿Es Grift una herramienta que determina automáticamente el importe final de la estimación?

R. En el momento de su publicación, Grift no determinaba automáticamente un importe formal, sino que era una herramienta para elaborar estimaciones de referencia y documentación explicativa a partir de consultas con IA, el historial de GitHub y los precios de mercado. Grift dejó de ofrecer su aplicación web de asistencia en estimaciones en septiembre de 2026 y actualmente es una CLI de código abierto que extrae hechos verificables a partir del historial de Git de los ingenieros.

### P. ¿Cuál es la ventaja de usarlo en un equipo de desarrollo por encargo?

R. Las ventajas señaladas al momento de su publicación eran reducir la disparidad de las estimaciones entre distintos responsables, reutilizar proyectos pasados y実績 de desarrollo, y facilitar la explicación de los fundamentos del importe al cliente.

### P. ¿Se puede dejar la estimación en manos de la IA?

R. La organización inicial y la generación de material justificativo se pueden delegar en la IA, pero el importe final, la evaluación de riesgos y los ajustes basados en la relación con el cliente deben ser realizados por personas.

## Materiales de referencia

- [Página de presentación de Grift](https://griftai.org/): En la página de presentación al momento de la publicación, se comprobaron el cotejo entre el historial de GitHub y los precios de mercado, las 5 a 10 sesiones de consultas con IA, los informes comparativos, los estudios de mercado de la versión alfa de aquel momento, etc.
- [GitHub Octoverse 2025](https://github.blog/news-insights/octoverse/octoverse-a-new-developer-joins-github-every-second-as-ai-leads-typescript-to-1/): el periodo es del 1 de septiembre de 2024 al 31 de agosto de 2025. La población son desarrolladores con cuenta de GitHub; los indicadores sin nota especial son actividad pública. El 80% de los nuevos desarrolladores utiliza Copilot en su primera semana. TypeScript es el lenguaje más utilizado en GitHub.
- [Sitio web de Cor.: Casos de éxito y proyectos](https://cor-jp.com/works/): Se comprobaron Engineer Cafe Navigator, Grift, SaaS de IA, migración de bases de datos centrales heredadas (legacy), IA para la construcción, etc.
- [Sitio web de Cor.: AI × CO-CREATION / Resumen del negocio](https://cor-jp.com/): Se comprobaron las áreas de negocio de Cor., Grift, LLM locales e IA segura, desarrollo impulsado por IA y mensajes de cocreación.
