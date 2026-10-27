---
title: "Grift — Resumes Can Be Exaggerated. Evidence Cannot. An OSS Tool Extracting Verifiable Facts from Git History"
description: "Grift is an in-house product that extracts verifiable facts (observed values)—not scores—from engineers' git history. Here is the background and design of how it shifted from an estimation support web app to an OSS CLI and recommendation support tool for recruitment agencies and SES firms."
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "Recruitment Agencies", "SES", "Hiring"]
publishedAt: 2026-06-30
updatedAt: 2026-10-27
summary: "Grift is an in-house product that extracts \"verifiable facts\" from engineers' git history. It does not assign scores or rankings. Because it does not use AI (LLMs) for measurement, anyone running it gets the same results, allowing recipients to verify them independently. The CLI is released as open-source software under the MIT License."
isDraft: false
featured: true
lang: "en"
translationSourceHash: "243d83e70e58999eaaf5f0fa0c07149254f208dd3d4884fc32eb667b1ca2c839"
translatedAt: "2026-10-27T13:34:51.327Z"
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

Recruitment agencies and sales representatives at SES (System Engineering Services) companies need to explain to client companies why they are recommending a particular candidate. Yet, the materials they have at hand are almost entirely limited to resumes and impressions from interviews. Even if a resume says "5 years of Java," it does not convey the substance of the work—what kinds of changes were made and how they were verified along the way.

Meanwhile, "activity volume" metrics like GitHub contribution graphs and commit counts can now be easily inflated using generative AI and coding agents. Sheer volume is no longer a reliable basis for a recommendation. On the other hand, collapsing everything into a single score obscures what was measured, over what time period, and across what sample size, turning it into a blunt screening tool. Both those making recommendations and those being recommended lacked "verifiable evidence."

## Approach

Grift began in February 2026 as a web application supporting estimates for contract development. While exploring the basis for these estimates, we realized that the most dependable evidence is the git history itself that engineers have built up over time. In August 2026, we separated the measurement component into a command-line tool. In September, we discontinued the legacy web application and pivoted toward supporting recruitment agencies and SES sales representatives.

In our design, we established three upfront commitments:

- Do not reduce to scores: We output observed values, and humans make the judgments. We do not output composite scores, rankings, pass/fail decisions, or grades; every numerical value is accompanied by a numerator and a denominator.
- Identical results every time: We do not use AI (LLMs) for measurement. For the same repository and the same version, anyone running the tool gets the exact same numbers.
- Transmitted nowhere: It runs exclusively on the local machine. Whether to share the results and which repositories to include are decisions made solely by the individual.

In addition, we established a seven-article code of conduct, including principles such as "do not interpret absence as a negative," "do not screen candidates based solely on numerical values," and "do not measure others without their consent." Any use that does not adhere to these rules is prohibited from being referred to by the method's name (TEP: Technical Evidence Pipeline).

## Implementation

The Grift CLI extracts observations like the following purely from git history:

- Attribution distinctions: Separates who did the work across 11 classifications, including the individual's original commits, work by others, bots, generated/vendor artifacts, and history inherited from upstream forks.
- Test co-change: The proportion of commits where tests were modified alongside changes to production code.
- Corrective rework and path retouch: The rate of rework or re-touching of recently modified files (recorded as tendencies, not used for pass/fail determinations).
- Repository context: Active working days, number of contributors, commit share of the top author, proportion of changes made via code review, etc.

With `report-v2` introduced in v0.6, an additional layer observes the shape of an individual engineer's work. All outputs include numerators and denominators and do not represent judgments of job titles or abilities.

- Work surface (`surface_profile`): The number of changes across 11 areas: test, docs, CI/CD, platform, data, observability, frontend, backend, config, generated/vendor, and other.
- Change rhythm (`change_rhythm`): The number of days changes were submitted within the past 180 days and submission intervals (median, 90th percentile, proportion submitted within 2 days, proportion with gaps of 30 days or more). This does not measure working hours or motivation.
- Verification profile (`verification_profile`): The proportion of commits that touched tests, their types (unit, integration, e2e, contract, unknown), and the proportion of fix commits accompanied by tests.
- Four dimensions of role (`role_profile`): Composed strictly of domain, work_type, time, and process_position, without collapsing into a single job title. Output only when an identity with recorded consent is present.

