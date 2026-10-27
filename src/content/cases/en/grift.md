---
title: "Grift — Resumes can be embellished. Evidence cannot. An OSS tool that extracts verifiable facts from git history"
description: "Grift is our in-house product that extracts verifiable facts (observed values) rather than scores from an engineer's git history. Here, we introduce the background and design behind our strategic pivot from an estimation-support web app to an open-source CLI and recommendation support tool for staffing agencies and SES providers."
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "Staffing Agencies", "SES", "Recruitment"]
publishedAt: 2026-06-30
updatedAt: 2026-10-27
summary: "Grift is our in-house product that extracts \"verifiable facts\" from an engineer's git history. It assigns neither scores nor rankings. Because it does not use AI (LLMs) for measurement, it yields the same results no matter who runs it, allowing the recipient to verify the findings independently. The CLI is released as open source under the MIT license."
isDraft: false
featured: true
lang: "en"
translationSourceHash: "da19a3405dd6186a0445998301689944702384c944e88e2a060326cfa32ee36d"
translatedAt: "2026-10-27T13:51:35.248Z"
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
-->

## The Challenge

Staffing agencies and SES (System Engineering Service) sales reps need to explain *why* they are recommending a candidate when presenting them to a company. However, the materials on hand are almost entirely limited to resumes and impressions from interviews. Even if a resume says "5 years of Java," it does not convey the substance of the work—what kinds of changes were made, and how they were verified along the way.

Meanwhile, "activity volume," such as GitHub contribution graphs and commit counts, has become easy to inflate using generative AI and agents. A high volume is no longer solid grounds for a recommendation. On the other hand, collapsing everything into a single score obscures what was measured, over what period, and across what sample size, turning it into a blunt screening tool. Both those making recommendations and those being recommended lacked "verifiable evidence."

## The Approach

Grift began in February 2026 as a web application supporting estimates for contract development. While looking for the rationale behind estimates, we realized that the most reliable material is the git history that engineers have built up themselves. In August 2026, we carved out the measurement part as a command-line tool. In September, we discontinued the legacy web app and pivoted toward supporting sales at staffing agencies and SES companies.

In our design, we made three upfront commitments:

- Do not turn it into a score: What we provide are observed values, and humans make the judgment. We do not generate composite scores, rankings, pass/fail results, or grades, and numerical values always include a numerator and a denominator.
- Identical results every time: We do not use AI (LLMs) for measurement. For the same repository and the same version, anyone running it will get the exact same numbers.
- Transmit nowhere: It runs entirely on the local PC. The individual decides whether to share it and which repositories to present.

In addition, we established seven codes of conduct—such as "Do not interpret absence negatively," "Do not screen candidates based solely on numbers," and "Do not measure others without their consent"—and decided that any usage not adhering to these must not be referred to by the method's name (TEP: Technical Evidence Pipeline).

## Implementation

The Grift CLI extracts the following observations solely from git history:

- Attribution distinction: Distinguishes whose work it is across 11 classifications, including the individual's original commits, work by others, bots, generated/vendor artifacts, and history inherited from upstream forks.
- Test co-change: The proportion of commits where tests were modified in the same commit as production code changes.
- Corrective rework and path retouch: The rate of rework or re-touching of recently touched files (a record of tendencies, not used for pass/fail decisions).
- Repository context: Active days, number of contributors, commit share of the top contributor, proportion of changes made via review, etc.

In `report-v2`, added in v0.6, additional layers capture the shape of an individual engineer's work. All of them come with a numerator and a denominator and are not assessments of job title or ability.

- Work surface (`surface_profile`): How many changes were made in which areas, across 11 categories: test / docs / CI/CD / platform / data / observability / frontend / backend / config / generated & vendor / other.
- Change rhythm (`change_rhythm`): The number of days changes were submitted out of the last 180 days, and the submission interval (median and 90th percentile, rate of consecutive submissions within 2 days, rate of gaps of 30 days or more). This does not represent working hours or motivation.
- Verification profile (`verification_profile`): The proportion of commits that touched tests and their types (unit / integration / e2e / contract / unknown), as well as the proportion of fix commits accompanied by tests.
- 4 dimensions of roles (`role_profile`): Composed solely of four dimensions—domain / work_type / time / process_position—without collapsing into a single job title. Only output when there is an identity with recorded consent from the individual.

