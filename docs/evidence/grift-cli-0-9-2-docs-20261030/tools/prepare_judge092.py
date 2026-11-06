#!/usr/bin/env python3
"""Anonymize and shuffle the 0.9.2 drafts per prompt for the blind judge (mapping kept outside the judge dir)."""
import json
import random
import shutil
import sys
from pathlib import Path

EVAL = Path(sys.argv[1])
random.seed(202610302)
judge = EVAL / "judge"
if judge.exists():
    shutil.rmtree(judge)
mapping = {}
for p in ("P1-cases", "P2-faq"):
    docs = [(r, h, EVAL / r / h / f"{p}.doc.md") for r in ("before", "after") for h in ("claude", "codex", "opencode")]
    docs = [x for x in docs if x[2].exists()]
    random.shuffle(docs)
    out = judge / p
    out.mkdir(parents=True)
    shutil.copy(EVAL / "prompts" / f"{p}.txt", out / "REQUEST.txt")
    shutil.copy(EVAL / "judge-rubric092.md", out / "RUBRIC.md")
    for i, (r, h, doc) in enumerate(docs, 1):
        shutil.copy(doc, out / f"D{i}.md")
        mapping[f"{p}/D{i}"] = {"round": r, "harness": h}
(EVAL / "judge-mapping092.json").write_text(json.dumps(mapping, ensure_ascii=False, indent=1))
print({p: len(list((judge / p).glob("D*.md"))) for p in ("P1-cases", "P2-faq")})
