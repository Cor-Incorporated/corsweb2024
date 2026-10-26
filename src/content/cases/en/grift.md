---
title: "Grift — Resumes can be embellished. Evidence cannot. An OSS tool that extracts verifiable facts from git history"
description: "Grift is our in-house product that extracts verifiable facts (test values)—not scores—from an engineer's git history. Here, we share the story behind our pivot from an estimation-support web app to an open-source CLI and recommendation-support tool for staffing agencies and SES providers, along with its design."
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "Staffing Agency", "SES", "Recruitment"]
publishedAt: 2026-06-30
updatedAt: 2026-10-26
summary: "Grift is our in-house product that extracts \"verifiable facts\" from an engineer's git history. It assigns neither scores nor rankings. Because it does not use AI (LLMs) for measurement, it yields the exact same results regardless of who runs it, allowing recipients to verify the calculations. The CLI is released as open-source software under the MIT license."
isDraft: false
featured: true
lang: "en"
translationSourceHash: "c46c32cd0131a2bb6afc55a971d8dd86ce2270ed68c889bfacfec9bdbe39ffbf"
translatedAt: "2026-10-26T07:50:11.907Z"
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

When staffing agencies or SES sales representatives recommend candidates to client companies, they must explain the reasoning behind their recommendation. However, the materials on hand are almost entirely limited to resumes and interview impressions. Even if a resume states "5 years of Java," it does not convey the substance of the work—what changes were made, or how they were verified and executed.

Meanwhile, "activity volume," such as GitHub contribution graphs and commit counts, can now be easily inflated using generative AI and autonomous agents. Sheer volume can no longer serve as a reliable basis for recommendation. Conversely, condensing everything into a single score obscures what was measured, over what period, and against what sample size, causing it to be used merely as a screening threshold. Both those making recommendations and those being recommended have lacked "verifiable materials."

## Our Approach

Grift began in February 2026 as a web application supporting estimates for contract development. While investigating the basis for estimates, we realized that the most reliable material is the git history that engineers have built over time. In August 2026, we carved out the measurement component as a command-line tool. In September, we discontinued the former web application and pivoted toward supporting recruitment agencies and SES sales representatives.

During the design phase, we established three core commitments:

- Do not reduce to a single score: Output observed values and let humans make the judgment. Do not produce composite scores, rankings, pass/fail decisions, or grades; always accompany numbers with both a numerator and a denominator.
- Identical results every time: Do not use AI (LLMs) for measurement. Anyone running it on the same repository and the same version will get the exact same figures.
- Never send data externally: Operates entirely on the local PC. The individuals themselves decide whether to share the results and which repositories to include.

In addition, we established a seven-article code of conduct—including "do not interpret absence as negative," "do not screen candidates based solely on numerical values," and "do not measure others without their consent"—stipulating that use cases failing to observe these rules may not refer to the methodology as TEP (Technical Evidence Pipeline).

## Implementation

Grift CLI extracts observations like the following exclusively from git history:

- Attribution distinction: Distinguishes whose work it is across 11 categories, including the individual's own commits, work by others, bots, generated/vendor artifacts, and history inherited from upstream forks.
- Test co-change rate: The proportion of commits where tests were modified alongside production code changes.
- Corrective rework rate / path retouching: The proportion of redo work or re-touches on recently modified files (recorded as tendencies, not used for pass/fail assessments).
- Repository context: Number of active working days, number of contributors and the share of the top author, proportion of changes made via code reviews, and more.

In `report-v2`, added in v0.6, we introduced an expanded layer for observing the shape of an individual engineer's work. Each metric includes both a numerator and a denominator, and none are intended to judge job titles or capability.

- Surface profile (`surface_profile`): How many changes were made in which domain, across 11 classifications: test / docs / CI/CD / platform / data / observability / frontend / backend / config / generated & vendor / other.
- Change rhythm (`change_rhythm`): The number of days changes were submitted within the last 180 days, and the intervals between submissions (median and 90th percentile, proportion of submissions continuing within 2 days, proportion with gaps of 30 days or more). This does not represent working hours or motivation.
- Verification profile (`verification_profile`): The proportion of commits that touched tests and their types (unit / integration / e2e / contract / unknown), and the proportion of bug-fix commits accompanied by tests.
- Four-dimensional role profile (`role_profile`): Consists strictly of domain / work_type / time / process_position, without collapsing into a single job title. Output only when an identity with recorded consent from the individual is present.

Matching against project requirements is also conducted without ranking. The project side declares its required domains, verification, rhythm, and inputs using `grift project`, and `grift align` aligns them side-by-side with the candidate's observations along each axis. The alignment falls strictly into five categories: overlap, outside_declared_range, observed_zero, not_observed, or not_declared; no composite scores, rankings, or pass/fail determinations are calculated. When viewing at a team level using `--team`, only the count of individuals meeting the requirements is output, and aggregations are withheld for groups of fewer than three to prevent personal identification.

When the sample size is under 20, rates are omitted in favor of raw counts alone, and metrics that could not be observed are marked as "not observed" with an accompanying reason, rather than "no track record." `grift verify` recalculates saved reports under the same conditions and returns match, mismatch, or unverifiable, allowing the receiving party to verify against alterations or discrepancies.

The methodology is named TEP (Technical Evidence Pipeline). It consists of four stages: reading git records, counting them according to set rules, appending denominators and reasons for uncounted items to the calculated values, and ensuring anyone can recount them using the same procedure. For details, please see the [TEP page](https://griftai.org/tep) on the Grift website.

The terminology used on this page and griftai.org corresponds to the terms output by the CLI as follows:

| Website Terminology | CLI Term |
|---|---|
| Observed value (検査値) | observed value (`kind: observed`; accompanied by value, unit, and denominator) |
| Test co-change rate (テスト併修率) | test co-change |
| Corrective rework rate (手戻り率) | corrective rework |
| Retouching (磨き直し) | path retouch |
| Survival rate (定着率) | survival (only when `--survival` is specified) |
| Repository context (リポジトリの文脈) | context profile |
| Surface profile, change rhythm, verification profile (作業領域・変更リズム・検証の形) | surface_profile / change_rhythm / verification_profile |

- Repository: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- Distribution: PyPI "grift-cli" (`pipx install grift-cli`, Python 3.11+)
- License: MIT
- Release Notes: [github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases) (version-by-version changelog)

## Results

On September 8, 2026, we released [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/) on PyPI. The metrics were validated across 117 public repositories, and both comparisons that could be differentiated and those that could not yet be differentiated are published on GitHub (measured internally; not audited by a third party).

On October 25, 2026, we cross-checked the website wording against the CLI output line by line. Because the multi-person list (`actor-index`) was sorted in descending order of commit count despite a note stating "not a ranking," we changed the ordering to alphabetical by ID in [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0), released on October 26, 2026. The commit count values remain displayed. The background and the five acceptance criteria imposed on the 0.8 series are detailed in our [blog post](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/).

Currently, we are preparing proof-of-concept (PoC) trials with recruitment agencies and SES companies to substantiate recommendation rationales using records run locally by candidates themselves. We also welcome inquiries regarding PoC trials from hiring managers at product companies who wish to verify the nature of past work using records shared directly by candidates. Based on the findings from these trials, we aim to launch the official release in 2027. Grift is also introduced at [griftai.org](https://griftai.org).

The philosophy behind Grift is also discussed in our articles on [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) and [note](https://note.com/cor_instrument/n/nd58ba0955317).
