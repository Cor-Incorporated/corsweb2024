#!/usr/bin/env python3
"""cor_voice_lint.py の事実の記録（cor-voice/references/facts.json）との照合の試験。

実行: python3 -I -m unittest discover -s .claude/skills/cor-voice-gate/scripts -p 'test_*.py'
見るもの:
  - 通る形: 承認済みの 5 本文の ISMS の部分（見出し + 範囲 + 番号と日付 + 参考資料の行）
  - 止まる形: 仕様 4.3 の陰性例（範囲なし、範囲の拡大、番号違い、日付違い、古い状態、記録に無い認証）
  - 片側変異: 記録だけを変えると、本文の値と記録の値の両方を挙げて落ちる
  - 記録が壊れているとき: 旧い固定の規則へ黙って戻らず、fact_record_invalid で止まる
"""
from __future__ import annotations

import copy
import json
import re
import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))

import cor_voice_lint as lint  # noqa: E402

AS_OF = date(2026, 11, 12)
SKILLS = Path(__file__).resolve().parents[2]

# 承認済み 5 本文（教育・医療・士業・建設・製造）に共通する認証の部分。本文そのものではなく、認証の部分だけ
APPROVED_BLOCK = """**ISMS認証取得済み**

Cor.株式会社は、情報セキュリティマネジメントシステム（ISMS）の国際規格 ISO/IEC 27001:2022 の認証を取得しています。登録範囲は「ソフトウエアの受託開発および運用」です。

初回登録日：2026年11月7日。登録番号：JP26/00000364。
"""
# 4 本の参考資料の行（医療・士業・建設・製造）。ISMS の登録概要を指す行で、取得の表明ではない
APPROVED_REFERENCES = (
    "7. [Cor.株式会社・会社情報](https://cor-jp.com/company/) — SGSジャパン株式会社発行の審査登録証 JP26/00000364に基づく、ISMS認証の登録概要。",
    "4. [会社情報（Cor.株式会社）](https://cor-jp.com/company/) — SGSジャパン株式会社発行の審査登録証 JP26/00000364に基づく、ISMS認証の登録概要。",
    "4. [会社情報（Cor.株式会社）](https://cor-jp.com/company/) — SGSジャパン株式会社発行の審査登録証JP26/00000364に基づく、ISMS認証の登録概要です。",
)


def facts() -> dict:
    return copy.deepcopy(lint.load_facts())


def hits(text: str, record: dict | None = None, as_of: date = AS_OF, archive: frozenset[int] = frozenset()) -> list[lint.Hit]:
    return lint.check_text(text, "company", facts=record, as_of=as_of, archive_lines=archive)


def errors(text: str, **kw) -> list[str]:
    return sorted({h.rule_id for h in hits(text, **kw) if h.level == "error"})


class ApprovedBodiesPassTest(unittest.TestCase):
    def test_approved_isms_block_has_no_errors(self):
        self.assertEqual(errors(APPROVED_BLOCK), [])

    def test_approved_reference_lines_have_no_errors(self):
        for line in APPROVED_REFERENCES:
            with self.subTest(line=line[:40]):
                self.assertEqual(errors(line + "\n"), [])

    def test_heading_then_next_paragraph_scope_is_enough(self):
        self.assertEqual(errors("**ISMS認証取得済み**\n\n登録範囲は「ソフトウエアの受託開発および運用」です。\n"), [])

    def test_month_level_date_is_enough(self):
        self.assertEqual(errors("2026年11月に ISO/IEC 27001 の認証を取得しました。登録範囲は「ソフトウエアの受託開発および運用」です。\n"), [])

    def test_validity_period_dates_are_allowed(self):
        text = APPROVED_BLOCK + "\n有効期間は2026年11月7日から2029年11月7日までです。\n"
        self.assertEqual(errors(text), [])

    def test_scope_limiting_sentence_is_not_overreach(self):
        # ISMS 台帳 §2 の注意書き。範囲を広げない文は止めない
        text = "上記は組織の情報セキュリティマネジメントシステム（ISMS）に関する認証の説明です。個別製品、AIの回答精度、医療機器、機能安全、すべての事業や情報漏えいゼロを認証・保証する表現へ拡張しない。\n"
        self.assertEqual(errors(text), [])
        self.assertEqual(errors("ISMS の認証は、Grift の機能を保証するものではありません。\n"), [])
        self.assertEqual(errors("ISMS は組織の認証であり、製品や AI の回答精度の保証ではありません。\n"), [])
        # 否定の形でも、原因と結果でつないだ文は広げている（R02）
        self.assertIn("isms_scope_overreach", errors("ISMS 認証済みなので、製品の安全性の保証ではありません、と言い切れます。\n"))

    def test_no_required_phrases(self):
        # 「北極星」「脳に汗」など本人回答に根拠のある言い回しを、どの規則でも必須にしない
        for rule in lint.RULES:
            for word in ("北極星", "脳に汗", "通訳"):
                self.assertNotIn(word, rule.pattern.pattern)
        self.assertEqual(errors(APPROVED_BLOCK), [])


