---
title: "Grift — Resumes can be embellished. Evidence cannot. An OSS tool that extracts verifiable facts from git history"
description: "Grift is our in-house product that extracts verifiable facts (observed values) rather than scores from an engineer's git history. Here, we share the design and background behind shifting our strategy from an estimation-support web app to an open-source CLI and recommendation-support tool for staffing agencies and SES firms."
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "Staffing Agencies", "SES", "Recruitment"]
publishedAt: 2026-06-30
updatedAt: 2026-10-28
summary: "Grift is our in-house product that extracts \"verifiable facts\" from an engineer's git history. It assigns no scores or rankings. Because it does not use AI (LLMs) for measurement, it produces the same results regardless of who runs it, allowing the receiving party to verify the calculations. The CLI is released as open-source software under the MIT license."
isDraft: false
featured: true
lang: "en"
translationSourceHash: "ed8b2d807036f1d1157b45ef4600db884b5b4e3ba81d095feec7e68f891ccb08"
translatedAt: "2026-10-27T17:17:22.771Z"
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
2026-10-27: 0.9.0 のレポートの形（先頭の進め方の文と面談の問い、本人の同意の条件、観点の呼び名）と、0.9.0 の公開を足した。
2026-10-28: 0.9.1 の公開を「成果」に足した（日付は PyPI に上げた日。#446 の手順で確かめる）。
-->

## Challenges

When staffing agencies and SES (System Engineering Services) sales representatives recommend candidates to companies, they need to explain "why they are recommending this person." However, the materials available at hand are almost entirely limited to resumes and interview impressions. Even if a resume states "5 years of Java," it does not convey the substance of the work—what kinds of changes were made, and how they were verified along the way.

Meanwhile, "activity volume," such as GitHub contribution graphs and commit counts, can now be easily inflated using generative AI and autonomous agents. High volume is no longer reliable evidence for a recommendation. On the other hand, collapsing everything into a single score obscures what was measured, over what time frame, and against what sample size, turning it into a blunt screening tool. Both the party making the recommendation and the candidate being recommended lacked "verifiable evidence."

## Approach

Grift began in February 2026 as a web application supporting estimates for contract development. While exploring the basis for these estimates, we realized that the most reliable material is the git history accumulated by the engineer. In August 2026, we extracted the measurement component as a command-line tool. In September, we discontinued the legacy web application and shifted our focus toward supporting staffing agencies and SES sales teams.

During the design phase, we established three core commitments upfront:

- Do not turn it into a score: What we provide are observed values; human beings make the judgments. We do not output composite scores, rankings, pass/fail results, or grades, and every numerical value is accompanied by a numerator and a denominator.
- Identical results every time: We do not use AI (LLMs) for measurement. For the same repository and the same version, anyone running it will get the exact same numbers.
- Transmit nowhere: It runs entirely on the local PC. Candidates decide for themselves whether to share the results and which repositories to present.

Alongside these commitments, we established seven codes of conduct, including "do not interpret absence negatively," "do not screen candidates based solely on numerical values," and "do not measure others without their consent." Any usage that violates these rules may not be referred to by the method's name (TEP: Technical Evidence Pipeline).

## Implementation

The Grift CLI extracts the following observations solely from git history:

- Attribution distinction: Separates whose work it is across 11 classifications, including the individual's original commits, work by others, bots, generated or vendor artifacts, and history inherited from upstream forks.
- Test co-change: The proportion of commits where tests were modified alongside production code changes.
- Corrective rework and path retouch: The proportion of rework or re-touching of recently modified files (recorded as tendencies, not used for pass/fail decisions).
- Repository context: Active working days, number of contributors, commit share of the top author, proportion of changes made via code reviews, and more.

In `report-v2`, added in v0.6, we expanded the layers that observe an engineer's work patterns. All are provided with numerators and denominators, and none represent assessments of job titles or abilities.

- Work surface (`surface_profile`): How many changes occurred across 11 areas: test / docs / CI/CD / platform / data / observability / frontend / backend / config / generated/vendor / other.
- Change rhythm (`change_rhythm`): The number of days changes were submitted within the past 180 days, along with submission intervals (median and 90th percentile, proportion of submissions continuing within 2 days, proportion with gaps of 30 days or more). This does not measure working hours or motivation.
- Verification profile (`verification_profile`): The proportion of commits that touched tests, the types of tests (unit / integration / e2e / contract / unknown), and the proportion of fix commits accompanied by tests.
- 4 dimensions of roles (`role_profile`): Composed solely of domain / work_type / time / process_position, without collapsing into a single job title. Output only when an identity with recorded consent is present.

