---
title: "What You Can and Cannot Enter into ChatGPT at Work: Decision Criteria for Utilizing Confidential Data with AI"
description: "For executives and administrative departments unsure whether they can input contracts, meeting minutes, estimates, or customer information into generative AI, this article explains how to classify confidentiality levels, choose between cloud AI and local LLMs, and establish internal rules."
pubDate: 2026-06-19
author: "Terisuke"
category: "ai"
tags: ["生成AI", "情報セキュリティ", "ChatGPT", "ローカルLLM"]
lang: "en"
featured: true
isDraft: false
translationSourceHash: "4bd9fb1ed663edddf05defe6d0125306e1e6910d3223a4422b593d5cd90a03e1"
translatedAt: "2026-09-28T06:24:51.026Z"
translationModel: "gemini-3.8-flash"
---

When using generative AI at a company, the first thing to decide is not "which AI to use." The first thing to decide is which information can be handed over to external AI and which information must stay confined within the company. If you start using it while leaving this vague, concerns over information management will overshadow any benefits.

## Consult Cor.Inc. for Segregating Confidential Data in AI Utilization

I believe the greatest danger in adopting AI is not "using it" per se, but leaving it to the frontline without distinguishing between information that may be used and information that must not be used. Contracts, meeting minutes, price quotes, customer information, and source code. These form the core of your business, and at the same time, they are information that would destroy trust if leaked.

At Cor.Inc., through contract AI development, AI advisory services, local LLM/secure AI solutions, and Grift, we help segregate AI utilization that prevents confidential data from leaving the company from operations that use approved AI tools.

[Consult on Confidential Data AI Utilization](/contact)

> **Objective Data Underlying This Article**
> - In an IBM 2025 study, 97% of organizations that experienced an AI-related security incident reported lacking proper AI access controls.
> - OWASP lists Sensitive Information Disclosure, Excessive Agency, and Overreliance among the key risks of LLM applications.
> - Under Cor.'s security policy, when handling customer confidential data, personal information, source code, training data, etc., the policy is to use AI tools with contracts and settings that do not use data for model training, company accounts, and approved environments.

## First, Classify Information into Three Tiers

When establishing internal AI rules, starting with specific tool names leads to failure. Tools change, but the confidentiality level of information remains tied to business operations. I believe starting with the following three tiers is sufficient:

- Public Information: Websites, publicly available materials, general industry knowledge, etc. An area well-suited for external AI.
- Internal-Only Information: Internal manuals, general meeting minutes, sales materials, etc. Contingent on using company accounts and settings that do not allow data to be used for model training.
- Customer Confidential Data, Personal Information, and Source Code: An area where, as a rule, data should not be directly fed into external AI, and where local LLMs, isolated environments, and access rights management should be considered.

The key is not to create a perfect classification matrix from the very start. It is to give the frontline actionable criteria to determine "can this be shared outside?" whenever they are unsure.

## Cloud AI and Local LLMs: Not in Conflict, but Used in Combination

Cloud AI is not an evil. In terms of speed and quality, it is exceptionally effective for writing, brainstorming, organizing public information, and reviewing non-confidential code. On the other hand, when handling customer names, contract terms, undisclosed quotes, internal knowledge bases, and personal information, the story changes completely.

Local LLMs and approved isolated environments are not a "magic bullet that makes everything high-performance." However, for operations where preventing unnecessary data exposure carries inherent value, they are an option well worth considering.

## Internal Rules Exist to Make AI "Usable," Not to "Prohibit" It

The purpose of establishing AI usage rules is not to restrict employees. It is to clarify the scope of safe usage and make it easier for frontline staff to use AI. Rules that consist only of prohibitions ultimately breed shadow AI.

The bare minimum items to determine are prohibited inputs, permitted AI tools, terms of use for company accounts, logging and approvals, human review of outputs, and points of contact in the event of an incident. Once you define these, AI utilization can shift from "individual responsibility" to "company operations."

## Consult Cor.Inc. for Segregating Confidential Data in AI Utilization

If you want to handle contracts, meeting minutes, price quotes, customer information, or internal knowledge with AI, but cannot determine whether it is acceptable to input them into external AI, you should start by taking inventory of your information. Cor.Inc. clarifies which areas are well-suited for cloud AI and which areas warrant consideration of local LLMs and isolated environments, breaking them down into actionable operational rules.

[Consult on Confidential Data AI Utilization](/contact)

## Frequently Asked Questions

### Q. Is using ChatGPT at a company dangerous in itself?

A. Using it is not dangerous in itself; what is dangerous is using it without verifying the information being entered, the contract terms, and the settings. While it is easy to use for public information and general drafting, customer confidential data and personal information require separate handling.

### Q. What are the first AI usage rules we should establish?

A. Defining prohibited inputs, permitted AI tools, the use of company accounts, logging and approvals, human review of outputs, and points of contact during an incident.

### Q. What kind of companies are local LLMs suitable for?

A. They are suitable for companies that want to use AI with information they do not want unnecessarily exposed to external services, such as contracts, meeting minutes, price quotes, internal documents, and source code.

## References


- [IBM: Cost of a Data Breach Report 2025](https://www.ibm.com/reports/data-breach) - 97% of organizations in AI-related incidents lacked proper access controls, and 63% lacked AI governance policies.
- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/) - Outlines major risks of LLM applications, including Sensitive Information Disclosure, Excessive Agency, and Overreliance.
- [Cor. Website: Security](https://cor-jp.com/security/) - Confirms local-first approach, minimal logging, confidentiality tiers, AI usage policy, and ongoing preparation for ISMS.
- [Cor. Website: AI × CO-CREATION / Business Overview](https://cor-jp.com/) - Confirms Cor.'s business domains, Grift, local LLM/secure AI, AI-driven development, and co-creation message.
