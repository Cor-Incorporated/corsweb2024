#!/usr/bin/env python3
"""Score harness outputs: extract the document, run cor_voice_lint + yomiyasu_check, compare with exemplar bands.

usage: score.py <eval-dir> <round> <skills-dir>
writes <eval-dir>/<round>/scores.json and prints a markdown table.
Penalty points (lower is better). Semantic Review is added later from the blind judge (judge-<round>.json).
"""

import json
import re
import subprocess
import sys
from pathlib import Path

EVAL, ROUND, SKILLS = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3])
HARNESSES = ["claude", "codex", "cursor", "opencode", "pi", "dsh", "grok"]
PROMPTS = {
    "A-article": ("tech", "article"),
    "B-mail": ("founder", "mail"),
    "C-manual": ("company", "manual"),
}
# exemplar bands (scratchpad/exemplars/stats.json, 4 本の最小〜最大)
BAND = {
    "sentence_len_mean": (17.8, 27.2),
    "commas_per_sentence": (0.6, 1.0),
    "paragraph_sentences_mean": (0.0, 2.5),
    "ascii_space_ratio": (0.0, 0.18),
    "lint_per_1000": (0.0, 6.0),
}
STEP = {
    "sentence_len_mean": 3.0,
    "commas_per_sentence": 0.2,
    "paragraph_sentences_mean": 0.5,
    "ascii_space_ratio": 0.2,
    "lint_per_1000": 2.0,
}
LINT = SKILLS / "cor-voice-gate/scripts/cor_voice_lint.py"
CHECK = SKILLS / "yomiyasu/scripts/yomiyasu_check.py"


def extract(raw: str) -> str | None:
    """300 字以上ある最後の DOC 区画（「前回の <<<DOC ... DOC>>> のまま」のような言及を本文と取り違えない）。"""
    blocks = [b for b in re.findall(r"^<<<DOC[ \t]*\n(.*?)^DOC>>>[ \t]*$", raw, re.S | re.M) if len(b.strip()) >= 300]
    return blocks[-1].strip() + "\n" if blocks else None


def readback_file(repo: Path, text: str) -> Path | None:
    """最後の返答の Readback 行が指す、repo の中の .md／.txt（H17 の契約で、最後に書いた本文のハッシュを示す行）。"""
    paths = re.findall(r"Readback:\s*`?([^\s`]+\.(?:md|txt))`?\s+sha256=", text)
    for rel in reversed(paths):
        f = (repo / rel).resolve()
        if f.is_file() and repo.resolve() in f.parents:
            return f
    return None


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, timeout=300)


def band_penalty(name, value):
    lo, hi = BAND[name]
    gap = max(0.0, lo - value, value - hi)
    return round(gap / STEP[name], 1)


UNIT_NUM = re.compile(r"(?<![\d.])(\d+(?:[.,]\d+)*)\s*(年|か月|ヶ月|月|日|分|秒|時間|件|円|万|%|％|人|社|倍|回|週|字|行|割)")


def _material_tokens(material):
    """資料の文字列に、ISO 形式の日付を「2026年10月28日」「10月28日」の形でも足したもの。"""
    extra = []
    for y, m, d in re.findall(r"(\d{4})-(\d{2})-(\d{2})", material):
        extra += [f"{y}年{int(m)}月{int(d)}日", f"{int(m)}月{int(d)}日", f"{y}年", f"{int(m)}月", f"{int(d)}日"]
    return re.sub(r"\s", "", material).replace(",", "") + "|" + "|".join(extra)


def unit_numbers_not_in_material(doc, material):
    """数字＋単位の組で、資料に無いもの。コード、URL、表、番号つきの項目の番号、0 と 1 の言い回しは除く。"""
    body = re.sub(r"\A---\n.*?\n---\n", "", doc, flags=re.S)
    body = re.sub(r"```.*?```", "", body, flags=re.S)
    body = re.sub(r"`[^`]*`|https?://\S+", "", body)
    body = re.sub(r"(?m)^\s*\d+\.\s", "", body)
    mat = _material_tokens(material)
    missing = []
    for m in UNIT_NUM.finditer(body):
        num = m.group(1).replace(",", "")
        if num in ("0", "1"):
            continue
        if num + m.group(2) not in mat:
            missing.append(m.group(0))
    return missing


def task_checks(prompt, doc, chars):
    miss = []
    if prompt == "A-article":
        fm = re.match(r"\A---\n(.*?)\n---\n", doc, re.S)
        keys = set(re.findall(r"^(\w+):", fm.group(1), re.M)) if fm else set()
        miss += [
            f"frontmatter:{k}"
            for k in [
                "title",
                "description",
                "summary",
                "pubDate",
                "category",
                "tags",
                "author",
                "lang",
            ]
            if k not in keys
        ]
        if not re.search(r"^## 参考資料\s*$", doc, re.M):
            miss.append("参考資料")
        body = re.sub(r"\A---\n.*?\n---\n", "", doc, flags=re.S)
        chars = len(re.sub(r"\s", "", body))
        if not 2000 <= chars <= 3000:
            miss.append(f"length:{chars}")
    elif prompt == "B-mail":
        if not re.search(r"件名", doc):
            miss.append("subject")
        if not re.search(r"Cor\.株式会社\s*代表取締役\s*寺田\s?康佑", doc):
            miss.append("signature")
        if re.search(r"[\w.+-]+@[\w-]+\.\w+|\d{2,4}-\d{2,4}-\d{3,4}", doc):
            miss.append("contact_leak")
        if re.search(r"\d[\d,]*\s*(万円|円)", doc):
            miss.append("price")
    else:
        if not re.search(r"^#\s", doc, re.M):
            miss.append("title")
        if not re.search(r"^\s*1\.\s", doc, re.M):
            miss.append("numbered_steps")
    return miss


