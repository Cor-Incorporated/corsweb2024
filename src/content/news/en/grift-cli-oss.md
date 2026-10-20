---
title: "Releasing \"Grift CLI\" as OSS to Extract Verifiable Facts from Git History"
description: "We have released \"Grift CLI,\" the command-line tool for our proprietary product Grift, on PyPI and GitHub as MIT-licensed OSS. It does not assign scores or rankings, yielding identical results no matter who runs it."
publishedAt: 2026-10-20
category: "update"
tags: ["Grift", "OSS", "Products"]
source: "Grift"
isDraft: false
featured: true
lang: "en"
translationSourceHash: "881ec4903ce970a25ca72acd37f1fa6db515a1cfc8d1278eb12d20837ed7de41"
translatedAt: "2026-10-20T01:57:03.375Z"
translationModel: "gemini-3.8-flash"
---

## Grift CLI is Now Available

Cor.Inc. has released "Grift CLI," the command-line tool for its proprietary product "Grift," as open-source software under the MIT License. On September 8, 2026, we released v0.7.2 on PyPI.

Grift CLI is a tool that extracts "verifiable facts (test values)" from an engineer's git history. Its tagline is: "Resumes can be embellished. Evidence cannot."

## Our Three Promises

- **No scoring**: We do not generate composite scores, rankings, or pass/fail judgments. Numbers always include both a numerator and a denominator.
- **Identical results every time**: Because it does not use AI (LLMs) for measurement, it yields the exact same numbers regardless of who runs it, as long as it is the same repository and the same version. Saved reports can be recalculated and verified with `grift verify`.
- **Sent nowhere**: It runs entirely on your local PC. Deciding whether or not to share it is entirely up to the individual.

## How to Use

In an environment with Python 3.11 or higher, you can get started with the following command:

```bash
pipx install grift-cli
cd your-repo
grift report
grift verify
```

- GitHub: [github.com/Cor-Incorporated/grift-cli](https://github.com/Cor-Incorporated/grift-cli)
- PyPI: [pypi.org/project/grift-cli](https://pypi.org/project/grift-cli/)

## Regarding Changes in Direction

Grift started in February 2026 as a web application supporting contract development estimates. In August 2026, the measurement component was separated out as a CLI, and the previous web application was discontinued in September. Plans previously announced, such as Team Beta, were withdrawn in October 2026.

Currently, we are accepting inquiries for proof-of-concept (PoC) trials aimed at recruitment agencies and SES sales professionals to communicate the rationale behind recommendations backed by evidence. For details, please visit the [Grift case studies page](/works/grift).
