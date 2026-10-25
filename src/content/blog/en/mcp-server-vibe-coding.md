---
title: "[Blazing-Fast 15 Mins] Building an MCP Server with an MCP Server! The Behind-the-Scenes Story of Developing the \"Make-It-Work-Nicely App\""
description: "A miracle born from the despair of a canceled lightning talk. A vibe coding experience report brought to life with Claude Desktop and Claude Code"
summary: "When the 60th lightning talk was canceled, I took on a challenge with only 15 minutes left during an emergency YouTube LIVE. By using Claude Code from Claude Desktop to build an MCP server with an MCP server, it was completed without writing a single line of code and worked on the very first try. Building wild, crazy things is, after all, truly fun."
pubDate: 2025-08-02
updatedDate: 2026-10-23
author: "Terisuke"
category: "lab"
tags: ["MCP", "Claude Desktop", "vibe coding", "締切駆動開発", "創造的プロジェクト"]
image:
  url: "/images/blog/スクリーンショット-2025-08-02-21.12.56.avif"
  alt: "YouTube LIVE Project"
lang: "en"
featured: true
translationSourceHash: "5774d80806f640b538e51bd49ab800c668a5be6a9eea76811b0f4a644e82c4b1"
translatedAt: "2026-10-23T06:16:35.707Z"
translationModel: "gemini-3.8-flash"
---

# [Blazing-Fast 15 Mins] Building an MCP Server with an MCP Server! The Behind-the-Scenes Story of Developing the "Make-It-Work-Nicely App"

On the evening of the last day of July, the cozy warmth from a bedrock bath cooled off in an instant. This story begins the moment my 60th consecutive weekly lightning talk (LT) event was suddenly canceled.
![Tweet showing shock over the canceled LT](/images/blog/スクリーンショット-2025-08-02-18.25.01.avif)

## A Massive Comeback from the Depths of Despair

Giving a lightning talk week after week without fail. Right on the verge of the commemorative 60th week came an unexpected cancellation notice. But giving up wasn't an option. As a revenge match for a New Year's YouTube LIVE that had completely flopped, I decided to host an emergency, out-of-this-world challenge.

"**A YouTube LIVE where I use AI tools to vibe-code based on given prompts and deploy everything within 2 hours, then spend the last 30 minutes making slides to deliver an LT.**"

![The YouTube LIVE challenge plan](/images/blog/スクリーンショット-2025-08-02-18.52.51.avif)

When I called for prompts on X, an avalanche of unreasonable requests came pouring in. After smoothly working through two prompts, only 15 minutes remained before slide creation was scheduled to start at 9:00 PM. Spinning the roulette wheel one last time revealed our fateful prompt.

!["An app where you ask it to 'Do that thing nicely,' and it randomly picks something on your desktop and does that thing nicely to it (irreversibly)"](/images/blog/スクリーンショット-2025-08-02-20.15.01.avif)

My brain froze for a moment. How on earth was I supposed to implement this in 15 minutes?

## The Forbidden Technique of Building an MCP Server with an MCP Server

In the midst of this desperate situation, inspiration struck. I had "Claude Code" registered as an MCP server in Claude Desktop. And what I needed right now was also an MCP server. In other words, **I could just use an MCP server to build an MCP server**.

I decided to take on this nested implementation challenge. The YouTube LIVE couldn't be stopped. With viewers watching, I took an all-or-nothing gamble.

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

## The Miracle App Completed in 15 Minutes

Claude Code did not disappoint. Without writing a single line of code, purely through conversation, an MCP server with the following capabilities was complete.

### The 7 Implemented Random Actions

1. Random folder creation: Generates folders with poetic names like "Monday Blues" or "Friday Liberation"
2. Random file creation: Automatically generates haiku, fortunes, shopping lists, and more
3. File organization: Evacuates image files into a "Found Treasures" folder
4. File renaming: Renames screenshots to things like "probably_important.png"
5. Desktop Art Museum: Displays contemporary art pieces made of ASCII art
6. Secret file creation: Generates a hidden file called `.secret_treasure.txt`
7. Time capsule: Creates a message addressed to yourself one year in the future

### Examples of Generated Content

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

## The Mysterious HTML UI Implementation Incident

The funniest part was that Claude Code went ahead and implemented an HTML UI completely unprompted. Perhaps because I asked for an "app," it generated a full-fledged dynamic web interface with great visual flair. However, this MCP server can only be used via Claude Desktop. In the end, the UI was never used at all, simply sitting there existing.

Even if you ask the AI why it built it, you won't get an answer.

## Results of Field Testing

I registered the completed MCP server in Claude Desktop and ran it. Amazingly, it worked on the first try without any issues.

### Run #1: The Desktop Art Museum Opens
```
✨ いい感じにアレしておきました！

🎨 「デスクトップ美術館」を開館しました！芸術作品も展示済みです
```

An art museum folder suddenly appeared on the desktop. Enshrined inside was a piece of contemporary ASCII art.

### Run #2: The Fate of the Screenshots
```
✨ いい感じにアレしておきました！

🏷️ 「スクリーンショット_2024-08-01.png」を「たぶん重要.png」にリネームしました！
```

A massive folder of screenshots instantly became "probably_important.png." It might genuinely be important, or it might not.

## Technical Takeaways

While it might look like pure fooling around, there were actually several significant takeaways.

### 1. The Potential of MCP (Model Context Protocol)
MCP servers can be implemented much more simply than one might imagine. For something like "messing around with the desktop," 15 minutes is plenty of time.

### 2. Realizing AI-Driven AI Development
The nested structure of building an MCP server with Claude Code offered a glimpse into a future where AI builds AI. This time, all the human did was come up with the idea; the implementation was left entirely to the AI.

### 3. The Power of Deadline-Driven Development
The extreme pressure of having only 15 minutes left sparked an explosion of creativity. If I had had more time, I would have tried to build something "proper," and it likely would have ended up boring.

### Implementation Highlights

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

It is a simple structure, but this alone makes it a fully functional MCP server callable from Claude Desktop.

## Creativity Born from Vibe Coding

This experience convinced me: rather than pursuing technical perfection and polish, there is a unique charm to "vibe coding," where you build on momentum and sheer vibes.

- Constraints breed creativity, just as a 15-minute time limit birthed an unconventional idea
- The ambiguity of "nicely," rather than aiming for perfection, actually makes things interesting
- Prioritizing fun, focusing on "it's fun to make" over practicality

## Conclusion: The Joy of Building Crazy Things

Technically speaking, the "Do That Thing Nicely App" is an extremely simple MCP server. Yet the concept, the implementation process, and the unpredictability of the results it produces make this app something truly special.

Born from the despair of a canceled LT event, this app demonstrated the potential of deadline-driven development and a new development style for the AI era. MCP servers can be built with AI. And building crazy things is, without a doubt, a whole lot of fun.

Next time your desktop is cluttered, why not ask it to "do that thing nicely"? It will surely handle it in an unexpected way—and do that thing quite nicely.

Just be warned: the results are irreversible, so take care if you have critical files. But then again, that's life.

---

*You can watch the actual YouTube LIVE stream here. Please check out the miraculous development process from the 15-minute mark.*

https://www.youtube.com/live/9gGjM0YrqJE?si=kGLBBCYsQp5F4GPi

*By the way, here is the "Do That Thing Nicely" MCP server we built.*

https://github.com/terisuke/iikanjini

*Feel free to give it a try.*
