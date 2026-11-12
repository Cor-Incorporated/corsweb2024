#!/usr/bin/env python3
"""Cor. の対外文に、cor-voice の決まりのうち機械で判定できるものを当てる検査と、文体の統計。

yomiyasu_check.py（nanaism/yomiyasu v2.1.3 の同梱。手を加えない）が見ない、Cor. 固有の決まりだけを見る。
規則の本文は cor-voice/SKILL.md にあり、ここには判定の型と、どの節から来たかだけを置く。
検査の結果は候補で、意味の保持や読みやすさの合格ではない。

ISMS など「いまの事実」は、固定の禁止語ではなく cor-voice/references/facts.json の記録と照合する（ADR-0029）。
記録が読めないときは fact_record_invalid の error で止まり、古い規則へは戻らない。

使い方:
  cor_voice_lint.py check [--scene company|founder|tech|mail|founder-x] [--json] [--fail-on error|warn]
                          [--as-of YYYY-MM-DD] [--archive START-END ...] FILE...
  cor_voice_lint.py stats [--json] FILE...

終了コード: 0 = --fail-on に当たらなかった / 1 = 当たった / 2 = 使い方か入力の誤り
"""
from __future__ import annotations

import argparse
import json
import re
import statistics
import sys
from dataclasses import asdict, dataclass
from datetime import date
from pathlib import Path

SCENES = ("company", "founder", "tech", "mail", "founder-x")


@dataclass(frozen=True)
class Rule:
    rule_id: str
    level: str  # error | warn
    pattern: re.Pattern[str]
    message: str
    source: str
    scenes: tuple[str, ...] = SCENES
    min_count: int = 1  # 文書全体でこの数に達したときだけ候補にする


def _rule(rule_id, level, pattern, message, source, scenes=SCENES, min_count=1):
    return Rule(rule_id, level, re.compile(pattern, re.M), message, source, scenes, min_count)


NOT_FOUNDER_X = ("company", "founder", "tech", "mail")