class NegativeCaseTest(unittest.TestCase):
    """仕様 4.3 の陰性例。落ちることを固定する。"""

    def assertRule(self, text: str, rule_id: str, **kw):
        found = errors(text, **kw)
        self.assertIn(rule_id, found, f"{text!r} で {rule_id} が出ない（出た error: {found}）")

    def test_certified_without_scope_is_scope_missing(self):
        self.assertRule("ISMS 認証取得済みです。\n", "isms_scope_missing")

    def test_scope_two_paragraphs_away_is_missing(self):
        self.assertRule("ISMS 認証取得済みです。\n\n別の話です。\n\n登録範囲は「ソフトウエアの受託開発および運用」です。\n", "isms_scope_missing")

    def test_unrecorded_certifications(self):
        for text in ("プライバシーマークを取得しています\n", "SOC 2 認証済み\n", "Pマークを取得しました。\n", "SCS 認証を取得しました。\n"):
            with self.subTest(text=text):
                self.assertRule(text, "cert_unverified")

    def test_overreach(self):
        for text in (
            "ISMS認証済みなので、AIが誤回答することはありません\n",  # R02
            "全事業・全製品が ISMS 認証済み\n",
            "ISMS 認証を取得したので、医療機器としても安心です。\n",
            "ISMS 認証があるので、情報漏えいゼロです。\n",
        ):
            with self.subTest(text=text):
                self.assertRule(text, "isms_scope_overreach")

    def test_confirmation_date_is_not_the_acquisition_date(self):
        self.assertRule("2026年11月11日に認証を取得した\n", "isms_date_mismatch")
        self.assertRule("初回登録日：2026年11月11日。\n", "isms_date_mismatch")
        self.assertRule("2026年11月11日に審査登録証を見て、ISMS 認証を取得しました。登録範囲は「ソフトウエアの受託開発および運用」です。\n", "isms_date_mismatch")
        self.assertRule("2026年11月11日に審査で認証を取得した\n", "isms_date_mismatch")  # 同じ節に取得の動詞があれば別の出来事にしない
        self.assertEqual(errors("2026年11月11日に登録証を確認しました。2026年11月7日に認証を取得しています。登録範囲は「ソフトウエアの受託開発および運用」です。\n"), [])
        self.assertRule("2026年10月7日に ISMS 認証を取得しました。登録範囲は「ソフトウエアの受託開発および運用」です。\n", "isms_date_mismatch")

    def test_one_character_different_number(self):
        self.assertRule("登録番号：JP26/00000365。\n", "isms_number_mismatch")
        self.assertRule("審査登録証 JP27/00000364 に基づく ISMS 認証です。\n", "isms_number_mismatch")

    def test_stale_state_when_registered(self):
        # Voice-1 の逆向き: 起点では exit 0 だった古い現在説明
        self.assertRule("ISMS の第2段階審査を終え、2026年12月ごろの認証登録を見込んでいます\n", "isms_stale_state")
        for phrase in ("ISMS は取得予定です。", "ISMS は正式登録前です。", "ISMS の取得に向けて整備中です。", "ISO/IEC 27001 の第2段階審査を終えました。"):
            with self.subTest(phrase=phrase):
                self.assertRule(phrase + "\n", "isms_stale_state")

    def test_history_with_completed_registration_is_not_stale(self):
        text = "2026年10月に ISO/IEC 27001 の第2段階審査を終え、2026年11月7日に認証を取得しました。登録範囲は「ソフトウエアの受託開発および運用」です。\n"
        self.assertEqual(errors(text), [])

    def test_archive_block_may_keep_the_old_state(self):
        text = "公開当時の記録です。\n\n2026年10月に ISO/IEC 27001 の第2段階審査を終え、2026年12月ごろの認証登録を見込んでいます\n"
        self.assertRule(text, "isms_stale_state")
        self.assertEqual(errors(text, archive=frozenset({3})), [])
        self.assertRule(text, "isms_stale_state", archive=frozenset({1}))  # 範囲が当たっていなければ通らない

    def test_status_expected_blocks_the_acquisition_claim(self):
        # 片側変異: 記録を変えるだけで、同じ文が止まる（根拠あり → 通る / 根拠なし → 止まる）
        rec = facts()
        self.assertEqual(errors(APPROVED_BLOCK, record=rec), [])
        rec["isms"]["status"] = "registration_expected"
        self.assertRule(APPROVED_BLOCK, "isms_status_mismatch", record=rec)
        # 同じ記録なら、予定の説明は止めない（記録に追随する）
        self.assertEqual(errors("ISMS の第2段階審査を終え、認証登録を見込んでいます\n", record=rec), [])

    def test_every_non_registered_status_blocks_the_claim(self):
        for status in ("unconfirmed", "audit_completed", "suspended", "withdrawn", "expired"):
            with self.subTest(status=status):
                rec = facts()
                rec["isms"]["status"] = status
                self.assertRule(APPROVED_BLOCK, "isms_status_mismatch", record=rec)

    def test_as_of_outside_the_validity_period_blocks_the_claim(self):
        self.assertRule(APPROVED_BLOCK, "isms_status_mismatch", as_of=date(2026, 11, 6))
        self.assertRule(APPROVED_BLOCK, "isms_status_mismatch", as_of=date(2029, 11, 8))
        rec = facts()
        rec["isms"]["valid_to"] = "2026-11-10"  # valid_to を検査日より前にした記録
        self.assertRule(APPROVED_BLOCK, "isms_status_mismatch", record=rec)


