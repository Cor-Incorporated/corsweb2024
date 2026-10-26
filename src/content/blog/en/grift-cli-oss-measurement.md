---
title: "Years on a Resume Don't Reveal How Someone Works: Measuring 4 Real-World OSS Projects with Grift Without Scoring"
description: "Years of experience or person-months on a resume don't reveal how someone actually works. Written for recruitment agency staff, SES sales representatives, and engineers, this article explains why Cor. created Grift—which assigns neither scores nor rankings—how it differs from MBTI, and what we could and could not see by measuring four real-world OSS projects."
summary: "From the commit history left in Git, Grift identifies work tendencies alongside the counts that serve as the underlying evidence. Unlike MBTI, where individuals answer questions to determine their type, the evidence comes from records rather than self-reports, yielding identical values regardless of who counts them from the same history. Measuring four real-world OSS projects revealed differences in work domains and intervals between changes, but did not capture review quality, meetings, or experience for which the individual did not give consent. Numbers must be read alongside their denominators and rules, and the final judgment rests with people."
pubDate: 2026-10-25
updatedDate: 2026-10-26
author: "Terisuke"
category: "engineering"
ctaIntent: "grift-team-beta"
tags: ["Grift", "OSS", "CLI", "git", "実測"]
lang: "en"
featured: false
isDraft: false
translationSourceHash: "61adea75f963a89f574f1cd38d9f408c55358ef125e28f24b4119267c8a3c4a5"
translatedAt: "2026-10-26T04:35:44.619Z"
translationModel: "gemini-3.8-flash"
---

Even if a resume says "Python: 5 years," it does not tell you what kind of work the person actually did over those five years.

Years of experience and person-months serve as rough benchmarks for the volume of work. However, they cannot tell you how someone works: Do they proceed while writing tests to verify behavior? Do they keep documentation in order? Do they ship small changes frequently?

Recruiters and SES sales representatives often find themselves at a loss when they cannot articulate the rationale behind a recommendation with solid evidence. At Cor.Inc., we believe one of the root causes lies in this very gap.

## Why We Do Not Assign Scores

Grift is our in-house product built to bridge this gap. From the records left in git (a system that records software changes one by one), it extracts work tendencies alongside the counts that serve as evidence for them. It outputs neither scores nor rankings.

When our CEO, Kousuke Terada, worked in recruitment advertising sales at Recruit, he experienced the frustration of words failing to get the message across. Regarding Grift, he writes: "You can inflate a resume. You cannot inflate evidence."

What happens when you reduce things to a score? When different types of records are rounded into a single number, what was counted—and what could not be counted—disappears. And once a score exists, whoever has a higher score looks like the better candidate. Line them up, and it becomes a ranking.

What we want to do with Grift is not to rank people. It is to connect individuals with projects that match their work tendencies. To achieve that, we only output verifiable facts. The judgment is left to humans.

## Differences from the MBTI

Hearing that we do not rank people, some might be reminded of the MBTI.

In the MBTI, the individual answers questions, and a combination of four preferences yields one of 16 types. The Myers & Briggs Foundation states that all types are valuable and that the instrument was not designed for recruitment purposes.

Grift does not ask questions. It does not assign type names. Nor is it a tool for personality assessment. It counts records left in git and outputs tendencies alongside the counts that back them up.

The difference becomes clearer when viewed through the challenges faced by sales professionals.

You don't know how far you can trust the self-reported claims on a resume. Like a resume, MBTI results stem from the individual's own answers. Grift's evidence comes from records. Given the same records, anyone will arrive at the exact same figures.

Years of experience and person-months do not reveal how someone works. Grift provides concrete counts: which areas they have touched (tests, documentation, core program files, etc.), the intervals at which they ship changes, and whether bug-fix changes include accompanying tests.

However, things that leave no trace in the records cannot be surfaced. Contributions in meetings, the quality of code reviews, and unreleased work remain invisible. Without the individual's consent, we also do not display personal experience or roles.

## The TEP Process

Grift calls its process for extracting facts from records the TEP (Technical Evidence Pipeline). It consists of four stages:

1. Read the git records. No AI speculation is used.
2. Count according to fixed rules. For example, distinguish tests from documentation based on file paths and names.
3. Attach denominators and the reasons for anything that could not be counted to the tallied figures.
4. Enable anyone to recount using the exact same procedure.

