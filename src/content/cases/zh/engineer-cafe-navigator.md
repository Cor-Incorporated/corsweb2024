---
title: "Engineer Cafe Navigator —— 以多语言语音 AI 支撑接待的 OSS 实绩"
description: "介绍我们为福冈市 Engineer Cafe 开发多语言语音 AI 接待智能体、以多智能体架构实装并作为 OSS 公开的实绩。"
category: "ai-contract"
tags: ["语音 AI", "多智能体", "RAG", "OSS", "多语言支持"]
publishedAt: 2026-07-02
summary: "我们以多智能体架构开发并实际运维支撑福冈市 Engineer Cafe 接待工作的多语言语音 AI 智能体，并以 ISC 许可证作为 OSS 公开。"
isDraft: false
featured: true
lang: "zh"
translationSourceHash: "f1d9811033cd2eeb1dce387db8407c3fd02863f9cae4c4cff8084d191ca6fdd3"
translatedAt: "2026-09-28T06:09:16.033Z"
translationModel: "adopted-legacy"
---

## 课题

福冈市的 Engineer Cafe 迎来自国内外的各类访客。开馆时间、设备、活动信息等咨询内容十分广泛，接待海外访客也是日常。一方面，工作人员希望保持逐一认真作答的方式；另一方面，接待新访客的负担不断累积，访客自己也难以迅速找到想了解的信息。

## 思路

我们最先确定的一点是：不做那种把问题原样抛给单一 LLM 再返回答案的结构。而是按导览、营业时间、活动、对话记忆等职责划分出各自专门的智能体，并设置负责路由的角色将它们统合起来。不把作答整个甩出去，而是构建可以追溯“哪个智能体做出了怎样的判断”的结构——我们认为这样才能逐步积累多语言支持能力与导览的准确性。同时，也为了把在实际运维中打磨出的机制回馈社会，我们确定了以 OSS（ISC 许可证）公开的方针。

## 实装

前端采用 Next.js 15 构建，提供带 3D VRM 角色的自助终端式 UI。后端是基于 LangGraph Supervisor 架构的多智能体系统，路由、设施导览、营业时间、活动介绍、对话记忆等专门智能体相互协作。数据库采用 Supabase（PostgreSQL + pgvector），并设计为多语言 RAG（让 AI 参照内部文档等资料的机制），使日语知识库可以直接用于其他语言的提问。语音识别与语音合成使用 Google Cloud。在质量方面，我们设置了基于 RAGAS（RAG 回答质量的评估框架）的评估门禁，一边留下 ADR（设计判断的记录）一边推进开发，并着手设计短期与长期的对话记忆。

- 代码仓库：[github.com/terisuke/engineer-cafe-navigator](https://github.com/terisuke/engineer-cafe-navigator)
- 架构：Next.js 15 + LangGraph Supervisor + Supabase(pgvector) + Google Cloud STT/TTS
- 质量保障：基于 RAGAS 的评估门禁、ADR 驱动开发

## 成果

Engineer Cafe Navigator 已投入实际运维，访客可以用多种语言询问设施导览、营业时间与活动信息。项目规模为 182,368 行・1,506 次提交・8 人贡献（含 Engineer Cafe 官方工作人员，git 实测・截至 2026 年 6 月），其中自有贡献率为 87.7%（git 实测）。以 OSS 形式公开后，形成了包含社区在内的持续改进体制。我们认为，今天的稳定运维源自没有止步于“先做个能跑的东西”，而是构建了涵盖路由、检索与评估的投产级架构。
