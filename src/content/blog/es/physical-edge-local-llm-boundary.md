---
title: "Pensar por separado en el edge de inferencia física y el LLM local interno: los riesgos de mezclar sus límites"
description: "El edge de inferencia física que opera junto a cámaras y sensores y el LLM local que gestiona documentos y operaciones internas tienen propósitos y límites de confianza diferentes. Kousuke Terada, representante de la empresa, explica qué se vuelve difuso al tratarlos como un único clúster y cómo los separamos."
summary: "El edge de inferencia física que emite juicios cerca de cámaras y sensores y el LLM local que gestiona documentos internos protegen cosas distintas. Si se mezclan los dispositivos edge en el clúster principal, resulta imposible explicar el alcance de los privilegios y la demarcación de responsabilidades. En Cor.Inc., diseñamos el edge exclusivamente como edge y, al transferir datos con la línea principal, determinamos individualmente el contenido y las rutas que se transfieren."
pubDate: 2026-10-28
author: "Terisuke"
category: "ai"
ctaIntent: "local-llm-poc"
tags: ["ローカルLLM", "エッジAI", "セキュアAI", "設計"]
lang: "es"
featured: false
isDraft: false
translationSourceHash: "effa0c3cdcd90650eb2f59540b90676250007917e3eae461c4ff86f9b946e82f"
translatedAt: "2026-10-27T13:44:49.126Z"
translationModel: "gemini-3.8-flash"
---

Hola, soy Terada de Cor.Inc. Hoy quiero escribir sobre los "límites", algo a lo que prestamos muchísima atención en nuestros diseños.

Cuando recibimos consultas sobre IA local, a veces se habla de dos cosas como si fueran lo mismo: la inferencia que se ejecuta justo al lado de cámaras o sensores, y los LLM locales que gestionan documentos internos y operaciones comerciales.

Ambas son "IA que no sale a la nube". Sin embargo, me aseguro de no meter estas dos cosas en la misma caja.

## Tienen propósitos diferentes

El edge de inferencia física opera cerca del terreno de trabajo. Su labor consiste en recibir imágenes de cámaras o valores de sensores y devolver decisiones en el acto. Lo fundamental aquí es la cercanía de las entradas y que no se detenga.

El LLM local interno gestiona documentos, actas de reuniones y datos operativos. Lo que importa es quién preguntó qué y qué pudo leer. Lo fundamental aquí son los permisos, las revocaciones y los registros (logs).

Aunque se use la misma palabra, "inferencia", lo que se debe proteger es completamente distinto.

## Los límites de confianza también son distintos

Los equipos edge suelen colocarse físicamente en las instalaciones de trabajo. Se encuentran en lugares accesibles para las personas y se conectan a sensores o sistemas de control. Por otro lado, en la línea principal del LLM interno se concentran documentos de alta confidencialidad.

¿Qué ocurre si tratamos estos dos elementos como un único clúster? El hardware ubicado en las instalaciones operativas quedaría dentro del mismo límite de confianza que los documentos internos.

En un diagrama de arquitectura, esto es solo una pequeña línea de diferencia. Sin embargo, en las operaciones cotidianas se convierte en una diferencia enorme.

## La tentación de decir "es parte del clúster"

Para ser sincero, entiendo el deseo de querer agruparlo todo. Cuanto mayor es la cantidad de hardware, más impresionante parece la infraestructura. Si se suman las cifras de unidades y de velocidad, se pueden crear presentaciones que se ven muy bien.

Pero, al hacer eso, ¿qué se vuelve difuso? El alcance de las autorizaciones. La delimitación de responsabilidades.

Ya no se puede explicar "si este equipo edge falla, a quién del LLM interno afecta". Tampoco queda claro "si suspendemos la cuenta de este dispositivo, hasta dónde se detiene el sistema".

Creo que difuminar los límites solo para inflar los números es poner el carro delante del caballo.

## Nuestro enfoque

Por ello, nosotros lo estructuramos de la siguiente manera:

- Diseñar el edge de inferencia física como uso exclusivo para edge
- No integrarlo en el clúster principal del LLM local interno
- Incluso en explicaciones externas, no mezclar los equipos edge al hablar de la arquitectura o el rendimiento de la línea principal
- Si es necesario transferir datos entre ambos, definir de forma individual el contenido que se transfiere y las rutas de comunicación

Existe la demanda de querer utilizar en la parte operativa los resultados generados en el edge. Incluso en esos casos, no establecemos que "se pueda leer libremente porque es el mismo clúster". Solo se transfieren los resultados necesarios a través de la ruta establecida. Nada más.

## Un ejemplo

Nosotros estamos validando la inferencia física tomando como tema tareas que implican movimiento corporal, como el juego de romper la sandía con los ojos vendados (suikawari). No obstante, en este momento se trata de una validación mediante simulación.

Incluso este entorno de validación se encuentra aislado de la línea principal que maneja los documentos internos. Aunque sea una temática con aspecto lúdico, trazamos los límites exactamente igual que en un entorno de producción. De ese modo, no habrá dudas más adelante cuando se traslade a producción.

## Lo que ofrecemos no es "velocidad"

Lo que ofrece Cor.Inc. es un acompañamiento integral totalmente local que se ejecuta en los dispositivos existentes. En el marco de la gestión del SGSI (ISMS), colaboramos desde la selección de la arquitectura hasta el diseño de permisos, revocaciones y registros. En cuanto al SGSI, prevemos completar la auditoría de Fase 2 de la norma ISO/IEC 27001 en octubre de 2026, y estimamos obtener el registro de certificación alrededor de diciembre de 2026.

No vendemos velocidad de tokens ni amplias comparativas de rendimiento, ya que la velocidad puede variar enormemente según el entorno y el uso. Lo que no cambia es la capacidad de explicar "quién puede usarlo, hasta qué punto y hasta cuándo".

Separar el edge de la línea principal es una extensión natural de esa misma filosofía.

## Para terminar

Dado que la IA local se tiene físicamente a mano, es necesario trazar los límites uno mismo. Trazar por cuenta propia las líneas que en la nube delimitaba el proveedor de servicios. Y mantener una situación en la que podamos explicar cada una de esas líneas. Eso es lo que valoramos.

Si alguien se encuentra indeciso ante una situación similar, no dude en contactarnos.

## Materiales de referencia

- [Cor.Inc.: Seguridad](https://cor-jp.com/security/) - Información sobre la gestión de nuestro SGSI, la finalización prevista de la auditoría de Fase 2 de ISO/IEC 27001 en octubre de 2026 y la estimación del registro de certificación alrededor de diciembre de 2026.
