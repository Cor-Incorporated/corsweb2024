#!/usr/bin/env bash
# H5 — Admission fee for block-capable guards / completion verifiers (required check).
# Spec: aidd-governance design/harness-spec.md H5, design/ops/harness/h5-negative-test-gate.md
#
# Exit 0: not a guard PR, or 3-point set present
# Exit 1: guard PR missing negative-test evidence / ledger wiring / retirement condition
# Exit 0 with warn: fail-open structural smell (does not block)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BASE_REF="${H5_BASE_REF:-origin/develop}"
HEAD_REF="${H5_HEAD_REF:-HEAD}"
PR_BODY="${H5_PR_BODY:-}"
LEDGER_PATH="${H5_LEDGER_PATH:-$HOME/.claude/hooks/ledger/guard-ledger.jsonl}"

log() { printf '%s\n' "$*"; }
warn() { printf 'H5-WARN: %s\n' "$*" >&2; }
fail() { printf 'H5-FAIL: %s\n' "$*" >&2; }

# --- Collect PR body (CI or local override) ---
if [[ -z "$PR_BODY" && -n "${GITHUB_EVENT_PATH:-}" && -f "${GITHUB_EVENT_PATH}" ]]; then
  PR_BODY="$(python3 - <<'PY' 2>/dev/null || true
import json, os
path = os.environ["GITHUB_EVENT_PATH"]
with open(path) as f:
    ev = json.load(f)
body = (ev.get("pull_request") or {}).get("body") or ""
print(body)
PY
)"
fi
if [[ -z "$PR_BODY" && -n "${H5_PR_NUMBER:-}" ]]; then
  PR_BODY="$(gh pr view "$H5_PR_NUMBER" --json body -q .body 2>/dev/null || true)"
fi

# --- Diff paths ---
if [[ -n "${H5_DIFF_FILES:-}" ]]; then
  # Newline or space separated override (tests). Split on whitespace without glob expansion: an unquoted
  # $H5_DIFF_FILES would also turn hooks/[x].sh into hooks/x.sh when that file exists.
  DIFF_FILES="$(printf '%s' "$H5_DIFF_FILES" | tr -s '[:space:]' '\n')"
else
  # --depth=1 only for a checkout that is already shallow. On a complete clone (CI checks out with fetch-depth: 0, and
  # local clones are complete) it writes the base tip into .git/shallow: every worktree sharing that .git then sees cut
  # history, and the base tip has no parents. Once that tip differs from the commit HEAD was built on (in CI the first
  # parent of the test merge commit, e.g. on a re-run after the base moved; locally the PR's fork point), the three-dot
  # diff below finds no merge base and falls back to two dots, counting the base's own changes (e.g. a workflow merged
  # into develop meanwhile) as the PR's (2026-10-01).
  # The explicit refspec also updates origin/<base> in a --single-branch clone, where a bare branch name only moves FETCH_HEAD.
  base_branch="${BASE_REF#origin/}"
  base_refspec="+refs/heads/${base_branch}:refs/remotes/origin/${base_branch}"
  if [[ "$(git rev-parse --is-shallow-repository 2>/dev/null)" == "true" ]]; then
    git fetch --no-tags --depth=1 origin "$base_refspec" 2>/dev/null || true
  else
    git fetch --no-tags origin "$base_refspec" 2>/dev/null || true
  fi
  if git rev-parse --verify "$BASE_REF" >/dev/null 2>&1; then
    if ! DIFF_FILES="$(git diff --name-only "$BASE_REF"..."$HEAD_REF" 2>/dev/null)"; then
      warn "three-dot diff $BASE_REF...$HEAD_REF failed (no merge base?): falling back to a two-dot diff, which also lists the base's own changes"
      if ! DIFF_FILES="$(git diff --name-only "$BASE_REF" "$HEAD_REF" 2>/dev/null)"; then
        # Fail closed: an empty diff would pass any PR as "not a guard PR" (e.g. a mistyped H5_HEAD_REF).
        fail "cannot diff $BASE_REF against $HEAD_REF: check H5_BASE_REF and H5_HEAD_REF"
        exit 1
      fi
    fi
  else
    DIFF_FILES="$(git diff --name-only HEAD~1...HEAD 2>/dev/null || true)"
  fi
