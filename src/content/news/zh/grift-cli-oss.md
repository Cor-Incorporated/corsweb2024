---
title: "已将可从git历史中提取可验证事实的“Grift CLI”作为开源软件（OSS）发布"
description: "我们将自研产品Grift的命令行工具“Grift CLI”作为采用MIT许可证的开源软件（OSS）在PyPI和GitHub上发布。该工具不进行打分或排名，无论由谁运行，都会得出相同的结果。"
publishedAt: 2026-10-20
category: "update"
tags: ["Grift", "OSS", "产品"]
source: "Grift"
isDraft: false
featured: true
lang: "zh"
translationSourceHash: "ae934df96e7ad3b3adfddc1c170e85b9b6e9fa738a4cc0c325d8d629673f73fc"
translatedAt: "2026-10-20T03:24:15.741Z"
translationModel: "gemini-3.8-flash"
---

## Grift CLI 现已发布

Cor.株式会社已将自有产品“Grift”的命令行工具“Grift CLI”作为 MIT 许可证的开源软件（OSS）公开发布。2026年9月8日已在 PyPI 上发布了 v0.7.2 版本。

Grift CLI 是一款从工程师的 git 提交历史中提取“可查证的事实（检验值）”的工具。宣传标语是：“履历可以注水，证据无法造假。”

## 三项承诺

- **不作打分**：不生成综合评分、不进行排名、不出具是否合格的判定。各项数值均明确标注文子与分母
- **每次结果一致**：测评不使用 AI（LLM），因此只要代码仓库相同、版本一致，无论由谁执行都会得出相同的数值。保存的报告可以通过 `grift verify` 进行重新计算与复核
- **绝不上传数据**：仅在本地电脑上运行。是否共享由使用者本人决定

## 使用方法

在 Python 3.11 或更高版本的环境中，可通过以下命令开始使用。

```bash
pipx install grift-cli
cd your-repo
grift report
grift verify
```

- GitHub：[github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- PyPI：[pypi.org/project/grift-cli](https://pypi.org/project/grift-cli/)

## 关于方针的变更

Grift 最初于 2026年2月 作为支持委托开发报价的 Web 应用推出。2026年8月将测评部分独立剥离为 CLI，并在 9月 终止了原 Web 应用的提供。此前介绍过的 Team Beta 等方案，已于 2026年10月 撤回。

目前，我们正在承接面向人才中介公司及 SES 销售的试导入（PoC）咨询，旨在帮助其有理有据地传达推荐理由。详情请参阅 [Grift 的案例页面](/works/grift)。
