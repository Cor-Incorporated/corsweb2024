#!/usr/bin/env bash
# voice 技能（yomiyasu・cor-voice・cor-voice-gate）を、ハーネスなしで一周させるデモ。
#
# 各手順は env -i で始めた bash で動かす。PATH には python3 だけを置いたフォルダと /usr/bin、/bin だけ、
# HOME は空のフォルダ。ハーネスの CLI（claude など）も、ハーネスの環境変数も無い。
# 推敲そのもの（下書きを直し、記入表を書く）は人か、どのハーネスでもよい。このデモでは用意したファイルの cp で置き換える。
#
# 使い方: bash docs/evidence/voice-gate-no-harness-20261105/run-demo.sh [記録の出力先]
# 既定の出力先はこのフォルダの log/。記録の中の一時フォルダは <work>、リポジトリは <repo> に置き換える。
# 期待した終了コードと違う手順があれば、そこで止まって終了コード 1 で終わる。
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
OUT="${1:-$HERE/log}"
PYTHON="$(command -v python3)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

mkdir -p "$WORK/bin" "$WORK/home" "$OUT"
ln -s "$PYTHON" "$WORK/bin/python3"
cp "$HERE/fixtures/request.md" "$WORK/request.md"
cp "$HERE/fixtures/material.md" "$WORK/material.md"
cp "$HERE/fixtures/draft-v1.md" "$WORK/draft.md"

GATE="$ROOT/.claude/skills/cor-voice-gate/scripts/voice_gate.py"
YOMIYASU="$ROOT/.claude/skills/yomiyasu/scripts/yomiyasu_check.py"
RUN="$WORK/run"
LOG="$OUT/transcript.md"

hide() { sed -e "s#$WORK#<work>#g" -e "s#$ROOT#<repo>#g"; }

clean() {
  # 新しい bash には外の pipefail が引き継がれないので、ここでも付ける（パイプの前段の失敗を隠さない）
  env -i PATH="$WORK/bin:/usr/bin:/bin" HOME="$WORK/home" LANG=C.UTF-8 bash --noprofile --norc -o pipefail -c "$1"
}

# step <見出し> <期待する終了コード> <コマンド>
step() {
  local title="$1" want="$2" command="$3" output rc=0
  output="$(clean "$command" 2>&1)" || rc=$?
  {
    printf '## %s\n\n```console\n$ %s\n' "$title" "$command"
    printf '%s\n' "$output"
    printf '```\n\n終了コード: %s（期待: %s）\n\n' "$rc" "$want"
  } | hide >> "$LOG"
  if [ "$rc" != "$want" ]; then
    printf 'run-demo.sh: 「%s」の終了コードが %s でした（期待は %s）。%s を見てください\n' "$title" "$rc" "$want" "$LOG" >&2
    exit 1
  fi
}

save_result() { hide < "$RUN/result.json" > "$OUT/$1"; }

{
  printf '# 記録: ハーネスなしで voice 技能を一周させる\n\n'
  printf -- '- 実行: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf -- '- Python: %s\n' "$("$PYTHON" -I -c 'import platform; print(platform.python_version())')"
  printf -- '- voice_gate.py: sha256 %s\n' "$(shasum -a 256 "$GATE" | cut -c1-12)"
  printf -- '- cor-voice-gate/SKILL.md: sha256 %s\n\n' "$(shasum -a 256 "$ROOT/.claude/skills/cor-voice-gate/SKILL.md" | cut -c1-12)"
} > "$LOG"

step "0. 環境: ハーネスの CLI と環境変数が無い" 0 \
  'if command -v claude; then exit 9; fi; echo "claude: PATH に無い"; env | cut -d= -f1 | sort | tr "\n" " "; echo'

step "1. init: 記録のフォルダと記入表を作る" 0 \
  "python3 -I -B '$GATE' init --run-dir '$RUN' --draft '$WORK/draft.md' --material '$WORK/request.md' --material '$WORK/material.md' --scene company --doc-type promo --gate fast"

step "2. check: 直す前の下書き（記入表は空）" 1 \
  "python3 -I -B '$GATE' check --run-dir '$RUN'"
save_result result-2-before.json

step "3. 直す: 下書きを直し、記入表を書く（人かハーネスの作業を cp で置き換える）" 0 \
  "cp '$HERE/fixtures/draft-v2.md' '$WORK/draft.md' && cp '$HERE/fixtures/review-v2.md' '$RUN/review.md'"

step "4. check: 直した下書き" 0 \
  "python3 -I -B '$GATE' check --run-dir '$RUN'"
save_result result-4-after.json

step "5. 2 人目の読み手: 同じフォルダで check をもう一度動かし、結果の要点だけを読む" 0 \
  "python3 -I -B '$GATE' check --run-dir '$RUN' --json | python3 -I -c 'import json, sys; d = json.load(sys.stdin); print(\"passed\", d[\"passed\"], \"sha256\", d[\"draft\"][\"sha256\"][:12], \"meaning_risk\", d[\"yomiyasu\"][\"run\"][\"meaning_risk_count\"]); sys.exit(0 if d[\"passed\"] else 1)'"

step "6. 通ったあとに 1 文を足す" 0 \
  "printf '日本初の仕組みです。\n' >> '$WORK/draft.md'"

step "7. yomiyasu の verify だけを動かす: 記録と最終稿が合わない" 1 \
  "python3 -I -B '$YOMIYASU' verify --final '$WORK/draft.md' --state-dir '$RUN/.yomiyasu'"

step "8. check: 足した 1 文で止まる" 1 \
  "python3 -I -B '$GATE' check --run-dir '$RUN'"
save_result result-8-edited.json

step "9. 直した下書きに戻し、機械の検査では止まらない 1 文（資料に無い効果）を足す" 0 \
  "cp '$HERE/fixtures/draft-v2.md' '$WORK/draft.md' && printf '必ず採用の判断が速くなります。\n' >> '$WORK/draft.md'"

step "10. check: lint と meaning_risk は 0 でも、記入表が別の版を読んだものなので止まる" 1 \
  "python3 -I -B '$GATE' check --run-dir '$RUN'"
save_result result-10-unreviewed.json

printf '全手順が期待どおりの終了コードで終わりました。記録: %s\n' "$LOG"
