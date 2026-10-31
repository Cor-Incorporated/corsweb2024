#!/usr/bin/env python3
"""render_harness_entries.py と cor_voice_lint.py の単体テスト。

実行: python3 -I -m unittest discover -s .claude/skills/cor-voice-gate/scripts -p 'test_*.py'
片側だけを変えたとき（正本だけ、入口だけ）に落ちることと、検査が拾う型・拾わない型を確かめる。
"""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import cor_voice_lint as lint  # noqa: E402
import render_harness_entries as render  # noqa: E402

ENTRY = "日本語の対外文を書くときの手順です。\n\n1. 読む\n2. 検査する\n"


def fixture_root(tmp: Path, agents_extra: str = "") -> Path:
    marker = f"  {render.BEGIN}\n  {render.END}\n"
    (tmp / "AGENTS.md").write_text(f"# AGENTS.md\n\n- Japanese text:\n  pointers\n{marker}- Next bullet\n{agents_extra}")
    (tmp / "CLAUDE.md").write_text(f"# CLAUDE.md\n\n{render.BEGIN}\n{render.END}\n")
    return tmp


class RenderTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        fixture_root(self.tmp)

    def test_write_then_check_is_clean_and_keeps_indent(self):
        self.assertEqual(sorted(render.write(self.tmp, ENTRY)), sorted(t.rel for t in render.TARGETS))
        self.assertEqual(render.check(self.tmp, ENTRY), [])
        agents = (self.tmp / "AGENTS.md").read_text()
        self.assertIn("  1. 読む\n", agents)
        self.assertIn("\n- Next bullet\n", agents)  # 次の箇条書きを壊さない
        self.assertNotIn("\n1. 読む", agents)  # 字下げを落とさない
        mdc = (self.tmp / ".cursor/rules/cor-voice.mdc").read_text()
        self.assertTrue(mdc.startswith("---\ndescription: "))
        self.assertIn("alwaysApply: true", mdc)
        self.assertTrue(mdc.endswith(ENTRY))

    def test_hand_edit_of_an_entry_fails_with_both_sides(self):
        render.write(self.tmp, ENTRY)
        path = self.tmp / "AGENTS.md"
        path.write_text(path.read_text().replace("2. 検査する", "2. 検査は省いてよい"))
        problems = render.check(self.tmp, ENTRY)
        self.assertEqual(len(problems), 1)
        self.assertIn("AGENTS.md", problems[0])
        self.assertIn("-  2. 検査は省いてよい", problems[0])
        self.assertIn("+  2. 検査する", problems[0])

    def test_source_change_without_write_fails_every_entry(self):
        render.write(self.tmp, ENTRY)
        problems = render.check(self.tmp, ENTRY + "3. 送らない\n")
        self.assertEqual(len(problems), len(render.TARGETS))

    def test_missing_or_broken_markers_are_refused(self):
        (self.tmp / "CLAUDE.md").write_text("# CLAUDE.md\n")
        with self.assertRaises(render.MarkerError):
            render.check(self.tmp, ENTRY)
        (self.tmp / "CLAUDE.md").write_text(f"{render.BEGIN}\n{render.BEGIN}\n{render.END}\n")
        with self.assertRaises(render.MarkerError):
            render.check(self.tmp, ENTRY)
        (self.tmp / "CLAUDE.md").write_text(f"{render.END}\n{render.BEGIN}\n")
        with self.assertRaises(render.MarkerError):
            render.check(self.tmp, ENTRY)

    def test_write_touches_nothing_when_one_target_is_broken(self):
        before = (self.tmp / "AGENTS.md").read_text()
        (self.tmp / "CLAUDE.md").write_text("# CLAUDE.md\n")
        with self.assertRaises(render.MarkerError):
            render.write(self.tmp, ENTRY)
        self.assertEqual((self.tmp / "AGENTS.md").read_text(), before)
        self.assertFalse((self.tmp / ".cursor/rules/cor-voice.mdc").exists())

    def test_agents_md_over_codex_limit_is_reported(self):
        fixture_root(self.tmp, agents_extra="あ" * (render.CODEX_MAX_BYTES // 3 + 10))
        render.write(self.tmp, ENTRY)
        problems = render.check(self.tmp, ENTRY)
        self.assertTrue(any("上限" in p and "AGENTS.md" in p for p in problems), problems)

    def test_repository_source_is_not_empty(self):
        self.assertIn("cor_voice_lint.py", render.read_source())


def rule_ids(text: str, scene: str = "company") -> list[str]:
    return [h.rule_id for h in lint.check_text(text, scene)]


class LintTest(unittest.TestCase):
    def test_site_rules_are_errors(self):
        hits = lint.check_text("まずは試行してください。ISMS 認証取得済みです。生産性が7倍になりました。証拠は盛れない。Cor株式会社です。", "company")
        self.assertNotIn("trial_word", [h.rule_id for h in lint.check_text("試行錯誤しました。", "company")])
        self.assertEqual({h.rule_id for h in hits if h.level == "error"}, {"trial_word", "isms_obtained", "seven_x_metric", "evidence_copy", "company_name"})

    def test_style_rules(self):
        text = "## Grift とは？\n\nすごいです！\n\n- **特徴**: 点数を出さない\n\nそうなんよね（笑）。\n\nシームレスに使えます。\n"
        self.assertEqual(set(rule_ids(text)), {"what_is_heading", "exclamation", "bold_label_colon", "dialect", "closed_warai", "ai_slop"})

    def test_what_is_heading_without_question_mark_is_allowed(self):
        # 代表の Qiita（2026-08）に「## Grift CLIとは」がある
        self.assertEqual(rule_ids("## Grift CLIとは\n\n本文です。\n"), [])

    def test_mentions_of_banned_words_are_not_hits(self):
        self.assertEqual(rule_ids("「取得済み」とは書きません。「試行」は使わない。\n"), [])
        # 肯定の動詞は言及にしない（「『取得済み』と書きます」は主張のまま）
        self.assertIn("isms_obtained", rule_ids("ISMS 認証は「取得済み」と書きます。\n"))

    def test_error_rules_see_links_tables_quotes_and_odd_fences(self):
        # レビューで見つかった素通り（2026-10-30）: URL の後ろ、表、引用、閉じないコードの囲み
        self.assertIn("trial_word", rule_ids("[記事](https://x.com/a)で試行を始めました。\n"))
        self.assertIn("isms_obtained", rule_ids("[こちら](https://cor-jp.com/)にあるとおり、ISMS 認証取得済みです。\n"))
        self.assertIn("isms_obtained", rule_ids("| ISMS | 認証取得済み |\n"))
        self.assertIn("isms_obtained", rule_ids("> ISMS 認証取得済みです。\n"))
        self.assertIn("trial_word", rule_ids("```\n~~~\n```\n試行します。\n"))
        self.assertNotIn("exclamation", rule_ids("| 列 | すごい！ |\n"))  # 文体の規則は表を見ない

    def test_reviewed_false_positives(self):
        self.assertEqual(rule_ids("試行錯誤の記録です。\n", "founder"), [])
        self.assertEqual(rule_ids("コントリビュートは1.7倍で、生産性は測っていません。\n"), [])
        self.assertEqual(rule_ids("絶対パスで指定します。\n"), [])
        self.assertEqual(rule_ids("そうではありませんよね。\n"), [])

    def test_first_person_after_japanese_text(self):
        self.assertIn("company_first_person", rule_ids("そして私は確かめました。"))
        self.assertIn("first_person_mix", rule_ids("今日僕は書いた。そして私も書いた。", "founder"))
        self.assertEqual(rule_ids("公私の区別をつけます。"), [])

    def test_long_lines_stay_fast(self):
        import time
        start = time.monotonic()
        lint.check_text(" " * 40000 + "\n" + "1" * 40000 + "\n" + "「" * 20000 + "\n", "company")
        self.assertLess(time.monotonic() - start, 5.0)

    def test_unreadable_file_exits_2(self):
        with self.assertRaises(SystemExit) as ctx:
            lint.main(["check", "/nonexistent/cor-voice-draft.md"])
        self.assertEqual(ctx.exception.code, 2)

    def test_quotes_code_and_urls_are_not_style_hits(self):
        text = "「すごい！」と言われました。\n\n```\necho hi!\n```\n\n`ok!` と https://example.com/a!b\n"
        self.assertEqual(rule_ids(text), [])

    def test_scenes(self):
        self.assertIn("company_first_person", rule_ids("僕はそう考えます。"))
        self.assertNotIn("company_first_person", rule_ids("僕はそう考えます。", "founder"))
        self.assertNotIn("exclamation", rule_ids("最高や！", "founder-x"))
        self.assertIn("first_person_mix", rule_ids("僕はそう思う。私もそう思う。", "founder"))

    def test_ellipsis_needs_two(self):
        self.assertEqual(rule_ids("そうですね…。"), [])
        self.assertEqual(rule_ids("そうですね…。そうか…。"), ["ellipsis"])
        self.assertEqual(rule_ids("そうですね…。\nそうか…。"), ["ellipsis", "ellipsis"])

    def test_long_sentences_and_paragraphs(self):
        long_para = "これはとても長い文で、読み手が一度で読み切るのが難しいくらいに、いくつもの条件と説明を重ねています。" * 6
        ids = rule_ids(long_para + "\n\n" + long_para + "\n\n" + long_para + "\n")
        self.assertIn("long_sentences", ids)
        self.assertIn("long_paragraphs", ids)
        self.assertNotIn("long_sentences", rule_ids(long_para, "founder-x"))
        short = "短い文です。\n\n次も短いです。\n\nまだ短い。\n\nこれも。\n\n最後です。\n"
        self.assertEqual(rule_ids(short), [])

    def test_stats_counts_sentences_and_skips_code(self):
        s = lint.stats_text("---\ntitle: x\n---\n\n一つ目です。二つ目です。\n\n```\nコードです。\n```\n\n- 三つ目\n")
        self.assertEqual(s["sentences"], 3)
        self.assertEqual(s["paragraphs"], 2)


if __name__ == "__main__":
    unittest.main()
