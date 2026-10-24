---
title: "Revamping a Large-Scale Survey Collection and Analysis Platform — First, Creating an Environment Where Change Isn't Feared"
description: "A track record of taking over a survey collection and analysis platform mid-project, rebuilding it starting with tests and CI/CD, and bringing it to production."
category: "ai-contract"
tags: ["Platform Modernization", "CI/CD", "FastAPI", "AI Agent"]
publishedAt: 2026-07-02
updatedAt: 2026-10-23
summary: "We took over an in-progress survey platform, rebuilt it by establishing testing, CI/CD, and IaC, and renewed it into an experience where AI engages in dialogue to delve deeper into responses."
securityNote: "Due to an NDA, identifying details such as client and product names have been abstracted in this case study."
isDraft: false
featured: false
lang: "en"
translationSourceHash: "cae16436a7713a03aac5232249ec9c304999d0efbaa9eafc29099d8f81578cdf"
translatedAt: "2026-10-23T06:27:37.123Z"
translationModel: "gemini-3.8-flash"
---

## Challenges

This survey collection and analysis platform was a project that Cor. took over midstream. At the time of takeover, testing was insufficiently established and deployment procedures were not standardized, meaning that every time a single feature was added, a significant amount of time was spent checking for impacts on other areas. While the goal was to move beyond static forms to an experience where AI engages in dialogue to probe deeper into responses, the initial obstacle was that the system simply was not in a state where changes could be made with peace of mind.

## Approach

Rather than immediately rebuilding from scratch, Cor. chose to first create a state where "changes can be made safely." Before adding new features, we established testing, CI/CD, and infrastructure as code, solidifying the foundation before tackling the core AI dialogue functionality. At the same time, we reorganized permissions management—defining who can access what—and data handling during this stage.

## Implementation

The technical foundation was built with Python, FastAPI, and PostgreSQL, designed to allow switching between multiple LLMs. For the AI agent component, we advanced the migration to Google's Agent Development Kit (ADK), and we transitioned infrastructure management to code using Terraform. We also overhauled the authentication infrastructure, organizing permissions management and access control alongside it. We established approximately 2,500 tests, operated 27 CI/CD workflows, and put observability in place through logging and tracing.

- Technologies: Python / FastAPI / PostgreSQL, multi-LLM switching architecture, Google ADK, Terraform
- Quality & Operations: Approx. 2,500 tests, 27 CI/CD workflows, observability, overhauled permissions management

## Results

During the post-takeover phase (November 2025 to March 2026), Cor. accounted for 77.5% of commits (actual Git measurement), driving everything from rebuilding the foundation to putting the AI dialogue features into production. Currently, the deployment frequency averages 2.5 times per day, and the median pull request lead time has been reduced to 24 minutes. Actual usage has reached 484 instances across 12 projects. By solidifying testing and CI/CD first, there is no longer a need to brace for impact every time a feature is added; we feel the greatest outcome has been transforming the system into a "foundation where change is not feared."
