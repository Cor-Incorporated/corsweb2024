---
title: "How to Uphold \"No Scores, No Rankings\" in Implementation: 5 Acceptance Criteria Defined for the Next Version of Grift CLI"
description: "Grift CLI promises not to output scores or rankings. During a verification in October 2026, it was discovered that while notes stated the data was not a ranking, the table rows were sorted by commit count in descending order. Here are the five acceptance criteria set for version 0.8, explained in plain terms for clients, SES sales representatives, and engineers."
summary: "In Grift CLI's multi-person lists, although notes stated \"this is not a ranking,\" rows were sorted in descending order of commit count. In 0.8, the sorting will be alphabetical by ID, and values will remain as facts with explicit denominators. In addition, we established five acceptance criteria: do not rank people by observed volume; explicitly specify in the name when selecting by volume; show position within a reference distribution only when requested; disclose expansion methods without making adjustments; and clearly separate declarations from observations in both directions."
pubDate: 2026-10-25
updatedDate: 2026-10-26
author: "Terisuke"
category: "engineering"
ctaIntent: "grift-team-beta"
tags: ["Grift", "OSS", "CLI", "git", "設計"]
lang: "en"
featured: false
isDraft: false
translationSourceHash: "a47e08fdba13a2b559bd0cf770e29dd7802e01efe33e23eea5205d8b53a2a12d"
translatedAt: "2026-10-26T07:49:25.247Z"
translationModel: "gemini-3.8-flash"
---

"We do not score or rank." Grift makes this promise on both griftai.org and cor-jp.com.

However, writing a promise in text is one thing, and having the software honor that promise is another. In this article, I write about a discrepancy found within the Grift CLI on October 25, 2026, and the five requirements we decided to impose on version 0.8. I have written this as plainly as possible for clients ordering services, sales representatives at staffing agencies and SES providers, and engineers being recommended.

> On October 26, 2026, the day after this article was written, we released 0.8.0. Details of the change that ordered the list of people by ID can be found in the [0.8.0 Release Notes](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0). The main text remains as it was at the time of writing (October 25, 2026).

## What Happened on the Ground

