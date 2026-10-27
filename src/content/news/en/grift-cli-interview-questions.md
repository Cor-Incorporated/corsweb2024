---
title: "Grift CLI Reports Now Include Topics to Confirm in Interviews at the Top (0.9.0)"
description: "We released Grift CLI version 0.9.0 on October 27, 2026. Only when consent is recorded under the ID provided by the candidate, a short summary of their work style based on the records and topics to confirm in interviews are written at the top of the report. As before, scores, rankings, and type names are not output."
publishedAt: 2026-10-27
category: "update"
tags: ["Grift", "OSS", "Product"]
source: "Grift"
isDraft: false
featured: false
lang: "en"
translationSourceHash: "ee3b30cd8a4c623febd67cf1ddbe2d672fee01c19b0a7a0c71444603a2de58b7"
translatedAt: "2026-10-27T13:43:43.779Z"
translationModel: "gemini-3.8-flash"
---

## What Changed in 0.9.0

On October 27, 2026, Cor.Inc. released [0.9.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0) of the Grift CLI. As before, it does not output scores, rankings, or type names.

At the beginning of the Markdown for `grift actor`, `grift project`, and `grift align`, a short text describing the work style visible from the records is now written. It describes the breakdown of changed areas, the pace of changes, how tests are added, and the way of involvement, along with counts and timeframes. Following this, it states what cannot be seen from these records and lists points to confirm during interviews in the form of questions. The text is selected from numbers using a public [decision table](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/trait-profile.md). It does not use AI and is not included in the JSON.

Statements and questions about an individual are output only when there is a record of consent under the ID stated by the individual themselves. Otherwise, a single sentence is written explaining the reason it is not output. The interview questions are materials meant to make what to ask the candidate themselves more concrete. They are not intended for determining pass/fail results or rankings.

The "strength" row for trends and the "fit" row for comparisons have been removed from the Markdown. This is because when two reports are placed side by side, they could be read as strong vs. weak people, or suitable vs. unsuitable people. In addition, four places where inaccurate figures about an individual could appear have been corrected. Details on what was fixed can be found in the [release notes](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0).

## Before Updating

Because the definition version has changed, reports (`analyze`, `actor`, and `repo`) and comparisons saved with 0.8.0 will show as "unverifiable (`CANNOT_VERIFY`)" in 0.9.0's `grift verify`. Project reports will show as "mismatch (`MISMATCH`)". Please regenerate them with 0.9.0. For more details, see the [migration notes](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/migration-v090.md).

```bash
pipx upgrade grift-cli
```

The philosophy behind Grift and the background of its development are summarized on the [Grift case study page](/works/grift).