# 公開を止める決まり（ADR とサイトの表現ルール）は error、文体の型は warn。
RULES: tuple[Rule, ...] = (
    _rule("trial_word", "error", r"試行(?!錯誤)", "「試行」は使わない。紹介会社・採用担当向けは「テスト導入（PoC）」、CTA は「自社でテストしてみる」", "cor-voice §6 / ADR-0022"),
    _rule("evidence_copy", "error", r"証拠は盛れない", "「証拠は盛れない」は使わない。「経歴の説明に、確かめられる根拠を。」", "cor-voice §6A-4"),
    _rule("seven_x_metric", "error", r"(?<![\d.])7\s*倍[^。\n]{0,40}(生産性|開発速度|納品量)|(生産性|開発速度|納品量)[^。\n]{0,40}(?<![\d.])7\s*倍", "「7倍」は GitHub のコントリビュート数。生産性・開発速度・納品量と結びつけない", "cor-voice §6A-4"),
    _rule("company_name", "error", r"Cor\.?\s?[Ii]nc\b|(?<![.．])Cor株式会社|コル株式会社|コア株式会社", "社名は「Cor.株式会社」", "cor-voice §6 / ADR-0007"),
    _rule("absolute_claim", "error", r"100\s*[%％]\s*安全|日本初|業界初|世界初", "根拠と定義のない最上級・保証は書かない", "cor-voice §6 / §6A-4"),
    _rule("strong_claim", "warn", r"確実に|絶対に|絶対(?=[、。だで])|唯一の|最速|完璧", "言い切りの保証や最上級は、根拠と定義が資料にあるときだけ", "cor-voice §6 / §6A-4"),
    _rule("exclamation", "warn", r"[！!]", "感嘆符は使わない（引用と製品名を除く）", "cor-voice §4", NOT_FOUNDER_X),
    # 「Grift CLIとは」のように疑問符の無い見出しは本人の記事にもある（2026-08 の Qiita）。疑問符つきと「何者か」だけを拾う
    _rule("what_is_heading", "warn", r"^#{1,6}\s.*(とは[？?]\s*$|とは何者か)", "「〜とは？」「〜とは何者か」の見出しにしない", "cor-voice §4"),
    _rule("bold_label_colon", "warn", r"^[ \t]*(?:(?:[-*+]|\d+\.)[ \t]+)?\*\*[^*\n]+\*\*[ \t]*[:：]", "太字のラベルとコロンで始める箇条書きにしない", "cor-voice §4"),
    _rule("ellipsis", "warn", r"…", "「…」を多用しない", "cor-voice §4", NOT_FOUNDER_X, 2),
    _rule("cliche", "warn", r"天元突破|断言しよう|未来を変える|過言ではない|革命を起こ|新時代の幕開け", "大げさな決まり文句を持ち込まない", "cor-voice §4"),
    _rule("dialect", "warn", r"(?<!せ)んよね|やねん|やんか|やん[。、！!]", "方言の語尾は足さない（代表個人の X の例外を除く）", "cor-voice §4 / §5", NOT_FOUNDER_X),
    _rule("closed_warai", "warn", r"（笑）|\(笑\)", "「（笑）」は持ち込まない", "cor-voice §4", NOT_FOUNDER_X),
    _rule("free_cta", "warn", r"無料で(お?試|始め|使い始め|ご利用)|今すぐ(無料|お試し)", "CTA で「無料」を主な誘い文句にしない", "cor-voice §6"),
    _rule("price", "warn", r"(?<![\d,，.])\d[\d,，.]*[ \t]*(万円|円)", "価格は資料にあるときだけ。Grift の料金は個別案内", "cor-voice §6"),
    _rule("ai_slop", "warn", r"シームレス|革新的|画期的|ご紹介します|解説します|見ていきましょう|いかがでしたか|寄り添|最大限に活用|と言えるでしょう", "AI の下書きで増えた言い回し。本人の書き方（短く言い切る、確かめた事実を書く）に寄せる", "cor-voice §3 / §4"),
    _rule("company_first_person", "warn", r"(?<![公滅下])(僕|私)(は|が|も|の|に|を|たち|達)", "会社として書く文章で「僕」「私」を使わない", "cor-voice §2", ("company",)),
)

FIRST_PERSON = re.compile(r"(?<![公滅下])(僕|私)(?=は|が|も|の|に|を|たち|達|自身)")


@dataclass(frozen=True)
class Hit:
    rule_id: str
    level: str
    line: int
    text: str
    message: str
    source: str


def strip_frontmatter(text: str) -> tuple[str, str]:
    """先頭の YAML frontmatter と本文に分ける。frontmatter が無ければ空文字と全文。"""
    m = re.match(r"\A---\n(.*?)\n---\n", text, re.S)
    if not m:
        return "", text
    return m.group(1), text[m.end():]


FENCE = re.compile(r"^[ \t]*(`{3,}|~{3,})")


def masked_lines(text: str, keep_blocks: bool = False) -> list[str]:
    """検査しない部分（コード、インラインコード、URL、HTML コメント）を空にした行の配列。行番号は保つ。

    keep_blocks が偽なら、表と引用の行も空にする（文体の規則用）。サイトの表現ルール（error）は、表と引用の中も見る。
    リンクは文字だけを残す（「[こちら](URL)で試行」の「試行」を落とさない）。コードの囲みは、開いたのと同じ記号で
    同じ長さ以上の行が来たときだけ閉じる。
    """
    out: list[str] = []
    fence = ""
    for line in text.split("\n"):
        m = FENCE.match(line)
        if m and (not fence or (m.group(1)[0] == fence[0] and len(m.group(1)) >= len(fence) and not line[m.end():].strip())):
            fence = "" if fence else m.group(1)
            out.append("")
            continue
        if fence or (not keep_blocks and re.match(r"^\s*(\||>)", line)):
            out.append("")
            continue
        line = re.sub(r"`[^`\n]*`", "", line)
        line = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", line)
        line = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", line)
        line = re.sub(r"https?://[!-~]+", "", line)
        line = re.sub(r"<!--.*?-->", "", line)
        out.append(line)
    return out


