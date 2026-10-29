#!/usr/bin/env python3
"""1 つの正本（references/harness-entry.md）から、ハーネスごとの指示ファイルの入口を生成する。

ADR-0026 の決定 1 のとおり、規則の本文は .claude/skills/ に置いたまま写さない。生成するのは
「どのスキルを読み、何を検査するか」の入口だけで、正本を直したら --write で全部の入口を作り直す。
入口を手で直すと --check が落ちる（期待値と実物の差分を出す）。

入口とハーネスの対応（各ツールが自動で読むファイル。2026-10-30 に各 CLI の文書と疎通で確かめた）:
  AGENTS.md                    Codex、OpenCode、Pi、dsh、Grok（Grok は CLAUDE.md も読む）
  CLAUDE.md                    Claude Code
  .cursor/rules/cor-voice.mdc  Cursor（alwaysApply。AGENTS.md も読む）
AGENTS.md と CLAUDE.md は、既存の文書の中の BEGIN／END の印の間だけを書き換える。印の行の字下げを、
生成する行にも付ける（箇条書きの項目の中に置けるように）。.mdc はファイル全体を生成する。

使い方:
  render_harness_entries.py --check [--root DIR]   入口が正本と一致するかを見る（既定）
  render_harness_entries.py --write [--root DIR]   入口を正本から作り直す
終了コード: 0 = 一致（--write は書き終えた）/ 1 = 一致しない / 2 = 印が無い・崩れている、正本が読めない
"""
from __future__ import annotations

import argparse
import difflib
import sys
from dataclasses import dataclass
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parents[1]
SOURCE = SKILL_DIR / "references" / "harness-entry.md"
SOURCE_REL = ".claude/skills/cor-voice-gate/references/harness-entry.md"
SCRIPT_REL = ".claude/skills/cor-voice-gate/scripts/render_harness_entries.py"
BEGIN = f"<!-- BEGIN cor-voice harness entry (generated from {SOURCE_REL} by {SCRIPT_REL}; edit the source and run --write) -->"
END = "<!-- END cor-voice harness entry -->"
# Codex の project_doc_max_bytes の既定（32 KiB）。超えた分は Codex に読まれない
CODEX_MAX_BYTES = 32 * 1024


@dataclass(frozen=True)
class Target:
    rel: str
    kind: str  # block | mdc
    harnesses: str
    max_bytes: int | None = None


TARGETS = (
    Target("AGENTS.md", "block", "Codex, OpenCode, Pi, dsh, Grok", CODEX_MAX_BYTES),
    Target("CLAUDE.md", "block", "Claude Code"),
    Target(".cursor/rules/cor-voice.mdc", "mdc", "Cursor"),
)

MDC_HEADER = """---
description: 日本語の対外文（記事、メールと返信、社内の手順書、SNS、PR の説明）を書くとき・直すときの入口。規則の本文は .claude/skills/ にある
alwaysApply: true
---

"""


class MarkerError(Exception):
    pass


def read_source() -> str:
    text = SOURCE.read_text(encoding="utf-8")
    if not text.strip():
        raise MarkerError(f"{SOURCE_REL} が空です")
    return text.rstrip("\n") + "\n"


def indent_block(entry: str, indent: str) -> str:
    lines = [BEGIN, *entry.rstrip("\n").split("\n"), END]
    return "\n".join(indent + line if line.strip() else "" for line in lines)


def render_block(current: str, entry: str, rel: str) -> str:
    """current の BEGIN〜END を entry で置き換えた全文。印の行の字下げを保つ。"""
    lines = current.split("\n")
    begins = [i for i, line in enumerate(lines) if line.strip() == BEGIN]
    ends = [i for i, line in enumerate(lines) if line.strip() == END]
    if not begins and not ends:
        raise MarkerError(f"{rel}: 生成の印（BEGIN と END）がありません。入れる場所に 2 行を置いてから --write してください")
    if len(begins) != 1 or len(ends) != 1 or ends[0] < begins[0]:
        raise MarkerError(f"{rel}: 生成の印の数か順番が崩れています（BEGIN {len(begins)} 行、END {len(ends)} 行）")
    b, e = begins[0], ends[0]
    indent = lines[b][: len(lines[b]) - len(lines[b].lstrip())]
    return "\n".join([*lines[:b], indent_block(entry, indent), *lines[e + 1 :]])


def render_mdc(entry: str) -> str:
    return MDC_HEADER + f"<!-- generated from {SOURCE_REL} by {SCRIPT_REL}; edit the source and run --write -->\n\n# 日本語の対外文を書くとき\n\n" + entry


def expected(root: Path, target: Target, entry: str) -> str:
    if target.kind == "mdc":
        return render_mdc(entry)
    path = root / target.rel
    if not path.exists():
        raise MarkerError(f"{target.rel}: ファイルがありません")
    return render_block(path.read_text(encoding="utf-8"), entry, target.rel)


def check(root: Path, entry: str) -> list[str]:
    problems = []
    for target in TARGETS:
        path = root / target.rel
        want = expected(root, target, entry)
        have = path.read_text(encoding="utf-8") if path.exists() else ""
        if have != want:
            diff = difflib.unified_diff(have.splitlines(), want.splitlines(), f"{target.rel}（実物）", f"{target.rel}（正本から生成）", lineterm="", n=1)
            problems.append(f"{target.rel}: 正本と一致しません（{target.harnesses} の入口）\n" + "\n".join(list(diff)[:40]))
        size = len(want.encode("utf-8"))
        if target.max_bytes and size > target.max_bytes:
            problems.append(f"{target.rel}: {size} バイトで、Codex が読む上限 {target.max_bytes} バイトを超えます（超えた分は読まれません）")
    return problems


def write(root: Path, entry: str) -> list[str]:
    written = []
    for target in TARGETS:
        path = root / target.rel
        want = expected(root, target, entry)
        if not path.exists() or path.read_text(encoding="utf-8") != want:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(want, encoding="utf-8")
            written.append(target.rel)
    return written


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="render_harness_entries.py", description=__doc__.split("\n")[0])
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="入口が正本と一致するかを見る（既定）")
    mode.add_argument("--write", action="store_true", help="入口を正本から作り直す")
    parser.add_argument("--root", type=Path, default=SKILL_DIR.parents[2], help="リポジトリのルート（既定はこのスキルを置いたリポジトリ）")
    args = parser.parse_args(argv)
    try:
        entry = read_source()
        if args.write:
            written = write(args.root, entry)
            print("書き直した入口: " + (", ".join(written) if written else "なし（すでに一致）"))
            problems = check(args.root, entry)
        else:
            problems = check(args.root, entry)
    except (MarkerError, OSError, UnicodeDecodeError) as exc:
        print(f"render_harness_entries: {exc}", file=sys.stderr)
        return 2
    for problem in problems:
        print(problem, file=sys.stderr)
    if problems:
        return 1
    print(f"入口 {len(TARGETS)} 件が正本（{SOURCE_REL}）と一致しています")
    return 0


if __name__ == "__main__":
    sys.exit(main())
