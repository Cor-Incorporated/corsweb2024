---
title: "【A toda velocidad en 15 minutos】 ¡Creando un servidor MCP con un servidor MCP! La historia detrás del desarrollo de la «app que se encarga de todo a la perfección»"
description: "El milagro nacido de la desesperación tras cancelarse una LT. Una crónica de la experiencia de vibe coding lograda con Claude Desktop y Claude Code"
summary: "Tras la cancelación de la LT de la semana 60, asumí el reto de los 15 minutos restantes en un YouTube LIVE de emergencia. Al usar Claude Code desde Claude Desktop para crear un servidor MCP con un servidor MCP, se completó sin escribir una sola línea de código y funcionó a la primera. Crear cosas descabelladas es, sin duda, muy divertido."
pubDate: 2025-08-02
updatedDate: 2026-10-23
author: "Terisuke"
category: "lab"
tags: ["MCP", "Claude Desktop", "vibe coding", "締切駆動開発", "創造的プロジェクト"]
image:
  url: "/images/blog/スクリーンショット-2025-08-02-21.12.56.avif"
  alt: "Planificación para YouTube LIVE"
lang: "es"
featured: true
translationSourceHash: "5774d80806f640b538e51bd49ab800c668a5be6a9eea76811b0f4a644e82c4b1"
translatedAt: "2026-10-23T06:25:49.819Z"
translationModel: "gemini-3.8-flash"
---

# 【A toda velocidad en 15 minutos】 ¡Creando un servidor MCP con un servidor MCP! La historia detrás del desarrollo de la «app que se encarga de todo a la perfección»

La tarde del último día de julio, la agradable calidez que sentía tras una sesión de baño de vapor en piedra caliente se enfrió en un instante. Esta historia comienza en el momento en que se canceló repentinamente la sesión de presentaciones relámpago (LT) de la semana número 60.
![Tuit impactado por la cancelación de la LT](/images/blog/スクリーンショット-2025-08-02-18.25.01.avif)

## La gran remontada desde la desesperación

Presentaciones relámpago que había mantenido semana tras semana sin falta. Justo a las puertas de la emblemática semana 60, llegó el inesperado aviso de cancelación. Sin embargo, rendirse no era una opción. Decidí organizar de urgencia una iniciativa disparatada, a modo de revancha por el gran fracaso en YouTube LIVE de las fiestas de fin de año y Año Nuevo.

"**Un YouTube LIVE donde, usando herramientas de IA a fondo, programamos con puro vibe a partir de temas propuestos, desplegamos en 2 horas y preparamos las diapositivas en los últimos 30 minutos para dar la LT**"

![Planificación del YouTube LIVE](/images/blog/スクリーンショット-2025-08-02-18.52.51.avif)

Al pedir propuestas de temas en X, empezaron a llegar una tras otra peticiones de lo más descabelladas. Tras despachar con éxito dos de los temas, solo quedaban 15 minutos para las 21:00, hora de empezar a preparar las diapositivas. Al girar la ruleta por última vez, apareció el tema del destino:

![«Una app a la que le pides "hazme ese temita a tu manera" y elige algo al azar en tu escritorio para hacértelo a su manera (de forma irreversible)»](/images/blog/スクリーンショット-2025-08-02-20.15.01.avif)

Por un instante, el cerebro se me quedó congelado. ¿Cómo implementar esto a falta de solo 15 minutos?

## La técnica prohibida: crear un servidor MCP con un servidor MCP

En medio de una situación desesperada, de repente se me encendió la bombilla. En Claude Desktop tengo registrado "Claude Code" como servidor MCP. Y lo que necesito ahora también es un servidor MCP. Es decir, **bastaba con usar un servidor MCP para crear otro servidor MCP**.

Decidí asumir el reto de implementar esta estructura anidada. El directo de YouTube no se podía detener. Con la audiencia observando en tiempo real, me lo jugué todo a una sola carta.

```javascript
// 実際に生成されたコードの一部
const randomElements = {
  folders: [
    '秘密の花園',
    '迷子の思い出',
    '月曜日の憂鬱',
    '金曜日の解放感',
    '開かずの間',
    'なんとなく大事そう'
  ],
  
  actions: [
    'createRandomFolder',
    'createArtFolder',
    'renameRandomFile',
    'hideSecretFile',
    'createTimeCapule'
  ]
};
```

## La app milagrosa completada en 15 minutos

Claude Code no defraudó. Sin escribir una sola línea de código, interactuando únicamente mediante diálogo, se completó un servidor MCP con las siguientes funciones:

### Las 7 acciones aleatorias implementadas

1. Creación de carpetas aleatorias: genera carpetas con nombres poéticos como "Melancolía de lunes" o "Sensación de libertad del viernes"
2. Creación de archivos aleatorios: genera automáticamente haikus, predicciones de la fortuna, listas de la compra, etc.
3. Organización de archivos: traslada archivos de imagen a la carpeta "Tesoros encontrados"
4. Renombrado de archivos: renombra capturas de pantalla a cosas como "probablemente_importante.png"
5. Museo en el escritorio: exhibe obras de arte contemporáneo en arte ASCII
6. Creación de archivos secretos: genera un archivo oculto llamado `.secret_treasure.txt`
7. Cápsula del tiempo: redacta un mensaje para uno mismo dentro de un año

### Ejemplos de contenidos generados

