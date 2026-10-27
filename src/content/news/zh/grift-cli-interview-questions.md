---
title: "已在 Grift CLI 报告开头新增面谈中希望确认的事项（0.9.0）"
description: "Grift CLI 0.9.0 已于 2026 年 10 月 27 日发布。仅当存在本人申报 ID 的同意记录时，才会在报告开头用简短的语句写明从记录中体现的工作推进方式以及面谈中希望确认的事项。与以往一样，不会显示分数、排名或类型名称。"
publishedAt: 2026-10-27
category: "update"
tags: ["Grift", "OSS", "产品"]
source: "Grift"
isDraft: false
featured: false
lang: "zh"
translationSourceHash: "ee3b30cd8a4c623febd67cf1ddbe2d672fee01c19b0a7a0c71444603a2de58b7"
translatedAt: "2026-10-27T13:44:01.358Z"
translationModel: "gemini-3.8-flash"
---

## 0.9.0的变更内容

Cor.株式会社于2026年10月27日发布了Grift CLI的[0.9.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0)。与以往相同，依然不会输出分数、排名和类型名称。

在`grift actor`、`grift project`、`grift align`的Markdown开头，会用简短的语句描述从记录中反映出的工作推进方式。附带件数和时间范围，写明修改部分的类别、变更节奏、测试添加方式以及参与方式；紧接着写明本记录中无法体现的内容，并以问题的形式列出希望在面谈中确认的事项。语句会依据已公开的[决策表](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/trait-profile.md)由数值选择得出。不使用AI，也不写入JSON。

关于个人的语句和问题，仅在为本人自称的ID且存在同意记录时才会输出。其他情况下，会用一句话写明未输出的理由。面谈的问题是用于使向候选人本人询问的内容更加具体的材料。并非用于决定录用与否或排名。

倾向的“强度”行与比对的“方向”行已从Markdown中移除。这是因为如果将两份报告并列，容易被解读为强势者与弱势者、合适者与不合适者。同时，修复了4处个人相关数据可能出现与事实不符数值的地方。修复之处请参见[发布说明](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0)。

## 升级前须知

由于定义的版本已变更，在0.8.0中保存的报告（`analyze`、`actor`、`repo`）及比对，在0.9.0的`grift verify`中会显示为“无法确认（`CANNOT_VERIFY`）”。project的报告会显示为“不匹配（`MISMATCH`）”。请在0.9.0中重新生成。详情请参见[迁移注意事项](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/migration-v090.md)。

```bash
pipx upgrade grift-cli
```

Grift的理念和开发背景整理在[Grift案例页面](/works/grift)中。
