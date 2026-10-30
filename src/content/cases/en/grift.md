---
title: "Grift — Resumes can be embellished. Evidence cannot. An OSS tool that extracts verifiable facts from git history"
description: "Grift is our in-house product that extracts verifiable facts (observed values) rather than scores from an engineer's git history. Here, we share the design and the story of how we pivoted from an estimation support web app to an open-source CLI and recommendation support tool for staffing agencies and SES providers."
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "Staffing Agency", "SES", "Recruitment"]
publishedAt: 2026-06-30
updatedAt: 2026-10-28
summary: "Grift is our in-house product that extracts \"verifiable facts\" from an engineer's git history. It assigns no scores or rankings. Because it does not use AI (LLMs) for measurement, it yields the same results no matter who runs it, allowing the recipient to verify the findings independently. The CLI is released as open source under the MIT license."
isDraft: false
featured: true
lang: "en"
translationSourceHash: "ce7e4b679a9275c594e1988d06ee37cd223d1c0192af506aa307ea7b0c8f1ff6"
translatedAt: "2026-10-30T12:27:32.210Z"
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
2026-10-30: 0.9.2 の変更（Docker で実行、grift update、grift contribute の同意後の表示、リポジトリの文脈の年とタグの頻度）を「実装」と「成果」に足した。0.9.2 の公開後に出す。公開日は公開したら「成果」に足す。同日、release/v0.9.2 の CHANGELOG（c7e2a6e）と突き合わせ、grift update・grift contribute・文脈の表示の書き方を CHANGELOG と docs/usage.md に揃え、定義の版が変わったことを「成果」に足した。
-->

## Challenges

Staffing agency consultants and SES sales representatives need to explain "why we recommend this candidate" when presenting them to client companies. However, the materials they have at hand are almost entirely resumes and interview impressions. Even if a resume states "5 years of Java," it does not convey the actual substance of the work—what kind of changes the candidate made or how they verified them along the way.

Meanwhile, "activity volume" like GitHub contribution graphs and commit counts has become easy to inflate using generative AI and agents. High volume alone can no longer serve as a solid ground for recommendation. On the other hand, collapsing everything into a single score obscures what was measured, over what period, and against what population, turning it into a blunt screening tool. Both those recommending and those being recommended lacked "verifiable materials."

## Approach

Grift began in February 2026 as a web application supporting contract development estimates. While exploring the basis for estimates, we realized that the most reliable material is the git history engineers have built up themselves, and in August 2026 we extracted the measurement portion as a command-line tool. In September, we discontinued the former web application and pivoted toward supporting staffing agencies and SES sales teams.

In our design, we established three commitments upfront:

- Do not turn it into a score: What we output are observed values, and decisions are made by humans. We do not produce composite scores, rankings, pass/fail decisions, or grades, and every number is always accompanied by a numerator and a denominator.
- Identical results every time: We do not use AI (LLMs) for measurement. For the same repository and the same version, anyone running it will get the exact same numbers.
- Transmitted nowhere: It runs exclusively on the local PC. Whether to share it, and which repositories to output, is entirely up to the individual.

In addition, we established a seven-article code of conduct, including "Do not interpret absence negatively," "Do not screen candidates based solely on numbers," and "Do not measure others without their consent." We decided that any usage failing to comply with these rules may not be referred to by the method's name (TEP: Technical Evidence Pipeline).

## Implementation

The Grift CLI extracts the following observations solely from git history:

- Attribution distinctions: Classifies whose work it is across 11 categories, including the individual's own commits, others' work, bots, generated/vendor artifacts, and history inherited from upstream forks.
- Test co-change: The proportion of commits where tests were modified in the same commit as production code changes.
- Corrective rework and path retouch: The rate of rework or re-touching on recently modified files (recorded as tendencies, not used for pass/fail decisions).
- Repository context: Active days, number of contributors and the top author's share, percentage via reviews, etc.

Added in v0.6, `report-v2` introduces an expanded layer for observing how an individual engineer works. All metrics come with numerators and denominators, and none represent judgments of job titles or abilities.

- Work surface (`surface_profile`): How many changes occurred across 11 categories: test / docs / CI/CD / platform / data / observability / frontend / backend / config / generated/vendor / other.
- Change rhythm (`change_rhythm`): The number of days changes were submitted within the last 180 days, and the submission intervals (median and 90th percentile, rate of follow-ups within 2 days, rate of gaps of 30 days or more). This does not represent working hours or motivation.
- Verification profile (`verification_profile`): The proportion of commits touching tests and their types (unit / integration / e2e / contract / unknown), and the proportion of fix commits accompanied by tests.
- 4 dimensions of roles (`role_profile`): Composed solely of domain / work_type / time / process_position, without collapsing them into a single job title. Output only when an identity with recorded personal consent exists.

Alignments with project requirements are also conducted without assigning ranks. The project side declares the required domain, verification, rhythm, and input via `grift project`, and `grift align` aligns the candidate's observations along each axis. The alignment consists of only five states: overlap, outside_declared_range, observed_zero, not_observed, and not_declared; it calculates no composite score, ranking, or pass/fail result. When viewed at the team level via `--team`, it outputs only the count of individuals meeting the requirements, and does not aggregate when fewer than 3 individuals are present to avoid personal identification.

When the sample size is under 20, it shows only counts instead of rates, and unobserved items are output as "not observed" with an accompanying reason rather than "no track record." `grift verify` recalculates saved reports under the same conditions and returns match, mismatch, or unverifiable, allowing the recipient to verify any tampering or discrepancies.