class RecordToTextLinkTest(unittest.TestCase):
    """記録 ↔ 本文の結線。片方だけ変えると、記録の値と本文の値の両方を挙げて落ちる（宣言と実体の二重管理）。"""

    def message_for(self, rule_id: str, record: dict) -> str:
        found = [h for h in hits(APPROVED_BLOCK, record=record) if h.rule_id == rule_id]
        self.assertTrue(found, f"記録を変えたのに {rule_id} が出ない")
        return found[0].message

    def test_number_changed_in_record(self):
        rec = facts()
        rec["isms"]["registration_number"] = "JP26/00000999"
        msg = self.message_for("isms_number_mismatch", rec)
        self.assertIn("JP26/00000999", msg)  # 記録の値
        self.assertIn("JP26/00000364", msg)  # 本文の値

    def test_date_changed_in_record(self):
        rec = facts()
        rec["isms"]["valid_from"] = "2026-11-08"
        msg = self.message_for("isms_date_mismatch", rec)
        self.assertIn("2026-11-08", msg)
        self.assertIn("2026年11月7日", msg)

    def test_scope_changed_in_record(self):
        rec = facts()
        rec["isms"]["scope"] = "全社の情報システムの運用"
        msg = self.message_for("isms_scope_missing", rec)
        self.assertIn("全社の情報システムの運用", msg)  # 記録の値

    def test_forbidden_extension_comes_from_the_record(self):
        rec = facts()
        self.assertEqual(errors("ISMS 認証は、倉庫の入出庫にも及びます。登録範囲は「ソフトウエアの受託開発および運用」です。\n", record=rec), [])
        rec["isms"]["forbidden_extensions"].append({"label": "倉庫", "terms": ["倉庫"]})
        self.assertIn("isms_scope_overreach", errors("ISMS 認証は、倉庫の入出庫にも及びます。登録範囲は「ソフトウエアの受託開発および運用」です。\n", record=rec))


