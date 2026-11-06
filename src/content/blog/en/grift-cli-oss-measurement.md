---
title: "What Git History Can and Cannot Show: Checking Four OSS Projects with Grift"
description: "This article separates what can be counted from a git history under stated rules, and what cannot. Four real OSS projects were checked at repository level. It does not guarantee a person's ability or that the record is complete."
summary: "What Grift checks is the result of counting a given record under stated rules. If the input range and commit, the CLI version, and the definitions and settings are the same, anyone arrives at the same values. Measuring four real OSS projects showed differences in work areas and change intervals, while it does not guarantee a person's ability or the completeness of the record."
pubDate: 2026-10-25
updatedDate: 2026-10-29
author: "Terisuke"
category: "engineering"
ctaIntent: "grift-team-beta"
tags: ["Grift", "OSS", "CLI", "git", "実測"]
lang: "en"
featured: false
isDraft: false
translationSourceHash: "75880e785376c1dd4282d8cbc16ea72155087b188d630bf6e14a8cf249212451"
translatedAt: "2026-10-29T05:20:00.000Z"
translationModel: "manual-i18n-sync"
---

Even if a resume says "Python: 5 years," it does not tell you what kind of work was done during those 5 years.

Years of experience and person-months serve as rough indicators of the volume of work. However, they do not reveal a person's work style: whether they move forward while writing tests to verify functionality, whether they keep documentation organized, or whether they ship small changes frequently.

Staffing agency and SES (System Engineering Service) sales representatives often find themselves stuck, unable to state the basis for their recommendations with solid evidence. At Cor.Inc., we believe one cause lies in this gap.

## Why We Do Not Assign Scores

Grift is an in-house product we built to bridge this gap. From records left in git (a system that records software changes one by one), it extracts work tendencies alongside the counts that serve as the evidence behind them. It produces neither scores nor rankings.

When our representative, Kousuke Terada, was in recruitment advertising sales at Recruit, he experienced the frustration of words failing to get through. The words for Grift are: "Verifiable grounds for explaining a career."

What Grift checks is the result of counting a given record under stated rules. Work that was not recorded, the background of how a record was made, and the actual contribution to an outcome are not known from that count alone. Being able to recalculate does not guarantee a person's ability or the completeness of the record.

What happens when you reduce things to a score? Rounding different types of records into a single number erases what was counted and what could not be counted. Furthermore, once a score exists, whoever has a higher score looks like the better candidate. Line them up, and it becomes a ranking.

What Grift aims to do is not to rank people. It is to keep the result of counting a given record under stated rules. The decision-making is left to humans.

## How It Differs from the MBTI

Hearing "we do not assign rankings," some might think of the MBTI.

In the MBTI, respondents answer questions, and 16 types are derived from combinations of four preferences. The Myers & Briggs Foundation states that every type is valuable and that it was not designed for hiring purposes.

Grift asks no questions. It does not assign type names. Nor is it a tool for personality assessment. It counts records left in git, presenting tendencies along with the counts that serve as their evidence.

The difference becomes easier to understand when applied to the challenges sales representatives face.

*Not knowing how far to trust self-reported statements on a resume.* MBTI results, like resumes, are derived from the individual's own answers. Grift's basis is records. If the input range and commit, the CLI version, and the definitions and settings are the same, anyone arrives at the same values.

*Not knowing a person's work style from years of experience or person-months.* Grift presents counts showing which areas they have touched (tests, documentation, core program code, etc.), the intervals at which they ship changes, and whether tests accompany fix changes.

However, things not captured in records are not shown. Meeting contributions, the quality of code reviews, and unreleased work are not visible. Without the individual's consent, personal experience and roles are not displayed either.

## The TEP Process

Grift calls the procedure for extracting facts from records the TEP (Technical Evidence Pipeline). It consists of four stages:

1. Read the git records. No AI speculation is used
2. Count according to fixed rules. For example, classify files as tests or documentation based on their location and name
3. Attach denominators and reasons for uncounted items to the calculated values
4. Enable anyone to recount using the exact same procedure

