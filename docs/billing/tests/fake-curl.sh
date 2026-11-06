#!/usr/bin/env bash
# テスト用の偽 curl。通信しない。引数と「標準入力に Authorization があったか」を FAKE_LOG に残し、
# FAKE_SCENARIO に応じて Stripe の応答の形（本文 + 改行 + HTTP 状態）を返す。
# 応答の中身は FAKE_PLANS（plans.json）から作る。
set -euo pipefail

if [ "${1:-}" = "--version" ]; then
  printf 'curl %s (fake)\n' "${FAKE_CURL_VERSION:-8.7.1}"
  exit 0
fi

stdin_text="$(cat)"
{
  printf 'FIRST %s\n' "${1:-}"
  printf 'ARGV'
  for a in "$@"; do printf ' [%s]' "$a"; done
  printf '\n'
  case "$stdin_text" in
    *"Authorization: Bearer "*) printf 'STDIN_AUTH yes\n' ;;
    *) printf 'STDIN_AUTH no\n' ;;
  esac
} >>"$FAKE_LOG"

method="GET"
url=""
lookup=""
prev=""
for a in "$@"; do
  if [ "$prev" = "-X" ]; then method="$a"; fi
  case "$a" in
    https://*) url="$a" ;;
    "lookup_keys[]="*) lookup="${a#lookup_keys[]=}" ;;
  esac
  prev="$a"
done
path="${url#https://api.stripe.com}"
printf 'CALL %s %s\n' "$method" "$path" >>"$FAKE_LOG"

# 本文 + 改行 + Idempotent-Replayed の値 + 改行 + HTTP 状態（curl の --write-out と同じ形）。
# FAKE_REPLAY=1 なら POST の応答を「前回の結果」として返す。
respond() {
  local replayed=""
  if [ "$method" = "POST" ] && [ "${FAKE_REPLAY:-}" = "1" ]; then replayed="true"; fi
  # 実物の curl が値の末尾に CR を残す・大文字で返す場合の形（FAKE_REPLAY_RAW=1）
  if [ "$method" = "POST" ] && [ "${FAKE_REPLAY_RAW:-}" = "1" ]; then replayed=$'True\r'; fi
  printf '%s\n%s\n%s' "$2" "$replayed" "$1"
}

balance() {
  local live="false"
  case "$FAKE_SCENARIO" in livemismatch | live) live="true" ;; esac
  respond 200 "{\"object\":\"balance\",\"livemode\":$live}"
}

tax_rates() {
  case "$FAKE_SCENARIO" in
    empty | livemismatch) respond 200 '{"object":"list","data":[],"has_more":false}' ;;
    *) respond 200 "$(jq -c '{object: "list", has_more: false, data: [.tax_rate | {id: "txr_fake", percentage, inclusive, country, tax_type, metadata: {plan_key: .id}}]}' "$FAKE_PLANS")" ;;
  esac
}

product() {
  local id="${path#/v1/products/}"
  case "$FAKE_SCENARIO" in
    empty | livemismatch) respond 404 '{"error":{"type":"invalid_request_error","code":"resource_missing","message":"No such product"}}' ;;
    *) respond 200 "$(jq -c --arg id "$id" '.products[] | select(.id == $id) | {id, name, active: true, metadata: {service, kind}}' "$FAKE_PLANS")" ;;
  esac
}

prices() {
  case "$FAKE_SCENARIO" in
    empty | livemismatch) respond 200 '{"object":"list","data":[],"has_more":false}' ;;
    *)
      local bump=0
      if [ "$FAKE_SCENARIO" = "pricemismatch" ] && [ "$lookup" = "business_dossier_basic_monthly" ]; then bump=1000; fi
      respond 200 "$(jq -c --arg k "$lookup" --argjson bump "$bump" '{object: "list", has_more: false, data: [.prices[] | select(.lookup_key == $k) | {id: "price_fake", unit_amount: (.unit_amount_jpy_excl_tax + $bump), currency: "jpy", type: "recurring", recurring: {interval}, tax_behavior, product}]}' "$FAKE_PLANS")"
      ;;
  esac
}

# --- subscribe.sh / verify-installments.sh 用（FAKE_SUBS・FAKE_SEARCH などで応答を変える） ---
readonly PERIOD_END=1767225600

basic_sub_json() {
  local pm='"pm_fake"'
  if [ "${FAKE_SUBS:-}" = "basic_nopm" ]; then pm='null'; fi
  printf '{"id":"sub_basic","status":"active","cancel_at_period_end":false,"default_payment_method":%s,"metadata":{"service":"business-dossier","plan":"basic"},"items":{"data":[{"current_period_end":%s}]}}' "$pm" "$PERIOD_END"
}

subscriptions_list() {
  case "${FAKE_SUBS:-none}" in
    basic_active | basic_nopm) respond 200 "{\"object\":\"list\",\"has_more\":false,\"data\":[$(basic_sub_json)]}" ;;
    basic_incomplete) respond 200 '{"object":"list","has_more":false,"data":[{"id":"sub_inc","status":"incomplete","cancel_at_period_end":false,"default_payment_method":null,"latest_invoice":{"id":"in_9","status":"open","hosted_invoice_url":"https://invoice.example.test/i/9"},"metadata":{"service":"xesm","plan":"basic"},"items":{"data":[{"current_period_end":1767225600}]}}]}' ;;
    *) respond 200 '{"object":"list","has_more":false,"data":[]}' ;;
  esac
}

