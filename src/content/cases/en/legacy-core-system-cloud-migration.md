---
title: "Cloud migration of a legacy core system — Carrying 25 years of data forward, in order"
description: "How we migrated a core database at an educational institution, run for roughly 25 years, to the cloud in stages while separating established facts from hypotheses."
category: "ai-contract"
tags: ["Cloud migration", "Core system", "PostgreSQL", "Data migration"]
publishedAt: 2026-07-02
summary: "At an educational institution, we began with a survey that separated established facts from hypotheses, and are carrying a core database of roughly 25 years to the cloud through a staged migration."
securityNote: "This project is under NDA, so the client name, the system name, and other identifying information are presented in abstracted form."
isDraft: false
featured: false
lang: "en"
translationSourceHash: "37960edd140adde429710164d510afa265da98478bd7fcb0f13018c5be949384"
translatedAt: "2026-09-28T06:09:16.030Z"
translationModel: "adopted-legacy"
---

## Challenge

At one educational institution, roughly 25 years of data — 225 tables, about 4.5 million rows, covering some 11,000 individuals — had accumulated across several long-running SQL Server databases and FileMaker. No foreign key constraints were defined, and consistency between records was held together by the way the application was operated. Simply transferring this kind of legacy situation as-is would leave 25 years of tacit knowledge behind, and we judged that it carried a real risk of throwing day-to-day operations into confusion.

## Approach

Rather than moving the data immediately, we began by surveying the existing databases. What mattered here was separating established facts from hypotheses that still needed confirmation. We put the relationships between tables and the meaning of the data into words, checking them not only against documentation but against how the work is actually done on site, so that no hypothesis would be carried into the design as if it were settled. For the destination we chose Google Cloud (Cloud SQL / PostgreSQL + Cloud Run), and opted for a redesign fitted to how the institution works today rather than a straight copy.

## Implementation

Based on the structure the survey revealed, we redesigned the schema so that it can handle names from many nationalities. The migration is not done in one pass but proceeds in stages, with a third-party double-check in place at each stage. For the parts that had no foreign key constraints, we worked out the relationships in the data and made consistency visible before reflecting it in the migration work.

- Source: multiple SQL Server databases + FileMaker (roughly 25 years, 225 tables, about 4.5 million rows, some 11,000 individuals)
- Destination: Google Cloud (Cloud SQL / PostgreSQL + Cloud Run)
- Points of care: separating facts from hypotheses, schema redesign for multinational names, third-party double-checking

## Results

The staged migration is complete through phase two (migration of the production database). Because we sorted facts from hypotheses before entering design, consistency that had until then relied on tacit knowledge became visible, and we were able to reduce the unease operations staff carried about whether the data was really correct. The work of carrying forward 25 years of accumulation — while respecting it — into a foundation that can be used with confidence for the next 25 is still under way.
