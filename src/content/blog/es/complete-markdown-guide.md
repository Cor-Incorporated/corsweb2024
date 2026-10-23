---
title: "Guía completa de Markdown: todo sobre la creación de artículos de blog"
description: "Guía completa de la sintaxis Markdown y las funciones de contenido enriquecido disponibles en el blog de Cor.Inc. Cubre todas las funciones para redactar artículos atractivos, como tarjetas de enlaces, fórmulas matemáticas y resaltado de código."
summary: "Recopilación de la sintaxis Markdown y funciones como tarjetas de enlaces, fórmulas matemáticas y resaltado de código disponibles en el blog de Cor.Inc., con instrucciones de redacción y ejemplos visuales. Al escribir una URL por sí sola, se convierte en una tarjeta de enlace. Al redactar un artículo, verifique el front matter y la estructura de encabezados con la lista de verificación."
pubDate: 2025-01-21
updatedDate: 2026-10-23
author: "Terisuke"
category: "lab"
tags: ["Markdown", "ブログ", "執筆", "技術文書", "ガイド"]
lang: "es"
featured: true
translationSourceHash: "53582241983b96f366bf691edf6d87f76d0530f50e5090d0c45cae32999014c5"
translatedAt: "2026-10-23T06:24:58.780Z"
translationModel: "gemini-3.8-flash"
---

# Guía completa de Markdown: todo sobre la creación de artículos de blog

En esta guía te presentamos toda la sintaxis Markdown y las funciones de contenido enriquecido disponibles en el blog de Cor.Inc. Hemos recopilado al máximo las técnicas necesarias para redactar artículos atractivos y fáciles de leer. Tu camino para dominar Markdown comienza aquí.

## Sintaxis básica de Markdown

### Encabezados

```markdown
# 見出し1 (H1)
## 見出し2 (H2)
### 見出し3 (H3)
#### 見出し4 (H4)
```

### Formato de texto

```markdown
**太字テキスト**
*斜体テキスト*
~~取り消し線~~
`インラインコード`
```

**Texto en negrita**
*Texto en cursiva*
~~Texto tachado~~
`インラインコード`

### Listas

#### Listas no ordenadas

```markdown
- 項目1
- 項目2
  - サブ項目2.1
  - サブ項目2.2
- 項目3
```

- Elemento 1
- Elemento 2
  - Subelemento 2.1
  - Subelemento 2.2
- Elemento 3

#### Listas ordenadas

```markdown
1. 最初の項目
2. 二番目の項目
3. 三番目の項目
```

1. Primer elemento
2. Segundo elemento
3. Tercer elemento

#### Listas de tareas

```markdown
- [x] 完了したタスク
- [ ] 未完了のタスク
- [ ] 別の未完了タスク
```

- [x] Tarea completada
- [ ] Tarea pendiente
- [ ] Otra tarea pendiente

## Bloques de código

### Bloque de código básico

```markdown
\`\`\`javascript
function greet(name) {
  console.log(`Hello, ${name}!`);
}

greet('World');
\`\`\`
```

### Ejemplo de visualización real

```javascript
function greet(name) {
  console.log(`Hello, ${name}!`);
}

greet('World');
```

### Lenguajes compatibles

- JavaScript/TypeScript
- Python
- HTML/CSS
- Bash/Shell
- JSON/YAML
- Markdown
- Muchos otros

```python
# Python例
def calculate_fibonacci(n):
    if n <= 1:
        return n
    return calculate_fibonacci(n-1) + calculate_fibonacci(n-2)

print(calculate_fibonacci(10))
```

```bash
# Bash例
#!/bin/bash
npm run build
npm run deploy
```

## Tablas

```markdown
| 項目 | 説明 | 価格 |
|------|------|------|
| 商品A | 高品質な商品 | ¥1,000 |
| 商品B | お手頃価格 | ¥500 |
| 商品C | プレミアム | ¥2,000 |
```

| Elemento | Descripción | Precio |
|------|------|------|
| Producto A | Producto de alta calidad | ¥1,000 |
| Producto B | Precio asequible | ¥500 |
| Producto C | Prémium | ¥2,000 |

### Alineación de tablas

```markdown
| 左寄せ | 中央揃え | 右寄せ |
|:-------|:--------:|-------:|
| Left | Center | Right |
| L | C | R |
```

| Izquierda | Centro | Derecha |
|:-------|:--------:|-------:|
| Left | Center | Right |
| L | C | R |

## Citas

```markdown
> これは引用文です。
> 複数行にわたって
> 引用することができます。

> **重要な引用**
> 
> 引用の中で**マークダウン記法**も使用できます。
```

> Esto es una cita.
> Puede abarcar
> múltiples líneas.

> **Cita importante**
> 
> Dentro de una cita también se puede utilizar la **sintaxis Markdown**.

## Enlaces e imágenes

### Enlaces básicos

```markdown
[Cor.inc公式サイト](https://cor-jp.com)
[お問い合わせ](/contact)
```

