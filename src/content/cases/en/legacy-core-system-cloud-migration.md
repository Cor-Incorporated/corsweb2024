---
title: "Migrating a Legacy Core System to the Cloud — Organizing and Transferring 25 Years of Data"
description: "A case study on incrementally migrating a core database operated for approximately 25 years at an educational institution to the cloud while separating facts from hypotheses."
category: "ai-contract"
tags: ["Cloud Migration", "Core System", "PostgreSQL", "Data Migration"]
publishedAt: 2026-07-02
updatedAt: 2026-10-23
summary: "Beginning with an investigation that separated facts from hypotheses, we are transferring a core database operated for approximately 25 years at an educational institution to the cloud through a phased migration."
securityNote: "Due to an NDA, identifying details such as client and system names have been abstracted in this case study."
isDraft: false
featured: false
lang: "en"
translationSourceHash: "34dc08cc30b5265ce8c7b5a895e616381ceefd66f400452da73ef5155d775d9d"
translatedAt: "2026-10-23T06:27:13.126Z"
translationModel: "gemini-3.8-flash"
---

## Challenges

At an educational institution, approximately 25 years' worth of data—spanning 225 tables, around 4.5 million rows, and about 11,000 individuals—had accumulated across multiple long-running SQL Server databases and FileMaker. Foreign key constraints were not defined, and data integrity relied entirely on application-level operations. Cor. recognized that simply transferring data with these common legacy issues carried the risk of losing 25 years of tacit knowledge and causing confusion on the ground.

## Approach

Rather than immediately migrating the data, we began by thoroughly investigating the existing databases. During this investigation, we placed great importance on distinguishing between "established facts" and "hypotheses requiring verification." We verbalized table relationships and the meaning of the data by cross-referencing not only existing documentation but also actual on-site operations, ensuring that unverified hypotheses were not carried over into the design. For the migration target, we selected Google Cloud (Cloud SQL / PostgreSQL + Cloud Run), opting for a redesign aligned with current operations rather than a mere replication.

## Implementation

Based on the structure uncovered during the investigation, we redesigned the schema to support multinational names. The migration was conducted in phases rather than all at once, with a third-party double-check system established at each stage. For areas lacking foreign key constraints, we identified data relationships and made data integrity visible before reflecting it in the migration work.

- Migration source: Multiple SQL Server databases + FileMaker (approx. 25 years' worth, 225 tables, approx. 4.5 million rows, approx. 11,000 individuals)
- Migration target: Google Cloud (Cloud SQL / PostgreSQL + Cloud Run)
- Key initiatives: Separating facts from hypotheses, schema redesign supporting multinational names, third-party double-checks

## Results

The phased migration has been completed through Phase 2 (production database migration). By sorting facts from hypotheses before starting the design, integrity that had previously relied on tacit knowledge was made visible, alleviating the operational staff's anxiety over whether the data was truly accurate. While respecting the accumulation of 25 years of history, the initiative to transition this into an infrastructure that can be used with confidence for the next 25 years continues today.
