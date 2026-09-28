---
title: "Grift — convertimos las voces dispersas del cliente en especificaciones para el equipo de desarrollo"
description: "Presentamos Grift, nuestro producto propio que estructura con IA las peticiones sin forma definida y las traduce en requisitos, presupuestos y paquetes de trabajo."
category: "grift"
tags: ["Grift", "IA", "definición de requisitos", "desarrollo a medida"]
publishedAt: 2026-06-30
summary: "En el desarrollo a medida, el fundamento de un presupuesto tiende a depender de la persona que lo elabora. Grift es un producto de IA que construye presupuestos de referencia explicables a partir del historial de proyectos y las tarifas del mercado, y estructura las peticiones dispersas en requisitos, presupuestos y paquetes de trabajo."
isDraft: false
featured: true
lang: "es"
translationSourceHash: "3520564b3040fbb4162ae1d2e5348686126a9493aef5807d32907bf016ad34ee"
translatedAt: "2026-09-28T06:09:16.042Z"
translationModel: "adopted-legacy"
---

## Desafío

En el desarrollo a medida, lo habitual es que a la entrada de un proyecto nadie haya puesto en palabras «lo que el cliente realmente quiere». Las peticiones aparecen fragmentadas en formularios de contacto, chats y actas de reunión, y el equipo de desarrollo tiene que descifrarlas a mano y traducirlas en requisitos. En esa «primera puesta en orden» se disolvía muchísimo tiempo.

Había además un segundo problema que nosotros mismos vivíamos en primera persona: el fundamento del presupuesto. Ante proyectos parecidos, la forma de calcular el importe podía variar según la experiencia o la intuición de quien lo preparaba, y a veces no lográbamos explicar del todo, ni al cliente ni al equipo, por qué salía esa cifra. Un presupuesto que depende de una persona se convierte en una caja negra en cuanto esa persona veterana deja el equipo. Grift nació del intento de resolver ambos problemas a la vez.

## Enfoque

En lugar de trabajar con el texto sin forma tal cual, diseñamos un proceso en el que la IA recorre las etapas de «descomponer la intención, completar la información que falta y estructurar el resultado». La persona mantiene la decisión final y la IA se encarga del ordenamiento mecánico, con el objetivo de reducir omisiones y retrabajos.

Con los presupuestos tampoco dejamos que la IA emitiera un importe sin más. La idea de diseño es partir de materiales como el historial de proyectos y las tarifas del mercado para construir un presupuesto de referencia en el que una persona pueda explicar «por qué sale esta cifra». No se trata de delegarlo todo en la IA: mantenemos la línea de que la decisión final y la responsabilidad de explicarla son humanas.

## Implementación

La IA analiza el texto original recibido y lo descompone en unidades de solicitud de cambio. La información que falta se plantea como preguntas adicionales y, cuando las respuestas están completas, se puntúa el grado de completitud. Las peticiones suficientemente definidas se convierten en requisitos, presupuestos y paquetes de trabajo, en un formato con el que el equipo de desarrollo puede ponerse a trabajar directamente.

Al generar el presupuesto, contrastamos los requisitos ya estructurados con materiales como el historial de proyectos y la percepción de tarifas del mercado, y lo presentamos como un presupuesto de referencia acompañado de su fundamento. Lo que más cuidamos en este producto es que el equipo pueda revisar no solo el importe, sino también «en qué se basa esa cifra». Ahora mismo seguimos validándolo como Team Beta en proyectos reales, internos y externos; sobre Grift en sí también hablamos en [griftai.org](https://griftai.org).

## Resultados

El «ordenar para poder ordenar» que se producía a la entrada de cada proyecto se ha comprimido, y el equipo de desarrollo puede dedicar más tiempo a revisar los requisitos y a decidir la implementación. En la relación con el cliente, ver con claridad qué está decidido y qué queda pendiente reduce los malentendidos.

Al poder expresar en palabras el fundamento del presupuesto, decisiones que antes dependían de una sola persona empiezan a compartirse y a transmitirse dentro del equipo. Grift sigue siendo un producto en validación, pero la idea de «un presupuesto que no se delega por completo en la IA» es exactamente el reto al que nos enfrentamos cada día en nuestros proyectos a medida. Queremos hacerlo crecer primero en nuestro propio terreno y llevarlo fuera cuando podamos contarlo con la confianza que da la experiencia.
