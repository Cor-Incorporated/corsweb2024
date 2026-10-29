---
title: "Dónde separar la IA de campo y la IA de documentos internos. La decisión de diseño de Cor.Inc."
description: "La IA de campo que funciona junto a cámaras y sensores, y un LLM local que trata documentos internos, cuidan condiciones distintas. La política de Cor.Inc. es separar los entornos de verificación. Separarlos no es en sí una prueba de seguridad."
summary: "La IA de campo y la IA de documentos internos pueden configurarse para limitar el envío al exterior. Eso solo no las reúne en el mismo entorno. La política de Cor.Inc. es mantener el entorno de verificación de la inferencia física apartado del entorno que trata documentos internos. Es una decisión de diseño para explicar el alcance de la conexión y el efecto, no una prueba de seguridad."
pubDate: 2026-10-28
updatedDate: 2026-10-29
author: "Terisuke"
category: "ai"
ctaIntent: "local-llm-poc"
tags: ["ローカルLLM", "エッジAI", "セキュアAI", "設計"]
lang: "es"
featured: false
isDraft: false
translationSourceHash: "d0513b1cfbfaeca13818fefd287ed9de99c213dc2ce077385996d97ce4a8a716"
translatedAt: "2026-10-29T05:20:00.000Z"
translationModel: "manual-i18n-sync"
---

Hola, soy Terada, de Cor.Inc.

¿Dónde se separan la IA de campo y la IA de documentos internos? En las conversaciones sobre IA local, a veces se hablan las dos como si fueran una.

Una es la IA que funciona junto a cámaras y sensores. La otra es un LLM local que trata documentos internos y datos de trabajo.

Las dos pueden configurarse para limitar el envío a una nube externa. Eso solo no significa que puedan ir en el mismo entorno. En Cor.Inc. miramos por separado a qué se conecta cada una, qué trata y hasta dónde llega el efecto si algo falla.

## Condiciones que importan

En la IA de campo miramos el tiempo desde que llega una entrada hasta que se devuelve un juicio, y qué ocurre si se corta la comunicación. En usos que mueven una máquina, poder pasar al lado seguro cuando hay una anomalía también es imprescindible. Que no se detenga no es la única respuesta correcta.

Lo que se mira junto en el campo es no detenerse (disponibilidad), no llegar tarde (tiempo real) y poder detenerse con seguridad cuando es peligroso.

En la IA que trata documentos internos, quién puede consultar qué documento es una cuestión grande. ¿Se puede quitar un permiso cuando cambia el responsable? ¿El permiso quitado se refleja también en la búsqueda y en las respuestas? ¿Se puede comprobar después una operación necesaria?

La IA de campo también necesita gestión de permisos. Un LLM interno también necesita tiempo de respuesta y un funcionamiento estable. El lugar que el diseño vigila con más cuidado es distinto.

## Límite de confianza

Estar en el mismo clúster no es una conclusión sobre si algo es peligroso. Que el equipo sea distinto tampoco es una prueba de que sea seguro.

Incluso sobre la misma base, un límite se puede diseñar con separación de red, autenticación y autorización, y aislamiento de cargas. El zero trust del NIST es la idea de no confiar solo en un lugar físico o en una posición en la red.

Si el equipo de campo entra sin condiciones en un único clúster, el límite se vuelve vago. Si se comparten derechos de acceso, credenciales y rutas de gestión sin comprobar el motivo, crece el alcance del efecto. Un equipo colocado en el campo podría llegar cerca de los documentos internos.

En un diagrama es una línea fina. En la operación es una diferencia grande.

## Cómo se suman los números

Sumar cantidades de equipos y cifras de velocidad hace que un documento luzca. En Cor.Inc. no sumamos a la cantidad de un sistema el equipo que está funcionando para otro uso. Tampoco juntamos mediciones hechas en condiciones distintas. Dejamos claro qué midió cada número. Esta es nuestra regla de totales. Las intenciones de otras personas no se escriben aquí.

Si el límite es vago, lo siguiente no se puede explicar. Cuando se detiene este equipo de borde, ¿qué usos del LLM interno se ven afectados? Si se detiene la cuenta de este equipo, ¿hasta dónde llega la parada?

## La política de ahora

Lo que Cor.Inc. elige ahora es esta separación. Es una política. No significa que estar separado lo haga seguro.

- La inferencia física en el borde se diseña solo para el borde
- No se coloca en el clúster principal del LLM local interno
- En las explicaciones hacia fuera, los equipos de borde no se mezclan con la configuración o el rendimiento de la línea principal
- Cuando se pasan datos entre ambos, el contenido y la ruta se deciden caso por caso

Hay peticiones de usar en el lado del negocio un resultado salido del borde. Tampoco entonces decimos que se puede leer con libertad porque está en el mismo clúster.

