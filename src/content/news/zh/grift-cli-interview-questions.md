---
title: "已在Grift CLI报告中添加面谈确认要点（0.9.0）"
description: "Grift CLI 0.9.0已于2026年10月27日发布。仅在以本人所声明的ID存在同意记录时，报告开头才会以简短的语句写明从记录中体现的本人工作推进方式以及希望在面谈中确认的事项。分数、排名和类型名称仍与以往一样不予展示。"
publishedAt: 2026-10-27
category: "update"
tags: ["Grift", "OSS", "产品"]
source: "Grift"
isDraft: false
featured: false
lang: "zh"
translationSourceHash: "1af911264961073a5818f1745fa3379f031c6cefe30d129970b18a44e89409c5"
translatedAt: "2026-10-27T13:52:47.212Z"
translationModel: "gemini-3.8-flash"
---

## 0.9.0的变更内容

Cor.株式会社于2026年10月27日发布了Grift CLI的[0.9.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0)版本。与以往一样，依然不提供评分、排名和类型名称。

在`grift actor`的Markdown开头，会用简短的语句描述从记录中体现的工作方式。针对修改部分的划分、变更节奏、测试添加方式以及参与方式，附带件数和期间进行阐述；随后说明从该记录中无法获知的内容，并以提问的形式列出希望在面谈中确认的事项。`grift project`遵循相同规则描述项目代码仓库的推进方式，不呈现每个人的具体数据和参与方式。`grift align`在需求与记录对照排列的基础上，以提问的形式附上希望在面谈中确认的事项。语句和提问均依据已公开的[决策表](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/trait-profile.md)从数据中选出，不使用AI。由于未纳入JSON，因此在`grift verify`中能够验算的，是作为语句生成依据的数据本身。

关于个人的语句和提问，仅在以本人声明的ID且存在同意记录时才会显示。其他情况下，将用一句话说明未显示的原因。面谈中的提问是用于具体化向候选人本人询问内容的参考材料，并非用于决定合格与否或进行排名。

倾向的“强度”行以及对照的“适合度”行已从Markdown中移除。这是因为若将两份报告并列，容易被解读为强势者与弱势者、合适者与不合适者。同时，还修复了4处可能导致与个人相关的统计数据与事实不符的问题。修复的具体位置请参阅[发行说明](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0)。

## 更新前须知

由于定义版本发生了变更，在0.8.0中保存的报告（`analyze`、`actor`、`repo`）及对照，在0.9.0的`grift verify`中将变为“无法确认（`CANNOT_VERIFY`）”。project报告将变为“不一致（`MISMATCH`）”。请在0.9.0中重新生成。详情请参阅[迁移注意事项](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/migration-v090.md)。

```bash
pipx upgrade grift-cli
```

有关Grift的设计理念和开发背景，已汇总在[Grift案例页面](/works/grift)中。
