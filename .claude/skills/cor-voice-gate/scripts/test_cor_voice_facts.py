#!/usr/bin/env python3
"""cor_voice_lint.py の事実の記録（cor-voice/references/facts.json）との照合の試験。

実行: python3 -I -m unittest discover -s .claude/skills/cor-voice-gate/scripts -p 'test_*.py'
見るもの:
  - 通る形: 公開している業種ページ 5 本の本文の ISMS の部分（見出し + 範囲 + 番号と日付 + 参考資料の行）
  - 止まる形: 陰性例（範囲なし、範囲の拡大、番号違い、日付違い、古い状態、記録に無い認証）
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
# 記録の validity_condition を文にしたもの（有効期間を書く段落に要る。ISMS の有効期間を書く文の試験は、この文を足す）
COND = "有効期間中の維持審査にて登録の継続が認められる限り有効です。"
SKILLS = Path(__file__).resolve().parents[2]

# 公開している業種ページ 5 本の本文（教育・医療・士業・建設・製造）に共通する認証の部分。本文そのものではなく、認証の部分だけ
APPROVED_BLOCK = """**ISMS認証取得済み**

Cor.株式会社は、情報セキュリティマネジメントシステム（ISMS）の国際規格 ISO/IEC 27001:2022 の認証を取得しています。登録範囲は「ソフトウエアの受託開発および運用」です。

