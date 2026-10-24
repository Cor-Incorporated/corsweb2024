---
title: "Grift — Resumes can be embellished. Evidence cannot. An OSS tool that extracts verifiable facts from git histories"
description: "Grift is our in-house product that extracts verifiable facts (test values)—not scores—from engineers' git histories. We share the story and design behind shifting our direction from an estimation-support web app to an open-source CLI and recommendation-support tool for staffing agencies and SES firms."
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "Recruitment Agency", "SES"]
publishedAt: 2026-06-30
updatedAt: 2026-10-23
summary: "Grift is an in-house product that extracts \"verifiable facts\" from an engineer's git history. It does not assign scores or rankings. Because it does not use AI (LLMs) for measurement, it produces the same results no matter who runs it, allowing the recipient to verify the findings. The CLI is released as open source under the MIT License."
isDraft: false
featured: true
lang: "en"
translationSourceHash: "534f5ca8a2ffcb8af979ccb72616c1a1a884f89720a7703d659b09456c5ca795"
translatedAt: "2026-10-23T06:27:10.202Z"
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

When recommending candidates to client companies, recruiters at staffing and SES (System Engineering Services) agencies must explain why they endorse a particular individual. Yet the materials at their disposal are usually limited to résumés and interview impressions. Even if a résumé says "5 years of Java," it does not convey the substance of the work—such as what kinds of changes the engineer made and how they verified their code as they progressed.

Meanwhile, "activity metrics" like GitHub contribution graphs and commit counts can now be easily inflated using generative AI and autonomous agents. Sheer volume no longer serves as a reliable basis for recommendation. Conversely, condensing performance into a single score obscures what was measured, over what time frame, and across what sample size, turning it into a blunt screening tool. Both those making recommendations and those being recommended lacked "verifiable evidence."

## Approach

Grift began in February 2026 as a web application supporting estimates for contract development projects. While exploring sound bases for estimation, we realized that the most dependable evidence is the git history engineers build over time. In August 2026, we extracted the measurement component as a command-line tool. By September, we discontinued the original web application and shifted our focus toward supporting recruiters at staffing and SES agencies.

In designing the tool, we established three upfront commitments:

- No scores: Output test values and leave the judgment to humans. We do not generate composite scores, rankings, pass/fail decisions, or grades, and every metric always includes both a numerator and a denominator.
- Reproducible results: No AI (LLMs) is used for measurement. For the same repository and the same version, anyone running the tool gets the exact same figures.
- Zero external transmission: It runs entirely on the user's local PC. Candidates decide for themselves whether to share the results and which repositories to include.

In addition, we established a seven-article code of conduct—including "never interpret absence as negative," "never screen out candidates based on numbers alone," and "never measure others without their consent." Any usage that violates these principles may not be referred to under the methodology's name (TEP: Technical Evidence Pipeline).

## Implementation

Grift CLI extracts observations like the following using only git history:

- Attribution classification: Separates whose work it is across 11 categories, including the candidate's original commits, work by others, bots, generated/vendor deliverables, and history inherited from upstream forks
- Co-test modification rate: The proportion of commits where tests were modified alongside production code changes
- Rework rate and polishing: The proportion of reworks or re-touches to recently modified files (recorded as a behavioral tendency, not for pass/fail evaluations)
- Repository context: Number of active working days, total contributors and the top author's share of contributions, percentage of changes merged via reviews, etc.

When a sample size is under 20, the tool displays only raw counts rather than rates. Anything that could not be observed is labeled as "unobserved" with a stated reason, rather than "no track record." `grift verify` recalculates a saved report under the same conditions and returns matching, mismatched, or unverified, allowing recipients to verify whether the data has been altered or contains discrepancies.

- Repository: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- Distribution: PyPI "grift-cli" (`pipx install grift-cli`, Python 3.11+)
- License: MIT

## Outcomes

On September 8, 2026, we released v0.7.2 on PyPI. We validated the metrics across 117 public repositories, publishing both comparisons where distinctions were successfully made and those where they could not yet be made on GitHub (these are internal measurements and have not undergone third-party auditing).

We are currently preparing proof-of-concept (PoC) trials with staffing agencies and SES companies to substantiate recommendation rationales using records generated locally by candidates themselves. Following the findings from these trials, we aim to launch the official release in 2027. Grift is also featured at [griftai.org](https://griftai.org).

The philosophy behind Grift is also detailed in articles on [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) and [note](https://note.com/cor_instrument/n/nd58ba0955317).