Alignment with job requirements is also conducted without ranking. The hiring side declares its required domains, verification, rhythm, and inputs via `grift project`, and `grift align` aligns these side by side with the candidate's observations along each axis. The alignment consists of only five states: overlap, outside_declared_range, observed_zero, not_observed, and not_declared; no overall scores, rankings, or pass/fail decisions are calculated. When viewed at the team level with `--team`, it outputs only the count of individuals meeting the requirements and suppresses aggregation for fewer than three people to prevent identifying individuals.

When the sample size is under 20, rates are omitted and only counts are shown; items that could not be observed are reported as "not observed" with an accompanying reason, rather than "no track record." `grift verify` recalculates saved reports under the identical conditions and returns match, mismatch, or unverifiable, allowing the recipient to verify against tampering or discrepancies.

Starting with 0.9.0, a concise summary describing the work approach visible from the record is included at the top of the Markdown for `grift actor`, `grift project`, and `grift align`. It details the categories of modified areas, the pace of changes, testing practices, and collaboration style, accompanied by counts and timeframes. Following this, it outlines aspects not visible from the record and points to explore during interviews in the form of questions. These statements are selected from figures using a published [decision table](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/trait-profile.md). No AI is used, and they are not included in the JSON.

Statements and questions about an individual are output only when an identity claimed by that person is accompanied by a record of consent. Otherwise, a single sentence stating the reason for omission is displayed. When reporting multiple individuals together (`--all`, `--top`), statements are not output.

The method is called TEP (Technical Evidence Pipeline). It consists of four stages: reading git records, counting them according to set rules, appending denominators and reasons for uncounted items to the calculated values, and ensuring that anyone can recalculate them following the same procedure. A detailed explanation can be found on the [TEP page](https://griftai.org/tep) of the Grift website.

The terminology used on this page and griftai.org corresponds to the terms written in the CLI output as follows:

| Website Terminology | CLI Term |
|---|---|
| Observed values | observed value (`kind: observed`; accompanied by value, unit, and denominator) |
| Test co-change | test co-change |
| Corrective rework | corrective rework |
| Path retouch | path retouch |
| Code recency | survival (only when `--survival` is specified) |
| Repository context | context profile |
| Work surface, change rhythm, verification profile | surface_profile / change_rhythm / verification_profile |

Starting with 0.9.0, the CLI's Markdown also uses the same names as griftai.org for the four perspectives: categories of modified areas (work surface), pace of changes (change rhythm), testing practices (verification profile), and collaboration style. The JSON keys remain unchanged.

- Repository: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- Distribution: PyPI "grift-cli" (`pipx install grift-cli`, Python 3.11+)
- License: MIT
- Release Notes: [github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases) (version-by-version changes)

## Results

On September 8, 2026, we released [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/) on PyPI. The metrics have been validated across 117 public repositories, and both comparisons where distinctions were successfully made and those where they have not yet been made are published on GitHub (measured internally; not audited by a third party).

On October 25, 2026, we cross-checked the website wording line by line against the CLI output. Because the multi-person list (`actor-index`) had been sorted by commit count in descending order despite an explanatory note stating it was "not a ranking," we changed the ordering to alphabetical by ID in [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0), released on October 26, 2026. The commit count values have been retained. The background and the five acceptance criteria imposed on the 0.8 series are detailed in a [blog post](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/).

In [0.9.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0), released on October 27, 2026, we added the introductory summary and interview questions at the top of the reports described above. Concurrently, we removed the tendency "strength" row and the alignment "direction" row from the Markdown. This was done because placing two reports side by side could lead to them being read as strong vs. weak candidates, or suitable vs. unsuitable candidates. We also corrected four locations where factually inaccurate numbers could be output regarding individuals.

Currently, we are preparing proof-of-concept (PoC) trials with recruitment agencies and SES companies to substantiate recommendation rationales based on records run locally by the candidates themselves. We are also welcoming inquiries from hiring managers at in-house development companies regarding PoC trials to verify what kind of work candidates have performed using records shared by the candidates themselves. Building on the results of these trials, we are aiming to launch the official release in 2027. Grift is also introduced at [griftai.org](https://griftai.org).

The philosophy behind Grift is also covered in articles on [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) and [note](https://note.com/cor_instrument/n/nd58ba0955317).
