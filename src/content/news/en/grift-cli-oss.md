---
title: "We Have Released \"Grift CLI\" as OSS to Extract Verifiable Facts from Git History"
description: "\"Grift CLI\", the command-line tool for our proprietary product Grift, is available on PyPI and GitHub as open-source software under the MIT License. It does not assign scores or rankings, delivering the exact same results no matter who runs it."
publishedAt: 2026-10-20
category: "update"
tags: ["Grift", "OSS", "Product"]
source: "Grift"
isDraft: false
featured: true
lang: "en"
translationSourceHash: "4222aeac7141923a5addb79b67f78e0daa2a303ad46dc6ddf790958ef9196a28"
translatedAt: "2026-10-26T08:02:21.803Z"
translationModel: "gemini-3.8-flash"
---

## Release of Grift CLI

Cor.Inc. has released Grift CLI, a command-line tool for our proprietary product Grift, as open-source software under the MIT License. On September 8, 2026, we released v0.7.2 on PyPI.

Grift CLI is a tool that extracts "verifiable facts (inspected values)" from an engineer's Git history. Its tagline is: "Resumes can be embellished. Evidence cannot."

## Three Promises

- No scoring: We do not generate composite scores, rankings, or pass/fail decisions. Numbers are always provided with a numerator and a denominator.
- Identical results every time: Because we do not use AI (LLMs) for measurement, the numbers will be identical regardless of who runs it, as long as it is the same repository and the same version. Saved reports can be recalculated and verified with `grift verify`.
- Sent nowhere: It runs entirely on your local machine. Whether to share it is entirely up to the user.

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

Grift began in February 2026 as a web application supporting estimates for contract development. In August 2026, we separated the measurement component into a CLI, and in September, we discontinued the legacy web application. Plans such as Team Beta, which we had previously announced, were withdrawn in October 2026.

Currently, we are accepting inquiries for pilot implementations (PoC)—both for recruitment agencies and SES sales representatives looking to present reasons for recommendations backed by concrete evidence, and for recruiters at product companies seeking to verify what kind of work candidates have done based on records shared by the candidates themselves. For details, please see the [Grift Case Studies page](/works/grift).
