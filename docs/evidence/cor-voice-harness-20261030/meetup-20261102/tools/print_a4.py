#!/usr/bin/env python3
"""Lay the LT script (reading version) and the handout out on A4, print them to PDF and count the pages.

usage: print_a4.py <final-dir> <timing.json> <pdf-out-dir>

- Writes <final-dir>/lt-script-a4.html and <final-dir>/handout-a4.html (system fonts only, no external files).
- The reading version runs the sentences of a paragraph together and marks where each slide starts, with the time
  from lt_timing.py.
- Prints both with headless Chrome (A4, no header or footer) and counts the pages with pdfinfo.
- The PDFs stay in <pdf-out-dir>; they embed the system fonts, so they are not committed.
"""
import html
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
FONT = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif'
SCRIPT_CSS = f"""@page {{ size: A4; margin: 13mm 16mm; }}
body {{ font-family: {FONT}; font-size: 11pt; line-height: 1.55; color: #000; margin: 0; }}
header {{ display: flex; justify-content: space-between; font-size: 8.5pt; color: #444; margin-bottom: 2pt; }}
.cue {{ font-size: 8.5pt; font-weight: 700; color: #444; border-top: 0.5pt solid #999; margin: 5pt 0 1pt; padding-top: 1pt; }}
p {{ margin: 0 0 4pt; }}
.end {{ font-size: 8.5pt; color: #444; text-align: right; }}"""
HANDOUT_CSS = f"""@page {{ size: A4; margin: 11mm 14mm; }}
body {{ font-family: {FONT}; font-size: 9.5pt; line-height: 1.45; color: #000; margin: 0; }}
h1 {{ font-size: 15pt; margin: 0 0 3pt; }}
h2 {{ font-size: 10.5pt; margin: 7pt 0 3pt; border-bottom: 0.6pt solid #888; }}
p {{ margin: 0 0 4pt; }}
ul {{ margin: 0 0 4pt; padding-left: 1.2em; }}
li {{ margin: 0 0 2pt; }}
code {{ font-family: Menlo, monospace; font-size: 8.5pt; }}
a {{ color: #000; text-decoration: none; }}"""


def page(title, css, body):
    return (f'<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n<title>{html.escape(title)}</title>\n'
            f"<style>\n{css}\n</style>\n</head>\n<body>\n{body}\n</body>\n</html>\n")


def mmss(secs):
    return f"{int(secs // 60)}:{int(secs % 60):02d}"


def script_html(text, timing):
    paras = [p.strip() for p in re.split(r"\n\s*\n", re.sub(r"<!--.*?-->", "", text, flags=re.S)) if p.strip()]
    rows = timing["paragraphs"]
    assert len(rows) == len(paras), "timing.json is not from this script; run lt_timing.py again"
    out, seen = [f'<header><span>LT 原稿（読み上げ用）北九州フィジカルAIミートアップ #2 / 2026年11月2日 / 5 分</span>'
                 f'<span>{timing["chars"]:,} 字・読み上げの目安 {mmss(timing["total_secs"])}</span></header>'], set()
    for para, row in zip(paras, rows):
        if row["slide"] not in seen:
            seen.add(row["slide"])
            out.append(f'<div class="cue">スライド {row["slide"]}　{mmss(row["starts_at"])}</div>')
        out.append("<p>" + html.escape("".join(line.strip() for line in para.splitlines())) + "</p>")
    out.append(f'<div class="end">ここまで {mmss(timing["total_secs"])}（音声合成 Kyoko、普通の文で 1 分 300 字ほどの速さ）</div>')
    return page("LT 原稿（読み上げ用）", SCRIPT_CSS, "\n".join(out))


def handout_html(text):
    body = subprocess.run(["pandoc", "-f", "gfm+hard_line_breaks", "-t", "html5"], input=re.sub(r"<!--.*?-->\n?", "", text, flags=re.S),
                          capture_output=True, text=True, check=True).stdout
    return page("言葉で指示して、ロボットが動くまで", HANDOUT_CSS, body.strip())


def to_pdf(src, pdf):
    with tempfile.TemporaryDirectory() as profile:
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
                        f"--user-data-dir={profile}", "--no-pdf-header-footer", f"--print-to-pdf={pdf}",
                        src.resolve().as_uri()], capture_output=True, check=True, timeout=120)
    info = subprocess.run(["pdfinfo", str(pdf)], capture_output=True, text=True, check=True).stdout
    return int(re.search(r"^Pages:\s+(\d+)", info, re.M).group(1)), re.search(r"^Page size:\s+(.*)$", info, re.M).group(1)


def main():
    final, timing, out = Path(sys.argv[1]), json.loads(Path(sys.argv[2]).read_text()), Path(sys.argv[3])
    out.mkdir(parents=True, exist_ok=True)
    built = {"lt-script-a4": script_html((final / "lt-script.md").read_text(), timing),
             "handout-a4": handout_html((final / "handout.md").read_text())}
    result = {}
    for name, doc in built.items():
        src = final / f"{name}.html"
        src.write_text(doc)
        pages, size = to_pdf(src, out / f"{name}.pdf")
        result[name] = {"pages": pages, "page_size": size}
        print(f"{name}: pages={pages} size={size}")
    (out / "print-a4.json").write_text(json.dumps(result, ensure_ascii=False, indent=1) + "\n")
    sys.exit(0 if all(r["pages"] == 1 for r in result.values()) else 1)


if __name__ == "__main__":
    main()
