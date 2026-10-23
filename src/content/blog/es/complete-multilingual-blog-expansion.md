---
title: "【Soporte total para 5 idiomas】Crónica de 3 horas intensas expandiendo un blog que solo estaba en japonés e inglés al chino, coreano y español"
description: "La impactante verdad de que solo había 2 idiomas cuando se creía que eran 5. El registro completo de la implementación ultrarrápida de chino, coreano y español junto a Claude Code"
summary: "En un sitio que supuestamente admitía 5 idiomas, solo el blog estaba únicamente en japonés e inglés. En unas 3 horas, junto con Claude Code, creamos las páginas en chino, coreano y español, tradujimos los 8 artículos existentes con la API de Gemini y solucionamos los errores de compilación. No se puede saber qué significa realmente \"ser compatible\" hasta investigarlo."
pubDate: 2025-09-25
updatedDate: 2026-10-23
author: "Terisuke"
category: "engineering"
tags: ["多言語化", "i18n", "Astro", "Claude Code", "自動化", "Gemini API"]
image:
  url: "/images/blog/ko-404.avif"
  alt: "Página 404 del blog en coreano"
lang: "es"
featured: true
isDraft: false
translationSourceHash: "772589688a81666ca3dff4dff9d0215ef52dad0a70360fe768f0873b4d940fc3"
translatedAt: "2026-10-23T06:25:04.072Z"
translationModel: "gemini-3.8-flash"
---

# 【Soporte total para 5 idiomas】Crónica de 3 horas intensas expandiendo un blog que solo estaba en japonés e inglés al chino, coreano y español

"¡Pero si pone que está disponible en 5 idiomas!"

Ocurrió un jueves a primera hora de la tarde, mientras revisaba casualmente la implementación en la rama Develop del sitio web. Tal como le había pedido a Cursor Agent, en el selector de idiomas aparecían, en efecto, cinco banderas alineadas. Sin embargo, probé a abrir la página del blog en chino.

![Página del blog en chino mostrando un error 404](/images/blog/404.avif)

**404 Not Found**.

Al investigar, descubrí una verdad impactante.

## Soporte para 2 idiomas disfrazado de 5 idiomas

```typescript
// utils/i18n.ts には確かに5言語の翻訳が...
export type Locale = 'ja' | 'en' | 'zh' | 'ko' | 'es';
```

A juzgar por la configuración de i18n, efectivamente admitía 5 idiomas. Tanto la página principal como el perfil de la empresa estaban correctamente traducidos por completo. Sin embargo, eché un vistazo al directorio de páginas del blog.

```bash
$ ls src/pages/*/blog/
src/pages/en/blog/:
[...page].astro  [...slug].astro

src/pages/zh/blog/:
ls: src/pages/zh/blog/: No such file or directory

src/pages/ko/blog/:
ls: src/pages/ko/blog/: No such file or directory

src/pages/es/blog/:
ls: src/pages/es/blog/: No such file or directory
```

**Solo el blog estaba disponible únicamente en japonés e inglés**.

![Comprobación de la estructura de directorios](/images/blog/keyboardclasher.avif)

## Inicio de la implementación rápida con Claude Code

Llegados a este punto, no quedaba más remedio que implementar los 3 idiomas restantes. Por suerte, contaba con Claude Code. Sin perder tiempo, comencé con la implementación.

### Paso 1: Duplicación y modificación de las páginas del blog

En primer lugar, copié las páginas del blog de la versión en inglés y las modifiqué para cada idioma.

```bash
# 中国語、韓国語、スペイン語のディレクトリを作成
for lang in zh ko es; do
  mkdir -p src/pages/$lang/blog/
  cp -r src/pages/en/blog/* src/pages/$lang/blog/
done
```

Sin embargo, esto por sí solo no funcionaba. Era necesario corregir el filtro de idioma dentro de cada archivo.

