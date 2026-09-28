---
title: "Guía Completa de Markdown: Todo para la Creación de Artículos de Blog"
description: "Una guía completa de la sintaxis de Markdown y las funciones de contenido enriquecido disponibles para su uso en el blog de Cor.inc. Cubre todas las funciones para crear artículos atractivos, incluyendo tarjetas de enlace, fórmulas matemáticas y resaltado de código."
pubDate: 2025-01-21
author: "Terisuke"
category: "lab"
tags: ["Markdown", "ブログ", "執筆", "技術文書", "ガイド"]
lang: "es"
featured: true
translationSourceHash: "dbecd1e75a0534d9b057e76963572d2d50d8a1ffc53ee3eb506947308821ccd1"
translatedAt: "2026-09-28T06:09:16.023Z"
translationModel: "adopted-legacy"
---

# Guía Completa de Markdown: Todo para Crear Artículos de Blog

Esta guía presenta todas las sintaxis de Markdown y las funciones de contenido enriquecido disponibles en el blog de Cor.inc. Hemos incluido hasta el último detalle para crear artículos hermosos y fáciles de leer. Tu camino hacia el dominio de Markdown comienza aquí.

## Sintaxis Básica de Markdown

### Encabezados

```markdown
# Encabezado 1 (H1)
## Encabezado 2 (H2)
### Encabezado 3 (H3)
#### Encabezado 4 (H4)
```

### Formato de Texto

```markdown
**Texto en negrita**
*Texto en cursiva*
~~Texto tachado~~
`Código en línea`
```

**Texto en negrita**
*Texto en cursiva*
~~Texto tachado~~
`Código en línea`

### Listas

#### Lista Desordenada

```markdown
- Elemento 1
- Elemento 2
  - Sub-elemento 2.1
  - Sub-elemento 2.2
- Elemento 3
```

- Elemento 1
- Elemento 2
  - Sub-elemento 2.1
  - Sub-elemento 2.2
- Elemento 3

#### Lista Ordenada

```markdown
1. Primer elemento
2. Segundo elemento
3. Tercer elemento
```

1. Primer elemento
2. Segundo elemento
3. Tercer elemento

#### Lista de Tareas

```markdown
- [x] Tarea completada
- [ ] Tarea incompleta
- [ ] Otra tarea incompleta
```

- [x] Tarea completada
- [ ] Tarea incompleta
- [ ] Otra tarea incompleta

## Bloques de Código

### Bloque de Código Básico

```markdown
\`\`\`javascript
function greet(name) {
  console.log(`Hello, ${name}!`);
}

greet('World');
\`\`\`
```

### Ejemplo de Visualización Real

```javascript
function greet(name) {
  console.log(`Hello, ${name}!`);
}

greet('World');
```

### Lenguajes Soportados

- JavaScript/TypeScript
- Python
- HTML/CSS
- Bash/Shell
- JSON/YAML
- Markdown
- Y muchos más

```python
# Ejemplo de Python
def calculate_fibonacci(n):
    if n <= 1:
        return n
    return calculate_fibonacci(n-1) + calculate_fibonacci(n-2)

print(calculate_fibonacci(10))
```

```bash
# Ejemplo de Bash
#!/bin/bash
npm run build
npm run deploy
```

## Tablas

```markdown
| Artículo | Descripción | Precio |
|----------|-------------|--------|
| Producto A | Producto de alta calidad | ¥1,000 |
| Producto B | Precio asequible | ¥500 |
| Producto C | Premium | ¥2,000 |
```

| Artículo | Descripción | Precio |
|----------|-------------|--------|
| Producto A | Producto de alta calidad | ¥1,000 |
| Producto B | Precio asequible | ¥500 |
| Producto C | Premium | ¥2,000 |

### Alineación de Tabla

```markdown
| Alineado a la izquierda | Centrado | Alineado a la derecha |
|:-----------------------|:--------:|-----------------------:|
| Izquierda | Centro | Derecha |
| I | C | D |
```

| Alineado a la izquierda | Centrado | Alineado a la derecha |
|:-----------------------|:--------:|-----------------------:|
| Izquierda | Centro | Derecha |
| I | C | D |

## Citas

```markdown
> Esta es una cita.
> Puede extenderse
> a través de múltiples líneas.

> **Cita importante**
> 
> También puedes usar **sintaxis de Markdown** dentro de las citas.
```

> Esta es una cita.
> Puede extenderse
> a través de múltiples líneas.

> **Cita importante**
> 
> También puedes usar **sintaxis de Markdown** dentro de las citas.

## Enlaces e Imágenes

### Enlaces Básicos

```markdown
[Sitio oficial de Cor.inc](https://cor-jp.com)
[Contacto](/contact)
```