```text
// 俳句
デスクトップに
散らばるファイル
夏の空

// 買い物メモ
- 牛乳
- パン
- 整理整頓の本
- やる気（売ってたら）
- 時間（これも売ってたら）

// デスクトップ哲学
「完璧に整理されたデスクトップは、
 使われていないデスクトップである」
- 誰か偉い人（たぶん）
```

## El misterioso incidente de la implementación de una interfaz HTML

Lo más divertido fue que Claude Code implementó por su cuenta una interfaz gráfica en HTML. Quizá porque le pedí una "app", completó una interfaz web dinámica de aspecto impecable. Sin embargo, este servidor MCP solo se puede utilizar a través de Claude Desktop. Al final, la interfaz nunca se llegó a usar y se quedó allí, simplemente existiendo.

Por más que se le pregunte a la IA por qué la implementó, no hay respuesta.

## Resultados tras ponerla a prueba en el campo de batalla

Registré el servidor MCP completado en Claude Desktop y lo ejecuté. Para mi sorpresa, funcionó a la primera y sin ningún problema.

### 1.ª ejecución: Inauguración del museo en el escritorio
```
✨ いい感じにアレしておきました！

🎨 「デスクトップ美術館」を開館しました！芸術作品も展示済みです
```

Una carpeta de museo apareció repentinamente en el escritorio. En su interior reposaban obras de arte contemporáneo en arte ASCII.

### 2.ª ejecución: El destino de las capturas de pantalla
```
✨ いい感じにアレしておきました！

🏷️ 「スクリーンショット_2024-08-01.png」を「たぶん重要.png」にリネームしました！
```

Un montón de carpetas de capturas de pantalla se transformaron al instante en "probablemente_importante.png". Ciertamente podrían ser importantes, o tal vez no.

## Aprendizajes técnicos

Aunque a simple vista parezca una broma, en realidad hubo varios hallazgos de gran importancia.

### 1. El potencial de MCP (Model Context Protocol)
Los servidores MCP se pueden implementar de manera mucho más simple de lo imaginado. Para algo como "interactuar con el escritorio" como en esta ocasión, 15 minutos son más que suficientes.

### 2. La realidad del desarrollo de IA mediante IA
La estructura anidada de crear un servidor MCP con Claude Code nos permitió vislumbrar un futuro en el que la IA crea IA. En esta ocasión, la labor del humano se limitó únicamente a proponer la idea; toda la implementación se delegó por completo en la IA.

### 3. El poder del desarrollo impulsado por fechas límite
El estado límite de disponer de tan solo 15 minutos desató, por el contrario, una explosión de creatividad. De haber tenido más tiempo, habríamos intentado hacer algo "como es debido", y con seguridad habría resultado algo aburrido.

### Puntos clave de la implementación

```javascript
class IikanjiServer {
  async handleIikanjini(args) {
    const desktopPath = args.desktopPath || path.join(os.homedir(), 'Desktop');
    
    // ランダムなアクションを選択
    const action = randomElements.actions[
      Math.floor(Math.random() * randomElements.actions.length)
    ];
    
    // 各アクションを実行
    switch (action) {
      case 'createArtFolder':
        result = await this.createArtFolder(desktopPath);
        break;
      // ... 他のアクション
    }
    
    return {
      content: [{
        type: 'text',
        text: `✨ いい感じにアレしておきました！\n\n${result}`,
      }],
    };
  }
}
```

Posee una estructura simple, pero solo con esto se convierte en un servidor MCP en toda regla, invocable desde Claude Desktop.

## La creatividad que genera el vibe coding

Esta experiencia me convenció plenamente. Más que perseguir la rigurosidad técnica o el perfeccionismo, el "vibe coding", que consiste en construir al ritmo de la vibra y el impulso del momento, posee un atractivo único.

- Las restricciones generan creatividad, tal como el límite de 15 minutos dio lugar a ideas innovadoras
- La ambigüedad de buscar que quede "a su manera" sin aspirar a la perfección produce, por el contrario, un resultado fascinante
- Priorizar la diversión e importar más el "disfrutar construyéndolo" que la utilidad práctica

## Conclusión: La satisfacción de crear cosas disparatadas

La "App que te hace ese temita a su manera" es técnicamente un servidor MCP en extremo simple. No obstante, su concepto, su proceso de desarrollo y la naturaleza impredecible de sus resultados hacen de esta app algo especial.

Nacida de la desesperación por la cancelación de un evento de LT, esta app demostró el potencial del desarrollo impulsado por fechas límite y un nuevo estilo de desarrollo en la era de la IA. Los servidores MCP se pueden crear con IA. Y, definitivamente, construir cosas disparatadas siempre es divertido.

La próxima vez que tengas el escritorio desordenado, ¿por qué no pruebas a pedirle que "te haga ese temita a su manera"? Seguro que te lo resolverá a su modo y de una forma totalmente inesperada.

Eso sí: ten en cuenta que el resultado es irreversible, así que mucho cuidado si tienes archivos importantes. Pero bueno, así es la vida.

---

*Aquí puedes ver la transmisión real en YouTube LIVE. No te pierdas el milagroso proceso de desarrollo a partir de los últimos 15 minutos.*

https://www.youtube.com/live/9gGjM0YrqJE?si=kGLBBCYsQp5F4GPi

*Por cierto, aquí tienes el servidor MCP "que te hace ese temita a su manera" que construimos.*

https://github.com/terisuke/iikanjini

*¡No dudes en probarlo!*
