#!/usr/bin/env python3
"""Score the grift-cli 0.9.2 doc drafts (P1 = cases page additions, P2 = griftai FAQ answer).

usage: score092.py <eval-dir> <skills-dir>
Uses the same final scorer (cor_voice_lint + yomiyasu_check from <skills-dir>) for before and after.
P2 is a rewrite of a known answer, so yomiyasu runs with --source (same document) and meaning_risk counts.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

EVAL, SKILLS = Path(sys.argv[1]), Path(sys.argv[2])
LINT = SKILLS / "cor-voice-gate/scripts/cor_voice_lint.py"
CHECK = SKILLS / "yomiyasu/scripts/yomiyasu_check.py"
FAQ_SOURCE = ("エンジニアの方は、Python 3.11以上の環境で pipx install grift-cli を実行し、リポジトリの中で grift report を実行してください。"
              "紹介会社さま・SES企業さま・自社開発企業さまは、AI受付からテスト導入をお申し込みください。\n")
RESULT_HEAD = "[0.9.2](https://github.com/Cor-Incorporated/grift-cli/releases/tag/v0.9.2)では、"


def extract(text):
    blocks = [b for b in re.findall(r"^<<<DOC[ \t]*\n(.*?)^DOC>>>[ \t]*$", text, re.S | re.M) if len(b.strip()) >= 60]
    return blocks[-1].strip() + "\n" if blocks else None


def find_doc(d, p):
    for name in (f"{p}.raw.last", f"{p}.raw", f"{p}.err"):
        f = d / name
        if f.exists():
            doc = extract(f.read_text(errors="replace"))
            if doc:
                return doc, name
    return None, None


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, timeout=300)


def task_misses(p, doc):
    miss = []
    if p == "P1-cases":
        parts = [x.strip() for x in re.split(r"^@@@\s*$", doc, flags=re.M)]
        if len(parts) != 2:
            miss.append(f"parts:{len(parts)}")
        elif not parts[1].startswith(RESULT_HEAD):
            miss.append("result_head")
        if re.search(r"20\d\d年\d+月\d+日[^。]{0,12}0\.9\.2|0\.9\.2[^。]{0,20}20\d\d年\d+月\d+日", doc):
            miss.append("publish_date")
    else:
        sentences = [s for s in re.split(r"(?<=。)", doc.strip()) if s.strip()]
        if not 3 <= len(sentences) <= 4:
            miss.append(f"sentences:{len(sentences)}")
        for keep in ("Python 3.11以上", "pipx install grift-cli", "grift report", "AI受付"):
            if keep not in doc:
                miss.append(f"lost:{keep}")
        if len(re.findall(r"docker (?:build|run)", doc)) > 1:
            miss.append("too_many_commands")
    return miss


def score(d, p):
    if not (d / f"{p}.rc").exists():
        return {"status": "not_run"}
    doc, src = find_doc(d, p)
    if doc is None:
        return {"status": "no_doc", "rc": (d / f"{p}.rc").read_text().strip()}
    doc_path = d / f"{p}.doc.md"
    doc_path.write_text(doc)
    lint = json.loads(run(["python3", "-I", "-B", str(LINT), "check", "--json", "--fail-on", "none", "--scene", "company", str(doc_path)]).stdout)[str(doc_path)]
    stats = json.loads(run(["python3", "-I", "-B", str(LINT), "stats", "--json", str(doc_path)]).stdout)[str(doc_path)]
    state = d / "ystate092"
    cmd = ["python3", "-I", "-B", str(CHECK), "run", "--final", str(doc_path), "--material", str(EVAL / "prompts" / f"{p}.txt"),
           "--doc-type", "article", "--fact-gaps", "--json", "--state-dir", str(state)]
    if p == "P2-faq":
        src_path = d / "P2-source.txt"
        src_path.write_text(FAQ_SOURCE)
        cmd[cmd.index("--material"):cmd.index("--material")] = ["--source", str(src_path)]
    y = json.loads(run(cmd).stdout)
    v = run(["python3", "-I", "-B", str(CHECK), "verify", "--final", str(doc_path), "--state-dir", str(state)])
    errors = [x["rule_id"] for x in lint if x["level"] == "error"]
    warns = [x["rule_id"] for x in lint if x["level"] == "warn"]
    unsupported = [r.get("new") for r in y.get("materials", {}).get("meaning_risks", []) if r.get("kind") == "unsupported"]
    return {
        "status": "scored", "doc_from": src, "chars": stats["chars"], "sentence_len_mean": stats["sentence_len_mean"],
        "cor_errors": errors, "cor_warns": warns, "meaning_risk": y.get("meaning_risk_count"),
        "diff_meaning_risk": (y.get("diff") or {}).get("meaning_risk_count"), "unsupported": unsupported,
        "fact_gaps": y.get("fact_gaps", {}).get("count", 0), "yomiyasu_lint": y["lint"]["candidate_count"],
        "verify_rc": v.returncode, "task_misses": task_misses(p, doc),
    }


out = {}
for rnd in ("before", "after"):
    for h in ("claude", "codex", "opencode"):
        for p in ("P1-cases", "P2-faq"):
            out[f"{rnd}/{h}/{p}"] = score(EVAL / rnd / h, p)
(EVAL / "scores092.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
for k, v in out.items():
    if v["status"] != "scored":
        print(k, v["status"])
        continue
    print(f"{k:24} cor_err={v['cor_errors']} warn={len(v['cor_warns'])} mr={v['meaning_risk']}(diff {v['diff_meaning_risk']}) unsup={len(v['unsupported'])} gaps={v['fact_gaps']} task={v['task_misses']} len={v['sentence_len_mean']} verify={v['verify_rc']}")
