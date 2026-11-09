#!/usr/bin/env bash
# shellcheck disable=SC2015 # 「A が成り立てば ok、そうでなければ ng」の形。ok は必ず 0 を返すので、A が成り立ったときに ng は走らない（結果の報告だけに使う）
# リポジトリ直下の .gitleaksignore の検査。gitleaks も通信も使わない（git の履歴と jq だけ）。
# 実行: bash docs/billing/tests/test-gitleaksignore.sh
# 確かめること:
#   1. 除く検出は docs/billing/plans.json の generic-api-key だけ（ほかのファイルや規則を除かない）
#   2. 除く commit がこのリポジトリの履歴にある
#   3. 除く行の中身が、税率の識別子（今の plans.json の tax_rate.id と同じ値、英小文字・数字・_ だけ）
#      であり、秘密ではない。行の中身が違えば、期待と観測の両方を出して落ちる
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$HERE" rev-parse --show-toplevel)"
IGNORE="${GITLEAKSIGNORE:-$ROOT/.gitleaksignore}"
PLANS="$ROOT/docs/billing/plans.json"
PASS=0
FAIL=0

ok() { PASS=$((PASS + 1)); printf 'ok   %s\n' "$1"; }
ng() { FAIL=$((FAIL + 1)); printf 'FAIL %s\n' "$1"; }

[ -f "$IGNORE" ] || { printf 'FAIL .gitleaksignore が無い: %s\n' "$IGNORE"; exit 1; }
want="$(jq -r '.tax_rate.id' "$PLANS")"
if printf '%s' "$want" | grep -Eq '^[a-z0-9_]+$'; then
  ok "plans.json の tax_rate.id は識別子の形（観測: ${want}）"
else
  ng "plans.json の tax_rate.id が識別子の形でない（観測: ${want}）"
fi

entries=0
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in '' | '#'*) continue ;; esac
  entries=$((entries + 1))
  IFS=: read -r commit path rule lineno extra <<<"$line"
  [ -z "${extra:-}" ] && [ -n "${lineno:-}" ] || { ng "fingerprint の形が commit:path:rule:line でない（観測: ${line}）"; continue; }
  [ "$path" = "docs/billing/plans.json" ] && ok "$commit の対象は plans.json" || ng "$commit の対象が plans.json でない（観測: ${path}）"
  [ "$rule" = "generic-api-key" ] && ok "$commit の規則は generic-api-key" || ng "$commit の規則が generic-api-key でない（観測: ${rule}）"
  if ! git -C "$ROOT" cat-file -e "$commit^{commit}" 2>/dev/null; then
    ng "$commit が履歴に無い"
    continue
  fi
  ok "$commit は履歴にある"
  got="$(git -C "$ROOT" show "$commit:$path" | sed -n "${lineno}p")"
  if printf '%s\n' "$got" | grep -Eq "^[[:space:]]*\"[a-z_]+\": \"${want}\",?$"; then
    ok "$commit の $lineno 行目は税率の識別子（${want}）"
  else
    ng "$commit の $lineno 行目が税率の識別子でない（期待: \"…\": \"$want\" 観測: ${got}）"
  fi
done <"$IGNORE"

[ "$entries" -ge 1 ] && ok ".gitleaksignore の検出は $entries 件" || ng ".gitleaksignore に検出が 1 件も無い"

printf '\n%d passed, %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
