#!/usr/bin/env python3
"""Cor. の対外文のゲートを、ファイルとコマンドだけで閉じる。どのハーネスからでも、人の手でも同じ手順で使う。

使い方:
  voice_gate.py init  --run-dir DIR --draft FILE --scene SCENE --doc-type TYPE --gate fast|full
                      (--material FILE … | --source FILE)
  voice_gate.py check --run-dir DIR [--json]

init   DIR に gate.json（入力と場面）と review.md（意味の確認の記入表）を書く。記入表の項目は
       ../SKILL.md の Semantic Review と §10.2 の表から毎回作る（項目の写しをこのファイルに持たない）。
check  cor_voice_lint.py check、yomiyasu_check.py run --fact-gaps と verify を子プロセスで動かし、
       review.md を読んで、DIR に result.json と result.md を書く。review.md の「読んだ下書きの sha256」が
       今の下書きと違えば通さない（通ったあとに下書きだけを直しても、古い記入表では通らない）。
       SKILL.md が init のあとで変わったときも通さない（記入表の項目の中身が変わったかもしれないため）。

標準ライブラリだけで動く。モデルは呼ばない。外へ通信しない。特定のハーネスの機能（スキルの自動起動、
フック、ハーネスの環境変数）を使わない。記録には絶対パスを書かない（DIR からの相対パスだけ）。
ゲートを通ったことは、公開や送信の許可ではない。公開と送信は代表が決める。

終了コード:
  0  ゲートを通った（機械の検査が通り、記入表に fail・未記入が無い）
  1  通らなかった（理由は result.md と result.json の reasons）
  2  使い方か入力の誤り（ファイルが無い、DIR に前の記録がある、場面や種類の値が違う、gate.json か
     review.md を読めない）
  3  検査を最後まで動かせなかった（子の内部の誤り・時間切れ）、または SKILL.md から記入表を作れなかった
"""
from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

HERE = Path(__file__).resolve().parent
SKILL_MD = HERE.parent / "SKILL.md"
LINT = HERE / "cor_voice_lint.py"
YOMIYASU = HERE.parents[1] / "yomiyasu" / "scripts" / "yomiyasu_check.py"

sys.path.insert(0, str(HERE))
sys.path.insert(1, str(YOMIYASU.parent))
from cor_voice_lint import SCENES  # noqa: E402  場面の一覧は lint と同じものを使う
from markdown_visibility import normalize_doc_type  # noqa: E402  種類の一覧は yomiyasu と同じものを使う

INPUT_FORMAT = "cor-voice-gate-input"
RESULT_FORMAT = "cor-voice-gate-result"
FORMAT_VERSION = 1
GATES = ("fast", "full")
VERDICTS = ("pass", "fail", "n/a")
TIMEOUT_SECONDS = 150  # 子 1 本あたり。yomiyasu の検査の既定の上限（90 秒）より長くとる
GATE_JSON = "gate.json"
REVIEW_MD = "review.md"
RESULT_JSON = "result.json"
RESULT_MD = "result.md"
STATE_DIR = ".yomiyasu"

# SKILL.md の中で、記入表の作り方を決める宣言。見つからなければ記入表を作らない（終了コード 3）。
TONE_DECLARATION = re.compile(r"Whole-post tone check \(required, Fast and Full\)")
EVERY_GATE_DECLARATION = re.compile(r"Fast still runs items (\d+) and (\d+)")
SEMANTIC_ITEM = re.compile(r"^(\d+)\. □ \*\*(.+?)\*\*", re.M)
PREPUBLISH_HEADER = "| 確認 | 合格条件 | ✓/✗ |"
MEANING_RISK_ITEM = 6  # 「meaning_risk_count == 0」の項目。機械の結果と照らすので n/a にできない
REVIEW_ROW = re.compile(r"^\|\s*(T|S\d+|P\d+)\s*\|(.*)\|\s*$")
# 記入表がどの版の下書きを読んで書かれたか。下書きを直したら、読み直してこの行を書き換える
REVIEWED_SHA = re.compile(r"^- 読んだ下書きの sha256: ([0-9a-f]{64})\s*$", re.M)
RECORD_KEYS = ("gate", "scene", "doc_type", "draft", "sources", "materials", "checklist")


class UsageError(Exception):
    """使い方か入力の誤り（終了コード 2）。"""


class SetupError(Exception):
    """検査を最後まで動かせない（終了コード 3）。"""


