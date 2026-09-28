---
title: "Engineer Cafe Navigator — Multilingual voice AI supporting a reception desk, released as OSS"
description: "A look at our work building a multilingual voice AI reception agent for Engineer Cafe in Fukuoka City on a multi-agent architecture, and releasing it as open source."
category: "ai-contract"
tags: ["Voice AI", "Multi-agent", "RAG", "OSS", "Multilingual"]
publishedAt: 2026-07-02
summary: "We developed and now run a multilingual voice AI agent that supports the reception desk at Engineer Cafe in Fukuoka City, built on a multi-agent architecture and published as OSS under the ISC license."
isDraft: false
featured: true
lang: "en"
translationSourceHash: "f1d9811033cd2eeb1dce387db8407c3fd02863f9cae4c4cff8084d191ca6fdd3"
translatedAt: "2026-09-28T06:09:16.028Z"
translationModel: "adopted-legacy"
---

## Challenge

Engineer Cafe in Fukuoka City welcomes a wide variety of visitors from Japan and overseas. Questions range broadly across opening hours, facilities, and event information, and visitors from abroad arrive as a matter of course. The staff wanted to keep answering each question carefully, but the load of handling first-time visitors kept accumulating, and visitors themselves could not reach the information they were looking for quickly.

## Approach

The first thing we decided was not to build something that simply throws each question at a single LLM and returns whatever comes back. Instead we separated specialist agents by role — guidance, opening hours, events, conversational memory — and placed a routing agent above them to tie them together. By not delegating the answer wholesale, and by keeping a structure in which you can trace which agent decided what and why, we thought we could build up multilingual support and accuracy of guidance over time. Alongside that, we decided to publish the system as OSS (ISC license), partly to give back to society what we had refined in real operation.

## Implementation

The frontend is built with Next.js 15 and provides a kiosk-style UI with a 3D VRM character. The backend is a multi-agent system in a LangGraph Supervisor configuration, in which specialist agents for routing, facility guidance, opening hours, event information, and conversational memory work together. For the database we adopted Supabase (PostgreSQL + pgvector), and designed a multilingual RAG setup (a mechanism for letting AI refer to internal documents and similar material) so that a Japanese knowledge base can serve questions asked in other languages as they are. Speech recognition and speech synthesis run on Google Cloud. On quality, we set up an evaluation gate using RAGAS (a framework for evaluating RAG answer quality), kept ADRs (records of design decisions) as development proceeded, and worked on the design of both short-term and long-term conversational memory.

- Repository: [github.com/terisuke/engineer-cafe-navigator](https://github.com/terisuke/engineer-cafe-navigator)
- Stack: Next.js 15 + LangGraph Supervisor + Supabase (pgvector) + Google Cloud STT/TTS
- Quality assurance: evaluation gate with RAGAS, ADR-driven development

## Results

Engineer Cafe Navigator is in live operation, and visitors can now ask about facility guidance, opening hours, and event information in multiple languages. The project stands at 182,368 lines, 1,506 commits, and 8 contributors (including official Engineer Cafe staff; measured via git, as of June 2026), with our own contribution rate at 87.7% (measured via git). Publishing it as OSS has put continued improvement on a footing that includes the wider community. We believe the stability it shows today comes from not stopping at something that merely works, but building a production configuration that covers routing, retrieval, and evaluation.
