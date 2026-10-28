---
title: "Grift — Resumes can be embellished. Evidence cannot. An OSS tool that extracts verifiable facts from git history"
description: "Grift is our in-house product that extracts verifiable facts (observed values) rather than scores from an engineer's git history. Here, we share its design and how its direction shifted from an estimation support web app to an open-source CLI and recommendation support tool for staffing agencies and SES providers."
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "Staffing Agency", "SES", "Hiring"]
publishedAt: 2026-06-30
updatedAt: 2026-10-28
summary: "Grift is our in-house product that extracts \"verifiable facts\" from an engineer's git history. It assigns no scores or rankings. Because it does not use AI (LLMs) for measurement, it produces identical results regardless of who runs it, allowing the recipient to verify the findings independently. The CLI is released as open-source software under the MIT License."
isDraft: false
featured: true
lang: "en"
translationSourceHash: "4ca681c34432675973331e8114ce197a04fd07b1460e509367b26bbd93cf1d4e"
translatedAt: "2026-10-28T05:32:28.407Z"
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

When staffing agencies and SES (System Engineering Service) sales representatives recommend candidates to companies, they need to explain why they recommend that particular individual. Yet the materials at hand are almost entirely limited to resumes and interview impressions. Even if a resume states "5 years of Java," it conveys nothing about the substance of the work—what kind of changes were made, or how they were verified along the way.

Meanwhile, "activity volume" metrics such as GitHub contribution graphs and commit counts can now be easily inflated using generative AI and autonomous agents. High volume alone can no longer serve as a solid ground for recommendation. On the other hand, collapsing everything into a single score obscures what was measured, over what time frame, and against what base population, causing it to be used merely as a filtering tool for screening candidates out. Both those recommending and those being recommended lacked verifiable materials.

## Approach

Grift began in February 2026 as a web application designed to support cost estimation for contract development. While exploring the rationale behind estimates, we realized that the most reliable material is the git history that engineers have built over time. In August 2026, we extracted the measurement component as a command-line tool. In September, we discontinued the legacy web application and pivoted our direction toward supporting staffing agencies and SES sales teams.

During design, we established three upfront commitments:

- Do not reduce to a score: Output observed values and leave judgment to humans. We do not output composite scores, rankings, pass/fail decisions, or grades; every numerical value is accompanied by a numerator and denominator.
- Identical results every time: Do not use AI (LLMs) for measurement. For the same repository and the same version, anyone running the tool gets the same numerical values.
- Transmit nowhere: Runs entirely on the local PC. Candidates decide for themselves whether to share the data and which repositories to present.

In addition, we established a seven-article code of conduct—including "do not interpret absence as negative," "do not screen out based solely on numerical values," and "do not measure others without their consent"—and established a rule that usage failing to comply must not be referred to by the methodology's name, TEP (Technical Evidence Pipeline).

## Implementation

The Grift CLI extracts observations such as the following solely from git history:

- Attribution breakdown: Distinguishes whose work it is across 11 classifications, including the individual's own commits, other people's work, bots, generated/vendor artifacts, and history inherited from upstream forks.
- Test co-change: The proportion of commits where tests were modified alongside production code changes.
- Corrective rework and path retouch: The proportion of reworks or re-touches to recently touched files (recorded as tendencies, not used for pass/fail decisions).
- Repository context: Active working days, number of contributors, commit share of the primary author, proportion of commits merged via reviews, etc.

The `report-v2` command added in v0.6 introduces layers for viewing an individual engineer's work patterns. All are provided with numerators and denominators, and none represent judgments of job title or competence.

- Work surface (`surface_profile`): How many changes occurred across 11 areas: test / docs / CI/CD / platform / data / observability / frontend / backend / config / generated/vendor / other.
- Change rhythm (`change_rhythm`): Number of days changes were submitted within the past 180 days and submission intervals (median and 90th percentile, proportion of changes within 2 days, proportion of gaps exceeding 30 days). This does not reflect working hours or motivation.
- Verification profile (`verification_profile`): Proportion of commits that touched tests and their types (unit / integration / e2e / contract / unknown), and the proportion of bug-fix commits accompanied by tests.
- Four dimensions of role (`role_profile`): Composed solely of domain / work_type / time / process_position, without collapsing into a single job title. Output only when an identity with recorded consent is present.

