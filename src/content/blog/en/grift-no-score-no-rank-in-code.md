---
title: "How to Uphold \"No Scores, No Rankings\" in Implementation: 5 Conditions Grift CLI Set for the Next Release"
description: "Grift CLI promises not to output scores or rankings. During a cross-check in October 2026, it was discovered that while notes stated it was not a ranking, the table was sorted in descending order of commit count. We plainly explain the five acceptance criteria imposed on version 0.8 for clients, SES sales representatives, and engineers."
summary: "In Grift CLI's multi-person lists, while notes stated \"this is not a ranking,\" the rows were actually sorted in descending order of commit count. In 0.8, the order is set to lexicographical by ID, and values are retained as facts with denominators. Additionally, we established five acceptance criteria: do not rank people by observed volume; explicitly specify by name when selecting by volume; only show positions in reference distributions when requested; do not adjust figures without disclosing how they were inflated; and separate declarations and observations in both directions."
pubDate: 2026-10-25
updatedDate: 2026-10-26
author: "Terisuke"
category: "engineering"
ctaIntent: "grift-team-beta"
tags: ["Grift", "OSS", "CLI", "git", "設計"]
lang: "en"
featured: false
isDraft: false
translationSourceHash: "a4f1e0d54ebc897cb5d03c3e4638f4ee95a1186614d552ad4af7870ba227abda"
translatedAt: "2026-10-26T13:30:36.391Z"
translationModel: "gemini-3.8-flash"
---

"We assign no scores and no rankings." Grift promises this on both griftai.org and cor-jp.com.

However, writing a promise in text is one thing, and having software honor that promise is another. In this article, I describe the discrepancies discovered within Grift CLI on October 25, 2026, and the five requirements we decided to impose on version 0.8. I have written this as plainly as possible for clients ordering services, sales representatives at staffing and recruiting agencies, and engineers being recommended.

> On October 26, 2026, the day after this article was written, we released 0.8.0. Details of the change that sorted the list of individuals by ID order can be found in the [0.8.0 release notes](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0). The main text remains as it was written at the time (October 25, 2026).

## What Happened on the Ground

Grift CLI includes an output that lists the people who contributed to a single repository (`actor-index`). In [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/), which was the public release at the time this article was written, this list carried an explanatory note: "Extracted solely by commit count; this is not a ranking of quality."

However, the rows in the table were sorted in descending order of commit count.

The note stated that it was "not a ranking," yet the table's ordering was determined by the number of commits. When someone reads it, their eyes catch the table before the note. We concluded that if a reader interprets the person in the top row as the "best performer," the responsibility lies not with the reader, but with how the list is ordered.

During our verification on the same day, another gap came to light. `grift align` only had an orientation for aligning a client's declared requirements with candidate observations; it had no entry point for engineers to declare what they seek in an engagement. Half of the promise we had put in writing—"for both those who recommend and those who are recommended"—was missing from the implementation.

Both issues were discovered by Cor. checking the wording on its website against the CLI output line by line. They were not pointed out by users. On the very day we found them, we documented them as an Architectural Decision Record (ADR).

## Why We Are Fixing Only the Sort Order First

One could argue that we should simply stop outputting commit counts altogether. Grift did not take that approach.

Commit counts are facts accompanied by denominators. Even the "73 out of 274" in the griftai.org demo cannot be interpreted without the base population. Removing it would also conflict with Article 1 of our usage norms: "Do not interpret absence negatively." What needs to be removed is not the values, but the sort order.

Sort order is not a fact; it is a presentation choice. Placing whoever has the highest count at the top is a presentation choice that prompts the recipient to read it as a ranking. In the next version, the default sort order of the list will be alphabetical by ID. The commit count values will remain. Increasing your commits will no longer move you to the top of the table.

## The Five Requirements Imposed on 0.8

We decided to impose the following five acceptance criteria on all changes in the 0.8 line:

### 1. Do Not Sort People by Observed Quantities

The default ordering of outputs that list people must be alphabetical by ID, with no dependence on observed quantities such as commit counts, line counts, or active days. The values themselves will remain as facts accompanied by denominators.