@dataclass(frozen=True)
class Item:
    item_id: str
    title: str
    na_allowed: bool


def _section(text: str, heading: str) -> str:
    start = text.find(f"\n## {heading}")
    if start < 0:
        raise SetupError(f"SKILL.md に「## {heading}」の節がありません")
    end = text.find("\n## ", start + 1)
    return text[start:] if end < 0 else text[start:end]


def _clean_title(raw: str) -> str:
    return raw.strip().rstrip(":：").strip().replace("|", "／")


def _prepublish_rows(text: str) -> list[tuple[str, str]]:
    lines = text.splitlines()
    try:
        start = lines.index(PREPUBLISH_HEADER) + 2  # 見出しの行と区切りの行を飛ばす
    except ValueError as error:
        raise SetupError(f"SKILL.md に §10.2 の表（{PREPUBLISH_HEADER}）がありません") from error
    rows = []
    for line in lines[start:]:
        if not line.startswith("|"):
            break
        cells = [cell.strip() for cell in line.strip("|").split("|")]
        rows.append((cells[0], cells[1] if len(cells) > 1 else ""))
    if not rows:
        raise SetupError("SKILL.md の §10.2 の表に行がありません")
    return rows


def checklist(skill_text: str, gate: str) -> list[Item]:
    """SKILL.md から記入表の項目を作る。宣言が欠けていれば SetupError。"""
    if not TONE_DECLARATION.search(skill_text):
        raise SetupError("SKILL.md に Whole-post tone check (required, Fast and Full) の宣言がありません")
    every_gate = EVERY_GATE_DECLARATION.search(skill_text)
    if not every_gate:
        raise SetupError("SKILL.md に「Fast still runs items N and M」の宣言がありません")
    required = {int(every_gate.group(1)), int(every_gate.group(2)), MEANING_RISK_ITEM}
    found = SEMANTIC_ITEM.findall(_section(skill_text, "Semantic Review"))
    if not found:
        raise SetupError("SKILL.md の Semantic Review に「N. □ **…**」の項目がありません")
    titles = dict(found)
    if "meaning_risk" not in titles.get(str(MEANING_RISK_ITEM), ""):
        raise SetupError(f"SKILL.md の Semantic Review の {MEANING_RISK_ITEM} が meaning_risk の項目ではありません"
                         f"（今の題: {titles.get(str(MEANING_RISK_ITEM), 'なし')}）")
    items = [Item("T", "Whole-post tone check (Step 6)", False)]
    items += [Item(f"S{n}", _clean_title(title), int(n) not in required) for n, title in found]
    if gate == "full":
        items += [Item(f"P{i}", _clean_title(f"{label}: {cond}"), False)
                  for i, (label, cond) in enumerate(_prepublish_rows(skill_text), start=1)]
    return items


def render_review(items: list[Item], gate: str, draft_rel: str, draft_sha: str) -> str:
    head = [
        "# 意味の確認（cor-voice-gate の記入表）",
        "",
        f"- 下書き: `{draft_rel}`（この記録のフォルダからの相対パス）",
        f"- ゲート: {gate}",
        f"- 読んだ下書きの sha256: {draft_sha}",
        "- 下書きを直したら、読み直して記入し、上の sha256 を check が示す今の値に書き換えます（違うと通りません）。",
        "- 項目の中身は `.claude/skills/cor-voice-gate/SKILL.md` の同じ番号の節を読みます（ここには写しません）。",
        "- 判定の欄には pass、fail、n/a のどれかを書きます。根拠の欄は空にしません。",
        "- n/a は、その項目が当たらない理由を根拠に書きます。「n/a 不可」の項目は pass か fail だけです。",
        "- fail が 1 つでもあれば、ゲートは通りません。直してから記入し直します。",
        "",
        "| ID | 項目 | 判定 | 根拠 |",
        "|---|---|---|---|",
    ]
    rows = [f"| {item.item_id} | {item.title}{'' if item.na_allowed else '（n/a 不可）'} |  |  |"
            for item in items]
    return "\n".join(head + rows) + "\n"


def parse_review(text: str) -> tuple[dict[str, tuple[str, str]], list[str]]:
    """記入表の行を {ID: (判定, 根拠)} にする。同じ ID が 2 回あれば problems に入れる。"""
    rows: dict[str, tuple[str, str]] = {}
    problems = []
    for line in text.splitlines():
        match = REVIEW_ROW.match(line.strip())
        if not match:
            continue
        item_id, rest = match.group(1), match.group(2)
        cells = rest.split("|", 2)
        verdict = cells[1].strip().lower() if len(cells) > 1 else ""
        basis = cells[2].strip() if len(cells) > 2 else ""
        if item_id in rows:
            problems.append(f"記入表に {item_id} の行が 2 つあります")
        rows[item_id] = (verdict, basis)
    return rows, problems


