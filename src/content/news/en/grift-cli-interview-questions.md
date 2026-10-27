---
title: "Grift CLI Reports Now Include Topics to Clarify in Interviews (0.9.0)"
description: "We released Grift CLI 0.9.0 on October 27, 2026. Only when consent is recorded under the ID provided by the candidate, the report now begins with brief sentences outlining their working style as observed from the records and points to clarify during the interview. As before, scores, rankings, and type labels are not included."
publishedAt: 2026-10-27
category: "update"
tags: ["Grift", "OSS", "Product"]
source: "Grift"
isDraft: false
featured: false
lang: "en"
translationSourceHash: "1af911264961073a5818f1745fa3379f031c6cefe30d129970b18a44e89409c5"
translatedAt: "2026-10-27T13:52:28.528Z"
translationModel: "gemini-3.8-flash"
---

## What Changed in 0.9.0

Cor.Inc. released [0.9.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0) of Grift CLI on October 27, 2026. As before, it does not output scores, rankings, or type labels.

At the top of the Markdown for `grift actor`, work styles visible from the records are described in short sentences. The categories of modified areas, the pace of changes, testing approaches, and ways of involvement are stated along with counts and timeframes. Following this, aspects not visible in these records are noted, and points to confirm in an interview are listed as questions. `grift project` describes how project repositories were advanced using the same conventions, without outputting individual metrics or involvement. `grift align` pairs requirements and record sequences with points to confirm in an interview in the form of questions. Sentences and questions are selected from numbers using a public [decision table](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/trait-profile.md), without using AI. Because they are not included in the JSON, what can be verified with `grift verify` are the numbers behind the sentences.

Sentences and questions about individuals are output only when there is a record of consent under the ID provided by the individual. Otherwise, the reason for omitting them is stated in a single sentence. Interview questions serve as material to specify what to ask the candidate directly. They are not intended for making pass/fail decisions or rankings.

The "strength" line for trends and the "direction" line for cross-referencing have been removed from the Markdown. This is because comparing two reports could make it read as strong/weak individuals or suitable/unsuitable individuals. In addition, we fixed four areas where numbers differing from facts about individuals could appear. The fixed areas are listed in the [release notes](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0).

## Before Updating

Because the definition version has changed, reports saved in 0.8.0 (`analyze`, `actor`, `repo`) and cross-references will result in "unverifiable (`CANNOT_VERIFY`)" under `grift verify` in 0.9.0. Project reports will result in "mismatch (`MISMATCH`)." Please regenerate them in 0.9.0. For details, see [Migration Notes](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/migration-v090.md).

```bash
pipx upgrade grift-cli
```

The philosophy and development background of Grift are summarized on the [Grift Case Study page](/works/grift).
