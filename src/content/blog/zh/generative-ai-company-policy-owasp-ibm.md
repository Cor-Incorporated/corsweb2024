---
title: "企业内部生成式AI使用规则制定指南｜基于OWASP与IBM调查的风险管理"
description: "面向制定生成式AI使用规则的管理层与管理部门，系统梳理禁止输入信息、获批AI、日志、培训以及事件应对。本文专为希望兼顾AI应用与信息管理的企业而写。"
summary: "制定企业内部生成式AI使用规则，目的不是“禁止使用”，而是“安全且充分地运用”。建议从可用AI工具、禁止输入信息、适用业务范围、人工审核、日志与报告这5个项目入手，并根据一线反馈持续保持更新，这一点至关重要。"
pubDate: 2026-06-17
updatedDate: 2026-10-23
author: "Terisuke"
category: "ai"
tags: ["生成AI", "社内ルール", "セキュリティ", "ガバナンス"]
lang: "zh"
featured: true
isDraft: false
translationSourceHash: "7fd67394fcdeb12c96567e8bdf8c1004667438099fd688ec12be2c0ee942ded0"
translatedAt: "2026-10-23T05:21:47.483Z"
translationModel: "gemini-3.8-flash"
---

# 企业内部生成式AI使用规则制定指南｜基于OWASP与IBM调查的风险管理

制定生成式AI规则的目的不是“禁止使用”，而是“安全且充分地运用”。

仅仅罗列禁止条款并不能让生成式AI的企业内部使用规则发挥作用。一线员工总会去使用便捷的工具。正因如此，企业需要明确可以使用的AI、禁止输入的信息、需要审批的业务以及输出结果的核验方法，为员工创造能够毫不犹豫安全使用的环境。

Cor.株式会社认为，尚未制定生成式AI规则的企业，并不是不用AI的企业，而是AI在看不见的地方被暗中使用的企业。这就是所谓的影子AI（Shadow AI）问题。

> **本文引用的客观数据前提**
> - IBM的2025年调查显示，在报告了AI相关安全事件的组织中，97%缺乏适当的AI访问控制，63%缺乏AI治理策略。
> - OWASP指出LLM应用的主要风险包括Sensitive Information Disclosure（敏感信息泄露）、Excessive Agency（过大自主权）、Overreliance（过度依赖）等。
> - NIST的生成式AI概况文件（Generative AI Profile）作为将风险管理融入AI设计、开发、利用和评估的参考资料公开发布。

## 规则中必须包含的项目

- 可使用的AI工具：明确企业批准的AI服务、账号及配置设置。
- 禁止输入的信息：对个人信息、客户机密、合同条款、源代码、未公开财务信息等进行分类。
- 允许使用的业务：明确指出首先可以使用的领域，如文章撰写、摘要提炼、头脑风暴、辅助检索等。
- 人工审核：确定当AI输出用于提交客户、合同、法务或招聘决策时的审核人员。
- 日志与报告：明确发生问题时的联络对接人及初步应急响应措施。

只要定好这5项，一线团队便能判断“到哪里是可以使用的”，而不是面临“全面禁止”。

## 仅靠禁止的规则与影子AI

员工想使用AI，并不是为了偷懒，而是因为会议纪要、邮件、材料撰写、调研、代码检查等日常业务负担沉重。如果企业此时只说“禁止”，就会有人使用个人账号。

因此，制定规则应当是为了提升一线生产力。准备好企业账号、不用于模型训练的设置、禁止输入的信息以及输出审核流程，提供一条安全可行的使用路径，才是根本所在。

## 小步起步并在运营中持续更新

生成式AI规则绝非制定一次就大功告成。模型、功能、合同条款和企业内部业务都会发生变化。即使频率是每月一次，也应当对使用状况、险惊事件（Near Miss）、禁止信息进行审查，并更新已批准的AI工具。

在AI运用中，重要的不是一份完美的规章，而是持续改进的运营机制。唯有将规则交付一线、并根据一线反馈建立更新循环的企业，才能长期安全地使用AI。Cor.株式会社提供从AI使用方针、禁止输入信息、已批准AI、本地LLM（Local LLM）运用到员工培训的全方位支持。

## 常见问题

### 应该从哪里开始制定生成式AI使用规则？

从可使用的AI工具、禁止输入的信息、允许使用的业务、人工审核、日志与报告这5个项目入手是最切合实际的做法。

### 是否应该禁止使用个人账号运行AI？

在处理客户机密或个人信息的业务中应予避免。关键在于准备企业账号、不用于模型训练的设置以及经过批准的环境。

### 只要制定了规则就安全了吗？

仅有规则是不够的。必须将培训、使用日志、审批、定期审查直至事件响应纳入实际运营，规则才能真正起效。

## 参考资料

- [IBM: Cost of a Data Breach Report 2025](https://www.ibm.com/reports/data-breach) - 在AI相关事件中，97%的组织缺乏适当的访问控制，63%的组织缺乏AI治理策略。
- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/) - 梳理了Sensitive Information Disclosure、Excessive Agency、Overreliance等LLM应用的代表性风险。
- [NIST AI 600-1: Generative AI Profile](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence) - NIST AI RMF 1.0面向生成式AI的概况文件。将可信度与风险管理融入设计、开发、利用和评估的参考指南。
- [Cor. HP: 安全](https://cor-jp.com/security/) - 了解本地优先、最小化日志、机密性层级、AI使用方针及ISMS（预计于2026年10月完成第二阶段审核，2026年12月左右完成认证注册）。