def evaluate_review(items: list[Item], rows: dict[str, tuple[str, str]]) -> list[str]:
    """記入表の問題を返す。空なら記入表は通る。"""
    problems = []
    expected = {item.item_id for item in items}
    for item in items:
        if item.item_id not in rows:
            problems.append(f"{item.item_id}（{item.title}）の行がありません（SKILL.md の項目が増えたなら init し直します）")
            continue
        verdict, basis = rows[item.item_id]
        if not verdict and not basis:
            problems.append(f"{item.item_id}（{item.title}）が未記入です")
            continue
        if verdict not in VERDICTS:
            problems.append(f"{item.item_id} の判定が未記入か、pass・fail・n/a 以外です（{verdict or '空'}）")
        elif verdict == "fail":
            problems.append(f"{item.item_id}（{item.title}）が fail です: {basis or '根拠なし'}")
        elif verdict == "n/a" and not item.na_allowed:
            problems.append(f"{item.item_id} は n/a にできません（どのゲートでも確かめる項目です）")
        if not basis:
            problems.append(f"{item.item_id} の根拠が空です")
    problems += [f"記入表に SKILL.md に無い行 {item_id} があります" for item_id in sorted(set(rows) - expected)]
    return problems


def reviewed_sha_problems(review_text: str, draft_sha: str) -> list[str]:
    """記入表が今の下書きを読んで書かれたか。通ったあとに下書きだけを変えても、古い記入表では通さない。"""
    found = REVIEWED_SHA.findall(review_text)
    if len(found) != 1:
        return [f"記入表に「- 読んだ下書きの sha256: <64 桁>」の行が 1 つではありません（{len(found)} 行）"]
    if found[0] != draft_sha:
        return [f"記入表は別の版の下書きを読んで書かれています（記入表 {found[0][:12]}、今の下書き {draft_sha[:12]}）。"
                f"今の下書きを読み直して記入し、sha256 の行を {draft_sha} にします"]
    return []


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _rel(path: Path, run_dir: Path) -> str:
    return os.path.relpath(path.resolve(), run_dir.resolve())


def _existing_file(raw: str, label: str) -> Path:
    path = Path(raw)
    if not path.is_file():
        raise UsageError(f"{label} のファイルがありません: {raw}")
    return path


def cmd_init(args: argparse.Namespace) -> int:
    run_dir = Path(args.run_dir)
    if (run_dir / GATE_JSON).exists() or (run_dir / REVIEW_MD).exists():
        raise UsageError(f"{run_dir} には前の記録があります。別のフォルダを指定します（記入済みの表を上書きしないため）")
    draft = _existing_file(args.draft, "下書き")
    sources = [_existing_file(args.source, "原文")] if args.source else []
    materials = [_existing_file(raw, "資料") for raw in args.material or []]
    if not sources and not materials:
        raise UsageError("--material（依頼と資料）か --source（直す前の原文）を 1 つ以上渡します")
    try:
        normalize_doc_type(args.doc_type)
    except ValueError as error:
        raise UsageError(str(error)) from error
    skill_text = SKILL_MD.read_text(encoding="utf-8")
    items = checklist(skill_text, args.gate)
    run_dir.mkdir(parents=True, exist_ok=True)
    record = {
        "format": INPUT_FORMAT, "format_version": FORMAT_VERSION,
        "created_at": _now(), "gate": args.gate, "scene": args.scene, "doc_type": args.doc_type,
        "draft": _rel(draft, run_dir),
        "sources": [_rel(path, run_dir) for path in sources],
        "materials": [_rel(path, run_dir) for path in materials],
        "checklist": {"skill_sha256": hashlib.sha256(skill_text.encode("utf-8")).hexdigest(),
                      "items": [item.item_id for item in items]},
    }
    (run_dir / GATE_JSON).write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (run_dir / REVIEW_MD).write_text(render_review(items, args.gate, record["draft"], _sha256(draft)), encoding="utf-8")
    print(f"記録のフォルダ: {run_dir}")
    print(f"次: {run_dir / REVIEW_MD} に判定と根拠を書き、check --run-dir {run_dir} を実行します")
    return 0


