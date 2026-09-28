---
title: "How to Create Internal Generative AI Usage Rules | Risk Management Based on OWASP and IBM Research"
description: "For executives and administrative departments establishing rules for generative AI usage, this article outlines prohibited input data, approved AI tools, logging, training, and incident response. It is intended for companies seeking to balance AI adoption with information management."
pubDate: 2026-06-17
author: "Terisuke"
category: "ai"
tags: ["生成AI", "社内ルール", "セキュリティ", "ガバナンス"]
lang: "en"
featured: true
isDraft: false
translationSourceHash: "ec8117a0c8a5a7f386aca8221637e23de184bdca9a357f9bedad67cae331f130"
translatedAt: "2026-09-28T06:24:56.851Z"
translationModel: "gemini-3.8-flash"
---

# How to Create Internal Generative AI Usage Rules | Risk Management Based on OWASP and IBM Research

**Generative AI rules should be created not to "prevent people from using it," but to "safely unlock its full potential"**

Internal rules for generative AI do not work if they merely list prohibitions. Teams on the ground will naturally use tools that are convenient. That is precisely why companies must decide which AI tools are permitted, what information must never be inputted, which tasks require approval, and how to verify outputs—creating an environment where employees can use AI without confusion.

## Consult Cor.Inc. on Designing Generative AI Usage Rules

In my view, companies that do not establish generative AI rules are not companies that avoid AI; they are companies where AI is used behind the scenes. This is what is known as the "Shadow AI" problem.

While actively promoting the business use of AI tools, Cor.Inc. maintains a policy of requiring corporate accounts, approved environments, and AI tools with contracts and settings that prevent data from being used for model training whenever handling customer confidential information, personal information, source code, training data, and similar assets.

[Consult Us on AI Usage Rules](/contact)

> **Objective Data Informing This Article**
> - In an IBM 2025 study, 97% of organizations reporting an AI-related security incident lacked proper AI access controls, and 63% lacked an AI governance policy.
> - OWASP identifies Sensitive Information Disclosure, Excessive Agency, and Overreliance as major risks in LLM applications.
> - The NIST Generative AI Profile was published as a reference for integrating risk management into the design, development, use, and evaluation of AI.

## Essential Items to Include in Your Rules

- Permitted AI tools: Clearly specify the AI services, accounts, and settings approved by the company.
- Prohibited input data: Categorize data that must not be entered, such as personal information, customer confidential information, contractual terms, source code, and unreleased financial information.
- Permitted tasks: Define areas where use is permitted upfront, such as drafting text, summarization, brainstorming, and research assistance.
- Human review: Designate reviewers for cases where AI outputs are used in customer deliverables, contracts, legal matters, or hiring decisions.
- Logging and reporting: Define contact points and initial response procedures when an issue occurs.

By establishing these five points, front-line teams can understand "how far they can use AI" rather than facing an outright blanket ban.

## Mere Prohibitions Only Fuel Shadow AI

Employees do not want to use AI just to cut corners. They want to use it because their daily workloads—meeting minutes, emails, document preparation, research, code reviews, and more—are heavy. If you simply respond with a "prohibition," some will inevitably end up using personal accounts.

Therefore, rules should be designed to boost productivity on the ground. The essence lies in providing a viable path for usage by establishing corporate accounts, settings that prevent data from being used for model training, rules on prohibited input data, and output review processes.

## Start Small, and Update Through Operations

Generative AI rules are not something you create once and leave behind. Models, features, contractual terms, and internal business processes change. Even if it is once a month, you should review usage status, near-miss incidents, prohibited data categories, and updates to approved AI tools.

What matters most in adopting AI is not a set of flawless regulations, but operations that are continuously improved. Hand the rules to the teams, and update them based on their feedback. Only companies that maintain this cycle can continue to use AI safely.

## Consult Cor.Inc. on Designing Generative AI Usage Rules

If you want your organization to use generative AI but have concerns regarding information leakage or establishing internal rules, please reach out to us. Cor.Inc. provides end-to-end support, covering AI usage policies, prohibited input definitions, approved AI tools, local LLM adoption, and employee training.

[Consult Us on AI Usage Rules](/contact)

## Frequently Asked Questions

### Where should we start when creating generative AI usage rules?

A practical approach is to start with five core items: permitted AI tools, prohibited input data, permitted tasks, human review, and logging and reporting.

### Should we prohibit the use of AI through personal accounts?

It should be avoided for tasks involving customer confidential information or personal information. It is crucial to provide corporate accounts, settings that prevent data from being used for model training, and approved environments.

### Are we safe just by creating rules?

Rules alone are not enough. They only truly function when backed by operations—including training, usage logging, approval workflows, periodic reviews, and incident response.

**Consult Cor.Inc. on Designing Generative AI Usage Rules**

## References


- [IBM: Cost of a Data Breach Report 2025](https://www.ibm.com/reports/data-breach) - 97% of organizations experiencing AI-related incidents lacked proper access controls, and 63% lacked AI governance policies.
- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/) - Outlines key risks for LLM applications, including Sensitive Information Disclosure, Excessive Agency, and Overreliance.
- [NIST AI 600-1: Generative AI Profile](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence) - A generative AI profile of the NIST AI RMF 1.0; a reference for integrating trustworthiness and risk management into design, development, deployment, and evaluation.
- [Cor. Website: Security](https://cor-jp.com/security/) - Details our local-first approach, minimal logging, data sensitivity tiers, AI usage policy, and ongoing preparation for ISMS certification.