[Sitio oficial de Cor.inc](https://cor-jp.com)
[Contacto](/contact)

### Imágenes

```markdown
![Texto alternativo](/images/example.jpg)
![Texto descriptivo](/images/example.jpg "Título")
```

## Fórmulas Matemáticas (KaTeX)

### Fórmulas en Línea

```markdown
El área de un círculo se calcula con $A = \pi r^2$.
```

El área de un círculo se calcula con $A = \pi r^2$.

### Fórmulas en Bloque

```markdown
$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$
```

$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$

### Ejemplo de Fórmula Compleja

```markdown
$$
\begin{aligned}
\nabla \times \vec{\mathbf{B}} -\, \frac1c\, \frac{\partial\vec{\mathbf{E}}}{\partial t} &= \frac{4\pi}{c}\vec{\mathbf{j}} \\
\nabla \cdot \vec{\mathbf{E}} &= 4 \pi \rho \\
\nabla \times \vec{\mathbf{E}}\, +\, \frac1c\, \frac{\partial\vec{\mathbf{B}}}{\partial t} &= \vec{\mathbf{0}} \\
\nabla \cdot \vec{\mathbf{B}} &= 0
\end{aligned}
$$
```

$$
\begin{aligned}
\nabla \times \vec{\mathbf{B}} -\, \frac1c\, \frac{\partial\vec{\mathbf{E}}}{\partial t} &= \frac{4\pi}{c}\vec{\mathbf{j}} \\
\nabla \cdot \vec{\mathbf{E}} &= 4 \pi \rho \\
\nabla \times \vec{\mathbf{E}}\, +\, \frac1c\, \frac{\partial\vec{\mathbf{B}}}{\partial t} &= \vec{\mathbf{0}} \\
\nabla \cdot \vec{\mathbf{B}} &= 0
\end{aligned}
$$

## Tarjetas de Enlace Enriquecidas

### Cómo Usarlas

Simplemente escribe la URL en una línea separada y se generará automáticamente una tarjeta de vista previa enriquecida. Parece magia, pero en realidad es obra de remark-link-card-plus:

```markdown
https://cor-jp.com/

https://github.com

https://docs.astro.build
```

### Ejemplo de Visualización

https://cor-jp.com/

https://github.com

https://docs.astro.build

### Características

- **Captura automática de metadatos**: Obtiene automáticamente título, descripción y favicon.
- **Visualización de imagen OG**: Muestra la imagen miniatura del sitio web.
- **Función de caché**: La información obtenida se almacena en caché localmente.
- **Responsivo**: Compatible con escritorio y móvil.
- **Modo oscuro**: Ajuste automático según el tema.

## Línea Horizontal

```markdown
---
```

---

## Caracteres de Escape

Los caracteres que no quieres que se interpreten como sintaxis de Markdown deben escaparse con una barra invertida. Si no sabes esto, te arrepentirás cuando aparezca una visualización inesperada:

```markdown
\*Esto no se convertirá en cursiva\*
\`Esto no se convertirá en código\`
\# Esto no se convertirá en encabezado
```

\*Esto no se convertirá en cursiva\*
\`Esto no se convertirá en código\`
\# Esto no se convertirá en encabezado

## Front Matter

Al principio del artículo, debes escribir el front matter para configurar los metadatos. Si olvidas esto, Astro arrojará un error y se enfadará:

```yaml
---
title: "Título del Artículo"
description: "Descripción del artículo"
pubDate: 2025-01-21
author: "Terisuke"
category: "lab"
tags: ["tag1", "tag2", "tag3"]
# image:
#   url: "/images/blog/example.avif"
#   alt: "Descripción de la imagen"
lang: "ja"
featured: true
---
```

### Lista de Categorías

- `ai-driven-futures`: Futuros impulsados por IA
- `high-performance-engineering`: Ingeniería de alto rendimiento
- `founders-journey`: Viaje del fundador
- `tech-lab-creativity`: Creatividad del laboratorio tecnológico

## Mejores Prácticas

### 1. Encabezados Estructurados

```markdown
# Título Principal (H1 se genera automáticamente)

## Sección Grande (H2)

### Subsección (H3)

#### Elemento Detallado (H4)
```

### 2. Código Legible

- Especifica el lenguaje apropiado para los bloques de código (el resaltado de sintaxis es amable con los ojos del lector).
- Divide el código largo en unidades lógicas (nadie quiere leer 100 líneas de código de una vez).
- Agrega comentarios para explicaciones (es una carta para tu yo futuro).

### 3. Tarjetas de Enlace Efectivas

- Convierte solo URLs relevantes en tarjetas de enlace.
- Crea una sección de enlaces de referencia al final del artículo.
- Elige fuentes confiables para los enlaces externos.

### 4. Elementos Visuales

- Utiliza tablas para organizar la información.
- Resalta los puntos importantes con citas.
- Usa líneas horizontales para separar secciones.

## Solución de Problemas

### Problemas Comunes

1. **Las tarjetas de enlace no se muestran**
   - Asegúrate de que la URL esté en una línea separada.
   - Confirma que comienza con HTTPS.
   - Verifica que el sitio web sea accesible.

2. **Las fórmulas matemáticas no se muestran**
   - Asegúrate de que no haya espacios antes o después de los símbolos `$`.
   - Verifica el escape de caracteres especiales.

3. **El resaltado de código no funciona**
   - Verifica si hay errores de ortografía en el nombre del lenguaje.
   - Confirma el número de comillas invertidas (`).

## Conclusión

Utilizando las funciones presentadas en esta guía, puedes crear artículos de blog hermosos y fáciles de leer. La función de tarjeta de enlace, en particular, es una herramienta poderosa que puede presentar material de referencia útil para los lectores de una manera visualmente atractiva. Ver aparecer una tarjeta solo por escribir una URL te hace sentir como un mago.

Utiliza la siguiente lista de verificación al crear artículos:

- [ ] El front matter está configurado correctamente (para no enfadar a Astro).
- [ ] La estructura de encabezados es lógica (para que los lectores no se pierdan).
- [ ] Los bloques de código tienen la especificación de lenguaje correcta (para un resaltado hermoso).
- [ ] Las tarjetas de enlace se muestran correctamente (para que se vean bien).
- [ ] Las fórmulas matemáticas se muestran correctamente (para satisfacer a los matemáticos).
- [ ] Se ha configurado el atributo alt para las imágenes (la accesibilidad es importante).

---

*Si tienes alguna pregunta sobre esta guía, no dudes en ponerte en contacto a través de [Contacto](/contact). Sigamos juntos el camino hacia el dominio de Markdown.*