At Grift, we call this fourth step of recounting "verification." A detailed explanation of TEP can be found on the [TEP page](https://griftai.org/tep) on the Grift website.

## Testing with Real-World OSS

Can this procedure truly reveal work tendencies? On October 25, 2026, we verified this using Grift CLI (Grift's command-line tool) version 0.8.0. As of that day, 0.8.0 was still being prepared for release; it was released the following day, October 26 ([Release Notes](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0)).

To avoid measuring real individuals without consent, we measured open-source software (OSS) repositories (locations where records for a single piece of software are kept) as units. Not a single person-specific number is included in this article.

We measured four repositories with differing characteristics:

- click: A library for building command-line tools in Python (a component used by other programs)
- flask: A library for building web services in Python
- httpx: A library for web communication in Python
- commander.js: A library for building command-line tools in JavaScript

## What We Found

For all four, both measurement and verification were completed in under 2.5 seconds. The verification results matched across all items for all four.

Differences in the character of each repository were also visible.

In click, there were 187 changes across the 180 days leading up to the final date in the record. The median interval between changes was about 2 hours. Changes were continuous at short intervals.

In flask, there were 1,841 changes touching documentation, exceeding the changes touching core program code (1,765).

In httpx, 575 out of 1,335 changes included test files.

In commander.js, core JavaScript files were not counted as "core program code" and ended up in "other." This is a gap in Grift's rules: JavaScript's `.js` was not included among the file extensions counted as core program code.

## Misreading the Numbers

What we learned from taking these measurements was that simply lining up numbers immediately leads to misinterpretations. Here are five examples.

### Number of Changes

A repository with a high number of changes is not necessarily a good repository. flask had 3,674 changes, while httpx had 1,335. The history spans 5,976 days for flask and 2,517 days for httpx. The number of changes varies with the length of history and whether changes are squashed when merged.

### Documentation Changes

A high number of documentation changes does not necessarily mean a team is dedicated to documentation. In click, about 40% of the changes counted as documentation touched only changelog files. In repositories where changelogs are updated with every change, documentation counts increase.

### Fix Changes

The fact that changes with subject lines starting with "fix" do not include tests does not mean tests are not being written. Recounting changes starting with "fix" in flask revealed that 198 out of 407 changes touched only documentation or configuration files. Their subject lines included things like "fix typo."

### Few Changes

Few changes do not mean development has stalled. In httpx, there were only 11 changes within the observed 180-day window, resulting in an interval marked as "unobserved" (could not be measured). The measurement was taken on a local copy cloned on September 2, not its current state.

### Active Days

Active days (the number of days with changes) can be inflated depending on how changes are split. We created two small repositories for testing and added the exact same five lines. Adding them all at once resulted in 2 active days, while splitting them across 5 days at one line per day resulted in 6 days (both include the initial commit). The contents are identical.

Grift does not adjust this number. Instead, it places a note next to the number: "Increases if a small commit is placed every day, and decreases if the same changes are combined into a single day."

## What Was Not Visible

Grift marks things that could not be measured as "unobserved." "Unobserved" means "could not be measured," not "there was no track record." Across the four repositories, the following were not visible:

- Reviews and issue tracking: Unobserved because records from platforms like GitHub were not provided
- Personal experience and roles: Unobserved because individual consent was not given
- Whether changes were made internally: All marked as "undetermined" because internal company email addresses were not defined

We will also share what did not work well. As mentioned earlier, commander.js's core code falling into "other" was a gap in our rules. Additionally, in an article published the same day, we noted that "test co-change (the proportion of commits changing tests alongside core code) also increases with superficial test changes." In 0.8.0, this cautionary note does not yet appear alongside the number. Only the single sentence regarding active days was included.

## What Was Fixed in 0.8.0

In [0.7.2](https://pypi.org/project/grift-cli/0.7.2/) (the public release at the time of measurement), the list of contributors to a repository was sorted in descending order of changes. This allowed the top person to be interpreted as "the person who contributed the most." In 0.8.0, they are sorted by ID (a identifier assigned to each person).

We compared the lists between 0.7.2 and 0.8.0 across the four repositories. We looked only at the ordering, without considering names and counts. In 0.7.2, the person with the most changes was at the top in all four. In 0.8.0, that person's row was at line 120 of 467 in click, line 280 of 870 in flask, line 232 of 258 in httpx, and line 15 of 203 in commander.js.

If the 0.8.0 list is resorted by commit count, it fails verification. All other values remained identical between 0.7.2 and 0.8.0.

## Aligning with Project Requirements

When matching with projects, the project's requirements are written down in advance. In Grift, we call this a declaration. It is presented alongside what was observed from git (observations) in a separate column, without issuing a pass or fail grade.

As an experiment, we declared a hypothetical small project: "Python Library Maintenance." The declaration required: 12 or more active days within 180 days, a median change interval of 7 days or fewer, touching core program code and tests, the presence of unit tests, and review of records such as GitHub.

When applied to click, the observed "62 days" appears alongside the declaration's "12 days or more." Because records such as GitHub were not provided, that column remains unobserved.

Even side by side, the misinterpretations discussed in the previous section remain. The "0" for core program code in commander.js is due to a rule gap, and httpx's interval is unobserved due to insufficient records. How to interpret these aligned values is up to humans to decide.

There is also a use case for aligning an individual engineer's records with a project. In that case, only records with the individual's consent are used. Because this involves measuring real individuals, it was not tested in this article.

## Conclusion

Git records provide material to verify the statements on a resume. However, there is also work that leaves no trace in records.

What Grift presents are tendencies, the counts that serve as their evidence, and the reasons for what could not be seen. What conclusions to draw from them is for the reader to decide.

## Supporting Figures

To allow engineers to verify this on their own machines, the conditions and figures from our measurements are summarized below.

- grift 0.8.0 (definition version `tep-v0.8.0-2026-10-25`). We installed the unreleased source (`87076c8` from the development repository) locally. The published 0.8.0 `src/` (program core) is identical to this source
- For comparison, the then-public version [0.7.2](https://pypi.org/project/grift-cli/0.7.2/) was also run on the same four repositories
- Apple M4 Max, macOS 26.7.1, Python 3.12.9, git 2.54.0
- The targets were the four local repositories cloned on September 2, 2026, and left un-updated

The commit (record of a single change) SHAs (identifiers attached to each commit) measured and their dates are as follows:

```text
pallets/click    36baa15ff831b939a22bc527cd76ce653ef6f66d  2026-08-26
pallets/flask    d318b683471101618febed18996405ad26462110  2026-08-16
encode/httpx     b5addb64f0161ff6bfe94c124ef76f6a1fba5254  2026-02-23
tj/commander.js  ba6d13ddb4243e5913367734f8c159089ffe7834  2026-05-29
```

Commands using click as an example:

```bash
git clone https://github.com/pallets/click
git -C click checkout 36baa15ff831b939a22bc527cd76ce653ef6f66d
grift repo click --format both --out out/click
grift verify out/click/report.json --repo click
```

`grift repo` completed within 2.5 seconds for all four, and `grift verify` was `VERIFIED` across all four. A newly cloned click yielded identical results except for execution timestamps. Even using the same source as the then-public version [0.7.2](https://pypi.org/project/grift-cli/0.7.2/), the observed values listed here were identical.

| Repository | Human commits / merges / bots |
|---|---|
| click | 2,000 / 1,131 / 200 |
| flask | 3,674 / 1,691 / 191 |
| httpx | 1,335 / 41 / 147 |
| commander.js | 1,095 / 284 / 138 |

Human commits exclude merges (records incorporating changes from another branch). Changes by bots (automated commit programs) are excluded.

The work surface (`surface_profile`) categorizes commits by file location and extension, counting commits per category. Because a single commit can touch multiple categories, the total exceeds the denominator.

| Repository | Denominator | test / docs / backend / other |
|---|---|---|
| click | 1,999 | 562 / 1,024 / 1,158 / 309 |
| flask | 3,673 | 627 / 1,841 / 1,765 / 575 |
| httpx | 1,333 | 575 / 501 / 874 / 112 |
| commander.js | 1,094 | 286 / 468 / 0 / 530 |

Change intervals (`change_rhythm`) use the HEAD date as the observation date, counting within the preceding 180 days. Observation dates correspond to the dates listed to the right of the SHAs above.

| Repository | Commits / Active days | Median interval / p90 |
|---|---|---|
| click | 187 / 62 days | 0.08 days / 3.36 days |
| flask | 32 / 19 days | 0.80 days / 15.60 days |
| httpx | 11 / 8 days | Unobserved |
| commander.js | 22 / 18 days | 2.88 days / 17.89 days |

The reason for httpx being unobserved is `insufficient_population`. There were 11 commits in the window, falling short of the 20-commit threshold required to calculate a rate.

The verification profile (`verification_profile`) counts commits that touched test locations.

| Repository | Commits including tests | Commits modifying tests with fix subject |
|---|---|---|
| click | 562 / 2,000 | 80 / 249 |
| flask | 627 / 3,674 | 58 / 408 |
| httpx | 575 / 1,335 | 46 / 114 |
| commander.js | 286 / 1,095 | 30 / 106 |

Test types were: click had 555 unit, 23 unknown; flask had 484 unit, 204 unknown; httpx had 554 unit, 101 unknown; commander.js had 286 unknown.

Unobserved items totaled 23 for click, flask, and commander.js, and 27 for httpx. The primary reasons are as follows:

- `forge_export_not_provided`, `tracker_export_not_provided`: Reviews, issue tracking, events
- `consenting_actor_required`: Experience, roles, library context
- `no_upstream_lineage`, `parent_repo_not_provided`, `template_not_provided`: Relationship with upstream, inheritance from templates
- `no_tenant_commits`: Period covering 80% of internal commits
- `survival_scan_disabled`: Code recency (how recently the current code was written)
- `outcome_declaration_not_provided`: Declarations of post-work occurrences
- `deferred_to_v0.6`: Line-level rework (retained under its 0.6-era name even in 0.8.0)

Origin (`origin`) showed that for all four repositories, all non-bot commits were `unresolved`. This is because neither an identity.toml defining internal company email addresses nor fork parents were provided.

The breakdown of commits counted as documentation in click and fix commits in flask are not Grift outputs. They are rough counts recalculated locally by applying the same rules to git log. For click, 414 out of 1,025 commits touched only `CHANGES.rst` under documentation. For flask, 198 out of 407 commits with a fix subject modified only documentation or configuration files.

Regarding list ordering (`actor_directory`), resorting the 0.8.0 rows by commit count in descending order and passing them to `grift verify` resulted in exit code 1 with `MISMATCH: 1 field(s) differ`. Verifying a report saved in 0.7.2 against 0.8.0 results in `CANNOT_VERIFY` due to differing definition versions. The cautionary note regarding active days appeared in `activity.limitations` and `change_rhythm.limitations` in 0.8.0, but was absent in 0.7.2.

The following files were used for the project declaration:

```toml
schema_version = "tep-project-v1"
project_id = "example-python-lib-maintenance"
title = "Python ライブラリの保守（架空の案件）"

[requirements.change_rhythm]
active_days_180d_min = 12
median_gap_days_max = 7

[requirements.surfaces]
required = ["backend", "test"]

[requirements.verification]
required = ["unit"]

[requirements.inputs]
required = ["git", "forge"]
```

```bash
grift project click --requirements python-lib-maintenance.toml --format both --out project/click
```

The output is divided into two sections, "Project Declaration" and "Observed Values," with undeclared items showing `not_declared` (not specified by project; not a deficiency). Reconciling declaration and observation across each axis is handled by `grift align`, presenting one of five outcomes: overlap, out of bounds, zero count, unobserved, or no requirement.

## References

- [grift-cli (GitHub, MIT)](https://github.com/Cor-Incorporated/grift-cli) - CLI source code. Public release at the time of measurement was 0.7.2; 0.8.0 released on October 26, 2026
- [grift-cli 0.8.0 Release Notes (GitHub)](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0) - Changes in 0.8.0
- [grift-cli 0.7.2 (PyPI)](https://pypi.org/project/grift-cli/0.7.2/) - Public release at the time of measurement
- [Grift](https://griftai.org) - Product website
- [TEP Page (Grift)](https://griftai.org/tep) - Detailed explanation of TEP
- [Reading Grift Reports (metrics-guide)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/metrics-guide.md) - Plain-language guide to each metric
- [TEP Code of Conduct (norms)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/norms.md) - Do not treat absence as negative; prohibition of weighting and conversion
- [How to Enforce "No Scores, No Rankings" in Implementation (Cor.Inc. Blog, October 25, 2026)](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/) - The five conditions established in 0.8
- [The story of the representative founding the company (Cor.Inc. blog)](https://cor-jp.com/blog/founder-story/) - Representative's story and the thinking behind Grift
- [Ethical Use of the MBTI (The Myers & Briggs Foundation)](https://www.myersbriggs.org/unique-features-of-myers-briggs/ethical-use-of-the-mbti/) - MBTI usage guidelines (voluntary nature, not for hiring purposes)
- [MBTI Basics (The Myers & Briggs Foundation)](https://www.myersbriggs.org/my-mbti-personality-type/mbti-basics/) - The four preferences and 16 types
- [pallets/click](https://github.com/pallets/click) - Measured OSS (HEAD `36baa15`)
- [pallets/flask](https://github.com/pallets/flask) - Measured OSS (HEAD `d318b68`)
- [encode/httpx](https://github.com/encode/httpx) - Measured OSS (HEAD `b5addb6`)
- [tj/commander.js](https://github.com/tj/commander.js) - Measured OSS (HEAD `ba6d13d`)
