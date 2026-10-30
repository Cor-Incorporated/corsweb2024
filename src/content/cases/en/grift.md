---
title: "Grift — Resumes can be embellished. Evidence cannot. An OSS tool that extracts verifiable facts from git history"
description: "Grift, our proprietary product, extracts verifiable facts (observed values) rather than scores from engineers' git history. We share its architecture and the story behind shifting direction from an estimation-support web app to an OSS CLI and recommendation-support tool for staffing agencies and SES firms."
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "Staffing Agency", "SES", "Recruiting"]
publishedAt: 2026-06-30
updatedAt: 2026-10-28
summary: "Grift is our proprietary product that extracts \"verifiable facts\" from engineers' git history. It does not assign scores or rankings. Because it does not use AI (LLMs) for measurement, it produces the exact same results no matter who runs it, allowing recipients to verify the numbers themselves. The CLI is released as open-source software under the MIT License."
isDraft: false
featured: true
lang: "en"
translationSourceHash: "93cbb0803f562926b2ef1cdbf6ab3a50bfaecdfcb668cd2478e8aa436d42c9a5"
translatedAt: "2026-10-30T03:56:51.949Z"
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
2026-10-30: 0.9.2 の変更（Docker で実行、grift update、grift contribute の同意後の表示、リポジトリの文脈の年とタグの頻度）を「実装」と「成果」に足した。0.9.2 の公開後に出す。公開日は公開したら「成果」に足す。
-->

## Challenges

When recruitment agencies and sales reps at staffing (SES) companies recommend candidates to client companies, they need to explain "why we recommend this person." However, the materials they have on hand are almost entirely limited to resumes and impressions from interviews. Even if a resume states "5 years of Java," it does not convey the substance of the work—what kinds of changes were made and how they were verified as the candidate progressed.

Meanwhile, "activity volume," such as GitHub contribution graphs and commit counts, can now be easily inflated using generative AI and agents. Sheer quantity can no longer serve as a reliable basis for a recommendation. On the other hand, collapsing everything into a single score obscures what was measured, over what time frame, and against what base population, turning it into a tool for arbitrary screening. Both those making recommendations and those being recommended lacked "verifiable materials."

## Approach

Grift started in February 2026 as a web application supporting contract development estimates. While exploring the basis for these estimates, we realized that the most reliable evidence is the very git history that engineers have built over time, and in August 2026, we extracted the measurement components into a command-line tool. In September, we discontinued the legacy web application and shifted our focus toward supporting recruitment agencies and staffing (SES) sales.

In our design, we established three upfront commitments:

- No scoring: What we produce are observed values, and it is humans who judge. We do not generate composite scores, rankings, pass/fail decisions, or grades; every metric is always paired with a numerator and a denominator.
- Reproducible results every time: We do not use AI (LLMs) for measurement. Given the same repository and the same version, anyone running it will get the exact same numbers.
- Transmitted nowhere: It runs entirely on the local PC. Candidates themselves decide whether to share the results and which repositories to present.

Alongside these, we established seven codes of conduct, including "do not interpret absence as negative," "do not screen out candidates solely on metrics," and "do not measure others without their consent." We decided that any usage violating these standards must not be referred to by the method's name, TEP (Technical Evidence Pipeline).

## Implementation

The Grift CLI extracts the following observations solely from git history:

- Attribution distinction: Distinguishes who did the work across 11 categories, including the individual's original commits, work by others, bots, generated/vendor artifacts, and history inherited from upstream forks.
- Test co-change: The proportion of commits where tests were modified within the same commit as changes to production code.
- Corrective rework and path retouch: The proportion of rework or re-engagement on recently modified files (recorded as a trend, not used for pass/fail judgments).
- Repository context: Active working days, number of contributors involved, the top author's commit share, proportion of changes passing through review, and more.

In `report-v2`, added in v0.6, we expanded the layers that observe the shape of an individual engineer's work. All of these come with a numerator and a denominator, and are not assessments of job roles or skill levels.

- Work surface (`surface_profile`): The count of changes across 11 domains: test / docs / CI/CD / platform / data / observability / frontend / backend / config / generated & vendor / other.
- Change rhythm (`change_rhythm`): The number of days changes were submitted over the last 180 days, along with submission intervals (median and 90th percentile, percentage continuing within 2 days, and percentage with gaps of 30 days or more). These do not represent working hours or motivation.
- Verification profile (`verification_profile`): The proportion of commits that touched tests and their types (unit / integration / e2e / contract / unknown), as well as the proportion of fix commits accompanied by tests.
- 4 dimensions of roles (`role_profile`): Composed only of four axes—domain / work_type / time / process_position—without collapsing them into a single job title. Output only when an identity with recorded consent is present.

Alignment with project requirements is also performed without ranking. The project side declares the required domains, verification, rhythm, and inputs using `grift project`, and `grift align` aligns these against the candidate's observations across each axis. The alignment consists of only five states: overlap, outside_declared_range, observed_zero, not_observed, and not_declared; no overall score, rank, or pass/fail verdict is calculated. When viewed at the team level via `--team`, it displays only the number of people meeting the requirements and suppresses aggregation for fewer than 3 individuals to prevent identifying individuals.

When the base population is under 20, rates are omitted in favor of raw counts, and unobservable items are marked as "not observed" with an accompanying reason rather than "no track record." `grift verify` recalculates saved reports under the identical conditions and returns matched, mismatched, or unprovable, allowing the recipient to verify any tampering or discrepancies.