def _now() -> str:
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _run_child(script: Path, args: list[str]) -> tuple[int, str, str]:
    command = [sys.executable, "-I", "-B", str(script), *args]
    try:
        done = subprocess.run(command, capture_output=True, text=True, encoding="utf-8",
                              timeout=TIMEOUT_SECONDS, check=False)
    except subprocess.TimeoutExpired as error:
        raise SetupError(f"{script.name} が {TIMEOUT_SECONDS} 秒で終わりませんでした") from error
    return done.returncode, done.stdout, done.stderr


def _json_or_setup_error(stdout: str, name: str, stderr: str) -> dict:
    try:
        return json.loads(stdout)
    except json.JSONDecodeError as error:
        raise SetupError(f"{name} の出力を JSON として読めません: {stderr.strip()[:300]}") from error


def run_lint(draft: Path, scene: str) -> dict:
    code, out, err = _run_child(LINT, ["check", "--scene", scene, "--json", "--fail-on", "none", str(draft)])
    if code == 2:
        raise UsageError(f"cor_voice_lint.py が入力を読めません: {err.strip()[:300]}")
    if code != 0:
        raise SetupError(f"cor_voice_lint.py が終了コード {code} で終わりました: {err.strip()[:300]}")
    findings = [hit for hits in _json_or_setup_error(out, "cor_voice_lint.py", err).values() for hit in hits]
    return {
        "errors": sum(1 for hit in findings if hit["level"] == "error"),
        "warns": sum(1 for hit in findings if hit["level"] == "warn"),
        "findings": [{key: hit[key] for key in ("rule_id", "level", "line", "message", "source")} for hit in findings],
    }


def _yomiyasu(args: list[str], name: str) -> tuple[int, dict]:
    code, out, err = _run_child(YOMIYASU, args)
    if code == 2:
        raise UsageError(f"yomiyasu_check.py {name} が入力を受け付けません: {err.strip()[:300]}")
    if code == 3:
        raise SetupError(f"yomiyasu_check.py {name} が最後まで動きませんでした: {err.strip()[:300]}")
    return code, _json_or_setup_error(out, f"yomiyasu_check.py {name}", err)


def run_yomiyasu(record: dict, run_dir: Path, draft: Path) -> dict:
    state = str(run_dir / STATE_DIR)
    args = ["run", "--final", str(draft), "--doc-type", record["doc_type"], "--fact-gaps", "--state-dir", state, "--json"]
    for rel in record["sources"]:
        args += ["--source", str(run_dir / rel)]
    for rel in record["materials"]:
        args += ["--material", str(run_dir / rel)]
    run_code, run = _yomiyasu(args, "run")
    verify_code, verify = _yomiyasu(["verify", "--final", str(draft), "--state-dir", state, "--json"], "verify")
    gaps = run.get("fact_gaps") or {}
    # meaning_risk は diff（原文との比較）と materials（資料との照合）の両方から来る。件数は run の合計と同じ
    risks = [risk for part in ("diff", "materials") for risk in (run.get(part) or {}).get("meaning_risks") or []]
    return {
        "run": {"exit": run_code, "status": run.get("status"), "run_id": run.get("run_id"),
                "status_line": run.get("status_line"), "meaning_risk_count": run.get("meaning_risk_count"),
                "meaning_risks": [{key: risk.get(key) for key in ("kind", "subkind", "old_line", "new_line", "old", "new")}
                                  for risk in risks],
                "fact_gap_count": gaps.get("count"),
                "fact_gaps": [{key: gap.get(key) for key in ("kind", "line", "sentence", "need")}
                              for gap in gaps.get("items") or []]},
        "verify": {"exit": verify_code, "status": verify.get("status"), "status_line": verify.get("status_line")},
    }


def gate_reasons(lint: dict, yomiyasu: dict, review_problems: list[str]) -> list[str]:
    reasons = []
    if lint["errors"]:
        reasons.append(f"cor_voice_lint.py の error が {lint['errors']} 件あります（error は直すまで渡さない）")
    run, verify = yomiyasu["run"], yomiyasu["verify"]
    if run["exit"] != 0 or run["status"] != "executed":
        reasons.append(f"yomiyasu run が executed になりません（終了コード {run['exit']}、状態 {run['status']}）")
    if run["meaning_risk_count"] != 0:
        reasons.append(f"yomiyasu run の meaning_risk が {run['meaning_risk_count']} 件です（0 になるまで渡さない）")
    if verify["exit"] != 0 or verify["status"] != "executed":
        reasons.append(f"yomiyasu verify が executed になりません（終了コード {verify['exit']}、状態 {verify['status']}）")
    return reasons + [f"記入表: {problem}" for problem in review_problems]


