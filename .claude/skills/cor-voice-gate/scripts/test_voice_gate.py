#!/usr/bin/env python3
"""voice_gate.py の単体テストと、voice 技能に特定のハーネスの呼び出しが残っていないことの検査。

実行: python3 -I -m unittest discover -s .claude/skills/cor-voice-gate/scripts -p 'test_*.py'

- 記入表の項目は SKILL.md から作る。SKILL.md の宣言を片側だけ変えると、項目と n/a の可否が変わる（F3）。
- check は、機械の検査（cor_voice_lint の error、yomiyasu の meaning_risk、verify）か記入表のどれかが
  欠けると終了コード 1 になる。以前すり抜けた形（記入表が空、n/a 不可の項目を n/a、fail）を入力にする（F2）。
- check は PATH に Python だけを置き、HOME を空のフォルダにした環境で動かす。ハーネスの CLI と
  ハーネスの環境変数が無くても一周することを、毎回の unit テストで確かめる。
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import voice_gate as gate  # noqa: E402

SCRIPT = HERE / "voice_gate.py"
SKILLS = HERE.parents[1]
SKILL_TEXT = (HERE.parent / "SKILL.md").read_text(encoding="utf-8")

# yomiyasu は資料と最終稿が同じ中身だと入力の誤り（終了コード 2）にするので、資料はメモの形にする
MATERIAL = "Grift CLI: git の履歴から確かめられる事実を取り出す OSS の CLI。点数や順位は出さない。\n"
CLEAN = "Grift CLI は、git の履歴から確かめられる事実を取り出す OSS の CLI です。点数や順位は出しません。\n"
TRIAL_WORD = "Grift CLI は、git の履歴から確かめられる事実を取り出す OSS の CLI です。試行もできます。\n"
STRONGER = CLEAN + "絶対に役立ちます。\n"  # yomiyasu が meaning_risk（足した約束）にする
# 資料に無い効果。yomiyasu は meaning_risk 0・事実の穴の候補 1 にする（2026-11-05 に実測）。止めるのは記入表
UNBACKED = CLEAN + "必ず採用の判断が速くなります。\n"


def bare_env(home: Path) -> dict[str, str]:
    """Python だけを置いた PATH と空の HOME。ハーネスの CLI も環境変数も無い。"""
    bin_dir = home / "bin"
    bin_dir.mkdir(exist_ok=True)
    link = bin_dir / "python3"
    if not link.exists():
        link.symlink_to(sys.executable)
    return {"PATH": f"{bin_dir}{os.pathsep}/usr/bin{os.pathsep}/bin", "HOME": str(home), "LANG": "C.UTF-8"}


def run_gate(args: list[str], home: Path) -> subprocess.CompletedProcess:
    return subprocess.run(["python3", "-I", "-B", str(SCRIPT), *args], capture_output=True, text=True,
                          encoding="utf-8", env=bare_env(home), timeout=120, check=False)


def fill_review(review: Path, overrides: dict[str, tuple[str, str]] | None = None) -> None:
    """記入表の空欄を埋める。overrides で行ごとに判定と根拠を変える。"""
    overrides = overrides or {}
    lines = []
    for line in review.read_text(encoding="utf-8").splitlines():
        match = gate.REVIEW_ROW.match(line)
        if match:
            item_id = match.group(1)
            title = match.group(2).split("|", 1)[0].strip()
            verdict, basis = overrides.get(item_id, ("pass", "テストの記入（資料の範囲の 2 文で、当たる型が無い）"))
            line = f"| {item_id} | {title} | {verdict} | {basis} |"
        lines.append(line)
    review.write_text("\n".join(lines) + "\n", encoding="utf-8")


class ChecklistTest(unittest.TestCase):
    def test_items_follow_skill_md(self):
        section = gate._section(SKILL_TEXT, "Semantic Review")
        numbers = re.findall(r"^(\d+)\. □ ", section, re.M)
        fast = gate.checklist(SKILL_TEXT, "fast")
        self.assertEqual([item.item_id for item in fast], ["T"] + [f"S{n}" for n in numbers])
        full = gate.checklist(SKILL_TEXT, "full")
        prepublish = [item for item in full if item.item_id.startswith("P")]
        self.assertEqual(len(prepublish), len(gate._prepublish_rows(SKILL_TEXT)))
        self.assertGreater(len(prepublish), 0)

    def test_every_gate_items_cannot_be_na(self):
        declared = gate.EVERY_GATE_DECLARATION.search(SKILL_TEXT)
        locked = {f"S{declared.group(1)}", f"S{declared.group(2)}", f"S{gate.MEANING_RISK_ITEM}", "T"}
        fast = {item.item_id: item.na_allowed for item in gate.checklist(SKILL_TEXT, "fast")}
        self.assertEqual({item_id for item_id, allowed in fast.items() if not allowed}, locked)

    def test_one_sided_change_of_declaration_moves_the_lock(self):
        declared = gate.EVERY_GATE_DECLARATION.search(SKILL_TEXT)
        first, second = declared.group(1), declared.group(2)
        moved = SKILL_TEXT.replace(declared.group(0), f"Fast still runs items {first} and 14")
        items = {item.item_id: item.na_allowed for item in gate.checklist(moved, "fast")}
        self.assertFalse(items["S14"], "宣言を 14 に変えたら S14 は n/a 不可になる")
        self.assertTrue(items[f"S{second}"], f"宣言から外した S{second} は n/a にできる")

    def test_missing_declarations_stop_with_setup_error(self):
        broken = (
            SKILL_TEXT.replace("Fast still runs items", "Fast also runs items"),
            SKILL_TEXT.replace("Whole-post tone check (required, Fast and Full)", "Tone check"),
            SKILL_TEXT.replace("□", "-"),
            SKILL_TEXT.replace(gate.PREPUBLISH_HEADER, "| a | b | c |"),
        )
        for text in broken:
            with self.assertRaises(gate.SetupError):
                gate.checklist(text, "full")


class ReviewTest(unittest.TestCase):
    def setUp(self):
        self.items = gate.checklist(SKILL_TEXT, "fast")
        self.filled = {item.item_id: ("pass", "根拠") for item in self.items}

    def test_complete_review_has_no_problem(self):
        self.assertEqual(gate.evaluate_review(self.items, self.filled), [])

    def test_each_hole_is_reported(self):
        cases = {
            "blank": ({"S1": ("", "")}, "S1"),
            "fail": ({"S5": ("fail", "初回の調査が毎年の行事に読める")}, "S5"),
            "na-locked": ({"S13": ("n/a", "当たらない")}, "S13 は n/a にできません"),
            "bad-word": ({"S2": ("ok", "根拠")}, "S2 の判定"),
            "no-basis": ({"S3": ("pass", "")}, "S3 の根拠が空"),
        }
        for name, (change, expected) in cases.items():
            with self.subTest(name):
                problems = gate.evaluate_review(self.items, {**self.filled, **change})
                self.assertTrue(any(expected in problem for problem in problems), problems)
        rows = dict(self.filled)
        del rows["S7"]
        self.assertTrue(any(problem.startswith("S7") for problem in gate.evaluate_review(self.items, rows)))
        self.assertTrue(gate.evaluate_review(self.items, {**self.filled, "S99": ("pass", "x")}))

    def test_rendered_review_round_trips(self):
        text = gate.render_review(self.items, "fast", "../draft.md")
        rows, duplicate = gate.parse_review(text)
        self.assertEqual(duplicate, [])
        self.assertEqual(set(rows), {item.item_id for item in self.items})
        self.assertTrue(all(row == ("", "") for row in rows.values()))
        _, duplicate = gate.parse_review(text + "| S1 | x | pass | y |\n")
        self.assertEqual(len(duplicate), 1)


class EndToEndTest(unittest.TestCase):
    """PATH に Python だけを置いた環境で init → 記入 → check を一周する。"""

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.home = self.tmp / "home"
        self.home.mkdir()
        (self.tmp / "material.md").write_text(MATERIAL, encoding="utf-8")

    def start(self, draft_text: str, *extra: str) -> Path:
        draft = self.tmp / "draft.md"
        draft.write_text(draft_text, encoding="utf-8")
        run_dir = self.tmp / "run"
        args = ["init", "--run-dir", str(run_dir), "--draft", str(draft), "--material", str(self.tmp / "material.md"),
                "--scene", "company", "--doc-type", "article", "--gate", "fast", *extra]
        done = run_gate(args, self.home)
        self.assertEqual(done.returncode, 0, done.stderr)
        return run_dir

    def check(self, run_dir: Path) -> tuple[int, dict]:
        done = run_gate(["check", "--run-dir", str(run_dir), "--json"], self.home)
        self.assertIn(done.returncode, (0, 1), done.stderr)
        return done.returncode, json.loads(done.stdout)

    def test_clean_draft_with_complete_review_passes_without_harness(self):
        run_dir = self.start(CLEAN)
        self.assertEqual(run_gate(["--help"], self.home).returncode, 0)
        self.assertNotEqual(subprocess.run(["sh", "-c", "command -v claude"], env=bare_env(self.home),
                                           capture_output=True, check=False).returncode, 0)
        fill_review(run_dir / gate.REVIEW_MD)
        code, result = self.check(run_dir)
        self.assertEqual((code, result["passed"], result["reasons"]), (0, True, []))
        self.assertEqual(result["yomiyasu"]["verify"]["status"], "executed")
        for name in (gate.RESULT_JSON, gate.RESULT_MD, gate.GATE_JSON):
            self.assertNotIn(str(self.tmp), (run_dir / name).read_text(encoding="utf-8"), f"{name} に絶対パス")

    def test_empty_review_blocks(self):
        code, result = self.check(self.start(CLEAN))
        self.assertEqual(code, 1)
        self.assertTrue(any("未記入" in reason for reason in result["reasons"]))

    def test_lint_error_blocks(self):
        run_dir = self.start(TRIAL_WORD)
        fill_review(run_dir / gate.REVIEW_MD)
        code, result = self.check(run_dir)
        self.assertEqual((code, result["cor_voice_lint"]["errors"]), (1, 1))
        self.assertTrue(any("cor_voice_lint" in reason for reason in result["reasons"]))

    def test_added_promise_blocks_on_meaning_risk(self):
        (self.tmp / "source.md").write_text(CLEAN, encoding="utf-8")
        run_dir = self.start(STRONGER, "--source", str(self.tmp / "source.md"))
        fill_review(run_dir / gate.REVIEW_MD)
        code, result = self.check(run_dir)
        self.assertEqual(code, 1)
        self.assertGreater(result["yomiyasu"]["run"]["meaning_risk_count"], 0)

    def test_meaning_risks_from_materials_are_listed(self):
        """資料との照合だけの run（原文なし）でも、meaning_risk の中身が result に並ぶ（件数と一致する）。"""
        run_dir = self.start(CLEAN + "SBOM は Syft 1.2 で作ります。\n")
        fill_review(run_dir / gate.REVIEW_MD)
        code, result = self.check(run_dir)
        run = result["yomiyasu"]["run"]
        self.assertEqual(code, 1)
        self.assertGreater(run["meaning_risk_count"], 0)
        self.assertEqual(len(run["meaning_risks"]), run["meaning_risk_count"])

    def test_unbacked_effect_is_listed_and_stopped_by_review(self):
        (self.tmp / "source.md").write_text(CLEAN, encoding="utf-8")
        run_dir = self.start(UNBACKED, "--source", str(self.tmp / "source.md"))
        fill_review(run_dir / gate.REVIEW_MD)
        code, result = self.check(run_dir)
        run = result["yomiyasu"]["run"]
        self.assertEqual((code, run["meaning_risk_count"]), (0, 0), "機械の検査だけでは止まらない（限界の記録）")
        self.assertGreater(run["fact_gap_count"], 0)
        self.assertIn("確かめたい候補", (run_dir / gate.RESULT_MD).read_text(encoding="utf-8"))
        fill_review(run_dir / gate.REVIEW_MD, {"S14": ("fail", "「必ず速くなる」は資料に無い効果")})
        code, result = self.check(run_dir)
        self.assertEqual(code, 1)
        self.assertTrue(any("S14" in reason for reason in result["reasons"]))

    def test_edit_after_pass_is_checked_again(self):
        run_dir = self.start(CLEAN)
        fill_review(run_dir / gate.REVIEW_MD)
        self.assertEqual(self.check(run_dir)[0], 0)
        (self.tmp / "draft.md").write_text(STRONGER, encoding="utf-8")
        code, result = self.check(run_dir)
        self.assertEqual(code, 1)
        self.assertNotEqual(result["draft"]["sha256"], "")

    def test_init_refuses_to_overwrite_and_needs_material_or_source(self):
        run_dir = self.start(CLEAN)
        again = run_gate(["init", "--run-dir", str(run_dir), "--draft", str(self.tmp / "draft.md"),
                          "--material", str(self.tmp / "material.md"), "--scene", "company",
                          "--doc-type", "article", "--gate", "fast"], self.home)
        self.assertEqual(again.returncode, 2)
        bare = run_gate(["init", "--run-dir", str(self.tmp / "other"), "--draft", str(self.tmp / "draft.md"),
                         "--scene", "company", "--doc-type", "article", "--gate", "fast"], self.home)
        self.assertEqual(bare.returncode, 2)


# 特定のハーネスだけが持つ呼び出し。名前（「Claude Code」「Codex」）を書くことは止めない。呼び出しを止める。
HARNESS_ONLY_CALLS = (
    (r"\bclaude\s+-p\b", "claude -p（Claude Code の非対話実行）"),
    (r"\$\{?CLAUDE_[A-Z_]+", "Claude Code の環境変数"),
    (r"\bSkill tool\b|Skill ツール|\bSkill\(", "Claude Code のスキルの呼び出し"),
    (r"\bAgent tool\b|\bTask tool\b|サブエージェント|\bsubagents?\b", "Claude Code のサブエージェント"),
    (r"\bmcp__\w+", "MCP のツール名"),
    (r"\b(TodoWrite|AskUserQuestion|ExitPlanMode|WebFetch)\b", "Claude Code の組み込みツール"),
    (r"(?<![\w/.-])/(cor-voice-gate|cor-voice|yomiyasu)\b", "スラッシュコマンド"),
    (r"settings(\.local)?\.json|hookSpecificOutput|PreToolUse|PostToolUse|UserPromptSubmit", "Claude Code のフック"),
)
# yomiyasu の本文と scripts は nanaism/yomiyasu v2.1.3 を手を加えずに同梱している（MIT、CLAUDE.md）。
# 本文は「/yomiyasu」「$yomiyasu」を各ホストでの呼び名として、「${CLAUDE_SKILL_DIR}」を
# <スキル配置ディレクトリ> の例として挙げ、yomiyasu_hook.py は任意のフックである。どれも検査の
# コマンド（yomiyasu_check.py run / verify）には要らないので、Cor. が足した節だけを見る。
YOMIYASU_COR_SECTION = "## Cor. 発信の主張と根拠の検査"


def harness_only_hits(text: str) -> list[str]:
    hits = []
    for number, line in enumerate(text.splitlines(), start=1):
        hits += [f"{number} 行目 {label}: {line.strip()[:120]}" for pattern, label in HARNESS_ONLY_CALLS
                 if re.search(pattern, line)]
    return hits


def voice_skill_texts() -> dict[str, str]:
    gate_dir = SKILLS / "cor-voice-gate"
    paths = [SKILLS / "cor-voice" / "SKILL.md", gate_dir / "SKILL.md", gate_dir / "references" / "harness-entry.md"]
    paths += sorted(path for path in (gate_dir / "scripts").glob("*.py") if not path.name.startswith("test_"))
    texts = {str(path.relative_to(SKILLS)): path.read_text(encoding="utf-8") for path in paths}
    yomiyasu = (SKILLS / "yomiyasu" / "SKILL.md").read_text(encoding="utf-8")
    start = yomiyasu.find(YOMIYASU_COR_SECTION)
    if start < 0:
        raise AssertionError(f"yomiyasu/SKILL.md に「{YOMIYASU_COR_SECTION}」が無い（Cor. の節の始まりが分からない）")
    texts["yomiyasu/SKILL.md（Cor. の節）"] = yomiyasu[start:]
    return texts


class HarnessIndependenceTest(unittest.TestCase):
    def test_voice_skills_have_no_harness_only_calls(self):
        found = {name: hits for name, text in voice_skill_texts().items() if (hits := harness_only_hits(text))}
        self.assertEqual(found, {}, "特定のハーネスだけで動く呼び出しが残っている")

    def test_scanner_catches_each_kind(self):
        samples = ("claude -p で回す", "${CLAUDE_PROJECT_DIR}/x", "Skill tool で呼ぶ", "サブエージェントに渡す",
                   "mcp__claude-in-chrome__navigate", "TodoWrite に書く", "`/cor-voice-gate` を打つ",
                   "PreToolUse フックで止める")
        for sample in samples:
            with self.subTest(sample):
                self.assertTrue(harness_only_hits(sample), sample)
        allowed = ("Claude Code と Codex が読む入口", "`python3 -I .claude/skills/yomiyasu/scripts/yomiyasu_check.py`",
                   "CLAUDE.md と AGENTS.md")
        for sample in allowed:
            with self.subTest(sample):
                self.assertEqual(harness_only_hits(sample), [], sample)


if __name__ == "__main__":
    unittest.main()
