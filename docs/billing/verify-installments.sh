#!/usr/bin/env bash
# docs/billing/verify-installments.sh — テストモード専用。test clock で、開発費の schedule が
# 「N 回請求して止まる（N+1 回目が無い）」ことと、basic の最初の支払いでカードが保存されることを実測する。
# 寺田が実行する（テストモードの鍵）。本番の鍵なら何も書かずに止まる（livemode を読む）。
#
# 流れ: test clock → 顧客（clock 付き・メールなし）→ テスト用のカード（pm_card_visa）→ basic の subscription
#       → 最初の請求書を払う → basic にカードが保存されたか → そのカードで開発費の schedule（N 回）
#       → clock を 31 日ずつ N+2 回進める → 開発費の請求書を数える。
# basic と schedule の要求は、subscribe.sh と同じ lib.sh の build_basic_args / build_devfee_args で作る
# （本番で使う要求そのものを実測する）。開始は既定で align（本番の C6 と同じく basic の次の請求日）。
# 合格: 支払い済み N 件・それ以外の請求書 0 件・各回 税込（plans.json の額）・subscription が canceled。
# test clock は自動で消える（作成の応答の deletes_after を出す）。このスクリプトは何も消さない。
#
# 終了コード: 0 = 合格 / 3 = 前提の不足・モード違い / 4 = API・通信のエラー / 5 = 不合格 / 64 = 使い方の誤り
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"
PLANS="$SCRIPT_DIR/plans.json"
MODE="test"
SERVICE="business-dossier"
COUNT=""
START="align"
BASIC_PM=""
BASIC_PERIOD_END=""
SCHED_ID=""
readonly STEP_SECONDS=$((31 * 24 * 3600))
readonly POLL_SECONDS="${VERIFY_POLL_SECONDS:-3}"
readonly POLL_MAX="${VERIFY_POLL_MAX:-60}"
readonly MIN_STEP_SECONDS="${VERIFY_MIN_STEP_SECONDS:-7}"

usage() {
  cat <<'EOF'
使い方（テストモードだけ。寺田が実行）:
  bash docs/billing/verify-installments.sh [--service business-dossier|xesm] [--count N] [--start align|now] [--plans <path>]
  --count の既定は plans.json の installments（12）。--start の既定は align（本番の C6 と同じ）。
  所要は 2〜3 分（clock を 1 回進めるごとに 7 秒以上あける）。
鍵: 環境変数 COR_BILLING_API_KEY。無ければ表示しない入力で受ける。
EOF
}

parse_args() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --service | --count | --start | --plans)
        [ $# -ge 2 ] || die 64 "$1 に値が無い"
        case "$1" in
          --service) SERVICE="$2" ;;
          --count) COUNT="$2" ;;
          --start) START="$2" ;;
          --plans) PLANS="$2" ;;
        esac
        shift
        ;;
      -h | --help) usage; exit 0 ;;
      *) usage >&2; die 64 "知らない引数: $1（本番の --mode は無い。テストモード専用）" ;;
    esac
    shift
  done
}

validate_inputs() {
  local max
  plans_services | grep -qxF -- "$SERVICE" || die 64 "--service は $(plans_services | paste -sd'|' -) のどれか（観測: $SERVICE）"
  max="$(jq -r --arg lk "$(plans_lookup "$SERVICE" dev_fee)" '.prices[] | select(.lookup_key == $lk) | .installments' "$PLANS")"
  if [ -z "$COUNT" ]; then COUNT="$max"; fi
  [[ "$COUNT" =~ ^[0-9]+$ ]] && [ "$COUNT" -ge 1 ] && [ "$COUNT" -le "$max" ] || die 64 "--count は 1〜$max（観測: $COUNT）"
  case "$START" in align | now) ;; *) die 64 "--start は align か now（観測: $START）" ;; esac
}

expected_total() {
  jq -r --arg lk "$1" '.tax_rate.percentage as $p | .prices[] | select(.lookup_key == $lk)
    | .unit_amount_jpy_excl_tax + (.unit_amount_jpy_excl_tax * $p / 100 | round)' "$PLANS"
}

wait_clock_ready() {
  local clock="$1" i status
  for ((i = 0; i < POLL_MAX; i++)); do
    api_ok "clock の読取" GET "/v1/test_helpers/test_clocks/$clock"
    status="$(jq -r '.status' <<<"$RESP_BODY")"
    case "$status" in
      ready) return 0 ;;
      internal_failure) die 4 "clock $clock が internal_failure になった（進められない）" ;;
    esac
    sleep "$POLL_SECONDS"
  done
  die 4 "clock $clock が $((POLL_MAX * POLL_SECONDS)) 秒たっても ready にならない（観測 status=$status）"
}

