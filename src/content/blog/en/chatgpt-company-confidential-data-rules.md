---
title: "What Information Can and Cannot Be Entered into ChatGPT at Work: Criteria for Using AI with Confidential Data"
description: "For executives and administrative departments unsure whether they can input contracts, meeting minutes, estimates, or customer information into generative AI, this article explains how to classify confidentiality levels, choose between cloud AI and local LLMs, and establish internal rules."
summary: "When introducing generative AI in a company, the first thing to decide is not which AI to use, but what information can be shared with external AI. By classifying information into three levels and establishing internal rules regarding prohibited inputs and approved AI tools, companies can shift AI usage from an employee's \"self-responsibility\" to standard corporate operations."
pubDate: 2026-06-19
updatedDate: 2026-10-23
author: "Terisuke"
category: "ai"
tags: ["生成AI", "情報セキュリティ", "ChatGPT", "ローカルLLM"]
lang: "en"
featured: true
isDraft: false
translationSourceHash: "2a15c033801a1941e40c576c33fc31e0355648066d1c20d0272c8bc89c9a6b87"
translatedAt: "2026-10-23T06:15:16.865Z"
translationModel: "gemini-3.8-flash"
---

When using generative AI at a company, the first thing to decide is not "which AI to use," but which information can be passed to external AIs and which must remain confined within the company. Starting to use AI while leaving this point ambiguous creates anxiety over information management before you ever realize its benefits.

At Cor.Inc., we believe that the greatest risk in adopting AI is not "using it" per se, but leaving decisions to frontline staff without separating information that is permitted for use from information that is not. Contracts, meeting minutes, estimates, customer information, and source code are the core of operations—and, at the same time, information that destroys trust if leaked.

> **Objective Data Underlying This Article**
> - In an IBM 2025 study, it was reported that 97% of organizations that experienced an AI-related security incident lacked proper AI access controls.
> - OWASP lists Sensitive Information Disclosure, Excessive Agency, and Overreliance among the primary risks of LLM applications.
> - Cor.'s security policy states that when handling customer confidential data, personal information, source code, training data, and the like, teams must use AI tools under contracts and settings ensuring that data is not used for training, company accounts, and approved environments.

## First, Classify Information into 3 Tiers

When establishing internal AI rules, starting with specific tool names leads to failure. Tools change, but the sensitivity level of information remains tied to business operations. At Cor.Inc., we believe that the following three tiers are sufficient to start with:

- Public Information: Websites, public documents, general industry knowledge, etc. An area easily handled with external AIs.
- Internal-Only Information: Internal manuals, general meeting minutes, sales materials, etc. Contingent on using company accounts and settings that ensure data is not used for training.
- Customer Confidential Data, Personal Information, and Source Code: An area where, in principle, data should not be entered directly into external AIs, and local LLMs, isolated environments, and permission management should be considered.

The key is not to build a flawless classification table from the outset, but to have standards that allow frontline staff to judge whether "this can be sent outside" whenever they are in doubt.

## Choosing Between Cloud AI and Local LLMs

Cloud AI is not inherently bad. For text generation, bouncing ideas back and forth, organizing public information, and reviewing non-confidential code, it is extremely effective in terms of speed and quality. On the other hand, the situation changes when dealing with customer names, contract terms, unreleased estimates, internal knowledge bases, and personal information.

Local LLMs and approved isolated environments are not "magic wands that make everything high-performance." However, for operations where keeping information from going outside unnecessarily has inherent value, they are an option well worth considering.

## Internal Rules That Create a "Ready-to-Use State"

The purpose of creating AI usage rules is not to restrict employees, but to clarify the scope of safe use and make it easier for frontline staff to use AI. Rules that consist only of prohibitions ultimately lead to an increase in shadow AI.

The minimum items that should be defined are prohibited input information, permitted AI tools, requirements for using company accounts, logging and approvals, human review of generated outputs, and contacts in the event of an incident. Once you define this much, AI utilization can shift from "individual responsibility" to "company operations."

If you want to handle contracts, meeting minutes, estimates, customer information, and internal knowledge with AI, but cannot determine whether it is safe to enter them into external AIs, you should start by taking inventory of your information. At Cor.Inc., we organize which areas are suitable for cloud AI and which areas warrant consideration of local LLMs and isolated environments, down to creating operational rules that can actually be implemented.

## Frequently Asked Questions

### Q. Is using ChatGPT at a company inherently dangerous?

A. Using it is not inherently dangerous in itself; using it without checking the information being entered as well as the contracts and settings is what is dangerous. While it is easy to use for public information and general writing, customer confidential data and personal information require different handling.

### Q. What are the first AI usage rules we should establish?

A. Defining prohibited input information, permitted AI tools, use of company accounts, logging and approvals, human review of generated outputs, and contacts in the event of an incident.

### Q. What kinds of companies are local LLMs suitable for?

A. They are suitable for companies that want to use AI to handle information they do not want sent outside unnecessarily, such as contracts, meeting minutes, estimates, internal documents, and source code.

## References

- [IBM: Cost of a Data Breach Report 2025](https://www.ibm.com/reports/data-breach) - 97% of organizations with AI-related incidents lacked proper access controls, and 63% lacked an AI governance policy.
- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/) - Compiles representative risks of LLM applications, including Sensitive Information Disclosure, Excessive Agency, and Overreliance.
- [Cor. Website: Security](https://cor-jp.com/security/) - Details local-first, minimal logging, sensitivity tiers, AI usage policy, and ISMS (expecting to complete Stage 2 audit in October 2026, with certification registration anticipated around December 2026).
- [Cor. Website: AI × CO-CREATION / Business Overview](https://cor-jp.com/) - Details Cor.'s business domains, Grift, local LLM/secure AI, AI-driven development, and co-creation message.
