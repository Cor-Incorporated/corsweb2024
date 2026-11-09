#!/usr/bin/env bash
# shellcheck disable=SC2016 # jq のプログラムは単一引用符で書く（$ は jq の変数で、シェルが展開しないのが正しい）
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
  key_kind="unknown"
  if [ -n "${FAKE_CLERK_KEY:-}" ] && printf '%s' "$stdin_text" | grep -qF "Bearer $FAKE_CLERK_KEY"; then
    key_kind="clerk"
  elif [ -n "${FAKE_STRIPE_KEY:-}" ] && printf '%s' "$stdin_text" | grep -qF "Bearer $FAKE_STRIPE_KEY"; then
    key_kind="stripe"
  fi
  printf 'STDIN_KEY %s\n' "$key_kind"
} >>"$FAKE_LOG"

# Clerk（api.clerk.com）の呼出しは、ここで応答して終わる。Stripe の応答の形とは別（本文 + 改行 + HTTP 状態）。
case " $* " in
  *" https://api.clerk.com/v1/"*)
    clerk_path=""
    clerk_method="GET"
    prev=""
    for a in "$@"; do
      if [ "$prev" = "-X" ]; then clerk_method="$a"; fi
      case "$a" in https://api.clerk.com/v1/*) clerk_path="${a#https://api.clerk.com/v1}" ;; esac
      prev="$a"
    done
    printf 'CALL %s %s\n' "$clerk_method" "$clerk_path" >>"$FAKE_LOG"
    clerk_org="${clerk_path#/organizations/}"
    clerk_org="${clerk_org%%/*}"
    # 本文（curl の設定の data = "..."）を戻す
    raw="$(printf '%s\n' "$stdin_text" | sed -n 's/^data = "\(.*\)"$/\1/p' | tail -1)"
    raw="$(printf '%s' "$raw" | sed -e 's/\\\\/\\/g' -e 's/\\"/"/g')"
    [ -z "$raw" ] || printf 'CLERK_BODY %s\n' "$raw" >>"$FAKE_LOG"
    state_file="$FAKE_LOG.clerk"
    if [ -f "$state_file" ]; then
      state="$(cat "$state_file")"
    elif [ -n "${FAKE_CLERK_META:-}" ]; then
      state="$FAKE_CLERK_META"
    else
      state='{}'
    fi
    if [ "${FAKE_CLERK_STATUS:-200}" != "200" ]; then
      printf '{"error":{"message":"fake-curl: clerk failure"}}\n\n%s' "$FAKE_CLERK_STATUS"
      exit 0
    fi
    # GET（送る前の読取）は今の状態をそのまま返す
    if [ "$clerk_method" = "GET" ]; then
      printf '{"id":"%s","object":"organization","public_metadata":%s}\n\n200' "$clerk_org" "$state"
      exit 0
    fi
    if [ "${FAKE_CLERK_ECHO:-}" = "wrong" ]; then
      # 送った値を反映しない（Clerk が別の値を返したときの形）。どの状態から始めても一致しないようにする。
      printf '{"id":"%s","object":"organization","public_metadata":{"services":{"business-dossier":{"from":"2020-01-01","until":null,"hold":false}}}}\n\n200' "$clerk_org"
      exit 0
    fi
    if [ -z "$raw" ]; then
      incoming='{}'
    else
      incoming="$(jq -c '.public_metadata // {}' <<<"$raw")"
    fi
    merged="$(jq -c --argjson inc "$incoming" '
      def deepmerge($a; $b):
        if ($b | type) == "object" then
          (if ($a | type) == "object" then $a else {} end) as $base
          | reduce ($b | keys_unsorted[]) as $k ($base;
              if $b[$k] == null then del(.[$k]) else .[$k] = deepmerge(.[$k]; $b[$k]) end)
        else $b end;
      deepmerge(.; $inc)' <<<"$state")"
    printf '%s' "$merged" >"$state_file"
    printf '{"id":"%s","object":"organization","public_metadata":%s}\n\n200' "$clerk_org" "$merged"
    exit 0
    ;;
esac

method="GET"
url=""
lookup=""
start_arg=""
customer_arg=""
status_arg=""
limit_arg=""
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
    "starting_after="*) start_arg="${a#starting_after=}" ;;
    "status="*) status_arg="${a#status=}" ;;
    "limit="*) limit_arg="${a#limit=}" ;;
    "customer="*) customer_arg="${a#customer=}" ;;
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

