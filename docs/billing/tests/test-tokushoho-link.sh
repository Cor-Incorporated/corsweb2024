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
  check_locales "$amount" "$page" || return 1
  check_cancellation "$plans" "$page"
}

# en / zh / ko / es の同じページ（src/pages/<lang>/legal/tokushoho.astro）の月額だけを見る。
# 解約条件と、日本法・日本語版が正本の注記は見ていない（ja の解約条件だけを check_cancellation が見る）
check_locales() {
  local amount="$1" page="$2" dir lang file want
  dir="$(dirname "$page")"
  for lang in en zh ko es; do
    file="$dir/../$lang/legal/tokushoho.astro"
    case "$lang" in
      en) want="JPY&nbsp;${amount} per month" ;;
      zh) want="每月&nbsp;${amount}&nbsp;日元" ;;
      ko) want="월&nbsp;${amount}&nbsp;엔" ;;
      es) want="${amount//,/.}&nbsp;JPY al mes" ;;
    esac
    [ -f "$file" ] || { printf 'NG: %s が無い\n' "$file"; return 1; }
    if ! grep -qF "$want" "$file"; then
      printf 'NG: %s の月額に「%s」が無い（plans.json の basic は %s 円・税別）\n' "$lang" "$want" "$amount"
      return 1
    fi
  done
  printf 'ok: en / zh / ko / es の月額も plans.json の basic と一致\n'
}

# 解約の条件: ページの「受理した日の N か月後の同じ日」「日割り」「返金いたしません」と plans.json の cancellation
check_cancellation() {
  local plans="$1" page="$2" months final refund row want
  months="$(jq -r '.cancellation.notice_months' "$plans")"
  final="$(jq -r '.cancellation.final_period' "$plans")"
  refund="$(jq -r '.cancellation.refund' "$plans")"
  row="$(grep -F '定期購入・サブスクリプションの解約条件' "$page" || true)"
  [ -n "$row" ] || { printf 'NG: 特商法ページに「定期購入・サブスクリプションの解約条件」の行が無い\n'; return 1; }
  want="受理した日の&nbsp;${months}&nbsp;か月後の同じ日"
  if ! printf '%s' "$row" | grep -qF "$want"; then
    printf 'NG: 解約条件の行に「%s」が無い（plans.json の cancellation.notice_months は %s。ページの行: %s）\n' "$want" "$months" \
      "$(printf '%s' "$row" | grep -oE '受理した日の&nbsp;[0-9]+&nbsp;か月後' | head -1 || printf 'なし')"
    return 1
  fi
  if [ "$final" = "prorated" ] && ! printf '%s' "$row" | grep -qF '日割り'; then
    printf 'NG: plans.json の cancellation.final_period は prorated だが、解約条件の行に「日割り」が無い\n'
    return 1
  fi
  if [ "$refund" = "none" ] && ! printf '%s' "$row" | grep -qF '返金いたしません'; then
    printf 'NG: plans.json の cancellation.refund は none だが、解約条件の行に「返金いたしません」が無い\n'
    return 1
  fi
  printf 'ok: 特商法ページの解約条件（%s か月後の同じ日、%s、返金 %s）は plans.json の cancellation と一致\n' "$months" "$final" "$refund"
  check_terms "$plans" "$page"
}

# 請求の形（支払時期の行）と最低利用期間（解約条件の行）: plans.json の billing と minimum_term
check_terms() {
  local plans="$1" page="$2" closing due first term fee dev years row timing
  closing="$(jq -r '.billing.closing' "$plans")"
  due="$(jq -r '.billing.payment_due' "$plans")"
  first="$(jq -r '.billing.first_month' "$plans")"
  term="$(jq -r '.minimum_term.months' "$plans")"
  fee="$(jq -r '.minimum_term.early_termination_fee' "$plans")"
  dev="$(jq -r '.minimum_term.dev_fee_on_early_termination' "$plans")"
  timing="$(grep -F '>支払時期<' "$page" || true)"
  row="$(grep -F '定期購入・サブスクリプションの解約条件' "$page" || true)"
  if [ "$closing/$due" = "month_end/end_of_next_month" ] && ! printf '%s' "$timing" | grep -qF '毎月末日で締め、翌月末日にお支払いいただきます'; then
    printf 'NG: plans.json の billing は %s / %s だが、支払時期の行に「毎月末日で締め、翌月末日にお支払いいただきます」が無い\n' "$closing" "$due"
    return 1
  fi
  if [ "$first" = "full_month" ] && [ "$closing" = "month_end" ] && ! printf '%s' "$timing" | grep -qF '1&nbsp;か月分をご請求します'; then
    printf 'NG: plans.json の billing.first_month は full_month だが、支払時期の行に「1&nbsp;か月分をご請求します」が無い\n'
    return 1
  fi
  if [ $((term % 12)) -ne 0 ] || [ "$term" -eq 0 ]; then
    printf 'NG: plans.json の minimum_term.months は %s。ページは「ご契約から N 年間」で書くので 12 の倍数にする\n' "$term"
    return 1
  fi
  years=$((term / 12))
  if ! printf '%s' "$row" | grep -qF "最低利用期間は、ご契約から&nbsp;${years}&nbsp;年間です"; then
    printf 'NG: 解約条件の行に「最低利用期間は、ご契約から&nbsp;%s&nbsp;年間です」が無い（plans.json の minimum_term.months は %s。ページの行: %s）\n' "$years" "$term" \
      "$(printf '%s' "$row" | grep -oE '最低利用期間は、ご契約から&nbsp;[0-9]+&nbsp;年間' | head -1 || printf 'なし')"
    return 1
  fi
  if [ "$fee" = "remaining_term_total" ] && ! printf '%s' "$row" | grep -qF "ご契約から&nbsp;${years}&nbsp;年間の利用料の総額のうち、終了日までの利用料を除いた残額"; then
    printf 'NG: plans.json の early_termination_fee は remaining_term_total だが、解約条件の行に残額の書き方が無い\n'
    return 1
  fi
  if [ "$dev" = "remaining_lump_sum" ] && ! printf '%s' "$row" | grep -qF '設計開発費用の分割払いの残りを一括でご請求します'; then
    printf 'NG: plans.json の dev_fee_on_early_termination は remaining_lump_sum だが、解約条件の行に「設計開発費用の分割払いの残りを一括でご請求します」が無い\n'
    return 1
  fi
  printf 'ok: 特商法ページの請求の形（%s / %s / %s）と最低利用期間（%s か月、%s、%s）は plans.json と一致\n' "$closing" "$due" "$first" "$term" "$fee" "$dev"
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

# 反証: 解約の月数を変えた plans.json の写しで落ちること
jq '.cancellation.notice_months = 2' "$PLANS" >"$tmp"
if check "$tmp" "$PAGE" >/dev/null; then
  printf 'FAIL: 解約の月数を変えた plans.json でも通った（検査が効いていない）\n'
  exit 1
fi
printf 'ok: 解約の月数を変えた plans.json では落ちる（反証）\n'

# 反証: 最低利用期間を変えた plans.json の写しで落ちること
jq '.minimum_term.months = 24' "$PLANS" >"$tmp"
if check "$tmp" "$PAGE" >/dev/null; then
  printf 'FAIL: 最低利用期間を変えた plans.json でも通った（検査が効いていない）\n'
  exit 1
fi
printf 'ok: 最低利用期間を変えた plans.json では落ちる（反証）\n'