Matching against project requirements is also performed without assigning ranks. The project side declares the required areas, verification, rhythm, and inputs via `grift project`, and `grift align` aligns them with the candidate's observations along each axis. The alignment has only 5 possibilities: overlap, outside_declared_range, observed_zero, not_observed, and not_declared, with no aggregate scores, rankings, or pass/fail decisions calculated. When viewing at the team level with `--team`, it outputs only the number of people meeting the requirements; for fewer than 3 people, it does not aggregate to prevent identifying individuals.

When the denominator is less than 20, it displays only the count without showing percentages, and items that could not be observed are output as "not observed" with a reason, rather than "no track record." `grift verify` recalculates a saved report under the same conditions and returns match, mismatch, or unverifiable, allowing the recipient to verify whether there were alterations or discrepancies.

Starting from 0.9.0, the top of the Markdown in `grift actor` describes the work style apparent from the record in short sentences. It describes the breakdown of modified areas, the pace of changes, the way tests were added, and the mode of involvement, accompanied by counts and timeframes; this is followed by what cannot be seen from this record, laying out things to verify in an interview in the form of questions. `grift project` describes the approach of a project's repository following the same rules, omitting individual numbers and modes of involvement. `grift align` supplements the alignment of requirements and records with things to verify in an interview in question form. The sentences and questions are selected from numbers using a published [decision table](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/trait-profile.md) without using AI. Because they are not included in the JSON, what can be verified with `grift verify` are the underlying numbers behind the text.

Sentences and questions about a person are output only for an ID claimed by the individual with a record of consent. Otherwise, a single sentence stating the reason for not displaying them is provided. When outputting multiple people together (`--all`, `--top`), no sentences are output.

The method is named TEP (Technical Evidence Pipeline). It consists of four stages: reading git records, counting them according to fixed rules, attaching denominators and reasons for uncounted items to the counted values, and making it possible for anyone to recount them following the same procedure. For a detailed explanation, see the [TEP page](https://griftai.org/tep) on the Grift website.

The terminology used on this page and griftai.org corresponds to the terms written in the CLI output as follows:

| Term on the website | Term in the CLI |
|---|---|
| Observed values | observed value (`kind: observed`; includes value, unit, and denominator) |
| Test co-change | test co-change |
| Corrective rework | corrective rework |
| Path retouch | path retouch |
| Code recency | survival (only when `--survival` is specified) |
| Repository context | context profile |
| Work surface, change rhythm, verification profile | surface_profile / change_rhythm / verification_profile |

Starting from 0.9.0, the CLI's Markdown also uses the same terms as griftai.org for the four perspectives: breakdown of modified areas (work surface), pace of changes (change rhythm), way of adding tests (verification profile), and mode of involvement. The JSON keys remain unchanged.

- Repository: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- Distribution: PyPI "grift-cli" (`pipx install grift-cli`, Python 3.11+)
- License: MIT
- Release notes: [github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases) (changes by version)

## Achievements

On September 8, 2026, we released [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/) on PyPI. The metrics were verified across 117 public repositories, and both comparisons that could be distinguished and those that could not yet be distinguished are published on GitHub (measured internally; not audited by a third party).

On October 25, 2026, we compared the website wording with the CLI output line by line. Because the multi-person list (`actor-index`) was sorted in descending order of commit count despite noting "not a ranking," we changed the ordering to lexicographical order of IDs in [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0), released on October 26, 2026. The commit count values remain. The background and the five acceptance criteria imposed on the 0.8 series are described in a [blog post](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/).

In [0.9.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0), released on October 27, 2026, we added the opening sentences and interview questions for the reports mentioned above. At the same time, we removed the tendency "strength" row and the alignment "orientation" row from the Markdown. This is because comparing two reports could make them appear as strong vs. weak individuals, or matching vs. unmatching individuals. We also fixed four places where numbers differing from fact could be produced regarding individuals.

Currently, we are preparing proof-of-concept (PoC) trials with staffing agencies and SES companies to substantiate the reasons for recommendations based on records executed locally by the candidates themselves. We are also accepting inquiries from hiring managers at in-house development companies regarding PoC trials to verify what kind of work candidates have done based on records shared by the candidates themselves. We aim to start providing the official release in 2027 based on the results of these PoC trials. Grift is also introduced on [griftai.org](https://griftai.org).

The philosophy behind Grift is also featured in articles on [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) and [note](https://note.com/cor_instrument/n/nd58ba0955317).
