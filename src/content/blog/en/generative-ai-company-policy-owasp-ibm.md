---
title: "How to Create Internal Rules for Generative AI | Risk Management from OWASP and IBM Research"
description: "For executives and administrative departments formulating rules for generative AI use, this article outlines prohibited input information, approved AI tools, logging, education, and incident response. It is intended for companies seeking to balance AI utilization with information management."
summary: "Internal rules for generative AI are created not to prevent its use, but to utilize it safely and fully. It is essential to begin with five key areas—approved AI tools, prohibited input information, eligible tasks, human review, and logging and reporting—and to continuously update them based on feedback from the field."
pubDate: 2026-06-17
updatedDate: 2026-10-23
author: "Terisuke"
category: "ai"
tags: ["生成AI", "社内ルール", "セキュリティ", "ガバナンス"]
lang: "en"
featured: true
isDraft: false
translationSourceHash: "7fd67394fcdeb12c96567e8bdf8c1004667438099fd688ec12be2c0ee942ded0"
translatedAt: "2026-10-23T05:20:46.686Z"
translationModel: "gemini-3.8-flash"
---

# How to Create Internal Rules for Generative AI | Risk Management from OWASP and IBM Research

Rules for generative AI should not be created to "prevent its use," but to "safely leverage it to the fullest."

Internal generative AI rules will not work if they simply list prohibitions. Frontline employees will use tools that are convenient. That is precisely why companies need to establish authorized AI tools, prohibited inputs, tasks requiring approval, and verification methods for outputs—creating an environment where employees can use AI without confusion.

At Cor.Inc., we believe that companies without generative AI rules are not companies that do not use AI; they are companies where AI is used out of sight. This is the issue known as Shadow AI.

> **Objective Data Used as Premises for This Article**
> - In IBM's 2025 research, 97% of organizations that reported an AI-related security incident lacked adequate AI access controls, and 63% lacked an AI governance policy.
> - OWASP identifies Sensitive Information Disclosure, Excessive Agency, and Overreliance among the primary risks of LLM applications.
> - The NIST Generative AI Profile has been published as a reference resource for integrating risk management into the design, development, deployment, and evaluation of AI.

## Essential Items to Include in the Rules

- Authorized AI Tools: Specify company-approved AI services, accounts, and settings.
- Prohibited Inputs: Classify items such as personal data, customer confidential information, contract terms, source code, and undisclosed financial information.
- Permitted Tasks: Indicate initial areas where AI can be used, such as drafting text, summarization, brainstorming, and search assistance.
- Human Review: Designate reviewers when AI outputs are used for customer deliverables, contracts, legal matters, or hiring decisions.
- Logging and Reporting: Determine points of contact and initial response procedures when an issue occurs.

By defining these five areas, frontline staff can determine "where it is safe to use" rather than assuming "everything is prohibited."

## Prohibition-Only Rules and Shadow AI

Employees want to use AI not to cut corners, but because their day-to-day work—such as meeting minutes, emails, document preparation, research, and code verification—is demanding. If a company simply says "prohibited," some employees will inevitably use it via personal accounts.

Therefore, rules should be created to enhance productivity on the frontline. The core objective is to provide a viable path to usage by setting up corporate accounts, configurations that prevent data from being used for model training, rules on prohibited inputs, and output review processes.

## Start Small and Update Through Operations

Generative AI rules should not be a one-time creation. Models, features, contract terms, and internal business operations evolve. Companies should review usage status, near-miss incidents, prohibited information, and update authorized AI tools—even if only once a month.

What matters in AI adoption is not a set of flawless regulations, but operations that are continuously improved. Only companies with a cycle of delivering rules to the frontline and updating them based on feedback can continue using AI safely. Cor.Inc. supports everything from AI usage policies, prohibited inputs, and authorized AI to local LLM implementation and employee training.

## Frequently Asked Questions

### Where should we start when creating generative AI usage rules?

A practical approach is to start with five items: authorized AI tools, prohibited inputs, permitted tasks, human review, and logging and reporting.

### Should AI usage on personal accounts be prohibited?

It should be avoided for tasks involving customer confidential information or personal data. Providing corporate accounts, configurations that prevent training use, and approved environments is essential.

### Are we safe just by creating rules?

Rules alone are insufficient. They only function effectively when supported by operations that include training, usage logs, approvals, periodic reviews, and incident response.

## References

- [IBM: Cost of a Data Breach Report 2025](https://www.ibm.com/reports/data-breach) - 97% of organizations with AI-related incidents lacked adequate access controls, and 63% lacked an AI governance policy.
- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/) - Outlines major risks of LLM applications, including Sensitive Information Disclosure, Excessive Agency, and Overreliance.
- [NIST AI 600-1: Generative AI Profile](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence) - Generative AI profile of the NIST AI RMF 1.0. A reference for incorporating trustworthiness and risk management into design, development, deployment, and evaluation.
- [Cor. Website: Security](https://cor-jp.com/security/) - View our local-first approach, minimal logging, sensitivity tiers, AI usage policy, and ISMS (Stage 2 audit completed in October 2026, with certification registration expected around December 2026).
