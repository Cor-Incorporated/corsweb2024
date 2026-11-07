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
amount_arg=""
invoice_arg=""
query_arg=""
posted_meta="{}"
prev=""
for a in "$@"; do
  if [ "$prev" = "-X" ]; then method="$a"; fi
  case "$a" in
    https://*) url="$a" ;;
    "lookup_keys[]="*) lookup="${a#lookup_keys[]=}" ;;
    "amount="*) amount_arg="${a#amount=}" ;;
    "invoice="*) invoice_arg="${a#invoice=}" ;;
    "query="*) query_arg="${a#query=}" ;;
    "metadata["*"]="*)
      k="${a#"metadata["}"
      k="${k%%"]="*}"
      posted_meta="$(jq -c --arg k "$k" --arg v "${a#*"]="}" '. + {($k): $v}' <<<"$posted_meta")"
      ;;
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

# --- subscribe.sh 用（FAKE_SEARCH・FAKE_CUST_* ・FAKE_INV_* ・FAKE_CS_* などで応答を変える） ---
readonly MANAGED="corsweb/docs/billing/plans.json"
# 明細の POST の金額を残すファイル（請求書の小計を、実物と同じく明細の和で返すため）
ITEMS="$FAKE_LOG.items"

customer_search() {
  case "${FAKE_SEARCH:-none}" in
    one) respond 200 '{"object":"search_result","data":[{"id":"cus_existing","name":"既存","metadata":{"customer_code":"sample-co","payment":"card"}}]}' ;;
    one_clerk) respond 200 '{"object":"search_result","data":[{"id":"cus_existing","name":"既存","metadata":{"customer_code":"sample-co","payment":"card","clerk_org_id":"org_other"}}]}' ;;
    one_transfer) respond 200 '{"object":"search_result","data":[{"id":"cus_existing","name":"既存","metadata":{"customer_code":"sample-co","payment":"transfer"}}]}' ;;
    two) respond 200 '{"object":"search_result","data":[{"id":"cus_a","metadata":{}},{"id":"cus_b","metadata":{}}]}' ;;
    *) respond 200 '{"object":"search_result","data":[]}' ;;
  esac
}

# 顧客: metadata は FAKE_CUST_META（JSON）、カードは FAKE_CUST_PM（既定なし）
customer_json() {
  local m="${FAKE_CUST_META:-}"
  [ -n "$m" ] || m='{"customer_code":"sample-co"}'
  jq -nc --argjson m "$m" --argjson p "$1" --arg pm "${FAKE_CUST_PM:-}" \
    '{id: "cus_x", object: "customer", name: "テスト", metadata: ($m + $p), invoice_settings: {default_payment_method: (if $pm == "" then null else $pm end)}}'
}

# 顧客の更新: 送られた metadata を足して返す（FAKE_META_ECHO=wrong なら足さずに返す）
customer_update() {
  local p="$posted_meta"
  if [ "${FAKE_META_ECHO:-}" = "wrong" ]; then p="{}"; fi
  respond 200 "$(customer_json "$p")"
}

item_sum() {
  if [ -f "$ITEMS" ]; then awk '{ s += $1 } END { print s + 0 }' "$ITEMS"; else printf '0'; fi
}
item_count() {
  if [ -f "$ITEMS" ]; then wc -l <"$ITEMS" | tr -d ' '; else printf '0'; fi
}

# 請求書の JSON。inv_json <id> <status> <month> <小計>（税は小計の 10%）
inv_json() {
  jq -nc --arg id "$1" --arg st "$2" --arg m "$3" --argjson sub "$4" --argjson n "${5:-0}" --arg mb "$MANAGED" \
    --argjson due "${FAKE_INV_DUE:-1798729199}" \
    '{id: $id, object: "invoice", customer: "cus_x", status: $st, subtotal: $sub, total: ($sub + ($sub / 10 | floor)),
      amount_paid: (if $st == "paid" then ($sub + ($sub / 10 | floor)) else 0 end),
      total_taxes: [{amount: ($sub / 10 | floor)}], due_date: $due, hosted_invoice_url: "https://invoice.example.test/i/\($id)",
      lines: {object: "list", total_count: $n, data: []}, metadata: {billing_month: $m, managed_by: $mb}}'
}

# 同じ月の請求書: FAKE_INV_STATE（none|draft|open|paid|void|two）を、FAKE_INV_WHERE（both|search|list）に返す。
# 検索は問い合わせの月で、一覧は FAKE_INV_MONTH の月で返す。下書きの小計と明細の数は FAKE_DRAFT_SUBTOTAL・FAKE_DRAFT_LINES。
found_invoices() {
  local m="$1" st="${FAKE_INV_STATE:-none}"
  case "$st" in
    none) printf '[]' ;;
    two) printf '[%s,%s]' "$(inv_json in_a open "$m" 18000)" "$(inv_json in_b open "$m" 18000)" ;;
    draft) printf '[%s]' "$(inv_json in_draft draft "$m" "${FAKE_DRAFT_SUBTOTAL:-0}" "${FAKE_DRAFT_LINES:-0}")" ;;
    *) printf '[%s]' "$(inv_json "in_$st" "$st" "$m" 18000 2)" ;;
  esac
}