Starting from 0.9.0, a concise sentence describing the work approach visible from the record is placed at the top of the Markdown in `grift actor`. It notes the areas modified, the pace of changes, testing practices, and collaboration patterns, accompanied by counts and time periods; this is followed by what cannot be seen from the record, laying out what should be verified during an interview in the form of questions. `grift project` describes the project repository's workflow using the same rules, omitting per-person numbers and collaboration patterns. `grift align` supplements the alignment of requirements and records with questions to explore during the interview. Sentences and questions are selected from numbers using a published [decision table](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/trait-profile.md), without using AI. Because they are not included in the JSON, what can be verified with `grift verify` are the underlying numbers behind the sentences.

Sentences and questions regarding an individual are generated only when the individual has self-identified their ID and there is a record of consent. Otherwise, a single sentence stating the reason for omission is displayed. When displaying multiple individuals together (`--all`, `--top`), these sentences are omitted.

The name of this methodology is TEP (Technical Evidence Pipeline, a flow for extracting technical evidence). It consists of four stages: reading the git history, counting according to fixed rules, attaching denominators and reasons for uncounted items to the calculated values, and ensuring that anyone can recalculate following the same procedure. A detailed explanation can be found on the [TEP page](https://griftai.org/tep) on the Grift website.

The terminology used on this page and griftai.org corresponds to the terms written in CLI outputs as follows:

| Term on site | CLI term |
|---|---|
| Observed values | observed value (`kind: observed`; includes value, unit, and denominator) |
| Test co-change | test co-change |
| Corrective rework | corrective rework |
| Path retouch | path retouch |
| Code recency | survival (only when `--survival` is specified) |
| Repository context | context profile |
| Work surface / change rhythm / verification profile | surface_profile / change_rhythm / verification_profile |

Starting from 0.9.0, the CLI's Markdown output also uses the same terms as griftai.org for the four perspectives: areas modified (work surface), pace of changes (change rhythm), testing practices (verification profile), and collaboration patterns. The JSON keys remain unchanged.

In 0.9.2, we made it possible to run via a Docker image built from the grift-cli repository without installing Python on the host. The repository to be inspected must have its full history fetched and passed to `/repo`. Working trees created with `git worktree` cannot be used.

`grift update` was changed to explicitly update the current environment and display the updated version. `grift update --check` only reads information about the latest version on PyPI and does not perform updates. There are no automatic updates, nor does the routine measurement command transmit data to check versions.

`grift contribute` saves the submission file locally after obtaining the individual's consent, and displays the information and destination required for submission. It is not sent automatically. When publicly submitting a file generated with the default `--door local`, re-generate it with `--door public-pr` and use the newly displayed submission ID, hash, and meta. The file contents will be public whether submitted as a public PR by the individual or as an anonymized proxy PR.

- Repository: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- Distribution: PyPI "grift-cli" (`pipx install grift-cli`, Python 3.11+)
- License: MIT
- Release Notes: [github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases) (changes by version)

## Outcomes

On September 8, 2026, we released [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/) on PyPI. Metrics were validated across 117 public repositories, and both comparisons that could be distinguished and those that could not yet be distinguished are published on GitHub (these are internal measurements and have not undergone third-party audit).

On October 25, 2026, we cross-checked the website wording against the CLI output line by line. Because the multi-person list (`actor-index`) was sorted in descending order of commit count despite a note stating "this is not a ranking," we changed the ordering to alphabetical order of IDs in [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0), released on October 26, 2026. The commit count values are retained. The background and the five acceptance criteria imposed on the 0.8 series are described in a [blog post](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/).

In [0.9.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0), released on October 27, 2026, we added the summary sentence at the beginning of the report and the interview questions described above. At the same time, we removed the trend "strength" line and the alignment "direction" line from the Markdown. This was because viewing two reports side by side could lead to them being interpreted as strong/weak candidates or good/bad fits. We also fixed four areas where values misrepresenting facts about individuals could be generated.

In [0.9.1](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.1), released on October 28, 2026, we fixed areas discovered after 0.9.0 where values misrepresenting facts about individuals or projects could be produced. No new commands were added, and our policy of not outputting scores, rankings, or personality/skill type labels remains unchanged. Due to changes in definition versions, reports and alignments saved under 0.9.0 can no longer be recalculated with `grift verify` in 0.9.1 (exceptions, such as project reports created solely from requirements, are noted in the [migration notes](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.1/docs/migration-v091.md)).

In [0.9.2](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.2), the repository context output was updated to display the first and last active years in the observed history, along with the numerator and denominator for tag frequency. Because the last active year is displayed even for individuals who are currently active, it does not indicate departure or resignation. Tag frequency is an annualized value calculated as "tag count ÷ active period in days × 365.25", and does not represent the observed number of releases. Our policy of not generating scores, rankings, or pass/fail decisions remains unchanged.

Currently, we are preparing proof-of-concept (PoC) trials with recruitment agencies and staffing (SES) companies to substantiate recommendation rationale based on records run locally by the candidates themselves. We are also accepting inquiries from hiring managers at product companies regarding PoC trials to verify what kinds of work candidates have done based on records shared by the candidates themselves. Taking into account the results of these trials, we are aiming to launch the official release in 2027. Grift is also introduced on [griftai.org](https://griftai.org).

The philosophy behind Grift is also shared in articles on [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) and [note](https://note.com/cor_instrument/n/nd58ba0955317).
