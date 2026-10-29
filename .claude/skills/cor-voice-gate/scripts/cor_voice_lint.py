#!/usr/bin/env python3
"""Cor. の対外文に、cor-voice の決まりのうち機械で判定できるものを当てる検査と、文体の統計。

yomiyasu_check.py（nanaism/yomiyasu v2.1.3 の同梱。手を加えない）が見ない、Cor. 固有の決まりだけを見る。
規則の本文は cor-voice/SKILL.md にあり、ここには判定の型と、どの節から来たかだけを置く。
検査の結果は候補で、意味の保持や読みやすさの合格ではない。

使い方:
  cor_voice_lint.py check [--scene company|founder|tech|mail|founder-x] [--json] [--fail-on error|warn] FILE...
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
    _rule("trial_word", "error", r"試行", "「試行」は使わない。紹介会社・採用担当向けは「テスト導入（PoC）」、CTA は「自社でテストしてみる」", "cor-voice §6 / ADR-0022"),
    _rule("isms_obtained", "error", r"(ISMS|27001)[^。\n]{0,30}(取得済|認証取得|取得しました|を取得し)|(取得済|認証取得)[^。\n]{0,30}(ISMS|27001)", "ISMS は「第2段階審査を終え、2026年12月ごろの認証登録を見込んでいる」まで", "cor-voice §6 / ADR-0007"),
    _rule("evidence_copy", "error", r"証拠は盛れない", "「証拠は盛れない」は使わない。「経歴の説明に、確かめられる根拠を。」", "cor-voice §6A-4"),
    _rule("seven_x_metric", "error", r"7\s*倍[^。\n]{0,40}(生産性|開発速度|納品量)|(生産性|開発速度|納品量)[^。\n]{0,40}7\s*倍", "「7倍」は GitHub のコントリビュート数。生産性・開発速度・納品量と結びつけない", "cor-voice §6A-4"),
    _rule("company_name", "error", r"Cor\.?\s?[Ii]nc\b|(?<![.．])Cor株式会社|コル株式会社|コア株式会社", "社名は「Cor.株式会社」", "cor-voice §6 / ADR-0007"),
    _rule("absolute_claim", "error", r"100\s*[%％]\s*安全|日本初|業界初|世界初", "根拠と定義のない最上級・保証は書かない", "cor-voice §6 / §6A-4"),
    _rule("strong_claim", "warn", r"確実に|絶対に?|唯一の|最速|完璧", "言い切りの保証や最上級は、根拠と定義が資料にあるときだけ", "cor-voice §6 / §6A-4"),
    _rule("exclamation", "warn", r"[！!]", "感嘆符は使わない（引用と製品名を除く）", "cor-voice §4", NOT_FOUNDER_X),
    # 「Grift CLIとは」のように疑問符の無い見出しは本人の記事にもある（2026-08 の Qiita）。疑問符つきと「何者か」だけを拾う
    _rule("what_is_heading", "warn", r"^#{1,6}\s.*(とは[？?]\s*$|とは何者か)", "「〜とは？」「〜とは何者か」の見出しにしない", "cor-voice §4"),
    _rule("bold_label_colon", "warn", r"^\s*(?:[-*+]|\d+\.)?\s*\*\*[^*\n]+\*\*\s*[:：]", "太字のラベルとコロンで始める箇条書きにしない", "cor-voice §4"),
    _rule("ellipsis", "warn", r"…", "「…」を多用しない", "cor-voice §4", NOT_FOUNDER_X, 2),
    _rule("cliche", "warn", r"天元突破|断言しよう|未来を変える|過言ではない|革命を起こ|新時代の幕開け", "大げさな決まり文句を持ち込まない", "cor-voice §4"),
    _rule("dialect", "warn", r"んよね|やねん|やんか|やん[。、！!]", "方言の語尾は足さない（代表個人の X の例外を除く）", "cor-voice §4 / §5", NOT_FOUNDER_X),
    _rule("closed_warai", "warn", r"（笑）|\(笑\)", "「（笑）」は持ち込まない", "cor-voice §4", NOT_FOUNDER_X),
    _rule("free_cta", "warn", r"無料で(お?試|始め|使い始め|ご利用)|今すぐ(無料|お試し)", "CTA で「無料」を主な誘い文句にしない", "cor-voice §6"),
    _rule("price", "warn", r"\d[\d,，.]*\s*(万円|円)", "価格は資料にあるときだけ。Grift の料金は個別案内", "cor-voice §6"),
    _rule("ai_slop", "warn", r"シームレス|革新的|画期的|ご紹介します|解説します|見ていきましょう|いかがでしたか|寄り添|最大限に活用|と言えるでしょう", "AI の下書きで増えた言い回し。本人の書き方（短く言い切る、確かめた事実を書く）に寄せる", "cor-voice §3 / §4"),
    _rule("company_first_person", "warn", r"(?<![\w一-龥])(僕|私)(は|が|も|の|に|を|たち|達)", "会社として書く文章で「僕」「私」を使わない", "cor-voice §2", ("company",)),
)

FIRST_PERSON = re.compile(r"(?<![\w一-龥])(僕|私)(?=は|が|も|の|に|を|たち|達|自身)")


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


def masked_lines(text: str) -> list[str]:
    """検査しない部分（コード、インラインコード、URL、HTML コメント、表、引用）を空にした行の配列。行番号は保つ。"""
    out: list[str] = []
    in_fence = False
    for line in text.split("\n"):
        if re.match(r"^\s*(```|~~~)", line):
            in_fence = not in_fence
            out.append("")
            continue
        if in_fence or re.match(r"^\s*(\||>)", line):
            out.append("")
            continue
        line = re.sub(r"`[^`]*`", "", line)
        line = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", line)
        line = re.sub(r"https?://\S+", "", line)
        line = re.sub(r"<!--.*?-->", "", line)
        out.append(line)
    return out


def _without_quotes(line: str) -> str:
    return re.sub(r"「[^」]*」|『[^』]*』", "", line)


# 「『取得済み』とは書きません」「『試行』は使わない」のように、使わない語を説明している引用は数えない
META_MENTION = re.compile(r"[「『][^」』]*[」』](?=\s*(?:と|とは|は|も)\s*(?:書か|書き|書く|使わ|使い|使う|言わ|言う|しない|せず|呼ば|呼び|呼ぶ))")


def _without_meta_mentions(line: str) -> str:
    return META_MENTION.sub("", line)


def check_text(text: str, scene: str) -> list[Hit]:
    lines = masked_lines(text)
    hits: list[Hit] = []
    for rule in RULES:
        if scene not in rule.scenes:
            continue
        found, matches = _rule_hits(rule, lines)
        if matches >= rule.min_count:
            hits.extend(found)
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
        raise SystemExit(f"cor_voice_lint: {path} を読めません: {exc}") from None


def _print_check(path: str, hits: list[Hit]) -> None:
    errors = sum(h.level == "error" for h in hits)
    print(f"{path}: 候補 {len(hits)} 件（error {errors} 件、warn {len(hits) - errors} 件）")
    for h in hits:
        print(f"  L{h.line} [{h.level.upper()}] {h.rule_id}: {h.message}（{h.source}）")
        print(f"    > {h.text}")


def cmd_check(args: argparse.Namespace) -> int:
    failed = False
    report = {}
    for path in args.files:
        hits = check_text(_read(path), args.scene)
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
    check.add_argument("files", nargs="+")
    stats = sub.add_parser("stats", help="文長・語尾・読点・段落などの統計")
    stats.add_argument("--json", action="store_true")
    stats.add_argument("files", nargs="+")
    args = parser.parse_args(argv)
    return cmd_check(args) if args.command == "check" else cmd_stats(args)


if __name__ == "__main__":
    sys.exit(main())