def _without_quotes(line: str) -> str:
    return re.sub(r"「[^「」]*」|『[^『』]*』", "", line)


# 「『取得済み』とは書きません」「『試行』は使わない」のように、使わない語を説明している引用は数えない
META_MENTION = re.compile(r"[「『][^「『」』]*[」』](?=[ \t]*(?:と|とは|は|も)[ \t]*(?:書かない|書きません|書かず|使わない|使いません|使わず|言わない|言いません|しない|しません|せず|呼ばない|呼びません))")


def _without_meta_mentions(line: str) -> str:
    return META_MENTION.sub("", line)


# ---- 事実の記録（facts.json）との照合 ----
# 「いまの事実」を固定の禁止語で止めると、事実が変わったとき（2026-11-07 の ISMS 登録）に正しい文まで止まる。
# そこで、記録と照合して通す。記録に無い・範囲を広げる・状態や数字や日付が違う・古い状態の説明は止める。

FACTS_PATH = Path(__file__).resolve().parents[2] / "cor-voice" / "references" / "facts.json"
FACT_STATUSES = ("unconfirmed", "audit_completed", "registration_expected", "registered", "suspended", "withdrawn", "expired")
ISMS_REQUIRED_KEYS = (
    "id", "subject", "status", "standard", "registration_number", "scope", "issuer", "valid_from", "valid_to",
    "validity_condition", "confirmed_on", "evidence", "allowed_claims", "forbidden_extensions", "recheck", "history",
    "scope_limiting_phrases", "stale_state_phrases", "stale_state_phrases_any_context", "stale_state_phrases_unless_completed",
)
FACT_SOURCE = "cor-voice §6 / references/facts.json / ADR-0029"


class FactRecordError(Exception):
    """facts.json が読めない、壊れている、必須のキーが無い。"""


def _iso_date(value: object, key: str) -> date:
    try:
        return date.fromisoformat(str(value))
    except ValueError as exc:
        raise FactRecordError(f"facts.json の {key} が YYYY-MM-DD ではありません: {value!r}") from exc


def _validate_isms(rec: dict) -> dict:
    missing = [k for k in ISMS_REQUIRED_KEYS if k not in rec]
    if missing:
        raise FactRecordError(f"facts.json の isms に必須のキーがありません: {', '.join(missing)}")
    if rec["status"] not in FACT_STATUSES:
        raise FactRecordError(f"facts.json の isms.status が不明です: {rec['status']!r}（{' / '.join(FACT_STATUSES)}）")
    for key in ("registration_number", "scope", "issuer"):
        if not isinstance(rec[key], str) or not rec[key].strip():
            raise FactRecordError(f"facts.json の isms.{key} が空です")
    for key in ("scope_limiting_phrases", "stale_state_phrases", "stale_state_phrases_any_context", "stale_state_phrases_unless_completed"):
        if not isinstance(rec[key], list) or not all(isinstance(v, str) and v for v in rec[key]):
            raise FactRecordError(f"facts.json の isms.{key} が文字列の配列ではありません")
    groups = rec["forbidden_extensions"]
    if not isinstance(groups, list) or not groups or not all(isinstance(g, dict) and g.get("terms") for g in groups):
        raise FactRecordError("facts.json の isms.forbidden_extensions が {label, terms} の配列ではありません")
    _iso_date(rec["valid_from"], "isms.valid_from")
    _iso_date(rec["valid_to"], "isms.valid_to")
    return rec


def load_facts(path: Path | None = None) -> dict:
    """記録を読んで検証する。返すのは {"isms": 記録, "unrecorded": 記録に無い認証の名前の配列}。"""
    target = path or FACTS_PATH
    try:
        raw = json.loads(target.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, ValueError) as exc:
        raise FactRecordError(f"{target.name} を読めません: {exc}") from exc
    if not isinstance(raw, dict) or not isinstance(raw.get("facts"), list):
        raise FactRecordError(f"{target.name} に facts の配列がありません")
    isms = [f for f in raw["facts"] if isinstance(f, dict) and f.get("id") == "isms"]
    if len(isms) != 1:
        raise FactRecordError(f"{target.name} に id が isms の記録が {len(isms)} 件あります（1 件だけにする）")
    names = (raw.get("unrecorded_certifications") or {}).get("names")
    if not isinstance(names, list) or not names or not all(isinstance(n, str) and n for n in names):
        raise FactRecordError(f"{target.name} の unrecorded_certifications.names が文字列の配列ではありません")
    return {"isms": _validate_isms(isms[0]), "unrecorded": names}


