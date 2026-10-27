---
title: "Grift CLI Reports Now Begin with Points to Confirm in Interviews (0.9.0)"
description: "We released Grift CLI 0.9.0 on October 27, 2026. Only when consent is recorded under the ID provided by the individual, the report will now include short sentences at the very beginning outlining work styles observed from the records and points to confirm during interviews. As before, scores, rankings, and type names are not output."
publishedAt: 2026-10-27
category: "update"
tags: ["Grift", "OSS", "Products"]
source: "Grift"
isDraft: false
featured: false
lang: "en"
translationSourceHash: "a7fe0fafe296a0da9774befadd179855e488c4514793080dd3360f94cbaa222b"
translatedAt: "2026-10-27T13:35:30.768Z"
translationModel: "gemini-3.8-flash"
---

## What Changed in 0.9.0

On October 27, 2026, Cor.Inc. released [0.9.0](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0) of the Grift CLI. As before, it does not output scores, rankings, or type names.

At the beginning of the Markdown for `grift actor`, `grift project`, and `grift align`, work approaches visible from the records are now described in short sentences. Descriptions cover the categories of modified areas, the pace of changes, the approach to testing, and the style of involvement—accompanied by counts and periods—followed by questions highlighting what cannot be seen from these records and what should be verified during an interview. The sentences are selected from numbers using a published [decision table](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/trait-profile.md). No AI is used, and they are not included in the JSON.

Sentences and questions regarding individuals are output only when an ID claimed by the person themselves is used and a record of consent exists. Otherwise, a single sentence stating the reason for not outputting them is displayed. The interview questions serve as material to make what to ask the candidate more concrete. They are not intended for deciding pass/fail outcomes or rankings.

The "strength" rows for tendencies and the "direction" rows for comparisons have been removed from the Markdown. This is because comparing two reports side by side could be read as "stronger vs. weaker people" or "suitable vs. unsuitable people." Additionally, we fixed four areas where numbers differing from the facts about individuals could appear. Details on what was fixed can be found in the [release notes](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.0).

## Before Updating

Because definition versions have changed, reports (`analyze`, `actor`, and `repo`) and comparisons saved in 0.8.0 will show as "cannot be verified (`CANNOT_VERIFY`)" in 0.9.0's `grift verify`. Project reports will show as "mismatch (`MISMATCH`)." Please regenerate them in 0.9.0. For details, see the [migration notes](https://github.com/Cor-Incorporated/grift-cli/blob/v0.9.0/docs/migration-v090.md).

```bash
pipx upgrade grift-cli
```

The philosophy behind Grift and its development background are summarized on the [Grift case study page](/works/grift).
