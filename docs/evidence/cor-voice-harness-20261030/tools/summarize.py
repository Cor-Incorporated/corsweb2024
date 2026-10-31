#!/usr/bin/env python3
"""Merge mechanical scores (scores.json per round) with the blind judge results into one before/after table.

usage: summarize.py <eval-dir>
reads  <eval-dir>/{before,after}/scores.json, <eval-dir>/judge-mapping.json, <eval-dir>/judge-<prompt>.json
writes <eval-dir>/summary.json and prints markdown tables
Penalty (lower is better):
  mechanical = cor-lint (error x3 + warn) + added unit numbers x2 + yomiyasu fact gaps + style band + request misses (mechanical)
  judge      = fact additions x2 + request misses + semantic fails x2 + (5 - voice) x2 + ai smell x0.5
"""

import json
import sys
from pathlib import Path

EVAL = Path(sys.argv[1])
PROMPTS = ["A-article", "B-mail", "C-manual"]
HARNESSES = ["claude", "codex", "cursor", "opencode", "pi", "dsh", "grok"]
ROUNDS = ["before", "after"]

mapping = json.loads((EVAL / "judge-mapping.json").read_text())
judge = {}
for p in PROMPTS:
    path = EVAL / f"judge-{p}.json"
    if path.exists():
        for item in json.loads(path.read_text()):
            key = f"{p}/{item['id']}"
            m = mapping[key]
            judge[(m["round"], m["harness"], p)] = item


def judge_penalty(j):
    return round(
        2 * len(j["fact_additions"])
        + len(j["request_misses"])
        + 2 * len(j["semantic_fails"])
        + 2 * (5 - j["voice_score"])
        + 0.5 * len(j["ai_smell"]),
        1,
    )


summary = {}
for rnd in ROUNDS:
    scores = json.loads((EVAL / rnd / "scores.json").read_text())
    for h in HARNESSES:
        for p in PROMPTS:
            s = scores[h][p]
            if s.get("status") != "scored":
                summary[f"{rnd}/{h}/{p}"] = {"status": s.get("status")}
                continue
            j = judge.get((rnd, h, p))
            row = {
                "status": "scored",
                "mechanical": s["total"],
                "p_cor": s["p_cor"],
                "p_fact": s["p_fact"],
                "p_style": s["p_style"],
                "p_task": s["p_task"],
                "sentence_len_mean": s["stats"]["sentence_len_mean"],
                "cor_lint": s["cor_lint"],
            }
            if j:
                row.update(
                    {
                        "judge": judge_penalty(j),
                        "voice": j["voice_score"],
                        "rank": j["rank"],
                        "fact_additions": len(j["fact_additions"]),
                        "semantic_fails": [f["item"] for f in j["semantic_fails"]],
                        "request_misses_judge": len(j["request_misses"]),
                        "ai_smell": len(j["ai_smell"]),
                    }
                )
                row["total"] = round(row["mechanical"] + row["judge"], 1)
            summary[f"{rnd}/{h}/{p}"] = row
(EVAL / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=1))


def cell(rnd, h, p, key="total"):
    r = summary.get(f"{rnd}/{h}/{p}", {})
    return (
        r.get(key, r.get("status", "-"))
        if r.get("status") == "scored"
        else (r.get("status") or "-")
    )


print(
    "| ハーネス | 依頼 | before 減点（機械＋採点） | after 減点 | before 本人らしさ | after 本人らしさ | before 文長 | after 文長 |"
)
print("|---|---|---|---|---|---|---|---|")
for h in HARNESSES:
    for p in PROMPTS:
        b, a = summary.get(f"before/{h}/{p}", {}), summary.get(f"after/{h}/{p}", {})
        if b.get("status") != "scored" and a.get("status") != "scored":
            continue
        print(
            f"| {h} | {p} | {cell('before', h, p)} | {cell('after', h, p)} | {cell('before', h, p, 'voice')} | {cell('after', h, p, 'voice')} | "
            f"{cell('before', h, p, 'sentence_len_mean')} | {cell('after', h, p, 'sentence_len_mean')} |"
        )
print()
print("| ハーネス | before 合計（揃った依頼） | after 合計（同じ依頼） | 差 | 判定 |")
print("|---|---|---|---|---|")
for h in HARNESSES:
    both = [
        p
        for p in PROMPTS
        if summary.get(f"before/{h}/{p}", {}).get("total") is not None
        and summary.get(f"after/{h}/{p}", {}).get("total") is not None
    ]
    if not both:
        print(f"| {h} | - | - | - | 未検証 |")
        continue
    b = round(sum(summary[f"before/{h}/{p}"]["total"] for p in both), 1)
    a = round(sum(summary[f"after/{h}/{p}"]["total"] for p in both), 1)
    verdict = (
        "after が上回る（減点が少ない）"
        if a < b
        else ("同じ" if a == b else "after が下回る")
    )
    print(f"| {h} | {b}（{', '.join(both)}） | {a} | {round(a - b, 1)} | {verdict} |")
