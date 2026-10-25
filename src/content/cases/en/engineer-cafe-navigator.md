---
title: "Engineer Cafe Navigator — An OSS Project Supporting Reception Desk Services with Multilingual Voice AI"
description: "Introducing our project where we developed a multilingual voice AI reception agent using a multi-agent architecture for Engineer Cafe in Fukuoka City, and released it as open-source software (OSS)."
category: "ai-contract"
tags: ["Voice AI", "Multi-Agent", "RAG", "OSS", "Multilingual Support"]
publishedAt: 2026-07-02
updatedAt: 2026-10-23
summary: "We developed and deployed a multilingual voice AI agent with a multi-agent architecture to support the reception desk at Engineer Cafe in Fukuoka City, releasing it as open-source software under the ISC license."
isDraft: false
featured: true
lang: "en"
translationSourceHash: "4442ebd47cb08d3af1237b352e40f2010c433dbf42ec369dd2a828051ac75421"
translatedAt: "2026-10-23T06:26:50.640Z"
translationModel: "gemini-3.8-flash"
---

## Challenges

Engineer Cafe in Fukuoka City welcomes a diverse range of visitors from both Japan and abroad. Inquiries span a wide variety of topics—such as opening hours, facilities, and event details—and assisting visitors from overseas is a daily occurrence. While staff valued answering each question thoroughly, the workload of handling new visitors was accumulating, and there was also a concern that visitors could not always quickly find the information they needed on their own.

## Approach

From the start, Cor. decided against an architecture that simply passes questions directly to a single LLM and returns the response. Instead, we designed a system where specialized agents are divided by role—such as general guidance, business hours, events, and conversation memory—coordinated by a routing agent. By avoiding an uncurated, end-to-end approach and establishing an architecture where each agent's decisions can be traced, we believed we could systematically build up both multilingual support and guidance accuracy. In addition, with the intention of giving back to society mechanisms refined through real-world operation, we established a policy to release the project as open-source software (ISC License).

## Implementation

The frontend was built with Next.js 15, providing a kiosk-style UI featuring a 3D VRM character. The backend employs a multi-agent system using a LangGraph Supervisor architecture, coordinating specialized agents for routing, facility guidance, business hours, event guidance, conversation memory, and more. For the database, we adopted Supabase (PostgreSQL + pgvector) and designed a multilingual RAG (a mechanism that allows AI to reference internal documents and data) architecture that allows Japanese knowledge bases to be queried directly in other languages. Google Cloud was utilized for speech-to-text (STT) and text-to-speech (TTS). In terms of quality assurance, we established evaluation gates using RAGAS (an evaluation framework for RAG answer quality) and proceeded with development while maintaining ADRs (Architecture Decision Records). We also worked on the design of short-term and long-term conversational memory.

- Repository: [github.com/terisuke/engineer-cafe-navigator](https://github.com/terisuke/engineer-cafe-navigator)
- Tech Stack: Next.js 15 + LangGraph Supervisor + Supabase (pgvector) + Google Cloud STT/TTS
- Quality Assurance: RAGAS evaluation gates, ADR-driven development

## Results

Engineer Cafe Navigator is currently in production, allowing visitors to ask about facility information, operating hours, and event schedules in multiple languages. The project scale stands at 182,368 lines of code, 1,506 commits, and 8 contributors (including official Engineer Cafe staff; actual Git metrics as of June 2026), with Cor. contributing 87.7% (actual Git metrics). By releasing it as open-source software, we established a structure where continuous improvements are made, including contributions from the community. Rather than stopping at simply creating a working prototype, implementing a production-grade architecture covering routing, retrieval, and evaluation has led to its current stable operation.
