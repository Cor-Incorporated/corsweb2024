---
title: "Grift — Resumes can be embellished. Evidence cannot. An OSS tool that extracts verifiable facts from git history"
description: "Grift is our in-house product that extracts verifiable facts (test values) rather than scores from an engineer's git history. Here, we share its architecture and the story of how we pivoted from an estimation support web app to an open-source CLI and recommendation support tool for staffing agencies and SES providers."
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "Staffing Agencies", "SES", "Recruitment"]
publishedAt: 2026-06-30
updatedAt: 2026-10-26
summary: "Grift is our in-house product that extracts verifiable facts from an engineer's git history. It assigns neither scores nor rankings. Because it does not use AI (LLMs) for measurement, it produces the exact same results regardless of who runs it, allowing the recipient to verify the numbers. The CLI is released as open-source software under the MIT License."
isDraft: false
featured: true
lang: "en"
translationSourceHash: "3ed7c2d9efb97af0e5865299da247aea96639ffd21f806a4c3e5ce3c5e3cc08e"
translatedAt: "2026-10-26T12:21:37.346Z"
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

When staffing agencies and SES (System Engineering Service) sales representatives recommend candidates to client companies, they need to explain "why we recommend this individual." However, the materials at hand are often limited to resumes and impressions from interviews. Even if a resume states "5 years of Java experience," it fails to convey the substance of the work—such as what kinds of changes were made and how they were validated throughout the process.

Meanwhile, "activity volume," such as GitHub contribution graphs ("green squares") and commit counts, can now be easily inflated using generative AI and coding agents. A high volume of activity can no longer reliably serve as a basis for recommendation. Conversely, condensing everything into a single score obscures what was measured, over what period, and against what sample size, turning it into a blunt tool for screening candidates out. Both those making recommendations and those being recommended lacked "verifiable evidence."

## Approach

Grift began in February 2026 as a web application designed to support cost estimation for contract development. While exploring the foundation for accurate estimates, we realized that the most dependable evidence lies in the git history that engineers have built over time. Consequently, in August 2026, we decoupled the measurement component as a command-line tool. In September, we discontinued the legacy web application and pivoted our direction toward supporting sales operations at staffing agencies and SES firms.

In our design, we established three core principles upfront:

- Do not reduce to a single score: Output diagnostic values, and let humans make the judgment. We do not provide composite scores, rankings, pass/fail decisions, or grades; every numerical value must include both a numerator and a denominator.
- Identical results every time: Do not use AI (LLMs) for measurement. For the same repository and the same version, anyone executing the tool will obtain the exact same figures.
- Never transmit data externally: Runs solely on the local PC. The individual candidate decides whether to share the results and which repositories to include.

In addition, we established a seven-article code of conduct, which includes rules such as "never interpret absence as negative," "never screen out candidates based on numbers alone," and "never measure others without their explicit consent." Any usage that violates these rules may not be referred to by the methodology's name (TEP: Technical Evidence Pipeline).

## Implementation

The Grift CLI extracts the following observations solely from git history:

- Attribution classification: Separates whose work it is across 11 categories, including the individual's original commits, work by others, bots, generated/vendor artifacts, and history inherited from upstream forks.
- Test co-change rate: The proportion of commits where tests were modified alongside changes to production code.
- Rework rate and path retouching: The frequency of revisions or repeated touches on recently modified files (recorded as a trend indicator, not used for pass/fail judgments).
- Repository context: Active working days, number of contributors and the primary author's share of commits, the proportion of commits made via code reviews, and more.

The `report-v2` command, added in v0.6, introduces an additional layer for examining how an individual engineer works. All metrics include numerators and denominators and do not represent evaluations of job titles or capabilities.

- Work surface (`surface_profile`): How many changes occurred across 11 categories: test / docs / CI/CD / platform / data / observability / frontend / backend / config / generated & vendor / other.
- Change rhythm (`change_rhythm`): The number of days changes were submitted within the past 180 days, along with intervals between submissions (median, 90th percentile, proportion followed by another change within 2 days, and proportion with a gap of 30 days or more). This does not measure working hours or motivation.
- Verification profile (`verification_profile`): The proportion of commits that touched tests, their classifications (unit / integration / e2e / contract / unknown), and the proportion of bug-fix commits accompanied by tests.
- 4 dimensions of roles (`role_profile`): Evaluated strictly across four dimensions—domain / work_type / time / process_position—without collapsing them into a single job title. This is output only when an identity record containing the candidate's consent is present.

Alignment with project requirements is also conducted without assigning rankings. The project side declares the required areas, verification, rhythm, and inputs via `grift project`, and `grift align` lines these up alongside the candidate's observations across each axis. The alignment is categorized into only five states: overlap, outside_declared_range, observed_zero, not_observed, and not_declared, without calculating overall scores, rankings, or pass/fail decisions. When viewing data at the team level via `--team`, the tool outputs only the headcount meeting the requirements; it does not aggregate data for groups of fewer than three people to prevent the identification of individuals.

When a sample size is less than 20, the tool displays counts instead of percentages. Unobserved items are presented not as "no track record," but as "not observed" accompanied by the reason. `grift verify` recalculates saved reports under identical conditions and returns match, mismatch, or unverifiable, allowing the receiving party to verify against alterations or discrepancies.

The methodology is named TEP (Technical Evidence Pipeline). It consists of four stages: reading git records, counting them according to defined rules, attaching denominators and reasons for uncounted items to the calculated values, and ensuring that anyone can recount them following the exact same procedure. Detailed explanations can be found on the [TEP page](https://griftai.org/tep) on the Grift website.

The correspondence between the terminology used on this page and griftai.org and the terms output by the CLI is as follows:

| Term on Website | Term in CLI |
|---|---|
| Diagnostic values | observed value (`kind: observed`; accompanied by value, unit, and denominator) |
| Test co-change rate | test co-change |
| Rework rate | corrective rework |
| Path retouching | path retouch |
| Code freshness | survival (only when `--survival` is specified) |
| Repository context | context profile |
| Work surface, change rhythm, verification profile | surface_profile / change_rhythm / verification_profile |

- Repository: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- Distribution: PyPI "grift-cli" (`pipx install grift-cli`, Python 3.11 or higher)
- License: MIT
- Release notes: [github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases) (changes by version)

## Results

On September 8, 2026, we released [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/) on PyPI. The metrics were validated across 117 public repositories, and both the comparisons that successfully distinguished differences and those that have not yet distinguished them are published on GitHub (based on internal measurements; not audited by a third party).

On October 25, 2026, we audited the text on our website against the CLI output line by line. Because the multi-person list (`actor-index`) was sorted in descending order of commit counts despite a note stating "not a ranking," we updated the sorting to alphabetical order by ID in [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0), released on October 26, 2026. The commit count values remain displayed. The context behind this change and the five acceptance criteria imposed on the 0.8 series are detailed in our [blog post](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/).

Currently, we are preparing proof-of-concept (PoC) trials with staffing agencies and SES firms to provide concrete rationales for candidate recommendations using records generated locally by the candidates themselves. We also welcome inquiries from hiring managers at in-house development companies regarding PoC trials to verify engineers' past work based on records shared by candidates. Based on the results of these trials, we aim to launch the official production version in 2027. Grift is also introduced at [griftai.org](https://griftai.org).

The philosophy behind Grift is also detailed in our articles on [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) and [note](https://note.com/cor_instrument/n/nd58ba0955317).
