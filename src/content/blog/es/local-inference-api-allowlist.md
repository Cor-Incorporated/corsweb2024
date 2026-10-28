---
title: "Lo que una empresa debe proteger en un mundo donde las API locales carecen de autenticación: sobre la gestión de listas de permitidos"
description: "Muchas de las herramientas que ejecutan inferencia localmente están diseñadas bajo el supuesto de un uso individual. Por ejemplo, la API en localhost de Ollama no requiere autenticación. Kousuke Terada, CEO de la empresa, aborda las discrepancias en las configuraciones de permisos que suelen quedar tras expandirse a la red interna, el orden de admisión y desmantelamiento de terminales, y una lista de verificación generalizada."
summary: "Muchas de las herramientas que ejecutan inferencia localmente están creadas bajo el supuesto de usarse en el propio equipo; por ejemplo, la API en localhost de Ollama no requiere autenticación. En una API sin autenticación, poder alcanzarla significa prácticamente poder usarla, por lo que las discrepancias residuales en la escucha y en los destinos permitidos tras extenderla a la red interna se convierten en un riesgo. Consideramos que, antes de rastrear información sobre vulnerabilidades, es fundamental convertir en procedimientos el orden de admisión y desmantelamiento de terminales. En la admisión, se debe priorizar el registro en el inventario; en el desmantelamiento, la eliminación de los permisos debe ir primero."
pubDate: 2026-10-28
author: "Terisuke"
category: "ai"
ctaIntent: "confidential-ai-assessment"
tags: ["ローカルLLM", "Ollama", "情報セキュリティ", "ISMS"]
lang: "es"
featured: false
isDraft: false
translationSourceHash: "8378f2b839ed91057711bc8a65de4ef18e4426757c35c9541be542e7b342702c"
translatedAt: "2026-10-27T13:41:54.677Z"
translationModel: "gemini-3.8-flash"
---

Hola, soy Terada, de Cor.Inc. Hoy traigo un tema un poco discreto. Sin embargo, si va a ejecutar IA local dentro de su empresa, probablemente sea lo que marque la mayor diferencia.

## Las API de inferencia local están diseñadas bajo el supuesto de «usarse en local»

Muchas herramientas para ejecutar inferencia en local parten de la premisa de que, en primer lugar, se utilizarán en la propia máquina del usuario.

Por ejemplo, la documentación oficial de Ollama señala que la API local en localhost no requiere autenticación. También indica que, por defecto, escucha en local (127.0.0.1) y que es posible cambiar la dirección de escucha mediante la configuración.

Más que un fallo, se trata de una premisa de diseño. Porque, para usarlo en local, con eso es suficiente. El problema surge cuando se extiende a la red interna manteniendo este supuesto.

## «Solo interno» no es el nombre de un perímetro

Cuando se levanta un servidor de inferencia para uso interno, se amplía la escucha para que otros dispositivos puedan utilizarlo. En el firewall, se define desde qué terminales se permite el acceso. Hasta aquí, es el procedimiento habitual.

Lo que requiere atención es lo que viene después.

La escucha que se abrió para una prueba se queda así. Las autorizaciones que se añadieron de forma temporal se quedan así. La autorización de un dispositivo que ya no se utiliza desaparece del registro, pero permanece en el firewall.

En una API sin autenticación, que el tráfico «llegue» significa prácticamente que se «puede usar». Por eso, el mero hecho de que persista un estado en el que terminales no previstos puedan conectarse ya constituye un riesgo. La expresión «solo interno» únicamente cobra sentido cuando va acompañada de configuraciones de permisos reales.

## Lo que hay que hacer antes de mirar los CVE

Hacer seguimiento de la información sobre vulnerabilidades (CVE) es importante. Sin embargo, creo que antes de eso hay algo que se debe protocolizar: el orden para dar de alta y de baja los dispositivos.

Las vulnerabilidades aparecen de golpe un día cualquiera. Los desajustes en las autorizaciones se acumulan poco a poco, día tras día. De estos últimos, nadie se da cuenta si no existe un procedimiento.

## El orden para dar de alta