## Un ejemplo para explicar

Pensemos en querer usar en el trabajo interno un resultado de inspección del campo. Es un ejemplo de configuración para explicar. No es una función que Cor.Inc. haya terminado de implementar, ni un caso de cliente.

Si el trabajo puede seguir solo con un identificador de inspección, una hora y un resultado, quizá no haga falta pasar el vídeo entero ni una conexión libre al equipo de campo. Si un uso necesita imágenes, primero se comprueban la necesidad y el alcance.

No decimos que se puede leer porque está en la misma empresa. Decimos que solo se pasa este contenido porque este uso lo necesita. Si al detener el uso se rechaza la conexión, y cómo una parada de un lado afecta al otro, son puntos que hay que comprobar en cada configuración. Este artículo no dice que esa comprobación haya terminado.

## Lo que mostró la simulación

En Cor.Inc. usamos una tarea que mueve el cuerpo, como partir una sandía, como material para verificar la inferencia física. Por ahora es una verificación en simulación. La política es mantener también este entorno de verificación apartado del entorno que trata documentos internos.

Incluso en un experimento, el trato de la información no se deja vago. Lo confirmado en la simulación no se toma como prueba de seguridad o de rendimiento en una máquina real. La seguridad y el rendimiento en una máquina real necesitan una comprobación aparte. Esa parte no está confirmada.

## Rendimiento y operación

La velocidad importa. Si la respuesta no vuelve en el tiempo necesario, no se puede usar en el trabajo. El rendimiento de la inferencia es donde Cor.Inc. pone esfuerzo en investigación y desarrollo. La velocidad cambia mucho según el entorno y el uso.

La velocidad sola no decide si se puede usar en el trabajo. Aunque la respuesta sea rápida, hay un problema si aparece un documento que no se debe ver, si el uso no se puede detener o si la respuesta ante un fallo no está decidida.

Lo que se busca es cumplir los requisitos de rendimiento y, además, comprobar juntos una configuración que se pueda operar con seguridad. No es una garantía de que se pueda operar con seguridad en cualquier entorno.

Poder explicar quién puede usar qué y hasta cuándo. Diseñar juntos el límite, los permisos, la revocación y la seguridad.

Colocarlo en local no lo vuelve seguro de forma automática. Partiendo del equipo existente, pensamos el alcance que se procesa en local y una configuración que encaje con el trabajo.

## Alcance de la responsabilidad

La nube también es un modelo de responsabilidad compartida. Los permisos de acceso y la gestión de los datos siguen siendo responsabilidad de quien los usa. Cómo se reparte cambia según la forma del servicio. Lo que se cita es un ejemplo de la explicación que publica AWS.

Al pasar a local se añade la gestión física y la operación de la base. Las líneas que traza la propia empresa aumentan en esa medida. Dejar un estado en el que esas líneas se puedan explicar una a una es lo que Cor.Inc. considera importante.

## Estado de la auditoría

Cor.Inc. opera un ISMS. En octubre de 2026 terminó la auditoría de etapa 2 de ISO/IEC 27001. El registro de la certificación se prevé hacia diciembre de 2026. El estado de la auditoría y lo que se verificó en cada sistema se cuentan por separado.

## Alcance de la conexión

Separar la IA de campo y la IA de documentos internos no es para dejar de conectarlas. Es para conectar solo lo necesario, de una forma que tenga un motivo.

Quién puede usar qué y hasta cuándo. Qué ocurre si se detiene la conexión. Cuando algo falla, hasta dónde llega el efecto. La política es llevar esa explicación más allá del diagrama, hasta la configuración y los resultados de las comprobaciones. Un punto que aún no tiene resultado de comprobación no se escribe como si lo tuviera.

Si quiere tratar documentos internos y datos de campo con IA, pero no tiene decidido el alcance de la conexión, consulte a partir de un esquema del trabajo y de la configuración actual. El primer contacto no necesita documentos confidenciales ni credenciales.

## Referencias

- [NIST SP 800-207: Zero Trust Architecture](https://csrc.nist.gov/pubs/sp/800/207/final) - la idea de no tratar una posición en la red como confianza implícita (el resumen se comprobó el 29 de octubre de 2026)
- [AWS: Shared Responsibility Model](https://aws.amazon.com/compliance/shared-responsibility-model/) - un ejemplo de cómo se reparte la responsabilidad en la nube. El reparto cambia según la forma del servicio (comprobado el 29 de octubre de 2026)
- [Cor.Inc.: Seguridad](https://cor-jp.com/security/) - que se opera un ISMS, que la auditoría de etapa 2 de ISO/IEC 27001 terminó en octubre de 2026 y que el registro de la certificación se prevé hacia diciembre de 2026
