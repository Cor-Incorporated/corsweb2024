---
title: "Hay preguntas que empeoran al añadir ejemplos. Cómo probar la IA generativa, verificado con un LLM pequeño"
description: "El 29 de octubre de 2026, en un taller interno de una empresa impartido por nuestro representante Kousuke Terada, probamos dos técnicas con un modelo de lenguaje pequeño (Qwen2.5-3B-Instruct): «añadir ejemplos» y «pedir una revisión». A partir de preguntas que mejoraron, preguntas que empeoraron y preguntas en las que afirmó con rotundidad que un error era correcto, explicamos cómo comparar al probar la IA generativa en el trabajo."
summary: "Al realizar pruebas con un modelo de lenguaje pequeño, hubo preguntas que se respondieron correctamente al añadir ejemplos y otras que, por el contrario, resultaron en respuestas erróneas. Al solicitar una revisión, en ocasiones afirmó con rotundidad que una respuesta incorrecta era «sin correcciones». Al probar la IA generativa, determine primero la respuesta correcta, cambie solo un elemento a la vez, repita las mismas preguntas varias veces y registre tanto los casos en los que mejoró como aquellos en los que empeoró."
pubDate: 2026-10-30
author: "Terisuke"
category: "ai"
tags: ["生成AI", "ローカルLLM", "プロンプト", "AI導入", "勉強会"]
image:
  url: "/images/blog/llm-archaeology-few-shot-self-check.avif"
  alt: "Diagrama en el que unos puntos conectados por líneas delgadas se dividen en dos caminos, con una marca de verificación azul en uno y una cruz en el otro"
lang: "es"
featured: false
isDraft: false
translationSourceHash: "aab0a9e0fbfbd2911455d3c19e618f486edee679c6b94088a367d6987314057b"
translatedAt: "2026-10-30T03:04:15.855Z"
translationModel: "gemini-3.8-flash"
---

A menudo se dice que la IA generativa «aumenta su precisión si se añaden ejemplos» o que «reduce sus errores si se le pide que revise». ¿No habrá adoptado estas técnicas en el uso interno de su empresa sin haber comprobado antes su eficacia?

El 29 de octubre de 2026, en un taller interno de una empresa impartido por nuestro representante Kousuke Terada, probamos estas dos técnicas en un modelo de lenguaje pequeño. Mientras que algunas preguntas se respondieron correctamente al añadir ejemplos, en otras la misma técnica provocó errores. En una pregunta, al pedirle que revisara, afirmó con total seguridad que una respuesta incorrecta no requería «ninguna corrección». En este artículo explicamos los resultados obtenidos y cómo comparar alternativas al probar la IA generativa en el trabajo diario.

## Qué está ocurriendo

El taller fue la última de tres sesiones y se llevó a cabo en línea durante 90 minutos. Cada participante utilizó su propio PC para probar el mismo modelo con la misma configuración. Los resultados descritos aquí son los comprobados en el PC del instructor.

- Modelo: Qwen2.5-3B-Instruct (Q4_K_M, aprox. 2,1 GB)
- Aplicación: LM Studio
- Configuración: Context 4096, Temperature 0 (un ajuste que facilita obtener la misma respuesta en cada ocasión), max tokens 1024

Las IA de chat actuales responden de forma convincente sin necesidad de técnicas especiales. Los modelos antiguos eran limitados y las personas recurrían a ajustar las entradas para compensarlo. Esas técnicas se incorporaron en los modelos y en sus sistemas, dando lugar a las IA de chat actuales. En el taller, recorrimos esta evolución utilizando un modelo pequeño. Fue un enfoque inspirado en la «arqueología experimental», donde se fabrican y utilizan herramientas antiguas.

### Al añadir ejemplos, algunas preguntas empeoraron

La primera técnica consiste en mostrar previamente dos ejemplos de cómo responder (Few-shot). Comparamos las mismas preguntas cambiando únicamente si se incluían ejemplos o no.

El cálculo del cambio consistía en un problema de comprar 3 manzanas a 120 yenes cada una y 4 mandarinas a 80 yenes cada una, pagando con un billete de 1000 yenes. Sin ejemplos respondió correctamente 320 yenes, pero al añadir ejemplos respondió 680 yenes. Los 680 yenes correspondían al importe total de la compra, confundiéndolo con el cambio. En una pregunta para extraer el nombre, la fecha, la hora y el número de personas de un texto de reserva, en la versión con ejemplos quedó el «(jueves)» del texto original en el campo de la fecha.

Por otro lado, en una pregunta sobre quién de entre tres personas era el más lento, sin ejemplos respondió erróneamente C, mientras que al añadir ejemplos respondió correctamente B. La misma técnica puede mejorar o empeorar el resultado según la pregunta.

### Al pedirle que revisara, afirmó con seguridad que el error era «sin corrección»