At Grift, we refer to this fourth step of recounting as verification. For a detailed explanation of the TEP, please visit the [TEP page](https://griftai.org/tep) on the Grift website.

## Testing on Real-World OSS

Can this procedure truly reveal work tendencies? On October 25, 2026, we verified this using Grift CLI (Grift's command-line tool) version 0.8.0. As of that day, version 0.8.0 was still being prepared for release; it was published the following day, October 26 ([Release Notes](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0)).

To avoid measuring real individuals without consent, we measured open-source software (OSS) whose source code is public, at the repository level (a repository being a place where records for a single piece of software are collected). Not a single person-level figure is included in this article.

We measured four repositories with differing characteristics:

- click: A Python library (components used by other programs) for creating command-line tools
- flask: A Python library for building web services
- httpx: A Python library for communicating over the web
- commander.js: A JavaScript library for creating command-line tools

## What We Discovered

For all four, both measurement and verification were completed within 2.5 seconds. The verification results matched across all items for all four repositories.

Differences in repository characteristics also became apparent.

In click, there were 187 changes over the 180 days leading up to the final recorded date. The median interval between changes was approximately 2 hours. Changes were shipped continuously at short intervals.

In flask, there were 1,841 changes touching documentation, outnumbering changes touching the core program (1,765).

In httpx, 575 out of 1,335 changes included test files.

In commander.js, the core JavaScript files were not counted under "core program" and fell into "other" instead. This is a gap in Grift's rules: JavaScript's `.js` was not included among the file extensions counted as core program files.

## Misreading the Numbers

What we learned from taking these measurements was that simply lining up numbers quickly leads to misinterpretations. Here are five examples.

### Number of Changes

A repository with a high number of changes is not inherently a better repository. flask had 3,674 changes, while httpx had 1,335. In terms of history length, flask spanned 5,976 days, and httpx spanned 2,517 days. The count varies depending on the length of the history and whether changes are merged in batches.

### Documentation Changes

A high volume of documentation changes does not necessarily mean a team is dedicated to documentation. In click, for about 40% of the changes counted as documentation, the only file touched under documentation was the changelog file. In a repository where a changelog entry is written with every change, the documentation count naturally increases.

### Bug-Fix Changes

The absence of tests accompanying a change whose subject starts with "fix" does not mean tests are not being written. Recounting changes in flask whose subjects began with "fix," 198 out of 407 were changes strictly to documentation or configuration files—with subjects like "fix typo."

### Few Changes

A low number of changes does not mean development has stalled. In httpx, there were only 11 changes within the 180-day observation window, and the interval became "unobserved" (could not be measured). What was measured was the local record fetched on September 2, not its current state.

### Active Days

The number of active days (days on which changes were made) can be inflated depending on how changes are split. We created two small repositories for testing and added the exact same five lines of code. Adding them all at once yielded 2 active days, whereas splitting them across five days at one line per day yielded 6 active days (both include the initial commit). The actual content is identical.

Grift does not adjust this number. Instead, it places a note next to the figure: "Increases by adding 1 small commit daily; decreases by consolidating the same changes into 1 day."

## What Could Not Be Seen

Grift marks things that could not be measured as "unobserved." Unobserved means "could not be measured"; it does not mean "there was no track record." Across these four repositories, the following could not be seen:

- Reviews and issue tracking: Unobserved because records such as GitHub data were not provided
- Personal experience and roles: Unobserved because individual consent was not provided
- Whether changes were made internally: All marked as "undetermined" because internal company email addresses were not defined

We will also share what did not work well. As mentioned earlier, commander.js's core files falling into "other" was due to a gap in our rules. Additionally, in an article published the same day, we noted that "the co-test modification rate (the proportion of times tests are changed alongside the core program) can also be inflated by superficial test edits." In version 0.8.0, this warning is not yet displayed next to the figure. The only explanatory sentence included was the one regarding active days.

## Fixes in 0.8.0

In [0.7.2](https://pypi.org/project/grift-cli/0.7.2/) (the public release at the time of measurement), the list of contributors to a repository was sorted in descending order of changes made. This could lead someone to interpret the person at the top as "the person who performed the best." In 0.8.0, we sort them by ID (the identifier assigned to each person).

We compared the lists between 0.7.2 and 0.8.0 across the four repositories. We looked only at the ordering, without viewing names and numbers. In 0.7.2, the top entry across all four was the person with the most changes. In 0.8.0, that person's row appeared on line 120 out of 467 for click, line 280 out of 870 for flask, line 232 out of 258 for httpx, and line 15 out of 203 for commander.js.

If the 0.8.0 list is resorted by commit count, it fails verification. Other values remained identical between 0.7.2 and 0.8.0.

## Comparing Against Projects

When matching with a project, the requirements on the project side are defined beforehand. In Grift, we call this a declaration. It is displayed in a separate column from what was observed in git (observations), and no pass/fail verdict is issued.

As a test, we declared a small, hypothetical project: "Python Library Maintenance." The declaration specified: at least 12 active days in 180 days, a median change interval of 7 days or less, experience touching both the core program and tests, presence of unit tests, and review of records such as GitHub.

When applied to click, next to the declaration's "12 days or more," the observed "62 days" is placed side by side. Since records such as GitHub were not provided, that column remains unobserved.

Even when compared side by side, the misreadings discussed in the previous section still apply. commander.js showing 0 "core program" changes is due to a gap in the rules, and httpx's interval is unobserved due to insufficient records. How to interpret these juxtaposed values is up to human judgment.

There is also a use case for aligning an individual engineer's records against a project. In that scenario, only records with the individual's consent are used. Because this involves measuring real individuals, it was not tested in this article.

## Conclusion

Git records serve as material to substantiate the statements on a resume. However, there is also work that leaves no trace in those records.

What Grift provides are tendencies, the counts backing them, and the reasons for what could not be seen. What to deduce from that information is for the reader to decide.

## Underlying Figures

To allow engineers to verify this on their own machines, the measurement conditions and figures are summarized below.

- grift 0.8.0 (definition version `tep-v0.8.0-2026-10-25`). Installed locally from pre-release source (`87076c8` in the development repository). The `src/` (program core) of the released 0.8.0 is identical to this source.
- For comparison, the public release at the time, [0.7.2](https://pypi.org/project/grift-cli/0.7.2/), was also run against the same four repositories.
- Apple M4 Max, macOS 26.7.1, Python 3.12.9, git 2.54.0
- Targets were four local repositories cloned on September 2, 2026, and not updated since.

The measured commit (a record of a single change) SHAs (the identifier assigned to each commit) and their dates are as follows:

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

`grift repo` finished within 2.5 seconds for all four, and `grift verify` was `VERIFIED` for all four. A freshly cloned copy of click produced the exact same results, aside from execution timestamps. Using the same source code as the public release at the time, [0.7.2](https://pypi.org/project/grift-cli/0.7.2/), the observed values listed here were identical.

| Repository | Human commits / merge / bot |
|---|---|
| click | 2,000 / 1,131 / 200 |
| flask | 3,674 / 1,691 / 191 |
| httpx | 1,335 / 41 / 147 |
| commander.js | 1,095 / 284 / 138 |

Human commits represent the count excluding merges (records integrating changes from another branch). Changes by bots (programs making automated changes) are excluded.

Work areas (`surface_profile`) are categorized by file path and extension, and commits are counted per category. Because a single commit can touch multiple categories, the sum exceeds the denominator.

| Repository | Denominator | test / docs / backend / other |
|---|---|---|
| click | 1,999 | 562 / 1,024 / 1,158 / 309 |
| flask | 3,673 | 627 / 1,841 / 1,765 / 575 |
| httpx | 1,333 | 575 / 501 / 874 / 112 |
| commander.js | 1,094 | 286 / 468 / 0 / 530 |

Change intervals (`change_rhythm`) are counted over the 180 days up to the HEAD date, which serves as the observation date. The observation date is the date written to the right of the SHA above.

| Repository | commits / Active days | Median interval / p90 |
|---|---|---|
| click | 187 / 62 days | 0.08 days / 3.36 days |
| flask | 32 / 19 days | 0.80 days / 15.60 days |
| httpx | 11 / 8 days | Unobserved |
| commander.js | 22 / 18 days | 2.88 days / 17.89 days |

The reason httpx was unobserved is `insufficient_population`. With only 11 commits in the window, it did not reach the minimum threshold of 20 commits required to calculate the rate.

Verification patterns (`verification_profile`) count commits touching test locations.

| Repository | Commits including test | Commits with fix subject that also modified test |
|---|---|---|
| click | 562 / 2,000 | 80 / 249 |
| flask | 627 / 3,674 | 58 / 408 |
| httpx | 575 / 1,335 | 46 / 114 |
| commander.js | 286 / 1,095 | 30 / 106 |

The breakdown of test types was: click had 555 unit and 23 unknown; flask had 484 unit and 204 unknown; httpx had 554 unit and 101 unknown; commander.js had 286 unknown.

Unobserved items numbered 23 for click, flask, and commander.js, and 27 for httpx. The main reasons are as follows:

- `forge_export_not_provided`, `tracker_export_not_provided`: Reviews, issue tracking, events
- `consenting_actor_required`: Experience, roles, library context
- `no_upstream_lineage`, `parent_repo_not_provided`, `template_not_provided`: Upstream relationship, inheritance from templates
- `no_tenant_commits`: Period encompassing 80% of internal company commits
- `survival_scan_disabled`: Retention rate
- `outcome_declaration_not_provided`: Declarations of post-work occurrences
- `deferred_to_v0.6`: Line-level rework (retains its name from the 0.6 era even in 0.8.0)

For provenance (`origin`), all non-bot commits across all four repositories were `unresolved`. This is because neither an identity.toml defining internal company email addresses nor fork parents were provided.

The breakdown of commits counted as documentation for click and fix commits for flask are not direct Grift outputs. They are approximate numbers recounted locally by applying the same rules to git log. For click, 414 out of 1,025 commits touched only `CHANGES.rst` as documentation. For flask, 198 out of 407 commits with a fix subject modified only documentation or configuration files.

Regarding list ordering (`actor_directory`), when the 0.8.0 rows were resorted by commit count in descending order and passed to `grift verify`, it resulted in `MISMATCH: 1 field(s) differ` with an exit code of 1. Verifying a report saved in 0.7.2 using 0.8.0 results in `CANNOT_VERIFY` due to differing definition versions. The explanatory sentence regarding active days appeared in `activity.limitations` and `change_rhythm.limitations` in 0.8.0, and was not present in 0.7.2.

The following file was used for the project declaration:

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

The output is divided into two sections: "Project Declaration" and "Observed Figures." Undeclared items became `not_declared` (not stated by the project side; not a deficiency). Reconciling declarations and observations across each axis is handled by `grift align`, outputting one of five states: overlap, out of range, 0 items, unobserved, or no requirement.

## References

- [grift-cli (GitHub, MIT)](https://github.com/Cor-Incorporated/grift-cli) - CLI source code. The public version at the time of measurement was 0.7.2; 0.8.0 was released on October 26, 2026
- [grift-cli 0.8.0 Release Notes (GitHub)](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0) - Changes in 0.8.0
- [grift-cli 0.7.2 (PyPI)](https://pypi.org/project/grift-cli/0.7.2/) - The public version at the time of measurement
- [Grift](https://griftai.org) - Product website
- [TEP Page (Grift)](https://griftai.org/tep) - Detailed explanation of TEP
- [Reading a Grift Report (metrics-guide)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/metrics-guide.md) - Plain-language guide to each metric
- [TEP Code of Conduct (norms)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/norms.md) - Do not interpret absence negatively; prohibition of weighting and conversion
- [How to Uphold "No Scores, No Rankings" in Implementation (Cor.Inc. Blog, October 25, 2026)](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/) - Five conditions established in 0.8
- [I Founded a Company to Make "Ah, They Understood" an Everyday Experience (Cor.Inc. Blog)](https://cor-jp.com/blog/founder-story/) - Story from the CEO and the philosophy behind Grift's creation
- [Ethical Use of the MBTI (The Myers & Briggs Foundation)](https://www.myersbriggs.org/unique-features-of-myers-briggs/ethical-use-of-the-mbti/) - Rules for MBTI usage (voluntary nature, not for recruitment purposes)
- [MBTI Basics (The Myers & Briggs Foundation)](https://www.myersbriggs.org/my-mbti-personality-type/mbti-basics/) - Four preferences and 16 types
- [pallets/click](https://github.com/pallets/click) - Measured OSS (HEAD `36baa15`)
- [pallets/flask](https://github.com/pallets/flask) - Measured OSS (HEAD `d318b68`)
- [encode/httpx](https://github.com/encode/httpx) - Measured OSS (HEAD `b5addb6`)
- [tj/commander.js](https://github.com/tj/commander.js) - Measured OSS (HEAD `ba6d13d`)
