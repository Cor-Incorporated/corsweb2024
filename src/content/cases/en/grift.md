---
title: "Grift — Resumes can be embellished. Evidence cannot. An OSS tool extracting verifiable facts from git history"
description: "Grift is our in-house product that extracts verifiable facts (test values)—not scores—from an engineer's git history. We share the background and architecture behind pivoting from an estimation-support web app to an open-source CLI and a recommendation-support tool for staffing agencies and SES businesses."
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "Recruitment Agency", "SES"]
publishedAt: 2026-06-30
updatedAt: 2026-10-25
summary: "Grift is an in-house product that extracts \"verifiable facts\" from an engineer's git history. It assigns no scores or rankings. Because it does not use AI (LLMs) for measurement, it produces identical results no matter who runs it, allowing recipients to verify the numbers themselves. The CLI is released as open-source software under the MIT license."
isDraft: false
featured: true
lang: "en"
translationSourceHash: "0c724e7e86ea6f90f6f9849a4cbea6fd163e7d36fe697b9a345d8eb38f42ca18"
translatedAt: "2026-10-25T07:40:04.111Z"
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
-->

## Challenges

When staffing agencies or SES (System Engineering Services) sales representatives recommend candidates to client companies, they need to explain why they are endorsing them. In most cases, however, the only materials at hand are résumés and impressions from interviews. Even if a résumé says "5 years of Java experience," it fails to convey the actual substance of the work—what changes the engineer made, and how they validated them as they moved forward.

Meanwhile, "activity metrics" such as GitHub contribution graphs and commit counts have become easy to inflate using generative AI and agents. High volume alone is no longer reliable evidence for a recommendation. On the other hand, collapsing everything into a single score obscures what was measured, over what time frame, and against what sample size, turning it into a blunt screening tool. Both those making recommendations and those being recommended lacked "verifiable evidence."

## Approach

Grift started in February 2026 as a web application supporting contract development estimates. While exploring the foundation for these estimates, we realized that the most dependable evidence was the git history engineers had built over time. In August 2026, we carved out the measurement layer into a command-line tool. By September, we discontinued the legacy web application and pivoted toward supporting sales representatives at staffing agencies and SES companies.

In designing the tool, we established three core principles upfront:

- Do not turn it into a score: Present observed values and let humans make the judgment. Never produce composite scores, rankings, pass/fail results, or grades, and always attach the numerator and denominator to every figure.
- Identical results every time: Do not use AI (LLMs) for measurement. Running the tool against the same repository and the same version will yield the exact same figures, no matter who runs it.
- Send nothing anywhere: Operates solely on the local PC. The individual decides whether to share it and which repositories to present.

In addition, we established seven codes of conduct—including "do not interpret absence as a negative," "do not screen candidates based solely on numerical values," and "do not measure others without their consent." Any use that violates these rules may not be referred to by the method's name, TEP (Technical Evidence Pipeline).

## Implementation

Grift CLI extracts observations like the following strictly from git history:

- Attribution breakdown: Categorizes whose work it is across 11 classifications, including the engineer's original commits, work by others, bots, generated/vendor deliverables, and history inherited from upstream forks.
- Test co-change rate: The proportion of commits where tests were modified alongside changes to production code.
- Rework rate / retouching: The proportion of rework or re-engagement with recently touched files (recorded as a trend, not used for pass/fail determinations).
- Repository context: Active working days, number of contributors involved and the primary author's share of contributions, proportion of changes made via code review, and more.

`report-v2`, added in v0.6, introduces layers that observe the shape of an individual engineer's work. All metrics include numerators and denominators, and none represent judgments of job titles or abilities.

- Surface areas (`surface_profile`): The count of changes across 11 classifications: test / docs / CI/CD / platform / data / observability / frontend / backend / config / generated & vendor / other.
- Change rhythm (`change_rhythm`): The number of days changes were submitted within the past 180 days, along with submission intervals (median and 90th percentile, proportion followed up within 2 days, and proportion with gaps of 30 days or more). This does not measure working hours or motivation.
- Verification profile (`verification_profile`): The proportion of commits touching tests and their types (unit / integration / e2e / contract / unknown), as well as the proportion of bug-fix commits accompanied by tests.
- 4 dimensions of roles (`role_profile`): Evaluated strictly across four dimensions—domain / work_type / time / process_position—without collapsing them into a single job title. Output only when an identity with recorded consent from the individual is present.

Alignment with project requirements is also conducted without assigning rankings. The project side declares its requirements across domains, verification, rhythm, and input using `grift project`, and `grift align` lines them up against the candidate's observations along each axis. The alignment is categorized into only five states: overlap, outside declared range (outside_declared_range), zero observed (observed_zero), not observed (not_observed), or not declared (not_declared). No overall scores, rankings, or pass/fail determinations are calculated. When viewed at the team level with `--team`, it displays only the count of individuals meeting the requirements; if there are fewer than three people, the data is not aggregated to prevent identifying individuals.

When the sample size is under 20, the tool displays only counts rather than percentages, and unobserved items are shown as "not observed" with reasons provided, rather than "no track record." `grift verify` recalculates saved reports under the identical conditions and returns match, mismatch, or unverifiable, allowing the recipient to verify whether the data has been altered or discrepancies exist.

The method is named TEP (Technical Evidence Pipeline). The terminology used on this site and griftai.org corresponds to the terms output by the CLI as follows:

| Term on site | CLI term |
|---|---|
| Observed values | observed value (`kind: observed`; includes value, unit, and denominator) |
| Test co-change rate | test co-change |
| Rework rate | corrective rework |
| Retouching | path retouch |
| Retention rate | survival (only when `--survival` is specified) |
| Repository context | context profile |
| Surface areas / Change rhythm / Verification profile | surface_profile / change_rhythm / verification_profile |

- Repository: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- Distribution: PyPI "grift-cli" (`pipx install grift-cli`, Python 3.11 or higher)
- License: MIT

## Outcomes

On September 8, 2026, we released v0.7.2 on PyPI. The metrics were validated across 117 public repositories, and we have published both the comparisons where distinctions could be made and those where distinctions could not yet be made on GitHub (these are internal measurements and have not been audited by a third party).

On October 25, 2026, we cross-checked the website copy against the CLI output line by line. We found that the multi-person list (`actor-index`) was ordered by commit count despite a note stating "not a ranking." Therefore, in the next version (0.8), we will change the sorting to lexicographical order by ID. The commit count values will be retained. We detailed the background and the five acceptance criteria set for the 0.8 series in a [blog post](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/).

Currently, we are preparing proof-of-concept (PoC) trials with staffing agencies and SES companies to substantiate recommendation rationales based on records run locally by candidates themselves. Following the results of these trials, we aim to launch the official release in 2027. Grift is also featured on [griftai.org](https://griftai.org).

The philosophy behind Grift is also shared in our articles on [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) and [note](https://note.com/cor_instrument/n/nd58ba0955317).