class SkillTextLinkTest(unittest.TestCase):
    """SKILL に書いた値が記録と食い違ったら落ちる（SKILL は記録を指す。値を写すなら一致させる）。"""

    def test_registration_numbers_in_skills_match_the_record(self):
        recorded = facts()["isms"]["registration_number"]
        for rel in ("cor-voice/SKILL.md", "cor-voice-gate/SKILL.md", "cor-voice-gate/references/harness-entry.md"):
            text = (SKILLS / rel).read_text(encoding="utf-8")
            for number in re.findall(r"JP\d{2}/\d+", text):
                self.assertEqual(number, recorded, f"{rel} の登録番号 {number} が facts.json の {recorded} と違います")

    def test_skills_point_at_the_record(self):
        for rel in ("cor-voice/SKILL.md", "cor-voice-gate/SKILL.md"):
            self.assertIn("facts.json", (SKILLS / rel).read_text(encoding="utf-8"), f"{rel} が facts.json を指していません")

    def test_record_is_the_published_fact(self):
        isms = facts()["isms"]
        self.assertEqual((isms["status"], isms["standard"], isms["registration_number"], isms["scope"]), ("registered", "ISO/IEC 27001:2022", "JP26/00000364", "ソフトウエアの受託開発および運用"))
        self.assertEqual((isms["issuer"], isms["valid_from"], isms["valid_to"], isms["confirmed_on"]), ("SGSジャパン株式会社", "2026-11-07", "2029-11-07", "2026-11-11"))
        self.assertIn("維持審査", isms["recheck"])
        self.assertNotRegex(json.dumps(isms, ensure_ascii=False), r"住所|所在地:|不適合")  # 所在地・審査報告の中身は入れない


class BrokenRecordTest(unittest.TestCase):
    """記録が読めない・壊れている・必須のキーが無いとき、旧い固定の規則へ黙って戻らない。"""

    def run_with_record(self, content: str | None):
        tmp = Path(tempfile.mkdtemp()) / "facts.json"
        if content is not None:
            tmp.write_text(content, encoding="utf-8")
        with mock.patch.object(lint, "FACTS_PATH", tmp):
            return errors("ISMS 認証取得済みです。\n")

    def test_missing_file(self):
        self.assertIn("fact_record_invalid", self.run_with_record(None))

    def test_not_json(self):
        self.assertIn("fact_record_invalid", self.run_with_record("{壊れている"))

    def test_required_key_removed(self):
        for key in ("scope", "status", "valid_from", "forbidden_extensions", "stale_state_phrases"):
            with self.subTest(key=key):
                rec = json.loads((lint.FACTS_PATH).read_text(encoding="utf-8"))
                del rec["facts"][0][key]
                self.assertIn("fact_record_invalid", self.run_with_record(json.dumps(rec, ensure_ascii=False)))

    def test_unknown_status_and_bad_date(self):
        for key, value in (("status", "certified"), ("valid_to", "2029/11/07")):
            with self.subTest(key=key):
                rec = json.loads((lint.FACTS_PATH).read_text(encoding="utf-8"))
                rec["facts"][0][key] = value
                self.assertIn("fact_record_invalid", self.run_with_record(json.dumps(rec, ensure_ascii=False)))

    def test_invalid_record_stops_even_a_correct_sentence(self):
        self.assertIn("fact_record_invalid", self.run_with_record("[]"))

    def test_cli_exits_1_when_the_record_is_broken(self):
        tmp = Path(tempfile.mkdtemp())
        (tmp / "facts.json").write_text("{", encoding="utf-8")
        (tmp / "d.md").write_text("会社の紹介です。\n", encoding="utf-8")
        with mock.patch.object(lint, "FACTS_PATH", tmp / "facts.json"):
            self.assertEqual(lint.main(["check", "--as-of", "2026-11-12", str(tmp / "d.md")]), 1)


class CliTest(unittest.TestCase):
    def test_archive_and_as_of_options(self):
        tmp = Path(tempfile.mkdtemp())
        draft = tmp / "d.md"
        draft.write_text("2026年10月に ISO/IEC 27001 の第2段階審査を終え、2026年12月ごろの認証登録を見込んでいます\n", encoding="utf-8")
        self.assertEqual(lint.main(["check", "--as-of", "2026-11-12", str(draft)]), 1)
        self.assertEqual(lint.main(["check", "--as-of", "2026-11-12", "--archive", "1-1", str(draft)]), 0)
        with self.assertRaises(SystemExit) as ctx:
            lint.main(["check", "--as-of", "きのう", str(draft)])
        self.assertEqual(ctx.exception.code, 2)
        with self.assertRaises(SystemExit) as ctx:
            lint.main(["check", "--archive", "5-2", str(draft)])
        self.assertEqual(ctx.exception.code, 2)


if __name__ == "__main__":
    unittest.main()
