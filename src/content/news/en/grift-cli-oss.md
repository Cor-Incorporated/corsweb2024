---
title: "We Have Released \"Grift CLI\" as OSS to Extract Verifiable Facts from Git History"
description: "We have released \"Grift CLI,\" the command-line tool for our in-house product Grift, as MIT-licensed OSS on PyPI and GitHub. It does not assign scores or rankings, delivering the exact same results regardless of who runs it."
publishedAt: 2026-10-20
category: "update"
tags: ["Grift", "OSS", "Product"]
source: "Grift"
isDraft: false
featured: true
lang: "en"
translationSourceHash: "ae934df96e7ad3b3adfddc1c170e85b9b6e9fa738a4cc0c325d8d629673f73fc"
translatedAt: "2026-10-20T03:23:57.610Z"
translationModel: "gemini-3.8-flash"
---

## Grift CLI Is Available

Cor.Inc. provides "Grift CLI," the command-line tool for our proprietary product "Grift," as open-source software under the MIT License. On September 8, 2026, we released v0.7.2 on PyPI.

Grift CLI is a tool that extracts "verifiable facts (test values)" from an engineer's git history. Its tagline is: "Resumes can be embellished. Evidence cannot."

## Three Commitments

- **No scoring**: We do not generate composite scores, rankings, or pass/fail decisions. Numerical values always include both a numerator and a denominator.
- **Identical results every time**: Because we do not use AI (LLMs) for measurement, running the tool on the same repository at the same revision will yield the exact same figures, regardless of who runs it. Saved reports can be recalculated and verified with `grift verify`.
- **Data stays on your machine**: The tool runs entirely on your local PC. Whether to share the results is up to the individual.

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

Grift began in February 2026 as a web application supporting contract development estimates. In August 2026, we decoupled the measurement component into a CLI, and ended the provision of the legacy web application in September. Plans previously announced, such as the Team Beta, were withdrawn in October 2026.

Currently, we are accepting inquiries for pilot implementations (PoCs) designed to help recruiters and SES sales representatives convey recommendations backed by verifiable evidence. For more details, please visit the [Grift Case Studies page](/works/grift).
