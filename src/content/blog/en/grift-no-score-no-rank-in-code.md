---
title: "How to Uphold \"No Scores, No Rankings\" in Implementation: 5 Acceptance Criteria Defined for the Next Version of Grift CLI"
description: "Grift CLI promises not to output scores or rankings. During a verification in October 2026, we found that although a footnote stated the table was not a ranking, the rows were sorted by the number of commits in descending order. In plain terms for clients, SES sales representatives, and engineers, here are the five acceptance criteria we are setting for version 0.8."
summary: "In Grift CLI's multi-person summary, while a footnote stated \"this is not a ranking,\" the rows were sorted by commit count in descending order. In version 0.8, rows will be sorted in lexicographical order by ID, and values will remain as facts with denominators. Additionally, we have set five acceptance criteria: do not rank people by observed volume, explicitly state the criteria by name when selecting by volume, provide reference distribution positions only when requested, do not apply adjustments while disclosing scaling methods, and separate declarations from observations in both directions."
pubDate: 2026-10-25
updatedDate: 2026-10-26
author: "Terisuke"
category: "engineering"
ctaIntent: "grift-team-beta"
tags: ["Grift", "OSS", "CLI", "git", "設計"]
lang: "en"
featured: false
isDraft: false
translationSourceHash: "b4df3339b952ccaf76a24aeda11f1f5ea378a44ad8a3ea41e018de59e3116d63"
translatedAt: "2026-10-26T04:35:32.407Z"
translationModel: "gemini-3.8-flash"
---

"We do not score or rank." Grift makes this promise on both griftai.org and cor-jp.com.

However, writing down a promise and having the software uphold it are two different things. In this article, I will describe the discrepancy I found in the Grift CLI on October 25, 2026, and the five conditions I decided to impose on version 0.8. I have written this as plainly as possible for hiring companies, recruiters and SES account managers, and the engineers being recommended.

> On October 26, 2026—the day after writing this article—we released version 0.8.0. The details of the change that orders the list of individuals by ID can be found in the [0.8.0 release notes](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0). The body of this article remains exactly as written at the time (October 25, 2026).

## What Happened in Practice

The Grift CLI includes an output that lists the individuals who contributed to a single repository (`actor-index`). In [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/), which was the public release when this article was written, this list carried an explanatory note stating: "Extracted solely by commit count; this is not a quality ranking."

Yet, the rows of the table were ordered from highest to lowest commit count.

The note said "not a ranking," but the table's ordering was determined by commit count. What catches the reader's eye first is not the note, but the table. If the reader interprets the person in the top row as the "best performer," that is not the reader's fault; the responsibility lies with how the data was ordered.

During the same day's audit, another omission came to light. `grift align` only worked in one direction: comparing the client's declared requirements against observations of the candidate. There was no entry point for engineers to declare what they look for in a project. Half of the promise we had been writing—"for both those who recommend and those who are recommended"—was missing from the implementation.

Both issues were discovered when Cor. cross-checked the text on our own website against the CLI's output line by line. They were not pointed out by users. On the very day they were found, we documented them in an Architectural Decision Record (ADR).

## Why Fix Only the Ordering First?

One could argue that we should simply stop displaying commit counts altogether. Grift did not take that approach.

Commit counts are facts accompanied by denominators. Even the example "73 out of 274" in the griftai.org demo cannot be interpreted without the total population. Erasing them would also conflict with Article 1 of our usage norms: "Do not interpret absence negatively." What must be removed is not the value, but the ordering.

Ordering is not a fact; it is a presentation choice. Placing whoever has the highest count at the top is a presentation that encourages the recipient to read it as a ranking. In the next version, the default order of the list will be alphabetical by ID. The commit count values will remain. Increasing your commits will no longer move you to the top of the table.

## The Five Conditions Imposed on 0.8

We decided to impose the following five acceptance conditions on all changes in the 0.8 series.

### 1. Do Not Order Individuals by Observed Volume