fi

is_guard_pr=0
# Structural triggers: any path that can change guard force projection.
# Keep this set and the H5-guard:no exemption-denylist (below) IDENTICAL.
# Phase 5 T5-2: must cover hooks/lib/** and scripts/** (.+\.sh), not only hooks/[^/]+\.sh
# Checklist S9 expects this form (hooks/.+\.sh includes hooks/lib/*.sh).
_H5_STRUCT_RE='^(hooks/.+\.sh|scripts/.+\.sh|settings\.json|\.github/workflows/)'
if printf '%s\n' "$DIFF_FILES" | grep -qE "$_H5_STRUCT_RE"; then
  is_guard_pr=1
  # Name the paths that made this a guard PR, so a false positive (e.g. the two-dot fallback above) can be told apart
  # from a real workflow change in the log. awk reads all of its input, so it cannot close the pipe early.
  log "H5: structural paths in the diff: $(printf '%s\n' "$DIFF_FILES" | grep -E "$_H5_STRUCT_RE" | awk 'NR <= 5' | tr '\n' ' ')"
fi
# Self-declaration (PR template)
if printf '%s' "$PR_BODY" | grep -qiE 'H5-guard:\s*yes|ブロック権限|完了判定検証器|block-capable guard'; then
  is_guard_pr=1
fi
# H5-guard: no may only clear the flag when NO structural path is touched.
# Previously the denylist was a subset (hooks/*.sh|hooks/lib|settings) so
# scripts/** and .github/workflows/** could self-exempt — that hole is closed.
if printf '%s' "$PR_BODY" | grep -qiE 'H5-guard:\s*no' \
  && ! printf '%s' "$PR_BODY" | grep -qiE 'H5-guard:\s*yes'; then
  if ! printf '%s\n' "$DIFF_FILES" | grep -qE "$_H5_STRUCT_RE"; then
    is_guard_pr=0
  fi
fi

if [[ "$is_guard_pr" -eq 0 ]]; then
  log "H5-PASS: not a guard/verifier PR (no structural trigger / declared N/A)"
  exit 0
fi

log "H5: guard/verifier PR detected — checking 3-point admission fee"

# Ignore negation/meta lines so "missing 陰性テスト" does not count as evidence
PR_BODY_EVIDENCE="$(printf '%s\n' "$PR_BODY" | grep -viE \
  'intentionally missing|expect red|do not merge|falsification only|未記入|TODO 陰性|TODO 台帳|TODO 廃止' || true)"

missing=()

# Prefer explicit machine markers (H5-NEGATIVE: / H5-LEDGER: / H5-RETIRE:)
# Fall back to Japanese/English section content of sufficient length.
# A marker needs at least H5_MARKER_MIN characters of content on the same line, the same minimum as a section.
# Counted in Python so that the length is in characters in every locale (grep counts bytes in the C locale, where one
# Japanese character is three bytes). Any horizontal space may follow the colon (including U+3000 and no-break space).
# A content that is only a placeholder such as <...> does not count. The body goes through stdin, not the
# environment (an environment string is limited to 128 KiB on Linux).
H5_MARKER_MIN=20
# The Python programs below are single-quoted on purpose: their $ and \ belong to Python regexes, not the shell.
# shellcheck disable=SC2016
H5_MARKER_PY='
import re, sys
key = sys.argv[1]
body = sys.stdin.read()
pattern = r"(?im)(?:^|\s)H5-" + re.escape(key) + r":[^\S\n]*(\S.*)$"
contents = [m.group(1).rstrip() for m in re.finditer(pattern, body)]
real = [c for c in contents if not re.fullmatch(r"<[^>]*>", c)]
print(max((len(c) for c in real), default=-1))
'
# Longest content length of the H5-<key>: markers (-1 when there is none)
marker_length() {
  printf '%s' "$PR_BODY_EVIDENCE" | python3 -c "$H5_MARKER_PY" "$1" 2>/dev/null || echo -1
}
has_marker() {
  [[ "$(marker_length "$1")" -ge "$H5_MARKER_MIN" ]]
}
# What was found, for the failure message (rule: show observed values, not only the expectation)
describe_marker() {
  local n
  n="$(marker_length "$1")"
  if [[ "$n" -lt 0 ]]; then printf 'H5-%s: none counted' "$1"; else printf 'H5-%s: longest %s chars' "$1" "$n"; fi
}