ISMS_WORD = r"(?:ISMS|27001|情報セキュリティマネジメントシステム)"
# 取得したという現在の表明。「取得していません」「取得したい」「取得に向けて」は含めない
ACQUIRED = r"(?:取得済|認証取得|取得しました|取得しています|取得している|取得しており|取得し、|取得いたしました|取得した(?!い)|認証を受け|認証済|登録済|登録されました|認証されました)"
ISMS_CLAIM = re.compile(rf"{ISMS_WORD}[^。\n]{{0,40}}{ACQUIRED}|{ACQUIRED}[^。\n]{{0,40}}{ISMS_WORD}")
CAUSAL = re.compile(r"なので|だから|ことから|ゆえ|のため")
DATE_RE = re.compile(r"(\d{4})年(\d{1,2})月(?:(\d{1,2})日)?")
DATE_LABEL = re.compile(r"(?:初回登録日|登録日|取得日|認証取得日|認証登録日|登録年月日)[ 　]*[：:]?[ 　]*(?=\d{4}年)")
NUMBER_RE = re.compile(r"JP\d{2}/\d{3,}|登録番号[ 　]*[：:]?[ 　]*([A-Za-z]{0,3}\d{2}/\d+)")
COMPLETED = re.compile(r"取得しま|取得して|取得し、|取得済|認証取得|登録されま|認証済")


def _fact_hit(rule_id: str, line: int, text: str, message: str) -> Hit:
    return Hit(rule_id, "error", line, text.strip()[:120], message, FACT_SOURCE)


def _sentences(lines: list[str]):
    """(行番号, 文)。使わない語の説明（『取得済み』とは書きません）は落とす。文は「。」で切る。"""
    for no, raw in enumerate(lines, 1):
        for part in re.split(r"(?<=。)", _without_meta_mentions(raw)):
            if part.strip():
                yield no, part


def _paragraph_ids(lines: list[str]) -> list[int]:
    """行ごとの段落番号（空行で区切る）。空行は -1。"""
    ids, current, inside = [], -1, False
    for line in lines:
        if line.strip():
            current += 0 if inside else 1
            inside = True
            ids.append(current)
        else:
            inside = False
            ids.append(-1)
    return ids


def _cert_unverified_hits(lines: list[str], names: list[str]) -> list[Hit]:
    name = "(?:" + "|".join(re.escape(n) for n in sorted(names, key=len, reverse=True)) + ")"
    pattern = re.compile(rf"{name}[^。\n]{{0,16}}{ACQUIRED}|{ACQUIRED}[^。\n]{{0,16}}{name}")
    return [
        _fact_hit("cert_unverified", no, sent, "facts.json に事実の記録が無い認証を、取得済みと書いています。記録を足す（一次資料と ADR が先）か、書かない")
        for no, sent in _sentences(lines) if pattern.search(sent)
    ]


def _status_hits(claims: list[tuple[int, str]], rec: dict, as_of: date) -> list[Hit]:
    start, end = date.fromisoformat(rec["valid_from"]), date.fromisoformat(rec["valid_to"])
    reason = ""
    if rec["status"] != "registered":
        reason = f"記録の status は {rec['status']!r} で、registered ではありません"
    elif not start <= as_of <= end:
        reason = f"検査日 {as_of} が記録の有効期間 {start}〜{end} の外です"
    return [_fact_hit("isms_status_mismatch", no, sent, f"ISMS の認証取得を現在の事実として書いていますが、{reason}") for no, sent in claims] if reason else []