Alignment against project requirements is also conducted without ranking. The project side declares required domains, verification, rhythm, and inputs via `grift project`, and `grift align` aligns these against candidate observations along each axis. The alignment consists of only five states—overlap, outside_declared_range, observed_zero, not_observed, and not_declared—without calculating composite scores, rankings, or pass/fail determinations. When viewing on a team basis with `--team`, only the count of individuals meeting requirements is output; aggregations are not performed for groups of fewer than three to prevent individual identification.

When the base population is under 20, rates are omitted and only counts are shown; unobserved items are reported not as "no track record," but as "not observed" with stated reasons. `grift verify` recalculates saved reports under identical conditions and returns match, mismatch, or unverifiable, allowing the recipient to verify against tampering or discrepancies.

Starting from 0.9.0, the top of the Markdown generated by `grift actor` includes a short narrative describing work practices evident from the records. It details areas modified, pacing of changes, testing approach, and mode of involvement accompanied by counts and timeframes; this is followed by aspects not visible in the record and questions to explore in interviews. `grift project` describes the project repository's workflow following the same rules, omitting per-person metrics and involvement modes. `grift align` supplements the alignment of requirements and records with questions to explore in interviews. Narratives and questions are selected from numbers using a public [decision table](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/trait-profile.md) without AI. Since they are not included in the JSON, what can be verified via `grift verify` are the underlying numbers.

Narratives and questions about individuals are output only when based on a self-identified ID with a record of consent. Otherwise, a single sentence explains why they were omitted. Narratives are not output when displaying multiple individuals together (`--all`, `--top`).

The methodology is called TEP (Technical Evidence Pipeline). It consists of four stages: reading git records, counting them according to fixed rules, attaching denominators to counted values along with reasons for what could not be counted, and enabling anyone to recount following the exact same procedure. For details, refer to the [TEP page](https://griftai.org/tep) on the Grift website.

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

Starting from 0.9.0, the CLI's Markdown also labels the four perspectives—areas modified (work surface), pacing of changes (change rhythm), testing approach (verification profile), and mode of involvement—using the same names as griftai.org. JSON keys remain unchanged.

- Repository: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- Distribution: PyPI "grift-cli" (`pipx install grift-cli`, Python 3.11+)
- License: MIT
- Release notes: [github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases) (changes per version)

## Results

On September 8, 2026, we released [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/) on PyPI. Indicators were validated across 117 public repositories, and both comparisons that could be differentiated and those that could not yet be differentiated are published on GitHub (internal measurements; not audited by third parties).

On October 25, 2026, we cross-checked the website wording against the CLI output line by line. Because multi-person listings (`actor-index`) had been sorted in descending order of commit count despite notes stating "not a ranking," we changed the ordering to lexicographical order of IDs in [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0), released on October 26, 2026. Commit count values are retained. The background and the five acceptance criteria imposed on the 0.8 series are detailed in a [blog post](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/).

In [0.9.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0), released on October 27, 2026, we added the introductory narrative and interview questions described above to the reports. Concurrently, we removed the "strength" of tendencies row and the "fit" of alignment row from the Markdown, as comparing two reports could lead to interpretations of strong vs. weak candidates or suitable vs. unsuitable matches. We also corrected four areas where inaccurate numbers regarding individuals could be output.

In [0.9.1](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.1), released on October 28, 2026, we resolved issues identified after 0.9.0 where inaccurate numbers regarding individuals or projects could be output. No new commands were introduced, and the non-output of scores, rankings, or persona types remains unchanged. Due to updates in definition versions, reports and alignments saved under 0.9.0 can no longer be re-verified using `grift verify` in 0.9.1 (exceptions, such as project reports generated purely from requirements, are covered in the [migration notes](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.1/docs/migration-v091.md)).

We are currently preparing pilot programs (PoCs) with staffing agencies and SES companies to substantiate recommendation rationale based on records run locally by candidates themselves. We also welcome inquiries from recruiters at in-house product companies regarding pilot programs (PoCs) to verify candidates' past work patterns from candidate-shared records. We are aiming for a full commercial launch in 2027 based on pilot outcomes. Grift is also featured on [griftai.org](https://griftai.org).

Grift's philosophy is also featured in articles on [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) and [note](https://note.com/cor_instrument/n/nd58ba0955317).