[Sitio web oficial de Cor.Inc.](https://cor-jp.com)
[Contacto](/contact)

### Imágenes

```markdown
![Alt text](/images/example.jpg)
![説明文](/images/example.jpg "タイトル")
```

## Fórmulas matemáticas (KaTeX)

### Fórmulas en línea

```markdown
円の面積は $A = \pi r^2$ で計算できます。
```

El área de un círculo se puede calcular con $A = \pi r^2$.

### Fórmulas en bloque

```markdown
$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$
```

$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$

### Ejemplo de fórmula compleja

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

## Tarjetas de enlace enriquecidas

### Modo de uso

Basta con escribir la URL en una sola línea para generar automáticamente una tarjeta de vista previa enriquecida. Parece magia, pero en realidad es obra de remark-link-card-plus.

```markdown
https://cor-jp.com/

https://github.com

https://docs.astro.build
```

### Ejemplos de visualización

https://cor-jp.com/

https://github.com

https://docs.astro.build

### Funciones

- Obtención automática de metadatos: obtiene de forma automática el título, la descripción y el favicon
- Visualización de imágenes OG: muestra la imagen en miniatura del sitio web
- Función de caché: almacena en caché local la información obtenida una vez
- Diseño adaptable (responsive): compatible tanto con ordenadores como con dispositivos móviles
- Modo oscuro: se ajusta automáticamente según el tema

## Líneas horizontales

```markdown
---
```

---

## Caracteres de escape

Los caracteres que no desees que se interpreten como sintaxis Markdown se deben escapar con una barra invertida. Si no sabes esto, terminarás lamentándote con visualizaciones no deseadas.

```markdown
\*これは斜体になりません\*
\`これはコードになりません\`
\# これは見出しになりません
```

\*Esto no se convertirá en cursiva\*
\`Esto no se convertirá en código\`
\# Esto no se convertirá en encabezado

## Frontmatter

Al principio del artículo, se escribe el frontmatter para configurar los metadatos. Si lo olvidas, Astro mostrará un error y se quejará.

```yaml
---
title: "記事のタイトル"
description: "記事の説明文"
pubDate: 2025-01-21
author: "Terisuke"
category: "lab"
tags: ["tag1", "tag2", "tag3"]
# image:
#   url: "/images/blog/example.avif"
#   alt: "画像の説明"
lang: "ja"
featured: true
---
```

### Lista de categorías

- `ai-driven-futures`: Futuro impulsado por IA
- `high-performance-engineering`: Ingeniería de alto rendimiento
- `founders-journey`: La trayectoria de los fundadores
- `tech-lab-creativity`: Creatividad en Tech Lab

## Mejores prácticas

### 1. Encabezados estructurados

```markdown
# メインタイトル (H1は自動生成)

## 大きなセクション (H2)

### サブセクション (H3)

#### 詳細項目 (H4)
```

### 2. Código legible

- Especifica el lenguaje adecuado en los bloques de código (el resaltado de sintaxis es agradable a la vista del lector)
- Divide el código largo en unidades lógicas (nadie quiere leer 100 líneas de código de una sola vez)
- Agrega explicaciones con comentarios (es una carta para tu "yo" del futuro)

### 3. Tarjetas de enlace eficaces

- Convierte en tarjetas de enlace solo las URL de alta relevancia
- Incluye una sección de "Materiales de referencia" al final del artículo
- Elige fuentes fiables para los enlaces externos

### 4. Elementos visuales

- Utiliza tablas para organizar la información
- Destaca los puntos clave mediante citas
- Separa las secciones con líneas horizontales

## Resolución de problemas

### Problemas frecuentes

1. La tarjeta de enlace no se muestra
   - Asegúrate de que la URL esté en una línea independiente
   - Asegúrate de que comience con HTTPS
   - Comprueba si el sitio web es accesible

2. La fórmula matemática no se muestra
   - Comprueba si hay espacios antes o después del símbolo `$`
   - Comprueba el escape de caracteres especiales

3. El resaltado de código no funciona
   - Comprueba errores ortográficos en el nombre del lenguaje
   - Comprueba el número de comillas invertidas (`)

## Resumen

Con las funciones presentadas en esta guía, podrás redactar artículos de blog visualmente atractivos y fáciles de leer. En particular, las tarjetas de enlace son una herramienta potente que permite presentar a los lectores referencias útiles con un diseño cautivador. Poder generar una tarjeta con solo escribir una URL te hace sentir casi como un mago.

Cuando escribas un artículo, utiliza la siguiente lista de verificación:

- [ ] El frontmatter está configurado correctamente (para evitar que Astro se queje)
- [ ] La estructura de encabezados es lógica (para que el lector no se pierda)
- [ ] Se ha especificado el lenguaje adecuado en los bloques de código (para un resaltado impecable)
- [ ] Las tarjetas de enlace se muestran correctamente (para darle un toque elegante)
- [ ] Las fórmulas matemáticas se muestran correctamente (para satisfacción de los matemáticos)
- [ ] Se ha configurado el atributo alt en las imágenes (la accesibilidad es importante)
