#!/usr/bin/env bash
# 測定のみ: claude-code-skills の tests/test-cross-tool-force-matrix.sh と同じ入力契約で、
# fixture の代わりに実 worktree を cwd にして 3 ツールの強制点を叩く。HOME は一時ディレクトリにして実台帳へ書かない。
set -uo pipefail
WT=$1; MH=$(mktemp -d); trap 'rm -rf "$MH"' EXIT
mkdir -p "$MH/.claude/hooks/lib"; cp "$HOME/Developer/claude-code-skills/hooks/lib/aidd-ledger.sh" "$MH/.claude/hooks/lib/"
CCG="$HOME/.claude/hooks/git-push-guard.sh"; CCP="$HOME/.claude/hooks/protect-branches.sh"; CU="$HOME/.cursor/hooks/git-guard.sh"; CX="$HOME/.codex/rules/default.rules"
BAD=('git push origin --mirror' 'git push origin "--mirror"' 'git push --mirror origin' 'git push origin +main' 'git push origin +main:main' 'git push origin +develop' 'git push --force origin main' 'git push -f origin main' 'git push --force-with-lease origin main' 'git push --all --force origin' 'git push origin --delete main' 'git push origin :main' 'git -c foo=bar push origin --mirror' 'git push origin main' 'git push -u origin develop')
GOOD=('git push origin feat/x' 'git push -u origin docs/y' 'git status')
cc(){ local p rc1=0 rc2=0; p=$(python3 -c 'import json,sys; print(json.dumps({"tool_name":"Bash","tool_input":{"command":sys.argv[1]}}))' "$1")
  printf '%s' "$p" | (cd "$WT" && env HOME="$MH" AIDD_LEDGER_SOURCE=test bash "$CCG") >/dev/null 2>&1 || rc1=$?
  printf '%s' "$p" | (cd "$WT" && env HOME="$MH" AIDD_LEDGER_SOURCE=test bash "$CCP") >/dev/null 2>&1 || rc2=$?
  if [ $rc1 -ne 0 ] || [ $rc2 -ne 0 ]; then echo "BLOCK($rc1/$rc2)"; else echo ALLOW; fi; }
cu(){ local p out; p=$(python3 -c 'import json,sys; print(json.dumps({"command":sys.argv[1]}))' "$1")
  out=$(printf '%s' "$p" | (cd "$WT" && env HOME="$MH" AIDD_LEDGER_SOURCE=test bash "$CU") 2>/dev/null || true)
  if printf '%s' "$out" | grep -q '"deny"'; then echo BLOCK; else echo ALLOW; fi; }
cx(){ (cd "$WT" && python3 - "$CX" "$1" <<'PY'
import shlex,subprocess,sys
r=subprocess.run(["codex","execpolicy","check","--rules",sys.argv[1],*shlex.split(sys.argv[2])],capture_output=True,text=True)
print("BLOCK" if "forbidden" in r.stdout else "ALLOW")
PY
); }
hb=0; fp=0
echo "cwd=$WT branch=$(git -C "$WT" branch --show-current) head=$(git -C "$WT" rev-parse --short HEAD)"
for c in "${BAD[@]}"; do a=$(cc "$c"); b=$(cu "$c"); d=$(cx "$c"); printf 'BAD  %-45s CC=%s CU=%s CX=%s\n' "$c" "$a" "$b" "$d"
  for v in "$a" "$b" "$d"; do [ "$v" = ALLOW ] && hb=$((hb+1)); done; done
for c in "${GOOD[@]}"; do a=$(cc "$c"); b=$(cu "$c"); d=$(cx "$c"); printf 'GOOD %-45s CC=%s CU=%s CX=%s\n' "$c" "$a" "$b" "$d"
  for v in "$a" "$b" "$d"; do [ "$v" != ALLOW ] && fp=$((fp+1)); done; done
echo "holes=$hb false_positives=$fp"