```typescript
// 修正前（全ファイル共通）
const allPosts = await getCollection('blog', ({ data }) => {
  return data.lang === 'en' && !data.isDraft;
});

// 修正後（例：中国語版）
const allPosts = await getCollection('blog', ({ data }) => {
  return data.lang === 'zh' && !data.isDraft;
});
```

### Paso 2: Creación del script de traducción

Traducir 8 artículos en japonés manualmente no era nada realista. Por lo tanto, creé un script de traducción automática utilizando la API de Gemini.

```javascript
// scripts/translate-blog-all-languages.js
const LANGUAGES = {
  en: { name: 'English', author: 'Terisuke' },
  zh: { name: 'Chinese', author: 'Terisuke' },
  ko: { name: 'Korean', author: 'Terisuke' },
  es: { name: 'Spanish', author: 'Terisuke' }
};

async function translateToLanguage(inputFile, targetLang, body, frontmatter) {
  console.log(`📝 Translating to ${LANGUAGES[targetLang].name}...`);

  // タイトルとdescriptionを翻訳
  const titleAndDescription = `Title: ${frontmatter.title}\nDescription: ${frontmatter.description}`;
  const translatedTitleDesc = await translateWithGemini(titleAndDescription, targetLang);

  // 本文を翻訳
  const translatedBody = await translateWithGemini(body, targetLang);

  // ファイルを保存
  saveTranslatedFile(targetLang, translatedContent);
}
```

https://github.com/Cor-Incorporated/corsweb2024/blob/52f7f174d7f2b32cd655b5d3c0e786cf137ab9fa/scripts/translate-blog-all-languages.js

### Paso 3: Una lucha a muerte contra los errores

Ejecuté el script de traducción y, lleno de optimismo, me dispuse a comprobar el sitio.

```bash
$ npm run build
✘ [ERROR] Expected "}" but found "."
  script:/ProductsTable.astro:3:33:
    3 │   buttonTexts: {t.buttonTexts},
      ╵                ^
```

**Una tormenta de errores de compilación**.

![Pila de registros de errores](/images/blog/naniittenda.avif)

## Una serie continua de correcciones de errores

### Problema 1: Misterioso código de depuración en ProductsTable.astro

```javascript
// なぜか入っていた謎のデバッグコード
<script>
  console.log('Button text debug:', {
    buttonTexts: {t.buttonTexts},  // ← これが構文エラー
    goTo: {t.buttonTexts?.goTo},
    itemName: {item.name}
  });
</script>
```

Se solucionó eliminando este código de depuración.

### Problema 2: Omisión del soporte de idiomas en CategoryBadge

```typescript
// 修正前
const categoryLabels = {
  ja: { 'ai': 'AI', 'engineering': 'エンジニアリング', ... },
  en: { 'ai': 'AI', 'engineering': 'Engineering', ... },
  // zh, ko, es が存在しない！
};

// 修正後
const categoryLabels = {
  ja: { ... },
  en: { ... },
  zh: { 'ai': '人工智能', 'engineering': '工程', ... },
  ko: { 'ai': 'AI', 'engineering': '엔지니어링', ... },
  es: { 'ai': 'IA', 'engineering': 'Ingeniería', ... },
};
```

### Problema 3: Todos los enlaces de PostCard redirigen al inglés

```typescript
// 修正前
const postUrl = currentLocale === 'ja'
  ? `/blog/${cleanSlug}`
  : `/en/blog/${cleanSlug}`;  // 他の言語でも/en/に飛んでしまう！

// 修正後
const postUrl = currentLocale === 'ja'
  ? `/blog/${cleanSlug}`
  : `/${currentLocale}/blog/${cleanSlug}`;
```

### Problema 4: A pesar de haberse traducido, el título seguía en japonés

Este fue el problema más engorroso. Aunque el script de traducción supuestamente funcionaba con normalidad, el title y la description del frontmatter permanecían en japonés.

```yaml
# 中国語の記事なのに...
---
title: "【爆速15分】MCPサーバーでMCPサーバーを作る！"  # 日本語！
description: "LT中止の絶望から生まれた奇跡..."  # 日本語！
lang: "zh"
---

# 【闪电15分钟】用MCP服务器构建MCP服务器！  # 本文は中国語
```

