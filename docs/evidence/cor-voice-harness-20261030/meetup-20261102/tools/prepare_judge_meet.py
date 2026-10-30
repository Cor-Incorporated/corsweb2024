#!/usr/bin/env python3
"""Anonymize and shuffle the meetup drafts for the blind judge (mapping kept outside the judge dir)."""
import json
import random
import shutil
import sys
from pathlib import Path

EVAL = Path(sys.argv[1])
P = "M1-meetup"
random.seed(202611021)
judge = EVAL / "judge"
if judge.exists():
    shutil.rmtree(judge)
docs = [(r, h, EVAL / r / h / f"{P}.doc.md") for r in ("before", "after") for h in ("claude", "codex", "opencode")]
docs = [x for x in docs if x[2].exists()]
random.shuffle(docs)
out = judge / P
out.mkdir(parents=True)
shutil.copy(EVAL / "prompts" / f"{P}.txt", out / "REQUEST.txt")
shutil.copy(EVAL / "judge-rubric-meet.md", out / "RUBRIC.md")
shutil.copytree(EVAL / "materials", out / "materials")
mapping = {}
for i, (r, h, doc) in enumerate(docs, 1):
    shutil.copy(doc, out / f"D{i}.md")
    mapping[f"{P}/D{i}"] = {"round": r, "harness": h}
(EVAL / "judge-mapping-meet.json").write_text(json.dumps(mapping, ensure_ascii=False, indent=1))
print(len(list(out.glob("D*.md"))), "docs")
