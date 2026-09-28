---
title: "La historia de cómo intenté una y otra vez el sitio web de Hiroshi Abe y creé un sitio web increíble"
description: "La crónica y las ideas técnicas de desafiar continuamente el sitio web de Hiroshi Abe como \"el hombre con el sitio web autoproclamado más rápido en descender\"."
pubDate: 2024-01-20
author: "Terisuke"
category: "engineering"
tags: ["Astro", "Alpine.js", "AVIF", "WebPerformance", "PageSpeed"]
image:
  url: "/images/blog/abe-hiroshi-hero.avif"
  alt: "高性能Webサイトのイメージ"
lang: "es"
featured: true
translationSourceHash: "85871aef8ac9f5e6f95e4d9a1ce2058781b6b9ae5ea5ff7d34f3ba23b7574b4e"
translatedAt: "2026-09-28T06:09:16.020Z"
translationModel: "adopted-legacy"
---

# La historia de cómo intenté superar la página web de Hiroshi Abe y creé una página web increíble

Como "el hombre con la página web de carga más rápida autoproclamada", he estado desafiando continuamente la página web del Sr. Hiroshi Abe. Como resultado, nació un sitio web verdaderamente de alto rendimiento que trasciende una simple carrera de velocidad. Por cierto, el sitio del Sr. Hiroshi Abe sigue siendo rápido hoy en día. Le rindo homenaje.

![Imagen de perfil del desarrollador](/images/blog/k-terada.avif)

## Selección del stack tecnológico

### Por qué elegimos Astro + Alpine.js

¿Por qué esta combinación? La respuesta es sencilla. Encarna el espíritu Zen de "solo lo que necesitas, cuando lo necesitas". ¿React? Pesado. ¿Vue? Regular. Pero ¿Alpine.js? Esa fue la respuesta más ligera.

```astro
---
// Arquitectura de Astro Islands
import Hero from '../components/Hero.astro';
import ContactForm from '../components/ContactForm.vue';
---

<Layout title="Sitio web ultrarrápido">
  <Hero />
  <!-- Cargar JavaScript solo donde sea necesario -->
  <ContactForm client:load />
</Layout>
```

### Estrategia de optimización de imágenes

Las imágenes son una carga pesada en la web moderna. Por eso adopté el último formato AVIF. Es la mitad del tamaño de JPEG con la misma calidad de imagen. Parece magia, pero así es el progreso tecnológico.

```html
<!-- Entrega de imágenes en formato AVIF -->
<picture>
  <source srcset="hero-480w.avif 480w, hero-800w.avif 800w" type="image/avif">
  <source srcset="hero-480w.webp 480w, hero-800w.webp 800w" type="image/webp">
  <img src="hero-800w.jpg" alt="Imagen principal" loading="lazy">
</picture>
```

## Resultados de la optimización del rendimiento

Lo logré. Obtuve la puntuación perfecta en todas las métricas:

- **Puntuación Lighthouse**: 100/100/100/100 (¡Perfecto!)
- **First Contentful Paint**: 0.3 segundos (tan rápido que no puedes parpadear)
- **Largest Contentful Paint**: 0.5 segundos (cargado antes de que puedas tomar un sorbo de café)
- **Cumulative Layout Shift**: 0 (no se mueve ni un ápice)

## Estrategia de Cache-Control

La caché es tu amiga. Con una configuración de caché de un año (31536000 segundos), las imágenes que se han cargado una vez nunca se volverán a cargar. Esto también ahorra datos de usuario. Todos felices.

```javascript
// Configuración de Firebase Hosting
{
  "headers": [
    {
      "source": "**/*.@(jpg|jpeg|gif|png|webp|avif)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "max-age=31536000, immutable"  // ¡Caché de 1 año!
        }
      ]
    }
  ]
}
```

A través de este desafío, aprendí la importancia de diseñar sitios web que prioricen la experiencia del usuario, yendo más allá de la simple "velocidad". Conclusión: la velocidad es justicia, pero la facilidad de uso es aún más justicia.

*Si está interesado en crear un sitio web de alto rendimiento, no dude en ponerse en contacto con nosotros a través de [Contacto](/contact). Construyamos juntos un sitio más rápido que el del Sr. Hiroshi Abe (puede que no sea posible, pero vale la pena intentarlo).*