subscription_get() {
  local id="${path#/v1/subscriptions/}"
  if [ "$id" = "sub_dev" ]; then
    respond 200 "{\"id\":\"sub_dev\",\"status\":\"${FAKE_DEV_STATUS:-canceled}\",\"metadata\":{\"plan\":\"dev_fee\"}}"
    return
  fi
  local pm='"pm_fake"'
  if [ "${FAKE_PM:-}" = "none" ]; then pm='null'; fi
  local inv="{\"id\":\"in_1\",\"status\":\"${FAKE_INV_STATUS:-open}\",\"hosted_invoice_url\":\"https://invoice.example.test/i/1\",\"total\":11000,\"total_taxes\":[{\"amount\":1000}]}"
  respond 200 "{\"id\":\"$id\",\"status\":\"${FAKE_SUB_STATUS:-active}\",\"cancel_at_period_end\":${FAKE_CANCEL_STATE:-false},\"default_payment_method\":$pm,\"latest_invoice\":$inv,\"metadata\":{\"plan\":\"${FAKE_SUB_PLAN:-basic}\",\"service\":\"business-dossier\"},\"items\":{\"data\":[{\"current_period_end\":$PERIOD_END}]}}"
}

subscription_create() {
  local total="${FAKE_BASIC_TOTAL:-11000}"
  respond 200 "{\"id\":\"sub_new\",\"status\":\"incomplete\",\"latest_invoice\":{\"id\":\"in_1\",\"hosted_invoice_url\":\"https://invoice.example.test/i/1\",\"total\":$total,\"total_taxes\":[{\"amount\":1000}]}}"
}

schedules_list() {
  case "${FAKE_SCHEDULES:-none}" in
    devfee_active) respond 200 '{"object":"list","has_more":false,"data":[{"id":"sub_sched_old","status":"active","metadata":{"service":"business-dossier","plan":"dev_fee"}}]}' ;;
    *) respond 200 '{"object":"list","has_more":false,"data":[]}' ;;
  esac
}

invoices_list() {
  local n="${FAKE_DEV_INVOICES:-12}" open="${FAKE_DEV_OPEN:-0}"
  jq -nc --argjson n "$n" --argjson o "$open" --argjson t "${FAKE_DEV_TOTAL:-8800}" \
    '{object: "list", has_more: false, data: (([range($n)] | map({status: "paid", total: $t, total_taxes: [{amount: 800}]})) + ([range($o)] | map({status: "open", total: 8800, total_taxes: [{amount: 800}]})))}' \
    | { read -r body; respond 200 "$body"; }
}

customer_search() {
  case "${FAKE_SEARCH:-none}" in
    one) respond 200 '{"object":"search_result","data":[{"id":"cus_existing","name":"既存","metadata":{"customer_code":"sample-co"}}]}' ;;
    one_clerk) respond 200 '{"object":"search_result","data":[{"id":"cus_existing","name":"既存","metadata":{"customer_code":"sample-co","clerk_org_id":"org_other"}}]}' ;;
    two) respond 200 '{"object":"search_result","data":[{"id":"cus_a","metadata":{}},{"id":"cus_b","metadata":{}}]}' ;;
    *) respond 200 '{"object":"search_result","data":[]}' ;;
  esac
}

case "$method:$path" in
  GET:/v1/balance) balance ;;
  GET:/v1/tax_rates) tax_rates ;;
  GET:/v1/products/*) product ;;
  GET:/v1/prices) prices ;;
  GET:/v1/customers/search) customer_search ;;
  GET:/v1/customers/*) respond 200 '{"id":"cus_x","name":"テスト","metadata":{"customer_code":"sample-co"}}' ;;
  GET:/v1/subscriptions) subscriptions_list ;;
  GET:/v1/subscriptions/*) subscription_get ;;
  POST:/v1/subscriptions) subscription_create ;;
  POST:/v1/subscriptions/*) respond 200 "{\"id\":\"${path#/v1/subscriptions/}\",\"cancel_at_period_end\":true,\"items\":{\"data\":[{\"current_period_end\":$PERIOD_END}]}}" ;;
  GET:/v1/subscription_schedules) schedules_list ;;
  GET:/v1/subscription_schedules/*) respond 200 "{\"id\":\"sub_sched_1\",\"status\":\"${FAKE_SCHED_STATUS:-canceled}\",\"subscription\":\"sub_dev\"}" ;;
  GET:/v1/prices/* | GET:/v1/tax_rates/*) respond 200 "{\"id\":\"${path##*/}\",\"active\":${FAKE_ACTIVE:-true},\"percentage\":10,\"unit_amount\":10000}" ;;
  POST:/v1/subscription_schedules) respond 200 "{\"id\":\"sub_sched_1\",\"status\":\"not_started\",\"subscription\":null,\"phases\":[{\"start_date\":$PERIOD_END,\"end_date\":$((PERIOD_END + 31536000))}]}" ;;
  GET:/v1/invoices) invoices_list ;;
  POST:/v1/invoices/*/pay) respond 200 '{"id":"in_1","status":"paid"}' ;;
  POST:/v1/test_helpers/test_clocks) respond 200 "{\"id\":\"clock_fake\",\"status\":\"ready\",\"deletes_after\":$PERIOD_END}" ;;
  POST:/v1/test_helpers/test_clocks/*/advance) respond 200 '{"id":"clock_fake","status":"advancing"}' ;;
  GET:/v1/test_helpers/test_clocks/*) respond 200 "{\"id\":\"clock_fake\",\"status\":\"${FAKE_CLOCK_STATUS:-ready}\"}" ;;
  POST:/v1/payment_methods/*/attach) respond 200 '{"id":"pm_fake"}' ;;
  POST:/v1/customers) respond 200 '{"id":"cus_new"}' ;;
  POST:/v1/*) respond 200 '{"id":"obj_fake_created"}' ;;
  *) respond 500 '{"error":{"type":"api_error","message":"fake-curl: unexpected call"}}' ;;
esac