初回登録日：2026年11月7日。登録番号：JP26/00000364。
"""
# 見出しの行を除いた、同じ段落に範囲がある形。範囲を同じ段落に置く規則を満たす
APPROVED_PARAGRAPHS = "\n".join(APPROVED_BLOCK.split("\n")[2:])
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


class PublishedBodiesPassTest(unittest.TestCase):
    def test_published_paragraphs_have_no_errors(self):
        self.assertEqual(errors(APPROVED_PARAGRAPHS), [])

    def test_published_block_with_its_heading_has_no_errors(self):
        # 公開している 5 本の本文の形（太字だけの見出し行 + 次の段落に範囲）。見出しだけの行は、直後の段落と 1 つに数える（decision_records の
        # isms-heading-2026-11-12）。5 本文そのものを当てた結果は PR の本文に書いてある
        self.assertEqual(errors(APPROVED_BLOCK), [])

    def test_published_reference_lines_have_no_errors(self):
        for line in APPROVED_REFERENCES:
            with self.subTest(line=line[:40]):
                self.assertEqual(errors(line + "\n"), [])

    def test_scope_in_the_next_paragraph_is_not_enough_for_a_normal_paragraph(self):
        # 範囲は同じ段落だけ。通常の段落どうしでは、直後の段落は数えない（decision_records の isms-policy-2026-11-12）
        self.assertEqual(errors("ISMS 認証を取得しました。\n\n登録範囲は「ソフトウエアの受託開発および運用」です。\n"), ["isms_scope_missing"])

    def test_scope_in_the_same_paragraph_is_enough(self):
        self.assertEqual(errors("ISMS 認証を取得しました。\n登録範囲は「ソフトウエアの受託開発および運用」です。\n"), [])

    def test_month_level_date_is_enough(self):
        self.assertEqual(errors("2026年11月に ISO/IEC 27001 の認証を取得しました。登録範囲は「ソフトウエアの受託開発および運用」です。\n"), [])

    def test_validity_period_dates_are_allowed(self):
        text = APPROVED_PARAGRAPHS + "\n有効期間は2026年11月7日から2029年11月7日までです。\n"
        self.assertEqual(errors(text), [])

    def test_scope_limiting_sentence_is_not_overreach(self):
        # ISMS 台帳 §2 の注意書き。範囲を広げない文は止めない
        text = "上記は組織の情報セキュリティマネジメントシステム（ISMS）に関する認証の説明です。個別製品、AIの回答精度、医療機器、機能安全、すべての事業や情報漏えいゼロを認証・保証する表現へ拡張しない。\n"
        self.assertEqual(errors(text), [])
        self.assertEqual(errors("ISMS の認証は、Grift の機能を保証するものではありません。\n"), [])
        self.assertEqual(errors("ISMS は組織の認証であり、製品や AI の回答精度の保証ではありません。\n"), [])
        # 否定の形でも、原因と結果でつないだ文は広げている
        self.assertIn("isms_scope_overreach", errors("ISMS 認証済みなので、製品の安全性の保証ではありません、と言い切れます。\n"))

    def test_no_required_phrases(self):
        # 「北極星」「脳に汗」など決まった言い回しを、どの規則でも必須にしない
        for rule in lint.RULES:
            for word in ("北極星", "脳に汗", "通訳"):
                self.assertNotIn(word, rule.pattern.pattern)
        self.assertEqual(errors(APPROVED_PARAGRAPHS), [])


class HeadingGroupingTest(unittest.TestCase):
    """見出しだけの行の束ね方（decision_records の isms-heading-2026-11-12）: Markdown の見出し行か太字だけの 1 行にある取得の表明は、
    空行を 1 つまで挟んだ直後の段落と 1 つに数える。2 つ先、通常の段落どうし、箇条書き・表、見出しの下に段落が無い形は広げない。"""

    SC = "登録範囲は「ソフトウエアの受託開発および運用」です。"

    def ids(self, text: str) -> list[str]:
        return errors(text)

    def test_heading_line_and_bold_only_line_join_the_next_paragraph(self):
        for head in ("## ISMS 認証取得済み", "# ISMS認証取得済み", "###### ISMS認証取得済み", "**ISMS認証取得済み**", "  **ISMS認証取得済み**  "):
            with self.subTest(head=head):
                self.assertEqual(self.ids(f"{head}\n\n{self.SC}\n"), [])
                self.assertEqual(self.ids(f"{head}\n{self.SC}\n"), [])  # 空行なし（同じ段落）

    def test_crlf_text_is_the_same(self):
        self.assertEqual(self.ids(f"**ISMS認証取得済み**\r\n\r\n{self.SC}\r\n"), [])

    # ---- 陰性: 広げない形 ----
    def test_N1_scope_two_paragraphs_below_the_heading(self):
        self.assertEqual(self.ids(f"## ISMS認証取得済み\n\n別の話です。\n\n{self.SC}\n"), ["isms_scope_missing"])

    def test_N2_no_paragraph_below_the_heading(self):
        self.assertEqual(self.ids(f"## ISMS認証取得済み\n\n## 次の見出し\n\n{self.SC}\n"), ["isms_scope_missing"])
        self.assertEqual(self.ids("## ISMS認証取得済み\n"), ["isms_scope_missing"])
        self.assertEqual(self.ids(f"**ISMS認証取得済み**\n\n**次の太字**\n\n{self.SC}\n"), ["isms_scope_missing"])
        self.assertEqual(self.ids("**ISMS認証取得済み**"), ["isms_scope_missing"])

    def test_N3_bold_only_part_of_the_line_is_a_normal_paragraph(self):
        self.assertEqual(self.ids(f"**ISMS認証取得済み**です。\n\n{self.SC}\n"), ["isms_scope_missing"])
        self.assertEqual(self.ids(f"当社は**ISMS認証取得済み**です。\n\n{self.SC}\n"), ["isms_scope_missing"])

    def test_N4_scope_is_below_the_heading_but_so_is_an_extension(self):
        text = f"**ISMS認証取得済み**\n\n{self.SC}ISMSにより全社の安全性を保証します。\n"
        self.assertEqual(self.ids(text), ["isms_scope_overreach"])

    def test_N5_two_blank_lines_are_not_adjacent(self):
        self.assertEqual(self.ids(f"**ISMS認証取得済み**\n\n\n{self.SC}\n"), ["isms_scope_missing"])

    def test_N6_list_table_and_quote_below_the_heading_are_not_a_paragraph(self):
        for block in (f"- {self.SC}", f"| 範囲 | ソフトウエアの受託開発および運用 |", f"> {self.SC}", f"1. {self.SC}"):
            with self.subTest(block=block[:12]):
                self.assertEqual(self.ids(f"## ISMS認証取得済み\n\n{block}\n"), ["isms_scope_missing"])

    def test_N7_a_post_without_a_heading_keeps_the_same_paragraph_rule(self):
        # SNS の投稿文のように見出しを持たない文
        self.assertEqual(self.ids(f"ISMS 認証を取得しました。\n\n{self.SC}\n"), ["isms_scope_missing"])
        self.assertEqual(self.ids(f"ISMS 認証を取得しました。{self.SC}\n"), [])

    def test_N8_a_claim_in_a_normal_paragraph_below_a_heading_is_not_joined_upwards(self):
        # 範囲が見出しにあって、取得の文が下の段落にある形は、同じ段落ではない
        self.assertEqual(self.ids(f"## {self.SC}\n\nISMS 認証を取得しました。\n"), ["isms_scope_missing"])

    def test_N9_a_heading_does_not_pull_in_the_paragraph_after_a_claim_in_a_list(self):
        self.assertEqual(self.ids(f"- ISMS 認証取得済み\n- {self.SC}\n"), [])  # 同じ段落（連続する行）は今のまま
        self.assertEqual(self.ids(f"- ISMS 認証取得済み\n\n- {self.SC}\n"), ["isms_scope_missing"])


class FrontmatterAndValidityTest(unittest.TestCase):
    """frontmatter の扱い（現状の記録。この回では変えていない）と、有効期間の文の日付。"""

    SC = "登録範囲は「ソフトウエアの受託開発および運用」です。"

    def test_lint_reads_frontmatter_lines_as_ordinary_lines(self):
        # frontmatter は特別扱いされない。YAML の行は続く 1 つの段落として数えるので、title の取得と description の範囲は同じ段落になる
        both = f'---\ntitle: "ISMS 認証を取得しました"\ndescription: "{self.SC}"\n---\n\n本文です。\n'
        title_only = '---\ntitle: "ISMS 認証を取得しました"\ndescription: "お知らせです。"\n---\n\n本文です。\n'
        self.assertEqual(errors(both), [])
        self.assertEqual(errors(title_only), ["isms_scope_missing"])

    def test_validity_period_sentence_is_not_a_date_mismatch(self):
        # #527 のニュース本文の文（有効期間は A から B です）。「有効」より後ろの日付は有効期間として数える
        self.assertEqual(errors("認証機関はSGSジャパン、登録番号はJP26/00000364、有効期間は2026年11月7日から2029年11月7日です。\n"), [])
        self.assertEqual(errors(f"2026年11月7日に ISMS 認証を取得し、有効期間は2026年11月7日から2029年11月7日までです。{COND}{self.SC}\n"), [])
        self.assertIn("isms_date_mismatch", errors("有効期間は2026年11月8日から2029年11月7日です。\n"))
        self.assertIn("isms_date_mismatch", errors(f"2026年11月8日に ISMS 認証を取得し、有効期間は2026年11月7日から2029年11月7日までです。{self.SC}\n"))


class NegativeCaseTest(unittest.TestCase):
    """陰性例。落ちることを固定する。"""

    def assertRule(self, text: str, rule_id: str, **kw):
        found = errors(text, **kw)
        self.assertIn(rule_id, found, f"{text!r} で {rule_id} が出ない（出た error: {found}）")

    def test_certified_without_scope_is_scope_missing(self):
        self.assertRule("ISMS 認証取得済みです。\n", "isms_scope_missing")

    def test_scope_two_paragraphs_away_is_missing(self):
        self.assertRule("ISMS 認証取得済みです。\n\n別の話です。\n\n登録範囲は「ソフトウエアの受託開発および運用」です。\n", "isms_scope_missing")

    def test_scope_in_the_next_paragraph_is_missing(self):
        self.assertRule("ISMS 認証取得済みです。\n\n登録範囲は「ソフトウエアの受託開発および運用」です。\n", "isms_scope_missing")

    def test_unrecorded_certifications(self):
        for text in ("プライバシーマークを取得しています\n", "SOC 2 認証済み\n", "Pマークを取得しました。\n", "SCS 認証を取得しました。\n"):
            with self.subTest(text=text):
                self.assertRule(text, "cert_unverified")

    def test_overreach(self):
        for text in (
            "ISMS認証済みなので、AIが誤回答することはありません\n",  # 原因と結果でつなぐ形
            "全事業・全製品が ISMS 認証済み\n",
            "ISMS 認証を取得したので、医療機器としても安心です。\n",
            "ISMS 認証があるので、情報漏えいゼロです。\n",
        ):
            with self.subTest(text=text):
                self.assertRule(text, "isms_scope_overreach")

    def test_limiting_phrase_does_not_cancel_a_different_clause(self):
        # 2026-11-12T09:25Z の実測: 今の lint で指摘なしだった入力。肯定の拡張が、同じ文の別の対象への限定句で打ち消されない
        text = "ISMS認証取得済みなのでソフトウエアの受託開発および運用が対象です。ISMSにより全社の安全性を保証し、これはAIの精度保証を意味しません。\n"
        self.assertRule(text, "isms_scope_overreach")
        for variant in (
            "ISMSにより全社の安全性を保証し、これはAIの精度保証を意味しません。登録範囲は「ソフトウエアの受託開発および運用」です。\n",
            "ISMS 認証は、ソフトウエアの受託開発および運用が対象であり、製品は保証しますが、AIの精度保証はしません。登録範囲は「ソフトウエアの受託開発および運用」です。\n",
        ):
            with self.subTest(variant=variant[:30]):
                self.assertRule(variant, "isms_scope_overreach")

    def test_limiting_phrase_on_the_same_clause_still_passes(self):
        for text in (
            "ISMS 認証は、Grift の機能を保証するものではありません。\n",
            "ISMS は、個別製品、AIの回答精度、医療機器、機能安全、すべての事業や情報漏えいゼロを保証するものではありません。\n",
            "ISMS の対象は、ソフトウエアの受託開発および運用で、製品は範囲外です。\n",
        ):
            with self.subTest(text=text[:30]):
                self.assertEqual([e for e in errors(text) if e == "isms_scope_overreach"], [])

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
        self.assertEqual(errors(APPROVED_PARAGRAPHS, record=rec), [])
        rec["isms"]["status"] = "registration_expected"
        self.assertRule(APPROVED_PARAGRAPHS, "isms_status_mismatch", record=rec)
        # 同じ記録なら、予定の説明は止めない（記録に追随する）
        self.assertEqual(errors("ISMS の第2段階審査を終え、認証登録を見込んでいます\n", record=rec), [])

    def test_every_non_registered_status_blocks_the_claim(self):
        for status in ("unconfirmed", "audit_completed", "suspended", "withdrawn", "expired"):
            with self.subTest(status=status):
                rec = facts()
                rec["isms"]["status"] = status
                self.assertRule(APPROVED_PARAGRAPHS, "isms_status_mismatch", record=rec)

    def test_as_of_outside_the_validity_period_blocks_the_claim(self):
        self.assertRule(APPROVED_PARAGRAPHS, "isms_status_mismatch", as_of=date(2026, 11, 6))
        self.assertRule(APPROVED_PARAGRAPHS, "isms_status_mismatch", as_of=date(2029, 11, 8))
        rec = facts()
        rec["isms"]["valid_to"] = "2026-11-10"  # valid_to を検査日より前にした記録
        self.assertRule(APPROVED_PARAGRAPHS, "isms_status_mismatch", record=rec)


class ReviewCounterexampleTest(unittest.TestCase):
    """反例のうち、閉じたもの。分類は、取得の言い換え・全角、日付と番号の表記、認証名の表記ゆれ、限定句と範囲の拡大。
    閉じていないものは ADR-0029 の「限界」に列挙する（他言語、見出しと別の段落、別の段落への拡大、和暦・英語の日付、別形式の番号）。"""

    SC = "登録範囲は「ソフトウエアの受託開発および運用」です。"
    CLOSED = {
        # 取得の言い換えと全角
        "適合": ("Cor.株式会社は ISO/IEC 27001 に適合しています。\n", "isms_scope_missing"),
        "認証を得ました": ("ISMS 認証を得ました。\n", "isms_scope_missing"),
        "取得。体言止め": ("2026年11月、ISMS を取得。\n", "isms_scope_missing"),
        "全角ＩＳＭＳ": ("ＩＳＭＳ認証取得済みです。\n", "isms_scope_missing"),
        # 日付と番号の表記
        "年なしの11月11日": ("ISMS 認証は11月11日に取得しました。%s\n", "isms_date_mismatch"),
        "令和（月日で照合）": ("ISMS 認証は令和8年11月11日に取得しました。%s\n", "isms_date_mismatch"),
        "スラッシュの日付": ("ISMS 認証を2026/11/11に取得しました。%s\n", "isms_date_mismatch"),
        "全角の登録番号": ("ISMS 認証を取得しています（登録番号 ＪＰ２６／００００００３６５）。%s\n", "isms_number_mismatch"),
        "取得は2026年12月": ("ISMS 認証の取得は2026年12月です。%s\n", "isms_date_mismatch"),
        "有効期間の終わりが違う": ("ISMS 認証を取得しています。%s 有効期間は2030年11月7日までです。\n", "isms_date_mismatch"),
        # 認証名の表記ゆれと言い換え
        "ISO 27017": ("ISO 27017 の認証を取得しました。\n", "cert_unverified"),
        "付与認定": ("当社はプライバシーマークの付与認定を受けています。\n", "cert_unverified"),
        "ISO27701": ("ISO27701 認証を取得しました。\n", "cert_unverified"),
        "名前と動詞が離れる": ("プライバシーマーク制度に基づく審査を経て、正式に付与を受け取得しています。\n", "cert_unverified"),
        # 古い状態の言い換え
        "登録の見込み": ("ISMS は現在、登録の見込みです。\n", "isms_stale_state"),
        "認証審査中": ("ISMS は現在、認証審査中です。\n", "isms_stale_state"),
        "登録見込み": ("ISMS は12月登録見込みです。\n", "isms_stale_state"),
        "全角の第２段階": ("ISMS の第２段階審査を終え、登録を待っています。\n", "isms_stale_state"),
        "取得を予定": ("ISMS 認証の取得を予定しています。\n", "isms_stale_state"),
        "審査が完了し": ("ISMS の第2段階審査が完了し、登録を待つ段階です。\n", "isms_stale_state"),
        # 限定句と範囲の拡大
        "範囲外と言いながら及ぶ": ("ISMS 認証は登録範囲外の Grift にも及び、万全です。%s\n", "isms_scope_overreach"),
        "全サービス": ("ISMS 認証を取得し、全サービスのセキュリティが保証されています。%s\n", "isms_scope_overreach"),
        "別の対象の限定句": ("ISMS認証取得済みなのでソフトウエアの受託開発および運用が対象です。ISMSにより全社の安全性を保証し、これはAIの精度保証を意味しません。\n", "isms_scope_overreach"),
        "別の対象の限定句の 2 文目": ("ISMSにより全社の安全性を保証し、これはAIの精度保証を意味しません。\n", "isms_scope_overreach"),
        "範囲が直後の段落": ("ISMS 認証取得済みです。\n\n%s\n", "isms_scope_missing"),
    }
    PASSING = {
        "年なしの11月7日": "ISMS 認証は11月7日に取得しました。%s\n",
        "2026年11月": "2026年11月に ISMS 認証を取得しました。%s\n",
        "有効期間の終わりが正しい": "ISMS 認証を取得しています。%s 有効期間は2029年11月7日までです。" + COND + "\n",
        "否定の限定句": "ISMS を取得しても、完全な防御にはなりません。\n",
        "取得していなかった": "ISMS を取得していなかった頃の話です。\n",
        "範囲が同じ項目": "- ISMS 認証取得済み。%s\n",
    }

    def test_closed_counterexamples_are_stopped(self):
        for name, (text, rule) in self.CLOSED.items():
            with self.subTest(case=name):
                found = errors(text.replace("%s", self.SC))
                self.assertIn(rule, found, f"{name}: {rule} が出ない（出た error: {found}）")

    def test_neighbours_of_the_closed_counterexamples_still_pass(self):
        for name, text in self.PASSING.items():
            with self.subTest(case=name):
                found = errors(text.replace("%s", self.SC))
                self.assertEqual(found, [], f"{name}: 通るべき文が止まる（{found}）")

    def test_vocabulary_lives_in_the_record(self):
        # 取得の語彙・古い状態の語は facts.json にある（lint と guardrails が同じ記録を読む）。記録から語を引くと検出も落ちる
        rec = facts()
        rec["acquisition"] = [p for p in rec["acquisition"] if p != "認証を得(?:ました|ています|た)"]
        self.assertEqual(errors("ISMS 認証を得ました。\n", record=rec), [])
        self.assertIn("isms_scope_missing", errors("ISMS 認証を得ました。\n"))


class ParagraphOverreachTest(unittest.TestCase):
    """範囲を広げる文が、ISMS の文とは別の文にあっても、同じ段落なら止める。
    単位は通常の段落。別の段落、箇条書き・表・引用の別の行は束ねない（参考資料の一覧で別の項目の語を結びつけない）。"""

    SC = "登録範囲は「ソフトウエアの受託開発および運用」です。"

    def over(self, text: str) -> list[int]:
        return [h.line for h in hits(text.replace("%s", self.SC)) if h.rule_id == "isms_scope_overreach"]

    def test_extension_in_another_sentence_of_the_same_paragraph_is_stopped(self):
        # 拡大が取得の文の次の文にある形
        self.assertEqual(self.over("ISMS 認証を取得しています。%s だから当社の AI は誤回答しません。\n"), [1])
        self.assertEqual(self.over("ISMS 認証を取得しています。\n%s\nだから当社は情報漏洩ゼロです。\n"), [3])

    def test_the_other_sentence_alone_without_isms_in_the_paragraph_passes(self):
        self.assertEqual(self.over("だから当社の AI は誤回答しません。\n"), [])

    def test_a_different_paragraph_is_not_joined(self):
        self.assertEqual(self.over("ISMS 認証を取得しています。%s\n\nだから当社の AI は誤回答しません。\n"), [])

    def test_list_items_table_rows_and_quotes_are_not_joined(self):
        for other in ("- だから当社の AI は誤回答しません。", "| だから当社の AI は誤回答しません。 |", "> だから当社の AI は誤回答しません。", "2. だから当社の AI は誤回答しません。"):
            with self.subTest(other=other):
                self.assertEqual(self.over(f"- ISMS 認証を取得しています。%s\n{other}\n"), [])

    def test_a_limiter_in_the_same_clause_still_clears_it(self):
        self.assertEqual(self.over("ISMS 認証を取得しています。%s 認証は AI の回答精度を保証するものではありません。\n"), [])

    def test_published_bodies_still_pass(self):
        self.assertEqual(errors(APPROVED_BLOCK), [])
        self.assertEqual(errors("\n".join(APPROVED_REFERENCES)), [])


class RegisteredSentenceTest(unittest.TestCase):
    """登録後の正しい文を止めない。正しい文のうち、「認証登録を完了しました」を使う文と、審査日と登録日を同じ文に書く文が、止まっていた。
    正しい文を通し、誤った文 7 本（と、審査の語と同じ文に誤った日付がある文など 4 本）が止まるままであることを、同じ試験で固定する。"""

    SC = "登録範囲は「ソフトウエアの受託開発および運用」です。"
    CORRECT = {
        "ok3 登録を完了（同年の登録日）": "2026年10月に第2段階審査を終え、同年11月7日に当社の ISMS 認証登録を完了しました。%s登録番号は JP26/00000364 です。\n",
        "v3 審査日と登録日を同じ文に書く": "第2段階審査を2026年10月7日に終え、その後、11月7日に ISO/IEC 27001 の認証を取得しました。%s\n",
        "ok1 範囲と番号": "2026年11月に ISO/IEC 27001:2022 の認証を取得しました。%s登録番号は JP26/00000364 です。\n",
        "登録が完了した（日付つき）": "11月7日に ISMS 認証の登録が完了しました。%s\n",
    }
    WRONG = {
        "範囲なし": ("ISMS 認証を取得しました。\n", "isms_scope_missing"),
        "全社・万全": ("ISMS 認証を取得し、全社の安全を万全に保証します。%s\n", "isms_scope_overreach"),
        "番号違い": ("ISMS 認証を取得しました。%s登録番号は JP26/00000365 です。\n", "isms_number_mismatch"),
        "Grift も対象": ("ISMS 認証を取得しており、Grift も対象です。%s\n", "isms_scope_overreach"),
        "旧表記": ("ISMS の第2段階審査を終え、2026年12月ごろの認証登録を見込んでいます。\n", "isms_stale_state"),
        "日付違い（11月8日）": ("11月8日に ISMS 認証を取得しました。%s\n", "isms_date_mismatch"),
        "プライバシーマーク": ("プライバシーマークを取得しました。\n", "cert_unverified"),
        # 審査の語と同じ文でも、取得の節の日付が違えば止める（「審査の語がある文の日付は数えない」と広げた修正を落とす）
        "審査の語と同じ文で、取得の日付が違う": ("第2段階審査を終え、11月8日に ISMS 認証を取得しました。%s\n", "isms_date_mismatch"),
        # 取得の語と同じ節に審査の語がある日付は、取得日として数える
        "審査を経て、取得の日付が違う": ("審査を経て2026年11月8日に ISMS 認証を取得しました。%s\n", "isms_date_mismatch"),
        "登録を完了（範囲なし）": ("2026年11月7日に ISMS 認証登録を完了しました。\n", "isms_scope_missing"),
        "登録を完了（日付違い）": ("2026年11月8日に ISMS 認証登録を完了しました。%s\n", "isms_date_mismatch"),
    }

    def test_correct_sentences_after_registration_are_not_stopped(self):
        for name, text in self.CORRECT.items():
            with self.subTest(case=name):
                found = errors(text.replace("%s", self.SC))
                self.assertEqual(found, [], f"{name}: 正しい文が止まる（{found}）")

    def test_wrong_sentences_are_still_stopped(self):
        for name, (text, rule) in self.WRONG.items():
            with self.subTest(case=name):
                found = errors(text.replace("%s", self.SC))
                self.assertIn(rule, found, f"{name}: {rule} が出ない（出た error: {found}）")

    def test_a_pre_registration_sentence_is_still_stale_even_with_an_audit_date(self):
        # 審査の語の節の日付を取得日として数えなくなっても、登録前の状態の説明（12月ごろ・見込み）は止まる
        self.assertIn("isms_stale_state", errors("2026年10月7日に第2段階審査を終え、12月ごろの ISMS 認証登録を見込んでいます。\n"))


class RecordToTextLinkTest(unittest.TestCase):
    """記録 ↔ 本文の結線。片方だけ変えると、記録の値と本文の値の両方を挙げて落ちる（宣言と実体の二重管理）。"""

    def message_for(self, rule_id: str, record: dict) -> str:
        found = [h for h in hits(APPROVED_PARAGRAPHS, record=record) if h.rule_id == rule_id]
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

    def test_decision_records_have_only_the_allowed_fields(self):
        # 公開の記録の欄は allow-list（id・decided_at・summary の 3 つだけ）。欄が増える・減ると落ちる
        records = facts()["isms"]["decision_records"]
        self.assertEqual([r["id"] for r in records], ["isms-policy-2026-11-12", "isms-heading-2026-11-12"])
        for rec in records:
            with self.subTest(id=rec["id"]):
                self.assertEqual(sorted(rec), sorted(lint.DECISION_KEYS))
                self.assertEqual(sorted(lint.DECISION_KEYS), ["decided_at", "id", "summary"])
                self.assertRegex(rec["decided_at"], r"^\d{4}-\d{2}-\d{2}$")
                self.assertTrue(rec["summary"].strip())

    def test_adr_and_skill_cite_every_decision_by_id_and_date(self):
        adr = (SKILLS.parents[1] / "docs/adr/ADR-0029-company-facts-record.md").read_text(encoding="utf-8")
        for rec in facts()["isms"]["decision_records"]:
            for key in ("id", "decided_at"):
                self.assertIn(rec[key], adr, f"ADR-0029 に facts.json の decision_records[{rec['id']}] の {key}（{rec[key]}）がありません")

    def test_record_is_the_published_fact(self):
        isms = facts()["isms"]
        self.assertEqual((isms["status"], isms["standard"], isms["registration_number"], isms["scope"]), ("registered", "ISO/IEC 27001:2022", "JP26/00000364", "ソフトウエアの受託開発および運用"))
        self.assertEqual((isms["issuer"], isms["valid_from"], isms["valid_to"], isms["confirmed_on"]), ("SGSジャパン株式会社", "2026-11-07", "2029-11-07", "2026-11-11"))
        # 再確認（decision_records の isms-policy-2026-11-12）: 更新のきっかけと、期限・条件の保持。期限まで無条件に有効とは扱わない
        self.assertIn("維持審査の結果・範囲変更・停止等が判明した時", isms["recheck"])
        self.assertIn("2029-11-07", isms["recheck"])
        self.assertIn("期限まで無条件に有効とは扱わない", isms["recheck"])
        self.assertNotIn("それまでは", isms["recheck"])
        self.assertEqual(isms["validity_condition"], "有効期間中の維持審査にて登録の継続が認められる限り有効")
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
        for key in ("scope", "status", "valid_from", "forbidden_extensions", "stale_state_phrases", "decision_records"):
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

    def load_error(self, rec: dict) -> str:
        tmp = Path(tempfile.mkdtemp()) / "facts.json"
        tmp.write_text(json.dumps(rec, ensure_ascii=False), encoding="utf-8")
        with self.assertRaises(lint.FactRecordError) as ctx:
            lint.load_facts(tmp)
        return str(ctx.exception)

    def test_decision_record_with_an_extra_field_is_invalid(self):
        # 3 つの欄（id・decided_at・summary）以外が 1 つでもあれば止める。観測した欄の名前を、メッセージに出す
        for extra in ("quote", "route", "decided_by", "options", "note", "source_ref"):
            with self.subTest(extra=extra):
                rec = json.loads((lint.FACTS_PATH).read_text(encoding="utf-8"))
                rec["facts"][0]["decision_records"][0][extra] = "x"
                self.assertIn("fact_record_invalid", self.run_with_record(json.dumps(rec, ensure_ascii=False)))
                message = self.load_error(rec)
                self.assertIn(extra, message)
                self.assertIn("観測した欄", message)

    def test_decision_record_missing_a_field_or_blank_is_invalid(self):
        for key in lint.DECISION_KEYS:
            with self.subTest(missing=key):
                rec = json.loads((lint.FACTS_PATH).read_text(encoding="utf-8"))
                del rec["facts"][0]["decision_records"][0][key]
                self.assertIn("fact_record_invalid", self.run_with_record(json.dumps(rec, ensure_ascii=False)))
                self.assertIn("観測した欄", self.load_error(rec))
            with self.subTest(blank=key):
                rec = json.loads((lint.FACTS_PATH).read_text(encoding="utf-8"))
                rec["facts"][0]["decision_records"][0][key] = " "
                self.assertIn("fact_record_invalid", self.run_with_record(json.dumps(rec, ensure_ascii=False)))

    def test_decision_record_date_must_be_a_day_and_ids_unique(self):
        rec = json.loads((lint.FACTS_PATH).read_text(encoding="utf-8"))
        rec["facts"][0]["decision_records"][0]["decided_at"] = "2026-11-12T09:23:37.773Z"
        self.assertIn("fact_record_invalid", self.run_with_record(json.dumps(rec, ensure_ascii=False)))
        rec = json.loads((lint.FACTS_PATH).read_text(encoding="utf-8"))
        rec["facts"][0]["decision_records"][1]["id"] = rec["facts"][0]["decision_records"][0]["id"]
        self.assertIn("重複", self.load_error(rec))
        rec = json.loads((lint.FACTS_PATH).read_text(encoding="utf-8"))
        rec["facts"][0]["decision_records"] = []
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


class ReviewFixesTest(unittest.TestCase):
    """レビューで見つかった穴（--archive の日付、記録に無い認証の名前、取得の語彙、保有・付与、日の形、型の誤り、古い状態の言い方）を
    閉じた試験。直す前の lint では、どれも通る（落ちない）形だった。"""

    SC = "登録範囲は「ソフトウエアの受託開発および運用」です。"
    OLD_SECTION = (
        "以下は2026年10月20日に公開した、認証登録前のお知らせです。\n\n"
        "## 第2段階審査の終了\n\n"
        "Cor.株式会社は2026年10月7日に、情報セキュリティマネジメントシステム（ISMS）の国際規格 ISO/IEC 27001 の第2段階審査を終えました。\n\n"
        "認証の登録は2026年12月ごろを見込んでいます。登録が完了するまでは「認証取得済み」とは表記せず、登録後にあらためてお知らせします。\n"
    )

    def test_M1_archive_also_allows_the_pre_registration_date(self):
        # 日付つきの過去の記録（--archive の範囲）は、古い状態の説明と、登録前の予定日の両方を許す
        found = errors(self.OLD_SECTION)
        self.assertIn("isms_stale_state", found)
        self.assertIn("isms_date_mismatch", found)
        last = len(self.OLD_SECTION.splitlines())
        self.assertEqual(errors(self.OLD_SECTION, archive=frozenset(range(1, last + 1))), [])
        # 範囲の外の行は許さない（archive が当たっていない行の日付は止まる）
        self.assertIn("isms_date_mismatch", errors(self.OLD_SECTION, archive=frozenset({1})))

    def test_M1_the_published_news_page_passes_with_its_old_section_archived(self):
        news = SKILLS.parents[1] / "src" / "content" / "news" / "ja" / "isms-stage2-audit.md"
        lines = news.read_text(encoding="utf-8").split("\n")
        start = next(i for i, line in enumerate(lines, 1) if line.startswith("以下は2026年10月20日に公開した"))
        archived = frozenset(range(start, len(lines) + 1))
        found = [(h.line, h.rule_id) for h in lint.check_facts_text("\n".join(lines), as_of=date(2026, 11, 15), archive_lines=archived)]
        self.assertEqual(found, [], f"お知らせの旧い節（{start} 行目から）を archive にしても残る指摘: {found}")

    def test_M4_correct_acquisition_sentences_are_not_stale(self):
        for verb in ("認証を取得しました", "登録済みとなりました", "認証を受けました"):
            with self.subTest(verb=verb):
                text = f"ISMS は第2段階審査を終え、2026年11月7日に{verb}。{self.SC}\n"
                self.assertEqual(errors(text), [], f"{verb}: 正しい文が止まる")

    def test_M4_the_acquisition_vocabulary_is_the_record_only(self):
        # 語彙が lint の中にもう 1 つ在ると、記録から語を引いても「古い状態」の判定は変わらない。記録だけを見るので、変わる
        text = f"ISMS は第2段階審査を終え、2026年11月7日に認証を受けました。{self.SC}\n"
        rec = facts()
        rec["acquisition"] = [p for p in rec["acquisition"] if p != "認証を受け"]
        self.assertIn("isms_stale_state", errors(text, record=rec))
        self.assertNotIn("COMPLETED_WORDS", (Path(lint.__file__)).read_text(encoding="utf-8"))

    def test_M2_certifications_without_a_record_are_stopped(self):
        for text in (
            "ISO/IEC 42001（AI マネジメントシステム）の認証を取得しました。\n",
            "ISO 42001 認証を取得しています。\n",
            "JIS Q 15001 の認証を取得しています。\n",
            "TISAX の認証を取得済みです。\n",
            "CSA STAR の認証を取得しました。\n",
        ):
            with self.subTest(text=text):
                self.assertIn("cert_unverified", errors(text))

    def test_M5_holding_and_being_granted_are_acquisition_claims(self):
        for text in ("当社は ISMS 認証を保有しています。\n", "ISMS（ISO/IEC 27001）の認証を、SGS から付与されています。\n"):
            with self.subTest(text=text):
                self.assertIn("isms_scope_missing", errors(text))
                with_scope = text + self.SC + "\n"
                self.assertEqual(errors(with_scope), [])
                rec = facts()
                rec["isms"]["status"] = "registration_expected"
                self.assertIn("isms_status_mismatch", errors(with_scope, record=rec))
        # 範囲を広げる文は、保有でも止める
        self.assertIn("isms_scope_overreach", errors(f"当社は ISMS 認証を保有しており、Grift も対象です。{self.SC}\n"))

    def test_L3_will_be_registered_is_a_stale_state(self):
        self.assertIn("isms_stale_state", errors("ISMS は12月に登録される予定です。\n"))
        self.assertIn("isms_stale_state", errors("ISMS は12月に登録の予定です。\n"))

    def test_L1_dates_must_be_in_the_day_form(self):
        for field, bad_value in (("decided_at", "20261112"), ("decided_at", "2026-W46-4")):
            with self.subTest(field=field, value=bad_value):
                rec = json.loads(lint.FACTS_PATH.read_text(encoding="utf-8"))
                rec["facts"][0]["decision_records"][0][field] = bad_value
                self.assertIn(bad_value, BrokenRecordTest.load_error(self, rec))
        for key, bad_value in (("valid_from", "20261107"), ("valid_to", "2029-W45-3")):
            with self.subTest(key=key, value=bad_value):
                rec = json.loads(lint.FACTS_PATH.read_text(encoding="utf-8"))
                rec["facts"][0][key] = bad_value
                self.assertIn(bad_value, BrokenRecordTest.load_error(self, rec))
        for value in ("20261112", "2026-W46-4"):
            with self.subTest(as_of=value), self.assertRaises(SystemExit) as ctx:
                lint.main(["check", "--as-of", value, str(SKILLS / "cor-voice" / "references" / "facts.json")])
            self.assertEqual(ctx.exception.code, 2)

    def test_L2_wrong_types_stop_with_the_observed_value(self):
        rec = json.loads(lint.FACTS_PATH.read_text(encoding="utf-8"))
        rec["facts"][0]["decision_records"][0]["id"] = 123
        self.assertIn("123", BrokenRecordTest.load_error(self, rec))
        rec = json.loads(lint.FACTS_PATH.read_text(encoding="utf-8"))
        rec["facts"][0]["forbidden_extensions"][0]["terms"] = [1, 2]
        self.assertIn("観測した値", BrokenRecordTest.load_error(self, rec))
        rec = json.loads(lint.FACTS_PATH.read_text(encoding="utf-8"))
        rec["facts"][0]["valid_to"] = 20291107
        self.assertIn("20291107", BrokenRecordTest.load_error(self, rec))

    def test_L6_story_spine_carries_the_recorded_scope_and_date(self):
        # docs/story-spine.md は、範囲と登録日を写しで持つ。記録を変えると、記録の値と文書の値の両方を挙げて落ちる
        isms = lint.load_facts()["isms"]
        text = (SKILLS.parents[1] / "docs" / "story-spine.md").read_text(encoding="utf-8")
        y, m, d = (int(x) for x in isms["valid_from"].split("-"))
        for label, want in (("登録範囲", isms["scope"]), ("登録日", f"{y} 年 {m} 月 {d} 日")):
            self.assertIn(want, text, f"記録の{label}は「{want}」。docs/story-spine.md に無い（記録: {isms['scope']} / {isms['valid_from']}）")


class LimiterAndValidityConditionTest(unittest.TestCase):
    """限定句は、否定の述語として節の終わりにあるときだけ拡大を打ち消す。有効期間を書く段落には、記録の有効の条件が要る。"""

    SC = "登録範囲は「ソフトウエアの受託開発および運用」です。"

    def over(self, text: str) -> list[str]:
        return errors(text.replace("%s", self.SC))

    def test_limiter_in_the_middle_of_a_clause_does_not_cancel_the_extension(self):
        # 限定句の語があっても、意味が逆の文は止める
        self.assertIn("isms_scope_overreach", self.over("ISMS の認証は、登録範囲外の Grift にも適用されます。%s\n"))
        self.assertIn("isms_scope_overreach", self.over("ISMS 認証は全社を対象外のない形で取得しています。%s\n"))

    def test_limiter_at_the_end_of_a_clause_still_cancels_it(self):
        for text in (
            "ISMS 認証を取得しています。%s Grift は登録範囲外です。\n",
            "ISMS 認証を取得しています。%s Grift は対象に含まれません。\n",
            "ISMS 認証を取得しています。%s 認証は AI の回答精度を保証するものではありません。\n",
            "ISMS を取得しても、完全な防御にはなりません。\n",
            # 限定句のあとに理由の語（からである・ため）が続く説明の文（ADR の本文にある形）
            "範囲を併記させるのは、ISMS の認証が製品や AI の回答精度の保証ではないからである。\n",
        ):
            with self.subTest(text=text):
                self.assertEqual(self.over(text), [])

    # 正しく範囲を限った文のうち、よくある言い方（となります・としています・であり・で・が など）。直す前の lint では、6 つとも止まる
    CORRECT_LIMITING = {
        "となります": "Grift は ISMS の対象外となります。%s\n",
        "としています": "Grift は ISMS の範囲外としています。%s\n",
        "であり（節を切る）": "Grift は ISMS の範囲外であり、受託開発の運用だけが対象です。%s\n",
        "で（節を切る）": "製品は ISMS の対象外で、受託開発の運用だけが対象です。%s\n",
        "が（節を切る）": "ISMS 認証は AI の回答精度を保証しませんが、運用の仕組みは審査を受けています。%s\n",
        "になります": "Grift は ISMS の対象外になります。%s\n",
    }
    # 意味が逆の文。限定句の語があっても、止めたままにする
    REVERSED = {
        "範囲外の Grift に適用": "ISMS の認証は、登録範囲外の Grift にも適用されます。%s\n",
        "対象外のない形": "ISMS 認証は全社を対象外のない形で取得しています。%s\n",
        "範囲外の製品に及ぶ": "ISMS 認証は範囲外の製品にも及びます。%s\n",
        "対象外ではありません": "Grift は対象外ではありません。ISMS の認証を受けています。%s\n",
        "含みませんという誤解": "ISMS は、Grift も含みませんという誤解がありますが、実際は Grift も対象です。%s\n",
    }

    def test_correct_limiting_sentences_with_common_endings_pass(self):
        for name, text in self.CORRECT_LIMITING.items():
            with self.subTest(case=name):
                found = self.over(text)
                self.assertEqual(found, [], f"{name}: 正しく限った文が止まる（{found}）")

    def test_reversed_sentences_with_a_limiter_word_stay_blocked(self):
        for name, text in self.REVERSED.items():
            with self.subTest(case=name):
                found = self.over(text)
                self.assertIn("isms_scope_overreach", found, f"{name}: 意味が逆の文が通る（{found}）")

    def test_limiter_with_a_causal_word_still_does_not_cancel(self):
        self.assertIn("isms_scope_overreach", self.over("ISMS 認証を取得済みなので、Grift は対象外です。%s\n"))

    def test_validity_period_needs_the_condition_in_the_same_paragraph(self):
        period = "有効期間は2026年11月7日から2029年11月7日です。"
        base = f"Cor.株式会社は ISMS 認証を取得しています。{self.SC}{period}"
        self.assertEqual(errors(base), ["isms_validity_condition_missing"])
        self.assertEqual(errors(base + COND), [])
        # 条件が次の段落では足りない（同じ段落）。箇条書き・表・引用は 1 行ごとに別の単位
        self.assertEqual(errors(base + "\n\n" + COND), ["isms_validity_condition_missing"])
        self.assertEqual(errors(f"- ISMS 認証の{period}{self.SC}"), ["isms_validity_condition_missing"])
        self.assertEqual(errors(f"- ISMS 認証の{period}{COND}{self.SC}"), [])

    def test_validity_period_of_something_else_is_not_checked(self):
        # ISMS の語が無い段落の有効期間（クーポン・契約など）は見ない。日付の無い「有効期間中」の文も見ない
        # （クーポンの日付は、別の規則 isms_date_mismatch が既に見る。ここで見るのは、有効の条件の規則だけ）
        self.assertNotIn("isms_validity_condition_missing", errors("このクーポンの有効期間は2026年12月31日までです。\n"))
        self.assertEqual(errors("維持審査は有効期間中に行います。\n"), [])

    def test_archive_block_may_keep_a_validity_period_without_the_condition(self):
        text = "公開当時の記録です。\n\nISMS の有効期間は2026年11月7日から2029年11月7日です。\n"
        self.assertEqual(errors(text), ["isms_validity_condition_missing"])
        self.assertEqual(errors(text, archive=frozenset({3})), [])

    def test_condition_comes_from_the_record_only(self):
        # 片側変異: 記録の条件を別の文にすると、本文の条件の文は照合に合わず、記録の値を挙げて落ちる
        base = f"ISMS 認証を取得しています。{self.SC}有効期間は2026年11月7日から2029年11月7日です。{COND}"
        self.assertEqual(errors(base), [])
        rec = facts()
        rec["isms"]["validity_condition"] = "期限まで有効"
        found = hits(base, record=rec)
        self.assertIn("isms_validity_condition_missing", [h.rule_id for h in found])
        self.assertIn("期限まで有効", " ".join(h.message for h in found))


if __name__ == "__main__":
    unittest.main()
