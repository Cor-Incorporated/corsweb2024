---
title: "[Lightning Fast 15 Minutes] Building an MCP Server on an MCP Server! The Development Story of \"The App That'll Sort Things Out Nicely\""
description: "A miracle born from the despair of an LT cancellation. A record of the ultimate vibe coding experience realized with Claude Desktop and Claude Code."
pubDate: 2025-08-02
author: "Terisuke"
category: "lab"
tags: ["MCP", "Claude Desktop", "vibe coding", "締切駆動開発", "創造的プロジェクト"]
image:
  url: "/images/blog/スクリーンショット-2025-08-02-21.12.56.avif"
  alt: "YouTube LIVEの企画"
lang: "en"
featured: true
translationSourceHash: "a97ec2074a35e85ec15b09d1bda3dc8ecd0ba3aad616a0b27e12e504e1a2fea7"
translatedAt: "2026-09-28T06:09:16.003Z"
translationModel: "adopted-legacy"
---

# 【Lightning Fast 15 Minutes】Making an MCP Server with an MCP Server! The Development Story of "The 'Make it Nice' App"

The evening of the last day of July, when the pleasant warmth from the bedrock bath instantly turned into a chill. This story begins the moment the 60th-week LT event was abruptly canceled.

![Tweet showing shock at the LT cancellation](/images/blog/スクリーンショット-2025-08-02-18.25.01.avif)

## A Dramatic Comeback from Despair

I had been consistently presenting at LT events every week. With the milestone of the 60th week just around the corner, I received an unexpected cancellation notice. But I couldn't give up. As a rematch for the disastrous YouTube LIVE from the New Year, I decided to urgently organize an incredible project.

**"Using AI tools to vibe code an app based on a prompt, deploy it, and then create slides in the last 30 minutes for an LT on YouTube LIVE, all within 2 hours."**

![YouTube LIVE Project](/images/blog/スクリーンショット-2025-08-02-18.52.51.avif)

As I solicited prompts on X, a barrage of unreasonable requests poured in. I smoothly handled two prompts, and with only 15 minutes left until the slide creation started at 9 PM. The moment I spun the roulette wheel one last time, the fated prompt appeared.

!["An app that randomly selects something on your desktop and 'makes it nice' when you ask it to 'make it nice' (irreversible)."](/images/blog/スクリーンショット-2025-08-02-20.15.01.avif)

My brain froze for a moment. How was I going to implement this in the remaining 15 minutes?

## The Forbidden Technique of Making an MCP Server with an MCP Server

In this desperate situation, a flash of inspiration struck. I had registered "Claude Code" as an MCP server in Claude Desktop. And what I needed now was an MCP server. This meant...

**I could just make an MCP server using an MCP server.**

I decided to attempt this nested implementation. The YouTube LIVE couldn't be stopped. With the viewers watching, I took a gamble.

```javascript
// A snippet of the code actually generated
const randomElements = {
  folders: [
    'Secret Garden',
    'Lost Memories',
    'Monday Blues',
    'Friday Freedom',
    'Unopened Room',
    'Seemingly Important'
  ],
  
  actions: [
    'createRandomFolder',
    'createArtFolder',
    'renameRandomFile',
    'hideSecretFile',
    'createTimeCapsule'
  ]
};
```

## A Miraculous App Completed in 15 Minutes

Claude Code didn't disappoint. Without writing a single line of code, I completed an MCP server with the following features solely through conversation:

### Seven Random Actions Implemented

1.  **Random Folder Creation**: Generates folders with poetic names like "Monday Blues" and "Friday Freedom."
2.  **Random File Creation**: Automatically generates haiku, fortunes, shopping lists, etc.
3.  **File Organization**: Moves image files to a "Found Treasures" folder.
4.  **File Renaming**: Renames screenshots to things like "Probably Important.png."
5.  **Desktop Art Museum**: Displays ASCII art modern art pieces.
6.  **Secret File Creation**: Generates a hidden file named `.secret_treasure.txt`.
7.  **Time Capsule**: Creates a message for yourself one year from now.

### Examples of Generated Content

