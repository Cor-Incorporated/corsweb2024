---
title: "Grift — Resumes can be embellished. Evidence cannot. An OSS tool that extracts verifiable facts from git history"
description: "Grift is our in-house product that extracts verifiable facts (test values)—not scores—from an engineer's git history. Here, we share its design and how its direction shifted from an estimation support web app to an open-source CLI and recommendation support tool for staffing agencies and SES firms."
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "Staffing Agency", "SES", "Recruitment"]
publishedAt: 2026-06-30
updatedAt: 2026-10-26
summary: "Grift is our in-house product that extracts \"verifiable facts\" from an engineer's git history. It assigns neither scores nor ranks. Because it does not use AI (LLMs) for measurement, it yields the same results regardless of who runs it, allowing recipients to verify the calculations themselves. The CLI is released as open-source software under the MIT license."
isDraft: false
featured: true
lang: "en"
translationSourceHash: "55cea17da0f2c5b39ce62e7acd9d278a9f47ee15e380c572f3b4a26ddc531cb7"
translatedAt: "2026-10-26T08:01:47.791Z"
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

Recruitment agencies and staffing (SES) sales representatives need to explain "why we recommend this candidate" when putting them forward to companies. However, the materials at hand are almost entirely limited to resumes and impressions from interviews. Even if a resume states "5 years of Java," it does not convey the substance of the work—such as what kinds of changes were made and how they were verified as the engineer moved forward.

Meanwhile, "activity volume," such as GitHub contributions (the contribution graph) and commit counts, can now be easily inflated using generative AI and agents. High volume is no longer reliable evidence for a recommendation. On the other hand, collapsing everything into a single score erases what was measured, over what period, and with what baseline population, turning it into a blunt screening tool. Both the party making the recommendation and the candidate being recommended lacked "verifiable materials."

## The Approach

Grift began in February 2026 as a web application supporting estimates for software contract development. In exploring the basis for these estimates, we realized that the most dependable evidence is the git history that engineers build over time. In August 2026, we extracted the measurement component into a command-line tool. In September, we discontinued the former web application and pivoted toward supporting recruitment agencies and SES sales representatives.

During the design phase, we established three initial commitments:

- Do not turn it into a score: What is output are observed values; judgment belongs to humans. We generate no composite scores, rankings, pass/fail decisions, or grades, and numerical values are always accompanied by both a numerator and a denominator.
- Identical results every time: No AI (LLMs) is used for measurement. Given the same repository and the same version, anyone executing the tool will obtain the exact same numbers.
- Transmitted nowhere: It runs exclusively on the local PC. Whether to share it, and which repositories to disclose, is entirely up to the individual.

In addition, we established a seven-article code of conduct, including rules such as "do not interpret absence as a negative," "do not screen based on numbers alone," and "do not measure others without their consent." We decided that any usage failing to adhere to these rules cannot be called by the methodology's name: TEP (Technical Evidence Pipeline).

## Implementation

Grift CLI extracts observations like the following strictly from git history:

- Attribution distinction: Differentiates whose work it was across 11 classifications, including the individual's original commits, work by others, bots, generated/vendor artifacts, and history inherited from fork sources.
- Test co-change rate: The proportion of commits where tests were modified alongside production code changes.
- Corrective rework and path retouching: The proportion of retries or re-contacts with recently touched files (recorded as a tendency, not used for pass/fail decisions).
- Repository context: Active working days, number of contributors involved, author share of the primary contributor, the proportion of commits made via code reviews, and more.

In `report-v2`, introduced in v0.6, an additional layer examines the shape of a single engineer's work. All outputs include both a numerator and a denominator, and do not represent judgments of job titles or abilities.

- Work surface (`surface_profile`): How many changes were made across 11 classifications: test / docs / CI/CD / platform / data / observability / frontend / backend / config / generated & vendor / other.
- Change rhythm (`change_rhythm`): The number of days changes were submitted within the past 180 days, along with submission intervals (median and 90th percentile, proportion of changes followed up within 2 days, proportion with gaps of 30 days or more). This does not measure working hours or motivation.
- Verification profile (`verification_profile`): The proportion of commits that touched tests and their types (unit / integration / e2e / contract / unknown), as well as the proportion of fix commits accompanied by tests.
- 4 dimensions of role (`role_profile`): Limited to four dimensions—domain / work_type / time / process_position—without collapsing them into a single job title. Output only when an identity with documented personal consent is present.

Cross-referencing with project requirements is also conducted in a way that avoids ranking. The project side declares the required surface, verification, rhythm, and input via `grift project`, and `grift align` aligns these with the candidate's observations along each axis. The alignment consists of only five outcomes: overlap, outside_declared_range, observed_zero, not_observed, or not_declared. It does not calculate aggregate scores, rankings, or pass/fail determinations. When viewed at the team level via `--team`, it outputs only the count of individuals meeting the requirements; it does not aggregate groups of fewer than three people to prevent identifying individuals.

When the sample size is under 20, rates are omitted in favor of raw counts alone, and anything that could not be observed is output as "not_observed" with an accompanying reason, rather than as "no track record." `grift verify` recalculates a saved report under the same conditions and returns match, mismatch, or unverifiable, allowing the recipient to verify whether there has been tampering or discrepancy.

The methodology is named TEP (Technical Evidence Pipeline: a pipeline for extracting technical evidence). It consists of four stages: reading git records, counting them by defined rules, attaching denominators and reasons for uncounted items to the counted values, and enabling anyone to recount them using the same procedure. Detailed explanations can be found on the [TEP page](https://griftai.org/tep) on the Grift website.

The terminology used on this page and griftai.org corresponds to the terms written in the CLI output as follows:

| Website Term | CLI Term |
|---|---|
| Observed value (検査値) | observed value (`kind: observed`; accompanied by value, unit, and denominator) |
| Test co-change rate (テスト併修率) | test co-change |
| Corrective rework rate (手戻り率) | corrective rework |
| Path retouching (磨き直し) | path retouch |
| Retention rate (定着率) | survival (only when `--survival` is specified) |
| Repository context (リポジトリの文脈) | context profile |
| Work surface, change rhythm, verification profile (作業領域・変更リズム・検証の形) | surface_profile / change_rhythm / verification_profile |

- Repository: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- Distribution: PyPI "grift-cli" (`pipx install grift-cli`, Python 3.11+)
- License: MIT
- Release Notes: [github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases) (changes by version)

## Outcomes

On September 8, 2026, we released [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/) on PyPI. The metrics were validated across 117 public repositories, and both the comparisons that could be distinguished and those that could not yet be distinguished are published on GitHub (these are internal measurements and have not been audited by a third party).

On October 25, 2026, we cross-checked the website text against the CLI output line by line. Because the multi-person list (`actor-index`) was sorted in descending order of commit counts despite a note stating "this is not a ranking," we changed the ordering to lexicographical order by ID in [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0), released on October 26, 2026. The commit count values remain. The background and the five acceptance criteria imposed on the 0.8 series are detailed in a [blog post](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/).

Currently, we are preparing proof-of-concept (PoC) trial implementations with staffing and SES companies to substantiate the reasons for recommendations based on records run locally by candidates themselves. We are also welcoming inquiries from recruiters at in-house product development companies regarding PoC trials to verify what kind of work candidates have done based on records shared by the candidates themselves. As for the official release, we aim to begin offering it in 2027 based on the results of these trial implementations. Grift is also featured at [griftai.org](https://griftai.org).

The philosophy behind Grift is also introduced in articles on [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) and [note](https://note.com/cor_instrument/n/nd58ba0955317).
