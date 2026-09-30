---
title: "Renewing a large-scale survey collection and analysis platform — First, make change safe"
description: "How we took over a survey collection and analysis platform mid-project, rebuilt it starting from testing and CI/CD, and took it to production."
category: "ai-contract"
tags: ["Platform renewal", "CI/CD", "FastAPI", "AI agents"]
publishedAt: 2026-07-02
summary: "We took over a survey platform mid-project and rebuilt it starting from testing, CI/CD, and infrastructure as code, renewing it into an experience where AI probes deeper through conversation."
securityNote: "This project is under NDA, so the client name, the product name, and other identifying information are presented in abstracted form."
isDraft: false
featured: false
lang: "en"
translationSourceHash: "0c80714cd505e0d78e0c53dc042d0f5dcb00418815fbd3200f8209f3c185f703"
translatedAt: "2026-09-28T06:09:16.031Z"
translationModel: "adopted-legacy"
---

## Challenge

This survey collection and analysis platform is a project we took over partway through. At the point of handover, testing was inadequately set up and there was no settled deployment procedure, so every time a single feature was added, checking its effect on everything else took time. The client wanted to go beyond static forms toward an experience in which AI probes deeper through conversation, but the first wall was that the codebase was not in a state where changes could be made with confidence at all.

## Approach

What we chose was to build a state in which changes can be made safely first, rather than rewriting everything immediately. Before adding features, we put testing, CI/CD, and infrastructure managed as code in place, firming up the foundation before taking on the main task of the AI conversation feature. Alongside this, we also revisited who can access what, and how data is handled, at this stage.

## Implementation

The technical foundation is built with Python / FastAPI / PostgreSQL, structured so that several LLMs can be switched between. For the AI agent part we advanced a migration to Google's Agent Development Kit (ADK), and moved the infrastructure to code management with Terraform. We also renewed the authentication foundation, reorganizing permissions and access at the same time. We put roughly 2,500 tests in place, now run 27 CI/CD workflows, and set up observability through logs and traces.

- Technology: Python / FastAPI / PostgreSQL, multi-LLM switching configuration, Google ADK, Terraform
- Quality and operations: roughly 2,500 tests, 27 CI/CD workflows, observability, renewed permission management

## Results

In the post-handover phase (November 2025 to March 2026) we accounted for 77.5% of commits (measured via git), carrying the work from rebuilding the foundation through to taking the AI conversation feature into production. Deployment frequency now averages 2.5 times a day, and the median lead time for a pull request has come down to 24 minutes. Real usage has reached 484 responses across 12 projects. Because we firmed up testing and CI/CD first, there is no longer a need to brace yourself every time a feature is added, and we feel the biggest result is that it has become a foundation where change is not something to fear.
