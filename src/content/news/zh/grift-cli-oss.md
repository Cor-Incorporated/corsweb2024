---
title: "已将从git历史记录中提取可核实事实的“Grift CLI”作为OSS开源发布"
description: "我们将自研产品Grift的命令行工具“Grift CLI”作为MIT许可证的OSS在PyPI和GitHub上发布。不打分、不排名，任何人运行都会得出相同的结果。"
publishedAt: 2026-10-20
category: "update"
tags: ["Grift", "OSS", "产品"]
source: "Grift"
isDraft: false
featured: true
lang: "zh"
translationSourceHash: "ed5a3adbdd57154b1cbb7ab4f8318fb3e0b08de7c0d8a8e3a1084e6b7179df2e"
translatedAt: "2026-10-26T13:33:44.329Z"
translationModel: "gemini-3.8-flash"
---

## Grift CLI 发布

Cor.株式会社已将旗下自研产品“Grift”的命令行工具“Grift CLI”作为 MIT 许可证的开源软件（OSS）发布。2026年9月8日已在 PyPI 上发布了 v0.7.2。

Grift CLI 是一款从工程师的 git 历史中提取“可核验的事实（检查值）”的工具。宣传标语为“履历可以夸大，证据无法造假。”

## 三项承诺

- 不打分：不给出综合评分、排名或合格与否的判定。数值必然附带分子与分母
- 每次结果一致：因测量不使用 AI（LLM），只要仓库和版本相同，无论谁来执行都会得到相同的数值。保存的报告可以通过 `grift verify` 重新计算以进行核对验算
- 不向外发送：仅在本地电脑上运行。是否共享完全由本人决定

## 使用方法

在 Python 3.11 及以上的环境中，可通过以下命令开始使用。

```bash
pipx install grift-cli
cd your-repo
grift report
grift verify
```

- GitHub: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- PyPI: [pypi.org/project/grift-cli](https://pypi.org/project/grift-cli/)

## 方针变更

Grift 于 2026年2月 作为辅助受托开发估算报价的 Web 应用起步。2026年8月 将测量部分独立为 CLI，并在 9月 停止了原 Web 应用的服务。之前所介绍的 Team Beta 等方案，已于 2026年10月 撤下。

目前，我们正在承接概念验证（PoC）的测试引入咨询，旨在帮助人才中介机构及 SES 销售人员能够有凭有据地传达推荐理由，并帮助自研企业的招聘负责人通过候选人本人共享的记录，核实其过往的具体工作内容。详情请参阅 [Grift 的案例页面](/works/grift)。
