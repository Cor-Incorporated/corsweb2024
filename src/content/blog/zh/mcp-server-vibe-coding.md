---
title: "【闪电15分钟】用MCP服务器构建MCP服务器！“随心所欲处理应用”开发秘辛"
description: "七月最后一天傍晚，原本在岩盘浴里暖烘烘的心情瞬间冷却。故事始于我们迎来了第60周的LT（Lightning Talk）活动被紧急取消的那个瞬间。"
pubDate: 2025-08-02
author: "Terisuke"
category: "lab"
tags: ["MCP", "Claude Desktop", "vibe coding", "締切駆動開発", "創造的プロジェクト"]
image:
  url: "/images/blog/スクリーンショット-2025-08-02-21.12.56.avif"
  alt: "YouTube LIVEの企画"
lang: "zh"
featured: true
translationSourceHash: "a97ec2074a35e85ec15b09d1bda3dc8ecd0ba3aad616a0b27e12e504e1a2fea7"
translatedAt: "2026-09-28T06:09:16.011Z"
translationModel: "adopted-legacy"
---

# 【闪电15分钟】用MCP服务器构建MCP服务器！“随心所欲处理应用”开发秘辛

七月最后一天傍晚，原本在岩盘浴里暖烘烘的心情瞬间冷却。故事始于我们迎来了第60周的LT（Lightning Talk）活动被紧急取消的那个瞬间。
![因LT取消而震惊的推文](/images/blog/スクリーンショット-2025-08-02-18.25.01.avif)

## 从绝望到绝地反击

我每周都雷打不动地参加LT分享。眼看就到了纪念性的第60周，没想到却接到了取消通知。然而，我们不能就此放弃。作为年末年初在YouTube LIVE上惨败的复仇战，我们紧急策划了一个令人震惊的企划。

**“2小时内利用AI工具，根据主题进行vibe coding并完成部署，最后30分钟制作幻灯片进行LT的YouTube LIVE”**

![YouTube LIVE企划](/images/blog/スクリーンショット-2025-08-02-18.52.51.avif)

在X（原Twitter）上征集主题，接连收到了各种令人抓狂的要求。顺利完成了两个主题后，距离晚上9点开始制作幻灯片只剩下15分钟。就在此时，我们再次转动了抽奖轮盘，出现了决定命运的主题。

![“如果拜托它‘随心所欲处理一下’，它就会随机选择桌面上的某样东西并随心所欲地处理（不可逆）的应用”](/images/blog/スクリーンショット-2025-08-02-20.15.01.avif)

那一瞬间，我的大脑仿佛停止了运转。如何在剩下的15分钟内实现这个功能？

## 用MCP服务器制作MCP服务器的禁忌之技

在绝望的境地中，我突然灵光一闪。在Claude Desktop中，我们已经将“Claude Code”注册为了MCP服务器。而现在需要的，也正是MCP服务器。这意味着……

**我们可以用MCP服务器来制作MCP服务器。**

我们决定挑战这个嵌套结构的实现。YouTube LIVE不能停止。在观众的注视下，我们打了一场赌博。

```javascript
// 实际生成的代码片段
const randomElements = {
  folders: [
    '秘密花园',
    '迷失的记忆',
    '星期一的忧郁',
    '星期五的解放感',
    '密室',
    '感觉有点重要'
  ],
  
  actions: [
    'createRandomFolder', // 创建随机文件夹
    'createArtFolder',    // 创建艺术文件夹
    'renameRandomFile',   // 重命名随机文件
    'hideSecretFile',     // 隐藏秘密文件
    'createTimeCapule'    // 创建时间胶囊
  ]
};
```

## 15分钟完成的奇迹应用

Claude Code没有辜负我们的期望。我们一行代码都没写，仅仅通过对话，就完成了具备以下功能的MCP服务器：

### 实现的7项随机操作

1.  **创建随机文件夹**: 生成“星期一的忧郁”、“星期五的解放感”等富有诗意的文件夹名称。
2.  **创建随机文件**: 自动生成俳句、运势、购物清单等内容。
3.  **整理文件**: 将图片文件“隐藏”到“发现的宝藏”文件夹中。
4.  **重命名文件**: 将截图重命名为“也许很重要.png”等。
5.  **桌面美术馆**: 展示ASCII艺术的现代艺术作品。
6.  **创建秘密文件**: 生成一个名为`.secret_treasure.txt`的隐藏文件。
7.  **时间胶囊**: 创建一条给一年后自己的留言。

### 生成内容示例