invoice_search() {
  local m
  m="$(printf '%s' "$query_arg" | sed -n 's/.*billing_month"\]:"\([0-9-]*\)".*/\1/p')"
  case "${FAKE_INV_WHERE:-both}" in
    both | search) respond 200 "{\"object\":\"search_result\",\"data\":$(found_invoices "$m")}" ;;
    *) respond 200 '{"object":"search_result","data":[]}' ;;
  esac
}

invoice_list() {
  case "${FAKE_INV_WHERE:-both}" in
    both | list) respond 200 "{\"object\":\"list\",\"has_more\":false,\"data\":$(found_invoices "${FAKE_INV_MONTH:-none}")}" ;;
    *) respond 200 '{"object":"list","has_more":false,"data":[]}' ;;
  esac
}

# 1 件の請求書の読取: 小計は（下書きの小計 + 送られた明細の和 + FAKE_SUBTOTAL_BUMP）。状態は FAKE_INV_GET_STATUS（既定 draft）
invoice_get() {
  local id="${path#/v1/invoices/}" sub n
  sub=$((${FAKE_DRAFT_SUBTOTAL:-0} + $(item_sum) + ${FAKE_SUBTOTAL_BUMP:-0}))
  n=$((${FAKE_DRAFT_LINES:-0} + $(item_count)))
  respond 200 "$(inv_json "$id" "${FAKE_INV_GET_STATUS:-draft}" "-" "$sub" "$n")"
}

invoice_action() {
  local id="${path#/v1/invoices/}" st="$1"
  id="${id%/*}"
  respond 200 "$(inv_json "$id" "$st" "-" "$((${FAKE_DRAFT_SUBTOTAL:-0} + $(item_sum)))" "$(item_count)")"
}

invoice_item_create() {
  printf '%s\n' "$amount_arg" >>"$ITEMS"
  respond 200 "{\"id\":\"ii_$(item_count)\",\"object\":\"invoiceitem\",\"invoice\":\"$invoice_arg\",\"amount\":$amount_arg}"
}

# card-setup の session: 状態は FAKE_CS_STATUS（既定 complete）。SetupIntent のカードは FAKE_SETI_PM（既定 pm_saved）
checkout_get() {
  respond 200 "{\"id\":\"${path##*/}\",\"object\":\"checkout.session\",\"mode\":\"setup\",\"status\":\"${FAKE_CS_STATUS:-complete}\",\"url\":\"https://checkout.example.test/c/old\",\"setup_intent\":\"seti_1\"}"
}

case "$method:$path" in
  GET:/v1/balance) balance ;;
  GET:/v1/tax_rates) tax_rates ;;
  GET:/v1/products/*) product ;;
  GET:/v1/prices) prices ;;
  GET:/v1/customers/search) customer_search ;;
  GET:/v1/customers/*) respond 200 "$(customer_json '{}')" ;;
  POST:/v1/customers) respond 200 '{"id":"cus_new"}' ;;
  POST:/v1/customers/*) customer_update ;;
  GET:/v1/prices/* | GET:/v1/tax_rates/*) respond 200 "{\"id\":\"${path##*/}\",\"active\":${FAKE_ACTIVE:-true},\"percentage\":10,\"unit_amount\":10000}" ;;
  GET:/v1/invoices/search) invoice_search ;;
  GET:/v1/invoices) invoice_list ;;
  GET:/v1/invoices/*) invoice_get ;;
  POST:/v1/invoices) respond 200 "$(inv_json in_new draft "-" 0 0)" ;;
  POST:/v1/invoices/*/finalize) invoice_action "${FAKE_FINALIZE_STATUS:-open}" ;;
  POST:/v1/invoices/*/send) invoice_action open ;;
  POST:/v1/invoices/*/pay) invoice_action "${FAKE_PAY_STATUS:-paid}" ;;
  POST:/v1/invoiceitems) invoice_item_create ;;
  GET:/v1/invoiceitems/*) respond 200 "{\"id\":\"${path##*/}\",\"object\":\"invoiceitem\",\"invoice\":\"${FAKE_II_INVOICE:-in_new}\"}" ;;
  POST:/v1/checkout/sessions) respond 200 '{"id":"cs_new","object":"checkout.session","mode":"setup","status":"open","url":"https://checkout.example.test/c/new","expires_at":1767225600}' ;;
  GET:/v1/checkout/sessions/*) checkout_get ;;
  GET:/v1/setup_intents/*) respond 200 "{\"id\":\"${path##*/}\",\"object\":\"setup_intent\",\"status\":\"succeeded\",\"payment_method\":\"${FAKE_SETI_PM:-pm_saved}\"}" ;;
  POST:/v1/*) respond 200 '{"id":"obj_fake_created"}' ;;
  *) respond 500 '{"error":{"type":"api_error","message":"fake-curl: unexpected call"}}' ;;
esac