The default ordering for outputs that list individuals must be alphabetical by ID, with no dependence on observed volumes such as commit counts, lines of code, or number of active days. The values themselves will remain as facts accompanied by denominators.

### 2. When Selecting by Volume, State Clearly in the Name and Notes That It Is Volume

The `--top N` option extracts the top N individuals by observed commit count. This is a selection based on volume. We will retain it in the next version, but we will continue to state in the help text and output notes that "the selection criterion is commit count, not quality or ranking." Whether to rename or deprecate it will be decided in a later release, as doing so would break existing usage. We will not create any new selection mechanisms based on observed volume.

### 3. Show Positions on Reference Distributions Only When Requested

Grift includes a feature that shows which band a repository's values fall into within a reference distribution of public repositories. While this reflects the position of the repository rather than an individual, users running it on their own work might interpret it as "my repository is in the top N%." Increasing percentages shifts the band upward. From the next version onward, this will only be displayed when a specific reference distribution version is explicitly requested; by default, it will be marked as unobserved, accompanied by the reason: "Reference distribution was not requested."

### 4. Disclose How Numbers Can Be "Inflated" Without Applying Corrections

The co-test commit rate can be boosted by even a pro forma, one-line change to a test file. It does not look at the number of lines modified. The number of active days modified over the last 180 days can be filled with a single small commit each day.

Such mechanisms will be disclosed alongside the numbers using standard boilerplate text. We will not apply weightings or adjustments. This is because Article 7 of our usage norms prohibits adjusting numbers based on context or perceived difficulty. The disclosure exists so readers understand the limitations of the metrics. It is not a feature for detecting inflated numbers.

### 5. Do Not Mix Declarations and Observations—in Both Directions

A client's requirements are "declarations"; a candidate's git history consists of "observations." `grift align` aligns these two along each axis and outputs one of five statuses: overlap, out of scope, zero occurrences, unobserved, or no requirement. It does not generate overall scores, rankings, or pass/fail determinations.

When building an entry point for engineers to declare what they look for in a project, the same five terms and the same restrictions will apply. In either direction, declarations and observations will remain in separate fields.

## By Reader Perspective

To hiring companies: Starting with the next version, you will no longer be able to assume that the person at the top of the list is the best candidate. The order is by ID. Please use the numbers as material to make your questions more specific during interviews.

To recruiters and SES account managers: Reorganizing records shared by candidates into ranking tables violates our usage norms. Please convey the rationale for your recommendations along with the values, denominators, and the reasons why certain metrics could not be observed.

To engineers: Increasing your commits will not move you to the top of the list. The fact that you selected which repositories to present will remain visible to the recipient. We do not forbid selecting repositories; we ask that you do not conceal it.

## Conclusion

A promise cannot be kept simply by writing it down. When the text and the implementation diverge, we fix the implementation and publish the context behind the fix.

When this article was written, 0.8 had not yet been released. Because changing the ordering would cause the verification results of lists saved with earlier versions to mismatch, we planned to release it alongside an update to the definition version number. [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0) was released on October 26, 2026, with the updated definition version.

## References

- [Grift](https://griftai.org) - Product site. The three promises and observed metrics
- [grift-cli (GitHub, MIT)](https://github.com/Cor-Incorporated/grift-cli) - Source code for the CLI
- [grift-cli 0.8.0 Release Notes (GitHub)](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0) - Changes in 0.8.0, released on October 26, 2026
- [grift-cli 0.7.2 (PyPI)](https://pypi.org/project/grift-cli/0.7.2/) - The release available at the time this article was written
- [TEP Usage Norms](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/norms.md) - Article 1 "Do Not Interpret Absence Negatively," Article 7 "Prohibition of Weighting and Conversion," and the handling of `--top N` and `grift align`
- [How to Read Grift Reports (metrics-guide)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/metrics-guide.md) - Plain-language explanations of each metric and decile notation rules
- [Grift Case Studies Page](https://cor-jp.com/works/grift/) - Track record showcase on cor-jp.com
