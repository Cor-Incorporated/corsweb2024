---
title: "Years of Experience on a Résumé Don't Reveal How Someone Works: Measuring 4 Real-World OSS Projects with Grift, a Score-Free Tool"
description: "Years of experience and person-months on a résumé alone do not reveal how a person actually works. Written for staffing agencies, SES sales representatives, and engineers, this article explains why Cor. created Grift—a tool that assigns neither scores nor rankings—how it differs from the MBTI, and what we could and could not see by measuring four real-world OSS projects."
summary: "Grift derives work style tendencies and the underlying counts that support them from change records preserved in git. Unlike the MBTI, where individuals answer questions to determine their type, Grift's evidence is based on actual records rather than self-reporting, yielding the exact same values regardless of who counts them from the same history. When we measured four real-world OSS projects, differences in areas of work and intervals between changes became visible, whereas review quality, meetings, and experiences without the individual's consent remained out of view. Numbers must be interpreted alongside their denominators and rules; judgment ultimately rests with humans."
pubDate: 2026-10-25
updatedDate: 2026-10-26
author: "Terisuke"
category: "engineering"
ctaIntent: "grift-team-beta"
tags: ["Grift", "OSS", "CLI", "git", "実測"]
lang: "en"
featured: false
isDraft: false
translationSourceHash: "b6c9b7d77d676cc7d362bd1bf2a315d0eb07c6a72f8dd4d50288ab08761e0456"
translatedAt: "2026-10-26T12:21:02.749Z"
translationModel: "gemini-3.8-flash"
---

Even if a résumé says "5 years of Python," it does not reveal what kind of work was done during those five years.

Years of experience and person-months serve as rough measures of the volume of work. However, they do not tell us how a person actually works: Do they write tests to verify behavior as they go? Do they organize and maintain documentation? Do they ship small changes frequently?

Staffing and engineering placement sales representatives often find themselves unable to provide concrete grounds for their recommendations, bringing conversations to a halt. At Cor.Inc., we believe one of the root causes lies within this gap.

## Why We Do Not Assign Scores

Grift is an in-house product built to bridge this gap. From records left behind in git (a system that records software changes one by one), it extracts work tendencies alongside the counts that serve as evidence for them. It outputs neither scores nor rankings.

When our CEO, Kousuke Terada, worked in recruitment advertising sales at Recruit, he experienced the frustration of words failing to convey reality. Regarding Grift, he writes: "You can pad a résumé. You cannot pad the evidence."

What happens when you reduce people to scores? Rolling up different types of records into a single number erases what was counted and what could not be counted. Moreover, once scores exist, individuals with higher scores appear to be better. Line them up, and you have a ranking.

What we want to achieve with Grift is not ranking people. It is connecting people with projects that align with their work tendencies. To that end, we present only verifiable facts. Humans are the ones who make the judgments.

## How It Differs from MBTI

Hearing that we do not rank people, some might think of MBTI.

In MBTI, respondents answer questions, and 16 types are derived from combinations of four preferences. The Myers & Briggs Foundation states that every type has value and that MBTI was not designed for hiring purposes.

Grift asks no questions. It assigns no type names. It is not a personality assessment tool. It counts records left in git and outputs tendencies alongside the underlying counts that serve as their evidence.

The difference becomes clearer when mapped onto the challenges faced by sales representatives.

"We don't know how far we can trust self-reported résumés." MBTI results, like résumés, stem from self-reported answers. Grift’s evidence comes from records. Given the same records, anyone who counts will get the exact same values.

"Years of experience and person-months do not reveal how someone works." Grift provides counts showing which areas an engineer touched (tests, documentation, core program code, etc.), the intervals at which they released changes, and whether tests accompanied their fix commits.

However, things not captured in records are not shown. Contributions in meetings, the quality of code reviews, and private, unpublished work cannot be seen. Without an individual's consent, we do not output personal experience or roles either.

## The Procedure Called TEP

Grift refers to the process of extracting facts from records as TEP (Technical Evidence Pipeline). It consists of four stages:

1. Read git records, without relying on AI inference.
2. Count according to fixed rules. For example, classify files as tests or documentation based on file paths and names.
3. Attach denominators and the reasons for anything that could not be counted to the resulting values.
4. Enable anyone to recount using the exact same procedure.