# --- resync 用: 顧客の状態（id → 顧客）と、open の請求書の一覧。状態は $FAKE_LOG.customers に持つ ---
RESYNC_CUSTOMERS="$FAKE_LOG.customers"
resync_store() {
  if [ -f "$RESYNC_CUSTOMERS" ]; then
    cat "$RESYNC_CUSTOMERS"
  else
    jq -c -n --argjson a "${FAKE_CUST_PAGE1:-[]}" --argjson b "${FAKE_CUST_PAGE2:-[]}" '($a + $b) | map({key: .id, value: .}) | from_entries'
  fi
}
# 顧客の一覧。100 件ずつ、starting_after でページを送る（FAKE_CUST_PAGE1 と FAKE_CUST_PAGE2）
resync_customers_list() {
  local data more
  if [ -n "${start_arg:-}" ]; then
    data="${FAKE_CUST_PAGE2:-[]}"
    more=false
  else
    data="${FAKE_CUST_PAGE1:-[]}"
    if [ -n "${FAKE_CUST_PAGE2:-}" ]; then more=true; else more=false; fi
  fi
  respond 200 "$(jq -c -n --argjson d "$data" --argjson m "$more" '{object: "list", has_more: $m, data: $d}')"
}
resync_customer_get() {
  local id="${path#/v1/customers/}" rec
  rec="$(jq -c --arg i "$id" '.[$i] // empty' <<<"$(resync_store)")"
  if [ -z "$rec" ]; then
    respond 404 '{"error":{"type":"invalid_request_error","code":"resource_missing","message":"No such customer"}}'
    return 0
  fi
  respond 200 "$rec"
}
resync_customer_update() {
  local id="${path#/v1/customers/}" cur merged
  cur="$(resync_store)"
  merged="$(jq -c --arg i "$id" --argjson p "$posted_meta" '.[$i].metadata = ((.[$i].metadata // {}) + $p)' <<<"$cur")"
  printf '%s' "$merged" >"$RESYNC_CUSTOMERS"
  respond 200 "$(jq -c --arg i "$id" '.[$i]' <<<"$merged")"
}
# open の請求書の一覧。FAKE_OPEN_INVOICES（1 ページ目）と FAKE_OPEN_INVOICES_P2（2 ページ目）
resync_invoices() {
  local cus="${customer_arg:-}" p1="${FAKE_OPEN_INVOICES:-}" p2="${FAKE_OPEN_INVOICES_P2:-}" data more
  [ -n "$p1" ] || p1='{}'
  [ -n "$p2" ] || p2='{}'
  # status が付いていなければ全部を返す（本物の一覧と同じ。付いていればその状態だけ）
  local st="${status_arg:-}" filter='.[$c] // []'
  if [ -n "$st" ]; then filter='.[$c] // [] | map(select((.status // "open") == $st))'; fi
  if [ -n "${start_arg:-}" ]; then
    data="$(jq -c --arg c "$cus" --arg st "$st" "$filter" <<<"$p2")"
    more=false
  else
    data="$(jq -c --arg c "$cus" --arg st "$st" "$filter" <<<"$p1")"
    if [ "$(jq -c --arg c "$cus" --arg st "$st" "$filter | length" <<<"$p2")" -gt 0 ]; then more=true; else more=false; fi
  fi
  respond 200 "$(jq -c -n --argjson d "$data" --argjson m "$more" '{object: "list", has_more: $m, data: ($d | map(. + {object: "invoice", status: "open"}))}')"
}
resync_find_invoice() {
  local id="$1" p1="${FAKE_OPEN_INVOICES:-}" p2="${FAKE_OPEN_INVOICES_P2:-}"
  [ -n "$p1" ] || p1='{}'
  [ -n "$p2" ] || p2='{}'
  jq -c -n --argjson a "$p1" --argjson b "$p2" --arg i "$id" '[([$a, $b][] | .[][] | select(.id == $i))][0] // {}'
}
# 請求書の明細の一覧（hold を決めるのに使う）。100 件ずつ、starting_after=il_<番号> でページを送る
resync_invoice_lines() {
  local id="${path#/v1/invoices/}" rec svc_json total start=0 limit=100 data more
  id="${id%/lines}"
  rec="$(resync_find_invoice "$id")"
  if [ "$(jq -r '.lines_status // 0' <<<"$rec")" = "500" ]; then
    respond 500 '{"error":{"message":"fake-curl: lines failure"}}'
    return 0
  fi
  svc_json="$(jq -c '(if .no_service then "" else "xesm" end) as $fill
    | if (.lines_count // 0) > 0 then [range(0; .lines_count) | $fill]
      elif (.services | type) == "array" then .services
      elif .service then [.service]
      else []
      end' <<<"$rec")"
  total="$(jq 'length' <<<"$svc_json")"
  if [ -n "${start_arg:-}" ]; then start="${start_arg#il_}"; fi
  case "$start" in '' | *[!0-9]*) start=0 ;; esac
  if [ -n "${limit_arg:-}" ]; then limit="$limit_arg"; fi
  data="$(jq -c -n --argjson s "$svc_json" --argjson st "$start" --argjson l "$limit" '[range(0; ($s | length)) as $i | select($i >= $st and $i < ($st + $l)) | {id: ("il_" + ($i | tostring)), object: "invoiceitem", metadata: (if $s[$i] == "" then {} else {service: $s[$i]} end)}]')"
  if [ $((start + limit)) -lt "$total" ]; then more=true; else more=false; fi
  respond 200 "$(jq -c -n --argjson d "$data" --argjson m "$more" '{object: "list", has_more: $m, data: $d}')"
}
# 請求書の明細。metadata.service を 1 つだけ返す（hold を決めるのに使う）
resync_invoice_get() {
  local id="${path#/v1/invoices/}" p1="${FAKE_OPEN_INVOICES:-}" p2="${FAKE_OPEN_INVOICES_P2:-}" rec
  [ -n "$p1" ] || p1='{}'
  [ -n "$p2" ] || p2='{}'
  rec="$(jq -c -n --argjson a "$p1" --argjson b "$p2" --arg i "$id" '[([$a, $b][] | .[][] | select(.id == $i))][0] // {}')"
  respond 200 "$(jq -c '{id, object: "invoice", status: "open", customer, due_date, lines: {object: "list", data: (if .service then [{id: ("il_" + .id), object: "invoiceitem", metadata: {service: .service}}] else [] end)}}' <<<"$rec")"
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

# FAKE_OLDER_OPEN=YYYY-MM なら、一覧にその月の open の請求書（in_older）も足す
invoice_list() {
  local data
  data="$(found_invoices "${FAKE_INV_MONTH:-none}")"
  if [ -n "${FAKE_OLDER_OPEN:-}" ]; then
    data="$(jq -c --argjson x "$(inv_json in_older open "$FAKE_OLDER_OPEN" 18000 2)" '. + [$x]' <<<"$data")"
  fi
  case "${FAKE_INV_WHERE:-both}" in
    both | list) respond 200 "{\"object\":\"list\",\"has_more\":false,\"data\":$data}" ;;
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
  GET:/v1/customers) if [ "${FAKE_RESYNC:-}" = "1" ]; then resync_customers_list; else respond 200 '{"object":"list","has_more":false,"data":[]}'; fi ;;
  GET:/v1/customers/*) if [ "${FAKE_RESYNC:-}" = "1" ]; then resync_customer_get; else respond 200 "$(customer_json '{}')"; fi ;;
  POST:/v1/customers) respond 200 '{"id":"cus_new"}' ;;
  POST:/v1/customers/*) if [ "${FAKE_RESYNC:-}" = "1" ]; then resync_customer_update; else customer_update; fi ;;
  GET:/v1/prices/* | GET:/v1/tax_rates/*) respond 200 "{\"id\":\"${path##*/}\",\"active\":${FAKE_ACTIVE:-true},\"percentage\":10,\"unit_amount\":10000}" ;;
  GET:/v1/invoices/search) invoice_search ;;
  GET:/v1/invoices) if [ "${FAKE_RESYNC:-}" = "1" ]; then resync_invoices; else invoice_list; fi ;;
  GET:/v1/invoices/*/lines) resync_invoice_lines ;;
  GET:/v1/invoices/*) if [ "${FAKE_RESYNC:-}" = "1" ]; then resync_invoice_get; else invoice_get; fi ;;
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
