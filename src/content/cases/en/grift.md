---
title: "Grift — Resumes can be embellished. Evidence cannot. An OSS tool that extracts verifiable facts from git history"
description: "Grift is our in-house product that extracts verifiable facts (test values) from an engineer's git history, rather than arbitrary scores. Here is how and why we shifted direction from an estimation-support web app to an open-source CLI and recommendation-support tool for staffing agencies and SES companies, along with its design."
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "Staffing & Recruitment", "SES"]
publishedAt: 2026-06-30
updatedAt: 2026-10-26
summary: "Grift is an in-house product that extracts \"verifiable facts\" from an engineer's git history. It assigns neither scores nor rankings. Because it does not use AI (LLMs) for measurement, it yields the exact same results regardless of who runs it, allowing the recipient to verify the numbers independently. The CLI is released as open source software under the MIT license."
isDraft: false
featured: true
lang: "en"
translationSourceHash: "3e040444b57b65105b31020423b445f7e2670d2f2e3b6da65bf6bbeaed4d4660"
translatedAt: "2026-10-25T15:05:49.533Z"
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

## Challenges

When staffing agencies or SES sales representatives recommend a candidate to a company, they need to explain why they are recommending that person. However, the materials they have on hand consist almost entirely of resumes and interview impressions. Even if a resume states "5 years of Java," it does not convey the substance of the work—such as what kind of changes were made and how they were verified along the way.

At the same time, "activity volume"—such as GitHub contribution graphs and commit counts—has become easy to inflate using generative AI and agents. High volume is no longer reliable grounds for a recommendation. On the other hand, collapsing everything into a single score erases what was measured, over what period, and from what sample size, causing it to be used as a blunt filtering tool. Both those making recommendations and those being recommended lacked "verifiable materials."

## Approach

Grift began in February 2026 as a web application supporting estimates for contract development. While exploring the rationale behind estimates, we realized that the most reliable material is the git history that engineers have built up themselves. In August 2026, we extracted the measurement component as a command-line tool. In September, we discontinued the former web application and pivoted our direction toward supporting staffing agencies and SES sales teams.

In our design, we established three commitments upfront:

- Do not turn it into a score: We provide observed values; human beings make the judgment. We do not produce composite scores, rankings, pass/fail decisions, or grades, and every number is always accompanied by a numerator and a denominator.
- Identical results every time: We do not use AI (LLMs) for measurement. For the same repository and the same version, anyone running it gets the exact same numbers.
- Send nowhere: It runs entirely on the local PC. Whether to share it, and which repositories to present, is decided by the individuals themselves.

Additionally, we established seven codes of conduct—including "do not interpret absence as negative," "do not screen candidates based on numbers alone," and "do not measure others without their consent." We set a rule that any usage failing to adhere to these must not be referred to by the method's name (TEP: Technical Evidence Pipeline).

## Implementation

Grift CLI extracts observations such as the following solely from git history:

- Attribution distinction: Separates whose work it is across 11 classifications, including the individual's original commits, work by others, bots, generated/vendor artifacts, and history inherited from upstream forks.
- Test co-change rate: The proportion of commits modifying production code that also modify tests in the same commit.
- Corrective rework rate / path retouch: The proportion of rework or re-engagement with recently touched files (recorded as a trend, not used for pass/fail judgments).
- Repository context: Working days, number of contributors involved and the dominant author's share, proportion of changes via review, etc.

With `report-v2` added in v0.6, we introduced an additional layer for examining an individual engineer's work patterns. All metrics come with numerators and denominators and are not judgments of job role or capability.

- Surface profile (`surface_profile`): How many changes occurred across which domains, categorized into 11 classifications: test / docs / CI/CD / platform / data / observability / frontend / backend / config / generated & vendor / other.
- Change rhythm (`change_rhythm`): The number of days changes were submitted within the last 180 days, and the intervals between submissions (median and 90th percentile, proportion of follow-ups within 2 days, proportion of gaps of 30 days or more). This does not represent working hours or motivation.
- Verification profile (`verification_profile`): The proportion of commits touching tests, their types (unit / integration / e2e / contract / unknown), and the proportion of fix commits accompanied by tests.
- 4 dimensions of roles (`role_profile`): Limited to four dimensions—domain / work_type / time / process_position—without collapsing into a single job role. This is output only when an identity with recorded consent from the individual is present.

Alignment with project requirements is also performed without assigning rankings. The project side declares the required surface, verification, rhythm, and inputs using `grift project`, and `grift align` lines them up side by side with the candidate's observations across each dimension. The alignment is categorized into only five states—overlap, outside_declared_range, observed_zero, not_observed, and not_declared—with no calculation of overall scores, rankings, or pass/fail decisions. When viewing on a team basis using `--team`, it only outputs the count of individuals meeting the requirements; to prevent personal identification, it does not aggregate groups of fewer than 3 people.

When the sample size is under 20, it displays only counts rather than percentages, and unobserved items are output not as "no track record," but as "not_observed" with a stated reason. `grift verify` recalculates saved reports under the same conditions and returns match, mismatch, or unverifiable, allowing the receiving party to verify against alterations or discrepancies.

The method is called TEP (Technical Evidence Pipeline). It consists of four stages: reading git records, counting by fixed rules, attaching denominators and reasons for uncounted items to the calculated values, and ensuring that anyone can recount them following the exact same procedure. A detailed explanation can be found on the [TEP page](https://griftai.org/tep) on the Grift website.

The terminology used on this page and griftai.org corresponds to the terms written in the CLI output as follows:

| Term on Website | Term in CLI |
|---|---|
| Observed value | observed value (`kind: observed`; accompanied by value, unit, and denominator) |
| Test co-change rate | test co-change |
| Rework rate | corrective rework |
| Retouch | path retouch |
| Survival rate | survival (only when `--survival` is specified) |
| Repository context | context profile |
| Surface, change rhythm, verification profile | surface_profile / change_rhythm / verification_profile |

- Repository: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- Distribution: PyPI "grift-cli" (`pipx install grift-cli`, Python 3.11 or higher)
- License: MIT

## Outcomes

On September 8, 2026, we released v0.7.2 on PyPI. The metrics were verified across 117 public repositories, and we have published on GitHub both the comparisons where distinctions could be made and those where distinctions could not yet be made (these are internal measurements and have not undergone third-party audits).

On October 25, 2026, we compared the wording on the website line-by-line with the CLI output. Because the multi-person listing (`actor-index`) was sorted in descending order of commit counts despite a note stating "not a ranking," the next release (0.8) will change the order to lexicographical order of IDs. The commit count values will be retained. We described the background and the five acceptance criteria imposed on the 0.8 series in a [blog post](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/).

We are currently working with staffing agencies and SES companies to prepare proof-of-concept (PoC) deployments aimed at substantiating recommendation reasons based on records candidates run locally themselves. Based on the results of these pilot deployments, we aim to begin offering the official version in 2027. Grift is also introduced at [griftai.org](https://griftai.org).

The philosophy behind Grift is also introduced in articles on [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) and [note](https://note.com/cor_instrument/n/nd58ba0955317).
