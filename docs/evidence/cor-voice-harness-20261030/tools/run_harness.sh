#!/bin/bash
# Run one harness on the 3 prompts in its own throwaway copy of the repo snapshot.
# usage: run_harness.sh <round> <harness> <snapshot-dir>
# Writes <eval>/<round>/<harness>/<prompt>.{raw,err,cmd,rc,secs}
set -u
EVAL="$(cd "$(dirname "$0")" && pwd)"
round=$1; h=$2; snap=$3
out="$EVAL/$round/$h"; repo="$out/repo"
mkdir -p "$out"
rm -rf "$repo"; cp -R "$snap" "$repo"
(cd "$repo" && git init -q && git add -A && git -c user.name=eval -c user.email=eval@example.invalid commit -q -m snapshot)
for p in A-article B-mail C-manual; do
  prompt="$(cat "$EVAL/prompts/$p.txt")"
  start=$(date +%s)
  case $h in
    claude)  cmd=(claude -p --output-format text --permission-mode acceptEdits "--allowedTools=Read,Grep,Glob,Write,Edit,Bash(python3:*),Bash(ls:*),Bash(mkdir:*),Bash(cat:*)") ;;
    codex)   cmd=(codex exec -s workspace-write --skip-git-repo-check --ephemeral -C "$repo" -o "$out/$p.last" "$prompt") ;;
    cursor)  cmd=("$HOME/.local/bin/cursor-agent" -p --output-format text --trust --force --workspace "$repo" "$prompt") ;;
    opencode) cmd=(opencode run --auto -m deepseek/deepseek-flash "$prompt") ;;
    pi)      cmd=(pi -p -a --no-session "$prompt") ;;
    dsh)     cmd=(dsh "$prompt") ;;
    grok)    cmd=(grok -p "$prompt" --cwd "$repo" --always-approve --output-format plain --max-turns 40) ;;
  esac
  printf '%q ' "${cmd[@]}" | sed "s#$(printf '%q' "$prompt" | sed 's/[#&]/\\&/g')#<prompt>#" > "$out/$p.cmd" 2>/dev/null || true
  if [ "$h" = claude ]; then
    (cd "$repo" && printf '%s' "$prompt" | timeout 900 "${cmd[@]}" > "$out/$p.raw" 2> "$out/$p.err"); rc=$?
  else
    (cd "$repo" && timeout 900 "${cmd[@]}" < /dev/null > "$out/$p.raw" 2> "$out/$p.err"); rc=$?
  fi
  echo $rc > "$out/$p.rc"; echo $(( $(date +%s) - start )) > "$out/$p.secs"
  [ -f "$out/$p.last" ] && cp "$out/$p.last" "$out/$p.raw.last"
done
echo "done $round $h"
