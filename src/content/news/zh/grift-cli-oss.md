---
title: "从git历史记录中提取可核实事实的“Grift CLI”已作为开源软件（OSS）发布"
description: "我们已在PyPI和GitHub上以MIT许可证将自有产品Grift的命令行工具“Grift CLI”作为开源软件（OSS）公开发布。它不进行评分或排名，无论由谁运行都会得到相同的结果。"
publishedAt: 2026-10-20
category: "update"
tags: ["Grift", "OSS", "产品"]
source: "Grift"
isDraft: false
featured: true
lang: "zh"
translationSourceHash: "ca3bd16b31d7cfb3ef5a887e1a418c09148f54c78921c9a44becf0375c495c1b"
translatedAt: "2026-10-23T06:32:15.003Z"
translationModel: "gemini-3.8-flash"
---

## Grift CLI 发布

Cor.株式会社已将自有产品“Grift”的命令行工具“Grift CLI”作为采用 MIT 许可证的开源软件（OSS）公开发布。2026年9月8日在 PyPI 上发布了 v0.7.2。

Grift CLI 是一款从工程师的 git 历史记录中提取“可查证事实（检查值）”的工具。宣传标语为“履历可以夸大，证据无法造假。”

## 三项承诺

- 不打分：不给出综合评分、排名或合格与否判定。数值必定附带分子和分母
- 每次结果相同：由于度量不使用 AI（LLM），因此只要代码仓库相同、版本相同，任何人执行都会得到相同的数值。保存的报告可以通过 `grift verify` 重新计算并进行验算
- 不向任何地方发送数据：仅在本地电脑上运行。是否共享由本人决定

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

Grift 于2026年2月作为支持委托开发报价的 Web 应用起步。2026年8月将度量部分独立为 CLI，并于9月终止了旧版 Web 应用的提供。此前介绍过的 Team Beta 等方案已于2026年10月撤回。

目前，我们正在受理用于猎头/人才中介公司及 SES 销售人员提供推荐理由并附带佐证的试用引入（PoC）咨询。详情请参阅 [Grift 的案例页面](/works/grift)。
