#!/usr/bin/env bash
# テスト用の偽 curl。通信しない。引数と「標準入力に Authorization があったか」を FAKE_LOG に残し、
# FAKE_SCENARIO に応じて Stripe の応答の形（本文 + 改行 + HTTP 状態）を返す。
# 応答の中身は FAKE_PLANS（plans.json）から作る。
set -euo pipefail

stdin_text="$(cat)"
{
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

respond() {
  printf '%s\n%s' "$2" "$1"
}

balance() {
  local live="false"
  case "$FAKE_SCENARIO" in livemismatch | live) live="true" ;; esac
  respond 200 "{\"object\":\"balance\",\"livemode\":$live}"
}

tax_rates() {
  case "$FAKE_SCENARIO" in
    empty | livemismatch) respond 200 '{"object":"list","data":[],"has_more":false}' ;;
    *) respond 200 "$(jq -c '{object: "list", has_more: false, data: [.tax_rate | {id: "txr_fake", percentage, inclusive, country, tax_type, metadata: {plan_key: .key}}]}' "$FAKE_PLANS")" ;;
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

case "$method:$path" in
  GET:/v1/balance) balance ;;
  GET:/v1/tax_rates) tax_rates ;;
  GET:/v1/products/*) product ;;
  GET:/v1/prices) prices ;;
  POST:/v1/*) respond 200 '{"id":"obj_fake_created"}' ;;
  *) respond 500 '{"error":{"type":"api_error","message":"fake-curl: unexpected call"}}' ;;
esac
