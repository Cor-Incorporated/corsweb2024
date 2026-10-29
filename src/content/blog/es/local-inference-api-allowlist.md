---
title: "Antes de usar una API de inferencia local en la empresa: diseño de autenticación, lista de permitidos y baja de equipos"
description: "Antes de usar una API de inferencia local en la empresa, hay que diseñar por separado la autenticación, la lista de permitidos y la baja de equipos. La lista de permitidos indica con quién puede pasar el tráfico. Quién puede usarla para qué trabajo se decide aparte."
summary: "La documentación oficial de Ollama dice que la API de localhost no exige autenticación. La lista de permitidos muestra con quién puede pasar el tráfico. Eso solo no decide quién puede usarla para qué trabajo. Responder a vulnerabilidades y gestionar los permisos no son cosas que se resuelvan con una sola de las dos."
pubDate: 2026-10-28
updatedDate: 2026-10-29
author: "Terisuke"
category: "ai"
ctaIntent: "confidential-ai-assessment"
tags: ["ローカルLLM", "Ollama", "情報セキュリティ", "ISMS"]
lang: "es"
featured: false
isDraft: false
translationSourceHash: "1cfc6850c3470817cd6d66514c2be11bd1793eeda737c01c8f5359034ae4d502"
translatedAt: "2026-10-29T05:20:00.000Z"
translationModel: "manual-i18n-sync"
---

Hola, soy Terada, de Cor.Inc. Hoy el tema es sencillo. Si se ejecuta IA local dentro de la empresa, es algo que conviene decidir antes.

## Pensada para usarse en el equipo de delante

Muchas herramientas que ejecutan inferencia en local parten de que se usan primero en el equipo que se tiene delante.

La documentación oficial de Ollama dice, por ejemplo, que la API local en localhost no exige autenticación. También dice que, por defecto, escucha en 127.0.0.1 y que la dirección de escucha se puede cambiar en la configuración.

Esto es más una premisa de diseño que un defecto. Para usarla en el equipo de delante, esa premisa basta. El problema aparece cuando esa premisa se lleva tal cual a la red de la empresa.

Llamar a una API local y que todo el proceso termine en ese equipo no es lo mismo. Según el modelo elegido, hay configuraciones que envían tráfico al exterior. Hay que comprobar también el modelo elegido y el tráfico saliente.

## La palabra «interno»

Al levantar un servidor de inferencia para uso interno, se amplía la escucha para que otros equipos puedan usarlo. Un cortafuegos decide desde qué equipos se puede llegar. Hasta aquí es un procedimiento ordinario.

Lo que hay que cuidar es lo que viene después.

Una escucha abierta a modo de prueba se queda abierta. Un permiso añadido de forma temporal se queda. El permiso de un equipo que ya no se usa desaparece del registro, pero sigue en el cortafuegos.

En una API sin autenticación, «se puede llegar» casi significa «se puede usar». Por eso, que un equipo no previsto pueda seguir llegando es en sí un riesgo. Las palabras «solo interno» significan algo cuando van acompañadas de la configuración real de permisos.

## Qué dice una lista de permitidos

Una lista de permitidos dice con quién puede pasar el tráfico. Eso solo no decide quién puede usarla para qué trabajo. Si la usan varias personas, la autenticación previa, los permisos por usuario o servicio y el comportamiento al revocar son puntos que hay que diseñar aparte. Esto no es un informe de que Cor.Inc. haya terminado de implementarlos.

## Respuesta a vulnerabilidades y permisos

Responder a vulnerabilidades y gestionar los permisos no son cosas que se resuelvan con una sola de las dos. Además de seguir los avisos de actualización, hay que seguir comprobando qué equipo puede conectarse, para qué uso y hasta cuándo.

La información de vulnerabilidades (CVE) sale junta un día. El desajuste de los permisos se acumula un poco cada día. Lo segundo es difícil de notar sin un procedimiento. Los dos van dentro del procedimiento.

## Orden de alta

Cuando un equipo nuevo va a usar la API de inferencia, Cor.Inc. usa este orden en el alta.

