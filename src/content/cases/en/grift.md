---
title: "Grift — Resumes can be embellished. Evidence cannot. An OSS tool that extracts verifiable facts from git history"
description: "Grift, our proprietary product, extracts verifiable facts (observed values) rather than scores from an engineer's git history. Here, we share its architecture and the story behind shifting direction from an estimation support web app to an open-source CLI and recommendation support tool for staffing agencies and SES providers."
category: "grift"
tags: ["Grift", "OSS", "CLI", "git", "Staffing Agency", "SES", "Recruitment"]
publishedAt: 2026-06-30
updatedAt: 2026-10-31
summary: "Grift is our proprietary product that extracts verifiable facts from an engineer's git history. It assigns no scores or rankings. Because it does not use AI (LLMs) for measurement, it yields identical results no matter who runs it, allowing recipients to verify the data themselves. The CLI is released as open-source software under the MIT license."
isDraft: false
featured: true
lang: "en"
translationSourceHash: "6ef8194a514d202c2b450d889b28ec82bda30c14a0122cd1097c0e3a21d0f2b1"
translatedAt: "2026-10-31T06:22:11.921Z"
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
2026-10-30: 0.9.2 の変更（Docker で実行、grift update、grift contribute の同意後の表示、リポジトリの文脈の年とタグの頻度）を「実装」と「成果」に足した。0.9.2 は 2026-10-31 に PyPI へ公開（Release v0.9.2）。2026-10-31 に公開日を「成果」に足した。同日、release/v0.9.2 の CHANGELOG（c7e2a6e）と突き合わせ、grift update・grift contribute・文脈の表示の書き方を CHANGELOG と docs/usage.md に揃え、定義の版が変わったことを「成果」に足した。
-->

## The Challenge

Recruitment agency consultants and SES sales representatives need to explain "why we recommend this candidate" when putting them forward to companies. However, the materials on hand are almost entirely limited to resumes and interview impressions. Even if a resume states "5 years of Java," it does not convey the substance of the work—such as what kinds of changes were made and how they were verified along the way.

Meanwhile, "activity metrics" like GitHub contribution green squares and commit counts can now be easily inflated using generative AI and agents. High volume can no longer serve as a reliable basis for a recommendation. On the other hand, collapsing everything into a single score obscures what was measured, over what time period, and against what base population, causing it to be used merely as an arbitrary screening tool. Both those recommending and those being recommended lacked "verifiable evidence."

## The Approach

Grift began in February 2026 as a web application supporting estimates for contract development. While exploring the rationale behind estimates, we realized that the most reliable evidence is the very git history that engineers have built up, and in August 2026, we separated the measurement component into a command-line tool. In September, we discontinued the legacy web application and pivoted our direction toward supporting sales representatives at recruitment agencies and SES companies.

During the design phase, we established three core commitments upfront:

- Do not score: Output observed values, and let humans make the judgments. Produce no composite scores, rankings, pass/fail decisions, or grades, and always attach a numerator and a denominator to numerical values.
- Identical results every time: Do not use AI (LLMs) for measurement. With the same repository and the same version, anyone running it will get the exact same numbers.
- Transmit nowhere: Runs entirely on the local machine. The individual decides whether to share it and which repositories to present.

In addition, we established a seven-article code of conduct, including rules such as "do not read absence as negative," "do not screen out based on numbers alone," and "do not measure others without their consent," and determined that any usage failing to uphold these rules cannot be referred to by the method's name (TEP: Technical Evidence Pipeline).

## Implementation

The Grift CLI extracts observations like the following exclusively from git history:

- Attribution distinction: Distinguishes whose work it is across 11 classifications, including the individual's original commits, work by others, bots, generated/vendor artifacts, and history inherited from upstream forks.
- Test co-change: The proportion of commits where tests were modified in the same commit as changes to production code.
- Corrective rework and path retouch: The proportion of rework and re-touching on recently modified files (recorded as tendencies, never used for pass/fail decisions).
- Repository context: Active days, number of contributors involved, the most prolific author's share of commits, the proportion of changes made via code review, and more.