def score_one(h, p):
    d = EVAL / ROUND / h
    raw_path = d / f"{p}.raw"
    if not raw_path.exists():
        return {"status": "not_run"}
    if not (d / f"{p}.rc").exists():
        return {"status": "running"}
    doc, doc_from = None, None
    # 最後の返答（-o）→ 標準出力 → 標準エラーの記録（H17 の Stop フックが最後の返答を Evidence 行に置き換えた場合）の順に探す
    final = "".join((d / n).read_text(errors="replace") for n in (f"{p}.raw.last", f"{p}.raw") if (d / n).exists())
    rb = readback_file(d / "repo", final)
    if rb is not None:
        doc, doc_from = rb.read_text(errors="replace"), f"readback:{rb.relative_to((d / 'repo').resolve())}"
    for name in (f"{p}.raw.last", f"{p}.raw", f"{p}.err"):
        if (d / name).exists() and doc is None:
            doc = extract((d / name).read_text(errors="replace"))
            doc_from = name if doc else None
    if doc is None:
        return {
            "status": "no_doc",
            "rc": (d / f"{p}.rc").read_text().strip(),
            "total": 50.0,
        }
    doc_path = d / f"{p}.doc.md"
    doc_path.write_text(doc)
    scene, doc_type = PROMPTS[p]
    lint = json.loads(
        run(
            [
                "python3",
                "-I",
                str(LINT),
                "check",
                "--json",
                "--fail-on",
                "none",
                "--scene",
                scene,
                str(doc_path),
            ]
        ).stdout
    )[str(doc_path)]
    stats = json.loads(
        run(["python3", "-I", str(LINT), "stats", "--json", str(doc_path)]).stdout
    )[str(doc_path)]
    state = EVAL / ROUND / "ystate" / h
    y = json.loads(
        run(
            [
                "python3",
                "-I",
                str(CHECK),
                "run",
                "--material",
                str(EVAL / "prompts" / f"{p}.txt"),
                "--final",
                str(doc_path),
                "--doc-type",
                doc_type,
                "--fact-gaps",
                "--json",
                "--state-dir",
                str(state),
            ]
        ).stdout
    )
    v = run(
        [
            "python3",
            "-I",
            str(CHECK),
            "verify",
            "--final",
            str(doc_path),
            "--state-dir",
            str(state),
        ]
    )
    unsupported = [
        r
        for r in y.get("materials", {}).get("meaning_risks", [])
        if r.get("kind") == "unsupported"
    ]
    nums = [r["new"] for r in unsupported if r.get("subkind") == "number"]
    names = [r["new"] for r in unsupported if r.get("subkind") != "number"]
    lc = y["lint"]["counts"]
    lint_n = lc["error"] + lc["warn"] + lc["info"]
    lint_per_1000 = round(lint_n / max(y["lint"]["metrics"]["char_count"], 1) * 1000, 1)
    # 文と段落の長さは style の幅で数えるので、二重に数えない
    lint = [x for x in lint if x["rule_id"] not in ("long_sentences", "long_paragraphs")]
    errors = sum(x["level"] == "error" for x in lint)
    warns = len(lint) - errors
    style = {
        k: band_penalty(k, stats[k])
        for k in [
            "sentence_len_mean",
            "commas_per_sentence",
            "paragraph_sentences_mean",
            "ascii_space_ratio",
        ]
    }
    style["lint_per_1000"] = band_penalty("lint_per_1000", lint_per_1000)
    task = task_checks(p, doc, stats["chars"])
    p_cor = 3 * errors + warns
    added = unit_numbers_not_in_material(doc, (EVAL / "prompts" / f"{p}.txt").read_text())
    p_fact = 2 * len(added) + y.get("fact_gaps", {}).get("count", 0)
    p_style = round(sum(style.values()), 1)
    p_task = len(task)
    return {
        "status": "scored",
        "doc_from": doc_from,
        "rc": (d / f"{p}.rc").read_text().strip(),
        "secs": (d / f"{p}.secs").read_text().strip(),
        "cor_lint": [f"{x['rule_id']}@L{x['line']}" for x in lint],
        "cor_errors": errors,
        "cor_warns": warns,
        "added_unit_numbers": added, "unsupported_numbers": nums,
        "unsupported_names": names,
        "fact_gaps": y.get("fact_gaps", {}).get("count", 0),
        "yomiyasu_lint": lint_n,
        "lint_per_1000": lint_per_1000,
        "meaning_risk_count": y.get("meaning_risk_count"),
        "verify_rc": v.returncode,
        "stats": stats,
        "style_penalty": style,
        "task_missing": task,
        "p_cor": p_cor,
        "p_fact": p_fact,
        "p_style": p_style,
        "p_task": p_task,
        "total": round(p_cor + p_fact + p_style + p_task, 1),
    }


def main():
    out = {h: {p: score_one(h, p) for p in PROMPTS} for h in HARNESSES}
    (EVAL / ROUND / "scores.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=1)
    )
    print(f"| {ROUND} | " + " | ".join(PROMPTS) + " | 合計 |")
    print("|---|" + "---|" * (len(PROMPTS) + 1))
    for h, row in out.items():
        cells, total = [], 0.0
        for p in PROMPTS:
            s = row[p]
            if s["status"] == "scored":
                cells.append(
                    f"{s['total']}（cor {s['p_cor']}／事実 {s['p_fact']}／文体 {s['p_style']}／依頼 {s['p_task']}）"
                )
                total += s["total"]
            else:
                cells.append(s["status"])
        print(
            f"| {h} | "
            + " | ".join(cells)
            + f" | {round(total, 1) if any(row[p]['status'] == 'scored' for p in PROMPTS) else '-'} |"
        )


if __name__ == "__main__":
    main()
