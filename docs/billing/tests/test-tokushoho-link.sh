#!/usr/bin/env bash
# 特商法ページの月額と plans.json の basic の金額を結ぶ検査（同じ事実が 2 か所にあるため）。
# 実行: bash docs/billing/tests/test-tokushoho-link.sh
# 片方だけ変えると、両方の値を出して落ちる。
# 特商法ページに月額の行がまだ無いとき（特商法の PR の merge 前）は SKIP と出して 0 で終わる。
# 検査そのものの反証: 同じファイルの末尾で、金額を変えた plans.json の写しで落ちることを確かめる。
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
PLANS="${PLANS_JSON:-$ROOT/docs/billing/plans.json}"
PAGE="${TOKUSHOHO_PAGE:-$ROOT/src/pages/legal/tokushoho.astro}"
readonly MARK="月額でご提供するサービス"

# check <plans> <page> → 0 = 一致、1 = 不一致（理由を出す）、2 = 月額の行が無い
check() {
  local plans="$1" page="$2" amounts n amount want
  grep -qF "$MARK" "$page" || return 2
  amounts="$(jq -r '
    def comma: tostring | if length <= 3 then . else (.[0:length-3] | comma) + "," + .[length-3:] end;
    [.prices[] | select(.plan == "basic" and .enabled == true) | .unit_amount_jpy_excl_tax] | unique | map(comma) | .[]' "$plans")"
  n="$(printf '%s\n' "$amounts" | grep -c . || true)"
  if [ "$n" -ne 1 ]; then
    printf 'NG: plans.json の有効な basic の金額が %s 種類（%s）。特商法の「1 サービスにつき月額」の 1 行では書けない\n' "$n" "$(printf '%s' "$amounts" | paste -sd'/' -)"
    return 1
  fi
  amount="$amounts"
  want="月額&nbsp;${amount}&nbsp;円（税別）"
  if ! grep -qF "$want" "$page"; then
    printf 'NG: 特商法ページに「%s」が無い（plans.json の basic は %s 円・税別。ページの月額の行: %s）\n' "$want" "$amount" \
      "$(grep -oE '月額&nbsp;[0-9,]+&nbsp;円（[^）]*）' "$page" | head -1 || printf 'なし')"
    return 1
  fi
  printf 'ok: 特商法ページの月額 %s 円（税別）は plans.json の basic と一致\n' "$amount"
}

set +e
check "$PLANS" "$PAGE"
rc=$?
set -e
case "$rc" in
  0) ;;
  2)
    printf 'SKIP: %s に「%s」の行がまだ無い（特商法の PR の merge 前）\n' "$PAGE" "$MARK"
    exit 0
    ;;
  *) exit 1 ;;
esac

# 反証: 金額を変えた plans.json の写しで落ちること
tmp="$(mktemp "${TMPDIR:-/tmp}/plans-mutated.XXXXXX")"
trap 'rm -f "$tmp"' EXIT
jq '(.prices[] | select(.plan == "basic") | .unit_amount_jpy_excl_tax) |= (if . == null then . else . + 2000 end)' "$PLANS" >"$tmp"
if check "$tmp" "$PAGE" >/dev/null; then
  printf 'FAIL: 金額を変えた plans.json でも通った（検査が効いていない）\n'
  exit 1
fi
printf 'ok: 金額を変えた plans.json では落ちる（反証）\n'
