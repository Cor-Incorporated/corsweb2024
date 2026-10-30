#!/bin/bash
# v2: run_harness.sh と同じ条件。違いは (1) PROMPTS で依頼を選べる (2) KEEP_REPO=1 で既存のコピーを使う
# (3) claude は stream-json で全部の返答を残す（H17 の Stop フックが最後の返答を置き換えても本文が残る）
# usage: [PROMPTS="A-article B-mail"] [KEEP_REPO=1] run_harness2.sh <round> <harness> <snapshot-dir>
set -u
EVAL="$(cd "$(dirname "$0")" && pwd)"
round=$1; h=$2; snap=$3
out="$EVAL/$round/$h"; repo="$out/repo"
mkdir -p "$out"
if [ -z "${KEEP_REPO:-}" ] || [ ! -d "$repo" ]; then
  rm -rf "$repo"; cp -R "$snap" "$repo"
  (cd "$repo" && git init -q && git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -q -m snapshot)
fi
for p in ${PROMPTS:-A-article B-mail C-manual}; do
  prompt="$(cat "$EVAL/prompts/$p.txt")"
  start=$(date +%s)
  case $h in
    claude)  cmd=(claude -p --output-format stream-json --verbose --permission-mode acceptEdits "--allowedTools=Read,Grep,Glob,Write,Edit,Bash(python3:*),Bash(ls:*),Bash(mkdir:*),Bash(cat:*)") ;;
    codex)   cmd=(codex exec -s workspace-write --skip-git-repo-check --ephemeral -C "$repo" -o "$out/$p.last" "$prompt") ;;
    cursor)  cmd=("$HOME/.local/bin/cursor-agent" -p --output-format text --trust --force --workspace "$repo" "$prompt") ;;
    opencode) cmd=(opencode run --auto -m deepseek/deepseek-flash "$prompt") ;;
    pi)      cmd=(pi -p -a --no-session "$prompt") ;;
    dsh)     cmd=(dsh "$prompt") ;;
    grok)    cmd=(grok -p "$prompt" --cwd "$repo" --always-approve --output-format plain --max-turns 40) ;;
  esac
  echo "${cmd[0]} ${cmd[1]} … (prompt=$p)" > "$out/$p.cmd"
  if [ "$h" = claude ]; then
    (cd "$repo" && printf '%s' "$prompt" | timeout 900 "${cmd[@]}" > "$out/$p.jsonl" 2> "$out/$p.err"); rc=$?
    python3 -I -c '
import json, sys
texts = []
for line in open(sys.argv[1], encoding="utf-8", errors="replace"):
    try:
        ev = json.loads(line)
    except ValueError:
        continue
    if ev.get("type") == "assistant":
        for block in ev.get("message", {}).get("content", []):
            if block.get("type") == "text":
                texts.append(block["text"])
print("\n\n".join(texts))
' "$out/$p.jsonl" > "$out/$p.raw"
  else
    (cd "$repo" && timeout 900 "${cmd[@]}" < /dev/null > "$out/$p.raw" 2> "$out/$p.err"); rc=$?
  fi
  echo $rc > "$out/$p.rc"; echo $(( $(date +%s) - start )) > "$out/$p.secs"
  [ -f "$out/$p.last" ] && cp "$out/$p.last" "$out/$p.raw.last"
done
echo "done $round $h"