def _scope_missing_hits(claims: list[tuple[int, str]], lines: list[str], rec: dict) -> list[Hit]:
    ids, scope, hits = _paragraph_ids(lines), rec["scope"], []
    for no, sent in claims:
        here = ids[no - 1]
        near = [i for i, pid in enumerate(ids) if pid in (here, here + 1) and lines[i].strip()]
        if not any(scope in lines[i] for i in near):
            hits.append(_fact_hit("isms_scope_missing", no, sent, f"ISMS の取得を書く文には、同じ段落か直後の段落に登録範囲「{scope}」が要ります（記録の scope）"))
    return hits


def _overreach_hits(lines: list[str], rec: dict) -> list[Hit]:
    hits = []
    limiters = rec["scope_limiting_phrases"]
    for no, sent in _sentences(lines):
        if not re.search(ISMS_WORD, sent):
            continue
        found = [(g.get("label", "?"), t) for g in rec["forbidden_extensions"] for t in g["terms"] if t in sent]
        if found and not (any(p in sent for p in limiters) and not CAUSAL.search(sent)):
            label, term = found[0]
            hits.append(_fact_hit("isms_scope_overreach", no, sent, f"ISMS の表明を登録範囲「{rec['scope']}」の外へ広げています（{label}: 「{term}」）。範囲を限った文にする"))
    return hits


def _number_hits(lines: list[str], rec: dict) -> list[Hit]:
    hits, recorded = [], rec["registration_number"]
    for no, sent in _sentences(lines):
        for m in NUMBER_RE.finditer(sent):
            value = m.group(1) or m.group(0)
            if value.upper() != recorded.upper():
                hits.append(_fact_hit("isms_number_mismatch", no, sent, f"登録番号が記録と違います（本文 {value}、記録 {recorded}）"))
    return hits


def _in_validity_context(sent: str, m: re.Match) -> bool:
    return bool(re.search(r"まで|[〜~]", sent[m.end():m.end() + 4]) or re.search(r"有効|[〜~]\s*$", sent[max(0, m.start() - 12):m.start()]))


def _is_other_event(sent: str, m: re.Match) -> bool:
    """審査・確認・受領など、取得とは別の出来事の日付（「10 月に審査を終え、11 月 7 日に取得」の 10 月）。"""
    rest = re.split(r"[、。]", sent[m.end():], maxsplit=1)[0]
    return bool(re.search(r"審査|確認|受領|通知|申請|予定", rest)) and not re.search(ACQUIRED, rest)


def _same_date(m: re.Match, want: date) -> bool:
    year, month, day = int(m.group(1)), int(m.group(2)), m.group(3)
    return (year, month) == (want.year, want.month) and (day is None or int(day) == want.day)


def _date_hits(lines: list[str], rec: dict) -> list[Hit]:
    start, end, hits = date.fromisoformat(rec["valid_from"]), date.fromisoformat(rec["valid_to"]), []
    for no, sent in _sentences(lines):
        acquired = re.search(ACQUIRED, sent) and re.search(rf"認証|{ISMS_WORD}", sent)
        if not (acquired or DATE_LABEL.search(sent)):
            continue
        found = list(DATE_RE.finditer(sent))
        candidates = [d for d in found if not _is_other_event(sent, d)]
        # 取得日として使える日付が 1 つも残らず取得の動詞はある文は、曖昧なので全部を照合する（見落とすより書き直させる）
        for m in candidates or (found if re.search(ACQUIRED, sent) else []):
            allowed = (start, end) if _in_validity_context(sent, m) else (start,)
            if not any(_same_date(m, d) for d in allowed):
                hits.append(_fact_hit("isms_date_mismatch", no, sent, f"取得・登録の日付が記録と違います（本文 {m.group(0)}、記録 {rec['valid_from']}）。確認した日を取得日にしない"))
    return hits