The Grift CLI includes an output that lists the people involved in a single repository (`actor-index`). In [v0.7.2](https://pypi.org/project/grift-cli/0.7.2/), which was public at the time of writing this article, this list carried the note: "Extracted solely by commit count; not a ranking of quality."

However, the rows of the table were ordered from highest to lowest commit count.

The note says "not a ranking," yet the table's ordering is determined by commit count. What catches the reader's eye first is the table, not the note. We concluded that if someone reads the person in the top row as "the person who did the best work," the fault lies not with the reader, but with how the information was ordered.

During our audit on the same day, we found another deficiency. `grift align` only had a direction for lining up client-declared requirements alongside candidate observations; it had no entry point for engineers to declare what they seek in a project. Half of the promise we had consistently stated—"For both those who recommend and those who are recommended"—was missing from the implementation.

Both issues were discovered when Cor. cross-checked the text on our own website against the CLI output line by line. They were not pointed out by users. On the very day we found them, we documented them in an Architectural Decision Record (ADR).

## Why Fix Only the Ordering First?

One line of thinking suggests we should simply stop displaying commit counts altogether. Grift did not take this path.

Commit counts are facts with denominators. Even the "73 out of 274" in the griftai.org demo cannot be interpreted without the base population. If we were to remove it, we would also run counter to Rule 1 of our Code of Norms: "Do not interpret absence negatively." What we remove is not the value, but the ordering.

Ordering is not a fact; it is a presentation choice. Placing whoever has the most at the top is a presentation choice that invites the recipient to read it as a ranking. In the next release, the default ordering of the list will be alphabetical by ID. The commit count values will remain. Increasing your commits will no longer bring you to the top of the table.

## The 5 Requirements Imposed on 0.8

We decided to impose the following five acceptance criteria on all changes in the 0.8 series:

### 1. Do not order people by observed quantities

The default ordering for outputs that enumerate people will be alphabetical by ID and will not depend on observed quantities such as commit counts, lines of code, or number of days. The values themselves will remain as facts with denominators.

### 2. When selecting by quantity, state clearly in the name and notes that it is a quantity

The option `--top N` extracts the top N individuals with the highest observed commit counts. This is a selection based on quantity. We will keep it in the next release, but we will continue to state in the help text and output notes: "The selection criterion is commit count, not quality or ranking." Whether to rename or deprecate it will be decided in a later release, as doing so would break existing usage. We will not create any new selection mechanisms based on observed quantities.

### 3. Display position on reference distributions only when requested

Grift has a feature that shows which band a repository's values fall into within a reference distribution of public repositories. While this reflects the position of the repository, not an individual, to the person running it on their own project, it can read as "my repository is in the top N%." Increasing the rate pushes the band higher. From the next release onward, this will only be displayed when explicitly requested along with a specified reference distribution version; by default, it will be marked as unobserved, accompanied by the reason: "Reference distribution was not requested."

### 4. Disclose how metrics can be inflated, and do not apply corrections

The test co-maintenance rate goes up even with a cosmetic one-line change to a test file; it does not look at the number of lines changed. The number of active days in the last 180 days can be filled with a single small commit every day.

We will display these pathways alongside the figures using fixed explanatory text. We will not apply weighting or corrections. This is because Rule 7 of our Code of Norms prohibits correcting values based on context or difficulty. The disclosure is intended to help readers understand the limitations of the figures; it is not a feature designed to detect metric inflation.

### 5. Do not mix declarations and observations—in both directions

Project-side requirements are "declarations"; a candidate's git history is "observation." `grift align` aligns these two along each axis and outputs them in one of five ways: overlap, out of bounds, zero items, unobserved, or no requirement. It creates neither overall scores, nor rankings, nor pass/fail determinations.

When building an entry point for engineers to declare what they seek in a project, we will use the same five terms and the same prohibitions. In either direction, declarations and observations will be placed in separate columns.

## For Each Reader's Role

To clients ordering services: Reading the person at the top of the list as the best candidate will no longer be possible starting with the next release. The ordering will be by ID. Please use the figures as material to make your interview questions more specific.

To sales representatives at staffing agencies and SES providers: Rearranging records shared by candidates into ranking tables violates our Code of Norms. When presenting reasons for a recommendation, please accompany them with the values, denominators, and reasons why certain items could not be observed.

To recruiters at in-house product companies: Generating rankings or pass/fail determinations from shared records also violates our Code of Norms. Please use the figures as material to make your interview questions more specific.

To engineers: Increasing your commits will not put you at the top of the list. The fact that you chose which repositories to submit will remain clear to the recipient. Choosing is not prohibited; what we ask is that you do not conceal it.

## Conclusion

Promises cannot be kept simply by putting them in writing. When text and implementation diverge, we fix the implementation and publish the background of that fix.

At the time of writing this article, 0.8 had not yet been released. Because changing the ordering would cause verification results for lists saved in earlier versions to no longer match, we planned to release it alongside an update to the definition version. We released [0.8.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0) on October 26, 2026, with the updated definition version.

## References

- [Grift](https://griftai.org) - Product website. The three promises and observed metrics
- [grift-cli (GitHub, MIT)](https://github.com/Cor-Incorporated/grift-cli) - CLI source code
- [grift-cli 0.8.0 Release Notes (GitHub)](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.8.0) - Changes in 0.8.0 released on October 26, 2026
- [grift-cli 0.7.2 (PyPI)](https://pypi.org/project/grift-cli/0.7.2/) - Version published at the time of writing this article
- [TEP Code of Norms (norms)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/norms.md) - Rule 1 "Do not interpret absence negatively," Rule 7 "Prohibition of weighting and conversion," handling of `--top N` and `grift align`
- [How to Read Grift Reports (metrics-guide)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/metrics-guide.md) - Plain-language explanations of each metric and decile notation rules
- [Grift Case Studies Page](https://cor-jp.com/works/grift/) - Track record and use cases on cor-jp.com