# basic を作って最初の請求書を払い、保存されたカードを BASIC_PM、次の請求日を BASIC_PERIOD_END に入れる。
setup_basic() {
  local cus="$1" pm="$2" price="$3" txr="$4" sub inv
  build_basic_args "$cus" "$price" "$txr" "$SERVICE"
  api_ok "basic の作成" POST /v1/subscriptions "${BASIC_ARGS[@]}"
  sub="$(jq -r '.id' <<<"$RESP_BODY")"
  inv="$(jq -r '.latest_invoice | if type == "object" then .id else . end' <<<"$RESP_BODY")"
  api_ok "basic の最初の請求書を払う" POST "/v1/invoices/$inv/pay" --data-urlencode "payment_method=$pm"
  api_ok "basic の読取" GET "/v1/subscriptions/$sub"
  BASIC_PM="$(jq -r '.default_payment_method // empty | if type == "object" then .id else . end' <<<"$RESP_BODY")"
  BASIC_PERIOD_END="$(jq -r '.items.data[0].current_period_end // empty' <<<"$RESP_BODY")"
  printf 'VERIFY basic %s: status=%s、保存されたカード=%s、次の請求日=%s\n' "$sub" "$(jq -r '.status' <<<"$RESP_BODY")" \
    "${BASIC_PM:-なし}" "$(fmt_jst "${BASIC_PERIOD_END:-なし}")"
  [ -n "$BASIC_PM" ] || die 5 "VERIFY NG: basic の最初の支払いのあと、subscription にカードが保存されなかった（default_payment_method が空）"
}

# 開発費の schedule を作り、SCHED_ID に入れる。
create_schedule() {
  local cus="$1" price="$2" txr="$3" start="now"
  if [ "$START" = "align" ]; then
    [[ "$BASIC_PERIOD_END" =~ ^[0-9]+$ ]] || die 5 "VERIFY NG: basic の current_period_end を読めない（観測: ${BASIC_PERIOD_END:-なし}）"
    start="$BASIC_PERIOD_END"
  fi
  build_devfee_args "$cus" "$start" "$BASIC_PM" "$price" "$txr" "$COUNT" "$SERVICE"
  api_ok "開発費の schedule の作成" POST /v1/subscription_schedules "${DEVFEE_ARGS[@]}"
  SCHED_ID="$(jq -r '.id' <<<"$RESP_BODY")"
  printf 'VERIFY schedule %s: start=%s、status=%s、phases[0] %s → %s\n' "$SCHED_ID" "$START" "$(jq -r '.status' <<<"$RESP_BODY")" \
    "$(fmt_jst "$(jq -r '.phases[0].start_date' <<<"$RESP_BODY")")" "$(fmt_jst "$(jq -r '.phases[0].end_date' <<<"$RESP_BODY")")"
}

advance_all() {
  local clock="$1" start="$2" k target began
  for ((k = 1; k <= COUNT + 2; k++)); do
    began="$(date +%s)"
    target=$((start + k * STEP_SECONDS + 7200))
    api_ok "clock を進める（$k 回目）" POST "/v1/test_helpers/test_clocks/$clock/advance" --data-urlencode "frozen_time=$target"
    wait_clock_ready "$clock"
    printf 'VERIFY clock %s/%s: %s まで進めた\n' "$k" "$((COUNT + 2))" "$(fmt_jst "$target")"
    while [ $(($(date +%s) - began)) -lt "$MIN_STEP_SECONDS" ]; do sleep 1; done
  done
}