def _read_text(path: Path, label: str) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as error:
        raise UsageError(f"{label}（{path}）を UTF-8 として読めません: {error}") from error


def _load_record(run_dir: Path) -> dict:
    path = run_dir / GATE_JSON
    if not path.is_file():
        raise UsageError(f"{path} がありません。先に init を実行します")
    try:
        record = json.loads(_read_text(path, GATE_JSON))
    except json.JSONDecodeError as error:
        raise UsageError(f"{path} を JSON として読めません: {error}") from error
    if not isinstance(record, dict) or record.get("format") != INPUT_FORMAT \
            or record.get("format_version") != FORMAT_VERSION:
        raise UsageError(f"{path} は {INPUT_FORMAT} 形式 {FORMAT_VERSION} ではありません")
    missing = [key for key in RECORD_KEYS if key not in record]
    if missing or record["gate"] not in GATES or record["scene"] not in SCENES:
        raise UsageError(f"{path} の中身が足りないか、値が違います（足りない: {missing or 'なし'}、"
                         f"gate {record.get('gate')}、scene {record.get('scene')}）。init し直します")
    return record


def review_problems_for(run_dir: Path, record: dict, draft_sha: str) -> tuple[int, int, list[str]]:
    """記入表を読み、(行数, 期待する行数, 問題) を返す。SKILL.md が init のあとで変わっていれば問題にする。"""
    skill_text = _read_text(SKILL_MD, "SKILL.md")
    items = checklist(skill_text, record["gate"])
    problems = []
    skill_sha = hashlib.sha256(skill_text.encode("utf-8")).hexdigest()
    if skill_sha != record["checklist"].get("skill_sha256"):
        problems.append(f"SKILL.md が init のあとで変わりました（init {str(record['checklist'].get('skill_sha256'))[:12]}、"
                        f"今 {skill_sha[:12]}）。項目の中身が変わっていないか読み直し、init し直します")
    review_path = run_dir / REVIEW_MD
    if not review_path.is_file():
        return 0, len(items), problems + [f"{review_path} がありません"]
    review_text = _read_text(review_path, REVIEW_MD)
    rows, duplicate = parse_review(review_text)
    problems += duplicate + reviewed_sha_problems(review_text, draft_sha) + evaluate_review(items, rows)
    return len(rows), len(items), problems


def cmd_check(args: argparse.Namespace) -> int:
    run_dir = Path(args.run_dir)
    record = _load_record(run_dir)
    draft = _existing_file(str(run_dir / record["draft"]), "下書き")
    for rel in record["sources"] + record["materials"]:
        _existing_file(str(run_dir / rel), "原文か資料")
    draft_sha = _sha256(draft)
    row_count, expected, review_problems = review_problems_for(run_dir, record, draft_sha)
    lint = run_lint(draft, record["scene"])
    yomiyasu = run_yomiyasu(record, run_dir, draft)
    reasons = gate_reasons(lint, yomiyasu, review_problems)
    after_sha = _sha256(draft)
    if after_sha != draft_sha:
        # 途中で保存されると、古い版の記入表・lint と新しい版の yomiyasu が混ざる（Codex のレビューで再現）
        reasons.append(f"check の途中で下書きが変わりました（始め {draft_sha[:12]}、終わり {after_sha[:12]}）。保存を終えてから check し直します")
    result = {
        "format": RESULT_FORMAT, "format_version": FORMAT_VERSION, "passed": not reasons,
        "checked_at": _now(), "gate": record["gate"], "scene": record["scene"], "doc_type": record["doc_type"],
        "draft": {"path": record["draft"], "sha256": draft_sha},
        "cor_voice_lint": lint, "yomiyasu": yomiyasu,
        "review": {"rows": row_count, "expected": expected, "problems": review_problems},
        "reasons": reasons,
    }
    (run_dir / RESULT_JSON).write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    summary = render_result(result)
    (run_dir / RESULT_MD).write_text(summary, encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2) if args.json else summary, end="" if not args.json else "\n")
    return 0 if result["passed"] else 1


