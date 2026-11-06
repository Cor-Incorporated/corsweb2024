import datetime as dt
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import intake

FIXTURES = Path(__file__).parent / "fixtures"
NOW = dt.datetime(2026, 10, 29, tzinfo=dt.timezone.utc)
NOTE_A = "https://note.com/cor_instrument/n/n111111111111"
NOTE_B = "https://note.com/cor_instrument/n/n222222222222"
QIITA_A = "https://qiita.com/terisuke/items/aaaaaaaaaaaaaaaaaaaa"
FEEDBACK = f"https://github.com/{intake.REPO}/issues/455"
MARKER = "<!-- cor-voice-intake:2026-W44 -->"


class FakeGitHub:
    repo = intake.REPO

    def __init__(self, weekly=None, comments=None):
        self.weekly = weekly or []
        self.existing_comments = comments or []
        self.writes = []

    def issues(self, label):
        return [{"html_url": FEEDBACK}] if label == "voice-feedback" else self.weekly

    def comments(self, number):
        return self.existing_comments

    def write(self, body, **kwargs):
        self.writes.append((body, kwargs))
        return f"https://github.com/{self.repo}/issues/999"


class IntakeTests(unittest.TestCase):
    def collect(self, url):
        return (FIXTURES / ("note.xml" if url == intake.NOTE_RSS else "qiita.json")).read_bytes()

    def test_fixture_evidence_list_alone_changes_result(self):
        articles = intake.collect_articles(self.collect)
        before = intake.execute(FakeGitHub(), NOTE_A, articles, NOW, dry_run=True)
        after = intake.execute(FakeGitHub(), NOTE_A + "\n" + NOTE_B, articles, NOW, dry_run=True)
        self.assertEqual(before["articles"], 2)
        self.assertEqual(after["articles"], 1)
        self.assertIn(NOTE_B, before["body"])
        self.assertNotIn(NOTE_B, after["body"])
        self.assertIn(QIITA_A, after["body"])
        self.assertNotIn("$(touch", before["body"])
        print("fixture evidence-only change: unrecorded articles 2 -> 1")

    def test_create_then_append_and_repeat_noop_preserves_existing_text(self):
        github = FakeGitHub()
        created = intake.execute(github, FEEDBACK, {NOTE_A}, NOW)
        self.assertEqual(created["action"], "create")
        first_body = github.writes[0][0]
        github.weekly = [{"number": 999, "body": first_body + "\n人が残した本文"}]
        github.existing_comments = [{"body": "#454 の反響コメントを保持"}]
        appended = intake.execute(github, FEEDBACK, {NOTE_A, NOTE_B}, NOW)
        self.assertEqual(appended["action"], "append")
        self.assertEqual(github.writes[1][1]["number"], 999)
        self.assertNotIn(NOTE_A, github.writes[1][0])
        github.existing_comments.append({"body": github.writes[1][0]})
        repeated = intake.execute(github, FEEDBACK, {NOTE_A, NOTE_B}, NOW)
        self.assertEqual(repeated["action"], "noop")
        self.assertEqual(len(github.writes), 2)
        self.assertIn("人が残した本文", github.weekly[0]["body"])
        self.assertEqual(github.existing_comments[0]["body"], "#454 の反響コメントを保持")

    def test_feedback_url_is_recorded_without_copying_issue_body(self):
        result = intake.execute(FakeGitHub(), "", set(), NOW, dry_run=True)
        self.assertEqual(result["feedback"], 1)
        self.assertIn(FEEDBACK, result["body"])
        self.assertEqual(intake.execute(FakeGitHub(), FEEDBACK, set(), NOW)["action"], "noop")

    def test_utc_iso_week_boundary_uses_iso_year(self):
        now = dt.datetime.fromisoformat("2027-01-04T00:30:00+09:00")
        result = intake.execute(FakeGitHub(), "", set(), now, dry_run=True)
        self.assertEqual(result["week"], "2026-W53")
        with self.assertRaisesRegex(ValueError, "timezone"):
            intake.execute(FakeGitHub(), "", set(), dt.datetime(2026, 10, 29))

    def test_duplicate_week_marker_fails_before_write(self):
        github = FakeGitHub([{"body": MARKER}, {"body": MARKER}])
        with self.assertRaisesRegex(ValueError, "Multiple"):
            intake.execute(github, "", {NOTE_A}, NOW)
        self.assertFalse(github.writes)

    def test_qiita_pagination_reaches_second_page(self):
        seen = []
        def fetch(url):
            seen.append(url)
            if url == intake.NOTE_RSS:
                return (FIXTURES / "note.xml").read_bytes()
            if "page=1&" in url:
                return json.dumps([{"url": QIITA_A}] * 100).encode()
            return json.dumps([{"url": "https://qiita.com/terisuke/items/bbbbbbbbbbbbbbbbbbbb"}]).encode()
        articles = intake.collect_articles(fetch)
        self.assertEqual(len(articles), 4)
        self.assertIn("page=2&per_page=100", seen[-1])
        with self.assertRaisesRegex(ValueError, "completeness unknown"):
            intake.collect_articles(fetch, max_pages=1)

    def test_invalid_sources_fail_closed(self):
        for url in ["http://note.com/cor_instrument/n/n123", "https://note.com/other/n/n123",
                    "https://qiita.com/other/items/" + "a" * 20, "https://evil.test/n/n123",
                    "https://note.com:443/cor_instrument/n/n123", "https://note.com/cor_instrument"]:
            with self.subTest(url=url), self.assertRaises(ValueError):
                intake.canonical_url(url)
        with self.assertRaises(ValueError):
            intake.parse_note_rss(b"<!DOCTYPE rss><rss><channel/></rss>")
        with self.assertRaises(ValueError):
            intake.parse_note_rss(b"<html>unavailable</html>")
        with self.assertRaises(ValueError):
            intake.parse_note_rss(f"<rss><channel><item><link>{QIITA_A}</link></item></channel></rss>".encode())
        with self.assertRaises(ValueError):
            intake.collect_articles(lambda url: b"{}" if url != intake.NOTE_RSS else self.collect(url))

    def test_failure_records_ledger_and_makes_no_github_call(self):
        with tempfile.TemporaryDirectory() as directory:
            evidence = Path(directory) / "evidence.md"
            evidence.write_text("", encoding="utf-8")
            ledger = Path(directory) / "guard-ledger.jsonl"
            with patch.object(intake, "collect_articles", side_effect=TimeoutError("source timeout")), \
                 patch.object(intake, "GitHub") as github:
                code = intake.main(["--evidence", str(evidence), "--ledger", str(ledger)])
            self.assertEqual(code, 1)
            github.assert_not_called()
            event = json.loads(ledger.read_text())
            self.assertEqual(event["status"], "failure")
            self.assertIn("source timeout", event["error"])

    def test_github_cli_paginates_and_uses_body_file_without_shell(self):
        calls = []
        def run(args, **kwargs):
            calls.append((args, kwargs))
            if args[1] == "api":
                return subprocess.CompletedProcess(args, 0, json.dumps([[{"number": 1}], [{"number": 2}]]))
            body_path = Path(args[args.index("--body-file") + 1])
            self.assertEqual(body_path.read_text(), "$(touch unexpected)\n")
            self.assertNotIn("shell", kwargs)
            return subprocess.CompletedProcess(args, 0, "https://github.com/example/repo/issues/1\n")
        with patch.object(intake.subprocess, "run", side_effect=run):
            github = intake.GitHub(intake.REPO)
            self.assertEqual(len(github.issues("voice-intake")), 2)
            github.write("$(touch unexpected)\n", title="固定タイトル")
        self.assertIn("--paginate", calls[0][0])
        self.assertIn("--slurp", calls[0][0])


if __name__ == "__main__":
    unittest.main()
