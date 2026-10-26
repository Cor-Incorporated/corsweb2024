---
title: "Years on a Resume Don't Show How Someone Actually Works. We Evaluated 4 Real OSS Projects with Grift, Which Doesn't Score People."
description: "Years of experience or person-months on a resume alone do not reveal how a person actually works. Written for recruitment agencies, SES sales representatives, and engineers, this article explains why Cor. created Grift—a tool that assigns neither scores nor rankings—how it differs from MBTI, and what we could and could not see by evaluating 4 real OSS projects."
summary: "Grift derives work tendencies and the underlying count of evidence directly from records of changes preserved in git. Unlike MBTI, where individuals answer questions to determine their type, Grift's evidence is based on actual records rather than self-reporting, yielding the exact same values no matter who counts them from the same history. Evaluating 4 real OSS projects revealed differences in work domains and commit intervals; however, it could not capture the quality of code reviews, meetings, or experience for which the individual did not give consent. Numbers must be read alongside their denominators and rules, and making the final judgment remains up to humans."
pubDate: 2026-10-25
author: "Terisuke"
category: "engineering"
ctaIntent: "grift-team-beta"
tags: ["Grift", "OSS", "CLI", "git", "実測"]
lang: "en"
featured: false
isDraft: false
translationSourceHash: "ef859896fc1d4aa3ef654f35a97cd16672a5019bbb963d9ae3a20559c1fa9303"
translatedAt: "2026-10-25T15:06:29.737Z"
translationModel: "gemini-3.8-flash"
---

Even if a résumé says "Python: 5 years," it does not tell you what kind of work the person actually did over those five years.

Years of experience or person-months serve as rough indicators of the volume of work. However, they do not show how someone works: Do they write tests to verify behavior as they go? Do they keep documentation organized? Do they ship small, frequent changes?

Recruiting agents and SES sales representatives often find themselves unable to articulate the rationale behind their recommendations. At Cor., we believe one reason lies in this gap.

## Why We Do Not Assign Scores

Grift is our in-house product built to bridge this gap. From records left in git (a system that records software changes one by one), it extracts work tendencies alongside the counts that serve as the supporting evidence. It produces neither scores nor rankings.

When our CEO, Kousuke Terada, worked in recruitment advertising sales at Recruit, he experienced the frustration of words failing to convey reality. Regarding Grift, he writes: "You can pad a résumé. You can't pad evidence."

What happens when you reduce things to a score? When you compress different types of records into a single number, what was counted—and what could not be counted—vanishes. And once a score exists, those with higher numbers appear to be better people. Line them up, and you have a ranking.

What we want to do with Grift is not to rank people. It is to connect individuals with projects that match their work tendencies. To that end, we present only verifiable facts. Making the judgment is up to human beings.

## Differences from MBTI

Hearing that we do not rank people, some might think of MBTI.

In MBTI, respondents answer questions themselves, yielding 16 types based on combinations of four preferences. The Myers & Briggs Foundation states that all types are valuable and that the assessment was not designed for hiring purposes.

Grift asks no questions. It does not assign type names. Nor is it a tool for personality assessment. It counts records left in git, outputting tendencies along with the counts that substantiate them.

The difference becomes clearer when viewed through the challenges faced by sales professionals.

You do not know how far you can trust self-reported résumés: MBTI results, like résumés, are derived from the individual's own answers. Grift’s evidence comes from records. Given the same records, anyone will arrive at the exact same numbers.

Years of experience and person-months do not reveal how someone works: Grift reports, in counts, which areas they have touched (tests, documentation, core programs, etc.), at what intervals they submit changes, and whether bug-fix changes include tests.

However, things not left in records cannot be shown. Contributions in meetings, the quality of code reviews, and unpublished work remain invisible. Furthermore, without the individual's consent, personal experience and roles are not displayed.

## The TEP Process

Grift calls the process of extracting facts from records TEP (Technical Evidence Pipeline). It consists of four stages:

1. Read git records. No AI speculation is used.
2. Count according to fixed rules. For example, distinguish tests from documentation based on file paths and names.
3. Attach denominators and the reasons for uncounted items to the measured values.
4. Enable anyone to recount using the exact same procedure.