def render_result(result: dict) -> str:
    lint, run, verify = result["cor_voice_lint"], result["yomiyasu"]["run"], result["yomiyasu"]["verify"]
    lines = [
        f"# cor-voice-gate の結果: {'通った' if result['passed'] else '通らなかった'}",
        "",
        f"- 下書き: `{result['draft']['path']}`（sha256 {result['draft']['sha256'][:12]}）",
        f"- 場面: {result['scene']}、種類: {result['doc_type']}、ゲート: {result['gate']}、実行: {result['checked_at']}",
        f"- cor_voice_lint.py: error {lint['errors']}、warn {lint['warns']}",
        f"- yomiyasu run: {run['status']}、meaning_risk {run['meaning_risk_count']}、事実の穴の候補 {run['fact_gap_count']}",
        f"  - `{run['status_line']}`",
        f"- yomiyasu verify: {verify['status']}",
        f"  - `{verify['status_line']}`",
        f"- 記入表: {result['review']['rows']} / {result['review']['expected']} 行、問題 {len(result['review']['problems'])} 件",
        "",
        "公開と送信はこの結果で決めません。代表が決めます。",
    ]
    if result["reasons"]:
        lines += ["", "## 通らなかった理由", ""] + [f"- {reason}" for reason in result["reasons"]]
    errors = [hit for hit in lint["findings"] if hit["level"] == "error"]
    if errors:
        lines += ["", "## cor_voice_lint.py の error（直すまで渡さない）", ""]
        lines += [f"- {hit['line']} 行目 {hit['rule_id']}: {hit['message']}（{hit['source']}）" for hit in errors]
    if run["meaning_risks"]:
        lines += ["", "## yomiyasu の meaning_risk（0 になるまで渡さない）", ""]
        lines += [f"- {risk['kind']}/{risk['subkind']}（{risk['new_line'] or '-'} 行目）: 前「{risk['old'] or ''}」→ 後「{risk['new'] or ''}」"
                  for risk in run["meaning_risks"]]
    if run["fact_gaps"]:
        # 資料に無い値や約束は meaning_risk にならないことがある（「必ず〜速くなります」を足しても 0 だった）。
        # 機械では止めず、記入表の S5・S14 で止める。だから候補を毎回ここに並べる。
        lines += ["", "## 確かめたい候補（yomiyasu の事実の穴。止めないが、記入表の S5・S14 で判断する）", ""]
        lines += [f"- {gap['line']} 行目（{gap['kind']}）: {gap['sentence']} → 要るもの: {gap['need']}"
                  for gap in run["fact_gaps"]]
    warns = [hit for hit in lint["findings"] if hit["level"] == "warn"]
    if warns:
        lines += ["", "## 止めない候補（cor_voice_lint.py の warn）", ""]
        lines += [f"- {hit['line']} 行目 {hit['rule_id']}: {hit['message']}（{hit['source']}）" for hit in warns]
    return "\n".join(lines) + "\n"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="voice_gate.py", description=__doc__.split("\n\n")[0])
    sub = parser.add_subparsers(dest="command", required=True)
    init = sub.add_parser("init", help="記録のフォルダに gate.json と記入表 review.md を作る")
    init.add_argument("--run-dir", required=True, help="記録のフォルダ（例: .yomiyasu/gate/<名前>。git の対象外）")
    init.add_argument("--draft", required=True, help="下書き（推敲して最終稿にするファイル）")
    init.add_argument("--scene", required=True, choices=SCENES, help="cor-voice §2 の場面")
    init.add_argument("--doc-type", required=True, help="yomiyasu の文書の種類（article、mail、manual、promo など）")
    init.add_argument("--gate", required=True, choices=GATES, help="cor-voice-gate の Fast / Full")
    init.add_argument("--material", action="append", help="依頼と資料（何度でも）")
    init.add_argument("--source", help="直す前の原文（1 つだけ。yomiyasu の run が 1 つしか受けないため）")
    check = sub.add_parser("check", help="検査を動かし、記入表を読んで result.json と result.md を書く")
    check.add_argument("--run-dir", required=True)
    check.add_argument("--json", action="store_true", help="標準出力に result.json と同じものを出す")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return cmd_init(args) if args.command == "init" else cmd_check(args)
    except UsageError as error:
        print(f"voice_gate.py: {error}", file=sys.stderr)
        return 2
    except SetupError as error:
        print(f"voice_gate.py: {error}", file=sys.stderr)
        return 3


if __name__ == "__main__":
    sys.exit(main())