1. Registrar el equipo en el registro (uso, responsable, fecha límite)
2. Comprobar la configuración básica del equipo
3. Añadirlo a los permitidos del cortafuegos
4. Confirmar que se puede llegar y dejar la fecha en el registro

Primero el registro y después el permiso. Si solo entra el permiso, después no se puede seguir de quién era ni para qué.

## Orden de baja

Al retirar un equipo, el orden se invierte.

1. Quitarlo de los permitidos del cortafuegos
2. Confirmar que ya no se puede llegar
3. Limpiar credenciales y ajustes en el equipo
4. Marcar el registro como «baja» y dejar la fecha. No se borra la fila; se conserva como historial

El permiso se quita primero. Actualizar solo el registro y dejar el permiso es el desajuste que más fácil aparece.

Si se sospecha una intrusión, eso es distinto de los pasos de baja anteriores. Primero el aislamiento y la revocación de credenciales. Un equipo sospechoso no se trata con el orden ordinario de retirada.

## Qué comprobar

No es un caso aislado: se resume de forma que otras empresas también puedan usarlo. Aquí no hay valores medidos. El tiempo hasta que una revocación surte efecto se decide como requisito. Un valor medido se escribe solo cuando se ha medido.

- ¿La dirección de escucha de la API de inferencia está limitada al alcance previsto?
- ¿Una escucha ampliada para una prueba se devolvió después de la prueba?
- ¿La lista de permitidos del cortafuegos coincide con el registro de equipos?
- ¿Cada permitido tiene en el registro un uso, un responsable y un plazo?
- En la baja, ¿se sigue el orden «quitar el permiso, confirmar que no se llega, actualizar el registro»?
- ¿Se cotejan la lista de permitidos y el registro con regularidad (por ejemplo cada mes)?
- ¿Queda registro de quién añadió o quitó qué permiso, y cuándo?
- Si una API sin autenticación debe exponerse, ¿el diseño pone autenticación o control de acceso delante?
- Además de que un equipo permitido llegue, ¿un equipo no permitido es rechazado?
- Después de la revocación, ¿se rechaza?
- ¿Qué ocurre cuando se detiene el servicio?
- ¿El modelo elegido y el tráfico saliente están en el alcance previsto?

Si esta lista está en marcha, el desajuste se nota antes. Eso no significa que se encuentre todo desajuste.

## Lo que se mira junto

Cor.Inc. parte del equipo que ya existe y mira junto el alcance que se procesa en local. Dentro del funcionamiento del ISMS, se elige la configuración y se diseña juntos permisos, revocación y registros. El ISMS terminó la auditoría de etapa 2 de ISO/IEC 27001 en octubre de 2026, y el registro de la certificación se prevé hacia diciembre de 2026.

Esta lista de permitidos está en esa conversación de revocación y registros. Poder explicar qué equipo puede llegar y hasta cuándo es también una condición de operación, además del rendimiento de la inferencia. Aquí no se niegan los requisitos de rendimiento.

## Lo que se puede explicar

Oír que no hay autenticación puede inquietar. Eso solo significa que ya se conoce la premisa de la herramienta. Si la premisa está clara, también se ve el alcance que hay que proteger.

De quién es el equipo, desde cuándo y hasta cuándo puede llegar. Poder explicarlo tanto en el registro como en los permisos es lo que Cor.Inc. quiere conservar. La lista de permitidos sola no decide los permisos de quien la usa.

## Referencias

- [Ollama Docs: Authentication](https://docs.ollama.com/api/authentication) - la API local de localhost (puerto 11434) no exige autenticación (comprobado el 27 de octubre de 2026)
- [Ollama Docs: FAQ](https://docs.ollama.com/faq) - el apartado «How can I expose Ollama on my network?». Por defecto escucha en 127.0.0.1 puerto 11434, y la variable de entorno `OLLAMA_HOST` cambia la dirección de escucha (comprobado el 27 de octubre de 2026)
- [Cor.Inc.: Seguridad](https://cor-jp.com/security/) - que se opera un ISMS, que la auditoría de etapa 2 de ISO/IEC 27001 terminó en octubre de 2026 y que el registro de la certificación se prevé hacia diciembre de 2026
