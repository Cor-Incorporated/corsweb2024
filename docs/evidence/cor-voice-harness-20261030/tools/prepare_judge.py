#!/usr/bin/env python3
"""Collect scored documents from both rounds, anonymize and shuffle them per prompt for the blind judge.

usage: prepare_judge.py <eval-dir>
writes <eval-dir>/judge/<prompt>/D<n>.md and <eval-dir>/judge-mapping.json (kept outside the judge dir)
"""
import json
import random
import shutil
import sys
from pathlib import Path

EVAL = Path(sys.argv[1])
PROMPTS = ["A-article", "B-mail", "C-manual"]
random.seed(20261030)
judge = EVAL / "judge"
if judge.exists():
    shutil.rmtree(judge)
mapping = {}
for p in PROMPTS:
    docs = []
    for rnd in ("before", "after"):
        for h in ("claude", "codex", "cursor", "opencode", "pi", "dsh", "grok"):
            doc = EVAL / rnd / h / f"{p}.doc.md"
            if doc.exists():
                docs.append((rnd, h, doc))
    random.shuffle(docs)
    out = judge / p
    out.mkdir(parents=True)
    shutil.copy(EVAL / "prompts" / f"{p}.txt", out / "REQUEST.txt")
    for i, (rnd, h, doc) in enumerate(docs, 1):
        shutil.copy(doc, out / f"D{i}.md")
        mapping[f"{p}/D{i}"] = {"round": rnd, "harness": h}
(EVAL / "judge-mapping.json").write_text(json.dumps(mapping, ensure_ascii=False, indent=1))
print({p: len(list((judge / p).glob("D*.md"))) for p in PROMPTS})
