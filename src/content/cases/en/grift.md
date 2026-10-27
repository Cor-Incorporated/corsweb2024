---
title: "Grift — Resumes can be embellished. Evidence cannot. An OSS tool that extracts verifiable facts from git history"
description: "Grift is our in-house product that extracts verifiable facts (observed values), not scores, from engineers' git history. Here, we share the background and architecture behind our strategic shift from an estimation-support web app to an open-source CLI and recommendation-support tool for staffing agencies and SES firms."
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "Staffing Agency", "SES", "Recruitment"]
publishedAt: 2026-06-30
updatedAt: 2026-10-27
summary: "Grift is our in-house product that extracts \"verifiable facts\" from engineers' git history. It assigns neither scores nor rankings. Because it does not use AI (LLMs) for measurement, it produces the exact same results no matter who runs it, allowing recipients to verify the calculations themselves. The CLI is released as open source under the MIT License."
isDraft: false
featured: true
lang: "en"
translationSourceHash: "2d0234e5c92330288c63b5013c89e63f3ced54357eaa2a69eb5d59ba4b7873bc"
translatedAt: "2026-10-27T13:43:03.871Z"
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

## Challenges

When recommending candidates to client companies, recruitment agency consultants and sales representatives at SES (System Engineering Services) firms need to explain "why we recommend this person." However, the materials available at hand are almost exclusively limited to resumes and impressions from interviews. Even if a resume states "5 years of Java," it does not convey the actual substance of the work—what kind of changes the person made and how they verified their work as they proceeded.

On the other hand, "activity volume," such as GitHub contribution graphs ("grass") or commit counts, can now be easily inflated using generative AI and coding agents. A high volume of activity can no longer serve as reliable grounds for a recommendation. Conversely, condensing everything into a single score obscures what was measured, over what time period, and against what sample size, turning it into a blunt tool for screening people out. Both those making recommendations and those being recommended lacked "verifiable evidence."

## Approach

Grift began in February 2026 as a web application supporting estimates for contract development projects. As we explored the grounds for accurate estimation, we realized that the most dependable evidence is the git history itself built up by engineers. In August 2026, we carved out the measurement component as a command-line tool. In September, we discontinued the former web application and pivoted toward supporting sales representatives at recruitment agencies and SES firms.

In our design, we established three commitments upfront:

- Do not reduce to scores: We output observed values, and humans make the judgments. We do not produce composite scores, rankings, pass/fail decisions, or grades, and numerical values are always accompanied by numerators and denominators.
- Identical results every time: We do not use AI (LLMs) for measurement. With the same repository and the same version, anyone running it will get identical figures.
- Never sent anywhere: It runs solely on the local PC. Whether to share and which repositories to present is determined entirely by the individual.

In addition, we established seven codes of conduct, including "do not read absence as a negative," "do not screen out based solely on numbers," and "do not measure others without their consent." We instituted a rule that any usage failing to adhere to these standards cannot be referred to by the name of the methodology (TEP: Technical Evidence Pipeline).

## Implementation

Grift CLI extracts observations such as the following solely from git history:

- Attribution distinction: Distinguishes whose work it is across 11 classifications, including the individual's own commits, others' work, bots, generated or vendor artifacts, and history inherited from upstream forks.
- Test co-change: The proportion of commits where tests were modified alongside changes to production code.
- Corrective rework and path retouch: The rate of rework or re-touching of recently modified files (recorded as tendencies and not used for pass/fail decisions).
- Repository context: Active working days, number of contributors involved, the share of the most frequent author, the proportion of changes made via code review, etc.

With `report-v2` added in v0.6, we expanded the layers that examine the shape of an individual engineer's work. All figures come with numerators and denominators and do not represent judgments of job titles or abilities.

- Work surface (`surface_profile`): How many changes were made in which domain across 11 categories: test / docs / CI/CD / platform / data / observability / frontend / backend / config / generated & vendor / other.
- Change rhythm (`change_rhythm`): The number of days changes were submitted out of the last 180 days, and the intervals between submissions (median and 90th percentile, percentage followed within 2 days, percentage spaced out by 30 days or more). This does not measure working hours or motivation.
- Verification profile (`verification_profile`): The proportion of commits that touched tests, their types (unit / integration / e2e / contract / unknown), and the proportion of bug-fix commits accompanied by tests.
- Four dimensions of roles (`role_profile`): Composed solely of four aspects—domain / work_type / time / process_position—without collapsing them into a single job title. Output only when there is an identity with recorded consent from the individual.