def _stale_hits(lines: list[str], rec: dict, archive_lines: frozenset[int]) -> list[Hit]:
    if rec["status"] != "registered":
        return []
    hits = []
    for no, sent in _sentences(lines):
        if no in archive_lines:
            continue
        strong = [p for p in rec["stale_state_phrases"] if p in sent] if re.search(rf"認証|{ISMS_WORD}", sent) else []
        strong += [p for p in rec["stale_state_phrases_any_context"] if p in sent]  # #527 が文脈なしで止めていた句を弱めない
        weak = [p for p in rec["stale_state_phrases_unless_completed"] if p in sent] if re.search(ISMS_WORD, sent) and not COMPLETED.search(sent) else []
        if strong or weak:
            hits.append(_fact_hit("isms_stale_state", no, sent, f"記録の status は registered（{rec['valid_from']} 登録）なのに、古い状態（「{(strong or weak)[0]}」）を現在の説明として書いています。日付つきの過去の記録は archive ブロックに入れる"))
    return hits


def fact_hits(lines: list[str], facts: dict | None, as_of: date, archive_lines: frozenset[int]) -> list[Hit]:
    """facts.json との照合。記録が読めないときは fact_record_invalid で止め、旧規則へは戻らない。"""
    try:
        record = facts if facts is not None else load_facts()
    except FactRecordError as exc:
        return [_fact_hit("fact_record_invalid", 1, str(exc), "事実の記録 facts.json が使えません。直すまで ISMS などの現在の事実を検査できません（固定の旧規則へは戻りません）")]
    rec = record["isms"]
    claims = [(no, sent) for no, sent in _sentences(lines) if ISMS_CLAIM.search(sent)]
    return [
        *_cert_unverified_hits(lines, record["unrecorded"]),
        *_status_hits(claims, rec, as_of),
        *_scope_missing_hits(claims, lines, rec),
        *_overreach_hits(lines, rec),
        *_number_hits(lines, rec),
        *_date_hits(lines, rec),
        *_stale_hits(lines, rec, archive_lines),
    ]


def check_text(text: str, scene: str, facts: dict | None = None, as_of: date | None = None, archive_lines: frozenset[int] = frozenset()) -> list[Hit]:
    """facts は load_facts() の形（試験で差し替える）。as_of は検査日（既定は今日）。archive_lines は過去の記録として
    古い状態の説明を許す行（日付つきの過去の記録・引用）。"""
    lines = masked_lines(text)
    block_lines = masked_lines(text, keep_blocks=True)
    hits: list[Hit] = []
    for rule in RULES:
        if scene not in rule.scenes:
            continue
        found, matches = _rule_hits(rule, block_lines if rule.level == "error" else lines)
        if matches >= rule.min_count:
            hits.extend(found)
    hits.extend(fact_hits(block_lines, facts, as_of or date.today(), archive_lines))
    hits.extend(_first_person_mix(lines))
    hits.extend(_length_hits(text, scene))
    return sorted(hits, key=lambda h: (h.line, h.rule_id))


# 本人の 2026 年の記事 4 本の実測（2026-10-30、stats）: 1 文の平均 17.8〜27.2 字、1 段落 1.1〜2.5 文。
# 幅の上に少し余裕を取って、超えたときだけ候補にする（本人の記事では 0 件になる値）
MAX_SENTENCE_MEAN = 30.0
MAX_PARAGRAPH_SENTENCES = 3.0


def _length_hits(text: str, scene: str) -> list[Hit]:
    if scene == "founder-x":
        return []
    s = stats_text(text)
    hits = []
    if s["sentences"] >= 5 and s["sentence_len_mean"] > MAX_SENTENCE_MEAN:
        hits.append(Hit("long_sentences", "warn", 1, f"1 文の平均 {s['sentence_len_mean']} 字", f"1 文の平均が {MAX_SENTENCE_MEAN:g} 字を超えています（本人の記事は 17.8〜27.2 字）。長い文から見直す", "cor-voice §2"))
    if s["paragraphs"] >= 3 and s["paragraph_sentences_mean"] > MAX_PARAGRAPH_SENTENCES:
        hits.append(Hit("long_paragraphs", "warn", 1, f"1 段落の平均 {s['paragraph_sentences_mean']} 文", f"1 段落の平均が {MAX_PARAGRAPH_SENTENCES:g} 文を超えています（1 段落は 1〜3 文）", "cor-voice §2"))
    return hits