# shellcheck disable=SC2016
H5_SECTION_PY='
import re, sys
title = sys.argv[1]
minimum = int(sys.argv[2])
body = sys.stdin.read()
m = re.search(r"(?im)^#{1,3}\s*(?:" + title + r")\s*$([\s\S]*?)(?=^#{1,3}\s|\Z)", body)
if not m:
    sys.exit(1)
content = m.group(1).strip()
if len(content) < minimum or re.fullmatch(r"[-*\[\] xX\s]*", content):
    sys.exit(1)
'
has_section_content() {
  printf '%s' "$PR_BODY_EVIDENCE" | python3 -c "$H5_SECTION_PY" "$1" "$H5_MARKER_MIN" 2>/dev/null
}

# (1) Negative test evidence (known-bad → red measured)
neg_ok=0
has_marker "NEGATIVE" && neg_ok=1
# The section title is a Python regex (\s, not the POSIX [[:space:]] that Python reads as a nested set)
has_section_content '陰性テスト|negative[\s-]?test' && neg_ok=1
if [[ "$neg_ok" -eq 0 ]]; then
  if printf '%s' "$PR_BODY_EVIDENCE" | grep -qiE '(陰性テスト|negative[[:space:]-]?test)' \
    && printf '%s' "$PR_BODY_EVIDENCE" | grep -qiE '(red 実測|exit[[:space:]]*[12]|FAILED|known-bad|inject)'; then
    neg_ok=1
  fi
fi
[[ "$neg_ok" -eq 0 ]] && missing+=("negative-test-evidence")

# (2) H6 ledger wiring — an H5-LEDGER: marker or a ledger section in the body, or a changed hooks/** or scripts/h5*
# file that writes to the ledger: aidd_ledger_append run as a command (at the start of a line, or after && || ; then do),
# or an append (>>) to a *LEDGER* path, on a line that is not a comment. This is a heuristic, not a shell parser: it misses
# some real calls (after if ! { else, a pipe or $(...)) and can count some mentions inside strings or heredocs, so the
# H5-LEDGER: marker or a ledger section is the reliable evidence. A bare mention of guard-ledger.jsonl or
# aidd_ledger_append, in the body or in a comment, does not count: "guard-ledger.jsonl への配線は無い" used to pass
# (PR #371 and #375 reviews, 2026-10-01). The last grep writes to /dev/null instead of -q: with pipefail, -q closes the
# pipe early and the first grep dies with SIGPIPE (exit 141) on a large file.
has_ledger_body=0
has_marker "LEDGER" && has_ledger_body=1
has_section_content '台帳|ledger|防御台帳' && has_ledger_body=1
has_ledger_code=0
while IFS= read -r f; do
  [[ -z "$f" || ! -f "$f" ]] && continue
  if grep -vE '^[[:space:]]*#' "$f" 2>/dev/null \
    | grep -E '(^|&&|\|\||;|[[:space:]]then|[[:space:]]do)[[:space:]]*aidd_ledger_append[[:space:]]|>>[[:space:]]*"?\$\{?[A-Z_]*LEDGER' >/dev/null; then
    has_ledger_code=1
    break
  fi
done <<<"$(printf '%s\n' "$DIFF_FILES" | grep -E '^hooks/|^scripts/h5' || true)"
if [[ "$has_ledger_body" -eq 0 && "$has_ledger_code" -eq 0 ]]; then
  missing+=("ledger-wiring")
fi

