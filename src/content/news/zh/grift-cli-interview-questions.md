---
title: "已在 Grift CLI 报告开头新增面谈中希望确认的事项（0.9.0）"
description: "Grift CLI 0.9.0 已于2026年10月27日发布。仅在存在本人所声明 ID 的同意记录时，才会在报告开头以简短语句写明从记录中体现的工作推进方式以及面谈中希望确认的事项。与以往一样，不会显示分数、排名及类型名称。"
publishedAt: 2026-10-27
category: "update"
tags: ["Grift", "OSS", "产品"]
source: "Grift"
isDraft: false
featured: false
lang: "zh"
translationSourceHash: "a7fe0fafe296a0da9774befadd179855e488c4514793080dd3360f94cbaa222b"
translatedAt: "2026-10-27T13:35:50.064Z"
translationModel: "gemini-3.8-flash"
---

## 0.9.0 的变更内容

Cor.株式会社于2026年10月27日发布了 Grift CLI 的 [0.9.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0) 版本。一如既往，本版本不会输出评分、排名或类型名称。

在 `grift actor`、`grift project` 和 `grift align` 的 Markdown 开头，会用简短的语句描述从记录中反映出的工作推进方式。围绕修改部位的分类、变更节奏、测试添加方式以及参与方式，附带件数和时间段进行描述；紧接着以提问的形式列出该记录中无法反映的事项以及希望在面谈中确认的事项。语句基于已公开的[决策表](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/trait-profile.md)由数值选定。不使用 AI，且不包含在 JSON 中。

关于个人的语句和提问，仅在以本人声明的 ID 且存在同意记录时才会输出。其他情况下，将用一句话说明未予输出的理由。面谈问题是用于具体落实向候选人本人询问内容的参考材料，并非用于决定录用与否或确定排名。

倾向的“强度”行以及对照的“适合度”行已从 Markdown 中移除。这是因为当并列查看两份报告时，可能会被解读为“强势者/弱势者”或“合适的人/不合适的人”。同时，针对个人可能出现与事实不符数值的 4 处问题进行了修复。修复位置参见[发布说明](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0)。

## 更新前须知

在 0.8.0 中保存的报告（`analyze`、`actor`、`repo`）及对照，由于定义版本发生变化，在 0.9.0 的 `grift verify` 中将变为“无法确认（`CANNOT_VERIFY`）”。project 的报告将变为“不一致（`MISMATCH`）”。请在 0.9.0 中重新生成。详情请参阅[迁移注意事项](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/migration-v090.md)。

```bash
pipx upgrade grift-cli
```

有关 Grift 的理念与开发历程，已汇总于 [Grift 案例页面](/works/grift)。