In Grift, we call this fourth step—recounting—verification. A detailed explanation of TEP can be found on the [TEP page](https://griftai.org/tep) on Grift's website.

## Testing with Real-World OSS

Can this procedure truly reveal work tendencies? On October 25, 2026, we verified this using the upcoming version (0.8.0) of the Grift CLI (a command-line Grift tool). As of that date, 0.8.0 was still being prepared for release.

To avoid measuring real people without their consent, we measured open-source software (OSS) whose source code is public, at the repository level (the place where a single software project's records are kept). Not a single person-specific number is included in this article.

We measured four repositories with differing characteristics:

- click: A Python library (a component used by other programs) for building command-line tools
- flask: A Python library for building web services
- httpx: A Python library for web communications
- commander.js: A JavaScript library for building command-line tools

## What We Observed

For all four, both measurement and verification finished in under 2.5 seconds. The verification results matched across all items for all four repositories.

Differences in repository characteristics also became apparent.

In click, there were 187 changes in the 180 days leading up to the final date of the record. The median interval between changes was about 2 hours. Changes occurred steadily at short intervals.

In flask, 1,841 changes touched documentation, which was more than those touching core programs (1,765 changes).

In httpx, 575 out of 1,335 changes included test files.

In commander.js, the core JavaScript files were not counted under "core programs" and fell into "other" instead. This is a gap in Grift's rules. The extension (the trailing part of a file name) counted as core programs did not include JavaScript's `.js`.

## Misreading Numbers

What we realized through measurement was how easily numbers can be misread when presented on their own. Here are five examples.

### Number of Changes

A repository with a high number of changes is not necessarily a better repository. Flask had 3,674 changes, while httpx had 1,335. In terms of history length, flask spanned 5,976 days and httpx spanned 2,517 days. Change counts vary depending on the length of history and whether changes are merged in batches.

### Documentation Changes

A high number of documentation changes does not mean a team is enthusiastic about writing documentation. For click, roughly 40% of the changes counted as documentation touched only the changelog file. In repositories where the changelog is updated with every single change, the count of documentation changes increases.

### Fix Changes

The fact that changes starting with "fix" in their subject line do not include tests does not mean the authors do not write tests. Recounting changes starting with "fix" in flask revealed that 198 out of 407 were changes strictly to documentation or configuration files, with subjects such as "fix typo."

### Few Changes

A low number of changes does not mean development has stalled. For httpx, there were only 11 changes within the 180-day observation window, resulting in an interval marked as "unobserved" (could not be measured). What we measured was a local clone retrieved on September 2, not its current state.

### Active Days

Active days (the number of days on which changes occurred) can be inflated depending on how changes are split. We created two small repositories for testing and added the exact same five lines. Adding them all at once resulted in 2 active days, whereas splitting them across 5 days—adding one line per day—resulted in 6 active days (both include the initial commit). The contents are identical.

Grift does not adjust this number. Instead, it places a note next to the number: "Increases by placing 1 small commit daily; decreases by grouping the same changes into 1 day."

## What Remained Unseen

Grift labels things that could not be measured as "unobserved." "Unobserved" means "could not be measured," not "there was no track record." Across the four repositories, the following could not be seen:

- Reviews and issue tracking: Unobserved because records such as GitHub data were not provided
- Individual experience and roles: Unobserved because individual consent was not given
- Whether changes were made by the internal team: All marked as "could not be determined" because internal email addresses were not defined

We will also share what did not go well. As mentioned earlier, commander.js's core code falling into "other" was a gap in our rules. Additionally, in an article published on the same day, we noted that "the co-modification rate of tests (the proportion of changes where tests are updated alongside core code) also rises with superficial test edits." In 0.8.0, this caveat does not yet appear next to the numbers. The only note added was the single sentence regarding active days.

## What We Fixed in 0.8.0

In 0.7.2 (the current public release), the list of contributors to a repository was sorted in descending order of changes. This could be interpreted as showing the person at the top as the "top performer." In 0.8.0, they are sorted by ID (a designated identifier for each individual).

We compared the lists between 0.7.2 and 0.8.0 across the four repositories. We looked only at the sorting order, ignoring names and counts. In 0.7.2, the top entry across all four was the person with the most changes. In 0.8.0, that same person appeared at line 120 out of 467 for click, line 280 out of 870 for flask, line 232 out of 258 for httpx, and line 15 out of 203 for commander.js.

If the 0.8.0 list is resorted by commit count, it fails verification. Other values remained identical between 0.7.2 and 0.8.0.

## Comparing with Project Requirements

When matching with projects, the requirements expected by the project are written down in advance. In Grift, we call this a declaration. It is presented alongside what was observed from git (observations) in a separate column, and no pass/fail verdict is issued.

As a test, we declared a hypothetical small project: "Python library maintenance." The declaration specified: at least 12 active days within 180 days, a median change interval within 7 days, experience touching core programs and tests, the presence of unit tests, and the inspection of GitHub and other records.

Applying this to click places the observed "62 days" right next to the declared "12 days or more." Because records like GitHub were not provided, that section remains unobserved.

Even after laying them side by side, the misinterpretations described in the previous section persist. Having 0 "core programs" for commander.js is due to a rule gap, and the interval for httpx is unobserved due to insufficient records. How to interpret these aligned values is left to human judgment.

Grift can also be used to compare an individual engineer's records against project requirements. In that case, only records with the individual's consent are used. Because that involves measuring real individuals, we did not test it in this article.

## Conclusion

Git records provide evidence to verify claims made on a résumé. Yet, there is work that never leaves a trace in records.

What Grift outputs are tendencies, the counts that substantiate them, and the reasons for what could not be seen. What conclusions to draw from them is for the reader to decide.

## Supporting Data

To allow engineers to verify the numbers locally, here are the conditions and values measured:

- grift 0.8.0 (definition version `tep-v0.8.0-2026-10-25`). Unreleased source (`87076c8` in the development repository) installed locally
- For comparison, the public release 0.7.2 was run against the same four repositories
- Apple M4 Max, macOS 26.7.1, Python 3.12.9, git 2.54.0
- The targets were the four local repositories cloned on September 2, 2026, and not updated since

The SHAs (identifiers assigned to each commit) of the measured commits (records of a single change) and their dates are as follows:

```text
pallets/click    36baa15ff831b939a22bc527cd76ce653ef6f66d  2026-08-26
pallets/flask    d318b683471101618febed18996405ad26462110  2026-08-16
encode/httpx     b5addb64f0161ff6bfe94c124ef76f6a1fba5254  2026-02-23
tj/commander.js  ba6d13ddb4243e5913367734f8c159089ffe7834  2026-05-29
```

Here are the commands, using click as an example:

```bash
git clone https://github.com/pallets/click
git -C click checkout 36baa15ff831b939a22bc527cd76ce653ef6f66d
grift repo click --format both --out out/click
grift verify out/click/report.json --repo click
```

`grift repo` completed in under 2.5 seconds for all four, and `grift verify` was `VERIFIED` for all four. A newly cloned copy of click produced identical results, except for the execution timestamps. The observed values listed here were also identical when run on the same source code using the public release 0.7.2.

| Repository | Human commits / merges / bots |
|---|---|
| click | 2,000 / 1,131 / 200 |
| flask | 3,674 / 1,691 / 191 |
| httpx | 1,335 / 41 / 147 |
| commander.js | 1,095 / 284 / 138 |

Human commits exclude merges (records incorporating changes from another branch). Changes by bots (automated programs submitting changes) are excluded.

Work areas (`surface_profile`) are classified by file paths and extensions, and commits are counted for each category. Because a single commit can touch multiple categories, the sum exceeds the denominator.

| Repository | Denominator | test / docs / backend / other |
|---|---|---|
| click | 1,999 | 562 / 1,024 / 1,158 / 309 |
| flask | 3,673 | 627 / 1,841 / 1,765 / 575 |
| httpx | 1,333 | 575 / 501 / 874 / 112 |
| commander.js | 1,094 | 286 / 468 / 0 / 530 |

Change intervals (`change_rhythm`) are counted over the 180 days leading up to the observation date, set as the date of HEAD. The observation dates correspond to the dates shown to the right of the SHAs above.

| Repository | commits / Active days | Median interval / p90 |
|---|---|---|
| click | 187 / 62 days | 0.08 days / 3.36 days |
| flask | 32 / 19 days | 0.80 days / 15.60 days |
| httpx | 11 / 8 days | Unobserved |
| commander.js | 22 / 18 days | 2.88 days / 17.89 days |

The reason httpx was unobserved is `insufficient_population`. The 11 commits within the window fell short of the 20-commit minimum threshold required to calculate the rate.

Testing patterns (`verification_profile`) count commits touching test directories.

| Repository | Commits including tests | Commits with fix subject also modifying tests |
|---|---|---|
| click | 562 / 2,000 | 80 / 249 |
| flask | 627 / 3,674 | 58 / 408 |
| httpx | 575 / 1,335 | 46 / 114 |
| commander.js | 286 / 1,095 | 30 / 106 |

Regarding test types, click had unit: 555, unknown: 23; flask had unit: 484, unknown: 204; httpx had unit: 554, unknown: 101; and commander.js had unknown: 286.

Unobserved items numbered 23 for click, flask, and commander.js, and 27 for httpx. The main reasons are:

- `forge_export_not_provided`, `tracker_export_not_provided`: Reviews, issue tracking, events
- `consenting_actor_required`: Experience, roles, library context
- `no_upstream_lineage`, `parent_repo_not_provided`, `template_not_provided`: Relationship with upstream, inheritance from templates
- `no_tenant_commits`: Time window containing 80% of internal commits
- `survival_scan_disabled`: Retention rate
- `outcome_declaration_not_provided`: Declarations of post-work outcomes
- `deferred_to_v0.6`: Line-level rework (retains the name from 0.6 even in 0.8.0)

For provenance (`origin`), all non-bot commits across all four repositories were `unresolved`. This is because neither identity.toml defining internal email addresses nor fork parents were provided.

The breakdowns of documentation commits in click and fix commits in flask are not Grift outputs. They are rough estimates recalculated locally by applying the same rules to git log. For click, 414 out of 1,025 commits touched only `CHANGES.rst` as documentation. For flask, 198 out of 407 commits with a fix subject modified only documentation or configuration files.

Regarding contributor list sorting (`actor_directory`), resorting the lines in 0.8.0 by commit count and running `grift verify` resulted in exit code 1 with `MISMATCH: 1 field(s) differ`. Verifying a report saved under 0.7.2 with 0.8.0 results in `CANNOT_VERIFY` due to differing definition versions. The cautionary note on active days appears in `activity.limitations` and `change_rhythm.limitations` in 0.8.0, but was absent in 0.7.2.

The following files were used for project declarations:

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

The output is divided into two sections: "Project Declarations" and "Observed Metrics." Undeclared items were marked as `not_declared` (not stated by the project; not a deficiency). Matching declarations against observations across axes is handled by `grift align`, categorized into five outcomes: overlap, out of bounds, 0 occurrences, unobserved, and no requirement.

## References

- [grift-cli (GitHub, MIT)](https://github.com/Cor-Incorporated/grift-cli) - CLI source code. Public release is 0.7.2; 0.8.0 is being prepared for release
- [Grift](https://griftai.org) - Product website
- [TEP Page (Grift)](https://griftai.org/tep) - Detailed explanation of TEP
- [How to Read Grift Reports (metrics-guide)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/metrics-guide.md) - Plain-language guide to each metric
- [TEP Norms (norms)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/norms.md) - Do not interpret absence negatively; prohibition of weighting and conversion
- [How to Enforce "No Scores, No Rankings" in Implementation (Cor.Inc. Blog, Oct 25, 2026)](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/) - Five conditions established in 0.8
- [I Founded a Company to Make "Ah, I Was Understood" an Everyday Experience (Cor.Inc. Blog)](https://cor-jp.com/blog/founder-story/) - CEO story and the thinking behind Grift's inception
- [Ethical Use of the MBTI (The Myers & Briggs Foundation)](https://www.myersbriggs.org/unique-features-of-myers-briggs/ethical-use-of-the-mbti/) - MBTI usage rules (voluntary nature, not for hiring)
- [MBTI Basics (The Myers & Briggs Foundation)](https://www.myersbriggs.org/my-mbti-personality-type/mbti-basics/) - Four preferences and 16 types
- [pallets/click](https://github.com/pallets/click) - Measured OSS (HEAD `36baa15`)
- [pallets/flask](https://github.com/pallets/flask) - Measured OSS (HEAD `d318b68`)
- [encode/httpx](https://github.com/encode/httpx) - Measured OSS (HEAD `b5addb6`)
- [tj/commander.js](https://github.com/tj/commander.js) - Measured OSS (HEAD `ba6d13d`)