def _rule_hits(rule: Rule, lines: list[str]) -> tuple[list[Hit], int]:
    """当たった行（1 行 1 件）と、文書全体で当たった回数（min_count と比べる）。"""
    found, matches = [], 0
    quote_free = rule.rule_id in {"exclamation", "dialect", "closed_warai", "ai_slop", "strong_claim"}
    for no, line in enumerate(lines, 1):
        target = _without_quotes(line) if quote_free else _without_meta_mentions(line)
        count = len(rule.pattern.findall(target))
        if count:
            matches += count
            found.append(Hit(rule.rule_id, rule.level, no, line.strip()[:120], rule.message, rule.source))
    return found, matches


def _first_person_mix(lines: list[str]) -> list[Hit]:
    seen: dict[str, int] = {}
    for no, line in enumerate(lines, 1):
        for m in FIRST_PERSON.finditer(_without_quotes(line)):
            seen.setdefault(m.group(1), no)
    if len(seen) < 2:
        return []
    line = max(seen.values())
    return [Hit("first_person_mix", "warn", line, lines[line - 1].strip()[:120], "一つの文章の中で「僕」と「私」を混ぜない", "cor-voice §4")]


# ---- 文体の統計 ----

SENT_END = re.compile(r"(?<=[。！？!?])")
POLITE = re.compile(r"(です|ます|でした|ました|ません|でしょう|ください|下さい|ませんか)[。！？!?]?$")


def prose_units(text: str) -> tuple[list[list[str]], list[str]]:
    """段落（文の配列）の配列と、見出しの配列を返す。箇条書きの 1 項目は 1 文として数える。"""
    _, body = strip_frontmatter(text)
    paragraphs: list[list[str]] = []
    headings: list[str] = []
    current: list[str] = []
    for raw in masked_lines(body) + [""]:
        line = raw.strip()
        if not line:
            if current:
                paragraphs.append(current)
            current = []
            continue
        if line.startswith("#"):
            headings.append(line.lstrip("#").strip())
            continue
        line = re.sub(r"^([-*+]|\d+\.)\s+", "", line)
        current.extend(s.strip() for s in SENT_END.split(line) if s.strip())
    return paragraphs, headings


def _ending(sentence: str) -> str:
    core = re.sub(r"[。！？!?」』）)\s]+$", "", sentence)
    return core[-2:] if len(core) >= 2 else core


def _max_run(items: list[str]) -> int:
    best = run = 0
    prev = None
    for item in items:
        run = run + 1 if item == prev else 1
        best = max(best, run)
        prev = item
    return best


def _ascii_boundaries(text: str) -> tuple[int, int]:
    jp = r"[぀-ヿ一-鿿]"
    spaced = len(re.findall(rf"{jp} [A-Za-z0-9]|[A-Za-z0-9] {jp}", text))
    tight = len(re.findall(rf"{jp}[A-Za-z0-9]|[A-Za-z0-9]{jp}", text))
    return spaced, tight


def stats_text(text: str) -> dict:
    paragraphs, headings = prose_units(text)
    sentences = [s for p in paragraphs for s in p]
    lengths = [len(s) for s in sentences] or [0]
    endings = [_ending(s) for s in sentences]
    prose = "\n".join("".join(p) for p in paragraphs)
    spaced, tight = _ascii_boundaries(prose)
    q = statistics.quantiles(lengths, n=10) if len(lengths) >= 10 else [max(lengths)] * 9
    return {
        "chars": len(prose),
        "sentences": len(sentences),
        "paragraphs": len(paragraphs),
        "headings": len(headings),
        "sentence_len_mean": round(statistics.mean(lengths), 1),
        "sentence_len_median": statistics.median(lengths),
        "sentence_len_p90": round(q[8], 1),
        "polite_ratio": round(sum(bool(POLITE.search(s)) for s in sentences) / max(len(sentences), 1), 2),
        "ending_kinds_ratio": round(len(set(endings)) / max(len(endings), 1), 2),
        "ending_max_run": _max_run(endings),
        "commas_per_sentence": round(prose.count("、") / max(len(sentences), 1), 2),
        "paragraph_sentences_mean": round(len(sentences) / max(len(paragraphs), 1), 2),
        "ascii_space_ratio": round(spaced / max(spaced + tight, 1), 2),
        "fullwidth_alnum": len(re.findall(r"[Ａ-Ｚａ-ｚ０-９]", prose)),
    }