Cuando permitimos que un nuevo dispositivo utilice la API de inferencia, seguimos este orden:

1. Registrar el terminal en el inventario (uso previsto, responsable, fecha límite de uso)
2. Verificar la configuración básica del terminal
3. Añadirlo a la lista de permitidos del firewall
4. Confirmar que tiene conectividad y registrar la fecha de comprobación en el inventario

Primero el inventario, después el permiso. Este orden es fundamental. Si se concede el permiso primero, después no se podrá rastrear de quién es ni para qué se otorgó.

## El orden para dar de baja

Al retirar un dispositivo, se hace en el orden inverso:

1. Eliminarlo de la lista de permitidos del firewall
2. Confirmar que ya no tiene conectividad
3. Limpiar las credenciales y la configuración del terminal
4. Actualizar el inventario al estado de «retirado» y registrar la fecha

Aquí lo crucial es revocar el permiso en primer lugar. Actualizar solo el inventario y dejar el permiso activo es el desajuste que ocurre con más frecuencia.

## Lista de verificación generalizada

Para que no quede solo en un caso particular, lo resumo de forma que otras empresas también puedan aplicarlo:

- ¿Se limita la escucha de la API de inferencia al alcance previsto?
- ¿Se ha restablecido la escucha que se amplió para validaciones una vez finalizadas las pruebas?
- ¿Coincide la lista de permitidos del firewall con el inventario de terminales?
- ¿Constan en el inventario el uso previsto, el responsable y la fecha límite para cada autorización?
- Al dar de baja, ¿se procesa en el orden «revocar permiso → confirmar la falta de conectividad → actualizar inventario»?
- ¿Se realiza periódicamente (por ejemplo, de forma mensual) un cotejo entre la lista de permitidos y el inventario?
- ¿Existen registros de auditoría de quién añadió o eliminó cada permiso y cuándo lo hizo?
- En caso de necesitar exponer una API sin autenticación al exterior, ¿está diseñada para contar previamente con autenticación o control de acceso?

Ninguno de estos puntos es llamativo. Sin embargo, si esta lista se aplica de forma continua, la mayoría de los desajustes se detectan a tiempo.

## Lo que hacemos nosotros

En Cor.Inc. brindamos acompañamiento para soluciones totalmente locales implementadas en los dispositivos existentes de los clientes. Dentro de la operación de nuestro SGSI (ISMS), definimos conjuntamente la selección de la arquitectura y el diseño de privilegios, revocaciones y registros de auditoría. Respecto al SGSI, en octubre de 2026 completamos la auditoría de Fase 2 de la norma ISO/IEC 27001, y prevemos obtener el registro de la certificación hacia diciembre de 2026.

La gestión de listas de permitidos que tratamos hoy se sitúa en el núcleo exacto de esas «revocaciones» y «registros». Consideramos que trazar estas líneas discretas de forma constante aporta más valor que limitarse a comparar velocidades o rendimientos.

## Conclusión

Saber que no hay autenticación puede generar inquietud. No obstante, solo se trata de entender las premisas de la herramienta. Una vez comprendidas, lo que se debe proteger queda claro.

El dispositivo de quién, desde cuándo y hasta cuándo tiene permitido el acceso. El poder justificarlo tanto en el inventario como en la configuración de permisos: eso es exactamente lo que queremos proteger.

## Materiales de referencia

- [Ollama Docs: Authentication](https://docs.ollama.com/api/authentication) - Indicación de que la API local en localhost (puerto 11434) no requiere autenticación (consultado el 27 de octubre de 2026)
- [Ollama Docs: FAQ](https://docs.ollama.com/faq) - Sección «How can I expose Ollama on my network?». Indicación de que por defecto escucha en 127.0.0.1 en el puerto 11434, y que se puede cambiar la dirección de escucha mediante la variable de entorno `OLLAMA_HOST` (consultado el 27 de octubre de 2026)
- [Cor.Inc.: Seguridad](https://cor-jp.com/security/) - Sobre la operación de nuestro SGSI, la finalización de la auditoría de Fase 2 de ISO/IEC 27001 en octubre de 2026 y la previsión del registro de la certificación hacia diciembre de 2026
