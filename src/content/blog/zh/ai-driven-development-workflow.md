---
title: "用AI一起开发之后，GitHub上的活动量怎么变了。2024年下半年每月约20～40件，2025年5月约300件"
description: "GitHub的贡献数在2024年下半年每月约20～40件，2025年5月约300件。这是包含Issue、PR和评审的GitHub标准合计，依据是2025年5月30日发布的图。它不是开发速度或交付量的倍率。"
summary: "GitHub的贡献数（包含Issue、PR和评审的GitHub标准合计）在2024年下半年每月约20～40件，2025年5月约300件。初版的「7倍」是把使用AI之前按每月大约50件来放时的四舍五入。质量、返工和作业时间没有在相同条件下比较。"
pubDate: 2024-01-15
updatedDate: 2026-10-29
author: "Terisuke"
category: "ai"
ctaIntent: "contract-dev"
tags: ["AI", "コントリビュート", "Cursor", "CodeRabbit", "GitHub Copilot"]
lang: "zh"
featured: true
translationSourceHash: "955397d96732625a2361532f533d4934ab6c77e0cc2b5d2853afae8f1f9b3d47"
translatedAt: "2026-10-29T05:20:00.000Z"
translationModel: "manual-i18n-sync"
---

GitHub的贡献数（包含Issue、PR和评审的GitHub标准合计）在2024年下半年每月约20～40件。2025年5月约300件（依据2025年5月30日发布的图）。

初版的「7倍」是把使用AI之前按每月大约50件来放时的四舍五入。

这个件数并不表示开发速度或交付量变成了多少倍。

本文回顾当时把哪些工作交给AI、什么变得更容易推进。质量、返工和实际作业时间没有在相同条件下比较。那些改善率并不主张。

比较的是2024年下半年的每月件数和2025年5月的件数。非公开仓库的件数是否计入，从公开信息看不出来。没有为了配合过去的数字而新做分母或质量指标。

## 当时的工作怎么分

### 写代码的工作

代码由Claude Code来写。先和Claude Desktop对话，把指示书写好，再在终端交给Claude Code。几分钟就能得到成为基本骨架的代码。之后再叠上具体指示，例如「给这个类加方法，并写单元测试」。

### 评审

做出PR后，CodeRabbit开始评审，把可能的缺陷、安全上的指出、与编码规范的差异评论到PR上。被指出的地方用Cursor的Agent功能修改。这并不表示指出能找到全部问题。

## 数的是什么

数的是GitHub的贡献数。2024年下半年每月约20～40件。2025年5月约300件。两者都在2025年5月30日发布的图的范围内。

贡献不是提交数。按GitHub的定义，除了提交，Issue、Pull Request和评审也算进去。

## 当时用的工具

- Cursor：内置AI的编辑器。被指出的地方用Agent功能修改
- Claude Desktop：一边对话一边写指示书
- Claude Code：按指示书写代码
- CodeRabbit：对PR的自动评审

当时的感觉更接近一边和AI对话一边解决问题，而不是一行一行写代码。这是感觉，不是作业时间或交付量的测量结果。

## 参考资料

2025年6月1日的note文章标题里写着开发速度7倍。公司这篇文章的数字对齐2025年5月30日的图。不把它当作速度或交付量的倍率。

https://note.com/cor_instrument/n/n800a959f7284

2025年5月30日的帖子里有按月的贡献图。

https://x.com/cor_terisuke/status/1928266812019368121

- [GitHub Docs: Profile contributions](https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference) - 官方对贡献计入对象的说明

https://cor-jp.com/

https://github.com