# 開発費の請求書を数えて合否を出す。
judge() {
  local sched="$1" want_total="$2" want_tax="$3" sub sub_status paid other bad_amount
  api_ok "schedule の読取" GET "/v1/subscription_schedules/$sched"
  sub="$(jq -r '.subscription // .released_subscription // empty | if type == "object" then .id else . end' <<<"$RESP_BODY")"
  printf 'VERIFY schedule status=%s subscription=%s\n' "$(jq -r '.status' <<<"$RESP_BODY")" "${sub:-なし}"
  [ -n "$sub" ] || die 5 "VERIFY NG: schedule に subscription が無い"
  api_ok "開発費の subscription の読取" GET "/v1/subscriptions/$sub"
  sub_status="$(jq -r '.status' <<<"$RESP_BODY")"
  api_ok "開発費の請求書の一覧" GET /v1/invoices --data-urlencode "subscription=$sub" --data-urlencode "limit=100"
  paid="$(jq '[.data[] | select(.status == "paid")] | length' <<<"$RESP_BODY")"
  other="$(jq '[.data[] | select(.status != "paid" and .status != "void")] | length' <<<"$RESP_BODY")"
  bad_amount="$(jq --argjson t "$want_total" --argjson x "$want_tax" '[.data[] | select(.status == "paid")
    | select(.total != $t or (([.total_taxes[]?.amount] | add // 0) != $x))] | length' <<<"$RESP_BODY")"
  printf 'VERIFY 開発費: 支払い済み %s 件（期待 %s）、それ以外 %s 件（期待 0）、額の違う請求書 %s 件（期待 0。各回 税込 %s 円・税 %s 円）、subscription=%s（期待 canceled）\n' \
    "$paid" "$COUNT" "$other" "$bad_amount" "$want_total" "$want_tax" "$sub_status"
  if [ "$paid" -eq "$COUNT" ] && [ "$other" -eq 0 ] && [ "$bad_amount" -eq 0 ] && [ "$sub_status" = "canceled" ]; then
    printf 'VERIFY ok: 開発費は %s 回請求して止まった（%s 回目は無い）\n' "$COUNT" "$((COUNT + 1))"
    return 0
  fi
  die 5 "VERIFY NG: 上の行の期待と観測が違う。本番で開発費の schedule を作らない"
}

main() {
  local basic_lk dev_lk basic_price dev_price txr start clock cus pm want_total want_tax
  parse_args "$@"
  require_tools jq
  require_curl
  bash "$SCRIPT_DIR/apply-plans.sh" --plans "$PLANS" >/dev/null || die 2 "plans.json の検査で不合格"
  validate_inputs
  require_implemented_billing
  load_api_version
  basic_lk="$(plans_lookup "$SERVICE" basic)"
  dev_lk="$(plans_lookup "$SERVICE" dev_fee)"
  want_total="$(expected_total "$dev_lk")"
  want_tax=$((want_total - $(jq -r --arg lk "$dev_lk" '.prices[] | select(.lookup_key == $lk) | .unit_amount_jpy_excl_tax' "$PLANS")))
  printf 'mode: verify-installments（テストモード専用）service=%s count=%s start=%s\n' "$SERVICE" "$COUNT" "$START"
  printf 'PLAN test clock → 顧客 → pm_card_visa → basic（%s）→ 最初の請求書を払う → 開発費の schedule（%s × %s 回）→ clock を %s 回進める → 数える\n' \
    "$basic_lk" "$dev_lk" "$COUNT" "$((COUNT + 2))"
  read_key
  check_mode
  basic_price="$(price_id_by_lookup "$basic_lk")"
  dev_price="$(price_id_by_lookup "$dev_lk")"
  txr="$(tax_rate_id)"
  start="$(date +%s)"
  api_ok "test clock の作成" POST /v1/test_helpers/test_clocks --data-urlencode "frozen_time=$start" --data-urlencode "name=cor-billing-verify-$start"
  clock="$(jq -r '.id' <<<"$RESP_BODY")"
  printf 'VERIFY clock %s（自動で消える日時: %s）\n' "$clock" "$(fmt_jst "$(jq -r '.deletes_after // "-"' <<<"$RESP_BODY")")"
  api_ok "顧客の作成（clock 付き・メールなし）" POST /v1/customers --data-urlencode "name=verify-installments $start" \
    --data-urlencode "test_clock=$clock" --data-urlencode "metadata[customer_code]=verify-$start" --data-urlencode "metadata[managed_by]=$MANAGED_BY"
  cus="$(jq -r '.id' <<<"$RESP_BODY")"
  api_ok "テスト用のカードを付ける" POST /v1/payment_methods/pm_card_visa/attach --data-urlencode "customer=$cus"
  pm="$(jq -r '.id' <<<"$RESP_BODY")"
  setup_basic "$cus" "$pm" "$basic_price" "$txr"
  create_schedule "$cus" "$dev_price" "$txr"
  advance_all "$clock" "$start"
  judge "$SCHED_ID" "$want_total" "$want_tax"
}

main "$@"
