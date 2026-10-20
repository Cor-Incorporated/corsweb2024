---
title: "已将可从git历史中提取可验证事实的“Grift CLI”作为开源软件（OSS）公开"
description: "我们将自有产品Grift的命令行工具“Grift CLI”作为基于MIT许可的OSS在PyPI与GitHub上公开。不进行评分或排名，无论由谁运行都将得到相同的结果。"
publishedAt: 2026-10-20
category: "update"
tags: ["Grift", "OSS", "产品"]
source: "Grift"
isDraft: false
featured: true
lang: "zh"
translationSourceHash: "881ec4903ce970a25ca72acd37f1fa6db515a1cfc8d1278eb12d20837ed7de41"
translatedAt: "2026-10-20T01:57:39.626Z"
translationModel: "gemini-3.8-flash"
---

## Grift CLI 现已发布

Cor.株式会社已将自有产品“Grift”的命令行工具“Grift CLI”作为 MIT 许可证的开源软件（OSS）发布。已于 2026 年 9 月 8 日在 PyPI 上发布了 v0.7.2。

Grift CLI 是一款从工程师的 git 历史中提取“可查验事实（检测值）”的工具。宣传标语为“履历可以注水，证据无法造假。”

## 三大承诺

- **不打分数**：不提供综合评分、排名或合格与否的判定。数值必定附带分子与分母
- **结果始终一致**：测量过程不使用 AI（LLM），因此只要是相同的代码仓库和相同版本，任何人运行都会得出相同的数值。保存的报告可通过 `grift verify` 重新计算并验算
- **不向任何地方发送数据**：仅在本地电脑上运行。是否共享完全由本人决定

## 使用方法

在 Python 3.11 或更高版本的环境下，可以通过以下命令开始使用。

```bash
pipx install grift-cli
cd your-repo
grift report
grift verify
```

- GitHub: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- PyPI: [pypi.org/project/grift-cli](https://pypi.org/project/grift-cli/)

## 关于方针的变更

Grift 最初于 2026 年 2 月作为辅助受托开发估算报价的 Web 应用推出。2026 年 8 月，我们将测量部分独立拆分为 CLI，并于 9 月终止了旧版 Web 应用的提供。此前介绍过的 Team Beta 等方案已于 2026 年 10 月下线。

目前，我们正在承接人才中介公司及 SES 销售人员以事实为依据传达推荐理由的试点（PoC）咨询。详情请参阅 [Grift 案例页面](/works/grift)。
