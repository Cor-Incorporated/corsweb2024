---
title: "Grift — Resumes Can Be Exaggerated. Evidence Cannot. An OSS Tool for Extracting Verifiable Facts from Git History"
description: "Grift is our in-house product that extracts verifiable facts (observed values) rather than scores from an engineer's git history. We share the background and design of how we pivoted from an estimation support web app to an open-source CLI and recommendation support tool for staffing agencies and SES firms."
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "Staffing Agencies", "SES", "Hiring"]
publishedAt: 2026-06-30
updatedAt: 2026-10-26
summary: "Grift is our in-house product that extracts \"verifiable facts\" from an engineer's git history. It assigns neither scores nor rankings. Because it does not use AI (LLMs) for measurement, it yields the exact same results regardless of who runs it, allowing recipients to verify the calculations. The CLI is released as open-source software under the MIT license."
isDraft: false
featured: true
lang: "en"
translationSourceHash: "ef5d17e64309f955e1b45bcd0e7d4a45aa3817cb440d60525b4d6d2093965a57"
translatedAt: "2026-10-26T13:32:48.844Z"
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

Staffing agencies and sales representatives at SES (System Engineering Service) providers need to explain "why we recommend this candidate" when putting them forward to client companies. However, the materials at hand are almost exclusively resumes and interview impressions. Even if a resume states "5 years of Java," it does not convey the substance of the work: what kinds of changes were made, and how they were verified along the way.

Meanwhile, "activity volume," such as GitHub contribution graphs ("grass") and commit counts, can now be easily inflated using generative AI and agents. High volume alone can no longer serve as a solid basis for recommendation. On the other hand, collapsing everything into a single score obscures what was measured, over what period, and against what denominator, turning it into a blunt screening tool. Both those making recommendations and those being recommended lacked "verifiable materials."

## Approach

Grift began in February 2026 as a web application supporting contract development estimates. While exploring the foundation for these estimates, we realized that the most dependable evidence is the git history that engineers have built up themselves. In August 2026, we extracted the measurement component as a command-line tool. In September, we discontinued the legacy web application and pivoted our direction toward supporting sales teams at staffing agencies and SES providers.

During design, we established three core commitments upfront:

- Do not turn it into a score: We provide observed values, and humans make the judgment. We output no composite scores, rankings, pass/fail verdicts, or tiers, and every numerical value is accompanied by a numerator and a denominator.
- Identical results every time: We do not use AI (LLMs) for measurement. For the same repository and the same version, anyone running it will get the exact same numbers.
- Transmitted nowhere: It runs entirely on the local PC. Whether to share the results and which repositories to present is decided by the candidate themselves.

In addition, we established a seven-article code of conduct, including "do not interpret absence negatively," "do not screen based solely on numerical values," and "do not measure others without their consent." We decided that any use violating these principles may not be referred to by the method's name (TEP: Technical Evidence Pipeline).

## Implementation

Grift CLI extracts observations like the following exclusively from git history:

- Attribution distinction: Distinguishes whose work it is across 11 classifications, including the candidate's own unique commits, others' work, bots, generated or vendor artifacts, and history inherited from upstream forks.
- Test co-change: The proportion of commits modifying production code that also modified tests within the same commit.
- Corrective rework and path retouch: The proportion of rework or re-touching of recently modified files (recorded as tendencies, not used for pass/fail judgments).
- Repository context: Active working days, number of contributors involved, the top author's share of commits, the proportion of commits made via code reviews, and more.

In `report-v2`, added in v0.6, we expanded the layers that observe the shape of an individual engineer's work. All of these include numerators and denominators, and none represent assessments of job titles or capabilities.

- Work surface (`surface_profile`): How many changes were made across 11 areas: test / docs / CI/CD / platform / data / observability / frontend / backend / config / generated & vendor / other.
- Change rhythm (`change_rhythm`): The number of days changes were submitted out of the last 180 days, and the intervals between submissions (median and 90th percentile, proportion followed by another within 2 days, proportion with gaps of 30 days or more). This does not measure working hours or motivation.
- Verification profile (`verification_profile`): The proportion of commits that touched tests and their types (unit / integration / e2e / contract / unknown), along with the proportion of fix commits that were accompanied by tests.
- Four dimensions of roles (`role_profile`): Limited strictly to four dimensions—domain / work_type / time / process_position—without collapsing them into a single job title. Output only when an identity with recorded consent is present.

Alignment with project requirements is also performed without assigning rankings. The project side declares the required areas, verification, rhythm, and inputs via `grift project`, and `grift align` aligns them axis by axis against the candidate's observations. The alignment consists of only five states: overlap, outside declared range (outside_declared_range), zero observed (observed_zero), not observed (not_observed), and not declared (not_declared), with no overall scores, rankings, or pass/fail determinations calculated. When viewing at the team level via `--team`, it outputs only the count of people meeting the requirements; to prevent individual identification, it does not aggregate groups of fewer than 3 people.

When the denominator is less than 20, rates are omitted and only counts are shown; items that could not be observed are reported as "not observed" with reasons, rather than "no track record." `grift verify` recalculates saved reports under the same conditions and returns match, mismatch, or unverifiable, allowing the recipient to verify any alterations or discrepancies.

The method is called TEP (Technical Evidence Pipeline). It consists of four stages: reading git records, counting according to fixed rules, attaching denominators and reasons for uncounted items to the counted values, and enabling anyone to recount using the exact same procedure. Detailed explanations can be found on the [TEP page](https://griftai.org/tep) on Grift's website.

The terminology used on this page and griftai.org corresponds to the terms output by the CLI as follows:

| Website Term | CLI Term |
|---|---|
| Observed values | observed value (`kind: observed`; includes value, unit, and denominator) |
| Test co-change | test co-change |
| Corrective rework | corrective rework |
| Path retouch | path retouch |
| Code recency | survival (only when `--survival` is specified) |
| Repository context | context profile |
| Work surface, change rhythm, verification profile | surface_profile / change_rhythm / verification_profile |

- Repository: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- Distribution: PyPI "grift-cli" (`pipx install grift-cli`, Python 3.11+)
- License: MIT
- Release Notes: [github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases) (changes by version)

## Outcomes

On September 8, 2026, we released [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/) on PyPI. The metrics have been validated against 117 public repositories, and we have published both the comparisons where distinctions could be made and those where they could not yet be made on GitHub (these are internal measurements and have not undergone third-party auditing).

On October 25, 2026, we cross-checked the website text against the CLI output line by line. Because the multi-person list (`actor-index`) was ordered by descending commit count despite an accompanying note stating "not a ranking," we updated the order to lexicographical order of IDs in [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0), released on October 26, 2026. Commit count values are retained. The background and the five acceptance criteria imposed on the 0.8 series are detailed in a [blog post](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/).

Currently, we are preparing proof-of-concept (PoC) trials with staffing agencies and SES providers to substantiate recommendation rationales based on records run locally by candidates themselves. We are also welcoming inquiries from hiring managers at in-house product development companies for PoC trials to verify what kind of work candidates have performed using records shared by the candidates themselves. We aim to launch the official release in 2027, based on the results of these PoC trials. Grift is also introduced at [griftai.org](https://griftai.org).

The philosophy behind Grift is also shared in articles on [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) and [note](https://note.com/cor_instrument/n/nd58ba0955317).
