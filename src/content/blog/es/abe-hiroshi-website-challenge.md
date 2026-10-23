---
title: "La historia de cómo creé un sitio web increíble tras desafiar continuamente la página web de Hiroshi Abe"
description: "La trayectoria y los conocimientos técnicos de un autoproclamado «hombre con el sitio web más rápido en velocidad de descarga» que siguió desafiando la página web de Hiroshi Abe"
summary: "Continué desafiando la página web de Hiroshi Abe y creé un sitio que combina Astro, Alpine.js, imágenes AVIF y una caché de un año. En Lighthouse para escritorio, alcanzó la puntuación perfecta en Performance y SEO. La velocidad es una virtud, pero la usabilidad lo es aún más."
pubDate: 2024-01-20
updatedDate: 2026-10-23
author: "Terisuke"
category: "engineering"
tags: ["Astro", "Alpine.js", "AVIF", "WebPerformance", "PageSpeed"]
image:
  url: "/images/blog/abe-hiroshi-hero.avif"
  alt: "Imagen de un sitio web de alto rendimiento"
lang: "es"
featured: true
translationSourceHash: "649e508785eff7c26ae56890bbd4f262e1393be5a83304d7992bcf65cdef550c"
translatedAt: "2026-10-23T06:23:39.753Z"
translationModel: "gemini-3.8-flash"
---

# La historia de cómo creé un sitio web increíble tras desafiar continuamente la página web de Hiroshi Abe

Como «el autoproclamado poseedor del sitio web más rápido en velocidad de descarga», me mantuve desafiando la página web de Hiroshi Abe. Como resultado, logré crear un sitio web de alto rendimiento que no se limita únicamente a competir en velocidad. Por cierto, el sitio de Hiroshi Abe sigue siendo rápido hoy en día. Le expreso mis respetos.

![Imagen de perfil del desarrollador](/images/blog/k-terada.avif)

## Selección del stack tecnológico

### Motivos para adoptar Astro + Alpine.js

Elegí esta combinación porque permite utilizar JavaScript «solo cuando sea necesario y en la cantidad justa». Astro puede eliminar tanto JavaScript innecesario como sea posible durante el build, haciendo que la página sea liviana. Dicho esto, sin un mínimo de animaciones, como en las transiciones de pantalla, resultaría algo insuficiente para el sitio web de una empresa. Por ello, utilicé Alpine.js, una versión sumamente simple de herramientas SPA como Vue, React o Angular, e implementé las animaciones con el mínimo indispensable de JavaScript.

### Estrategia de optimización de imágenes

Las imágenes son una pesada carga en la web actual. Por eso, opté por AVIF, un formato de imagen moderno.

## Resultados de la optimización del rendimiento

Por fin lo conseguí. En Lighthouse, obtuve la puntuación máxima en Performance y SEO para escritorio.

- Lighthouse (escritorio): Performance 100, Accessibility 99, Best Practices 93, SEO 100
- Lighthouse (móvil): Performance 95, Accessibility 99, Best Practices 93, SEO 100
- First Contentful Paint: escritorio 0,5 s, móvil 1,9 s
- Largest Contentful Paint: escritorio 0,6 s, móvil 2,3 s

## Estrategia de Cache-Control

La caché es nuestra amiga. Con una configuración de caché de 1 año (31 536 000 segundos), las imágenes cargadas una vez no se vuelven a descargar durante 1 año. También permite ahorrar datos de navegación a los usuarios. Todos contentos.

```javascript
// Firebase Hosting設定
{
  "headers": [
    {
      "source": "**/*.@(jpg|jpeg|gif|png|webp|avif)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "max-age=31536000, immutable"  // 1年間のキャッシュ！
        }
      ]
    }
  ]
}
```

A través de este desafío, aprendí que es importante diseñar un sitio web priorizando la experiencia del usuario y no solo la velocidad. La velocidad es una gran virtud, pero la facilidad de uso lo es aún más.
