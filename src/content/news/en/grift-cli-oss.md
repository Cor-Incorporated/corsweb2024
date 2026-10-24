---
title: "Released \"Grift CLI\" as OSS to Extract Verifiable Facts from Git History"
description: "We have released \"Grift CLI,\" a command-line tool for our product Grift, as open-source software under the MIT License on PyPI and GitHub. It does not score or rank, and it produces the same results regardless of who runs it."
publishedAt: 2026-10-20
category: "update"
tags: ["Grift", "OSS", "Product"]
source: "Grift"
isDraft: false
featured: true
lang: "en"
translationSourceHash: "ca3bd16b31d7cfb3ef5a887e1a418c09148f54c78921c9a44becf0375c495c1b"
translatedAt: "2026-10-23T06:31:29.929Z"
translationModel: "gemini-3.8-flash"
---

## Release of Grift CLI

Cor.Inc. has released Grift CLI, the command-line tool for its proprietary product "Grift," as open-source software under the MIT License. On September 8, 2026, we released v0.7.2 on PyPI.

Grift CLI is a tool that extracts "verifiable facts (test values)" from an engineer's Git history. Its tagline is: "You can inflate your resume. You can't inflate evidence."

## Three Promises

- No scoring: We do not generate composite scores, rankings, or pass/fail results. Numerical values always include a numerator and denominator.
- Identical results every time: Because we do not use AI (LLMs) for measurement, the exact same numbers are produced regardless of who runs it, as long as the repository and version are identical. Saved reports can be recalculated and verified using `grift verify`.
- Nothing is sent anywhere: It runs entirely on your local PC. Deciding whether or not to share the results is entirely up to the individual.

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

## Change of Direction

Grift began in February 2026 as a web application supporting estimates for contract development. In August 2026, we separated the measurement component into a CLI, and in September, we discontinued the legacy web application. Plans previously announced, such as Team Beta, were withdrawn in October 2026.

Currently, we are accepting inquiries for pilot implementations (PoCs) designed to help recruiters and sales representatives at staffing/SES firms communicate the reasons behind their recommendations backed by evidence. For more details, please visit the [Grift Case Studies page](/works/grift).