In `report-v2`, added in v0.6, we expanded the layers for examining the shape of a single engineer's work. All of them come with a numerator and a denominator, and they do not evaluate job titles or capabilities:

- Work surface (`surface_profile`): How many changes occurred across 11 distinct areas: test / docs / CI/CD / platform / data / observability / frontend / backend / config / generated/vendor / other.
- Change rhythm (`change_rhythm`): The number of days changes were submitted within the past 180 days, along with submission intervals (median and 90th percentile, percentage followed within 2 days, and percentage spaced by 30 days or more). This does not measure working hours or motivation.
- Verification profile (`verification_profile`): The proportion of commits that touched tests and their types (unit / integration / e2e / contract / unknown), as well as the proportion of fix commits accompanied by tests.
- 4 dimensions of roles (`role_profile`): Composed solely of four dimensions—domain / work_type / time / process_position—without collapsing into a single job title. Only output when an identity with recorded personal consent is present.

Cross-referencing with project requirements is also conducted without assigning rankings. The project side declares the required areas, verification, rhythm, and inputs using `grift project`, and `grift align` compares them side-by-side with the candidate's observations along each axis. The alignment falls strictly into five categories: overlap, outside_declared_range, observed_zero, not_observed, or not_declared; no overall scores, rankings, or pass/fail determinations are calculated. When viewing at the team level with `--team`, it outputs only the head count meeting the requirements, and does not aggregate when fewer than 3 individuals are present to avoid personally identifying individuals.

When the base population is under 20, it shows only counts instead of rates, and unobserved items are output with a stated reason as "unobserved" rather than "no track record." `grift verify` recalculates a saved report under the same conditions and returns match, mismatch, or unverifiable, allowing the recipient to verify whether there has been tampering or discrepancy.

Starting with 0.9.0, concise narrative sentences describing the way of working visible from the records are placed at the beginning of the Markdown output of `grift actor`. Describing the breakdown of modified areas, the pace of changes, testing approach, and involvement style alongside counts and timeframes, it follows up by stating what cannot be seen from this record, listing things to verify in an interview in the form of questions. `grift project` describes the project repository's workflow under the same conventions, omitting per-person numbers and involvement styles. `grift align` supplements the alignment of requirements and records with things to verify in an interview in the form of questions. The sentences and questions are selected from numbers using a published [decision table](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/trait-profile.md) without using AI. Because they are not included in the JSON, what can be verified with `grift verify` are the underlying numbers from which the sentences were generated.

Sentences and questions regarding an individual are output only when an identity claimed by the person with a record of consent is present. Otherwise, a single sentence stating the reason for omission is written. Sentences are not output when listing multiple individuals together (`--all`, `--top`).

