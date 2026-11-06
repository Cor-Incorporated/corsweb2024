#!/usr/bin/env python3
"""Score the meetup LT drafts (M1 = LT script @@@ slide outline @@@ A4 handout).

usage: scoremeet.py <eval-dir> <skills-dir>
Uses the same final scorer (cor_voice_lint + yomiyasu_check from <skills-dir>) for before and after.
Each of the 3 parts is scored on its own: the script and the slides as the founder's voice, the handout as tech.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

EVAL, SKILLS = Path(sys.argv[1]), Path(sys.argv[2])
LINT = SKILLS / "cor-voice-gate/scripts/cor_voice_lint.py"
CHECK = SKILLS / "yomiyasu/scripts/yomiyasu_check.py"
P = "M1-meetup"
PARTS = (("script", "founder"), ("slides", "founder"), ("handout", "tech"))
MATERIALS = [EVAL / "prompts" / f"{P}.txt"] + sorted((EVAL / "materials").glob("*.md"))
ALLOWED_URLS = {"https://cor-jp.com/", "https://cor-jp.com/about/", "https://cor-jp.com/company/", "https://cor-jp.com/blog/"}
# 書いてはいけない会社名・ホスト名の正規表現は、公開リポジトリに名前を残さないため、評価フォルダの
# forbidden-names.txt（コミットしない）から読む
NAMES = re.compile((EVAL / "forbidden-names.txt").read_text().strip())


def extract(text):
    blocks = [b for b in re.findall(r"^<<<DOC[ \t]*\n(.*?)^DOC>>>[ \t]*$", text, re.S | re.M) if len(b.strip()) >= 200]
    return blocks[-1].strip() + "\n" if blocks else None


def find_doc(d):
    for name in (f"{P}.raw.last", f"{P}.raw", f"{P}.err"):
        f = d / name
        if f.exists():
            doc = extract(f.read_text(errors="replace"))
            if doc:
                return doc, name
    return None, None


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, timeout=300)


def body_chars(text):
    return len(re.sub(r"\s", "", text))


def task_misses(parts, doc):
    miss = []
    if len(parts) != 3:
        return [f"parts:{len(parts)}"]
    n = body_chars(parts[0])
    if not 1200 <= n <= 1400:
        miss.append(f"script_chars:{n}")
    slides = len([ln for ln in parts[1].splitlines()
                  if re.match(r"^\s*(?:#+\s*|\|\s*)?(?:スライド\s*)?\d+\s*(?:枚目)?\s*[.．、:：)）|]", ln) and "構成案" not in ln])
    if not 5 <= slides <= 6:
        miss.append(f"slides:{slides}")
    for url in re.findall(r"https?://[^\s)）（(」>|]+", doc):
        if url.rstrip("。、") not in ALLOWED_URLS:
            miss.append(f"url:{url}")
    for name in sorted(set(NAMES.findall(doc))):
        miss.append(f"name:{name}")
    if re.search(r"QR", parts[2]) and not re.search(r"QR[^。\n]{0,12}(?:なし|無し|使わ|ありません)", parts[2]):
        miss.append("qr")
    return miss


def score_part(d, key, scene, text):
    path = d / f"{P}.{key}.md"
    path.write_text(text)
    lint = json.loads(run(["python3", "-I", "-B", str(LINT), "check", "--json", "--fail-on", "none", "--scene", scene, str(path)]).stdout)[str(path)]
    stats = json.loads(run(["python3", "-I", "-B", str(LINT), "stats", "--json", str(path)]).stdout)[str(path)]
    state = d / f"ystate-{key}"
    cmd = ["python3", "-I", "-B", str(CHECK), "run", "--final", str(path)]
    for m in MATERIALS:
        cmd += ["--material", str(m)]
    cmd += ["--doc-type", "article", "--fact-gaps", "--json", "--state-dir", str(state)]
    y = json.loads(run(cmd).stdout)
    v = run(["python3", "-I", "-B", str(CHECK), "verify", "--final", str(path), "--state-dir", str(state)])
    unsupported = [r.get("new") for r in y.get("materials", {}).get("meaning_risks", []) if r.get("kind") == "unsupported"]
    return {
        "chars": body_chars(text), "sentence_len_mean": stats["sentence_len_mean"],
        "cor_errors": [x["rule_id"] for x in lint if x["level"] == "error"],
        "cor_warns": [x["rule_id"] for x in lint if x["level"] == "warn"],
        "meaning_risk": y.get("meaning_risk_count"), "unsupported": unsupported,
        "fact_gaps": y.get("fact_gaps", {}).get("count", 0), "yomiyasu_lint": y["lint"]["candidate_count"],
        "verify_rc": v.returncode,
    }


def score(d):
    if not (d / f"{P}.rc").exists():
        return {"status": "not_run"}
    doc, src = find_doc(d)
    if doc is None:
        return {"status": "no_doc", "rc": (d / f"{P}.rc").read_text().strip()}
    (d / f"{P}.doc.md").write_text(doc)
    parts = [x.strip() + "\n" for x in re.split(r"^@@@\s*$", doc, flags=re.M)]
    result = {"status": "scored", "doc_from": src, "task_misses": task_misses(parts, doc)}
    if len(parts) == 3:
        for (key, scene), text in zip(PARTS, parts):
            result[key] = score_part(d, key, scene, text)
    return result


if len(sys.argv) > 3 and sys.argv[3] == "--tasks-only":
    out = json.loads((EVAL / "scoresmeet.json").read_text())
    for k, v in out.items():
        if v.get("status") == "scored":
            doc = (EVAL / k / f"{P}.doc.md").read_text()
            v["task_misses"] = task_misses([x.strip() + "\n" for x in re.split(r"^@@@\s*$", doc, flags=re.M)], doc)
else:
    out = {f"{r}/{h}": score(EVAL / r / h) for r in ("before", "after") for h in ("claude", "codex", "opencode")}
(EVAL / "scoresmeet.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
for k, v in out.items():
    if v["status"] != "scored":
        print(k, v)
        continue
    line = [f"{k:16} task={v['task_misses']}"]
    for key, _ in PARTS:
        if key in v:
            s = v[key]
            line.append(f"{key}: err={s['cor_errors']} warn={len(s['cor_warns'])} mr={s['meaning_risk']} unsup={len(s['unsupported'])} gaps={s['fact_gaps']} len={s['sentence_len_mean']} chars={s['chars']} verify={s['verify_rc']}")
    print("\n  ".join(line))