At Grift, we call this fourth step of recounting "verification" (re-calculation). A detailed explanation of TEP can be found on the [TEP page](https://griftai.org/tep) of the Grift website.

## Testing with Real-World OSS

Can this procedure truly reveal work tendencies? On October 25, 2026, we verified this using Grift CLI (Grift's command-line tool) version 0.8.0. As of that day, 0.8.0 was still being prepared for release; it was published the following day, October 26 ([release notes](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0)).

To avoid measuring real people without consent, we measured open-source software (OSS) repositories (places where records for a single software project are kept). Not a single individual-level figure is included in this article.

We measured four repositories with distinct characteristics:

- click: A Python library for building command-line tools (components used by other programs)
- flask: A Python library for building web services
- httpx: A Python library for communicating over the web
- commander.js: A JavaScript library for building command-line tools

## What We Observed

For all four repositories, both measurement and verification finished within 2.5 seconds. The verification results matched across all items for all four repositories.

Differences in repository characteristics also became visible.

In click, there were 187 changes across the 180 days leading up to the final recorded date. The median interval between changes was approximately 2 hours. Changes continued at short intervals.

In flask, 1,841 changes touched documentation, outnumbering changes that touched core program code (1,765).

In httpx, 575 out of 1,335 changes included test files.

In commander.js, core JavaScript files were not counted under "core program code" and fell under "other." This is a gap in Grift's rules: JavaScript's `.js` was not included among the file extensions counted as core program code.

## Misinterpreting Numbers

What we realized through testing was that simply lining up numbers quickly leads to misinterpretations. Here are five examples:

### Number of Changes

A repository with a high number of changes is not necessarily a better repository. flask had 3,674 changes, while httpx had 1,335. The history length was 5,976 days for flask and 2,517 days for httpx. Commit counts vary depending on the length of history and whether changes are merged in batches.

### Documentation Changes

A high volume of documentation changes does not necessarily mean a strong enthusiasm for documentation. In click, for about 40% of the changes counted as documentation, the only documentation file touched was the changelog file. In repositories where changelogs are updated with every change, documentation counts increase.

### Fix Changes

The fact that changes starting with "fix" do not include tests does not mean tests are never written. Recounting changes starting with "fix" in flask revealed that 198 out of 407 changes were modifications solely to documentation or configuration files, with subjects such as "fix typo."

### Few Changes

Having few changes does not mean development has stalled. In httpx, there were only 11 changes within the 180-day observation window, resulting in the interval being labeled "unobserved" (could not be measured). What was measured were records cloned locally on September 2, not its current state.

### Active Days

Active days (the number of days with changes) can be inflated depending on how commits are sliced. We created two small repositories for testing and added the same five lines. Adding them all at once yielded 2 active days; splitting them over five days at one line per day yielded 6 active days (both include the initial commit). The actual content was identical.

Grift does not adjust these numbers. Instead, next to the metric, it displays: "Increases by placing 1 small commit daily; decreases when combining identical changes into 1 day."

## What Could Not Be Observed

Grift labels items it could not measure as "unobserved." "Unobserved" means "could not be measured," not "there was no track record." Across the four repositories, the following could not be observed:

- Reviews and issue tracking: Unobserved because records like GitHub were not provided
- Personal experience and roles: Unobserved because individual consent was not provided
- Whether changes were internal: Marked entirely as "undetermined" because internal company email addresses were not defined

We also document what did not go well. The core files of commander.js falling under "other" was, as mentioned earlier, a gap in our rules. Additionally, in an article published on the same day, we noted that "the co-committed test rate (the proportion of commits modifying tests alongside core code) can also be inflated by superficial test edits." In 0.8.0, this warning is not yet shown next to the metric. The only warning included is the single sentence for active days.

## Fixes in 0.8.0

In [0.7.2](https://pypi.org/project/grift-cli/0.7.2/) (the public release at the time of testing), the list of contributors to a repository was sorted in descending order of commit count. This made it possible to interpret the person at the very top as the "top performer." In 0.8.0, they are sorted by ID (the identifier assigned to each person).

We compared the contributor lists between 0.7.2 and 0.8.0 across the four repositories. We looked only at the ordering, without looking at names or counts. In 0.7.2, the contributor with the highest number of changes was at the top in all four. In 0.8.0, that person's row appeared on line 120 out of 467 for click, line 280 out of 870 for flask, line 232 out of 258 for httpx, and line 15 out of 203 for commander.js.

If the 0.8.0 list is resorted by commit count, verification fails. All other values were identical between 0.7.2 and 0.8.0.

## Comparing with Project Declarations

When matching with projects, the requirements sought by the project side are written down in advance. In Grift, we call this a declaration. These are displayed side by side with observations extracted from git, without rendering pass/fail judgments.

As an experiment, we created a fictional declaration for a small project: "Python Library Maintenance." The declaration specified: at least 12 active days within 180 days, a median change interval of 7 days or fewer, modifications touching both core program code and tests, the presence of unit tests, and examining records like GitHub.

When mapped against click, the observed "62 days" appears alongside the declaration's "12 days or more." Because GitHub records were not provided, that section remains unobserved.

Even when aligned side by side, the misinterpretations described in the previous section remain. The "0" core program commits for commander.js stems from a rule gap, and httpx's interval is unobserved due to insufficient commit volume. How to interpret these aligned values is left to human judgment.

Another use case is aligning an individual engineer's records with a project. In that scenario, only records for which the engineer has consented are used. Because that involves measuring real individuals, we did not test it in this article.

## Conclusion

Git records serve as material to verify the statements on a résumé. However, there is also work that leaves no trace in git records.

What Grift outputs are tendencies, the counts serving as evidence, and the reasons for what could not be observed. What to deduce from that data is for the reader to decide.

## Underlying Figures

To allow engineers to verify the data locally, here is a summary of the measurement conditions and numbers:

- grift 0.8.0 (definitions version `tep-v0.8.0-2026-10-25`). Pre-release source code (`87076c8` in the development repository) was installed locally. The published 0.8.0 `src/` (program core) is identical to this source.
- For comparison, the public release at the time, [0.7.2](https://pypi.org/project/grift-cli/0.7.2/), was also run against the same four repositories.
- Apple M4 Max, macOS 26.7.1, Python 3.12.9, git 2.54.0.
- Targets were the four local repositories cloned on September 2, 2026, without subsequent updates.

The measured commit (single-change record) SHAs (unique commit identifiers) and their dates are as follows:

```text
pallets/click    36baa15ff831b939a22bc527cd76ce653ef6f66d  2026-08-26
pallets/flask    d318b683471101618febed18996405ad26462110  2026-08-16
encode/httpx     b5addb64f0161ff6bfe94c124ef76f6a1fba5254  2026-02-23
tj/commander.js  ba6d13ddb4243e5913367734f8c159089ffe7834  2026-05-29
```

Example command using click:

```bash
git clone https://github.com/pallets/click
git -C click checkout 36baa15ff831b939a22bc527cd76ce653ef6f66d
grift repo click --format both --out out/click
grift verify out/click/report.json --repo click
```

`grift repo` completed within 2.5 seconds for all four repositories, and `grift verify` returned `VERIFIED` for all four. A freshly cloned copy of click yielded identical results, except for the execution timestamp. Running against the source of [0.7.2](https://pypi.org/project/grift-cli/0.7.2/), the public release at the time, also produced the exact same observed values listed here.

| Repository | Human commits / merge / bot |
|---|---|
| click | 2,000 / 1,131 / 200 |
| flask | 3,674 / 1,691 / 191 |
| httpx | 1,335 / 41 / 147 |
| commander.js | 1,095 / 284 / 138 |

Human commits exclude merge commits (records integrating changes from another branch). Changes by bots (automated programs making changes) are excluded.

Work domains (`surface_profile`) are categorized by file path and extension, and commits are counted per category. Since a single commit can touch multiple categories, the sum exceeds the denominator.

| Repository | Denominator | test / docs / backend / other |
|---|---|---|
| click | 1,999 | 562 / 1,024 / 1,158 / 309 |
| flask | 3,673 | 627 / 1,841 / 1,765 / 575 |
| httpx | 1,333 | 575 / 501 / 874 / 112 |
| commander.js | 1,094 | 286 / 468 / 0 / 530 |

Change intervals (`change_rhythm`) use the HEAD commit date as the observation date, counting the 180 days leading up to it. The observation dates are those listed to the right of the SHAs above.

| Repository | Commits / Active days | Median interval / p90 |
|---|---|---|
| click | 187 / 62 days | 0.08 days / 3.36 days |
| flask | 32 / 19 days | 0.80 days / 15.60 days |
| httpx | 11 / 8 days | Unobserved |
| commander.js | 22 / 18 days | 2.88 days / 17.89 days |

The reason for httpx being unobserved is `insufficient_population`. With only 11 commits in the window, it fell short of the 20-commit minimum threshold required to calculate the rate.

Verification patterns (`verification_profile`) count commits touching test file paths.

| Repository | Commits containing tests | Fix commits that also changed tests |
|---|---|---|
| click | 562 / 2,000 | 80 / 249 |
| flask | 627 / 3,674 | 58 / 408 |
| httpx | 575 / 1,335 | 46 / 114 |
| commander.js | 286 / 1,095 | 30 / 106 |

The breakdown of test types was: click had 555 unit and 23 unknown; flask had 484 unit and 204 unknown; httpx had 554 unit and 101 unknown; commander.js had 286 unknown.

Unobserved items totaled 23 for click, flask, and commander.js, and 27 for httpx. The primary reasons include:

- `forge_export_not_provided`, `tracker_export_not_provided`: Reviews, issue tracking, events
- `consenting_actor_required`: Experience, roles, library context
- `no_upstream_lineage`, `parent_repo_not_provided`, `template_not_provided`: Upstream relationship, inheritance from templates
- `no_tenant_commits`: Period containing 80% of internal commits
- `survival_scan_disabled`: Code freshness (how recently the existing code was written)
- `outcome_declaration_not_provided`: Declarations of post-work outcomes
- `deferred_to_v0.6`: Line-level rework (retains the name from version 0.6 even in 0.8.0)

Origin (`origin`) returned `unresolved` for all non-bot commits across all four repositories, as neither identity.toml (defining internal email addresses) nor fork parents were provided.

The breakdown of documentation commits for click and fix commits for flask are not native Grift outputs. They are approximate figures recounted locally by applying the same rules to git log. For click, 414 out of 1,025 commits touched only `CHANGES.rst` as documentation. For flask, 198 out of 407 fix commits modified only documentation or configuration files.

Regarding contributor list sorting (`actor_directory`), sorting the 0.8.0 rows by commit count in descending order and running `grift verify` resulted in exit code 1 with `MISMATCH: 1 field(s) differ`. Verifying a report saved in 0.7.2 using 0.8.0 yields `CANNOT_VERIFY` due to the differing definitions version. The warning note on active days appeared in `activity.limitations` and `change_rhythm.limitations` in 0.8.0, but was absent in 0.7.2.

The following file was used for project declarations:

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

The output is split into two sections: "Project Declarations" and "Observed Values." Unspecified items were marked as `not_declared` (not specified by the project; not a deficiency). Matching declarations against observations per axis is handled by `grift align`, which outputs five statuses: overlap, out of range, zero commits, unobserved, or not requested.

## References

- [grift-cli (GitHub, MIT)](https://github.com/Cor-Incorporated/grift-cli) - CLI source code. Version 0.7.2 was public at the time of testing; 0.8.0 was released on October 26, 2026.
- [grift-cli 0.8.0 Release Notes (GitHub)](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0) - Changes in 0.8.0
- [grift-cli 0.7.2 (PyPI)](https://pypi.org/project/grift-cli/0.7.2/) - The public release at the time of testing
- [Grift](https://griftai.org) - Product website
- [TEP Page (Grift)](https://griftai.org/tep) - Detailed description of TEP
- [How to Read Grift Reports (metrics-guide)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/metrics-guide.md) - Plain-language guide to each metric
- [TEP Usage Norms (norms)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/norms.md) - Do not treat absence as negative; prohibition of weighting and conversions
- [Enforcing "No Scores, No Rankings" in Implementation (Cor.Inc. Blog, October 25, 2026)](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/) - Five conditions established in 0.8
- [I Founded a Company to Make "Ah, They Understood" an Everyday Experience (Cor.Inc. Blog)](https://cor-jp.com/blog/founder-story/) - The CEO's story and the thinking behind Grift
- [Ethical Use of the MBTI (The Myers & Briggs Foundation)](https://www.myersbriggs.org/unique-features-of-myers-briggs/ethical-use-of-the-mbti/) - MBTI usage guidelines (voluntary nature, not for hiring)
- [MBTI Basics (The Myers & Briggs Foundation)](https://www.myersbriggs.org/my-mbti-personality-type/mbti-basics/) - The four preferences and 16 types
- [pallets/click](https://github.com/pallets/click) - Measured OSS (HEAD `36baa15`)
- [pallets/flask](https://github.com/pallets/flask) - Measured OSS (HEAD `d318b68`)
- [encode/httpx](https://github.com/encode/httpx) - Measured OSS (HEAD `b5addb6`)
- [tj/commander.js](https://github.com/tj/commander.js) - Measured OSS (HEAD `ba6d13d`)