The method is called TEP (Technical Evidence Pipeline). It consists of four stages: reading git records, counting according to fixed rules, attaching denominators and reasons for uncounted items to the counted values, and enabling anyone to recount using the exact same procedure. Detailed explanations can be found on the [TEP page](https://griftai.org/tep) of the Grift website.

The terminology used on this page and griftai.org corresponds to the terms written in the CLI output as follows:

| Term on the website | CLI term |
|---|---|
| Observed values | observed value (`kind: observed`; includes value, unit, and denominator) |
| Test co-change | test co-change |
| Corrective rework | corrective rework |
| Path retouch | path retouch |
| Code recency | survival (only when `--survival` is specified) |
| Repository context | context profile |
| Work surface, change rhythm, verification profile | surface_profile / change_rhythm / verification_profile |

Starting with 0.9.0, the CLI's Markdown also writes the four perspectives—breakdown of modified areas (work surface), pace of changes (change rhythm), testing approach (verification profile), and involvement style—using the same names as griftai.org. The JSON keys remain unchanged.

In 0.9.2, we made it possible to run using a Docker image built from the grift-cli repository without installing Python on the host. Fetch the full history of the repository you wish to read and pass it to `/repo`. Working trees created with `git worktree` cannot be used.

`grift update` has been modified to update only the currently running environment and display the installed version after the update. It does not use other environments found in PATH. `grift update --check` only reads information about the latest version on PyPI and does not perform an update. There are no automatic updates, nor does normal measurement command execution communicate over the network to check versions.

`grift contribute` saves the submission file locally after the individual gives consent. It is never transmitted automatically. Because a file created with the default `--door local` cannot be submitted to the public inbox, it displays neither a submission ID, a filename within the PR, nor meta lines, showing only the steps to recreate it with `--door public-pr`. When making a public submission, use the submission ID, the filename within the PR, and the meta lines displayed by the recreated run, along with the URLs of the two submission paths. Whether submitted via a public PR by the individual or an anonymized proxy PR, the file contents will be public.

- Repository: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- Distribution: PyPI "grift-cli" (`pipx install grift-cli`, Python 3.11+)
- License: MIT
- Release notes: [github.com/Cor-Incorporated/grift-cli/releases](https://github.com/Cor-Incorporated/grift-cli/releases) (changes per version)

## Outcomes

On September 8, 2026, we released [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/) on PyPI. The metrics were validated across 117 public repositories, and both comparisons that could be distinguished and those that could not yet be distinguished are published on GitHub (measured in-house; not audited by a third party).

On October 25, 2026, we cross-checked the text on the website line-by-line with the CLI output. Because the multi-person list (`actor-index`) was ordered by commit count despite a note stating "not a ranking," we changed the ordering to lexicographical order of IDs in [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0), released on October 26, 2026. Commit count values are retained. The background and the five acceptance criteria imposed on the 0.8 series are described in a [blog post](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/).

In [0.9.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0), released on October 27, 2026, we added the narrative sentences and interview questions at the beginning of the report described above. At the same time, we removed the tendency "strength" row and the alignment "orientation" row from the Markdown. This is because placing two reports side-by-side could be misread as identifying strong vs. weak individuals, or matching vs. non-matching individuals. We also corrected four areas where numbers contrary to fact could be output regarding individuals.

In [0.9.1](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.1), released on October 28, 2026, we fixed areas discovered after 0.9.0 where numbers contrary to fact could be output regarding individuals or projects. There are no new commands, and the non-output of scores, rankings, and type names remains unchanged. Because the definition version was bumped, reports and alignments saved under 0.9.0 can no longer be recalculated using `grift verify` in 0.9.1 (exceptions, such as project reports created solely from requirements, can be found in the [migration notes](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.1/docs/migration-v091.md)).

In [0.9.2](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.2), released on October 31, 2026, the repository context section in the Markdown of `grift report` now displays the first and last years of activity within the observed history, along with the numerator and denominator of tag frequency. The JSON values remain unchanged. Because the last active year is displayed even for individuals who are currently active, it does not indicate departure or resignation. Tag frequency is an annualized figure calculated as "tag count ÷ active period days × 365.25," not the observed number of releases. For repositories with an active period of fewer than 20 days, it is not annualized, displaying only the tag count and number of days.

There are no new commands, and the non-output of scores, rankings, and pass/fail determinations remains unchanged. There are also no corrections modifying analysis values, but because the definition version was bumped, reports and alignments saved under 0.9.1 can no longer be recalculated using `grift verify` in 0.9.2 (exceptions, such as project reports created solely from requirements, can be found in the [migration notes](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.2/docs/migration-v092.md)).

We are currently preparing pilot deployments (PoC) with recruitment agencies and SES companies to substantiate the rationale behind recommendations based on records run locally by the candidates themselves. We also welcome inquiries regarding pilot deployments (PoC) from hiring managers at in-house product development companies to verify what kind of work candidates have done from records shared by the candidates themselves. We aim to launch the official version in 2027 based on the results of these pilot deployments. Grift is also introduced at [griftai.org](https://griftai.org).

The philosophy behind Grift is also introduced in articles on [Qiita](https://qiita.com/terisuke/items/c6bb68b3af0db3d43bb1) and [note](https://note.com/cor_instrument/n/nd58ba0955317).
