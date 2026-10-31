#!/usr/bin/env python3
"""Time the LT script by reading it aloud with the macOS Japanese voice (say -v Kyoko).

usage: lt_timing.py <lt-script.md> <out.json> [--rate 105] [--pause 0.8]

- HTML comments are dropped. Each paragraph is read on its own and a fixed pause is added between paragraphs.
- Latin names are replaced by how they are said (READINGS), so that letters are not spelled out one by one.
- --rate 105 is the slowest rate the voice takes; it reads a plain Japanese passage at about 300 characters a minute.
- The result is a mechanical estimate, not a recording of the speaker.
"""
import argparse
import json
import re
import subprocess
import tempfile
from pathlib import Path

READINGS = (
    ("Cor.株式会社", "コア株式会社"), ("sim2sim", "シムツーシム"), ("GB10", "ジービーテン"),
    ("Isaac Sim", "アイザックシム"), ("Isaac Lab", "アイザックラボ"), ("MuJoCo", "ムジョコ"),
    ("PM01", "ピーエムゼロワン"), ("Thor", "ソー"), ("Wilson", "ウィルソン"), (" y ", " ワイ "),
)
# Slide cues: the paragraph that starts each slide (slide 1 starts with the first paragraph)
CUES = (("使っている計算機は", 2), ("まず GB10", 3), ("では、同じ重みを", 4), ("次にスイカ割り", 5), ("今日は Thor の上で", 6))


def paragraphs(text):
    body = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    return [p.strip() for p in re.split(r"\n\s*\n", body) if p.strip()]


def spoken(paragraph):
    out = paragraph.replace("\n", "")
    for written, said in READINGS:
        out = out.replace(written, said)
    return out


def duration(text, rate, workdir):
    aiff = Path(workdir) / "p.aiff"
    subprocess.run(["say", "-v", "Kyoko", "-r", str(rate), "-o", str(aiff), text], check=True)
    info = subprocess.run(["afinfo", str(aiff)], capture_output=True, text=True, check=True).stdout
    return float(re.search(r"estimated duration: ([\d.]+)", info).group(1))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("script")
    ap.add_argument("out")
    ap.add_argument("--rate", type=int, default=105)
    ap.add_argument("--pause", type=float, default=0.8)
    args = ap.parse_args()
    paras = paragraphs(Path(args.script).read_text())
    rows, elapsed, slide = [], 0.0, 1
    with tempfile.TemporaryDirectory() as tmp:
        for i, p in enumerate(paras):
            slide = next((n for head, n in CUES if p.startswith(head)), slide)
            secs = duration(spoken(p), args.rate, tmp)
            rows.append({"paragraph": i + 1, "slide": slide, "starts_at": round(elapsed, 1), "secs": round(secs, 1),
                         "chars": len(re.sub(r"\s", "", p)), "head": p.splitlines()[0][:24]})
            elapsed += secs + (args.pause if i < len(paras) - 1 else 0)
    chars = sum(r["chars"] for r in rows)
    slides = {}
    for r in rows:
        slides.setdefault(str(r["slide"]), r["starts_at"])
    result = {"voice": "Kyoko", "rate": args.rate, "pause_between_paragraphs": args.pause, "chars": chars,
              "total_secs": round(elapsed, 1), "chars_per_min": round(chars / elapsed * 60),
              "at_270_chars_per_min_secs": round(chars / 270 * 60 + args.pause * (len(rows) - 1), 1),
              "slides": slides, "paragraphs": rows}
    Path(args.out).write_text(json.dumps(result, ensure_ascii=False, indent=1) + "\n")
    print(f"chars={chars} total={elapsed:.1f}s ({int(elapsed // 60)}:{int(elapsed % 60):02d}) "
          f"cpm={result['chars_per_min']} at270={result['at_270_chars_per_min_secs']}s slides={result['slides']}")


if __name__ == "__main__":
    main()
