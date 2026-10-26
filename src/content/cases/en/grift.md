---
title: "Grift — Resumes can be embellished. Evidence cannot. An OSS tool that extracts verifiable facts from git history"
description: "Grift is our in-house product that extracts verifiable facts (test values) from an engineer's git history, rather than scores. This post shares the background and design of how we pivoted from an estimation support web app to an open-source CLI and recommendation support tool for staffing agencies and SES firms."
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "Recruitment Agencies", "SES"]
publishedAt: 2026-06-30
updatedAt: 2026-10-26
summary: "Grift is our in-house product that extracts \"verifiable facts\" from an engineer's git history. It assigns neither scores nor rankings. Because it does not use AI (LLMs) for measurement, it yields the same results regardless of who runs it, allowing the recipient to verify the findings independently. The CLI is released as open-source software under the MIT License."
isDraft: false
featured: true
lang: "en"
translationSourceHash: "a8dfe812f53fcb36961bc564396c501ad8a746b23ccaa423c7c09d13cd6b686f"
translatedAt: "2026-10-26T04:37:40.796Z"
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
2026-10-25: 観測の層を report-v2（作業領域・変更リズム・検証の形・役割）と grift project / align まで広げ、サイトの訳語と CLI の語の対応表を置いた。
2026-10-26: 「実装」に TEP の 4 つの段階の平易な説明と、griftai.org の TEP ページへのリンクを足した。
-->

## The Challenge

When recommending candidates to client companies, recruiters and SES sales representatives need to explain "why we recommend this person." However, the materials they have on hand are almost entirely limited to resumes and interview impressions. Even if a resume states "5 years of Java experience," it does not convey the substance of the work—what kinds of changes the engineer made, or how they verified their work as they progressed.

On the other hand, "activity metrics" such as GitHub contribution graphs ("green squares") and commit counts have become easy to inflate using generative AI and autonomous agents. High volume alone is no longer reliable evidence for a recommendation. Yet condensing everything into a single score erases what was measured, over what time frame, and against what base population, turning the metric into a crude screening tool. Both those making recommendations and those being recommended lacked "verifiable materials."

## The Approach

Grift began in February 2026 as a web application supporting contract development estimates. While exploring the basis for these estimates, we realized that the most dependable evidence lies in the git history engineers have built over time. In August 2026, we extracted the measurement component as a command-line tool. In September, we discontinued the legacy web app and pivoted toward supporting recruiters and SES sales teams.

During design, we established three initial commitments:

- No scores: Output test values, and let humans make the judgment. We produce no composite scores, rankings, pass/fail decisions, or tiers; every number always includes a numerator and a denominator.
- Deterministic results: No AI (LLMs) is used for measurement. Given the same repository and the same version, anyone running the tool gets the exact same numbers.
- Transmit nowhere: Runs entirely on the user's local PC. The engineer decides whether to share the results and which repositories to include.

In addition, we established a seven-article code of conduct, including rules such as "do not interpret absence as negative," "never screen candidates using numbers alone," and "do not measure others without their consent." Any usage that violates these rules cannot be referred to by the method's name (TEP: Technical Evidence Pipeline).

## Implementation

Grift CLI extracts observations like the following using only git history:

- Attribution distinction: Distinguishes whose work it is across 11 classifications, including the individual's original commits, work by others, bots, generated/vendor artifacts, and history inherited from upstream forks.
- Test co-change rate: The proportion of commits where tests were modified alongside production code changes.
- Corrective rework rate & path retouching: The proportion of re-dos or revisits to recently touched files (recorded as tendencies, never used for pass/fail decisions).
- Repository context: Active working days, number of contributors, commit share of the primary author, proportion of work merged via review, etc.

With `report-v2` added in v0.6, we expanded the layers for examining the shape of an individual engineer's work. All outputs include numerators and denominators, and none represent determinations of job titles or capabilities.

- Work domains (`surface_profile`): How many changes occurred in which areas across 11 categories: test / docs / CI/CD / platform / data / observability / frontend / backend / config / generated & vendor / other.
- Change rhythm (`change_rhythm`): Number of days changes were submitted within the last 180 days, and submission intervals (median and 90th percentile, proportion followed within 2 days, proportion with gaps of 30 days or more). This does not measure working hours or motivation.
- Verification profile (`verification_profile`): Proportion of commits that touched tests, their types (unit / integration / e2e / contract / unknown), and the proportion of fix commits accompanied by tests.
- Four dimensions of role (`role_profile`): Expressed strictly through four dimensions—domain / work_type / time / process_position—without collapsing them into a single job title. Output only when an identity with recorded consent is present.

Alignment with project requirements is also conducted without ranking. The project side declares required domains, verification, rhythm, and inputs using `grift project`, and `grift align` lines them up against the candidate's observations across each axis. The alignment produces only five outcomes: overlap, outside declared range (outside_declared_range), zero observed (observed_zero), not observed (not_observed), or not declared (not_declared). No overall scores, rankings, or pass/fail decisions are calculated. When viewed at a team level using `--team`, it displays only the count of individuals meeting the requirements; aggregations are not performed for fewer than three people to prevent identifying individuals.

When the base population is under 20, we present only raw counts without percentages, and anything that could not be observed is output as "not observed" with an accompanying reason, rather than "no track record." `grift verify` recalculates saved reports under identical conditions and returns match, mismatch, or unverifiable, allowing the recipient to verify tampering or discrepancies.

The method is called TEP (Technical Evidence Pipeline: the flow of extracting technical evidence). It consists of four stages: reading git records, counting according to fixed rules, attaching denominators and reasons for uncounted items to the calculated values, and enabling anyone to recount using the exact same procedure. Detailed explanations are available on the [TEP page](https://griftai.org/tep) on the Grift website.

The terminology used on this page and on griftai.org corresponds to the terms written in CLI outputs as follows:

| Website Term | CLI Term |
|---|---|
| Test value | observed value (`kind: observed`; accompanied by value, unit, and denominator) |
| Test co-change rate | test co-change |
| Rework rate | corrective rework |
| Retouching | path retouch |
| Retention rate | survival (only when `--survival` is specified) |
| Repository context | context profile |
| Work domains / Change rhythm / Verification profile | surface_profile / change_rhythm / verification_profile |

- Repository: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- Distribution: PyPI "grift-cli" (`pipx install grift-cli`, Python 3.11+)
- License: MIT
- Release Notes: [github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases) (changes by version)

## Results

On September 8, 2026, we released [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/) on PyPI. The metrics were validated against 117 public repositories, and both comparisons that could be distinguished and those that could not yet be distinguished are published on GitHub (measured internally; not audited by a third party).

On October 25, 2026, we checked the website copy against the CLI output line by line. Because the multi-person list (`actor-index`) was sorted in descending order of commit counts despite a footnote stating "not a ranking," we changed the ordering to lexicographical order by ID in [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0), released on October 26, 2026. Commit count values are retained. The background and the five acceptance criteria imposed on the 0.8 series are detailed in a [blog post](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/).

Currently, we are preparing proof-of-concept (PoC) trials with recruitment agencies and SES firms to substantiate recommendation rationales using records executed locally by the candidates themselves. We aim to launch the official release in 2027 based on the results of these trials. Grift is also featured on [griftai.org](https://griftai.org).

The philosophy behind Grift is also introduced in articles on [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) and [note](https://note.com/cor_instrument/n/nd58ba0955317).