La segunda técnica consiste en pedirle que revise en la misma conversación después de haber respondido (autoverificación). En una pregunta para ordenar cinco palabras en orden alfabético japonés (gojūon), afirmó con seguridad «sin corrección» manteniendo el orden incorrecto. En la pregunta sobre la velocidad de tres personas, aunque durante la revisión escribió el orden correcto de las tres personas, la respuesta final siguió siendo C.

### Incluso con la misma configuración, las respuestas variaron

A pesar de fijar la temperatura en 0, las respuestas tras la revisión no fueron uniformes. Al probar 8 veces la revisión de la pregunta sobre la velocidad de las tres personas en el PC del instructor, la respuesta correcta B solo se obtuvo en una ocasión.

Los resultados mostrados hasta aquí son el registro de tan solo cinco preguntas probadas en el único PC del instructor con un modelo pequeño de 3B. No se ha comprobado si se obtendrían los mismos resultados con las grandes IA de chat actuales.

## Tropiezos comunes

Lo ocurrido con el modelo pequeño guarda relación con los tropiezos que surgen al probar la IA generativa en las operaciones de la empresa.

### Tomar una respuesta fluida como prueba de que es correcta

Cuando una respuesta es rápida y el texto está bien estructurado, parece correcta. En el taller, no tomamos como prueba ni las explicaciones fluidas ni respuestas como «lo he comprobado», sino que contrastamos únicamente la respuesta final con la solución correcta.

### Cambiar demasiadas cosas a la vez

Si se añaden ejemplos, se cambia la redacción y también se sustituye el modelo, no se sabrá qué modificación alteró el resultado. En el taller, se cambió únicamente un elemento cada vez y se inició una conversación nueva para cada condición. Solo la revisión se solicitó de forma continua dentro de la misma conversación.

### Decidir basándose en un único resultado

Como en la pregunta de la velocidad de las tres personas, existen casos en los que las respuestas varían incluso con la misma configuración. El hecho de que haya funcionado bien una vez, o de que haya fallado una vez, no constituye por sí solo material suficiente para juzgar.

### Guardar únicamente los ejemplos que mejoraron

Al probar una técnica, se tiende a recordar solo los resultados que mejoraron. Sin embargo, como en el cálculo del cambio, una respuesta que era correcta puede convertirse en errónea a causa de una técnica introducida.

## Cómo avanzar

Al probar la IA generativa en el entorno laboral, avanzar en el siguiente orden facilita explicar lo aprendido:

1. Elegir varias preguntas que realmente se deseen encargar en el trabajo y definir de antemano la respuesta correcta o los criterios de aprobación
2. Cambiar únicamente una condición y comparar el antes y el después
3. Repetir la misma pregunta varias veces
4. Registrar los resultados en cuatro aspectos: contenido (si es correcto), formato (si se redactó según lo solicitado), completitud (si se escribió hasta el final) y tiempo; y conservar tanto los casos que mejoraron como los que empeoraron
5. Dejar que una persona decida, a la vista de los registros, si se utiliza y en qué tareas se aplica

Consideramos que este método de comparación puede utilizarse de la misma manera incluso con modelos de mayor tamaño.

En Cor.Inc. brindamos apoyo para la adopción y la capacitación en IA generativa y LLM locales. Como parte de ello, podemos ayudar a estructurar juntos la selección de preguntas adaptadas a su negocio y la forma de registrarlas. Para la consulta inicial, no es necesario enviar datos reales de sus operaciones, documentos confidenciales ni credenciales de autenticación.

## Conclusión

Al final del taller, repasamos la evolución posterior de estas dos técnicas. La técnica de mostrar ejemplos evolucionó hacia el entrenamiento de modelos para seguir instrucciones. La técnica de pedir una revisión evolucionó hacia modelos que razonan antes de responder y hacia sistemas para verificar las respuestas. Concluimos comentando que ambas se encuentran integradas en las IA de chat actuales. Aun así, responder con fluidez y responder con exactitud son cosas distintas.

Hay preguntas que mejoran con ejemplos o revisiones, y otras que empeoran. Al probar una técnica, defina la respuesta correcta de antemano, cambie solo un elemento a la vez, repita la prueba varias veces y registre tanto los casos que mejoraron como los que empeoraron. La decisión de utilizarla o no debe tomarla una persona examinando ese registro.

## Materiales de referencia

- [Qwen2.5-3B-Instruct-GGUF (Qwen, Hugging Face)](https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF)
- [LM Studio Docs](https://lmstudio.ai/docs/app)
- [Brown et al., "Language Models are Few-Shot Learners" (2020, arXiv:2005.14165)](https://arxiv.org/abs/2005.14165)
- [Ouyang et al., "Training language models to follow instructions with human feedback" (2022, arXiv:2203.02155)](https://arxiv.org/abs/2203.02155)
- [Huang et al., "Large Language Models Cannot Self-Correct Reasoning Yet" (2023, arXiv:2310.01798)](https://arxiv.org/abs/2310.01798)
