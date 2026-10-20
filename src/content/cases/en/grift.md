---
title: "Grift — Resumes Can Be Embellished. Evidence Cannot. An OSS Tool Extracting Verifiable Facts from Git History"
description: "Grift is our in-house product that extracts verifiable facts (test values)—not scores—from an engineer's git history. We introduce the design and the background behind shifting our direction from an estimation support web app to an OSS CLI and recommendation support tool for staffing agencies and SES providers."
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "Recruitment", "SES"]
publishedAt: 2026-06-30
updatedAt: 2026-10-20
summary: "Grift is an in-house product that extracts \"verifiable facts\" from an engineer's git history. Without assigning scores or rankings, and without using AI (LLMs) for measurement, it produces the same results no matter who runs it, allowing recipients to verify the calculations themselves. The CLI is released as open-source software under the MIT license."
isDraft: false
featured: true
lang: "en"
translationSourceHash: "50b777323f44c9fba4e13fe092c2a49e5ad8d2299c657eda38c22deedf720613"
translatedAt: "2026-10-20T03:23:26.548Z"
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

When recommending candidates to client companies, sales representatives at recruitment agencies and SES (System Engineering Services) firms need to explain *why* they are endorsing that particular person. However, the materials available at hand are mostly limited to resumes and impressions from interviews. Even if a resume states "5 years of Java," it does not convey the substance of the work—such as what kinds of changes were made and how they were verified during the process.

Meanwhile, "activity volume," such as GitHub contribution graphs and commit counts, can now easily be inflated using generative AI and agents. A high volume alone can hardly serve as grounds for a recommendation anymore. On the other hand, condensing everything into a single score obscures what was measured, over what period, and against what base population, leading to its misuse as a blunt filtering tool. Both those making recommendations and those being recommended lacked "verifiable materials."

## Approach

Grift began in February 2026 as a web application supporting estimates for custom software development. While exploring grounds for estimates, we realized that the most reliable material is the git history accumulated by engineers themselves, and in August 2026, we extracted the measurement component as a command-line tool. In September, we discontinued the former web application and pivoted toward supporting sales representatives at recruitment agencies and SES firms.

In our design, we established three core commitments upfront:

- **Do not turn it into a score** — We output test values; humans make the judgment. We do not produce composite scores, rankings, pass/fail results, or grades, and numerical values are always accompanied by both a numerator and a denominator.
- **Identical results every time** — We do not use AI (LLMs) for measurement. For the same repository and the same version, anyone running it will get the exact same numbers.
- **Send nowhere** — It runs solely on the local PC. Candidates themselves decide whether to share the results and which repositories to present.

In addition, we established a 7-article code of conduct, including principles such as "do not interpret absence as a negative," "do not filter candidates based solely on numerical values," and "do not measure others without their consent." We set a rule that any usage failing to uphold these principles must not be referred to by the method's name (TEP: Technical Evidence Pipeline).

## Implementation

Grift CLI extracts observations like the following exclusively from git history:

- **Attribution distinction**: Differentiates whose work it is across 11 classifications, including the individual's original commits, others' work, bots, generated/vendor deliverables, and history inherited from upstream forks.
- **Test co-modification rate**: The proportion of commits that modify tests in the same commit as production code changes.
- **Rework rate / refinement**: The rate of redos and touches on recently modified files (recorded as a trend; not used for pass/fail decisions).
- **Repository context**: Active working days, number of contributors involved, share of the primary author, proportion merged via review, etc.

When the base population is under 20, it displays only counts rather than percentages, and items that could not be observed are reported as "unobserved" with a stated reason, rather than "no track record." `grift verify` recalculates a saved report under the same conditions and returns match, mismatch, or unverifiable, allowing recipients to verify whether there has been tampering or discrepancies.

- Repository: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- Distribution: PyPI "grift-cli" (`pipx install grift-cli`, Python 3.11 or higher)
- License: MIT

## Results

On September 8, 2026, we released v0.7.2 on PyPI. The metrics were validated across 117 public repositories, and we have published on GitHub both the comparisons where distinctions could be made and those where distinctions could not yet be made (these are internal measurements and have not undergone third-party audit).

Currently, we are preparing proof-of-concept (PoC) trials with recruitment agencies and SES companies to substantiate recommendation rationales based on records run locally by the candidates themselves. We aim to launch the official version in 2027 based on the results of these pilot deployments. Grift is also introduced at [griftai.org](https://griftai.org).

The philosophy behind Grift is also shared in our articles on [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) and [note](https://note.com/cor_instrument/n/nd58ba0955317).