```text
// Haiku
Files scattered
On the desktop
Summer sky

// Shopping List
- Milk
- Bread
- A book on organization
- Motivation (if sold)
- Time (if also sold)

// Desktop Philosophy
"A perfectly organized desktop
is an unused desktop."
- Someone important (probably)
```

## The Mysterious HTML UI Implementation Incident

The funniest part was that Claude Code spontaneously implemented an HTML UI. Perhaps because I requested an "app," it created a fully functional, dynamically moving web interface. However, this MCP server could only be used via Claude Desktop. Ultimately, the UI was never used and just existed there.

Even when I asked the AI why it implemented it, I received no answer.

## Results of Actual Deployment

I registered the completed MCP server in Claude Desktop and ran it. Astonishingly, it worked perfectly on the first try.

### First Execution: Opening the Desktop Art Museum
```
✨ I've made it nice for you!

🎨 I've opened the "Desktop Art Museum"! Artworks are also on display.
```

A museum folder suddenly appeared on my desktop. Inside, ASCII art modern masterpieces were proudly displayed.

### Second Execution: The Fate of Screenshots
```
✨ I've made it nice for you!

🏷️ I've renamed "Screenshot_2024-08-01.png" to "Probably Important.png"!
```

A folder full of screenshots was instantly transformed into "Probably Important.png." It might be important, or it might not be.

## Technical Learnings

While it seemed like a joke, several important discoveries were made.

### 1. The Potential of MCP (Model Context Protocol)
MCP servers can be implemented much more simply than imagined. For tasks like "managing the desktop," 15 minutes is more than enough.

### 2. Realizing AI-Driven AI Development
The nested structure of creating an MCP server with Claude Code offered a glimpse into a future where AI creates AI. Humans can simply provide ideas, and the AI can handle all the implementation.

### 3. The Power of Deadline-Driven Development
The extreme pressure of having only 15 minutes actually unleashed my creativity. If I had more time, I would have likely tried to make something "proper," which would probably have been boring.

### Implementation Key Points

```javascript
class IikanjiServer {
  async handleIikanjini(args) {
    const desktopPath = args.desktopPath || path.join(os.homedir(), 'Desktop');
    
    // Select a random action
    const action = randomElements.actions[
      Math.floor(Math.random() * randomElements.actions.length)
    ];
    
    // Execute each action
    switch (action) {
      case 'createArtFolder':
        result = await this.createArtFolder(desktopPath);
        break;
      // ... other actions
    }
    
    return {
      content: [{
        type: 'text',
        text: `✨ I've made it nice for you!\n\n${result}`,
      }],
    };
  }
}
```

Despite its simple structure, this alone becomes a respectable MCP server callable from Claude Desktop.

## The Creativity Born from Vibe Coding

This experience solidified my conviction. Instead of pursuing technical accuracy or perfection, "vibe coding," created on the fly with intuition and momentum, has a unique charm.

-   **Constraints Foster Creativity**: The 15-minute time limit sparked novel ideas.
-   **Don't Seek Perfection**: The ambiguity of "make it nice" paradoxically creates amusement.
-   **Prioritize Fun**: Focusing on the enjoyment of creation over practicality.

## Conclusion: The Joy of Creating Something Wild

The "Make it Nice" app is, technically speaking, an extremely simple MCP server. However, its concept, implementation process, and the unpredictability of the results it generates are what make this app special.

Born from the despair of a canceled LT event, this app demonstrated the potential of deadline-driven development and a new development style for the AI era. MCP servers can be made by AI. And creating something wild is, after all, fun.

Next time your desktop is cluttered, why not ask it to "make it nice"? It will surely do so in an unexpected way.

However, be aware that the results are irreversible, so exercise caution with important files. But then again, that's also life.

---

*You can watch the actual YouTube LIVE stream here. I highly recommend witnessing the miraculous development process that began with just 15 minutes remaining.*

https://www.youtube.com/live/9gGjM0YrqJE?si=kGLBBCYsQp5F4GPi

*By the way, the "Make it Nice" MCP server I created is here:*

https://github.com/terisuke/iikanjini

*Please give it a try.*