Starting with 0.9.0, a short narrative describing work practices visible from the record is placed at the top of the Markdown in `grift actor`. It describes the categories of changed areas, the pace of changes, how tests are added, and the nature of involvement, accompanied by counts and periods; it then notes what cannot be seen from this record and lists items to verify in an interview in the form of questions. `grift project` describes the project repository's workflow under the same rules, omitting per-person numbers and involvement patterns. `grift align` accompanies the alignment between requirements and records with interview questions. Narratives and questions are selected from numbers using a published [decision table](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/trait-profile.md) without the use of AI. Because they are not included in the JSON, what can be verified via `grift verify` are the underlying numbers behind the narrative.

Narratives and questions about an individual are output only when using an ID self-declared by the person with a record of consent. Otherwise, a single sentence stating the reason for omission is output. When presenting multiple individuals together (`--all`, `--top`), no narratives are output.

The method is called TEP (Technical Evidence Pipeline). It consists of four stages: reading git records, counting them under defined rules, attaching denominators and reasons for uncounted items to the calculated values, and ensuring that anyone can recount them through the exact same procedure. For detailed explanations, see the [TEP page](https://griftai.org/tep) on the Grift website.

The terms used on this page and on griftai.org correspond to the words output by the CLI as follows:

| Term on the website | CLI term |
|---|---|
| Observed values | observed value (`kind: observed`; accompanied by value, unit, and denominator) |
| Test co-change | test co-change |
| Corrective rework | corrective rework |
| Path retouch | path retouch |
| Code recency | survival (only when `--survival` is specified) |
| Repository context | context profile |
| Work surface / change rhythm / verification profile | surface_profile / change_rhythm / verification_profile |

Starting with 0.9.0, the CLI's Markdown also labels the four perspectives—categories of changed areas (work surface), pace of changes (change rhythm), how tests are added (verification profile), and involvement—using the same naming as griftai.org. The JSON keys remain unchanged.

In 0.9.2, we made it possible to run via a Docker image built from the grift-cli repository without installing Python on the host. The repository to be inspected must have its full history fetched and passed to `/repo`. Working trees created with `git worktree` cannot be used.

`grift update` has been modified to update only the running environment and display the version installed after the update. It does not use other environments found in PATH. `grift update --check` only reads information about the latest version on PyPI and does not perform updates. There are no automatic updates or communications to check versions during regular measurement commands.

`grift contribute` saves submission files locally after obtaining the individual's consent. It does not send them automatically. Because files created with the default `--door local` cannot be submitted to public intake points, the submission ID, the file name within the PR, and the meta line are not displayed, and only the instructions for recreating them via `--door public-pr` are shown. When submitting publicly, use the submission ID, the file name within the PR, the meta line, and the URLs of the two submission paths displayed by the recreated execution. Whether submitted via a public PR by the individual or an anonymized proxy PR, the file contents will be public.

- Repository: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- Distribution: PyPI "grift-cli" (`pipx install grift-cli`, Python 3.11+)
- License: MIT
- Release Notes: [github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases) (changes by version)

## Achievements

On September 8, 2026, we released [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/) on PyPI. Indicators were verified across 117 public repositories, and both comparisons that could be distinguished and those that could not yet be distinguished are published on GitHub (measured internally; not audited by a third party).

On October 25, 2026, we cross-checked the website wording and CLI output line by line. Because the multi-person list (`actor-index`) was ordered by commit count descending despite the footnote stating "not a ranking," in [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0) released on October 26, 2026, we changed the ordering to lexicographical order by ID. The commit count value remains. The background and the five acceptance criteria imposed on the 0.8 series are described in our [blog post](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/).

In [0.9.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0) released on October 27, 2026, we added the introductory narrative and interview questions to the report described above. Simultaneously, we removed the tendency "strength" row and the alignment "orientation" row from the Markdown. This is because aligning two reports could be read as strong/weak candidates or matching/unmatching candidates. We also corrected four locations where factually incorrect numbers could be produced for individuals.

In [0.9.1](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.1) released on October 28, 2026, we fixed issues found after 0.9.0 where factually incorrect numbers could be produced for individuals or projects. There are no new commands, and the policy of outputting no scores, rankings, or type labels remains unchanged. Because the definition version changed, reports and alignments saved with 0.9.0 can no longer be verified with `grift verify` in 0.9.1 (exceptions, such as project reports created solely from requirements, are noted in the [migration notes](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.1/docs/migration-v091.md)).

In [0.9.2](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.2), within the repository context section of the Markdown in `grift report`, we added displays for the first and last active years in the observed history, as well as the numerator and denominator for tag frequency. The JSON values remain unchanged. Because the last active year is displayed even for individuals who are still active, it does not indicate departure or resignation. Tag frequency is an annualized value calculated as "tag count ÷ active period in days × 365.25," not the observed number of releases. For repositories with an active period of fewer than 20 days, it is not annualized, and only the tag count and number of days are displayed.

There are no new commands, and the policy of outputting no scores, rankings, or pass/fail decisions remains unchanged. There are also no modifications that alter analysis values; however, because the definition version was bumped, reports and alignments saved with 0.9.1 can no longer be verified with `grift verify` in 0.9.2 (exceptions, such as project reports created solely from requirements, are noted in the [migration notes](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.2/docs/migration-v092.md)).

Currently, we are preparing proof-of-concept (PoC) trial implementations with staffing agencies and SES companies to substantiate recommendation reasons based on records run locally by candidates themselves. We are also accepting inquiries from hiring managers at in-house development companies regarding PoC trials to verify what kind of work candidates have done based on records shared by the candidates themselves. We aim to launch the official version in 2027 based on the results of these trial implementations. Grift is also introduced on [griftai.org](https://griftai.org).

The philosophy behind Grift is also covered in articles on [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) and [note](https://note.com/cor_instrument/n/nd58ba0955317).
