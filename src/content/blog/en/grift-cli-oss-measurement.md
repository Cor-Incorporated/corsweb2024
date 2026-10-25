---
title: "What happens when you run a score-free tool on real OSS? Measuring four repositories with Grift CLI 0.8.0"
description: "We measured four OSS projects—click, flask, httpx, and commander.js—using the upcoming version of Grift CLI (0.8.0). Sharing the exact commands and outputs, we describe what was visible, what remained unseen, and how misinterpreting the numbers can lead you astray. We make no comparisons regarding the superiority of one repository over another."
summary: "Measuring four OSS projects with the upcoming version of Grift CLI (0.8.0), all observations finished within 2.5 seconds, and every item matched the recalculations from grift verify. While workspace scope, change intervals, and verification structures produce concrete values, areas like reviews, issue tracking, and individual experience remain unobserved—accompanied by stated reasons. Because values depend on path rules and observation windows, repositories cannot be compared side by side to determine superiority."
pubDate: 2026-10-25
author: "Terisuke"
category: "engineering"
ctaIntent: "grift-team-beta"
tags: ["Grift", "OSS", "CLI", "git", "実測"]
lang: "en"
featured: false
isDraft: false
translationSourceHash: "1a6743e05b9509c026319d50ed64815235cd876ba8f948088f196f9f7252180d"
translatedAt: "2026-10-25T14:26:36.806Z"
translationModel: "gemini-3.8-flash"
---

Grift CLI promises to extract verifiable facts from git history without assigning scores or rankings. So what happens when you run it against actual open-source software? On October 25, 2026, Cor. measured four OSS projects using the upcoming version (0.8.0).

This article presents the procedure and output as they are. We do not compare the superiority or inferiority of the repositories. Differences in values are described as differences in repository characteristics. What we decided to fix in 0.8 is documented in an article published on the same day: "[How to Enforce 'No Scores, No Rankings' in Implementation](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/)".

## What Is Not Included in This Article

A repo report also includes a list of people involved in that repository. Not a single person-level metric is included in this article. Publishing them would mean ranking real contributors with numbers and publicly displaying observations without their consent. `grift actor`, `--actors`, and `--top` were not used either.

As of October 25, 2026, 0.8.0 has not been released on PyPI. The public version is 0.7.2, and 0.8.0 is being prepared for release.

## Measured Environment and Targets

- grift 0.8.0 (definition version `tep-v0.8.0-2026-10-25`). We installed the unreleased source (`87076c8` from the development repository) locally
- For comparison, we also ran the public version 0.7.2 on the same four projects
- Apple M4 Max, macOS 26.7.1, Python 3.12.9, git 2.54.0

The targets are four local repositories that have not been updated since being cloned on September 2, 2026. They were measured in that state without re-cloning.