Al investigar la causa, descubrí un error en el procesamiento de análisis sintáctico (parsing) del script de traducción. Lo solucioné creando un script de corrección por separado.

```javascript
// scripts/fix-translated-frontmatter.cjs
function extractTitleFromBody(body) {
  const lines = body.split('\n');
  for (const line of lines) {
    if (line.startsWith('# ')) {
      return line.substring(2).trim();  // 本文の最初の見出しから抽出
    }
  }
  return null;
}
```

## Resultados de 3 horas frenéticas

Aproximadamente 3 horas después de descubrir el primer error, finalmente resolví todos los problemas.

### Lista de funciones implementadas

- Creación de páginas de blog en chino, coreano y español
- Soporte para 5 idiomas en las páginas de categorías
- Soporte para 5 idiomas en las páginas de etiquetas
- Soporte para 5 idiomas en los feeds RSS
- Soporte para 5 idiomas en las páginas de pago exitoso/cancelado
- Traducción automática de 8 artículos existentes × 3 idiomas = 24 artículos
- Resolución de todos los errores de TypeScript
- Compilación exitosa (317 páginas)

![Blog en chino terminado](/images/blog/zh.avif)
![Blog en coreano terminado](/images/blog/ko.avif)
![Blog en español terminado](/images/blog/es.avif)


### Calidad de la traducción

La traducción mediante la API de Gemini superó con creces mis expectativas en cuanto a calidad.

```text
日本語: 「いい感じにアレしとくアプリ」開発秘話
中国語: "随心所欲处理应用"开发秘辛
韓国語: '적당히 알아서 해주는 앱' 개발 비화
スペイン語: La historia detrás de la aplicación 'Hazlo bien y ya'
```

Se obtuvieron traducciones naturales que capturan adecuadamente los matices de cada idioma.

## Lecciones aprendidas

### 1. La definición de "soportado" es ambigua

Aunque se hable de "soporte para 5 idiomas", no se sabe realmente hasta qué punto está cubierto hasta que se examina a fondo. Casos como este, donde la página principal sí tiene soporte pero el blog no, probablemente sean más comunes de lo que parece.

### 2. El poder del trabajo conjunto con Claude Code

Poder completar la implementación de 5 idiomas × 8 artículos en 3 horas se debió en gran medida a la presencia de Claude Code. Resultó de gran ayuda especialmente en los siguientes puntos:

- Identificación inmediata de la causa a partir de los mensajes de error
- Aprendizaje de los patrones de corrección para aplicar modificaciones similares en lote
- Implementación eficiente de la lógica del script de traducción

### 3. Los scripts de automatización son el camino a seguir

Haber traducido manualmente 24 artículos probablemente me habría tomado mucho más tiempo. Aunque tome 1 hora crear un script de automatización, la rentabilidad es mucho mayor.

### 4. Los errores son una mina de oro

Los numerosos errores que encontré en esta ocasión supusieron una excelente oportunidad para descubrir problemas latentes en el sistema. En particular, la omisión del soporte de idiomas en CategoryBadge habría terminado siendo un problema tarde o temprano.

## Conclusión: Hacia una verdadera compatibilidad multilingüe

La impactante verdad fue que un sitio que al principio consideraba "con soporte para 5 idiomas" era en realidad "un simulacro de soporte para 5 idiomas". Sin embargo, durante las 3 horas de batalla junto a Claude Code, logré hacer realidad un auténtico soporte para 5 idiomas.

Ahora, los artículos del blog se muestran adecuadamente tanto en chino como en coreano y español. El error 404 ya no vuelve a aparecer.

Esto sí es verdadera compatibilidad multilingüe.

---

*El código implementado está publicado en GitHub. El script de traducción también debería ser utilizable en otros proyectos de Astro.*

https://github.com/Cor-Incorporated/corsweb2024

*Las 3 horas de batalla junto a Claude Code fueron una experiencia frenética pero sumamente enriquecedora.*
