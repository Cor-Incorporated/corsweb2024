---
title: "Engineer Cafe Navigator — 以多语言语音AI支持前台接待的OSS实绩"
description: "介绍以多智能体架构为福冈市Engineer Cafe开发多语言语音AI接待智能体，并作为OSS公开的实绩。"
category: "ai-contract"
tags: ["语音AI", "多智能体", "RAG", "OSS", "多语言支持"]
publishedAt: 2026-07-02
updatedAt: 2026-10-23
summary: "以多智能体架构开发并实际运行了支持福冈市Engineer Cafe前台接待的多语言语音AI智能体，并以ISC许可证作为OSS公开。"
isDraft: false
featured: true
lang: "zh"
translationSourceHash: "4442ebd47cb08d3af1237b352e40f2010c433dbf42ec369dd2a828051ac75421"
translatedAt: "2026-10-23T06:28:03.154Z"
translationModel: "gemini-3.8-flash"
---

## 课题

福冈市的Engineer Cafe（工程师咖啡馆）迎接着来自日本国内外的多元化访客。关于开馆时间、设施以及活动信息等咨询范围广泛，应对海外访客也是日常工作的一部分。虽然工作人员希望能对每一位访客都进行细致周到的解答，但接待新访客所带来的负担日益累积，同时也存在用户无法快速获取所需信息的痛点。

## 解决路径

Cor.在项目初期就决定，不采用将问题直接抛给单一LLM并返回答案的简单结构。而是按导览、营业时间、活动、对话记忆等不同职责划分专门的智能体，并设置负责统筹调度的路由角色。我们认为，不把生成答案全盘托付，而是采用能够追踪哪个智能体作出了何种判断的架构，才能持续提升多语言支持与导览的准确性。同时，为了将实际运营中打磨出的机制回馈社会，我们也确立了以开源软件（OSS，采用ISC许可证）形式公开的方针。

## 实现

前端采用Next.js 15构建，提供了基于3D VRM角色的信息亭（Kiosk）式UI。后端采用基于LangGraph Supervisor架构的多智能体系统，协调路由、设施导览、营业时间、活动导览及对话记忆等专门智能体群协同运作。数据库采用Supabase（PostgreSQL + pgvector），设计了可直接使用日语知识库响应其他语言提问的多语言RAG（让AI参考企业内部文档等资料的机制）。语音识别与语音合成采用了Google Cloud。在质量保障方面，设立了基于RAGAS（RAG回答质量评估框架）的评估门禁，并在开发过程中持续记录ADR（架构决策记录）。同时，我们还开展了短期与长期对话记忆的设计。

- 代码仓库：[github.com/terisuke/engineer-cafe-navigator](https://github.com/terisuke/engineer-cafe-navigator)
- 架构：Next.js 15 + LangGraph Supervisor + Supabase(pgvector) + Google Cloud STT/TTS
- 质量保障：基于RAGAS的评估门禁、ADR驱动开发

## 成果

Engineer Cafe Navigator现已投入实际运营，访客能够以多语言咨询设施导览、营业时间及活动信息。项目规模达182,368行代码、1,506次提交、8位贡献者（包含Engineer Cafe官方工作人员，基于git实际统计，截至2026年6月），其中Cor.的贡献率为87.7%（基于git实际统计）。通过作为OSS公开，形成了包括社区在内能够持续改进的体制。我们认为，没有止步于“先做个能跑的原型”，而是构建了涵盖路由、检索、评估在内的生产级架构，正是实现当下稳定运营的关键所在。