Alignment with project requirements is also conducted without assigning ranks. The project side declares the required domain, verification, rhythm, and input in `grift project`, and `grift align` aligns them side by side with the candidate's observations along each axis. The alignments are strictly limited to five states: overlap, outside_declared_range, observed_zero, not_observed, and not_declared; composite scores, rankings, and pass/fail evaluations are not calculated. When viewing at the team level with `--team`, it only outputs the number of people meeting the requirements, and to prevent individuals from being identified, no aggregation is performed for fewer than three people.

When the sample size is under 20, rates are omitted and only counts are shown; things that could not be observed are marked as "not observed" with reasons, rather than "no track record." `grift verify` recalculates saved reports under the identical conditions and returns match, mismatch, or unverifiable, allowing the recipient to verify whether there were alterations or discrepancies.

Starting in 0.9.0, a short summary describing the way work was conducted as reflected in the record is placed at the beginning of the Markdown output for `grift actor`, `grift project`, and `grift align`. It details the categories of modified areas, the pace of changes, the approach to adding tests, and the style of involvement, accompanied by counts and time periods; this is followed by what cannot be seen from this record, and lists questions for clarification during an interview. The sentences are selected from numbers using a published [decision table](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/trait-profile.md). No AI is used, and these are not included in the JSON output.

Statements and questions regarding an individual are output only when there is a self-identified ID with a record of consent. Otherwise, a single sentence stating the reason for omission is displayed. When displaying multiple individuals together (`--all`, `--top`), sentences are not output.

The name of the methodology is TEP (Technical Evidence Pipeline). It consists of four stages: reading git records, counting them according to fixed rules, attaching denominators to counted values along with reasons for what could not be counted, and enabling anyone to recount following the same procedure. A detailed explanation can be found on the [TEP page](https://griftai.org/tep) on the Grift website.

The terms used on this page and on griftai.org correspond to the terms written in the CLI output as follows:

| Term on Website | Term in CLI |
|---|---|
| Observed values | observed value (`kind: observed`; accompanied by value, unit, and denominator) |
| Test co-change | test co-change |
| Corrective rework | corrective rework |
| Path retouch | path retouch |
| Code recency | survival (only when `--survival` is specified) |
| Repository context | context profile |
| Work surface / change rhythm / verification profile | surface_profile / change_rhythm / verification_profile |

Starting from 0.9.0, the CLI's Markdown also uses the same terms as griftai.org for the four perspectives: categories of modified areas (work surface), pace of changes (change rhythm), approach to adding tests (verification profile), and style of involvement. The JSON keys remain unchanged.

- Repository: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- Distribution: PyPI "grift-cli" (`pipx install grift-cli`, Python 3.11 or higher)
- License: MIT
- Release Notes: [github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases) (changes per version)

## Results

On September 8, 2026, we released [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/) on PyPI. Metrics were verified across 117 public repositories, and both comparisons that could be distinguished and those that could not yet be distinguished are published on GitHub (measured internally; not audited by a third party).

On October 25, 2026, we checked the text on the website line by line against the CLI output. Because the multi-person list (`actor-index`) was sorted in descending order of commit counts despite a note stating "not a ranking," we changed the ordering to alphabetical by ID in [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0), released on October 26, 2026. Commit count values are retained. The background and the five acceptance criteria imposed on the 0.8 series were detailed in a [blog post](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/).

In [0.9.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0), released on October 27, 2026, we added the introductory summary text and interview questions to the report mentioned above. Along with this, we removed the trend "strength" row and the alignment "suitability" row from the Markdown output. This was because placing two reports side by side could lead to interpretations of strong vs. weak individuals, or suitable vs. unsuitable candidates. We also fixed four places where figures differing from the facts about an individual could potentially be generated.

Currently, we are preparing proof-of-concept (PoC) trials with recruitment agencies and SES firms to substantiate the reasons for candidate recommendations based on records run locally by the candidates themselves. We are also welcoming inquiries from hiring managers at in-house product development companies for PoC trials to verify what kind of work candidates have done based on records shared by the candidates themselves. We aim to launch the official version in 2027 based on the results of these trials. Grift is also featured on [griftai.org](https://griftai.org).

The philosophy behind Grift is also introduced in articles on [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) and [note](https://note.com/cor_instrument/n/nd58ba0955317).