```text
// 俳句
桌面文件
散落一地
夏日的天空

// 购物清单
- 牛奶
- 面包
- 收纳整理的书
- 干劲（如果卖的话）
- 时间（如果也卖的话）

// 桌面哲学
“完美整理的桌面，
 是未被使用的桌面。”
- 某位伟人（大概）
```

## 谜之HTML UI实现事件

最令人捧腹大笑的是，Claude Code竟然主动实现了HTML UI。也许是因为我们请求的是“应用”吧，它最终完成了一个动态显示的、像模像样的Web界面。然而，这个MCP服务器只能通过Claude Desktop来使用。最终，这个UI根本没有被使用，只是静静地存在着。

询问AI为何要实现它，也得不到任何答案。

## 实战投入结果

我们将完成的MCP服务器注册到Claude Desktop并执行。令人惊叹的是，它一次性完美运行。

### 第一次执行：桌面美术馆开馆
```
✨ 已经为您随心所欲处理好了！

🎨 “桌面美术馆”已开馆！艺术作品也已展示完毕。
```

桌面上突然出现的“美术馆”文件夹，里面镇守着ASCII艺术风格的现代艺术作品。

### 第二次执行：截图的命运
```
✨ 已经为您随心所欲处理好了！

🏷️ 已将“Screenshot_2024-08-01.png”重命名为“Maybe Important.png”！
```

堆积如山的截图文件夹瞬间变成了“也许很重要.png”。确实可能重要，也可能不重要。

## 技术上的学习

虽然看似是在开玩笑，但实际上却带来了几个重要的发现。

### 1. MCP（Model Context Protocol）的可能性
MCP服务器的实现比想象中要简单得多。对于像这次这样“处理桌面”级别的操作，15分钟是绰绰有余的。

### 2. AI实现AI开发
通过Claude Code制作MCP服务器的嵌套结构，让我们窥见了AI创造AI的未来。人类只需要提出想法，实现过程可以全部交给AI。

### 3. 截止日期驱动开发的威力
仅剩15分钟的极端情况，反而激发了爆炸式的创造力。如果时间充裕，我们可能会试图制作“更正式”的东西，结果肯定会变得无趣。

### 实现要点

```javascript
class IikanjiServer {
  async handleIikanjini(args) {
    const desktopPath = args.desktopPath || path.join(os.homedir(), 'Desktop');
    
    // 选择随机操作
    const action = randomElements.actions[
      Math.floor(Math.random() * randomElements.actions.length)
    ];
    
    // 执行各项操作
    switch (action) {
      case 'createArtFolder':
        result = await this.createArtFolder(desktopPath);
        break;
      // ... 其他操作
    }
    
    return {
      content: [{
        type: 'text',
        text: `✨ 已经为您随心所欲处理好了！\n\n${result}`,
      }],
    };
  }
}
```

结构简单，但这足以成为一个可以从Claude Desktop调用的、功能完善的MCP服务器。

## vibe coding带来的创造力

通过这次经历，我更加确信。与其追求技术的准确性和完整度，不如以当下的感觉和气势来制作的“vibe coding”具有独特的魅力。

-   **限制催生创造力**: 15分钟的时间限制催生了新颖的想法。
-   **不追求完美**: “随心所欲”这种模糊性反而带来了趣味性。
-   **优先享受乐趣**: 相比实用性，更重视“制作过程的乐趣”。

## 总结：制作令人瞠目结舌之物的乐趣

“随心所欲处理应用”在技术上是一个极其简单的MCP服务器。然而，它的构思、实现过程以及由此产生的不可预测的结果，使其成为一个特别的应用。

这个诞生于LT活动取消的绝望中的应用，展示了截止日期驱动开发的可能性以及AI时代新的开发模式。MCP服务器可以通过AI来创建。而且，制作令人瞠目结舌的东西，果然还是很有趣的。

下次如果您的桌面变得杂乱无章，不妨试试请求它“随心所欲处理一下”吧。它一定会以您意想不到的方式，为您“随心所欲地处理”。

不过，结果是不可逆的，所以如果您有重要文件，还请注意。但，这不也是人生的一部分吗。

---

*实际YouTube LIVE直播的录像在这里。强烈建议观看从最后15分钟开始的奇迹般开发过程。*

https://www.youtube.com/live/9gGjM0YrqJE?si=kGLBBCYsQp5F4GPi

*顺便一提，制作的“随心所欲处理应用”MCP服务器在这里*

https://github.com/terisuke/iikanjini

*欢迎您前来尝试。*
