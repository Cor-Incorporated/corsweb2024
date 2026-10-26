---
title: "How to Protect \"No Scores, No Rankings\" in Implementation: 5 Acceptance Criteria Defined for the Next Version of Grift CLI"
description: "Grift CLI promises not to output scores or rankings. During a verification in October 2026, it was discovered that while a note stated it was not a ranking, the table was ordered by commit count in descending order. Written in plain terms for clients, SES sales representatives, and engineers, here are the five acceptance criteria set for the next version (0.8)."
summary: "In multi-person listings within Grift CLI, while notes stated they were \"not a ranking,\" the rows were arranged in descending order of commit counts. In the next version (0.8), the order will be changed to lexicographical order by ID, and values will remain as facts with denominators. Additionally, five acceptance criteria were established: do not rank people by observed volume, explicitly specify by name when selecting by volume, provide the position in the reference distribution only when requested, disclose inflation methods without applying adjustments, and separate declarations from observations bidirectionally."
pubDate: 2026-10-25
author: "Terisuke"
category: "engineering"
ctaIntent: "grift-team-beta"
tags: ["Grift", "OSS", "CLI", "git", "設計"]
lang: "en"
featured: false
isDraft: false
translationSourceHash: "39c0007f6df8fb02d1c8dcdeffbd2f772c87a2f5bccb1059088da8a87d9bd81e"
translatedAt: "2026-10-25T07:39:20.033Z"
translationModel: "gemini-3.8-flash"
---

"We do not assign scores or rankings." Grift makes this promise on both griftai.org and cor-jp.com.

However, writing a promise in text is one thing, and having the software uphold that promise is another. In this article, we share a discrepancy discovered within the Grift CLI on October 25, 2026, along with the five requirements we decided to impose on the upcoming release (0.8). We have written this as plainly as possible for hiring clients, sales representatives at staffing and recruiting agencies, and the engineers being recommended.

## What Happened in Practice

The Grift CLI includes an output that lists the people who contributed to a single repository (`actor-index`). In the currently published v0.7.2, this list includes a note stating, "Extracted solely by commit count; this is not a ranking of quality."

Yet, the rows of the table were sorted in descending order of commit count.

While the note claimed it was "not a ranking," the order of the table was determined by commit count. Readers notice the table before they read the note. We concluded that if readers interpret the person in the top row as the "best performer," that is not the reader's fault, but the responsibility of how the data was ordered.

During our line-by-line reconciliation on that same day, we found another gap. `grift align` only supported the direction of lining up the requirements declared by the client against observations of the candidate, with no entry point for engineers to declare what they look for in a project. Half of the promise we had consistently written—"For both those who recommend and those who are recommended"—was missing from the implementation.

Both issues were discovered by Cor. itself while cross-checking the copy on its website against the CLI output line by line. They were not pointed out by users. On the very day we found them, we documented them as an Architectural Decision Record (ADR).

## Why We Are Fixing Only the Sort Order First

One could argue that we should simply stop displaying commit counts altogether. Grift chose not to take that approach.

A commit count is a fact with a denominator. Even in the griftai.org demo, figures like "73 out of 274" cannot be interpreted without the total sample size. Erasing this data would conflict with Article 1 of our Terms of Participation: "Do not interpret absence negatively." What we are removing is not the values, but the sort order.

Sort order is not a fact; it is a presentation choice. Placing those with higher counts at the top is a presentation choice that prompts the recipient to read it as a ranking. In the next release, the default sort order for lists will be alphabetical by ID. The commit count values will remain. Increasing your commits will no longer move you to the top of the table.

## The Five Requirements Imposed on the Next Release (0.8)

We decided to impose the following five acceptance criteria on all changes in the 0.8 series:

### 1. Do Not Sort People by Observed Quantities

The default order of outputs listing people will be alphabetical by ID, with no dependence on observed quantities such as commit counts, lines of code, or number of days. The values themselves will remain as facts with denominators.

### 2. When Filtering by Quantity, State Clearly in the Name and Notes That It Is a Quantity

The `--top N` option retrieves the top N people with the highest observed commit counts. This is a filtering by quantity. While we will keep this in the next release, we will continue to state in the help text and output notes that "the filtering criterion is commit count, not quality or ranking." Whether to rename or deprecate it will be decided in a later release, as doing so would be a breaking change for existing workflows. We will not create any new filtering mechanisms based on observed quantities.

### 3. Display Position Within Reference Distributions Only When Requested

Grift includes a feature that shows which band a repository's values fall into within a reference distribution of public repositories. Although it reflects the position of the repository rather than a person, an individual running it on their own work could easily read it as "My repository is in the top N%." Increasing their metrics would move them up the bands. Starting with the next release, this will only be displayed when a specific reference distribution version is explicitly requested; by default, it will be treated as unobserved with the reason: "Reference distribution was not requested."

### 4. Disclose Ways Numbers Can Be Inflated, and Do Not Apply Corrections

The test co-modification rate can increase even with a perfunctory one-line change to a test file; the number of modified lines is not measured. The number of active days with changes over the past 180 days can be filled with a single small commit each day.

We will provide standard explanatory text alongside the numbers to disclose these factors. We will not apply weightings or corrections, as Article 7 of the Terms of Participation prohibits adjusting figures based on context or difficulty. This disclosure exists so that readers understand the limits of the numbers. It is not a feature meant to detect metric padding.

### 5. Do Not Mix Declarations and Observations—in Either Direction

Client requirements are "declarations," while a candidate's Git history constitutes "observations." `grift align` aligns these two across individual axes and outputs results in five distinct states: overlap, out of bounds, zero, unobserved, or no requirement. It creates no composite scores, rankings, or pass/fail judgments.

When we create an entry point for engineers to declare what they look for in a project, we will use the exact same five terms and the same set of prohibitions. In either direction, declarations and observations will remain in separate fields.

## For Each Reader's Role

To hiring clients: Starting with the next release, you will no longer be able to assume that the person at the top of the list is the best candidate. The order is alphabetical by ID. Please use the figures as material to make your interview inquiries more concrete.

To sales representatives at staffing and recruiting agencies: Rearranging records shared by candidates into ranking tables violates our Terms of Participation. When presenting recommendations, please provide the values alongside their denominators and the reasons for any unobserved items.

To engineers: Increasing your commits will not move you to the top of the list. The fact that you selected specific repositories to share will remain transparent to the recipient. We do not forbid selecting what to share; we ask that you do not conceal it.

## Conclusion

A promise cannot be kept simply by putting it in writing. If the implementation conflicts with the text, we fix the implementation and publicly document how the fix was made.

Version 0.8 has not yet been released. Because changing the sort order will cause verification checks on lists saved from earlier versions to fail to match, this update will be shipped alongside an increment of the definition version.

## Reference Materials

- [Grift](https://griftai.org) - Product site. The three promises and observed metrics
- [grift-cli (GitHub, MIT)](https://github.com/Cor-Incorporated/grift-cli) - CLI source code
- [TEP Norms (norms)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/norms.md) - Article 1: "Do not interpret absence negatively," Article 7: "Prohibition of weighting and conversion," handling of `--top N` and `grift align`
- [How to Read the grift Report (metrics-guide)](https://github.com/Cor-Incorporated/grift-cli/blob/main/docs/metrics-guide.md) - Plain-language explanations of each metric and decile notation rules
- [Grift Case Studies Page](https://cor-jp.com/works/grift/) - Track record highlights on cor-jp.com
