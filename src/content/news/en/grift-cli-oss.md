---
title: "We Have Released \"Grift CLI\" as OSS to Extract Verifiable Facts from Git History"
description: "We have released \"Grift CLI,\" the command-line tool for our in-house product Grift, as MIT-licensed OSS on PyPI and GitHub. It does not assign scores or rankings, producing the same results regardless of who runs it."
publishedAt: 2026-10-20
category: "update"
tags: ["Grift", "OSS", "Product"]
source: "Grift"
isDraft: false
featured: true
lang: "en"
translationSourceHash: "ed5a3adbdd57154b1cbb7ab4f8318fb3e0b08de7c0d8a8e3a1084e6b7179df2e"
translatedAt: "2026-10-26T13:33:26.518Z"
translationModel: "gemini-3.8-flash"
---

## Release of Grift CLI

Cor.Inc. has released Grift CLI, the command-line tool for its proprietary product Grift, as open-source software under the MIT license. On September 8, 2026, we released v0.7.2 on PyPI.

Grift CLI is a tool that extracts "verifiable facts (observed values)" from an engineer's Git history. Its tagline is: "Resumes can be embellished. Evidence cannot."

## Our Three Promises

- No scoring: We do not generate composite scores, rankings, or pass/fail determinations. Numbers always include a numerator and a denominator.
- Identical results every time: Because we do not use AI (LLMs) for measurement, running it on the same repository with the same version will produce identical numbers regardless of who executes it. Saved reports can be verified by recalculating them with `grift verify`.
- Data never leaves your machine: It runs entirely on your local PC. Deciding whether or not to share it is entirely up to the individual.

## How to Use

In an environment running Python 3.11 or higher, you can get started with the following command:

```bash
pipx install grift-cli
cd your-repo
grift report
grift verify
```

- GitHub: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- PyPI: [pypi.org/project/grift-cli](https://pypi.org/project/grift-cli/)

## Changes in Direction

Grift started in February 2026 as a web application supporting contract development estimates. In August 2026, we spun out the measurement functionality as a CLI, and in September, we discontinued the previous web application. Plans previously announced, such as Team Beta, were withdrawn in October 2026.

Currently, we are accepting inquiries for pilot implementations (PoCs) to help staffing agency and SES sales representatives convey recommendation rationales backed by evidence, as well as to help recruiters at in-house development companies verify what kind of work candidates have done using records shared by the candidates themselves. For more details, please visit the [Grift Case Studies page](/works/grift).