Alignment with project requirements is also conducted without assigning ranks. The project side declares the required domains, verification, rhythm, and inputs via `grift project`, and `grift align` aligns them axis by axis against the candidate's observations. The alignment consists of only five states: overlap, outside_declared_range, observed_zero, not_observed, and not_declared, without calculating overall scores, rankings, or pass/fail outcomes. When viewed at the team level with `--team`, only the headcount meeting the requirements is displayed; aggregations are not performed for fewer than three people to prevent identifying individuals.

When the sample size is under 20, we present only counts rather than percentages, and unobserved items are output with stated reasons as "not observed" rather than "no track record." `grift verify` recalculates saved reports under identical conditions and returns match, mismatch, or unverifiable, enabling recipients to verify whether modifications or discrepancies exist.

Starting with 0.9.0, the top of the `grift actor` Markdown output includes short sentences describing the work style visible from the records. It details the categories of modified areas, the pace of changes, testing practices, and collaboration style, accompanied by counts and time periods. This is followed by what cannot be seen from these records, listing questions intended for verification during interviews. `grift project` describes the project repository's workflow under the same rules, omitting individual numbers and collaboration patterns. `grift align` pairs the alignment of requirements and records with interview verification questions. These sentences and questions are selected from numbers using a published [decision table](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/trait-profile.md) without using AI. Because they are not included in the JSON, what can be verified with `grift verify` are the underlying numbers from which the sentences were derived.

Sentences and questions concerning individuals are output only when an ID self-identified by the individual has recorded consent. In all other cases, a single-sentence reason for non-disclosure is written. When displaying multiple individuals together (`--all`, `--top`), these sentences are omitted.

The method is called TEP (Technical Evidence Pipeline: a pipeline for extracting technical evidence). It consists of four stages: reading git records, counting according to predetermined rules, attaching denominators and reasons for uncounted items to the tallied values, and enabling anyone to recount them using the exact same procedure. A detailed explanation can be found on the [TEP page](https://griftai.org/tep) on the Grift website.

The terminology used on this page and griftai.org corresponds to the terms output by the CLI as follows:

| Term on Website | Term in CLI |
|---|---|
| Observed values | observed value (`kind: observed`; includes value, unit, and denominator) |
| Test co-change | test co-change |
| Corrective rework | corrective rework |
| Path retouch | path retouch |
| Code recency | survival (only when `--survival` is specified) |
| Repository context | context profile |
| Work surface, change rhythm, verification profile | surface_profile / change_rhythm / verification_profile |

Starting with 0.9.0, the CLI's Markdown output also refers to the four perspectives—classification of modified areas (work surface), change pace (change rhythm), testing approach (verification profile), and collaboration style—using the same naming as griftai.org. JSON keys remain unchanged.

- Repository: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- Distribution: PyPI "grift-cli" (`pipx install grift-cli`, Python 3.11+)
- License: MIT
- Release Notes: [github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases) (changes by version)

## Results

On September 8, 2026, we released [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/) on PyPI. The metrics were verified against 117 public repositories, and both the comparisons that could be distinguished and those that could not yet be distinguished are published on GitHub (measured internally; not audited by third parties).

On October 25, 2026, we conducted a line-by-line comparison between the website text and the CLI output. Because the multi-person list (`actor-index`) was ordered by commit count descending despite notes stating "not a ranking," we changed the ordering to lexicographical by ID in [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0), released on October 26, 2026. Commit count values were retained. The context and the five acceptance criteria imposed on the 0.8 series are described in our [blog post](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/).

In [0.9.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0), released on October 27, 2026, we added the introductory summary sentences and interview questions mentioned above. At the same time, we removed the tendency "strength" row and the alignment "direction" row from the Markdown output, as placing two reports side-by-side could lead to interpretations of strong vs. weak or suitable vs. unsuitable candidates. We also corrected four areas where numbers not reflecting the facts about individuals could potentially be produced.

In [0.9.1](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.1), released on October 28, 2026, we fixed areas discovered after 0.9.0 where numbers contrary to fact could potentially be output regarding individuals or projects. There are no new commands, and the policy of not outputting scores, rankings, or type labels remains unchanged. Because the definition version changed, reports saved in 0.9.0 cannot be verified using `grift verify` in 0.9.1.

Currently, we are preparing proof-of-concept (PoC) trials with staffing agencies and SES companies to substantiate recommendation rationales based on records run locally by candidates themselves. We are also accepting consultations for PoC trials from hiring managers at in-house development companies who wish to verify what kind of work candidates have done based on records shared by candidates themselves. We aim to launch the official version in 2027, incorporating findings from these trials. Grift is also introduced at [griftai.org](https://griftai.org).

The philosophy behind Grift is also shared in articles on [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) and [note](https://note.com/cor_instrument/n/nd58ba0955317).