### 2. When Selecting by Quantity, State Clearly in the Name and Notes That It Is by Quantity

The `--top N` option extracts the top N individuals with the highest observed commit counts. This is filtering by quantity. We will keep it in the next version, but we will continue to state explicitly in the help text and output notes that "the selection criterion is commit count, not quality or ranking." Whether to rename or deprecate it will be decided in a later version, as doing so would be a breaking change for existing workflows. We will not create any new selection mechanisms based on observed quantities.

### 3. Output the Position on the Reference Distribution Only When Requested

Grift includes a feature that shows which band a repository's values fall into within a reference distribution of public repositories. Although this is the position of a repository rather than an individual, to the person who ran the command, it reads as "my repository is in the top N%." Increasing the rate pushes the band higher. From the next version onward, this will only be output when explicitly requested with a reference distribution version specified; by default, it will be marked as unobserved with the reason: "Reference distribution was not requested."

### 4. Disclose Ways Numbers Can Be Inflated, and Do Not Apply Corrections

Test co-change increases even with a formal, one-line change to a test file. It does not look at the number of lines changed. The count of active days over the past 180 days can be filled with a single small commit each day.

We will disclose such pathways in fixed text displayed alongside the numbers. We will not apply weightings or corrections, as Article 7 of our usage norms prohibits adjusting numbers based on context or difficulty. The disclosure exists to help readers understand the limits of the numbers. It is not a feature for detecting inflated metrics.

### 5. Do Not Mix Declarations and Observations—in Both Directions

A project's requirements are "declarations"; a candidate's Git history is "observations." `grift align` aligns these two along each axis and outputs them using five states: overlap, out of range, zero, unobserved, and no requirement. It generates no composite scores, rankings, or pass/fail decisions.

When we create an entry point for engineers to declare what they seek in an engagement, we will use the same five terms and the same prohibitions. In either direction, declarations and observations will remain in separate fields.

## By Reader Perspective

To clients ordering services: Starting with the next version, you will no longer be able to read the person at the top of the list as the best candidate. The order will be by ID. Please use the numbers as concrete material for what to ask during interviews.

To sales representatives at staffing and recruiting agencies: Rearranging records shared by candidates into ranking tables violates the usage norms. When communicating reasons for a recommendation, please provide the values, their denominators, and the reasons for anything that could not be observed.

To hiring managers at in-house development companies: Deriving rankings or pass/fail determinations from shared records also violates the usage norms. Please use the numbers as concrete material for what to ask during interviews.

To engineers: Increasing your commits will not bring you to the top of the list. The fact that you chose which repositories to submit will remain apparent to the recipient. Choosing is not prohibited. What we ask is that you do not conceal it.

## Conclusion

Promises cannot be kept simply by writing them down. When the text and the implementation conflict, we fix the implementation and disclose the history of that fix.

At the time this article was written, 0.8 had not yet been released. Because changing the sort order causes verification results for lists saved under previous versions to mismatch, we planned to release it alongside an update to the definition version. [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0) bumped the definition version and was released on October 26, 2026.

## References

- [Grift](https://griftai.org) - Product site. The three promises and observed metrics
- [grift-cli (GitHub, MIT)](https://github.com/Cor-Incorporated/grift-cli) - CLI source code
- [grift-cli 0.8.0 Release Notes (GitHub)](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0) - Changes in 0.8.0, released on October 26, 2026
- [grift-cli 0.7.2 (PyPI)](https://pypi.org/project/grift-cli/0.7.2/) - The version publicly available when this article was written
- [TEP Usage Norms](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/norms.md) - Article 1: "Do not interpret absence negatively," Article 7: "Prohibition of weighting and conversion," handling of `--top N` and `grift align`
- [How to Read Grift Reports (metrics-guide)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/metrics-guide.md) - Plain-language guide to each metric and decile notation rules
- [Grift Case Studies](https://cor-jp.com/works/grift/) - Track record showcase on cor-jp.com