# ---- CLI ----

def _read(path: str) -> str:
    try:
        return Path(path).read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        print(f"cor_voice_lint: {path} を読めません: {exc}", file=sys.stderr)
        sys.exit(2)


def _print_check(path: str, hits: list[Hit]) -> None:
    errors = sum(h.level == "error" for h in hits)
    print(f"{path}: 候補 {len(hits)} 件（error {errors} 件、warn {len(hits) - errors} 件）")
    for h in hits:
        print(f"  L{h.line} [{h.level.upper()}] {h.rule_id}: {h.message}（{h.source}）")
        print(f"    > {h.text}")


def _archive_lines(specs: list[str]) -> frozenset[int]:
    lines: set[int] = set()
    for spec in specs:
        m = re.fullmatch(r"(\d+)-(\d+)", spec)
        if not m or int(m.group(1)) > int(m.group(2)):
            print(f"cor_voice_lint: --archive は START-END（行番号、START <= END）で指定します: {spec}", file=sys.stderr)
            sys.exit(2)
        lines.update(range(int(m.group(1)), int(m.group(2)) + 1))
    return frozenset(lines)


def _as_of(value: str | None) -> date:
    try:
        return date.fromisoformat(value) if value else date.today()
    except ValueError:
        print(f"cor_voice_lint: --as-of は YYYY-MM-DD で指定します: {value}", file=sys.stderr)
        sys.exit(2)


def cmd_check(args: argparse.Namespace) -> int:
    failed = False
    report = {}
    as_of, archive = _as_of(args.as_of), _archive_lines(args.archive)
    for path in args.files:
        hits = check_text(_read(path), args.scene, as_of=as_of, archive_lines=archive)
        report[path] = [asdict(h) for h in hits]
        levels = {"error": {"error"}, "warn": {"error", "warn"}}.get(args.fail_on, set())
        failed = failed or any(h.level in levels for h in hits)
        if not args.json:
            _print_check(path, hits)
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=1))
    else:
        print("この検査は cor-voice の決まりのうち機械で拾える型だけを見ます。意味の保持と読みやすさは判定しません。")
    return 1 if failed else 0


def cmd_stats(args: argparse.Namespace) -> int:
    report = {path: stats_text(_read(path)) for path in args.files}
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=1))
    else:
        for path, s in report.items():
            print(path + ": " + ", ".join(f"{k}={v}" for k, v in s.items()))
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="cor_voice_lint.py", description=__doc__.split("\n")[0])
    sub = parser.add_subparsers(dest="command", required=True)
    check = sub.add_parser("check", help="cor-voice の機械で判定できる決まりを当てる")
    check.add_argument("--scene", choices=SCENES, default="company", help="場面（cor-voice §2）。既定は company")
    check.add_argument("--fail-on", choices=("error", "warn", "none"), default="error")
    check.add_argument("--json", action="store_true")
    check.add_argument("--as-of", help="検査日（YYYY-MM-DD）。facts.json の有効期間と比べる。既定は今日")
    check.add_argument("--archive", action="append", default=[], metavar="START-END", help="日付つきの過去の記録として、古い状態の説明を許す行の範囲（何度でも）")
    check.add_argument("files", nargs="+")
    stats = sub.add_parser("stats", help="文長・語尾・読点・段落などの統計")
    stats.add_argument("--json", action="store_true")
    stats.add_argument("files", nargs="+")
    args = parser.parse_args(argv)
    return cmd_check(args) if args.command == "check" else cmd_stats(args)


if __name__ == "__main__":
    sys.exit(main())