# (3) Retirement condition declared
ret_ok=0
has_marker "RETIRE" && ret_ok=1
has_section_content '廃止条件|retirement' && ret_ok=1
if printf '%s' "$PR_BODY_EVIDENCE" | grep -qiE '(廃止条件|retirement).{0,80}(90|発火ゼロ|FP|false.?positive|退役)'; then
  ret_ok=1
fi
[[ "$ret_ok" -eq 0 ]] && missing+=("retirement-condition")

# ADR-002 subtraction gate: require retire PR MERGED (state, not string-only) OR explicit N/A
sub_ok=0
if printf '%s' "$PR_BODY_EVIDENCE" | grep -qiE 'H5-SUBTRACTION:\s*N/?A'; then
  sub_ok=1
fi
retire_pr="$(printf '%s' "$PR_BODY" | grep -oiE 'H5-RETIRE-PR:[[:space:]]*[0-9]+' | head -1 | grep -oE '[0-9]+' || true)"
if [[ -n "$retire_pr" ]]; then
  if command -v gh >/dev/null 2>&1; then
    st="$(gh pr view "$retire_pr" --json state -q .state 2>/dev/null || echo UNKNOWN)"
    if [[ "$st" == "MERGED" ]]; then
      sub_ok=1
      log "H5: subtraction PR #$retire_pr state=MERGED"
    else
      fail "subtraction PR #$retire_pr state=$st (need MERGED)"
      missing+=("subtraction-pr-not-merged")
    fi
  else
    warn "gh unavailable; cannot verify H5-RETIRE-PR:$retire_pr state"
    missing+=("subtraction-pr-unverified")
  fi
fi
if [[ "$sub_ok" -eq 0 ]] && ! printf '%s' "${missing[*]}" | grep -q subtraction; then
  missing+=("subtraction-gate")
fi

# Fail-open structural smell (warn only) on changed shell hooks
while IFS= read -r f; do
  [[ -z "$f" || ! -f "$f" ]] && continue
  [[ "$f" != hooks/* ]] && continue
  # crude: catch "|| true" / "|| :" after critical decision paths + "exit 0" in error handlers
  if grep -nE '\|\|\s*(true|:)\s*$' "$f" | grep -qiE 'jq|curl|gh |git ' ; then
    warn "possible fail-open (command || true) in $f — review manually"
  fi
done <<<"$(printf '%s\n' "$DIFF_FILES")"

if ((${#missing[@]} > 0)); then
  fail "admission fee incomplete: ${missing[*]}"
  fail "found: $(describe_marker NEGATIVE) / $(describe_marker LEDGER) / $(describe_marker RETIRE) (each needs >= ${H5_MARKER_MIN} chars on the same line)"
  fail "not counted: <...> placeholders, and lines containing intentionally missing / expect red / do not merge / falsification only / 未記入 / TODO 陰性 / TODO 台帳 / TODO 廃止"
  fail "sections accepted (heading text exactly): 陰性テスト|negative test / 台帳|ledger|防御台帳 / 廃止条件|retirement (>= ${H5_MARKER_MIN} chars of content)"
  fail "ledger from code: a changed hooks/** or scripts/h5* file that runs the ledger append helper as a command, or appends (>>) to a *LEDGER* path"
  fail "Required: (1) 陰性テスト red 実測記録 (2) H6 台帳配線 (3) 廃止条件宣言 — in PR body and/or code"
  fail "See design/ops/harness/h5-negative-test-gate.md"
  # Optional local ledger (does not affect CI if path missing)
  if [[ -n "$LEDGER_PATH" ]]; then
    mkdir -p "$(dirname "$LEDGER_PATH")" 2>/dev/null || true
    ts="$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo unknown)"
    printf '{"ts":"%s","component":"H5","event":"block","rule":"negative-test-missing","detail":"%s","agent":"ci"}\n' \
      "$ts" "${missing[*]}" >>"$LEDGER_PATH" 2>/dev/null || true
  fi
  exit 1
fi

log "H5-PASS: 3-point admission fee present (negative-test + ledger + retirement)"
exit 0
