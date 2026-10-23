---
title: "La productividad se multiplica por 7 con el desarrollo impulsado por IA: mi experiencia práctica"
description: "Un caso de estudio práctico en el que, mediante un flujo de trabajo de desarrollo que combina las herramientas de IA más recientes, las contribuciones en GitHub aumentaron 7 veces, pasando de unas 50 a más de 350 al mes"
summary: "Desde que cambié al desarrollo impulsado por IA, las contribuciones en GitHub se multiplicaron por 7, pasando de unas 50 al mes a más de 350. Genero especificaciones y código con Claude Desktop y Claude Code, y doy el acabado final con la revisión de CodeRabbit y Cursor."
pubDate: 2024-01-15
updatedDate: 2026-10-23
author: "Terisuke"
category: "ai"
tags: ["AI", "開発効率", "Cursor", "CodeRabbit", "GitHub Copilot"]
lang: "es"
featured: true
translationSourceHash: "ed0176d934a14b7285d9bbf477e8c07d66cff7938bf7a6ae93e9e8698ce3c118"
translatedAt: "2026-10-23T06:24:11.806Z"
translationModel: "gemini-3.8-flash"
---

## Multiplicar la productividad por 7 con el desarrollo impulsado por IA: mi experiencia real

Al pasar de los métodos de desarrollo tradicionales al desarrollo impulsado por IA, la productividad del desarrollo mejoró de forma drástica. El número de contribuciones en GitHub, que a lo sumo rondaba las 50 al mes, pasó a superar las 350 mensuales. Se multiplicó por 7. No es una broma, realmente se multiplicó por 7. Aquí dejo por escrito todo sobre cómo lo logré.

## Construcción del flujo de trabajo de desarrollo impulsado por IA

### 1. Automatización de la generación de código

Hago que Claude Code escriba el código. En primer lugar, interactúo con Claude Desktop para elaborar las instrucciones detalladas y luego transmito ese contenido a Claude Code en la terminal. En cuestión de minutos, la estructura básica del código está lista. A partir de ahí, voy añadiendo instrucciones concretas como: «añade un método a esta clase y escribe también las pruebas unitarias».

### 2. Optimización de la revisión de código

Un conejo inteligente llamado CodeRabbit se encarga de la revisión de código. Al crear un PR, la revisión comienza de forma automática y señala mediante comentarios en el PR posibles errores, vulnerabilidades de seguridad, infracciones de las normas de codificación, entre otros aspectos. Los puntos señalados se corrigen con la función Agent de Cursor. Vivimos en una época maravillosa.

## Datos reales medidos

Lo que medí fue el número de contribuciones en GitHub. Anteriormente, las contribuciones a proyectos personales o de código abierto rondaban, como mucho, unas 50 al mes. Desde que comencé a desarrollar junto con la IA, pasé a superar las 350 al mes.

Sin embargo, las contribuciones no son solo el número de commits. Según la definición de GitHub, además de los commits, también se cuentan las Issues, los Pull Requests, las revisiones, etc. Los detalles de la evolución de estas cifras los expliqué en el artículo de note citado en las referencias.

## Detalle de la cadena de herramientas

### Herramientas principales: los compañeros de equipo

- Cursor: editor integrado con IA. Corrige los puntos señalados mediante la función Agent (ya no puedo vivir sin él)
- Claude Desktop: elabora las instrucciones dialogando de forma interactiva
- Claude Code: escribe el código a partir de las instrucciones
- CodeRabbit: un conejo inteligente que revisa el código de forma automática

Este flujo de trabajo no solo aumenta la eficiencia, sino que transforma la experiencia de desarrollo en sí misma. Ya no se siente tanto como escribir código, sino más bien como resolver problemas dialogando con la IA.

## Referencias

- [Cómo combiné las últimas herramientas de IA para multiplicar por 7 la velocidad de desarrollo: mi desarrollo ultrarrápido impulsado por IA](https://note.com/cor_instrument/n/n800a959f7284) (note, 1 de junio de 2025). Artículo en el que explico cómo las contribuciones en GitHub aumentaron de unas 50 al mes a más de 350.

Estos son los servicios que utilizo en la práctica.

https://cor-jp.com/

https://github.com