| Repository | Character | Measured HEAD | HEAD Date |
|---|---|---|---|
| [pallets/click](https://github.com/pallets/click) | Python CLI library | `36baa15ff831b939a22bc527cd76ce653ef6f66d` | 2026-08-26 |
| [pallets/flask](https://github.com/pallets/flask) | Python web framework | `d318b683471101618febed18996405ad26462110` | 2026-08-16 |
| [encode/httpx](https://github.com/encode/httpx) | Python HTTP client | `b5addb64f0161ff6bfe94c124ef76f6a1fba5254` | 2026-02-23 |
| [tj/commander.js](https://github.com/tj/commander.js) | JavaScript CLI library | `ba6d13ddb4243e5913367734f8c159089ffe7834` | 2026-05-29 |

## Executed Commands

To allow reproducing the same values locally, the commands are shown using click as an example.

```bash
git clone https://github.com/pallets/click
git -C click checkout 36baa15ff831b939a22bc527cd76ce653ef6f66d
grift repo click --format both --out out/click
grift verify out/click/report.json --repo click
```

`grift repo` observes the entire repository and writes `report.json` and `report.md`. `grift verify` recalculates using the conditions recorded in the report and compares all items. Even on a freshly cloned click aligned to this SHA, the results were identical to those obtained locally, except for the execution timestamp (`analyzed_at`).

We also measured using the public version 0.7.2 (the version installed via `pipx install grift-cli`) with the same source code, and the observed values published in this article were identical to those of 0.8.0. What changed in 0.8.0 are the sorting order of the people list and the explanatory notes. We will verify the differences in a later section.

## Observation Results of the Four Projects

| Item | click | flask | httpx | commander.js |
|---|---|---|---|---|
| `grift repo` Execution Time | 1.57 s | 2.32 s | 1.16 s | 1.14 s |
| `grift verify` Result | VERIFIED (1.62 s) | VERIFIED (2.40 s) | VERIFIED (1.33 s) | VERIFIED (1.28 s) |
| Human commits (excluding merges) | 2,000 | 3,674 | 1,335 | 1,095 |
| Merge commits | 1,131 | 1,691 | 41 | 284 |
| Excluded bot commits | 200 | 191 | 147 | 138 |
| Surface denominator (human commits with resolved paths) | 1,999 | 3,673 | 1,333 | 1,094 |
| Surface: test | 562 | 627 | 575 | 286 |
| Surface: docs | 1,024 | 1,841 | 501 | 468 |
| Surface: backend | 1,158 | 1,765 | 874 | 0 |
| Surface: other | 309 | 575 | 112 | 530 |
| Cadence counting window (180 days) | 2026-02-27 to 2026-08-26 | 2026-02-17 to 2026-08-16 | 2025-08-27 to 2026-02-23 | 2025-11-30 to 2026-05-29 |
| Commits in window / Active days | 187 commits / 62 days | 32 commits / 19 days | 11 commits / 8 days | 22 commits / 18 days |
| Cadence median / p90 | 0.08 days / 3.36 days | 0.80 days / 15.60 days | Not observed (insufficient sample size) | 2.88 days / 17.89 days |
| Commits including tests | 562 / 2,000 | 627 / 3,674 | 575 / 1,335 | 286 / 1,095 |
| Commits with a fix subject that also touched tests | 80 / 249 | 58 / 408 | 46 / 114 | 30 / 106 |
| Test types (determined by path) | unit: 555, unknown: 23 | unit: 484, unknown: 204 | unit: 554, unknown: 101 | unknown: 286 |
| Origin | All non-bot commits are unresolved | Same | Same | Same |
| Unobserved (not_observed) items | 23 | 23 | 27 | 23 |

Because a single commit may match multiple classifications, the sum of surface counts exceeds the denominator.

Reading this table horizontally cannot determine which repository is better. The reason is explained in the following "Misreading the Numbers" section.

## What Could Not Be Seen

"Unobserved" (not_observed) means "could not be measured"; it does not mean "there was no track record." The report documents the reason for each unobserved item. The reasons for the 23 items common across all four projects are as follows. Multiple input fields that yielded the same reason are consolidated into a single row.

| Unobserved Item | Reason (reason) | Required for Observation |
|---|---|---|
| Reviews, issue tracking, events, and their cadences | `forge_export_not_provided`, `tracker_export_not_provided` | Forge and tracker export files (`--forge-export`, `--tracker-export`) |
| Experience, roles, library context | `consenting_actor_required` | Consented identity of the individual |
| Relationship with upstream, inheritance from templates | `no_upstream_lineage`, `parent_repo_not_provided`, `template_not_provided` | Path to parent repository or template |
| Period containing 80% of internal commits | `no_tenant_commits` | Identity defining internal email addresses |
| Survival rate | `survival_scan_disabled` | `--survival` (time-consuming) |
| Post-work event declarations | `outcome_declaration_not_provided` | `--outcome-declaration` |
| Line-level rework | `deferred_to_v0.6` | Not produced in 0.8.0 |

For httpx, four cadence-related items (median, p90, share within 2 days, share at 30 days or more) were added to this list. The reason is `insufficient_population`. There were 11 commits within the window, falling short of the 20-commit threshold required to calculate ratios. The reason for line-level rework remains the name from the 0.6 era (`deferred_to_v0.6`) even in 0.8.0.

The fact that all origins were categorized as unresolved is another thing that could not be seen. Origin is classified when either an identity.toml defining internal email addresses or a fork parent is provided. When measuring OSS as-is, neither is provided, so every non-bot commit ends up as "could not be determined." In the same table, items such as `tenant_unique` are 0, but this means "there were no matching instances." It has a different meaning from unresolved.

## Misreading the Numbers

### Commit Counts

Commit counts vary depending on the length of history and how changes are incorporated. flask has 3,674 human commits, while httpx has 1,335. This difference is not a matter of good or bad. The number of days since the initial commit is 5,976 days for flask and 2,517 days for httpx. flask had 1,691 merge commits, while httpx had 41. Even for the same change, the count changes depending on whether it is merged in bulk or incorporated as individual commits.

### Surface Names

Surface names are the names of path rules. commander.js had 0 backend commits and 530 other commits. This is because the files in `.js`, which constitute the core of commander.js, are not covered by the backend rules. The backend rules are determined by directories such as `api/` and `services/`, and file extensions such as `.py`, `.go`, and `.rs`.

Conversely, the reason click has 1,158 backend commits is that all files in `.py` fall under backend. click is not a server program. The report itself states, "This is an observation of work surfaces based on paths and extensions."

### Docs Count

A high docs count does not necessarily mean a strong dedication to documentation. The docs rules look for file extensions such as `.md` and `.rst` and directories such as `docs/`. In repositories where a changelog file is appended with every change, the docs count increases.

In click, recounting the breakdown of commits classified as docs directly from git log using the same rules reveals that out of 1,025 commits, 414 touched only the changelog (`CHANGES.rst`) as far as docs files were concerned. This breakdown is an approximate recount done locally, not an output of grift. The report notes for click that "docs-related surfaces show a relatively high tendency," rating its strength as weak and certainty as directional.

### Fix Subject Lines

"Commits with a fix subject that also touched tests" refers to commits whose subjects start with strings like `fix`, `bug`, or `revert` and also modified test files. In flask, this was 58 out of 408 commits.

Recounting flask's git log using the same rules showed that out of 407 commits with a fix subject, 198 modified only docs or configuration files. Their subject lines were things like "fix typo" or link corrections. Because nearly half of the "fixes" do not involve tests, interpreting this value as "not writing tests even when fixing bugs" is incorrect.

### Cadence Counting Window

Cadence is counted within a 180-day window from the observation date. If the observation date is not specified with `--as-of`, the date of the HEAD commit becomes the observation date (`window_basis=legacy_head_date`). Consequently, the windows for the four repositories all cover different time periods.

The httpx window (2025-08-27 to 2026-02-23) contained only 11 commits, and the cadence value was marked as unobserved. Interpreting this as "development has stalled" is also incorrect. What was measured was the local checkout, not the current state of upstream.

### Active Days

Finally, we verified this by creating two small test repositories. Both add the exact same 5-line file after an initial commit. One committed the 5 lines in a single commit, while the other committed them 1 line at a time across 5 separate days.

| Construction Method | Commits (including initial) | Final Tree | Active Days |
|---|---|---|---|
| 5 lines committed in 1 commit | 2 | `880a82d` | 2 days |
| 1 line committed per day across 5 days | 6 | `880a82d` | 6 days |

Even though the content is identical, the active days end up as 2 days and 6 days. Version 0.8.0 does not adjust this number. Instead, next to the value, it includes the statement: "Increases if a small commit is made every day; decreases if the same changes are consolidated into a single day."

## What Was Fixed in 0.8.0

As described in the article published on the same day, 0.8.0 changed the sort order of the people list and disclosed how active days can be inflated. We compared the output of 0.7.2 and 0.8.0 for the people list (`actor_directory`) in the repo reports across the same four projects. We looked only at the sort order, not names or counts.

| Item | 0.7.2 | 0.8.0 |
|---|---|---|
| Row sorting | Descending commit count for all 4 | Ordered by actor_id for all 4 |
| Is top row the person with most commits? | Yes, for all 4 | No, for all 4 |
| Row position of person with most commits | Row 1 for all 4 | click: row 120 (of 467), flask: row 280 (of 870), httpx: row 232 (of 258), commander.js: row 15 (of 203) |
| Statement on inflating active days | None | Present in `activity.limitations` and `change_rhythm.limitations` |

The Markdown heading in 0.7.2 was "actor List (Not a Quality Ranking)", but the rows were sorted by commit count in descending order. In 0.8.0, under the same heading, it states: "Rows are ordered by actor_id (not by commit count). Row position has no significance."

When the rows of the 0.8.0 output were resorted by commit count in descending order and passed to `grift verify`, it failed with `MISMATCH: 1 field(s) differ` (`actor_directory.actors`) and exit code 1. A resorted list fails verification.

Other values have not changed. Values for surfaces, validation formats, origins, and denominators were identical between 0.7.2 and 0.8.0 across all four projects. The only difference in cadence was that the explanatory notes (limitations) increased from 3 sentences to 4 sentences. When a report saved under 0.7.2 is passed to 0.8.0's `grift verify`, it results in `CANNOT_VERIFY` because the definition version is `tep-v0.7.2-2026-09-07`, differing from the current version.

We also checked whether tampering with values could be detected. In the click report, when the value for the combination of fixes and tests (`fix_with_test_pairing`) was modified from 0.3213 to 0.9 and passed to `grift verify`, it stopped with exit code 1, citing both values with `report=0.9 recomputed=0.3213`.

On the other hand, some things are not yet included. In condition 4 of the article published on the same day, we noted that the co-modification rate for tests could also be boosted by formal 1-line changes to test files. In the 0.8.0 repo report, this path is not yet stated next to the metric. In 0.8.0, only the single sentence regarding active days was placed next to the numbers.

## Aligning with Project Declarations

`grift project` juxtaposes the requirements written by the project side (declarations) and the operational patterns observed from git (observations) in separate sections. We declared a hypothetical small project, "Python Library Maintenance," and ran it against the four repositories.

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

The output is divided into two sections, "Project Declarations" and "Observed Metrics," with no pass/fail judgment. The undeclared cadence p90 becomes `not_declared`, and the report notes: "Not specified by project side. Not a deficiency." Even if the declaration requests a forge, because no forge export was provided, reviews on the observation side remain unobserved. For click, the comparison appeared as follows:

| Axis | Declaration | click Observation |
|---|---|---|
| Active days in 180 days | 12 days or more | 62 days (187 commits in window) |
| Median cadence | 7 days or fewer | 0.08 days |
| Cadence p90 | Not declared (not_declared) | 3.36 days |
| Surface | backend, test | backend: 1,158 commits, test: 562 commits |
| Test type | unit | unit: 555 commits |
| Input | git, forge | git only (forge is unobserved) |

The other three projects are arranged in the same manner. Even after alignment, the misreadings discussed in the previous section remain intact. The reason backend is 0 for commander.js is that `.js` is not in the rules, and httpx's median cadence is unobserved due to an insufficient sample size in the window.

Matching declarations against observations on each axis is handled by `grift align`, which outputs one of five statuses: overlap, out of range, zero count, unobserved, or no requirement. However, `grift align` takes candidate observations as input. Because that would involve measuring real individuals, it was not executed in this article.

## Conclusion

For all four projects, results were generated within 2.5 seconds and matched verification. However, every metric will be misinterpreted unless read alongside its denominator, observation window, and path rules. What could be seen and what could not be seen are documented with explicit reasons by the report itself.

You can verify this on your own repositories using the same commands. What judgments to draw from the resulting metrics is up to the reader.

## References

- [grift-cli (GitHub, MIT)](https://github.com/Cor-Incorporated/grift-cli) - CLI source code. Public release is 0.7.2; 0.8.0 is in preparation
- [Grift](https://griftai.org) - Product website
- [Reading grift Reports (metrics-guide)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/metrics-guide.md) - Plain-language guide to each metric
- [TEP Usage Norms (norms)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/norms.md) - Not interpreting absence as negative; prohibition of weighting and scoring conversions
- [How to Enforce 'No Scores, No Rankings' in Implementation (Cor.Inc. Blog, October 25, 2026)](https://cor-jp.com/blog/grift-no-score-no-rank-in-code/) - The five conditions established in 0.8
- [pallets/click](https://github.com/pallets/click) - Measured OSS (HEAD `36baa15`)
- [pallets/flask](https://github.com/pallets/flask) - Measured OSS (HEAD `d318b68`)
- [encode/httpx](https://github.com/encode/httpx) - Measured OSS (HEAD `b5addb6`)
- [tj/commander.js](https://github.com/tj/commander.js) - Measured OSS (HEAD `ba6d13d`)
