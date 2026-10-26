---
title: "已将从git历史记录中提取可核实事实的“Grift CLI”作为OSS公开发布"
description: "我们已在PyPI和GitHub上，将自有产品Grift的命令行工具“Grift CLI”作为MIT许可证的OSS公开发布。它不进行打分或排名，无论谁来运行都会得到相同的结果。"
publishedAt: 2026-10-20
category: "update"
tags: ["Grift", "OSS", "产品"]
source: "Grift"
isDraft: false
featured: true
lang: "zh"
translationSourceHash: "4222aeac7141923a5addb79b67f78e0daa2a303ad46dc6ddf790958ef9196a28"
translatedAt: "2026-10-26T08:02:41.184Z"
translationModel: "gemini-3.8-flash"
---

## Grift CLI 发布

Cor.株式会社以 MIT 许可证的开源软件形式发布了自研产品“Grift”的命令行工具“Grift CLI”。已于 2026 年 9 月 8 日在 PyPI 上发布了 v0.7.2。

Grift CLI 是一款从工程师的 git 历史记录中提取“可验证事实（检查值）”的工具。宣传标语是“履历可以注水，证据无法造假”。

## 三大承诺

- 不打分：不生成综合评分、排名或合格与否的判定。所有数值必定附带分子与分母
- 结果始终一致：由于不使用 AI（LLM）进行测算，针对相同的代码仓库和相同的版本，无论由谁运行，得出的数值都完全相同。保存的报告可通过 `grift verify` 重新计算并进行验算
- 绝不上报任何数据：仅在本地电脑上运行。是否共享由本人决定

## 使用方法

在 Python 3.11 及以上环境中，可通过以下命令开始使用。

```bash
pipx install grift-cli
cd your-repo
grift report
grift verify
```

- GitHub: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- PyPI: [pypi.org/project/grift-cli](https://pypi.org/project/grift-cli/)

## 方针变更

Grift 于 2026 年 2 月作为辅助受托开发估算的 Web 应用起步。2026 年 8 月将测算部分拆分为 CLI，并于 9 月终止了原 Web 应用的提供。此前介绍过的 Team Beta 等方案，已于 2026 年 10 月撤销。

目前，我们正在受理测试导入（PoC）的相关咨询，主要用于猎头公司及 SES 销售在推荐时出示确凿依据，以及自研企业的招聘负责人通过候选人本人共享的记录来核实其实际工作内容。详情请参阅 [Grift 案例页面](/works/grift)。
