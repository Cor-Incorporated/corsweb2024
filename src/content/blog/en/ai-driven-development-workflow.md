---
title: "How GitHub activity changed with AI-assisted development: about 20–40 a month in late 2024, about 300 in May 2025"
description: "GitHub contribution counts were about 20–40 a month in the second half of 2024, and about 300 in May 2025. The count is GitHub's standard total, including issues, pull requests and reviews, based on the graph posted on 30 May 2025. It is not a rate of development speed or delivery volume."
summary: "GitHub contribution counts (GitHub's standard total, including issues, pull requests and reviews) were about 20–40 a month in the second half of 2024, and about 300 in May 2025. The \"7x\" in the first edition was a rounding that treated the period before using AI as about 50 a month. Quality, rework and working time were not compared under the same conditions."
pubDate: 2024-01-15
updatedDate: 2026-10-29
author: "Terisuke"
category: "ai"
ctaIntent: "contract-dev"
tags: ["AI", "コントリビュート", "Cursor", "CodeRabbit", "GitHub Copilot"]
lang: "en"
featured: true
translationSourceHash: "955397d96732625a2361532f533d4934ab6c77e0cc2b5d2853afae8f1f9b3d47"
translatedAt: "2026-10-29T05:20:00.000Z"
translationModel: "manual-i18n-sync"
---

GitHub contribution counts (GitHub's standard total, including issues, pull requests and reviews) were about 20–40 a month in the second half of 2024. In May 2025 they were about 300 (from the graph posted on 30 May 2025).

The "7x" in the first edition was a rounding that treated the period before using AI as about 50 a month.

This count does not show that development speed or delivery volume became some multiple.

This article looks back at which tasks were given to AI at the time, and what became easier to move forward. Quality, rework and actual working time were not compared under the same conditions. Those improvement rates are not claimed.

The comparison is the monthly count in the second half of 2024 and the count in May 2025. Whether counts from private repositories are included is not known from public information. No new denominator or quality metric was created to fit the old numbers.

## How the work was split at the time

### Writing code

Code was written with Claude Code. First an instruction was worked out in conversation with Claude Desktop, then passed to Claude Code in the terminal. In a few minutes there was code that formed a basic skeleton. From there, concrete instructions were stacked, such as "add a method to this class and write a unit test."

### Review

When a pull request was opened, CodeRabbit started a review and commented on the pull request about possible bugs, security notes and differences from coding conventions. The noted places were fixed with Cursor's Agent feature. That does not mean the comments find everything.

## What was counted

What was counted is the GitHub contribution count. In the second half of 2024 it was about 20–40 a month. In May 2025 it was about 300. Both are within the graph posted on 30 May 2025.

A contribution is not a commit count. Under GitHub's definition, issues, pull requests and reviews are counted as well as commits.

## Tools in use

- Cursor: an editor with AI built in. Noted places were fixed with the Agent feature
- Claude Desktop: working out instructions in conversation
- Claude Code: writing code from the instructions
- CodeRabbit: automatic review on pull requests

The feeling at the time was closer to solving problems in dialogue with AI than to writing code line by line. That is a feeling, not a measurement of working time or delivery volume.

## References

The title of the note article dated 1 June 2025 says development speed became 7x. The numbers in this company article follow the graph of 30 May 2025. They are not treated as a rate of speed or delivery volume.

https://note.com/cor_instrument/n/n800a959f7284

The monthly contribution graph is in the post of 30 May 2025.

https://x.com/cor_terisuke/status/1928266812019368121

- [GitHub Docs: Profile contributions](https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference) - the official description of what is counted as a contribution

https://cor-jp.com/

https://github.com
