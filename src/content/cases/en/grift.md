---
title: "Grift — Resumes can be embellished. Evidence cannot. An OSS tool that extracts verifiable facts from git history"
description: "Grift is our in-house product that extracts verifiable facts (test values) rather than scores from an engineer's git history. Here, we share the design and the story of how our strategy pivoted from an estimation support web app to an open-source CLI and recommendation support tool for staffing agencies and SES providers."
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "Staffing Agencies", "SES"]
publishedAt: 2026-06-30
updatedAt: 2026-10-20
summary: "Grift is our in-house product that extracts \"verifiable facts\" from an engineer's git history. Because it does not assign scores or rankings and does not use AI (LLMs) for measurement, it yields the exact same results regardless of who runs it, allowing the recipient to verify the findings. The CLI is released as open-source software under the MIT license."
isDraft: false
featured: true
lang: "en"
translationSourceHash: "7f22d1e3435c1051e9b79ad280087a0dc968c2c0e947a92dd6d02a6f8e92f399"
translatedAt: "2026-10-20T01:56:13.029Z"
translationModel: "gemini-3.8-flash"
---

<!--
執筆ガイドライン（terisuke向け）:
本文は以下の4見出しで構成してください。各 ## はそのまま記事内に表示されます。
  ## 課題      — 顧客が抱えていた問題・背景
  ## アプローチ — どう考え、どんな方針で臨んだか
  ## 実装      — 実際に作ったもの・技術的なポイント
  ## 成果      — 結果・効果（数値があれば具体的に。NDA案件は抽象化し securityNote を設定）
NDA・機密案件では具体名や数値をぼかし、frontmatter の securityNote を有効化してください。
2026-10-20: 見積支援Webアプリ時代の本文を、CLI への方針転換後の内容に書き換えた（ADR-0022）。
-->

## Challenges

When staffing agencies and SES (System Engineering Service) sales reps recommend candidates to client companies, they need to explain "why this candidate." Yet the materials at hand are almost entirely limited to resumes and impressions from interviews. Even if a resume states "5 years of Java experience," it does not convey the substance of the work—such as what kinds of changes were made and how they were validated.

At the same time, "activity volume"—such as GitHub contribution graphs and commit counts—can now be easily inflated using generative AI and agents. High volume alone is hardly grounds for recommendation anymore. On the other hand, collapsing everything into a single score erases what was measured, over what time frame, and across what population, turning it into a blunt screening tool. Both those making recommendations and those being recommended lacked "verifiable evidence."

## Approach

Grift began in February 2026 as a web application supporting contract development estimates. While exploring the basis for these estimates, we realized that the most dependable evidence is the git history that engineers have built over time. In August 2026, we carved out the measurement component as a command-line tool. In September, we discontinued the legacy web application and shifted our direction toward supporting staffing agencies and SES sales teams.

During design, we established three commitments upfront:

- **No scoring** — Output test values; leave judgment to humans. We produce no composite scores, rankings, pass/fail decisions, or grades, and every metric always includes both a numerator and a denominator.
- **Identical results every time** — No AI (LLMs) used in measurement. For the same repository and the same version, anyone running it gets the exact same numbers.
- **Sent nowhere** — Runs entirely on the local machine. The individual decides whether to share and which repositories to include.

In addition, we established a seven-article code of conduct, including rules such as "do not interpret absence as negative," "do not screen out candidates based on numbers alone," and "do not measure others without their consent." We decided that any usage failing to comply must not be called by the methodology's name (TEP: Technical Evidence Pipeline).

## Implementation

The Grift CLI extracts observations like the following exclusively from git history:

- **Attribution classification**: Separates whose work it is across 11 categories, including the individual's original commits, work by others, bots, generated/vendor deliverables, and history inherited from upstream forks.
- **Co-test rate**: The proportion of commits modifying production code that also modify tests in the same commit.
- **Rework rate and refinement**: The proportion of redoing or revisiting recently touched files (recorded as a trend, not used for pass/fail decisions).
- **Repository context**: Active working days, number of contributors and the primary author's share, proportion going through reviews, and more.

When the sample size is under 20, rates are not shown and only raw counts are provided. Anything that could not be observed is output not as "no track record," but as "unobserved" with a stated reason. `grift verify` recalculates a saved report under the same conditions and returns match, mismatch, or unverifiable, allowing the recipient to verify any tampering or discrepancies.

- Repository: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- Distribution: PyPI "grift-cli" (`pipx install grift-cli`, Python 3.11+)
- License: MIT

## Outcomes

On September 8, 2026, we released v0.7.2 on PyPI. The metrics were validated across 117 public repositories, and both comparisons that could be distinguished and those that could not yet be distinguished are published on GitHub (measured internally; not audited by a third party).

We are currently preparing trials (PoCs) with staffing agencies and SES companies to substantiate the reasons for candidate recommendations using records candidates run locally on their own machines. We aim to launch the official release in 2027 based on the results of these trials. Grift is also introduced at [griftai.org](https://griftai.org).
